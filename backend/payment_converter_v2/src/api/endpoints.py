"""API Endpoints - Phase 4"""

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import logging
import uuid
import json
import time

from config import get_settings
from src.services import (
    MongoDBService,
    get_bedrock_service,
    get_ai_lane_service,
    Converter
)
from src.services.payment_agent_client import PaymentAgentClient
from src.services.semantic_learning_service import SemanticLearningService
from src.services.llm_field_mapper import LLMFieldMapper
from src.services.solana_service import init_solana_service
from src.exceptions import CountryValidationException

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize settings
settings = get_settings()

# Initialize services (singleton pattern)
mongodb_service = MongoDBService(settings.mongodb_uri, settings.database_name)
bedrock_service = get_bedrock_service(settings.aws_default_region)
ai_lane_service = get_ai_lane_service(
    model_haiku=settings.ai_model_haiku,
    model_sonnet=settings.ai_model_sonnet
)
converter = Converter(
    mongodb_service=mongodb_service,
    ai_lane_service=ai_lane_service,
    ai_confidence_threshold=settings.ai_confidence_threshold
)

# Initialize payment agent client
agent_client = PaymentAgentClient(
    agent_url=settings.payment_agent_url,
    timeout=settings.payment_agent_timeout
)

# Initialize LLM field mapper (for unknown field suggestions in auto-config)
llm_field_mapper = LLMFieldMapper(mongodb_service, bedrock_service)

# Initialize semantic learning service (for auto-config generation)
semantic_learning_service = SemanticLearningService(mongodb_service, llm_field_mapper)

# Initialize Solana service (for crypto/blockchain payments)
solana_service = None
if settings.solana_private_key:
    try:
        solana_service = init_solana_service(
            rpc_endpoint=settings.solana_rpc_endpoint,
            private_key=settings.solana_private_key,
            network=settings.solana_network
        )
        logger.info(f"Solana service initialized on {settings.solana_network}")
    except Exception as e:
        logger.warning(f"Failed to initialize Solana service: {e}")

# Pending conversions store - tracks conversion state during human-in-the-loop review
# Key: thread_id, Value: dict with conversion_run_id, source/target formats, validation context
pending_conversions: Dict[str, Dict[str, Any]] = {}

# Pending AI reviews store - tracks state when AI-processed fields need human review
# Key: conversion_run_id, Value: dict with hop1_result, request details for resuming hop2
pending_ai_reviews: Dict[str, Dict[str, Any]] = {}


# ============================================================================
# Request/Response Models
# ============================================================================

class MultiHopConversionRequest(BaseModel):
    """Request model for multi-hop conversion endpoint"""
    source_format: str = Field(..., description="Source format (e.g., MT103)")
    target_format: str = Field(..., description="Target format (e.g., pacs.008)")
    message: str = Field(..., description="Source message to convert")
    use_json_bridge: bool = Field(
        default=True,
        description="Use canonical JSON as intermediate format"
    )
    use_ai: bool = Field(
        default=True,
        description="Use AI lane for unstructured fields (false = rules/regex only)"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "source_format": "MT103",
                    "target_format": "pacs.008",
                    "message": "{1:F01BANK...}{4:\n:20:REF123\n:23B:CRED\n...}",
                    "use_json_bridge": True,
                    "use_ai": True
                }
            ]
        }
    }


class FormatInfo(BaseModel):
    """Format information"""
    conversion_id: str = Field(..., description="Conversion ID")
    source_format: str = Field(..., description="Source format name")
    target_format: str = Field(..., description="Target format name")
    description: Optional[str] = Field(None, description="Conversion description")


class HealthResponse(BaseModel):
    """Health check response"""
    status: str = Field(..., description="Service status")
    mongodb: str = Field(..., description="MongoDB connection status")
    bedrock: str = Field(..., description="AWS Bedrock status")
    version: str = Field(..., description="Service version")


class AutoConfigureRequest(BaseModel):
    """Request model for auto-configure endpoint"""
    source_format: str = Field(..., description="Source format (e.g., MT202)")
    target_format: str = Field(..., description="Target format (e.g., JSON)")
    sample_message: str = Field(..., description="Sample message to learn from")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "source_format": "MT202",
                    "target_format": "JSON",
                    "sample_message": "{1:F01CHASUS33AXXX...}{4:\n:20:MT202TEST\n:21:REF2024\n:32A:241215EUR500000,00\n...}"
                }
            ]
        }
    }


class AutoConfigureResponse(BaseModel):
    """Response model for auto-configure endpoint"""
    configuration_id: str = Field(..., description="Generated configuration ID")
    config: Dict[str, Any] = Field(..., description="Generated configuration")
    confidence: float = Field(..., description="Overall confidence score (0-1)")
    fields_detected: int = Field(..., description="Number of fields detected in sample")
    matched_fields: List[str] = Field(..., description="Fields matched from existing configs")
    unknown_fields: List[str] = Field(..., description="Fields not found in any existing config")
    learned_from: List[str] = Field(..., description="Config IDs used for learning")
    suggestions: List[Dict[str, Any]] = Field(default=[], description="LLM-suggested mappings for unknown fields (display-only)")
    llm_prompt_info: Optional[Dict[str, Any]] = Field(default=None, description="LLM prompt construction details for frontend display")


class ApproveConfigResponse(BaseModel):
    """Response model for approve config endpoint"""
    status: str = Field(..., description="Approval status")
    configuration_id: str = Field(..., description="Configuration ID")


# ============================================================================
# API Endpoints
# ============================================================================

