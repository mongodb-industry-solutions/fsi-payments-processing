"""
Conversion Review API - Human review for conversion results with low confidence
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from datetime import datetime
import logging
import json
from services.db_service import MongoDBService
from config.settings import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory storage for conversion results (in production, use database)
conversion_results = {}

class FieldUpdate(BaseModel):
    """Update for a single field in conversion result"""
    field_id: str
    original_value: Any
    corrected_value: Any
    reason: Optional[str]

class ConversionReviewRequest(BaseModel):
    """Request to review and update conversion results"""
    conversion_id: str
    field_updates: List[FieldUpdate]
    approve_all: bool = False
    reviewer_notes: Optional[str]

class ConversionReviewResponse(BaseModel):
    """Response after conversion review"""
    success: bool
    conversion_id: str
    fields_updated: int
    new_confidence: float
    message: str
    updated_xml: Optional[str]

@router.post("/conversion/{conversion_id}/store")
async def store_conversion_result(
    conversion_id: str,
    result: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Store conversion result for later review
    (Called automatically after conversion if human review needed)
    """
    conversion_results[conversion_id] = {
        "result": result,
        "stored_at": datetime.utcnow().isoformat(),
        "reviewed": False
    }
    
    return {
        "success": True,
        "conversion_id": conversion_id,
        "message": "Conversion result stored for review"
    }

@router.get("/conversion/{conversion_id}/review-status")
async def get_conversion_review_status(conversion_id: str) -> Dict[str, Any]:
    """
    Get conversion result with fields needing review
    """
    if conversion_id not in conversion_results:
        # Try to get from recent conversions (if using demo_api)
        from api.demo_api import recent_conversions
        if conversion_id in recent_conversions:
            conv_data = recent_conversions[conversion_id]
            result = conv_data.get("result", {})
        else:
            raise HTTPException(
                status_code=404,
                detail=f"Conversion {conversion_id} not found"
            )
    else:
        result = conversion_results[conversion_id]["result"]
    
    metadata = result.get("metadata", {})
    human_review_fields = metadata.get("human_review_fields", [])
    
    # Parse the converted message to extract current values
    converted_message = result.get("converted_message", "")
    
    review_info = {
        "conversion_id": conversion_id,
        "needs_review": metadata.get("human_review_required", False),
        "source_format": metadata.get("source_format"),
        "target_format": metadata.get("target_format"),
        "fields_requiring_review": [],
        "overall_confidence": sum(
            metadata.get("confidence_scores", {}).values()
        ) / len(metadata.get("confidence_scores", {})) if metadata.get("confidence_scores") else 0
    }
    
    # Add field details
    for field in human_review_fields:
        field_info = {
            "field_id": field.get("field"),
            "confidence": field.get("confidence"),
            "reason": field.get("reason"),
            "threshold": field.get("threshold", 0.8),
            "current_value": None,  # Would extract from XML/JSON
            "suggested_action": "Review and correct if needed"
        }
        
        # If it's an AI field, include AI output
        ai_outputs = metadata.get("ai_outputs", {})
        if field.get("field") in ai_outputs:
            field_info["ai_output"] = ai_outputs[field.get("field")]
        
        review_info["fields_requiring_review"].append(field_info)
    
    return review_info

