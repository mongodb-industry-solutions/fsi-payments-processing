"""
Progress Tracking System
Provides real-time progress updates for demo purposes
"""

import asyncio
import json
import logging
from typing import Dict, Any, Optional, List, Callable
from datetime import datetime
from enum import Enum

logger = logging.getLogger(__name__)


class ProcessingStage(Enum):
    """Processing stages for visualization"""
    PARSING = "parsing"
    TRANSFORMING = "transforming"
    RULES_PROCESSING = "rules_processing"
    AI_PROCESSING = "ai_processing"
    HUMAN_REVIEW = "human_review"
    BUILDING = "building"
    COMPLETE = "complete"


class FieldStatus(Enum):
    """Status of individual field processing"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REVIEW_NEEDED = "review_needed"


class ProgressTracker:
    """
    Tracks conversion progress for demo visualization.
    Non-invasive - only collects data, doesn't modify logic.
    """
    
    def __init__(self, conversion_id: str = None):
        """Initialize progress tracker"""
        self.conversion_id = conversion_id or f"demo_{datetime.now().timestamp()}"
        self.start_time = datetime.now()
        self.current_stage = ProcessingStage.PARSING
        self.field_progress = {}
        self.stage_timeline = []
        self.callbacks = []
        
    def register_callback(self, callback: Callable):
        """Register a callback for progress updates"""
        self.callbacks.append(callback)
        
    def _notify_callbacks(self, update: Dict[str, Any]):
        """Notify all registered callbacks"""
        for callback in self.callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    asyncio.create_task(callback(update))
                else:
                    callback(update)
            except Exception as e:
                logger.warning(f"Failed to notify callback: {e}")
    
    def start_stage(self, stage: ProcessingStage, details: str = ""):
        """Mark the start of a processing stage"""
        self.current_stage = stage
        stage_info = {
            "stage": stage.value,
            "started_at": datetime.now().isoformat(),
            "details": details
        }
        self.stage_timeline.append(stage_info)
        
        self._notify_callbacks({
            "type": "stage_start",
            "stage": stage.value,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
        
    def complete_stage(self, stage: ProcessingStage, result: Dict[str, Any] = None):
        """Mark the completion of a processing stage"""
        # Find and update the stage in timeline
        for stage_info in self.stage_timeline:
            if stage_info["stage"] == stage.value and "completed_at" not in stage_info:
                stage_info["completed_at"] = datetime.now().isoformat()
                stage_info["result"] = result
                break
        
        self._notify_callbacks({
            "type": "stage_complete",
            "stage": stage.value,
            "result": result,
            "timestamp": datetime.now().isoformat()
        })
    
    def start_field_processing(self, field_name: str, lane: str, details: Dict[str, Any] = None):
        """Track individual field processing start"""
        self.field_progress[field_name] = {
            "status": FieldStatus.PROCESSING.value,
            "lane": lane,
            "started_at": datetime.now().isoformat(),
            "details": details or {}
        }
        
        self._notify_callbacks({
            "type": "field_start",
            "field": field_name,
            "lane": lane,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
    
    def complete_field_processing(self, field_name: str, 
                                 status: FieldStatus = FieldStatus.COMPLETED,
                                 result: Any = None,
                                 confidence: float = None):
        """Track individual field processing completion"""
        if field_name in self.field_progress:
            self.field_progress[field_name]["status"] = status.value
            self.field_progress[field_name]["completed_at"] = datetime.now().isoformat()
            self.field_progress[field_name]["result"] = result
            if confidence is not None:
                self.field_progress[field_name]["confidence"] = confidence
        
        self._notify_callbacks({
            "type": "field_complete",
            "field": field_name,
            "status": status.value,
            "confidence": confidence,
            "timestamp": datetime.now().isoformat()
        })
    
    def add_ai_reasoning(self, field_name: str, reasoning: Dict[str, Any]):
        """Add AI reasoning details for a field"""
        if field_name in self.field_progress:
            self.field_progress[field_name]["ai_reasoning"] = reasoning
        
        self._notify_callbacks({
            "type": "ai_reasoning",
            "field": field_name,
            "reasoning": reasoning,
            "timestamp": datetime.now().isoformat()
        })
    
    def add_confidence_breakdown(self, field_name: str, breakdown: Dict[str, Any]):
        """Add confidence score breakdown for a field"""
        if field_name in self.field_progress:
            self.field_progress[field_name]["confidence_breakdown"] = breakdown
        
        self._notify_callbacks({
            "type": "confidence_breakdown",
            "field": field_name,
            "breakdown": breakdown,
            "timestamp": datetime.now().isoformat()
        })
    
    def get_summary(self) -> Dict[str, Any]:
        """Get complete progress summary"""
        total_fields = len(self.field_progress)
        completed_fields = sum(1 for f in self.field_progress.values() 
                             if f["status"] == FieldStatus.COMPLETED.value)
        
        lanes_distribution = {}
        for field_data in self.field_progress.values():
            lane = field_data.get("lane", "unknown")
            lanes_distribution[lane] = lanes_distribution.get(lane, 0) + 1
        
        processing_time = (datetime.now() - self.start_time).total_seconds()
        
        return {
            "conversion_id": self.conversion_id,
            "current_stage": self.current_stage.value,
            "processing_time_seconds": processing_time,
            "total_fields": total_fields,
            "completed_fields": completed_fields,
            "progress_percentage": (completed_fields / total_fields * 100) if total_fields > 0 else 0,
            "lanes_distribution": lanes_distribution,
            "field_details": self.field_progress,
            "timeline": self.stage_timeline
        }
    
    def get_lane_visualization(self) -> Dict[str, Any]:
        """Get data for 3-lane processing visualization"""
        lanes = {
            "RULES": [],
            "AI": [],
            "HUMAN": []
        }
        
        for field_name, field_data in self.field_progress.items():
            lane = field_data.get("lane", "RULES")
            lanes[lane].append({
                "field": field_name,
                "status": field_data["status"],
                "confidence": field_data.get("confidence"),
                "processing_time": self._calculate_field_time(field_data)
            })
        
        return {
            "lanes": lanes,
            "total_by_lane": {lane: len(fields) for lane, fields in lanes.items()},
            "visualization_timestamp": datetime.now().isoformat()
        }
    
    def _calculate_field_time(self, field_data: Dict[str, Any]) -> Optional[float]:
        """Calculate processing time for a field"""
        if "started_at" in field_data and "completed_at" in field_data:
            start = datetime.fromisoformat(field_data["started_at"])
            end = datetime.fromisoformat(field_data["completed_at"])
            return (end - start).total_seconds()
        return None


# Global tracker instance (optional, for singleton pattern)
_global_tracker: Optional[ProgressTracker] = None


def get_progress_tracker(conversion_id: str = None) -> ProgressTracker:
    """Get or create a progress tracker instance"""
    global _global_tracker
    if _global_tracker is None or conversion_id:
        _global_tracker = ProgressTracker(conversion_id)
    return _global_tracker


def reset_progress_tracker():
    """Reset the global progress tracker"""
    global _global_tracker
    _global_tracker = None