"""
Auto-configuration API endpoints for intelligent converter
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from datetime import datetime
import logging
import os

from ..services.db_service import get_mongodb_service as get_db_service
from ..services.semantic_learning_service import SemanticLearningService
from ..services.ai_service import get_bedrock_service as get_ai_service
from ..config.settings import get_settings

router = APIRouter()
logger = logging.getLogger(__name__)

def _clean_config_for_response(config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Clean configuration for JSON response by converting datetime objects to strings
    and removing any non-serializable objects
    """
    import copy
    clean = copy.deepcopy(config)
    
    # Convert datetime objects in metadata
    if 'metadata' in clean:
        metadata = clean['metadata']
        for key, value in metadata.items():
            if isinstance(value, datetime):
                metadata[key] = value.isoformat()
            elif hasattr(value, '__dict__'):
                # Convert any object with __dict__ to string
                metadata[key] = str(value)
    
    # Remove any None ai_service to avoid serialization issues
    if 'ai_service' in clean and clean['ai_service'] is None:
        clean['ai_service'] = {}
    
    return clean

def get_db():
    """Get MongoDB service with settings"""
    settings = get_settings()
    return get_db_service(settings.mongodb_uri, settings.database_name)


class AutoConfigRequest(BaseModel):
    """Request model for auto-configuration"""
    source_format: str  # e.g., "MT192"
    target_format: str  # e.g., "pacs.008"
    sample_message: str  # Sample message in the new format
    similar_to: str  # Which existing format this is similar to (e.g., "MT103")
    target_template: Optional[Dict[str, Any]] = None  # Optional: provide custom target template


class AutoConfigResponse(BaseModel):
    """Response model for auto-configuration"""
    configuration_id: str
    configuration: Dict[str, Any]
    confidence: float
    fields_detected: int
    fields_mapped: int
    uncertain_fields: List[Dict[str, Any]]
    generation_time_seconds: float
    ready_to_save: bool


class ConfigValidation(BaseModel):
    """Model for configuration validation"""
    configuration_id: str
    corrections: Optional[Dict[str, Any]] = None
    approved: bool


class LearningTrigger(BaseModel):
    """Model for triggering learning"""
    force_refresh: bool = False  # Force re-learning even if patterns exist


@router.post("/auto-configure", response_model=AutoConfigResponse)
async def auto_configure(
    request: AutoConfigRequest,
    db_service=Depends(get_db),
    ai_service=Depends(get_ai_service)
):
    """
    Automatically generate configuration for a new payment format
    
    This endpoint:
    1. Analyzes the sample message
    2. Identifies fields and their semantic concepts
    3. Generates a complete configuration
    4. Saves it to conversion_registry
    """
    
    start_time = datetime.utcnow()
    
    # Check if configuration already exists
    config_id = f"{request.source_format}_to_{request.target_format}"
    existing = db_service.db['conversion_registry'].find_one({"_id": config_id})
    if existing and not existing.get('metadata', {}).get('auto_generated'):
        raise HTTPException(
            status_code=400,
            detail=f"Configuration {config_id} already exists as a manual configuration"
        )
    
    # Initialize learning service
    learning_service = SemanticLearningService(db_service, ai_service)
    
    # Check if semantic patterns exist
    patterns_count = db_service.db['semantic_patterns'].count_documents({})
    if patterns_count == 0:
        raise HTTPException(
            status_code=400,
            detail="No semantic patterns found. Please run populate_semantic_patterns.py first"
        )
    
    try:
        # Generate configuration
        logger.info(f"Generating configuration for {request.source_format} to {request.target_format}")
        
        config = learning_service.generate_config_for_new_format(
            source_format=request.source_format,
            target_format=request.target_format,
            sample_message=request.sample_message,
            similar_to=request.similar_to
        )
        
        # Save to conversion_registry (skip learning for faster response)
        saved_config = learning_service.save_generated_config(config, trigger_learning=False)
        
        # Use the saved config (which might be merged) for statistics
        fields_detected = len(saved_config.get('parser', {}).get('fields', {}))
        fields_mapped = len(saved_config.get('mappings', []))
        
        # Identify uncertain fields (confidence < 0.8)
        uncertain_fields = []
        for mapping in saved_config.get('mappings', []):
            confidence = mapping.get('confidence', 1.0)
            if confidence < 0.8:
                uncertain_fields.append({
                    'field': mapping['source'],
                    'confidence': confidence,
                    'targets': mapping['targets'],
                    'reason': 'Low confidence mapping'
                })
        
        # Check if ready to save (has minimum required mappings)
        ready_to_save = fields_mapped > 0 and saved_config['metadata']['generation_confidence'] > 0.5
        
        # Calculate generation time
        generation_time = (datetime.utcnow() - start_time).total_seconds()
        
        logger.info(f"Configuration generated successfully: {saved_config['_id']}")
        
        # Convert datetime objects to strings for JSON serialization
        clean_config = _clean_config_for_response(saved_config)
        
        return AutoConfigResponse(
            configuration_id=saved_config['_id'],
            configuration=clean_config,
            confidence=saved_config['metadata']['generation_confidence'],
            fields_detected=fields_detected,
            fields_mapped=fields_mapped,
            uncertain_fields=uncertain_fields,
            generation_time_seconds=generation_time,
            ready_to_save=ready_to_save
        )
        
    except ValueError as e:
        logger.error(f"Configuration generation failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error during configuration generation: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during configuration generation")