@router.post("/convert/multi-hop/stream", status_code=status.HTTP_200_OK)
async def convert_multi_hop_stream(request: MultiHopConversionRequest):
    """
    Stream multi-hop conversion with real-time SSE updates.

    This endpoint provides Server-Sent Events (SSE) showing progress through:
    - Hop 1: Source → JSON conversion
    - Country validation checks
    - Agent corrections (if needed)
    - Hop 2: JSON → Target conversion

    Events emitted:
    - hop1_start: Starting first hop
    - hop1_complete: First hop finished
    - validation_failed: Country rule violated
    - agent_* events: Real-time agent progress
    - hop2_start: Starting second hop
    - hop2_complete: Second hop finished
    - complete: Final result with output
    """

    async def event_generator():
        """Generate SSE events for multi-hop conversion."""
        conversion_run_id = str(uuid.uuid4())
        start_time = time.time()
        agent_correction = None

        try:
            logger.info(f"Starting streaming multi-hop: {request.source_format} → {request.target_format}")

            # Emit start event
            yield f"data: {json.dumps({'type': 'start', 'conversion_run_id': conversion_run_id})}\n\n"

            # Hop 1: Source → JSON (skip country validation - do it after AI review)
            yield f"data: {json.dumps({'type': 'hop1_start', 'source': request.source_format, 'target': 'JSON'})}\n\n"

            hop1_start = time.time()

            # Convert with country validation disabled - we'll do it after AI review
            hop1_result = await converter.convert(
                source_format=request.source_format,
                target_format="JSON",
                message=request.message,
                conversion_run_id=conversion_run_id,
                use_ai=request.use_ai,
                validate_country=False  # Defer to after AI review
            )

            hop1_time = time.time() - hop1_start
            yield f"data: {json.dumps({'type': 'hop1_complete', 'time': round(hop1_time, 2), 'detailed_processing': hop1_result.get('detailed_processing', {})})}\n\n"

            # Check if AI fields were processed and need human review
            # This is independent of confidence - any AI usage triggers review
            fields_for_review = hop1_result.get('fields_for_review', [])
            ai_lane_data = hop1_result.get('detailed_processing', {}).get('ai_lane', {})
            ai_fields = ai_lane_data.get('fields', [])

            logger.info(f"AI Review Check: use_ai={request.use_ai}, fields_for_review={fields_for_review}, ai_lane_total={ai_lane_data.get('total_fields', 0)}, ai_fields_count={len(ai_fields)}")

            if fields_for_review and request.use_ai and ai_fields:
                logger.info(f"AI review required for {len(ai_fields)} fields")

                # Store state for resume (including detailed_processing for country validation later)
                pending_ai_reviews[conversion_run_id] = {
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
                }

                # Emit review required event with AI field details
                yield f"data: {json.dumps({'type': 'ai_review_required', 'conversion_run_id': conversion_run_id, 'fields': ai_fields, 'message': 'AI-processed fields require human verification before proceeding'})}\n\n"

                # Stop streaming - frontend will call /ai-review/resume-stream
                return

            # No AI review needed - proceed with country validation
            try:
                # Now run country validation (was deferred from converter)
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
                # Country validation failed - emit event with full context for frontend
                yield f"data: {json.dumps({'type': 'validation_failed', 'country': e.conversion_context.get('additional_context', {}).get('country'), 'field': e.field_name, 'problem': e.problem, 'original_value': e.original_value})}\n\n"

                # Stream agent events with human-in-the-loop support
                yield f"data: {json.dumps({'type': 'agent_start', 'problem': e.problem[:100] + '...' if len(e.problem) > 100 else e.problem, 'field': e.field_name})}\n\n"

                # Capture problem for use in nested events
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
                    # Extract detailed information from agent events
                    if "supervisor" in event:
                        supervisor_state = event["supervisor"]
                        final_state.update(supervisor_state)

                        # Extract supervisor reasoning from messages
                        messages = supervisor_state.get("messages", [])
                        reasoning = ""
                        next_agent = supervisor_state.get("next_agent", "")

                        if messages:
                            last_message = messages[-1]
                            reasoning = last_message.get("content", "")

                        yield f"data: {json.dumps({'type': 'agent_supervisor', 'status': 'routing', 'reasoning': reasoning, 'next_agent': next_agent, 'problem': current_problem[:100] + '...' if len(current_problem) > 100 else current_problem, 'details': {'messages_count': len(messages)}})}\n\n"

                    elif "resolution" in event:
                        resolution_state = event["resolution"]
                        final_state.update(resolution_state)

                        # Extract tool calls and results from messages
                        messages = resolution_state.get("messages", [])
                        logger.info(f"Resolution messages count: {len(messages)}")
                        for idx, msg in enumerate(messages):
                            msg_type = msg.get("type", "")
                            logger.info(f"Message {idx}: type={msg_type}, content_len={len(str(msg.get('content', '')))}, has_tool_calls={'tool_calls' in msg}")

                            # Emit tool call events with agent's reasoning
                            if "tool_calls" in msg and msg.get("tool_calls"):
                                # Extract reasoning from AIMessage content (why the agent chose this tool)
                                agent_reasoning = msg.get("content", "")
                                logger.info(f"Tool call message content: {agent_reasoning[:300] if agent_reasoning else 'EMPTY'}")

                                # If content is empty, look backwards for reasoning in previous AI messages
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

                            # Emit tool result events
                            if msg_type == "tool":
                                tool_name = msg.get("name", "unknown")
                                tool_content = msg.get("content", "")
                                try:
                                    tool_result = json.loads(tool_content) if isinstance(tool_content, str) else tool_content
                                except:
                                    tool_result = str(tool_content)

                                yield f"data: {json.dumps({'type': 'tool_result', 'tool': tool_name, 'result': tool_result, 'details': tool_result})}\n\n"

                        # Emit resolution complete event with solution
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
                        # Capture thread_id for human review flow
                        logger.info(f"Agent thread started: {event.get('thread_id')}")

                    elif event.get("type") == "review_required":
                        # Human-in-the-loop: forward review request to frontend
                        logger.info(f"Human review required: {event}")
                        review_required = True

                        # Store conversion state for continuation after resume
                        # The frontend will call /agent/resume with the thread_id
                        # Extract hop1_details from exception context for frontend display
                        hop1_details = e.conversion_context.get('detailed_processing', {})
                        pending_conversions[event.get("thread_id")] = {
                            "conversion_run_id": conversion_run_id,
                            "source_format": request.source_format,
                            "target_format": request.target_format,
                            "original_message": request.message,
                            "use_ai": request.use_ai,  # Preserve AI toggle setting for hop 2
                            "validation_exception": {
                                "problem": e.problem,
                                "field_name": e.field_name,
                                "original_value": e.original_value,
                                "conversion_context": e.conversion_context
                            },
                            "hop1_start": hop1_start,
                            "start_time": start_time,
                            "hop1_details": hop1_details,  # Store for resume endpoint
                            "proposed_value": event.get("proposed_value", "")  # Store for execution event
                        }

                        # Forward the review_required event to frontend
                        yield f"data: {json.dumps(event)}\n\n"
                        # Stream ends here - frontend will call /agent/resume
                        return

                    elif event.get("type") == "complete":
                        agent_result = final_state.get("result", {})
                        yield f"data: {json.dumps({'type': 'agent_complete', 'new_value': agent_result.get('new_value'), 'field': e.field_name, 'success': agent_result.get('success', True)})}\n\n"

                    elif event.get("type") == "error":
                        yield f"data: {json.dumps({'type': 'error', 'message': event.get('message')})}\n\n"
                        return

                # Store correction metadata
                agent_correction = {
                    "problem": e.problem,
                    "field_name": e.field_name,
                    "old_value": final_state.get("result", {}).get("old_value", ""),
                    "new_value": final_state.get("result", {}).get("new_value", ""),
                    "reasoning": final_state.get("solution", {}).get("reasoning", "")
                }

                # Retrieve corrected JSON
                cached_json = await mongodb_service.get_canonical_json(request.message, conversion_run_id=conversion_run_id)
                hop1_result = {
                    'conversion_id': f"{request.source_format}_to_JSON",
                    'converted_message': cached_json['json_data'],
                    'processing_stats': {'lane_distribution': {'RULES': 0, 'AI': 0, 'HUMAN': 0}},
                    'confidence_scores': {},
                    'human_review_required': False,
                    'metadata': {'source_format': request.source_format, 'target_format': "JSON"},
                    'detailed_processing': e.conversion_context.get('detailed_processing', {})
                }

                # Emit hop1_complete now that agent has finished and we have the result
                hop1_time = time.time() - hop1_start
                yield f"data: {json.dumps({'type': 'hop1_complete', 'time': round(hop1_time, 2), 'detailed_processing': hop1_result.get('detailed_processing', {})})}\n\n"

            # Check if hop1 result contains crypto settlement fields
            hop1_json = json.loads(hop1_result['converted_message']) if isinstance(hop1_result['converted_message'], str) else hop1_result['converted_message']

            is_crypto_settlement = (
                hop1_json.get('crypto_blockchain') is not None and
                hop1_json.get('crypto_receiver_wallet') is not None
            )

            if is_crypto_settlement and solana_service:
                # ============================================================
                # Crypto Settlement Flow - Execute Solana transfer instead of hop2
                # ============================================================
                blockchain = hop1_json.get('crypto_blockchain')
                receiver_wallet = hop1_json.get('crypto_receiver_wallet')
                # Hardcoded demo amount - actual payment value shown in message, this is just for blockchain proof
                amount_sol = 0.001

                yield f"data: {json.dumps({'type': 'crypto_start', 'detail': 'Initiating Solana blockchain settlement using canonical JSON fields', 'dropdown': {'title': 'Canonical JSON → Blockchain Bridge', 'items': ['Canonical JSON serves as universal payment format', f'Blockchain: {blockchain}', 'Receiver wallet extracted from crypto_receiver_wallet field', 'Solana SDK initialized with devnet RPC endpoint', 'Transaction will be recorded on immutable blockchain ledger']}})}\n\n"

                yield f"data: {json.dumps({'type': 'crypto_wallet_extract', 'receiver': receiver_wallet, 'detail': 'Extracted receiver wallet from canonical JSON', 'dropdown': {'title': 'Wallet Extraction Details', 'items': [f'Source field: canonical_json.crypto_receiver_wallet', f'Receiver: {receiver_wallet}', 'Wallet validated as valid Solana public key (Base58)', 'Service wallet will execute transfer on behalf of payer']}})}\n\n"

                # Build transaction
                yield f"data: {json.dumps({'type': 'crypto_tx_build', 'detail': 'Building Solana transfer instruction', 'dropdown': {'title': 'Transaction Construction', 'items': ['Fetching latest blockhash from Solana RPC', 'Creating SystemProgram.transfer instruction', 'From: Service wallet (custodial)', f'To: {receiver_wallet[:16]}...', f'Amount: {amount_sol} SOL (demo proof-of-settlement)', 'Compiling MessageV0 with transfer instruction']}})}\n\n"

                # Sign transaction
                yield f"data: {json.dumps({'type': 'crypto_tx_sign', 'detail': 'Signing transaction with service wallet', 'dropdown': {'title': 'Cryptographic Signing', 'items': ['Loading service keypair from secure storage', 'Creating VersionedTransaction with MessageV0', 'Signing with Ed25519 signature algorithm', 'Transaction signature generated (64 bytes)']}})}\n\n"

                # Submit transaction
                yield f"data: {json.dumps({'type': 'crypto_tx_submit', 'detail': 'Broadcasting to Solana devnet', 'dropdown': {'title': 'Network Broadcast', 'items': ['RPC Endpoint: https://api.devnet.solana.com', 'Method: sendRawTransaction', 'Commitment level: confirmed', 'Waiting for validator confirmation...']}})}\n\n"

                # Execute actual transfer
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

                    # Extract display amount from original payment for UI
                    amount_field = hop1_json.get('amount', '50000.00')
                    display_amount = amount_field if isinstance(amount_field, str) else amount_field.get('instructed_amount', '50000.00')
                    display_currency = hop1_json.get('currency', 'USD')

                    yield f"data: {json.dumps({'type': 'crypto_complete', 'signature': signature, 'explorer_url': explorer_url, 'display_amount': display_amount, 'display_currency': display_currency, 'detail': f'Settlement complete: {display_amount} {display_currency}', 'dropdown': {'title': 'Settlement Summary', 'items': [f'Payment Amount: {display_amount} {display_currency}', f'Blockchain: Solana (devnet)', f'Transaction Signature: {signature[:24]}...', f'Explorer: Click to view on Solana Explorer', 'Status: Finalized and immutable', 'Canonical JSON successfully bridged to blockchain']}})}\n\n"

                    # Calculate total time
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
                # ============================================================
                # Standard Hop 2: JSON → Target format conversion
                # ============================================================
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

                # Calculate total time
                total_time = time.time() - start_time

                # Build final response
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
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.get("/canonical-json/{conversion_run_id}/diff", status_code=status.HTTP_200_OK)
async def get_canonical_json_diff(conversion_run_id: str):
    """
    Fetch before/after canonical JSON with changes from audit trail.
    
    This endpoint retrieves the canonical JSON document and reconstructs the
    before state from the audit trail, allowing visualization of changes made
    by the payment agent.
    
    Args:
        conversion_run_id: UUID of the conversion run
        
    Returns:
        Dictionary with before_json, after_json, and changed_fields
        
    Raises:
        HTTPException 404: If document not found or no audit trail exists
    """
    try:
        # Query canonical_json_storage by _id
        doc = await mongodb_service.json_storage_collection.find_one({"_id": conversion_run_id})
        
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Canonical JSON document not found for conversion_run_id: {conversion_run_id}"
            )
        
        # Get current state (after changes)
        after_json = doc.get("json_data", {})

        # Get audit trail (may be empty if no agent intervention)
        audit_trail = doc.get("metadata", {}).get("audit_trail", {})

        # Reconstruct before state by applying old values from audit trail
        # If no audit trail, before and after are the same
        before_json = after_json.copy()
        for field_name, changes in audit_trail.items():
            before_json[field_name] = changes.get("old_value", "")

        # List of changed fields
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


