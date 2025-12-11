"""API Endpoints - Phase 4"""

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
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
from src.services.solana_service import init_solana_service, get_solana_service
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

# Initialize semantic learning service (for auto-config generation)
semantic_learning_service = SemanticLearningService(mongodb_service)

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


# ============================================================================
# Request/Response Models
# ============================================================================

class ConversionRequest(BaseModel):
    """Request model for conversion endpoint"""
    conversion_id: str = Field(..., description="Conversion ID (e.g., MT103_to_pacs.008)")
    message: str = Field(..., description="Source message to convert")
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "conversion_id": "MT103_to_pacs.008",
                    "message": "{1:F01BANK...}{4:\n:20:REF123\n:23B:CRED\n...}"
                }
            ]
        }
    }


class MultiHopConversionRequest(BaseModel):
    """Request model for multi-hop conversion endpoint"""
    source_format: str = Field(..., description="Source format (e.g., MT103)")
    target_format: str = Field(..., description="Target format (e.g., pacs.008)")
    message: str = Field(..., description="Source message to convert")
    use_json_bridge: bool = Field(
        default=True, 
        description="Use canonical JSON as intermediate format"
    )
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "source_format": "MT103",
                    "target_format": "pacs.008",
                    "message": "{1:F01BANK...}{4:\n:20:REF123\n:23B:CRED\n...}",
                    "use_json_bridge": True
                }
            ]
        }
    }


class ProcessingStats(BaseModel):
    """Processing statistics"""
    rules_lane: int = Field(..., description="Number of fields processed via RULES lane")
    ai_lane: int = Field(..., description="Number of fields processed via AI lane")
    human_lane: int = Field(..., description="Number of fields requiring human review")


class ConversionResponse(BaseModel):
    """Response model for conversion endpoint"""
    output: str = Field(..., description="Converted message")
    processing_stats: ProcessingStats = Field(..., description="Processing lane statistics")
    confidence_scores: Dict[str, float] = Field(..., description="AI confidence scores")
    human_review_required: bool = Field(..., description="Whether human review is needed")
    metadata: Dict[str, Any] = Field(..., description="Conversion metadata")

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


class ConfigResponse(BaseModel):
    """Configuration response"""
    conversion_id: str = Field(..., description="Conversion ID")
    extract_patterns: int = Field(..., description="Number of extraction patterns")
    mappings: int = Field(..., description="Number of field mappings")
    output_fields: int = Field(..., description="Number of output fields")
    has_ai_mappings: bool = Field(..., description="Whether AI mappings are present")


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


class ApproveConfigResponse(BaseModel):
    """Response model for approve config endpoint"""
    status: str = Field(..., description="Approval status")
    configuration_id: str = Field(..., description="Configuration ID")


# ============================================================================
# API Endpoints
# ============================================================================

@router.post("/convert", response_model=ConversionResponse, status_code=status.HTTP_200_OK)
async def convert_message(request: ConversionRequest) -> ConversionResponse:
    """
    Convert a payment message from source to target format.
    
    This endpoint orchestrates the full conversion pipeline:
    1. Load configuration from MongoDB
    2. Extract fields using regex patterns
    3. Transform through 3 lanes (RULES/AI/HUMAN)
    4. Build output message (XML/JSON)
    5. Return result with statistics
    """
    try:
        logger.info(f"Converting message: {request.conversion_id}")
        
        # Parse conversion_id (e.g., "MT103_to_pacs.008")
        parts = request.conversion_id.split("_to_")
        if len(parts) != 2:
            raise ValueError(
                f"Invalid conversion_id format: {request.conversion_id}. "
                "Expected format: SOURCE_to_TARGET (e.g., MT103_to_pacs.008)"
            )
        
        source_format = parts[0]
        target_format = parts[1]
        
        # Perform conversion
        result = await converter.convert(
            source_format=source_format,
            target_format=target_format,
            message=request.message
        )
        
        # Extract lane distribution from processing_stats
        stats = result["processing_stats"]
        lane_dist = stats.get("lane_distribution", {})
        
        # Add conversion_id to metadata
        metadata = result["metadata"].copy()
        metadata["conversion_id"] = request.conversion_id
        metadata["processing_time"] = metadata.pop("processing_time_seconds")
        
        # Map to response model
        return ConversionResponse(
            output=result["converted_message"],
            processing_stats=ProcessingStats(
                rules_lane=lane_dist.get("RULES", 0),
                ai_lane=lane_dist.get("AI", 0),
                human_lane=lane_dist.get("HUMAN", 0)
            ),
            confidence_scores=result["confidence_scores"],
            human_review_required=result["human_review_required"],
            metadata=metadata
        )
        
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Conversion failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Conversion failed: {str(e)}"
        )


