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
                yield f"data: {json.dumps({'type': 'hop1_complete', 'time': round(hop1_time, 2)})}\n\n"

            except CountryValidationException as e:
                # Country validation failed - emit event and call agent
                yield f"data: {json.dumps({'type': 'validation_failed', 'country': e.conversion_context.get('additional_context', {}).get('country'), 'field': e.field_name, 'task_type': e.task_type})}\n\n"

                # Stream agent events
                yield f"data: {json.dumps({'type': 'agent_start', 'task_type': e.task_type, 'field': e.field_name})}\n\n"

                # Capture task_type for use in nested events
                current_task_type = e.task_type
                
                final_state = {}
                async for event in agent_client.process_payment_stream(
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
                        yield f"data: {json.dumps({'type': 'agent_execution', 'status': 'complete', 'field': result.get('field_name', ''), 'old_value': result.get('old_value', ''), 'new_value': result.get('new_value', ''), 'reasoning': result.get('reasoning', ''), 'details': {'field_name': result.get('field_name'), 'old_value': result.get('old_value'), 'new_value': result.get('new_value'), 'reasoning': result.get('reasoning'), 'success': result.get('success')}})}\n\n"

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
                    'metadata': {'source_format': request.source_format, 'target_format': "JSON"}
                }

            # Hop 2: JSON → Target
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
            yield f"data: {json.dumps({'type': 'hop2_complete', 'time': round(hop2_time, 2)})}\n\n"

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