@router.get("/canonical-json/{conversion_run_id}", status_code=status.HTTP_200_OK)
async def get_canonical_json_full(conversion_run_id: str):
    """
    Fetch the full canonical JSON document from MongoDB.

    Returns the complete document including all metadata, audit trails,
    and processing information stored in canonical_json_storage.

    Args:
        conversion_run_id: UUID of the conversion run

    Returns:
        Full MongoDB document with all fields

    Raises:
        HTTPException 404: If document not found
    """
    try:
        doc = await mongodb_service.json_storage_collection.find_one({"_id": conversion_run_id})

        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Canonical JSON document not found for conversion_run_id: {conversion_run_id}"
            )

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


class HumanReviewDecision(BaseModel):
    """Human reviewer's decision on proposed change."""
    approved: bool = Field(..., description="Whether the change is approved")
    modified_value: Optional[str] = Field(default=None, description="Optional modified value")


class ResumeAgentRequest(BaseModel):
    """Request to resume agent workflow after human review."""
    thread_id: str = Field(..., description="Thread ID from the review_required event")
    decision: HumanReviewDecision = Field(..., description="Human reviewer's decision")


class AIReviewDecision(BaseModel):
    """Human's decision on AI-extracted fields."""
    approved: bool = Field(..., description="Whether all AI extractions are approved")
    corrections: Optional[Dict[str, Any]] = Field(default=None, description="Optional corrections to AI extractions")