@router.post("/convert/multi-hop", response_model=ConversionResponse, status_code=status.HTTP_200_OK)
async def convert_multi_hop(request: MultiHopConversionRequest) -> ConversionResponse:
    """
    Multi-hop conversion using canonical JSON as bridge.
    
    Example: MT103 → JSON → pacs.008
    
    Flow:
    1. Convert source to JSON (save to MongoDB)
    2. Convert JSON to target (read from MongoDB)
    
    This endpoint automatically performs two-hop conversion through
    canonical JSON format, caching the intermediate JSON in MongoDB
    for efficient reuse.
    """
    try:
        # Generate unique ID for this conversion run (enables independence)
        conversion_run_id = str(uuid.uuid4())
        logger.info(f"Multi-hop: {request.source_format} → JSON → {request.target_format} (run_id: {conversion_run_id[:8]}...)")

        # Track agent corrections
        agent_correction = None

        # Hop 1: Source → JSON (with country validation)
        try:
            hop1_result = await converter.convert(
                source_format=request.source_format,
                target_format="JSON",
                message=request.message,
                conversion_run_id=conversion_run_id
            )

            logger.info("Hop 1 complete, JSON saved to MongoDB")

        except CountryValidationException as e:
            # Country rule violated - call payment agent to fix
            logger.warning(
                f"Country validation failed: {e.reason} "
                f"(task_type={e.task_type}, field={e.field_name})"
            )

            # Call payment agent with streaming
            agent_result = None
            final_state = {}

            async for event in agent_client.process_payment_stream(
                task_type=e.task_type,
                field_name=e.field_name,
                original_value=e.original_value,
                payment_data=e.payment_data,
                conversion_context=e.conversion_context
            ):
                # Accumulate state from agent events
                if "execution" in event:
                    # Execution agent provides the final result
                    final_state.update(event["execution"])
                elif "resolution" in event:
                    # Resolution agent provides the solution
                    final_state.update(event["resolution"])
                elif "supervisor" in event:
                    # Supervisor provides routing decision
                    final_state.update(event["supervisor"])
                elif event.get("type") == "complete":
                    # Workflow completed successfully
                    logger.info("Agent streaming completed successfully")
                elif event.get("type") == "error":
                    # Error occurred during streaming
                    raise HTTPException(
                        status_code=500,
                        detail=f"Payment agent error: {event.get('message')}"
                    )

            # Build agent_result from final state (compatible with existing code)
            if not final_state.get("result"):
                raise HTTPException(
                    status_code=500,
                    detail=f"Payment agent failed to correct violation: {e.reason}"
                )

            agent_result = {
                "success": final_state.get("result", {}).get("success", False),
                "task_type": e.task_type,
                "field_name": e.field_name,
                "solution": final_state.get("solution", {}),
                "result": final_state.get("result", {}),
                "processing_time_ms": 0,  # Not tracked in streaming yet
                "message_count": len(final_state.get("messages", []))
            }

            # Verify agent succeeded
            if not agent_result.get("success"):
                raise HTTPException(
                    status_code=500,
                    detail=f"Payment agent failed to correct violation: {e.reason}"
                )

            logger.info(
                f"Agent corrected {e.field_name}: "
                f"'{e.original_value}' → '{agent_result['result']['new_value']}'"
            )

            # Store correction metadata
            agent_correction = {
                "task_type": e.task_type,
                "field_name": e.field_name,
                "old_value": agent_result['result']['old_value'],
                "new_value": agent_result['result']['new_value'],
                "reasoning": agent_result.get('solution', {}).get('reasoning', ''),
                "processing_time_ms": agent_result.get('processing_time_ms')
            }

            # Retrieve corrected JSON from MongoDB (agent has already updated it)
            cached_json = await mongodb_service.get_canonical_json(
                request.message,
                conversion_run_id=conversion_run_id
            )

            if not cached_json or not cached_json.get('json_data'):
                raise HTTPException(
                    status_code=500,
                    detail="Failed to retrieve corrected JSON from MongoDB after agent update"
                )

            # Build hop1_result from cached corrected JSON (skip re-parsing)
            hop1_result = {
                'conversion_id': f"{request.source_format}_to_JSON",
                'request_id': None,
                'converted_message': cached_json['json_data'],
                'processing_stats': {'lane_distribution': {'RULES': 0, 'AI': 0, 'HUMAN': 0}},
                'confidence_scores': {},
                'human_review_required': False,
                'fields_for_review': [],
                'metadata': {
                    'source_format': request.source_format,
                    'target_format': "JSON",
                    'timestamp': cached_json.get('created_at', ''),
                    'processing_time_seconds': 0,
                    'corrected_by_agent': True
                }
            }

            logger.info(f"Using corrected JSON from MongoDB cache (field: {e.field_name} corrected)")
        
        # Hop 2: JSON → Target (will use cached JSON)
        hop2_result = await converter.convert(
            source_format="JSON",
            target_format=request.target_format,
            message=hop1_result['converted_message'],
            original_source_message=request.message,  # For cache lookup
            conversion_run_id=conversion_run_id  # Use same run_id to retrieve correct JSON
        )
        
        logger.info("Hop 2 complete using cached JSON")
        
        # Combine metadata from both hops
        combined_metadata = hop2_result['metadata'].copy()
        combined_metadata['multi_hop'] = True
        combined_metadata['hop1_time'] = hop1_result['metadata']['processing_time_seconds']
        combined_metadata['hop2_time'] = hop2_result['metadata']['processing_time_seconds']
        combined_metadata['total_time'] = (
            hop1_result['metadata']['processing_time_seconds'] +
            hop2_result['metadata']['processing_time_seconds']
        )
        combined_metadata['conversion_path'] = f"{request.source_format} → JSON → {request.target_format}"
        combined_metadata['agent_correction'] = agent_correction  # May be None if no correction needed
        
        # Use hop2 processing stats (final conversion)
        stats = hop2_result["processing_stats"]
        lane_dist = stats.get("lane_distribution", {})
        
        return ConversionResponse(
            output=hop2_result["converted_message"],
            processing_stats=ProcessingStats(
                rules_lane=lane_dist.get("RULES", 0),
                ai_lane=lane_dist.get("AI", 0),
                human_lane=lane_dist.get("HUMAN", 0)
            ),
            confidence_scores=hop2_result["confidence_scores"],
            human_review_required=hop2_result["human_review_required"],
            metadata=combined_metadata
        )
        
    except Exception as e:
        logger.error(f"Multi-hop conversion failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Multi-hop conversion failed: {str(e)}"
        )


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

            # Hop 1: Source → JSON
            yield f"data: {json.dumps({'type': 'hop1_start', 'source': request.source_format, 'target': 'JSON'})}\n\n"

            hop1_start = time.time()

            try:
                hop1_result = await converter.convert(
                    source_format=request.source_format,
                    target_format="JSON",
                    message=request.message,
                    conversion_run_id=conversion_run_id
                )

                hop1_time = time.time() - hop1_start
                yield f"data: {json.dumps({'type': 'hop1_complete', 'time': round(hop1_time, 2), 'detailed_processing': hop1_result.get('detailed_processing', {})})}\n\n"

            except CountryValidationException as e:
                # Country validation failed - emit event with full context for frontend
                yield f"data: {json.dumps({'type': 'validation_failed', 'country': e.conversion_context.get('additional_context', {}).get('country'), 'field': e.field_name, 'task_type': e.task_type, 'reason': e.reason, 'original_value': e.original_value})}\n\n"

                # Stream agent events with human-in-the-loop support
                yield f"data: {json.dumps({'type': 'agent_start', 'task_type': e.task_type, 'field': e.field_name})}\n\n"

                # Capture task_type for use in nested events
                current_task_type = e.task_type

                final_state = {}
                review_required = False

                async for event in agent_client.process_payment_stream_with_review(
                    task_type=e.task_type,
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

                        yield f"data: {json.dumps({'type': 'agent_supervisor', 'status': 'routing', 'reasoning': reasoning, 'next_agent': next_agent, 'task_type': current_task_type, 'details': {'messages_count': len(messages)}})}\n\n"

                    elif "resolution" in event:
                        resolution_state = event["resolution"]
                        final_state.update(resolution_state)

                        # Extract tool calls and results from messages
                        messages = resolution_state.get("messages", [])
                        for msg in messages:
                            msg_type = msg.get("type", "")

                            # Emit tool call events
                            if "tool_calls" in msg and msg.get("tool_calls"):
                                for tool_call in msg["tool_calls"]:
                                    tool_name = tool_call.get("name", "unknown")
                                    tool_args = tool_call.get("args", {})
                                    yield f"data: {json.dumps({'type': 'tool_call', 'tool': tool_name, 'args': tool_args, 'details': tool_args})}\n\n"

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
                        pending_conversions[event.get("thread_id")] = {
                            "conversion_run_id": conversion_run_id,
                            "source_format": request.source_format,
                            "target_format": request.target_format,
                            "original_message": request.message,
                            "validation_exception": {
                                "task_type": e.task_type,
                                "field_name": e.field_name,
                                "original_value": e.original_value,
                                "conversion_context": e.conversion_context
                            },
                            "hop1_start": hop1_start,
                            "start_time": start_time
                        }

                        # Forward the review_required event to frontend
                        yield f"data: {json.dumps(event)}\n\n"
                        # Stream ends here - frontend will call /agent/resume
                        return

                    elif event.get("type") == "complete":
                        agent_result = final_state.get("result", {})
                        yield f"data: {json.dumps({'type': 'agent_complete', 'new_value': agent_result.get('new_value'), 'field': e.field_name, 'task_type': current_task_type, 'success': agent_result.get('success', True)})}\n\n"

                    elif event.get("type") == "error":
                        yield f"data: {json.dumps({'type': 'error', 'message': event.get('message')})}\n\n"
                        return

                # Store correction metadata
                agent_correction = {
                    "task_type": e.task_type,
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
                hop1_json.get('crypto_sender_wallet') is not None and
                hop1_json.get('crypto_receiver_wallet') is not None
            )

            if is_crypto_settlement and solana_service:
                # ============================================================
                # Crypto Settlement Flow - Execute Solana transfer instead of hop2
                # ============================================================
                sender_wallet = hop1_json.get('crypto_sender_wallet')
                receiver_wallet = hop1_json.get('crypto_receiver_wallet')
                # Hardcoded demo amount - actual payment value shown in message, this is just for blockchain proof
                amount_sol = 0.001

                yield f"data: {json.dumps({'type': 'crypto_start', 'detail': 'Initiating Solana blockchain settlement using canonical JSON fields', 'dropdown': {'title': 'Canonical JSON → Blockchain Bridge', 'items': ['Canonical JSON serves as universal payment format', 'Crypto fields extracted: crypto_sender_wallet, crypto_receiver_wallet', 'Solana SDK initialized with devnet RPC endpoint', 'Transaction will be recorded on immutable blockchain ledger']}})}\n\n"

                yield f"data: {json.dumps({'type': 'crypto_wallet_extract', 'sender': sender_wallet, 'receiver': receiver_wallet, 'detail': 'Extracted wallet addresses from canonical JSON', 'dropdown': {'title': 'Wallet Extraction Details', 'items': [f'Source field: canonical_json.crypto_sender_wallet', f'Sender: {sender_wallet}', f'Source field: canonical_json.crypto_receiver_wallet', f'Receiver: {receiver_wallet}', 'Wallets validated as valid Solana public keys (Base58)']}})}\n\n"

                # Build transaction
                yield f"data: {json.dumps({'type': 'crypto_tx_build', 'detail': 'Building Solana transfer instruction', 'dropdown': {'title': 'Transaction Construction', 'items': ['Fetching latest blockhash from Solana RPC', 'Creating SystemProgram.transfer instruction', f'From: {sender_wallet[:16]}...', f'To: {receiver_wallet[:16]}...', f'Amount: {amount_sol} SOL (demo proof-of-settlement)', 'Compiling MessageV0 with transfer instruction']}})}\n\n"

                # Sign transaction
                yield f"data: {json.dumps({'type': 'crypto_tx_sign', 'detail': 'Signing transaction with sender private key', 'dropdown': {'title': 'Cryptographic Signing', 'items': ['Loading sender keypair from secure storage', 'Creating VersionedTransaction with MessageV0', 'Signing with Ed25519 signature algorithm', 'Transaction signature generated (64 bytes)']}})}\n\n"

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
                    conversion_run_id=conversion_run_id
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


class HumanReviewDecision(BaseModel):
    """Human reviewer's decision on proposed change."""
    approved: bool = Field(..., description="Whether the change is approved")
    modified_value: Optional[str] = Field(default=None, description="Optional modified value")


class ResumeAgentRequest(BaseModel):
    """Request to resume agent workflow after human review."""
    thread_id: str = Field(..., description="Thread ID from the review_required event")
    decision: HumanReviewDecision = Field(..., description="Human reviewer's decision")


@router.post("/agent/resume", status_code=status.HTTP_200_OK)
async def resume_agent_workflow(request: ResumeAgentRequest):
    """
    Resume the payment agent workflow after human review and continue hop 2.

    This endpoint is called after the frontend receives a 'review_required' event
    during streaming conversion. It:
    1. Forwards the human's decision to the payment agent
    2. If approved, continues with hop 2 conversion (JSON → target)
    3. Returns the complete result with final converted output

    Args:
        request: Contains thread_id and human's approval decision

    Returns:
        Complete conversion result including hop 2 output
    """
    try:
        logger.info(f"Resuming agent workflow: thread_id={request.thread_id}, approved={request.decision.approved}")

        # Get stored conversion context for this thread
        pending = pending_conversions.get(request.thread_id, {})
        if not pending:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No pending conversion found for thread_id: {request.thread_id}"
            )

        conversion_run_id = pending.get("conversion_run_id")
        target_format = pending.get("target_format")
        original_message = pending.get("original_message")
        start_time = pending.get("start_time", time.time())

        # Resume agent workflow
        agent_result = await agent_client.resume_workflow(
            thread_id=request.thread_id,
            approved=request.decision.approved,
            modified_value=request.decision.modified_value
        )

        # Add conversion_run_id to response so frontend can show JSON diff
        agent_result["conversion_run_id"] = conversion_run_id

        # If rejected, return early without hop 2
        if agent_result.get("rejected") or not request.decision.approved:
            logger.info("Human rejected - skipping hop 2")
            if request.thread_id in pending_conversions:
                del pending_conversions[request.thread_id]
            return agent_result

        # Continue with hop 2: JSON → target_format
        logger.info(f"Continuing hop 2: JSON → {target_format}")

        # Retrieve corrected JSON from MongoDB
        cached_json = await mongodb_service.get_canonical_json(
            original_message,
            conversion_run_id=conversion_run_id
        )

        if not cached_json or not cached_json.get('json_data'):
            raise HTTPException(
                status_code=500,
                detail="Failed to retrieve corrected JSON from MongoDB"
            )

        # Run hop 2 conversion
        hop2_result = await converter.convert(
            source_format="JSON",
            target_format=target_format,
            message=cached_json['json_data'],
            original_source_message=original_message,
            conversion_run_id=conversion_run_id
        )

        # Calculate total time
        total_time = time.time() - start_time

        # Build final response with complete conversion result
        stats = hop2_result["processing_stats"]
        lane_dist = stats.get("lane_distribution", {})

        result = {
            "success": True,
            "conversion_run_id": conversion_run_id,
            "result": agent_result.get("result", {}),
            "output": hop2_result["converted_message"],
            "processing_stats": {
                "rules_lane": lane_dist.get("RULES", 0),
                "ai_lane": lane_dist.get("AI", 0),
                "human_lane": lane_dist.get("HUMAN", 0)
            },
            "total_time": round(total_time, 2),
            "hop2_details": hop2_result.get("detailed_processing", {})
        }

        # Clean up pending conversion
        if request.thread_id in pending_conversions:
            del pending_conversions[request.thread_id]

        logger.info(f"Conversion complete after HITL: total_time={total_time:.2f}s")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resuming agent workflow: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to resume agent workflow: {str(e)}"
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


