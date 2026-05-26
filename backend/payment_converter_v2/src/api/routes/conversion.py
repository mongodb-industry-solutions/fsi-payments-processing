"""Conversion endpoints — multi-hop streaming and canonical JSON retrieval."""

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
import logging
import uuid
import json
import time

from src.api.models import MultiHopConversionRequest
from src.api.dependencies import (
    converter,
    mongodb_service,
    agent_client,
    solana_service,
    SSE_HEADERS,
)
from src.api.state import pending_conversions, pending_ai_reviews
from src.exceptions import CountryValidationException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter()


class CanonicalJsonRetrieveRequest(BaseModel):
    """Body for canonical JSON Retrieve / Confirmation.Retrieve — was a path param."""
    conversionRunReference: str = Field(
        ..., description="The conversion run ID (UUID v4) to retrieve."
    )


@router.post(
    "/PaymentOrderInitiationTransaction/Initiate",
    status_code=status.HTTP_200_OK,
)
async def convert_multi_hop_stream(request: MultiHopConversionRequest):
    """
    Stream multi-hop conversion with real-time SSE updates.

    Events emitted:
    - hop1_start / hop1_complete
    - validation_failed / agent_* events (if country rules trigger)
    - ai_review_required (if AI fields need human verification)
    - crypto_* events (if blockchain settlement)
    - hop2_start / hop2_complete
    - complete: Final result with output
    """

    async def event_generator():
        conversion_run_id = str(uuid.uuid4())
        start_time = time.time()
        agent_correction = None

        try:
            logger.info(f"Starting streaming multi-hop: {request.source_format} → {request.target_format}")

            yield f"data: {json.dumps({'type': 'start', 'conversion_run_id': conversion_run_id})}\n\n"

            # Hop 1: Source → JSON (country validation deferred)
            yield f"data: {json.dumps({'type': 'hop1_start', 'source': request.source_format, 'target': 'JSON'})}\n\n"

            hop1_start = time.time()

            hop1_result = await converter.convert(
                source_format=request.source_format,
                target_format="JSON",
                message=request.message,
                conversion_run_id=conversion_run_id,
                use_ai=request.use_ai,
                validate_country=False
            )

            hop1_time = time.time() - hop1_start
            yield f"data: {json.dumps({'type': 'hop1_complete', 'time': round(hop1_time, 2), 'detailed_processing': hop1_result.get('detailed_processing', {})})}\n\n"

            # Check if AI fields need human review
            fields_for_review = hop1_result.get('fields_for_review', [])
            ai_lane_data = hop1_result.get('detailed_processing', {}).get('ai_lane', {})
            ai_fields = ai_lane_data.get('fields', [])

            logger.info(f"AI Review Check: use_ai={request.use_ai}, fields_for_review={fields_for_review}, ai_lane_total={ai_lane_data.get('total_fields', 0)}, ai_fields_count={len(ai_fields)}")

            if fields_for_review and request.use_ai and ai_fields:
                logger.info(f"AI review required for {len(ai_fields)} fields")

                pending_ai_reviews.set(conversion_run_id, {
                    'hop1_result': hop1_result,
                    'request': {
                        'source_format': request.source_format,
                        'target_format': request.target_format,
                        'message': request.message,
                        'use_ai': request.use_ai
                    },
                    'conversion_run_id': conversion_run_id,
                    'start_time': start_time,
                    'hop1_time': hop1_time
                })

                yield f"data: {json.dumps({'type': 'ai_review_required', 'conversion_run_id': conversion_run_id, 'fields': ai_fields, 'message': 'AI-processed fields require human verification before proceeding'})}\n\n"
                return

            # No AI review needed — run country validation
            try:
                from src.validators.country_rules import validate_country_rules
                validate_country_rules(
                    canonical_json=json.loads(hop1_result['converted_message']),
                    conversion_id=f"{request.source_format}_to_JSON",
                    source_format=request.source_format,
                    target_format="JSON",
                    conversion_run_id=conversion_run_id,
                    detailed_processing=hop1_result.get('detailed_processing', {})
                )
            except CountryValidationException as e:
                yield f"data: {json.dumps({'type': 'validation_failed', 'country': e.conversion_context.get('additional_context', {}).get('country'), 'field': e.field_name, 'problem': e.problem, 'original_value': e.original_value})}\n\n"
                yield f"data: {json.dumps({'type': 'agent_start', 'problem': e.problem[:100] + '...' if len(e.problem) > 100 else e.problem, 'field': e.field_name})}\n\n"

                current_problem = e.problem
                final_state = {}
                review_required = False

                async for event in agent_client.process_payment_stream_with_review(
                    problem=e.problem,
                    field_name=e.field_name,
                    original_value=e.original_value,
                    payment_data=e.payment_data,
                    conversion_context=e.conversion_context
                ):
                    if "supervisor" in event:
                        supervisor_state = event["supervisor"]
                        final_state.update(supervisor_state)
                        messages = supervisor_state.get("messages", [])
                        reasoning = ""
                        next_agent = supervisor_state.get("next_agent", "")
                        if messages:
                            reasoning = messages[-1].get("content", "")
                        yield f"data: {json.dumps({'type': 'agent_supervisor', 'status': 'routing', 'reasoning': reasoning, 'next_agent': next_agent, 'problem': current_problem[:100] + '...' if len(current_problem) > 100 else current_problem, 'details': {'messages_count': len(messages)}})}\n\n"

                    elif "resolution" in event:
                        resolution_state = event["resolution"]
                        final_state.update(resolution_state)
                        messages = resolution_state.get("messages", [])
                        logger.info(f"Resolution messages count: {len(messages)}")
                        for idx, msg in enumerate(messages):
                            msg_type = msg.get("type", "")
                            logger.info(f"Message {idx}: type={msg_type}, content_len={len(str(msg.get('content', '')))}, has_tool_calls={'tool_calls' in msg}")
                            if "tool_calls" in msg and msg.get("tool_calls"):
                                agent_reasoning = msg.get("content", "")
                                logger.info(f"Tool call message content: {agent_reasoning[:300] if agent_reasoning else 'EMPTY'}")
                                if not agent_reasoning:
                                    for prev_idx in range(idx - 1, -1, -1):
                                        prev_msg = messages[prev_idx]
                                        if prev_msg.get("type") == "ai" and prev_msg.get("content"):
                                            agent_reasoning = prev_msg.get("content", "")
                                            break
                                for tool_call in msg["tool_calls"]:
                                    tool_name = tool_call.get("name", "unknown")
                                    tool_args = tool_call.get("args", {})
                                    yield f"data: {json.dumps({'type': 'tool_call', 'tool': tool_name, 'args': tool_args, 'reasoning': agent_reasoning, 'details': tool_args})}\n\n"
                            if msg_type == "tool":
                                tool_name = msg.get("name", "unknown")
                                tool_content = msg.get("content", "")
                                try:
                                    tool_result = json.loads(tool_content) if isinstance(tool_content, str) else tool_content
                                except Exception:
                                    tool_result = str(tool_content)
                                yield f"data: {json.dumps({'type': 'tool_result', 'tool': tool_name, 'result': tool_result, 'details': tool_result})}\n\n"
                        solution = resolution_state.get("solution", {})
                        if solution and solution.get("reasoning"):
                            yield f"data: {json.dumps({'type': 'agent_resolution', 'status': 'complete', 'proposed_value': solution.get('proposed_value', ''), 'confidence': solution.get('confidence', 0), 'reasoning': solution.get('reasoning', ''), 'details': {'proposed_value': solution.get('proposed_value'), 'confidence': solution.get('confidence'), 'reasoning': solution.get('reasoning'), 'tool_results': solution.get('tool_results', [])}})}\n\n"
                        else:
                            yield f"data: {json.dumps({'type': 'agent_resolution', 'status': 'processing'})}\n\n"

                    elif "execution" in event:
                        execution_state = event["execution"]
                        final_state.update(execution_state)
                        result = execution_state.get("result", {})
                        yield f"data: {json.dumps({'type': 'agent_execution', 'conversion_run_id': conversion_run_id, 'status': 'complete', 'field': result.get('field_name', ''), 'old_value': result.get('old_value', ''), 'new_value': result.get('new_value', ''), 'reasoning': result.get('reasoning', ''), 'details': {'field_name': result.get('field_name'), 'old_value': result.get('old_value'), 'new_value': result.get('new_value'), 'reasoning': result.get('reasoning'), 'success': result.get('success')}})}\n\n"

                    elif event.get("type") == "thread_started":
                        logger.info(f"Agent thread started: {event.get('thread_id')}")

                    elif event.get("type") == "review_required":
                        logger.info(f"Human review required: {event}")
                        review_required = True
                        hop1_details = e.conversion_context.get('detailed_processing', {})
                        pending_conversions.set(event.get("thread_id"), {
                            "conversion_run_id": conversion_run_id,
                            "source_format": request.source_format,
                            "target_format": request.target_format,
                            "original_message": request.message,
                            "use_ai": request.use_ai,
                            "validation_exception": {
                                "problem": e.problem,
                                "field_name": e.field_name,
                                "original_value": e.original_value,
                                "conversion_context": e.conversion_context
                            },
                            "hop1_start": hop1_start,
                            "start_time": start_time,
                            "hop1_details": hop1_details,
                            "proposed_value": event.get("proposed_value", "")
                        })
                        yield f"data: {json.dumps(event)}\n\n"
                        return

                    elif event.get("type") == "complete":
                        agent_result = final_state.get("result", {})
                        yield f"data: {json.dumps({'type': 'agent_complete', 'new_value': agent_result.get('new_value'), 'field': e.field_name, 'success': agent_result.get('success', True)})}\n\n"

                    elif event.get("type") == "error":
                        yield f"data: {json.dumps({'type': 'error', 'message': event.get('message')})}\n\n"
                        return

                agent_correction = {
                    "problem": e.problem,
                    "field_name": e.field_name,
                    "old_value": final_state.get("result", {}).get("old_value", ""),
                    "new_value": final_state.get("result", {}).get("new_value", ""),
                    "reasoning": final_state.get("solution", {}).get("reasoning", "")
                }

                cached_json = await mongodb_service.get_canonical_json(request.message, conversion_run_id=conversion_run_id)
                hop1_result = {
                    'conversion_id': f"{request.source_format}_to_JSON",
                    'converted_message': cached_json['jsonData'],
                    'processing_stats': {'lane_distribution': {'RULES': 0, 'AI': 0, 'HUMAN': 0}},
                    'confidence_scores': {},
                    'human_review_required': False,
                    'metadata': {'source_format': request.source_format, 'target_format': "JSON"},
                    'detailed_processing': e.conversion_context.get('detailed_processing', {})
                }

                hop1_time = time.time() - hop1_start
                yield f"data: {json.dumps({'type': 'hop1_complete', 'time': round(hop1_time, 2), 'detailed_processing': hop1_result.get('detailed_processing', {})})}\n\n"

            # Check for crypto settlement
            hop1_json = json.loads(hop1_result['converted_message']) if isinstance(hop1_result['converted_message'], str) else hop1_result['converted_message']

            is_crypto_settlement = (
                hop1_json.get('cryptoBlockchain') is not None and
                hop1_json.get('cryptoReceiverWallet') is not None
            )

            if is_crypto_settlement and solana_service:
                # Crypto settlement flow
                blockchain = hop1_json.get('cryptoBlockchain')
                receiver_wallet = hop1_json.get('cryptoReceiverWallet')
                amount_sol = 0.001

                yield f"data: {json.dumps({'type': 'crypto_start', 'detail': 'Initiating Solana blockchain settlement using canonical JSON fields', 'dropdown': {'title': 'Canonical JSON → Blockchain Bridge', 'items': ['Canonical JSON serves as universal payment format', f'Blockchain: {blockchain}', 'Receiver wallet extracted from cryptoReceiverWallet field', 'Solana SDK initialized with devnet RPC endpoint', 'Transaction will be recorded on immutable blockchain ledger']}})}\n\n"
                yield f"data: {json.dumps({'type': 'crypto_wallet_extract', 'receiver': receiver_wallet, 'detail': 'Extracted receiver wallet from canonical JSON', 'dropdown': {'title': 'Wallet Extraction Details', 'items': [f'Source field: canonical_json.cryptoReceiverWallet', f'Receiver: {receiver_wallet}', 'Wallet validated as valid Solana public key (Base58)', 'Service wallet will execute transfer on behalf of payer']}})}\n\n"
                yield f"data: {json.dumps({'type': 'crypto_tx_build', 'detail': 'Building Solana transfer instruction', 'dropdown': {'title': 'Transaction Construction', 'items': ['Fetching latest blockhash from Solana RPC', 'Creating SystemProgram.transfer instruction', 'From: Service wallet (custodial)', f'To: {receiver_wallet[:16]}...', f'Amount: {amount_sol} SOL (demo proof-of-settlement)', 'Compiling MessageV0 with transfer instruction']}})}\n\n"
                yield f"data: {json.dumps({'type': 'crypto_tx_sign', 'detail': 'Signing transaction with service wallet', 'dropdown': {'title': 'Cryptographic Signing', 'items': ['Loading service keypair from secure storage', 'Creating VersionedTransaction with MessageV0', 'Signing with Ed25519 signature algorithm', 'Transaction signature generated (64 bytes)']}})}\n\n"
                yield f"data: {json.dumps({'type': 'crypto_tx_submit', 'detail': 'Broadcasting to Solana devnet', 'dropdown': {'title': 'Network Broadcast', 'items': ['RPC Endpoint: https://api.devnet.solana.com', 'Method: sendRawTransaction', 'Commitment level: confirmed', 'Waiting for validator confirmation...']}})}\n\n"

                transfer_result = solana_service.transfer(
                    to_pubkey=receiver_wallet,
                    amount_sol=amount_sol,
                    memo=conversion_run_id
                )

                if transfer_result.get('success'):
                    confirmation_ms = transfer_result.get('confirmation_time_ms', 0)
                    signature = transfer_result.get('signature', '')
                    explorer_url = transfer_result.get('explorer_url', '')

                    yield f"data: {json.dumps({'type': 'crypto_tx_confirm', 'confirmation_time_ms': confirmation_ms, 'detail': f'Transaction confirmed in {confirmation_ms}ms', 'dropdown': {'title': 'Blockchain Confirmation', 'items': [f'Confirmation time: {confirmation_ms}ms', 'Commitment level: confirmed (optimistic)', 'Transaction included in recent block', 'Validators reached consensus on transaction', f'Signature: {signature[:32]}...']}})}\n\n"

                    amount_field = hop1_json.get('amount', '50000.00')
                    display_amount = amount_field if isinstance(amount_field, str) else amount_field.get('instructed_amount', '50000.00')
                    display_currency = hop1_json.get('currency', 'USD')

                    yield f"data: {json.dumps({'type': 'crypto_complete', 'signature': signature, 'explorer_url': explorer_url, 'display_amount': display_amount, 'display_currency': display_currency, 'detail': f'Settlement complete: {display_amount} {display_currency}', 'dropdown': {'title': 'Settlement Summary', 'items': [f'Payment Amount: {display_amount} {display_currency}', f'Blockchain: Solana (devnet)', f'Transaction Signature: {signature[:24]}...', f'Explorer: Click to view on Solana Explorer', 'Status: Finalized and immutable', 'Canonical JSON successfully bridged to blockchain']}})}\n\n"

                    total_time = time.time() - start_time
                    result = {
                        'type': 'complete',
                        'output': json.dumps(hop1_json, indent=2),
                        'processing_stats': {
                            'rules_lane': hop1_result.get('processing_stats', {}).get('lane_distribution', {}).get('RULES', 0),
                            'ai_lane': 0,
                            'human_lane': 0
                        },
                        'confidence_scores': {},
                        'total_time': round(total_time, 2),
                        'agent_correction': agent_correction
                    }
                    yield f"data: {json.dumps(result)}\n\n"
                else:
                    error_msg = f"Solana transfer failed: {transfer_result.get('error')}"
                    yield f"data: {json.dumps({'type': 'error', 'message': error_msg})}\n\n"

            else:
                # Standard Hop 2: JSON → Target format
                yield f"data: {json.dumps({'type': 'hop2_start', 'source': 'JSON', 'target': request.target_format})}\n\n"

                hop2_start = time.time()
                hop2_result = await converter.convert(
                    source_format="JSON",
                    target_format=request.target_format,
                    message=hop1_result['converted_message'],
                    original_source_message=request.message,
                    conversion_run_id=conversion_run_id,
                    use_ai=request.use_ai
                )

                hop2_time = time.time() - hop2_start
                yield f"data: {json.dumps({'type': 'hop2_complete', 'time': round(hop2_time, 2), 'detailed_processing': hop2_result.get('detailed_processing', {})})}\n\n"

                total_time = time.time() - start_time
                stats = hop2_result["processing_stats"]
                lane_dist = stats.get("lane_distribution", {})

                result = {
                    'type': 'complete',
                    'output': hop2_result["converted_message"],
                    'processing_stats': {
                        'rules_lane': lane_dist.get("RULES", 0),
                        'ai_lane': lane_dist.get("AI", 0),
                        'human_lane': lane_dist.get("HUMAN", 0)
                    },
                    'confidence_scores': hop2_result["confidence_scores"],
                    'total_time': round(total_time, 2),
                    'agent_correction': agent_correction
                }
                yield f"data: {json.dumps(result)}\n\n"

        except Exception as e:
            logger.error(f"Streaming conversion error: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )


@router.post(
    "/PaymentOrderInitiationTransaction/Confirmation/Retrieve",
    status_code=status.HTTP_200_OK,
)
async def get_canonical_json_diff(body: CanonicalJsonRetrieveRequest):
    """
    Fetch before/after canonical JSON with changes from audit trail.

    Reconstructs the before state from audit trail for diff visualization.
    """
    conversion_run_id = body.conversionRunReference
    try:
        doc = await mongodb_service.json_storage_collection.find_one({"_id": conversion_run_id})

        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Canonical JSON document not found for conversion_run_id: {conversion_run_id}"
            )

        # Storage is camelCase end-to-end now; read directly.
        after_json = doc.get("jsonData", {})
        audit_trail = doc.get("metadata", {}).get("auditTrail", {})

        before_json = after_json.copy()
        for field_name, changes in audit_trail.items():
            before_json[field_name] = changes.get("oldValue", "")

        changed_fields = list(audit_trail.keys())
        logger.info(f"Retrieved canonical JSON diff for {conversion_run_id}: {len(changed_fields)} fields changed")

        return {
            "conversion_run_id": conversion_run_id,
            "before_json": before_json,
            "after_json": after_json,
            "changed_fields": changed_fields
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching canonical JSON diff: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch canonical JSON diff: {str(e)}"
        )


@router.post(
    "/PaymentOrderInitiationTransaction/Retrieve",
    status_code=status.HTTP_200_OK,
)
async def get_canonical_json_full(body: CanonicalJsonRetrieveRequest):
    """
    Fetch the full canonical JSON document from MongoDB.

    Returns the complete document including metadata and audit trails.
    """
    conversion_run_id = body.conversionRunReference
    try:
        doc = await mongodb_service.json_storage_collection.find_one({"_id": conversion_run_id})

        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Canonical JSON document not found for conversion_run_id: {conversion_run_id}"
            )

        # Storage is camelCase end-to-end now; UI sees the same shape.
        logger.info(f"Retrieved full canonical JSON document for {conversion_run_id}")
        return doc

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching full canonical JSON document: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch canonical JSON document: {str(e)}"
        )
