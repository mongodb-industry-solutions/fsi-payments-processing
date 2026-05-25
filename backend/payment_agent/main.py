"""
FastAPI server for payment agent system.

Endpoints:
- POST /api/v1/payment-agent/process-stream-with-review: Stream processing with human review
- POST /api/v1/payment-agent/resume-stream: Resume paused workflow after review
- GET /api/v1/payment-agent/health: Health check
- GET /api/v1/payment-agent/collection-preview/{collection_name}: Sample documents from a collection
"""

import logging
from datetime import datetime
import json
import uuid

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from langgraph.types import Command

from graph import get_workflow
from models import (
    ProcessPaymentRequest,
    HealthResponse,
    ResumeWorkflowRequest,
)
from streaming import make_serializable, sse_event, SSE_HEADERS

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
    Resume a workflow paused for human review, streaming execution events.

    Args:
        request: Contains thread_id and human's decision

    Returns:
        StreamingResponse with execution events
    """

    async def event_generator():
        try:
            logger.info(f"Resuming workflow: thread_id={request.thread_id}, approved={request.decision.approved}")

            workflow = get_workflow()
            config = {"configurable": {"thread_id": request.thread_id}}

            resume_value = {
                "approved": request.decision.approved,
                "modified_value": request.decision.modified_value
            }

            async for chunk in workflow.astream(
                Command(resume=resume_value), config, stream_mode="updates"
            ):
                logger.debug(f"Resume streaming chunk: {list(chunk.keys())}")

                if "__interrupt__" in chunk:
                    continue

                yield sse_event(make_serializable(chunk))

            logger.info(f"Resumed workflow completed for thread: {request.thread_id}")
            yield sse_event({"type": "complete", "success": True})

        except Exception as e:
            logger.error(f"Streaming resume error: {e}", exc_info=True)
            yield sse_event({
                "type": "error",
                "message": str(e),
                "error_type": type(e).__name__
            })

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
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

    Streams workflow events and pauses at the human_review node, emitting a
    'review_required' event. Call /resume-stream with the thread_id to continue.

    Returns:
        StreamingResponse with events including 'review_required' when paused
    """
    thread_id = str(uuid.uuid4())

    async def event_generator():
        try:
            logger.info(f"Starting workflow with review, problem: {request.problem[:50]}..., thread: {thread_id}")

            workflow = get_workflow()
            config = {"configurable": {"thread_id": thread_id}}

            initial_state = {
                "problem": request.problem,
                "task_type": "autonomous",
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

            yield sse_event({"type": "thread_started", "thread_id": thread_id})

            async for chunk in workflow.astream(initial_state, config, stream_mode="updates"):
                logger.debug(f"Streaming chunk: {list(chunk.keys())}")

                if "__interrupt__" in chunk:
                    interrupt_data = chunk["__interrupt__"]
                    logger.info(f"Workflow interrupted for human review: {type(interrupt_data)}")

                    # Extract value from Interrupt object(s)
                    review_data = None
                    if isinstance(interrupt_data, (tuple, list)) and len(interrupt_data) > 0:
                        first_interrupt = interrupt_data[0]
                        review_data = first_interrupt.value if hasattr(first_interrupt, 'value') else first_interrupt
                    elif hasattr(interrupt_data, 'value'):
                        review_data = interrupt_data.value
                    else:
                        review_data = interrupt_data

                    if not isinstance(review_data, dict):
                        review_data = {"data": str(review_data)}

                    yield sse_event({
                        "type": "review_required",
                        "thread_id": thread_id,
                        **make_serializable(review_data)
                    })

                    logger.info(f"Workflow paused, waiting for resume on thread {thread_id}")
                    return

                yield sse_event(make_serializable(chunk))

            logger.info(f"Workflow completed for field: {request.field_name}")
            yield sse_event({"type": "complete", "success": True})

        except Exception as e:
            logger.error(f"Streaming workflow error: {e}", exc_info=True)
            yield sse_event({
                "type": "error",
                "message": str(e),
                "error_type": type(e).__name__
            })

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )


ALLOWED_COLLECTIONS = {
    "bankDetails", "ifscCodes", "purposeCodes", "registeredEntities",
    "conversionConfigs", "formatSpecifications", "canonicalJsonStorage",
    "aiPrompts", "tempConfigs",
}


@app.get(
    "/api/v1/payment-agent/collection-preview/{collection_name}",
    summary="Collection Preview",
    description="Return 3 sample documents from an agent-used collection",
)
async def collection_preview(collection_name: str):
    if collection_name not in ALLOWED_COLLECTIONS:
        raise HTTPException(status_code=404, detail=f"Collection '{collection_name}' not available for preview")

    from services.mongodb_service import get_mongodb_service

    def _sanitize(obj):
        """Convert non-JSON-serializable MongoDB types to strings."""
        if isinstance(obj, dict):
            return {k: _sanitize(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [_sanitize(v) for v in obj]
        try:
            json.dumps(obj)
            return obj
        except (TypeError, ValueError):
            return str(obj)

    try:
        db_service = get_mongodb_service()
        collection = db_service.get_collection(collection_name)
        docs = list(collection.find({}, limit=5))
        for doc in docs:
            doc.pop("_id", None)
            # Truncate embedding vectors: show first 5 values + "..."
            if "embedding" in doc and isinstance(doc["embedding"], list) and len(doc["embedding"]) > 5:
                doc["embedding"] = doc["embedding"][:5] + ["... ({} dims total)".format(len(doc["embedding"]))]
        docs = [_sanitize(doc) for doc in docs]
        return JSONResponse(content={
            "collection": collection_name,
            "sample_count": len(docs),
            "documents": docs,
        })
    except Exception as e:
        logger.error(f"Collection preview error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


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