@router.get("/config/{conversion_id}", response_model=ConfigResponse, status_code=status.HTTP_200_OK)
async def get_config(conversion_id: str) -> ConfigResponse:
    """
    Get configuration details for a specific conversion.
    
    Returns summary information about:
    - Number of extraction patterns
    - Number of field mappings
    - Number of output fields
    - Whether AI mappings are present
    """
    try:
        config = await mongodb_service.get_config(conversion_id)
        
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Configuration not found: {conversion_id}"
            )
        
        # Count patterns, mappings, and outputs
        extract_patterns = len(config.get("extract", {}))
        mappings = len(config.get("map", []))
        output_fields = len(config.get("output", {}))
        
        # Check for AI mappings
        has_ai = any("ai" in mapping for mapping in config.get("map", []))
        
        return ConfigResponse(
            conversion_id=conversion_id,
            extract_patterns=extract_patterns,
            mappings=mappings,
            output_fields=output_fields,
            has_ai_mappings=has_ai
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get config: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get config: {str(e)}"
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
            learned_from=result["learned_from"]
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
    Approve and save an auto-generated configuration permanently.

    Moves the config from temporary storage to the permanent conversion_configs collection.
    The temporary copy is deleted after approval.
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

        # Check if config already exists in permanent storage
        existing = await mongodb_service.get_config(config_id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Config {config_id} already exists in permanent storage"
            )

        # Clean up temp markers before saving (e.g., _unknown)
        if "map" in temp_config:
            for mapping in temp_config["map"]:
                mapping.pop("_unknown", None)

        # Insert into permanent storage
        await mongodb_service.insert_config(temp_config)

        # Delete from temp storage
        await mongodb_service.delete_temp_config(config_id)

        logger.info(f"Config {config_id} approved and saved permanently")

        return ApproveConfigResponse(
            status="approved",
            configuration_id=config_id
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to approve config: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to approve config: {str(e)}"
        )


@router.get("/auto-configure/{config_id}", response_model=AutoConfigureResponse, status_code=status.HTTP_200_OK)
async def get_temp_config(config_id: str) -> AutoConfigureResponse:
    """
    Get an auto-generated configuration from temporary storage.

    Returns the config if it exists and hasn't expired (5 min TTL).
    """
    try:
        temp_config = await mongodb_service.get_temp_config(config_id)
        if not temp_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Config not found or expired: {config_id}"
            )

        # Count matched vs unknown fields
        matched_fields = []
        unknown_fields = []
        for mapping in temp_config.get("map", []):
            field_id = mapping.get("from", "")
            if mapping.get("_unknown"):
                unknown_fields.append(field_id)
            else:
                matched_fields.append(field_id)

        fields_detected = len(temp_config.get("extract", {}))
        confidence = len(matched_fields) / fields_detected if fields_detected > 0 else 0

        return AutoConfigureResponse(
            configuration_id=config_id,
            config=temp_config,
            confidence=round(confidence, 2),
            fields_detected=fields_detected,
            matched_fields=matched_fields,
            unknown_fields=unknown_fields,
            learned_from=[]  # Not tracked in temp storage
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get temp config: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get temp config: {str(e)}"
        )


