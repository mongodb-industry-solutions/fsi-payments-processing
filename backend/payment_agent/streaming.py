"""SSE streaming utilities for payment agent endpoints."""

import json
import logging
from typing import Any

from langgraph.types import Interrupt

logger = logging.getLogger(__name__)


def make_serializable(obj: Any) -> Any:
    """
    Convert non-serializable LangGraph/Pydantic objects to JSON-safe format.

    Handles Interrupt objects, Pydantic models, LangChain messages,
    and nested dicts/lists recursively.
    """
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


def sse_event(data: dict) -> str:
    """Format a dict as an SSE data line."""
    return f"data: {json.dumps(data)}\n\n"


SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}