@router.get("/semantic-patterns")
async def get_semantic_patterns(
    db_service=Depends(get_db)
):
    """
    Get all learned semantic patterns
    
    Returns list of all semantic concepts that have been learned
    from existing configurations
    """
    
    patterns = list(db_service.db['semantic_patterns'].find())
    
    # Convert datetime objects for JSON serialization
    for pattern in patterns:
        if 'learning_metadata' in pattern:
            metadata = pattern['learning_metadata']
            if 'first_seen' in metadata:
                metadata['first_seen'] = metadata['first_seen'].isoformat() if metadata['first_seen'] else None
            if 'last_updated' in metadata:
                metadata['last_updated'] = metadata['last_updated'].isoformat() if metadata['last_updated'] else None
    
    return {
        "total_patterns": len(patterns),
        "patterns": patterns,
        "summary": {
            "formats_learned": list(set(
                format_name 
                for p in patterns 
                for format_name in p.get('learned_patterns', {}).keys()
            )),
            "total_mappings": sum(
                len(p.get('learned_patterns', {})) 
                for p in patterns
            )
        }
    }


@router.post("/validate-config")
async def validate_config(
    validation: ConfigValidation,
    db_service=Depends(get_db),
    ai_service=Depends(get_ai_service)
):
    """
    Validate and approve an auto-generated configuration
    
    This endpoint allows human review and approval of auto-generated configs
    """
    
    # Check if configuration exists
    config = db_service.db['conversion_registry'].find_one({"_id": validation.configuration_id})
    if not config:
        raise HTTPException(
            status_code=404,
            detail=f"Configuration {validation.configuration_id} not found"
        )
    
    # Check if it's auto-generated
    if not config.get('metadata', {}).get('auto_generated'):
        raise HTTPException(
            status_code=400,
            detail="This configuration was not auto-generated"
        )
    
    learning_service = SemanticLearningService(db_service, ai_service)
    
    if validation.approved:
        # Apply corrections if provided and mark as validated
        if validation.corrections:
            learning_service.validate_and_update_config(
                validation.configuration_id,
                validation.corrections
            )
            message = "Configuration validated with corrections and ready for use"
        else:
            # Just mark as validated
            db_service.db['conversion_registry'].update_one(
                {"_id": validation.configuration_id},
                {
                    "$set": {
                        "metadata.human_validated": True,
                        "metadata.validated_at": datetime.utcnow()
                    }
                }
            )
            message = "Configuration validated and ready for use"
        
        logger.info(f"Configuration {validation.configuration_id} approved")
        
        return {
            "status": "approved",
            "configuration_id": validation.configuration_id,
            "message": message
        }
    else:
        # Mark as rejected
        db_service.db['conversion_registry'].update_one(
            {"_id": validation.configuration_id},
            {
                "$set": {
                    "metadata.human_validated": False,
                    "metadata.rejected": True,
                    "metadata.rejected_at": datetime.utcnow(),
                    "metadata.rejection_reason": validation.corrections.get('reason', 'No reason provided') if validation.corrections else 'No reason provided'
                }
            }
        )
        
        logger.info(f"Configuration {validation.configuration_id} rejected")
        
        return {
            "status": "rejected",
            "configuration_id": validation.configuration_id,
            "message": "Configuration rejected and marked for review"
        }