class ResumeAIReviewRequest(BaseModel):
    """Request to resume conversion after AI field review."""
    conversion_run_id: str = Field(..., description="Conversion run ID from ai_review_required event")
    decision: AIReviewDecision = Field(..., description="Human reviewer's decision on AI fields")


@router.post("/agent/resume-stream", status_code=status.HTTP_200_OK)
async def resume_agent_workflow_stream(request: ResumeAgentRequest):
    """
    Resume the payment agent workflow with streaming execution events.

    This streaming version of /agent/resume provides real-time SSE events
    for the execution phase, allowing the frontend to display execution progress.

    Args:
        request: Contains thread_id and human's approval decision

    Returns:
        StreamingResponse with execution events and final conversion result
    """

    async def event_generator():
        """Generate SSE events from resumed workflow and hop 2."""
        try:
            logger.info(f"Streaming resume: thread_id={request.thread_id}, approved={request.decision.approved}")

            # Get stored conversion context for this thread
            pending = pending_conversions.get(request.thread_id, {})
            if not pending:
                error_event = json.dumps({
                    "type": "error",
                    "message": f"No pending conversion found for thread_id: {request.thread_id}"
                })
                yield f"data: {error_event}\n\n"
                return

            conversion_run_id = pending.get("conversion_run_id")
            target_format = pending.get("target_format")
            original_message = pending.get("original_message")
            use_ai = pending.get("use_ai", True)
            start_time = pending.get("start_time", time.time())
            hop1_details = pending.get("hop1_details", {})

            # If not approved, send rejection and return early
            if not request.decision.approved:
                logger.info("Human rejected - skipping execution and hop 2")
                reject_event = json.dumps({
                    "type": "review_rejected",
                    "message": "Human rejected proposed change"
                })
                yield f"data: {reject_event}\n\n"

                # Clean up
                if request.thread_id in pending_conversions:
                    del pending_conversions[request.thread_id]
                return

            # Send approval event
            approve_event = json.dumps({
                "type": "review_approved",
                "message": "Human approved proposed change"
            })
            yield f"data: {approve_event}\n\n"

            # Get field name and proposed value for execution event
            validation_exception = pending.get("validation_exception", {})
            field_name = validation_exception.get("field_name", "field")
            proposed_value = pending.get("proposed_value", "")

            # Send execution agent starting event
            exec_start_event = json.dumps({
                "type": "agent_execution_start",
                "message": f"Execution agent applying '{proposed_value}' to {field_name}",
                "field": field_name,
                "approved_value": proposed_value
            })
            yield f"data: {exec_start_event}\n\n"

            # Stream execution events from payment agent
            final_state = {}
            async for event in agent_client.resume_workflow_stream(
                thread_id=request.thread_id,
                approved=request.decision.approved,
                modified_value=request.decision.modified_value
            ):
                # Handle execution events
                if "execution" in event:
                    execution_state = event["execution"]
                    final_state.update(execution_state)

                    result = execution_state.get("result", {})
                    exec_event = json.dumps({
                        "type": "agent_execution",
                        "conversion_run_id": conversion_run_id,
                        "status": "complete",
                        "field": result.get("field_name", ""),
                        "old_value": result.get("old_value", ""),
                        "new_value": result.get("new_value", ""),
                        "reasoning": result.get("reasoning", ""),
                        "details": {
                            "field_name": result.get("field_name"),
                            "old_value": result.get("old_value"),
                            "new_value": result.get("new_value"),
                            "reasoning": result.get("reasoning"),
                            "success": result.get("success")
                        }
                    })
                    yield f"data: {exec_event}\n\n"

                elif "human_review" in event:
                    # Human review node completed (after approval)
                    final_state.update(event["human_review"])

                elif event.get("type") == "complete":
                    # Agent workflow complete - now do hop 2
                    logger.info("Agent execution complete, starting hop 2")

                elif event.get("type") == "error":
                    yield f"data: {json.dumps(event)}\n\n"
                    return

            # Continue with hop 2: JSON → target_format
            hop2_start = time.time()
            hop2_event = json.dumps({
                "type": "hop2_start",
                "source": "JSON",
                "target": target_format
            })
            yield f"data: {hop2_event}\n\n"

            # Retrieve corrected JSON from MongoDB
            cached_json = await mongodb_service.get_canonical_json(
                original_message,
                conversion_run_id=conversion_run_id
            )

            if not cached_json or not cached_json.get('json_data'):
                error_event = json.dumps({
                    "type": "error",
                    "message": "Failed to retrieve corrected JSON from MongoDB"
                })
                yield f"data: {error_event}\n\n"
                return

            # Run hop 2 conversion
            hop2_result = await converter.convert(
                source_format="JSON",
                target_format=target_format,
                message=cached_json['json_data'],
                original_source_message=original_message,
                conversion_run_id=conversion_run_id,
                use_ai=use_ai
            )

            hop2_time = time.time() - hop2_start
            hop2_complete_event = json.dumps({
                "type": "hop2_complete",
                "time": round(hop2_time, 2),
                "detailed_processing": hop2_result.get("detailed_processing", {})
            })
            yield f"data: {hop2_complete_event}\n\n"

            # Calculate total time
            total_time = time.time() - start_time

            # Send final complete event with full result
            stats = hop2_result["processing_stats"]
            lane_dist = stats.get("lane_distribution", {})

            complete_event = json.dumps({
                "type": "complete",
                "success": True,
                "conversion_run_id": conversion_run_id,
                "output": hop2_result["converted_message"],
                "processing_stats": {
                    "rules_lane": lane_dist.get("RULES", 0),
                    "ai_lane": lane_dist.get("AI", 0),
                    "human_lane": lane_dist.get("HUMAN", 0)
                },
                "total_time": round(total_time, 2),
                "hop1_details": hop1_details,
                "hop2_details": hop2_result.get("detailed_processing", {})
            })
            yield f"data: {complete_event}\n\n"

            # Clean up pending conversion
            if request.thread_id in pending_conversions:
                del pending_conversions[request.thread_id]

            logger.info(f"Streaming resume complete: total_time={total_time:.2f}s")

        except Exception as e:
            logger.error(f"Error in streaming resume: {e}", exc_info=True)
            error_event = json.dumps({
                "type": "error",
                "message": str(e)
            })
            yield f"data: {error_event}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.post("/ai-review/resume-stream", status_code=status.HTTP_200_OK)