@router.post("/conversion/review")
async def review_conversion(request: ConversionReviewRequest) -> ConversionReviewResponse:
    """
    Apply human corrections to conversion result
    """
    try:
        # Get stored result
        if request.conversion_id not in conversion_results:
            from api.demo_api import recent_conversions
            if request.conversion_id in recent_conversions:
                conv_data = recent_conversions[request.conversion_id]
                result = conv_data.get("result", {})
            else:
                raise HTTPException(
                    status_code=404,
                    detail=f"Conversion {request.conversion_id} not found"
                )
        else:
            result = conversion_results[request.conversion_id]["result"]
        
        # Apply field updates
        fields_updated = 0
        converted_message = result.get("converted_message", "")
        
        for update in request.field_updates:
            # In a real implementation, you would:
            # 1. Parse the XML/JSON
            # 2. Update the specific field value
            # 3. Rebuild the message
            
            # For demo, we'll just track the update
            fields_updated += 1
            
            # Update confidence for this field
            if "confidence_scores" in result.get("metadata", {}):
                field_base = update.field_id.split('.')[0]
                result["metadata"]["confidence_scores"][update.field_id] = 0.95  # Human validated
        
        # Recalculate overall confidence
        confidence_scores = result.get("metadata", {}).get("confidence_scores", {})
        new_confidence = sum(confidence_scores.values()) / len(confidence_scores) if confidence_scores else 0.9
        
        # Mark as reviewed
        result["metadata"]["human_reviewed"] = True
        result["metadata"]["reviewed_at"] = datetime.utcnow().isoformat()
        result["metadata"]["reviewer_notes"] = request.reviewer_notes
        result["metadata"]["human_review_required"] = False  # No longer needs review
        
        # Store the updated result
        if request.conversion_id in conversion_results:
            conversion_results[request.conversion_id]["reviewed"] = True
            conversion_results[request.conversion_id]["result"] = result
        
        # Update semantic patterns based on corrections
        db_service = MongoDBService(settings.mongodb_uri, settings.database_name)
        
        for update in request.field_updates:
            # Extract semantic concept from field
            field_base = update.field_id.split('.')[0]
            
            # Try to find existing pattern for this field
            patterns = list(db_service.db['semantic_patterns'].find())
            for pattern in patterns:
                learned = pattern.get('learned_patterns', {})
                for format_name, format_data in learned.items():
                    if format_data.get('field') == update.field_id or format_data.get('field') == field_base:
                        # Update confidence based on human correction
                        pattern_id = pattern['_id']
                        
                        # Boost confidence since human validated
                        db_service.db['semantic_patterns'].update_one(
                            {"_id": pattern_id},
                            {
                                "$set": {
                                    f"learned_patterns.{format_name}.confidence": 0.95,
                                    "learning_metadata.last_updated": datetime.utcnow(),
                                    "learning_metadata.success_count": pattern.get('learning_metadata', {}).get('success_count', 0) + 1
                                },
                                "$push": {
                                    "discovery_log": {
                                        "timestamp": datetime.utcnow(),
                                        "event": f"Human validated field {update.field_id} in conversion",
                                        "source": "conversion_review"
                                    }
                                }
                            }
                        )
                        logger.info(f"Updated pattern {pattern_id} based on conversion review")
                        break
        
        # Note: Semantic pattern learning is now handled by populate_semantic_patterns.py script
        # The SimplifiedSemanticLearningService uses static seed patterns
        # No dynamic learning needed here
        
        return ConversionReviewResponse(
            success=True,
            conversion_id=request.conversion_id,
            fields_updated=fields_updated,
            new_confidence=new_confidence,
            message=f"Conversion reviewed. {fields_updated} fields updated.",
            updated_xml=converted_message  # In real impl, this would be the corrected XML
        )
        
    except Exception as e:
        logger.error(f"Error reviewing conversion: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/conversions/pending-review")
async def get_pending_conversion_reviews() -> Dict[str, Any]:
    """
    Get all conversions pending human review
    """
    pending = []
    
    # Check stored results
    for conv_id, data in conversion_results.items():
        if not data.get("reviewed", False):
            result = data["result"]
            metadata = result.get("metadata", {})
            if metadata.get("human_review_required"):
                pending.append({
                    "conversion_id": conv_id,
                    "source_format": metadata.get("source_format"),
                    "target_format": metadata.get("target_format"),
                    "stored_at": data["stored_at"],
                    "fields_needing_review": len(metadata.get("human_review_fields", [])),
                    "processing_time": metadata.get("processing_time_seconds")
                })
    
    # Also check recent conversions from demo
    try:
        from api.demo_api import recent_conversions
        for conv_id, conv_data in recent_conversions.items():
            if conv_id not in conversion_results:  # Not already in our list
                result = conv_data.get("result", {})
                metadata = result.get("metadata", {})
                if metadata.get("human_review_required"):
                    pending.append({
                        "conversion_id": conv_id,
                        "source_format": metadata.get("source_format"),
                        "target_format": metadata.get("target_format"),
                        "stored_at": conv_data.get("timestamp"),
                        "fields_needing_review": len(metadata.get("human_review_fields", [])),
                        "processing_time": metadata.get("processing_time_seconds")
                    })
    except ImportError:
        pass
    
    return {
        "total_pending": len(pending),
        "conversions": pending
    }

@router.post("/conversion/{conversion_id}/approve")
async def quick_approve_conversion(conversion_id: str) -> Dict[str, Any]:
    """
    Quick approve conversion without changes
    """
    if conversion_id not in conversion_results:
        from api.demo_api import recent_conversions
        if conversion_id not in recent_conversions:
            raise HTTPException(
                status_code=404,
                detail=f"Conversion {conversion_id} not found"
            )
    
    # Mark as approved
    if conversion_id in conversion_results:
        conversion_results[conversion_id]["reviewed"] = True
        conversion_results[conversion_id]["result"]["metadata"]["human_reviewed"] = True
        conversion_results[conversion_id]["result"]["metadata"]["human_review_required"] = False
    
    return {
        "success": True,
        "conversion_id": conversion_id,
        "message": "Conversion approved without changes"
    }