@router.post("/learn")
async def trigger_learning(
    request: LearningTrigger = LearningTrigger(),
    db_service=Depends(get_db),
    ai_service=Depends(get_ai_service)
):
    """
    Trigger learning from existing configurations
    
    This endpoint initiates the learning process that extracts semantic patterns
    from all existing configurations in conversion_registry
    """
    
    # Check if patterns already exist and have learned data
    existing_patterns = db_service.db['semantic_patterns'].count_documents({})
    patterns_with_learning = db_service.db['semantic_patterns'].count_documents({
        "learned_patterns": {"$ne": {}}  # Has non-empty learned patterns
    })
    
    if patterns_with_learning > 0 and not request.force_refresh:
        return {
            "status": "skipped",
            "message": f"Semantic patterns already learned ({patterns_with_learning} patterns with data). Use force_refresh=true to re-learn",
            "patterns_count": existing_patterns,
            "learned_count": patterns_with_learning
        }
    
    # If force refresh, clear only learned_patterns but keep seed structure
    if request.force_refresh and existing_patterns > 0:
        # Update patterns to clear learned data but keep seed structure
        db_service.db['semantic_patterns'].update_many(
            {},
            {
                "$set": {
                    "learned_patterns": {},
                    "field_variations": {},
                    "learning_metadata.last_updated": datetime.utcnow()
                }
            }
        )
        logger.info(f"Cleared learned data from {existing_patterns} patterns, keeping seed structure")
    
    # Initialize learning service
    learning_service = SemanticLearningService(db_service, ai_service)
    
    # Learn patterns from existing configurations
    logger.info("Starting semantic pattern learning...")
    learned_patterns = learning_service.learn_from_existing_configs()
    
    if not learned_patterns:
        return {
            "status": "failed",
            "message": "No patterns could be learned. Ensure conversion configurations exist in conversion_registry",
            "patterns_learned": 0
        }
    
    # Save or update learned patterns in semantic_patterns collection
    patterns_list = list(learned_patterns.values())
    updated_count = 0
    inserted_count = 0
    
    for pattern in patterns_list:
        # Use upsert to update existing or insert new
        result = db_service.db['semantic_patterns'].update_one(
            {"_id": pattern["_id"]},
            {"$set": pattern},
            upsert=True
        )
        if result.upserted_id:
            inserted_count += 1
        elif result.modified_count > 0:
            updated_count += 1
    
    logger.info(f"Pattern learning complete: {inserted_count} new, {updated_count} updated")
    
    # Get summary of what was learned
    formats_seen = set()
    for pattern in patterns_list:
        formats_seen.update(pattern.get('learning_metadata', {}).get('seen_in_formats', []))
    
    return {
        "status": "success",
        "patterns_learned": len(patterns_list),
        "patterns_inserted": inserted_count,
        "patterns_updated": updated_count,
        "formats_analyzed": list(formats_seen),
        "message": f"Successfully processed {len(patterns_list)} patterns ({inserted_count} new, {updated_count} updated) from {len(formats_seen)} formats"
    }