async def resume_ai_review_stream(request: ResumeAIReviewRequest):
    """
    Resume conversion after human review of AI-extracted fields.

    This endpoint continues the multi-hop conversion after the human has
    reviewed and approved AI-processed fields (like remittance info, instructions).

    The stream will emit:
    - ai_review_approved/ai_review_rejected: Decision acknowledgment
    - hop2_start: Starting second conversion hop
    - hop2_complete: Second hop finished
    - complete: Final result with output

    Args:
        request: Contains conversion_run_id and human's approval decision

    Returns:
        StreamingResponse with hop2 events and final conversion result
    """

    async def event_generator():
        """Generate SSE events for resumed conversion (hop2)."""
        try:
            logger.info(f"AI review resume: run_id={request.conversion_run_id}, approved={request.decision.approved}")

            # Get stored conversion state
            pending = pending_ai_reviews.get(request.conversion_run_id)
            if not pending:
                error_event = json.dumps({
                    "type": "error",
                    "message": f"No pending AI review found for conversion_run_id: {request.conversion_run_id}"
                })
                yield f"data: {error_event}\n\n"
                return

            hop1_result = pending.get("hop1_result")
            req_data = pending.get("request")
            start_time = pending.get("start_time", time.time())
            conversion_run_id = request.conversion_run_id

            # If not approved, send rejection and stop
            if not request.decision.approved:
                logger.info("Human rejected AI extractions - conversion stopped")
                reject_event = json.dumps({
                    "type": "ai_review_rejected",
                    "message": "Human rejected AI extractions - conversion cancelled"
                })
                yield f"data: {reject_event}\n\n"

                # Clean up
                if conversion_run_id in pending_ai_reviews:
                    del pending_ai_reviews[conversion_run_id]
                return

            # Send approval event
            approve_event = json.dumps({
                "type": "ai_review_approved",
                "message": "Human approved AI extractions - proceeding with conversion"
            })
            yield f"data: {approve_event}\n\n"

            # If corrections were provided, update the canonical JSON
            if request.decision.corrections:
                logger.info(f"Applying corrections to canonical JSON: {request.decision.corrections}")
                # Parse the current JSON
                hop1_json = json.loads(hop1_result['converted_message']) if isinstance(
                    hop1_result['converted_message'], str
                ) else hop1_result['converted_message']

                # Apply corrections (flatten nested paths like "remittance.purpose" → hop1_json["remittance"]["purpose"])
                for field_path, new_value in request.decision.corrections.items():
                    keys = field_path.split('.')
                    target = hop1_json
                    for key in keys[:-1]:
                        target = target.setdefault(key, {})
                    target[keys[-1]] = new_value

                # Update hop1_result with corrected JSON
                hop1_result['converted_message'] = json.dumps(hop1_json)

                # Update MongoDB cache
                await mongodb_service.update_canonical_json(
                    original_message=req_data['message'],
                    json_data=hop1_result['converted_message'],
                    conversion_run_id=conversion_run_id,
                    field_name="ai_review_corrections",
                    new_value=str(request.decision.corrections),
                    reason="Human corrections during AI review"
                )

            # Now run country validation (deferred from hop1)
            try:
                from src.validators.country_rules import validate_country_rules
                validate_country_rules(
                    canonical_json=json.loads(hop1_result['converted_message']),
                    conversion_id=f"{req_data['source_format']}_to_JSON",
                    source_format=req_data['source_format'],
                    target_format="JSON",
                    conversion_run_id=conversion_run_id,
                    detailed_processing=hop1_result.get('detailed_processing', {})
                )
                logger.info("Country validation passed after AI review")
            except CountryValidationException as e:
                # Country validation failed - need agent correction
                logger.info(f"Country validation failed after AI review: {e.field_name}")
                yield f"data: {json.dumps({'type': 'validation_failed', 'country': e.conversion_context.get('additional_context', {}).get('country'), 'field': e.field_name, 'problem': e.problem, 'original_value': e.original_value})}\n\n"
                yield f"data: {json.dumps({'type': 'agent_start', 'problem': e.problem[:100] + '...' if len(e.problem) > 100 else e.problem, 'field': e.field_name})}\n\n"

                # Run agent flow
                final_state = {}
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
                        reasoning = messages[-1].get("content", "") if messages else ""
                        next_agent = supervisor_state.get("next_agent", "")
                        yield f"data: {json.dumps({'type': 'agent_supervisor', 'status': 'routing', 'reasoning': reasoning, 'next_agent': next_agent, 'problem': e.problem[:100], 'details': {'messages_count': len(messages)}})}\n\n"

                    elif "resolution" in event:
                        resolution_state = event["resolution"]
                        final_state.update(resolution_state)
                        messages = resolution_state.get("messages", [])
                        for msg in messages:
                            if "tool_calls" in msg and msg.get("tool_calls"):
                                for tool_call in msg["tool_calls"]:
                                    yield f"data: {json.dumps({'type': 'tool_call', 'tool': tool_call.get('name', 'unknown'), 'args': tool_call.get('args', {}), 'reasoning': msg.get('content', ''), 'details': tool_call.get('args', {})})}\n\n"
                            if msg.get("type") == "tool":
                                try:
                                    tool_result = json.loads(msg.get("content", "{}"))
                                except:
                                    tool_result = str(msg.get("content", ""))
                                yield f"data: {json.dumps({'type': 'tool_result', 'tool': msg.get('name', 'unknown'), 'result': tool_result, 'details': tool_result})}\n\n"
                        solution = resolution_state.get("solution", {})
                        if solution and solution.get("reasoning"):
                            yield f"data: {json.dumps({'type': 'agent_resolution', 'status': 'complete', 'proposed_value': solution.get('proposed_value', ''), 'confidence': solution.get('confidence', 0), 'reasoning': solution.get('reasoning', ''), 'details': solution})}\n\n"

                    elif "execution" in event:
                        execution_state = event["execution"]
                        final_state.update(execution_state)
                        result = execution_state.get("result", {})
                        yield f"data: {json.dumps({'type': 'agent_execution', 'conversion_run_id': conversion_run_id, 'status': 'complete', 'field': result.get('field_name', ''), 'old_value': result.get('old_value', ''), 'new_value': result.get('new_value', ''), 'reasoning': result.get('reasoning', ''), 'details': result})}\n\n"

                    elif event.get("type") == "review_required":
                        # Agent needs human review - store state and pause
                        logger.info(f"Agent review required during AI resume: {event}")
                        pending_conversions[event.get("thread_id")] = {
                            "conversion_run_id": conversion_run_id,
                            "source_format": req_data['source_format'],
                            "target_format": req_data['target_format'],
                            "original_message": req_data['message'],
                            "use_ai": req_data.get('use_ai', True),
                            "validation_exception": {
                                "problem": e.problem,
                                "field_name": e.field_name,
                                "original_value": e.original_value,
                                "conversion_context": e.conversion_context
                            },
                            "start_time": start_time,
                            "hop1_details": hop1_result.get('detailed_processing', {}),
                            "proposed_value": event.get("proposed_value", "")
                        }
                        yield f"data: {json.dumps(event)}\n\n"
                        # Clean up AI review pending state
                        if conversion_run_id in pending_ai_reviews:
                            del pending_ai_reviews[conversion_run_id]
                        return

                    elif event.get("type") == "complete":
                        agent_result = final_state.get("result", {})
                        yield f"data: {json.dumps({'type': 'agent_complete', 'new_value': agent_result.get('new_value'), 'field': e.field_name, 'success': agent_result.get('success', True)})}\n\n"

                    elif event.get("type") == "error":
                        yield f"data: {json.dumps({'type': 'error', 'message': event.get('message')})}\n\n"
                        return

                # Agent completed - retrieve corrected JSON
                cached_json = await mongodb_service.get_canonical_json(req_data['message'], conversion_run_id=conversion_run_id)
                hop1_result['converted_message'] = cached_json['json_data']

            # Continue with Hop 2: JSON → Target format
            yield f"data: {json.dumps({'type': 'hop2_start', 'source': 'JSON', 'target': req_data['target_format']})}\n\n"

            hop2_start = time.time()
            hop2_result = await converter.convert(
                source_format="JSON",
                target_format=req_data['target_format'],
                message=hop1_result['converted_message'],
                original_source_message=req_data['message'],
                conversion_run_id=conversion_run_id,
                use_ai=req_data.get('use_ai', True)
            )

            hop2_time = time.time() - hop2_start
            yield f"data: {json.dumps({'type': 'hop2_complete', 'time': round(hop2_time, 2), 'detailed_processing': hop2_result.get('detailed_processing', {})})}\n\n"

            # Calculate total time
            total_time = time.time() - start_time

            # Build final complete event
            stats = hop2_result["processing_stats"]
            lane_dist = stats.get("lane_distribution", {})

            complete_event = json.dumps({
                "type": "complete",
                "success": True,
                "conversion_run_id": conversion_run_id,
                "output": hop2_result["converted_message"],
                "processing_stats": {
                    "rules_lane": lane_dist.get("RULES", 0),
                    "ai_lane": lane_dist.get("AI", 0),
                    "human_lane": lane_dist.get("HUMAN", 0)
                },
                "confidence_scores": hop2_result.get("confidence_scores", {}),
                "total_time": round(total_time, 2),
                "hop1_details": hop1_result.get("detailed_processing", {}),
                "hop2_details": hop2_result.get("detailed_processing", {}),
                "human_reviewed": True
            })
            yield f"data: {complete_event}\n\n"

            # Clean up pending state
            if conversion_run_id in pending_ai_reviews:
                del pending_ai_reviews[conversion_run_id]

            logger.info(f"AI review resume complete: total_time={total_time:.2f}s")

        except Exception as e:
            logger.error(f"Error in AI review resume: {e}", exc_info=True)
            error_event = json.dumps({
                "type": "error",
                "message": str(e)
            })
            yield f"data: {error_event}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.get("/health", response_model=HealthResponse, status_code=status.HTTP_200_OK)
