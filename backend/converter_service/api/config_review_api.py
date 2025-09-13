"""
Config Review API - Human review for auto-generated configurations
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from datetime import datetime
import logging
from services.db_service import MongoDBService
from services.semantic_learning_service import SemanticLearningService
from config.settings import get_settings

settings = get_settings()

logger = logging.getLogger(__name__)

router = APIRouter()

class FieldCorrection(BaseModel):
    """Correction for a single field mapping"""
    field_id: str
    current_mapping: Optional[Dict[str, Any]]
    corrected_mapping: Dict[str, Any]
    semantic_concept: str
    reason: Optional[str]

class ConfigReviewRequest(BaseModel):
    """Request to review and correct auto-generated config"""
    config_id: str
    field_corrections: List[FieldCorrection]
    approve: bool
    reviewer_notes: Optional[str]

class ConfigReviewResponse(BaseModel):
    """Response after config review"""
    success: bool
    config_id: str
    corrections_applied: int
    patterns_updated: int
    new_confidence: float
    message: str

@router.get("/config/{config_id}/review")
async def get_config_for_review(config_id: str) -> Dict[str, Any]:
    """
    Get auto-generated config with review metadata
    """
    try:
        db_service = MongoDBService(settings.mongodb_uri, settings.database_name)
        
        # Get the configuration
        config = db_service.get_conversion_config(config_id)
        if not config:
            raise HTTPException(status_code=404, detail=f"Configuration {config_id} not found")
        
        # Check if it's auto-generated and needs review
        metadata = config.get('metadata', {})
        if not metadata.get('auto_generated'):
            return {
                "config_id": config_id,
                "needs_review": False,
                "message": "This is not an auto-generated configuration"
            }
        
        # Identify fields needing review
        review_fields = []
        
        # Check unmapped fields
        parser_fields = set(config.get('parser', {}).get('fields', {}).keys())
        mapped_fields = set()
        for mapping in config.get('mappings', []):
            source = mapping.get('source', '').split('.')[0]  # Get base field
            mapped_fields.add(source)
        
        unmapped_fields = parser_fields - mapped_fields
        
        for field_id in unmapped_fields:
            field_info = config['parser']['fields'][field_id]
            review_fields.append({
                "field_id": field_id,
                "field_name": field_info.get('name', field_id),
                "issue": "unmapped",
                "current_mapping": None,
                "suggested_action": "Add mapping or mark as ignored"
            })
        
        # Check low confidence mappings
        for mapping in config.get('mappings', []):
            if mapping.get('confidence', 1.0) < 0.7:
                source_field = mapping.get('source', '')
                base_field = source_field.split('.')[0]
                field_info = config['parser']['fields'].get(base_field, {})
                
                review_fields.append({
                    "field_id": source_field,
                    "field_name": field_info.get('name', source_field),
                    "issue": "low_confidence",
                    "confidence": mapping.get('confidence'),
                    "current_mapping": mapping,
                    "suggested_action": "Verify or correct mapping"
                })
        
        # Check fields with "unknown" in name
        for field_id, field_info in config.get('parser', {}).get('fields', {}).items():
            if 'unknown' in field_info.get('name', '').lower():
                review_fields.append({
                    "field_id": field_id,
                    "field_name": field_info.get('name', field_id),
                    "issue": "unknown_semantic",
                    "current_mapping": next((m for m in config.get('mappings', []) 
                                           if m.get('source', '').split('.')[0] == field_id), None),
                    "suggested_action": "Identify field purpose and update name"
                })
        
        # Remove duplicates
        seen = set()
        unique_review_fields = []
        for field in review_fields:
            if field['field_id'] not in seen:
                seen.add(field['field_id'])
                unique_review_fields.append(field)
        
        return {
            "config_id": config_id,
            "needs_review": len(unique_review_fields) > 0 or metadata.get('generation_confidence', 1.0) < 0.8,
            "generation_confidence": metadata.get('generation_confidence', 0),
            "source_format": metadata.get('source_format'),
            "target_format": metadata.get('target_format'),
            "based_on": metadata.get('based_on'),
            "review_fields": unique_review_fields,
            "total_fields": len(parser_fields),
            "mapped_fields": len(mapped_fields),
            "unmapped_fields": list(unmapped_fields),
            "human_validated": metadata.get('human_validated', False)
        }
        
    except Exception as e:
        logger.error(f"Error getting config for review: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/config/review")
async def review_config(request: ConfigReviewRequest) -> ConfigReviewResponse:
    """
    Apply human corrections to auto-generated config and update patterns
    """
    try:
        db_service = MongoDBService(settings.mongodb_uri, settings.database_name)
        learning_service = SemanticLearningService(db_service)
        
        # Get the configuration
        config = db_service.get_conversion_config(request.config_id)
        if not config:
            raise HTTPException(status_code=404, detail=f"Configuration {request.config_id} not found")
        
        corrections_applied = 0
        patterns_updated = 0
        
        # Apply field corrections
        for correction in request.field_corrections:
            field_id = correction.field_id
            base_field = field_id.split('.')[0]
            
            # Update parser field name if semantic concept identified
            if 'unknown' in config['parser']['fields'].get(base_field, {}).get('name', '').lower():
                config['parser']['fields'][base_field]['name'] = correction.semantic_concept.replace('_', ' ')
            
            # Update or add mapping
            mapping_found = False
            for i, mapping in enumerate(config.get('mappings', [])):
                if mapping.get('source') == field_id:
                    # Update existing mapping
                    config['mappings'][i] = correction.corrected_mapping
                    mapping_found = True
                    corrections_applied += 1
                    break
            
            if not mapping_found and correction.corrected_mapping:
                # Add new mapping
                config['mappings'].append(correction.corrected_mapping)
                corrections_applied += 1
            
            # Update semantic pattern
            if correction.semantic_concept:
                pattern_doc = {
                    "_id": correction.semantic_concept,
                    "concept": correction.semantic_concept.replace('_', ' ').title(),
                    "learned_patterns": {
                        config['metadata']['source_format']: {
                            "field": field_id,
                            "pattern": config['parser']['fields'][base_field].get('pattern'),
                            "targets": correction.corrected_mapping.get('targets', []),
                            "transform": correction.corrected_mapping.get('transform'),
                            "transform_config": correction.corrected_mapping.get('transform_config'),
                            "confidence": 0.9  # High confidence after human validation
                        }
                    }
                }
                
                db_service.db['semantic_patterns'].update_one(
                    {"_id": correction.semantic_concept},
                    {"$set": pattern_doc},
                    upsert=True
                )
                patterns_updated += 1
        
        # Update metadata
        config['metadata']['human_validated'] = request.approve
        config['metadata']['validated_at'] = datetime.utcnow()
        config['metadata']['reviewer_notes'] = request.reviewer_notes
        
        # Recalculate confidence based on corrections
        if corrections_applied > 0:
            old_confidence = config['metadata'].get('generation_confidence', 0.5)
            # Boost confidence after human review
            new_confidence = min(0.95, old_confidence + (corrections_applied * 0.1))
            config['metadata']['generation_confidence'] = new_confidence
        else:
            new_confidence = config['metadata'].get('generation_confidence', 0.5)
        
        # Save updated configuration
        db_service.db['conversion_registry'].replace_one(
            {"_id": request.config_id},
            config
        )
        
        # Trigger learning from the corrected config
        learning_service.learn_from_existing_configs()
        
        return ConfigReviewResponse(
            success=True,
            config_id=request.config_id,
            corrections_applied=corrections_applied,
            patterns_updated=patterns_updated,
            new_confidence=new_confidence,
            message=f"Config reviewed and {'approved' if request.approve else 'updated'}. {corrections_applied} corrections applied."
        )
        
    except Exception as e:
        logger.error(f"Error reviewing config: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/configs/pending-review")
async def get_pending_reviews() -> Dict[str, Any]:
    """
    Get all auto-generated configs pending human review
    """
    try:
        db_service = MongoDBService(settings.mongodb_uri, settings.database_name)
        
        # Find auto-generated configs not yet validated
        pending = list(db_service.db['conversion_registry'].find(
            {
                "metadata.auto_generated": True,
                "metadata.human_validated": {"$ne": True}
            },
            {
                "_id": 1,
                "metadata": 1
            }
        ))
        
        # Format response
        pending_configs = []
        for config in pending:
            pending_configs.append({
                "config_id": config['_id'],
                "source_format": config['metadata'].get('source_format'),
                "target_format": config['metadata'].get('target_format'),
                "generation_confidence": config['metadata'].get('generation_confidence', 0),
                "generated_at": config['metadata'].get('generated_at'),
                "based_on": config['metadata'].get('based_on')
            })
        
        return {
            "total_pending": len(pending_configs),
            "configs": pending_configs
        }
        
    except Exception as e:
        logger.error(f"Error getting pending reviews: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/config/{config_id}/approve")
async def quick_approve_config(config_id: str) -> Dict[str, Any]:
    """
    Quick approve an auto-generated config without corrections
    """
    try:
        db_service = MongoDBService(settings.mongodb_uri, settings.database_name)
        
        result = db_service.db['conversion_registry'].update_one(
            {"_id": config_id},
            {
                "$set": {
                    "metadata.human_validated": True,
                    "metadata.validated_at": datetime.utcnow(),
                    "metadata.generation_confidence": 0.9  # Boost confidence after approval
                }
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail=f"Configuration {config_id} not found")
        
        return {
            "success": True,
            "config_id": config_id,
            "message": "Configuration approved"
        }
        
    except Exception as e:
        logger.error(f"Error approving config: {e}")
        raise HTTPException(status_code=500, detail=str(e))