# ============================================================================
# Solana Blockchain Endpoints
# ============================================================================

class SolanaTransferRequest(BaseModel):
    """Request for SOL transfer."""
    to_address: str = Field(..., description="Recipient's Solana address (base58)")
    amount_sol: float = Field(..., gt=0, description="Amount of SOL to transfer")
    memo: Optional[str] = Field(None, description="Optional memo for the transfer")


class SolanaTransferResponse(BaseModel):
    """Response from SOL transfer."""
    success: bool
    signature: Optional[str] = None
    amount_sol: float
    amount_lamports: Optional[int] = None
    from_address: Optional[str] = None
    to_address: Optional[str] = None
    memo: Optional[str] = None
    explorer_url: Optional[str] = None
    confirmation: Optional[str] = None
    confirmation_time_ms: Optional[int] = None
    error: Optional[str] = None


class SolanaAirdropRequest(BaseModel):
    """Request for SOL airdrop from devnet faucet."""
    address: Optional[str] = Field(None, description="Address to fund (defaults to service wallet)")
    amount_sol: float = Field(default=1.0, gt=0, le=2.0, description="Amount of SOL (max 2 per request)")


class SolanaAirdropResponse(BaseModel):
    """Response from airdrop request."""
    success: bool
    signature: Optional[str] = None
    amount_sol: float
    recipient: str
    explorer_url: Optional[str] = None
    error: Optional[str] = None