async def health_check() -> HealthResponse:
    """
    Health check endpoint.
    
    Checks connectivity to:
    - MongoDB database
    - AWS Bedrock service
    
    Returns status for each component.
    """
    try:
        # Check MongoDB
        mongodb_status = "connected" if await mongodb_service.health_check() else "disconnected"
        
        # Check Bedrock
        bedrock_status = "initialized" if bedrock_service.health_check() else "not initialized"
        
        overall_status = "healthy" if mongodb_status == "connected" else "degraded"
        
        return HealthResponse(
            status=overall_status,
            mongodb=mongodb_status,
            bedrock=bedrock_status,
            version="2.0.0"
        )
        
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Health check failed: {str(e)}"
        )


@router.get("/formats", response_model=List[FormatInfo], status_code=status.HTTP_200_OK)
async def list_formats() -> List[FormatInfo]:
    """
    List all available conversion formats.
    
    Returns a list of all configured conversions with their:
    - Conversion ID
    - Source format
    - Target format
    - Description (if available)
    """
    try:
        configs = await mongodb_service.list_configs()
        
        formats = []
        for config in configs:
            conversion_id = config.get("_id", "")
            
            # Parse conversion_id (e.g., "MT103_to_pacs.008")
            parts = conversion_id.split("_to_")
            source_format = parts[0] if len(parts) > 0 else "unknown"
            target_format = parts[1] if len(parts) > 1 else "unknown"
            
            formats.append(FormatInfo(
                conversion_id=conversion_id,
                source_format=source_format,
                target_format=target_format,
                description=config.get("description")
            ))
        
        return formats
        
    except Exception as e:
        logger.error(f"Failed to list formats: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list formats: {str(e)}"
        )


