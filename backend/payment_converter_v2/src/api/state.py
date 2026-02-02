"""In-flight workflow state management with TTL cleanup."""

import time
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class PendingState:
    """
    Dict-like store with automatic expiration of stale entries.

    Prevents unbounded memory growth from abandoned workflows.
    Entries older than ttl_seconds are removed on each access.
    """

    def __init__(self, ttl_seconds: int = 3600):
        self._store: Dict[str, Any] = {}
        self._timestamps: Dict[str, float] = {}
        self._ttl = ttl_seconds

    def set(self, key: str, value: Any) -> None:
        self._store[key] = value
        self._timestamps[key] = time.time()
        self._cleanup()

    def get(self, key: str) -> Optional[Any]:
        self._cleanup()
        return self._store.get(key)

    def delete(self, key: str) -> None:
        self._store.pop(key, None)
        self._timestamps.pop(key, None)

    def _cleanup(self) -> None:
        now = time.time()
        expired = [k for k, t in self._timestamps.items() if now - t > self._ttl]
        if expired:
            logger.debug(f"Cleaning up {len(expired)} expired pending entries")
        for k in expired:
            self._store.pop(k, None)
            self._timestamps.pop(k, None)


# Tracks conversion state during human-in-the-loop agent review
# Key: thread_id, Value: dict with conversion_run_id, formats, validation context
pending_conversions = PendingState(ttl_seconds=3600)

# Tracks state when AI-processed fields need human review
# Key: conversion_run_id, Value: dict with hop1_result, request details
pending_ai_reviews = PendingState(ttl_seconds=3600)
