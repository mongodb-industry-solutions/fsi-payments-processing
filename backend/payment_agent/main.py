"""
FastAPI server for payment agent system.

This module provides REST API endpoints for the payment agent system:
- POST /api/v1/payment-agent/process: Process payments through LangGraph workflow
- POST /api/v1/payment-agent/process-stream: Stream payment processing with real-time SSE updates
- GET /api/v1/payment-agent/health: Health check endpoint

The main endpoint accepts payment data and task specifications, invokes the
LangGraph workflow with Supervisor → Resolution → Execution agents, and
returns the processing results.
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import json
import uuid

from graph import get_workflow
from langgraph.types import Command, Interrupt

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Payment Agent System",
    description="Multi-agent AI system for handling payment processing exceptions",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================


class ConversionContext(BaseModel):
    """Context from payment converter about the conversion."""
    source_format: str = Field(..., description="Source payment format (e.g., MT103)")
    target_format: str = Field(..., description="Target payment format (e.g., pacs.008)")
    conversion_id: str = Field(..., description="Unique conversion identifier")
    conversion_run_id: Optional[str] = Field(default=None, description="Unique run ID for this conversion (UUID)")
    additional_context: Optional[Dict[str, Any]] = Field(default=None, description="Additional context fields")


class ProcessPaymentRequest(BaseModel):
    """Request model for processing a payment through the agent system."""

    problem: str = Field(
        ...,
        description="Rich description of the problem for autonomous agent analysis",
        examples=[
            "The creditor name contains Western/Latin characters but Japanese payment regulations require katakana script",
            "India requires valid IFSC code for domestic transfers but provided bank identifier doesn't match IFSC format"
        ]
    )

    field_name: str = Field(
        ...,
        description="Name of field to modify in payment data",
        examples=["creditor_name", "creditor_bank", "creditor_account"]
    )

    original_value: Optional[str] = Field(
        default=None,
        description="Original field value before modification (for audit)"
    )

    payment_data: Dict[str, Any] = Field(
        ...,
        description="Canonical JSON payment data from payment_converter_v2"
    )

    conversion_context: ConversionContext = Field(
        ...,
        description="Context from payment converter"
    )


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = Field(..., description="Service status")
    timestamp: str = Field(..., description="Current server timestamp")
    service: str = Field(..., description="Service name")
    version: str = Field(..., description="Service version")


class HumanReviewDecision(BaseModel):
    """Human reviewer's decision on proposed change."""
    approved: bool = Field(..., description="Whether the change is approved")
    modified_value: Optional[str] = Field(default=None, description="Optional modified value if human wants to change proposed value")


class ResumeWorkflowRequest(BaseModel):
    """Request to resume workflow after human review."""
    thread_id: str = Field(..., description="Thread ID from the initial request")
    decision: HumanReviewDecision = Field(..., description="Human reviewer's decision")


# =============================================================================
# API ENDPOINTS
# =============================================================================


@app.get(
    "/api/v1/payment-agent/health",
    response_model=HealthResponse,
    summary="Health Check",
    description="Check if the payment agent service is running"
)
async def health_check() -> HealthResponse:
    """
    Health check endpoint.

    Returns service status and metadata.
    """
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow().isoformat(),
        service="Payment Agent System",
        version="1.0.0"
    )