@router.get("/configs", status_code=status.HTTP_200_OK)
async def list_all_configs():
    """
    List all conversion configurations with full details.

    Returns the complete config documents from MongoDB for display
    in the Config Builder UI.
    """
    try:
        configs = await mongodb_service.list_configs()
        return {"configs": configs}
    except Exception as e:
        logger.error(f"Failed to list configs: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list configs: {str(e)}"
        )


@router.get("/format-specifications", status_code=status.HTTP_200_OK)
async def list_format_specifications():
    """
    List all target format specifications.

    Returns format specs from MongoDB for the Config Builder target format dropdown.
    Each spec includes _id (format name), description, format_type, and supported_fields.
    """
    try:
        specs = await mongodb_service.list_format_specifications()
        return {"specifications": specs}
    except Exception as e:
        logger.error(f"Failed to list format specifications: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list format specifications: {str(e)}"
        )


# ============================================================================
# Auto-Configure Endpoints (Semantic Learning)
# ============================================================================

@router.post("/auto-configure", response_model=AutoConfigureResponse, status_code=status.HTTP_200_OK)
async def auto_configure(request: AutoConfigureRequest) -> AutoConfigureResponse:
    """
    Auto-generate a conversion configuration by learning from existing configs.

    This endpoint uses semantic learning to:
    1. Load ALL existing configs from MongoDB
    2. Build a combined field-to-mapping lookup
    3. Extract fields from the sample message
    4. Match fields against the combined lookup
    5. Generate a new config in simplified schema

    The generated config is stored temporarily (5 min TTL) for review.
    Use /auto-configure/{config_id}/approve to save permanently.
    """
    try:
        logger.info(f"Auto-configure: {request.source_format} → {request.target_format}")

        # Generate config using semantic learning
        result = await semantic_learning_service.generate_config(
            source_format=request.source_format,
            target_format=request.target_format,
            sample_message=request.sample_message
        )

        # Store temporarily (5 min TTL) for review
        config_id = result["configuration_id"]
        await mongodb_service.save_temp_config(
            config_id=config_id,
            config=result["config"],
            ttl_seconds=300
        )

        logger.info(
            f"Generated config {config_id}: "
            f"{result['fields_detected']} fields, "
            f"{len(result['matched_fields'])} matched, "
            f"confidence={result['confidence']}"
        )

        return AutoConfigureResponse(
            configuration_id=result["configuration_id"],
            config=result["config"],
            confidence=result["confidence"],
            fields_detected=result["fields_detected"],
            matched_fields=result["matched_fields"],
            unknown_fields=result["unknown_fields"],
            learned_from=result["learned_from"],
            suggestions=result.get("suggestions", []),
            llm_prompt_info=result.get("llm_prompt_info")
        )

    except ValueError as e:
        logger.error(f"Auto-configure validation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Auto-configure failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Auto-configure failed: {str(e)}"
        )