@router.get("/auto-config/status/{configuration_id}")
async def get_config_status(
    configuration_id: str,
    db_service=Depends(get_db)
):
    """
    Get the status of an auto-generated configuration
    """
    
    # Format the configuration ID
    if '_to_' not in configuration_id:
        raise HTTPException(
            status_code=400,
            detail="Invalid configuration ID format. Expected: SOURCE_to_TARGET"
        )
    
    config = db_service.db['conversion_registry'].find_one({"_id": configuration_id})
    
    if not config:
        raise HTTPException(
            status_code=404,
            detail=f"Configuration {configuration_id} not found"
        )
    
    metadata = config.get('metadata', {})
    
    # Determine status
    if not metadata.get('auto_generated'):
        status = "manual"
        status_detail = "This is a manually created configuration"
    elif metadata.get('rejected'):
        status = "rejected"
        status_detail = f"Rejected at {metadata.get('rejected_at', 'Unknown')}"
    elif metadata.get('human_validated'):
        status = "validated"
        status_detail = f"Validated at {metadata.get('validated_at', 'Unknown')}"
    else:
        status = "pending_validation"
        status_detail = "Awaiting human validation"
    
    # Calculate field statistics
    fields_count = len(config.get('parser', {}).get('fields', {}))
    mappings_count = len(config.get('mappings', []))
    
    # Count by processing lane
    lane_stats = {"RULES": 0, "AI": 0}
    for mapping in config.get('mappings', []):
        lane = mapping.get('processing_lane', 'RULES')
        lane_stats[lane] = lane_stats.get(lane, 0) + 1
    
    return {
        "configuration_id": configuration_id,
        "status": status,
        "status_detail": status_detail,
        "metadata": {
            "auto_generated": metadata.get('auto_generated', False),
            "based_on": metadata.get('based_on'),
            "generation_confidence": metadata.get('generation_confidence'),
            "generated_at": metadata.get('generated_at').isoformat() if metadata.get('generated_at') else None,
            "human_validated": metadata.get('human_validated', False),
            "validated_at": metadata.get('validated_at').isoformat() if metadata.get('validated_at') else None
        },
        "statistics": {
            "fields_defined": fields_count,
            "mappings_defined": mappings_count,
            "rules_mappings": lane_stats.get('RULES', 0),
            "ai_mappings": lane_stats.get('AI', 0)
        }
    }


@router.delete("/auto-config/{configuration_id}")
async def delete_auto_config(
    configuration_id: str,
    db_service=Depends(get_db)
):
    """
    Delete an auto-generated configuration
    
    Only auto-generated configs can be deleted through this endpoint
    """
    
    # Check if configuration exists
    config = db_service.db['conversion_registry'].find_one({"_id": configuration_id})
    
    if not config:
        raise HTTPException(
            status_code=404,
            detail=f"Configuration {configuration_id} not found"
        )
    
    # Check if it's auto-generated
    if not config.get('metadata', {}).get('auto_generated'):
        raise HTTPException(
            status_code=400,
            detail="Only auto-generated configurations can be deleted through this endpoint"
        )
    
    # Check if it's been validated
    if config.get('metadata', {}).get('human_validated'):
        raise HTTPException(
            status_code=400,
            detail="Cannot delete a validated configuration. Reject it first if needed"
        )
    
    # Delete the configuration
    result = db_service.db['conversion_registry'].delete_one({"_id": configuration_id})
    
    if result.deleted_count > 0:
        logger.info(f"Deleted auto-generated configuration: {configuration_id}")
        return {
            "status": "success",
            "message": f"Configuration {configuration_id} deleted successfully"
        }
    else:
        raise HTTPException(
            status_code=500,
            detail="Failed to delete configuration"
        )