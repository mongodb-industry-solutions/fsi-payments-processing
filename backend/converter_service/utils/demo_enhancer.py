"""
Demo Enhancer Utility
Enhances conversion responses with visualization data for demo purposes
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
import logging

from ..config.feature_flags import feature_flags

logger = logging.getLogger(__name__)


class DemoEnhancer:
    """
    Enhances conversion responses with demo-specific visualizations.
    Non-invasive - only adds data, doesn't modify core functionality.
    """
    
    @staticmethod
    def enhance_response(
        response: Dict[str, Any],
        processing_stats: Dict[str, Any] = None,
        confidence_scores: Dict[str, float] = None,
        timeline: List[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Enhance a conversion response with demo visualization data.
        
        Args:
            response: Original conversion response
            processing_stats: Processing statistics from transformer
            confidence_scores: Field confidence scores
            timeline: Processing timeline
            
        Returns:
            Enhanced response with demo data (only if demo mode enabled)
        """
        
        if not feature_flags.is_demo_mode():
            return response
        
        try:
            # Create demo insights section
            demo_insights = {
                "visualization_enabled": True,
                "timestamp": datetime.now().isoformat()
            }
            
            # Add lane distribution visualization
            if processing_stats:
                demo_insights["lane_distribution"] = DemoEnhancer._create_lane_visualization(
                    processing_stats
                )
            
            # Add confidence breakdown
            if confidence_scores:
                demo_insights["confidence_analysis"] = DemoEnhancer._create_confidence_analysis(
                    confidence_scores
                )
            
            # Add processing timeline
            if timeline:
                demo_insights["processing_timeline"] = DemoEnhancer._create_timeline_visualization(
                    timeline
                )
            
            # Add field complexity analysis
            demo_insights["field_complexity"] = DemoEnhancer._analyze_field_complexity(
                processing_stats, confidence_scores
            )
            
            # Add to response
            response["demo_insights"] = demo_insights
            
            # Add visual indicators for human review fields
            if "metadata" in response and "human_review_fields" in response["metadata"]:
                demo_insights["human_review_visualization"] = DemoEnhancer._create_review_visualization(
                    response["metadata"]["human_review_fields"]
                )
            
            return response
            
        except Exception as e:
            logger.warning(f"Failed to enhance response for demo: {e}")
            return response
    
    @staticmethod
    def _create_lane_visualization(processing_stats: Dict[str, Any]) -> Dict[str, Any]:
        """Create lane distribution visualization data"""
        
        total_fields = sum(
            stats.get("count", 0) 
            for stats in processing_stats.values()
        )
        
        if total_fields == 0:
            return {"message": "No fields processed"}
        
        lanes = {}
        for lane_name, stats in processing_stats.items():
            count = stats.get("count", 0)
            lanes[lane_name] = {
                "count": count,
                "percentage": round((count / total_fields) * 100, 1),
                "fields": stats.get("fields", []),
                "visual_width": min(100, int((count / total_fields) * 100))
            }
        
        # Determine primary processing mode
        primary_lane = max(lanes.items(), key=lambda x: x[1]["count"])[0] if lanes else "rules_lane"
        
        return {
            "lanes": lanes,
            "total_fields": total_fields,
            "primary_lane": primary_lane,
            "efficiency_rating": DemoEnhancer._calculate_efficiency_rating(lanes)
        }
    
    @staticmethod
    def _create_confidence_analysis(confidence_scores: Dict[str, float]) -> Dict[str, Any]:
        """Create confidence score analysis"""
        
        if not confidence_scores:
            return {"message": "No confidence scores available"}
        
        scores = list(confidence_scores.values())
        
        return {
            "average_confidence": round(sum(scores) / len(scores), 3),
            "highest_confidence": max(scores),
            "lowest_confidence": min(scores),
            "distribution": {
                "high": len([s for s in scores if s >= 0.9]),
                "medium": len([s for s in scores if 0.7 <= s < 0.9]),
                "low": len([s for s in scores if s < 0.7])
            },
            "fields_by_confidence": sorted(
                [{"field": k, "confidence": v} for k, v in confidence_scores.items()],
                key=lambda x: x["confidence"],
                reverse=True
            )[:5]  # Top 5 for display
        }
    
    @staticmethod
    def _create_timeline_visualization(timeline: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Create timeline visualization data"""
        
        enhanced_timeline = []
        
        for i, stage in enumerate(timeline):
            enhanced_stage = {
                **stage,
                "stage_number": i + 1,
                "visual_position": i * 20  # For visual positioning
            }
            
            # Calculate duration if completed
            if "started_at" in stage and "completed_at" in stage:
                start = datetime.fromisoformat(stage["started_at"])
                end = datetime.fromisoformat(stage["completed_at"])
                duration = (end - start).total_seconds()
                enhanced_stage["duration_seconds"] = round(duration, 3)
                enhanced_stage["duration_display"] = f"{duration:.3f}s"
            
            enhanced_timeline.append(enhanced_stage)
        
        return enhanced_timeline
    
    @staticmethod
    def _analyze_field_complexity(
        processing_stats: Dict[str, Any],
        confidence_scores: Dict[str, float]
    ) -> Dict[str, Any]:
        """Analyze field processing complexity"""
        
        ai_fields = processing_stats.get("ai_lane", {}).get("fields", [])
        rules_fields = processing_stats.get("rules_lane", {}).get("fields", [])
        
        complexity_score = 0
        factors = []
        
        # Factor 1: AI processing usage
        if ai_fields:
            ai_percentage = len(ai_fields) / (len(ai_fields) + len(rules_fields))
            complexity_score += ai_percentage * 40
            factors.append(f"AI processing: {len(ai_fields)} fields")
        
        # Factor 2: Low confidence fields
        if confidence_scores:
            low_confidence = len([s for s in confidence_scores.values() if s < 0.8])
            if low_confidence > 0:
                complexity_score += (low_confidence / len(confidence_scores)) * 30
                factors.append(f"Low confidence: {low_confidence} fields")
        
        # Factor 3: Human review needed
        human_fields = processing_stats.get("human_lane", {}).get("count", 0)
        if human_fields > 0:
            complexity_score += 30
            factors.append(f"Human review: {human_fields} fields")
        
        return {
            "complexity_score": round(min(100, complexity_score), 1),
            "complexity_level": DemoEnhancer._get_complexity_level(complexity_score),
            "factors": factors
        }
    
    @staticmethod
    def _create_review_visualization(human_review_fields: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Create human review visualization data"""
        
        if not human_review_fields:
            return {"message": "No fields require human review"}
        
        return {
            "total_fields": len(human_review_fields),
            "review_priority": "high" if len(human_review_fields) > 3 else "medium",
            "fields": [
                {
                    "field": f.get("field"),
                    "confidence": f.get("confidence"),
                    "reason": f.get("reason", "Low confidence"),
                    "visual_indicator": "⚠️" if f.get("confidence", 1) < 0.5 else "ℹ️"
                }
                for f in human_review_fields[:10]  # Limit to 10 for display
            ]
        }
    
    @staticmethod
    def _calculate_efficiency_rating(lanes: Dict[str, Any]) -> str:
        """Calculate processing efficiency rating"""
        
        rules_percentage = lanes.get("rules_lane", {}).get("percentage", 0)
        
        if rules_percentage >= 85:
            return "excellent"
        elif rules_percentage >= 70:
            return "good"
        elif rules_percentage >= 50:
            return "moderate"
        else:
            return "needs_optimization"
    
    @staticmethod
    def _get_complexity_level(score: float) -> str:
        """Get complexity level from score"""
        
        if score < 20:
            return "simple"
        elif score < 40:
            return "moderate"
        elif score < 60:
            return "complex"
        else:
            return "very_complex"
    
    @staticmethod
    def create_demo_metadata(
        source_format: str,
        target_format: str,
        processing_time: float,
        field_count: int
    ) -> Dict[str, Any]:
        """
        Create demo-specific metadata for display.
        
        Args:
            source_format: Source format name
            target_format: Target format name
            processing_time: Total processing time in seconds
            field_count: Number of fields processed
            
        Returns:
            Demo metadata dictionary
        """
        
        if not feature_flags.is_demo_mode():
            return {}
        
        return {
            "demo_info": {
                "conversion_type": f"{source_format} → {target_format}",
                "processing_speed": DemoEnhancer._calculate_speed_rating(processing_time, field_count),
                "performance_metrics": {
                    "time_per_field": round(processing_time / field_count, 4) if field_count > 0 else 0,
                    "fields_per_second": round(field_count / processing_time, 1) if processing_time > 0 else 0
                },
                "visualization_available": True
            }
        }
    
    @staticmethod
    def _calculate_speed_rating(processing_time: float, field_count: int) -> str:
        """Calculate processing speed rating"""
        
        if field_count == 0:
            return "no_data"
        
        time_per_field = processing_time / field_count
        
        if time_per_field < 0.01:
            return "blazing_fast"
        elif time_per_field < 0.05:
            return "fast"
        elif time_per_field < 0.1:
            return "normal"
        else:
            return "slow"