@router.post("/auto-configure/{config_id}/approve", response_model=ApproveConfigResponse, status_code=status.HTTP_200_OK)
async def approve_config(config_id: str) -> ApproveConfigResponse:
    """
    Approve and save an auto-generated configuration with 10-minute TTL.

    Moves the config from temporary storage to the conversion_configs collection.
    Config-builder configs auto-delete after 10 minutes via MongoDB TTL index.
    A unique session suffix is added to prevent ID conflicts between users.
    Existing configs (populated via scripts) remain permanent as they lack expires_at field.
    """
    try:
        logger.info(f"Approving config: {config_id}")

        # Get temp config
        temp_config = await mongodb_service.get_temp_config(config_id)
        if not temp_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Config not found or expired: {config_id}"
            )

        # Clean up temp markers before saving (e.g., _unknown)
        if "map" in temp_config:
            for mapping in temp_config["map"]:
                mapping.pop("_unknown", None)

        # Generate unique ID for config-builder saves (session-unique)
        # Format: MT202_to_JSON_a1b2c3d4 (8-char suffix)
        unique_suffix = uuid.uuid4().hex[:8]
        unique_config_id = f"{config_id}_{unique_suffix}"
        temp_config["_id"] = unique_config_id

        # Add 10-minute TTL for config-builder configs only
        # Existing configs (without expires_at) remain permanent
        temp_config["expires_at"] = datetime.utcnow() + timedelta(minutes=10)

        # Ensure TTL index exists (idempotent)
        await mongodb_service.ensure_configs_ttl_index()

        # Insert into permanent storage
        await mongodb_service.insert_config(temp_config)

        # Delete from temp storage
        await mongodb_service.delete_temp_config(config_id)

        logger.info(f"Config {unique_config_id} approved and saved (expires in 10 min)")

        return ApproveConfigResponse(
            status="approved",
            configuration_id=unique_config_id
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to approve config: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to approve config: {str(e)}"
        )