@app.post(
    "/api/v1/payment-agent/resume-stream",
    summary="Resume Workflow with Streaming",
    description="Resume a paused workflow after human review with real-time SSE events for the execution phase",
    status_code=status.HTTP_200_OK
)
async def resume_workflow_stream(request: ResumeWorkflowRequest):
    """
    Resume a workflow that was paused for human review with streaming events.

    This endpoint streams the execution agent events in real-time after resume,
    allowing the frontend to show execution progress.

    Args:
        request: Contains thread_id and human's decision

    Returns:
        StreamingResponse with execution events
    """

    async def event_generator():
        """Generate SSE events from resumed workflow."""

        def make_serializable(obj):
            """Convert non-serializable objects to serializable format."""
            if isinstance(obj, Interrupt):
                return make_serializable(obj.value)
            elif hasattr(obj, 'value') and hasattr(obj, 'resumable'):
                return make_serializable(obj.value)
            elif hasattr(obj, 'model_dump'):
                return obj.model_dump()
            elif hasattr(obj, 'dict') and callable(obj.dict):
                return obj.dict()
            elif hasattr(obj, 'content') and hasattr(obj, '__class__'):
                return {
                    "type": obj.__class__.__name__,
                    "content": obj.content
                }
            elif isinstance(obj, dict):
                return {k: make_serializable(v) for k, v in obj.items()}
            elif isinstance(obj, (list, tuple)):
                return [make_serializable(item) for item in obj]
            else:
                try:
                    json.dumps(obj)
                    return obj
                except (TypeError, ValueError):
                    return str(obj)

        try:
            logger.info(f"Resuming workflow with streaming: thread_id={request.thread_id}, approved={request.decision.approved}")

            # Get the workflow
            workflow = get_workflow()

            # Configure with thread_id for checkpointer
            config = {"configurable": {"thread_id": request.thread_id}}

            # Resume value from human's decision
            resume_value = {
                "approved": request.decision.approved,
                "modified_value": request.decision.modified_value
            }

            # Stream the resumed workflow execution
            async for chunk in workflow.astream(
                Command(resume=resume_value), config, stream_mode="updates"
            ):
                logger.debug(f"Resume streaming chunk: {list(chunk.keys())}")

                # Skip interrupt chunks (shouldn't happen on resume but just in case)
                if "__interrupt__" in chunk:
                    continue

                # Convert to serializable format
                serializable_chunk = make_serializable(chunk)

                # Format as SSE
                event_data = json.dumps(serializable_chunk)
                yield f"data: {event_data}\n\n"

            # Send completion event
            logger.info(f"Resumed workflow completed for thread: {request.thread_id}")
            completion_event = json.dumps({"type": "complete", "success": True})
            yield f"data: {completion_event}\n\n"

        except Exception as e:
            logger.error(f"Streaming resume error: {e}", exc_info=True)
            error_event = json.dumps({
                "type": "error",
                "message": str(e),
                "error_type": type(e).__name__
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


@app.post(
    "/api/v1/payment-agent/process-stream-with-review",
    summary="Process Payment with Streaming and Human Review",
    description="Process a payment with real-time streaming that pauses for human review before execution",
    status_code=status.HTTP_200_OK
)
async def process_payment_stream_with_review(request: ProcessPaymentRequest):
    """
    Stream agent events with human-in-the-loop review.

    This endpoint streams workflow events and pauses at the human_review node,
    emitting a 'review_required' event with the proposed change for approval.

    After receiving the review_required event, call /resume with the thread_id
    and human's decision to continue the workflow.

    Returns:
        StreamingResponse with events including 'review_required' when paused
    """
    # Generate unique thread_id for this workflow
    thread_id = str(uuid.uuid4())

    async def event_generator():
        """Generate SSE events from LangGraph workflow with interrupt handling."""

        def make_serializable(obj):
            """Convert non-serializable objects to serializable format."""
            # Handle LangGraph Interrupt objects (use isinstance for reliable check)
            if isinstance(obj, Interrupt):
                return make_serializable(obj.value)
            # Handle any object with .value that looks like an Interrupt
            elif hasattr(obj, 'value') and hasattr(obj, 'resumable'):
                return make_serializable(obj.value)
            elif hasattr(obj, 'model_dump'):
                # Pydantic v2 models
                return obj.model_dump()
            elif hasattr(obj, 'dict') and callable(obj.dict):
                # Pydantic v1 models
                return obj.dict()
            elif hasattr(obj, 'content') and hasattr(obj, '__class__'):
                # LangChain message objects
                return {
                    "type": obj.__class__.__name__,
                    "content": obj.content
                }
            elif isinstance(obj, dict):
                return {k: make_serializable(v) for k, v in obj.items()}
            elif isinstance(obj, (list, tuple)):
                return [make_serializable(item) for item in obj]
            else:
                # Fallback: try to convert to string if not JSON serializable
                try:
                    json.dumps(obj)
                    return obj
                except (TypeError, ValueError):
                    return str(obj)

        try:
            logger.info(f"Starting streaming workflow with review, problem: {request.problem[:50]}..., thread: {thread_id}")

            # Get workflow
            workflow = get_workflow()

            # Configure with thread_id for checkpointer persistence
            config = {"configurable": {"thread_id": thread_id}}

            # Construct initial state
            initial_state = {
                "problem": request.problem,
                "task_type": "autonomous",  # Legacy support
                "field_name": request.field_name,
                "original_value": request.original_value,
                "payment_data": request.payment_data,
                "conversion_context": request.conversion_context.model_dump(),
                "messages": [],
                "next_agent": None,
                "solution": {},
                "result": {},
                "human_review": None,
                "review_requested": False
            }

            # Send thread_id first so client can use it for resume
            thread_event = json.dumps({"type": "thread_started", "thread_id": thread_id})
            yield f"data: {thread_event}\n\n"

            # Stream workflow execution
            async for chunk in workflow.astream(initial_state, config, stream_mode="updates"):
                logger.debug(f"Streaming chunk: {list(chunk.keys())}")

                # Check for interrupt (human_review node will trigger this)
                if "__interrupt__" in chunk:
                    interrupt_data = chunk["__interrupt__"]
                    logger.info(f"Workflow interrupted for human review: {type(interrupt_data)}")

                    # Extract interrupt value from Interrupt object(s)
                    # LangGraph returns tuple/list of Interrupt objects, each with .value attribute
                    review_data = None
                    if isinstance(interrupt_data, (tuple, list)) and len(interrupt_data) > 0:
                        first_interrupt = interrupt_data[0]
                        if hasattr(first_interrupt, 'value'):
                            review_data = first_interrupt.value
                        else:
                            review_data = first_interrupt
                    elif hasattr(interrupt_data, 'value'):
                        # Single Interrupt object
                        review_data = interrupt_data.value
                    else:
                        review_data = interrupt_data

                    logger.info(f"Extracted review_data: {review_data}")

                    # Ensure review_data is a dict for spreading
                    if not isinstance(review_data, dict):
                        review_data = {"data": str(review_data)}

                    # Emit review_required event
                    review_event = json.dumps({
                        "type": "review_required",
                        "thread_id": thread_id,
                        **make_serializable(review_data)
                    })
                    yield f"data: {review_event}\n\n"

                    # Don't continue - workflow is paused waiting for resume
                    logger.info(f"Workflow paused, waiting for resume on thread {thread_id}")
                    return

                # Normal chunk - serialize and send
                serializable_chunk = make_serializable(chunk)
                event_data = json.dumps(serializable_chunk)
                yield f"data: {event_data}\n\n"

            # Workflow completed without interrupt (shouldn't happen with human review enabled)
            logger.info(f"Workflow completed for field: {request.field_name}")
            completion_event = json.dumps({"type": "complete", "success": True})
            yield f"data: {completion_event}\n\n"

        except Exception as e:
            logger.error(f"Streaming workflow error: {e}", exc_info=True)
            error_event = json.dumps({
                "type": "error",
                "message": str(e),
                "error_type": type(e).__name__
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


# =============================================================================
# APPLICATION STARTUP
# =============================================================================


@app.on_event("startup")
async def startup_event():
    """Initialize services on application startup."""
    logger.info("🚀 Payment Agent System starting up...")
    logger.info("✓ LangGraph workflow initialized")
    logger.info("✓ API endpoints ready")
    logger.info("Service listening on http://localhost:8002")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on application shutdown."""
    logger.info("Payment Agent System shutting down...")


# =============================================================================
# MAIN ENTRY POINT
# =============================================================================


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8002,
        reload=True,
        log_level="info"
    )
