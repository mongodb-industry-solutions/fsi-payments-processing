"""
Generation Tracker - Tracks auto-configuration generation process
"""

import logging
from typing import Dict, Any, List
from datetime import datetime

logger = logging.getLogger(__name__)

class GenerationTracker:
    """Tracks the auto-configuration generation process with detailed metadata"""

    def __init__(self):
        self.steps = []
        self.start_time = datetime.utcnow()
        self.semantic_patterns_used = []
        self.ai_processing_details = {}
        self.learning_sources = {}

    def start_step(self, step_name: str) -> str:
        """Start tracking a processing step"""
        step_id = f"{step_name}_{len(self.steps)}"
        step_data = {
            "step": step_name,
            "step_id": step_id,
            "timestamp": datetime.utcnow(),
            "started_at": datetime.utcnow(),
            "status": "in_progress"
        }
        self.steps.append(step_data)
        logger.debug(f"Started tracking step: {step_name}")
        return step_id

    def complete_step(self, step_id: str, result: Dict[str, Any]):
        """Complete a step with result data"""
        for step in self.steps:
            if step.get("step_id") == step_id:
                step["completed_at"] = datetime.utcnow()
                step["duration_ms"] = int((step["completed_at"] - step["started_at"]).total_seconds() * 1000)
                step["status"] = "completed"
                step["result"] = result
                logger.debug(f"Completed step: {step['step']} in {step['duration_ms']}ms")
                break

    def add_semantic_pattern(self, concept_id: str, concept_name: str, used_for_fields: List[str], learned_from: List[str]):
        """Track semantic pattern usage"""
        self.semantic_patterns_used.append({
            "concept_id": concept_id,
            "concept_name": concept_name,
            "used_for_fields": used_for_fields,
            "learned_from_formats": learned_from
        })

    def set_ai_details(self, model: str, fields_processed: List[str], total_time_ms: int, tokens: Dict[str, int] = None):
        """Track AI processing details"""
        self.ai_processing_details = {
            "model": model,
            "fields_processed_by_ai": fields_processed,
            "total_ai_time_ms": total_time_ms,
            "tokens_used": tokens or {}
        }

    def set_learning_sources(self, base_config: str, similar_formats: List[str], patterns_referenced: int):
        """Track learning sources"""
        self.learning_sources = {
            "base_configuration": base_config,
            "similar_formats_analyzed": similar_formats,
            "semantic_patterns_referenced": patterns_referenced
        }

    def get_metadata(self) -> Dict[str, Any]:
        """Get complete generation metadata"""
        steps_serializable = []
        for step in self.steps:
            step_copy = step.copy()
            if 'timestamp' in step_copy:
                step_copy['timestamp'] = step_copy['timestamp'].isoformat()
            if 'started_at' in step_copy:
                del step_copy['started_at']
            if 'completed_at' in step_copy:
                del step_copy['completed_at']
            steps_serializable.append(step_copy)

        total_duration = (datetime.utcnow() - self.start_time).total_seconds() * 1000

        # Collect all AI analysis details from steps
        ai_analysis_collection = {}
        for step in steps_serializable:
            if step.get('result') and 'ai_analysis' in step['result']:
                ai_analysis_collection[step['step']] = step['result']['ai_analysis']

        return {
            "processing_steps": steps_serializable,
            "semantic_patterns_used": self.semantic_patterns_used,
            "ai_processing_details": self.ai_processing_details,
            "ai_analysis_collection": ai_analysis_collection,
            "learning_sources": self.learning_sources,
            "total_duration_ms": int(total_duration)
        }