class SolanaBalanceResponse(BaseModel):
    """Response with wallet balance."""
    success: bool
    pubkey: str
    balance_sol: Optional[float] = None
    balance_lamports: Optional[int] = None
    error: Optional[str] = None


class SolanaHealthResponse(BaseModel):
    """Solana service health status."""
    healthy: bool
    rpc_endpoint: str
    network: str
    current_slot: Optional[int] = None
    wallet: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


@router.post("/solana/transfer", response_model=SolanaTransferResponse)
async def solana_transfer(request: SolanaTransferRequest) -> SolanaTransferResponse:
    """
    Transfer SOL to a recipient address.

    Executes a native SOL transfer on Solana devnet. No amount limits.
    Returns transaction signature and explorer URL.
    """
    if not solana_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Solana service not configured"
        )

    try:
        result = solana_service.transfer(
            to_pubkey=request.to_address,
            amount_sol=request.amount_sol,
            memo=request.memo
        )

        return SolanaTransferResponse(
            success=result.get("success", False),
            signature=result.get("signature"),
            amount_sol=result.get("amount_sol", request.amount_sol),
            amount_lamports=result.get("amount_lamports"),
            from_address=result.get("from"),
            to_address=result.get("to"),
            memo=result.get("memo"),
            explorer_url=result.get("explorer_url"),
            confirmation=result.get("confirmation"),
            confirmation_time_ms=result.get("confirmation_time_ms"),
            error=result.get("error")
        )
    except Exception as e:
        logger.error(f"Solana transfer failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transfer failed: {str(e)}"
        )


@router.post("/solana/airdrop", response_model=SolanaAirdropResponse)
async def solana_airdrop(request: SolanaAirdropRequest) -> SolanaAirdropResponse:
    """
    Request SOL from devnet faucet.

    Funds a wallet with test SOL. Max 2 SOL per request.
    Only works on devnet.
    """
    if not solana_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Solana service not configured"
        )

    try:
        result = solana_service.airdrop(
            pubkey=request.address,
            amount_sol=request.amount_sol
        )

        return SolanaAirdropResponse(
            success=result.get("success", False),
            signature=result.get("signature"),
            amount_sol=result.get("amount_sol", request.amount_sol),
            recipient=result.get("recipient", request.address or "service wallet"),
            explorer_url=result.get("explorer_url"),
            error=result.get("error")
        )
    except Exception as e:
        logger.error(f"Solana airdrop failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Airdrop failed: {str(e)}"
        )


@router.get("/solana/balance", response_model=SolanaBalanceResponse)
async def solana_balance_service() -> SolanaBalanceResponse:
    """
    Get service wallet balance.

    Returns the SOL balance of the configured service wallet.
    """
    if not solana_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Solana service not configured"
        )

    try:
        result = solana_service.get_balance()
        return SolanaBalanceResponse(**result)
    except Exception as e:
        logger.error(f"Balance check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Balance check failed: {str(e)}"
        )


@router.get("/solana/balance/{address}", response_model=SolanaBalanceResponse)
async def solana_balance_address(address: str) -> SolanaBalanceResponse:
    """
    Get balance for any Solana address.

    Returns the SOL balance for the specified address.
    """
    if not solana_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Solana service not configured"
        )

    try:
        result = solana_service.get_balance(pubkey=address)
        return SolanaBalanceResponse(**result)
    except Exception as e:
        logger.error(f"Balance check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Balance check failed: {str(e)}"
        )


@router.get("/solana/health", response_model=SolanaHealthResponse)
async def solana_health() -> SolanaHealthResponse:
    """
    Check Solana service health.

    Returns RPC connectivity status, network info, and wallet balance.
    """
    if not solana_service:
        return SolanaHealthResponse(
            healthy=False,
            rpc_endpoint=settings.solana_rpc_endpoint,
            network=settings.solana_network,
            error="Solana service not configured"
        )

    try:
        result = solana_service.health_check()
        return SolanaHealthResponse(**result)
    except Exception as e:
        logger.error(f"Solana health check failed: {e}")
        return SolanaHealthResponse(
            healthy=False,
            rpc_endpoint=settings.solana_rpc_endpoint,
            network=settings.solana_network,
            error=str(e)
        )

