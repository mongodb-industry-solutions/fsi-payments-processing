"""
Auto-configuration API endpoints for intelligent converter
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from datetime import datetime
import logging
import os
import re

from ..services.db_service import get_mongodb_service as get_db_service
from ..services.semantic_learning_service_simplified import SimplifiedSemanticLearningService
from ..services.ai_service import get_bedrock_service as get_ai_service
from ..config.settings import get_settings
from ..services.auto_config_builder import AutoConfigBuilder
from ..services.schema_validator import SchemaValidator

router = APIRouter()
logger = logging.getLogger(__name__)

# Initialize the auto-config builder for demo scenarios
auto_config_builder = AutoConfigBuilder()

# Request model for fixing parser patterns
class FixParserRequest(BaseModel):
    """Request model for fixing parser patterns with ambiguous delimiters"""
    conversion_id: str  # e.g., "MT103_to_pacs.008"
    field_id: str  # e.g., "59" for beneficiary field
    sample_data: str  # The malformed data sample
    sender_bic: Optional[str] = None  # BIC to scope the rule
    detected_delimiter: Optional[str] = None  # Detected delimiter pattern (e.g., "///")

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
    detected_fields_detail: List[Dict[str, Any]] = []
    generation_metadata: Optional[Dict[str, Any]] = None
    generation_details: Optional[Dict[str, Any]] = None  # NEW: Detailed generation tracking


class ConfigValidation(BaseModel):
    """Model for configuration validation"""
    configuration_id: str
    configuration: Optional[Dict[str, Any]] = None  # Renamed from corrections for clarity
    approved: bool


class LearningTrigger(BaseModel):
    """Model for triggering learning"""
    force_refresh: bool = False  # Force re-learning even if patterns exist


@router.post("/auto-configure", response_model=AutoConfigResponse)
async def auto_configure(
    request: AutoConfigRequest,
    include_details: bool = Query(False, description="Include detailed generation tracking (LLM prompts, responses, timing)"),
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

    Query Parameters:
    - include_details: Set to true to get detailed generation tracking including:
      * Field extraction details (method, patterns used)
      * Mapping generation details (pattern vs LLM)
      * Full LLM call details (prompts, responses, reasoning, timing)
      * Processing statistics and breakdowns
    """
    
    start_time = datetime.utcnow()

    # Validate similar_to configuration exists
    base_config = None
    base_config_id = None

    if '_to_' in request.similar_to:
        # Exact config ID provided
        base_config_id = request.similar_to
        base_config = db_service.db['conversion_registry'].find_one({"_id": base_config_id})
    else:
        # Check if it's a format family prefix (e.g., "MT", "ISO")
        is_format_family = len(request.similar_to) <= 4 and request.similar_to.isupper()

        if is_format_family:
            # Search for configs matching format family prefix
            logger.info(f"'{request.similar_to}' detected as format family prefix, searching for configs like '{request.similar_to}*_to_{request.target_format}'")
            base_configs = list(db_service.db['conversion_registry'].find(
                {"_id": {"$regex": f"^{request.similar_to}.*_to_{request.target_format}$"}}
            ))

            if base_configs:
                base_config = base_configs[0]
                base_config_id = base_config['_id']
                logger.info(f"Using base config: {base_config_id} (from {len(base_configs)} matching configs)")
        else:
            # Construct specific config ID
            base_config_id = f"{request.similar_to}_to_{request.target_format}"
            base_config = db_service.db['conversion_registry'].find_one({"_id": base_config_id})

    if not base_config:
        # Provide helpful error with available configs
        available_configs = list(db_service.db['conversion_registry'].find({}, {"_id": 1}).limit(10))
        available_ids = [c['_id'] for c in available_configs]

        error_detail = f"Base configuration not found for similar_to='{request.similar_to}' and target_format='{request.target_format}'."
        if '_to_' not in request.similar_to:
            is_format_family = len(request.similar_to) <= 4 and request.similar_to.isupper()
            if is_format_family:
                error_detail += f" Searched for configs matching '{request.similar_to}*_to_{request.target_format}' but found none."
            else:
                error_detail += f" Looked for config '{request.similar_to}_to_{request.target_format}' but it doesn't exist."
        error_detail += f" Available configurations: {available_ids}"

        raise HTTPException(
            status_code=400,
            detail=error_detail
        )

    logger.info(f"Using base configuration: {base_config_id}")

    # Check if configuration already exists
    config_id = f"{request.source_format}_to_{request.target_format}"
    existing = db_service.db['conversion_registry'].find_one({"_id": config_id})
    if existing and not existing.get('metadata', {}).get('auto_generated'):
        raise HTTPException(
            status_code=400,
            detail=f"Configuration {config_id} already exists as a manual configuration"
        )

    # Initialize simplified learning service
    learning_service = SimplifiedSemanticLearningService(db_service, ai_service)

    # Check patterns exist with mappings (SimplifiedSemanticLearningService uses 'mappings', not 'learned_patterns')
    patterns_with_mappings = db_service.db['semantic_patterns'].count_documents({
        "mappings": {"$ne": {}, "$exists": True}
    })

    if patterns_with_mappings == 0:
        total_patterns = db_service.db['semantic_patterns'].count_documents({})
        if total_patterns == 0:
            error_msg = "No semantic patterns found. Run: cd backend/converter_service && uv run python scripts/populate_semantic_patterns.py"
        else:
            error_msg = f"Found {total_patterns} semantic patterns but none have mappings. Run: cd backend/converter_service && uv run python scripts/populate_semantic_patterns.py"

        raise HTTPException(
            status_code=400,
            detail=error_msg
        )

    logger.info(f"Found {patterns_with_mappings} semantic patterns with mappings")
    
    try:
        # Generate configuration
        logger.info(f"Generating configuration for {request.source_format} to {request.target_format}")
        logger.info(f"Include detailed tracking: {include_details}")

        config = learning_service.generate_config(
            source_format=request.source_format,
            target_format=request.target_format,
            sample_message=request.sample_message,
            similar_to=request.similar_to,
            include_details=include_details
        )

        # Extract generation metadata from config (simplified service puts it in metadata)
        generation_metadata = config.get('metadata', {})

        # Extract generation_details for API response (should NOT be saved to DB)
        generation_details_for_response = config.pop('generation_details', None)

        # Save to pending collection for testing (users can test before approval)
        config['metadata']['status'] = 'pending_approval'
        config['metadata']['saved_to_pending_at'] = datetime.utcnow()

        db_service.db['pending_auto_configs'].replace_one(
            {"_id": config['_id']},
            config,
            upsert=True
        )

        logger.info(f"Saved config to pending_auto_configs: {config['_id']}")

        # Use the generated config for statistics
        fields_detected = len(config.get('parser', {}).get('fields', {}))
        fields_mapped = len(config.get('mappings', []))

        # Extract detailed field information from parser config
        detected_fields_detail = []
        for field_id, field_config in config.get('parser', {}).get('fields', {}).items():
            detected_fields_detail.append({
                'field_id': field_id,
                'name': field_config.get('name', field_id),
                'pattern': field_config.get('pattern', ''),
                'multiline': field_config.get('multiline', False),
                'components': field_config.get('components')
            })

        # Identify uncertain fields (confidence < 0.8)
        uncertain_fields = []
        for mapping in config.get('mappings', []):
            confidence = mapping.get('confidence', 1.0)
            if confidence < 0.8:
                uncertain_fields.append({
                    'field': mapping['source'],
                    'confidence': confidence,
                    'targets': mapping['targets'],
                    'reason': 'Low confidence mapping'
                })

        # Check if ready to save (has minimum required mappings)
        ready_to_save = fields_mapped > 0 and config['metadata'].get('confidence', 0) > 0.5

        # Calculate generation time
        generation_time = (datetime.utcnow() - start_time).total_seconds()

        logger.info(f"Configuration generated successfully: {config['_id']}")

        # Convert datetime objects to strings for JSON serialization
        clean_config = _clean_config_for_response(config)

        return AutoConfigResponse(
            configuration_id=config['_id'],
            configuration=clean_config,
            confidence=config['metadata'].get('confidence', 0),
            fields_detected=fields_detected,
            fields_mapped=fields_mapped,
            uncertain_fields=uncertain_fields,
            generation_time_seconds=generation_time,
            ready_to_save=ready_to_save,
            detected_fields_detail=detected_fields_detail,
            generation_metadata=generation_metadata,
            generation_details=generation_details_for_response if include_details else None
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
    Get all semantic patterns (SimplifiedSemanticLearningService structure)

    Returns list of all semantic patterns with mappings for different formats.
    Each pattern represents a semantic concept (e.g., transaction_reference, value_date)
    and contains mappings showing how it appears in different payment formats.
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

    # Calculate summary statistics based on NEW structure (mappings)
    formats_learned = set()
    total_mappings = 0

    for p in patterns:
        mappings = p.get('mappings', {})
        formats_learned.update(mappings.keys())
        total_mappings += len(mappings)

    return {
        "total_patterns": len(patterns),
        "patterns": patterns,
        "summary": {
            "formats_learned": sorted(list(formats_learned)),
            "total_mappings": total_mappings,
            "avg_mappings_per_pattern": round(total_mappings / len(patterns), 2) if patterns else 0
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

    This endpoint allows human review and approval of auto-generated configs.
    If approved=true, saves the configuration to the database.
    If approved=false, the configuration is not saved.
    """

    # For approval, we need the full config passed in configuration field
    if validation.approved:
        if not validation.configuration:
            raise HTTPException(
                status_code=400,
                detail="Configuration data required for approval"
            )

        # Save the approved configuration
        config = validation.configuration
        config['_id'] = validation.configuration_id

        # Ensure metadata indicates it's auto-generated and now approved
        if 'metadata' not in config:
            config['metadata'] = {}
        config['metadata']['auto_generated'] = True
        config['metadata']['approved'] = True
        config['metadata']['approved_at'] = datetime.utcnow()
        config['metadata']['status'] = 'approved'

        # Move from pending to production registry
        db_service.db['conversion_registry'].replace_one(
            {"_id": config['_id']},
            config,
            upsert=True
        )

        # Remove from pending collection (cleanup)
        db_service.db['pending_auto_configs'].delete_one({"_id": config['_id']})

        logger.info(f"Configuration {config['_id']} approved and saved")

        return {
            "status": "approved",
            "configuration_id": config['_id'],
            "message": "Configuration approved and saved successfully"
        }
    else:
        # Configuration rejected - don't save anything
        logger.info(f"Configuration {validation.configuration_id} rejected")

        return {
            "status": "rejected",
            "configuration_id": validation.configuration_id,
            "message": "Configuration rejected and not saved"
        }


@router.post("/validate-schema")
async def validate_schema(
    request: Dict[str, Any],
    db_service=Depends(get_db)
):
    """
    Validate configuration against MongoDB schema

    This endpoint validates the structure and content of a configuration
    without saving it. Use this before saving to catch errors early.

    Request body:
    {
        "configuration": {...}  // The config to validate
    }

    Returns:
    {
        "valid": true|false,
        "score": 0-100,
        "checks": [
            {
                "name": "Required Fields",
                "status": "passed|warning|failed",
                "details": "...",
                "icon": "📋",
                "errors": [...]
            }
        ],
        "errors": [...],
        "warnings": [...]
    }
    """
    try:
        configuration = request.get("configuration")
        if not configuration:
            raise HTTPException(
                status_code=400,
                detail="Configuration is required in request body"
            )

        # Use the new schema validator
        schema_validator = SchemaValidator()

        # Get validation result in frontend format
        result = schema_validator.validate(configuration, return_frontend_format=True)

        # Log the validation result
        logger.info(f"Schema validation complete: valid={result.get('valid')}, score={result.get('score')}")

        return result

    except Exception as e:
        logger.error(f"Schema validation error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Validation failed: {str(e)}"
        )


@router.post("/save-validated-config")
async def save_validated_config(
    request: Dict[str, Any],
    db_service=Depends(get_db)
):
    """
    Validate and save configuration to production registry

    This endpoint:
    1. Validates the configuration
    2. If valid, saves to conversion_registry
    3. Removes from pending_auto_configs
    4. Adds metadata (validated_at, approved, etc.)

    Request body:
    {
        "configuration": {...},
        "force": false  // Set to true to save even with warnings
    }

    Returns:
    {
        "success": true|false,
        "configuration_id": "...",
        "validation": {...},
        "message": "..."
    }
    """
    try:
        configuration = request.get("configuration")
        force = request.get("force", False)

        if not configuration:
            raise HTTPException(
                status_code=400,
                detail="Configuration is required"
            )

        # Validate using schema validator
        schema_validator = SchemaValidator()
        validation_result = schema_validator.validate(configuration, return_frontend_format=False)

        # Check if valid (or force save)
        if not validation_result['valid'] and not force:
            return {
                "success": False,
                "configuration_id": configuration.get("_id"),
                "validation": validation_result,
                "message": f"Validation failed with score {validation_result.get('score', 0)}%. Fix errors or use force=true to save anyway."
            }

        # Add validation metadata
        config_id = configuration["_id"]

        if "metadata" not in configuration:
            configuration["metadata"] = {}

        configuration["metadata"]["validated_at"] = datetime.utcnow()
        configuration["metadata"]["approved"] = True
        configuration["metadata"]["validation_score"] = validation_result.get('score', 100)
        configuration["metadata"]["status"] = "approved"

        # Save to production registry
        db_service.db['conversion_registry'].replace_one(
            {"_id": config_id},
            configuration,
            upsert=True
        )

        # Remove from pending
        db_service.db['pending_auto_configs'].delete_one({"_id": config_id})

        logger.info(f"Configuration {config_id} saved to production registry (score: {validation_result.get('score', 100)}%)")

        return {
            "success": True,
            "configuration_id": config_id,
            "validation": validation_result,
            "message": f"Configuration saved successfully with validation score {validation_result.get('score', 100)}%"
        }

    except Exception as e:
        logger.error(f"Error saving validated config: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save configuration: {str(e)}"
        )


@router.post("/update-config-field")
async def update_config_field(
    request: Dict[str, Any],
    db_service=Depends(get_db)
):
    """
    Update a specific field in a configuration

    This endpoint allows updating individual fields without sending
    the entire configuration. Useful for inline error corrections.

    Request body:
    {
        "configuration_id": "MT192_to_pacs.008",
        "field_path": "parser.type",
        "value": "regex"
    }

    Returns:
    {
        "success": true,
        "updated_configuration": {...},
        "validation": {...}  // Auto-validates after update
    }
    """
    try:
        config_id = request.get("configuration_id")
        field_path = request.get("field_path")
        value = request.get("value")

        if not all([config_id, field_path, value is not None]):
            raise HTTPException(
                status_code=400,
                detail="configuration_id, field_path, and value are required"
            )

        # Fetch config from pending
        config = db_service.db['pending_auto_configs'].find_one({"_id": config_id})

        if not config:
            raise HTTPException(
                status_code=404,
                detail=f"Configuration {config_id} not found in pending configs"
            )

        # Update field using dot notation path
        path_parts = field_path.split(".")
        current = config

        # Navigate to parent
        for part in path_parts[:-1]:
            if part not in current:
                current[part] = {}
            current = current[part]

        # Set value
        current[path_parts[-1]] = value

        # Save updated config using $set to avoid _id immutability error
        # Remove _id from config before updating
        config_without_id = {k: v for k, v in config.items() if k != '_id'}
        db_service.db['pending_auto_configs'].update_one(
            {"_id": config_id},
            {"$set": config_without_id}
        )

        # Auto-validate using schema validator
        schema_validator = SchemaValidator()
        validation_result = schema_validator.validate(config, return_frontend_format=False)

        logger.info(f"Updated {field_path} in {config_id}, new validation score: {validation_result.get('score', 100)}%")

        return {
            "success": True,
            "updated_configuration": _clean_config_for_response(config),
            "validation": validation_result
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating config field: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update field: {str(e)}"
        )


@router.post("/learn")
async def trigger_learning(
    request: LearningTrigger = LearningTrigger(),
    db_service=Depends(get_db),
    ai_service=Depends(get_ai_service)
):
    """
    ⚠️ DEPRECATED: This endpoint is deprecated and will be removed in a future version.

    The SimplifiedSemanticLearningService uses pre-defined seed patterns stored
    in the semantic_patterns collection. Dynamic learning from configurations is
    no longer needed.

    To populate semantic patterns, use the script:
    `cd backend/converter_service && uv run python scripts/populate_semantic_patterns.py`

    This endpoint now returns the current pattern statistics without modification.
    """

    # Return current pattern statistics
    patterns = list(db_service.db['semantic_patterns'].find({}, {"_id": 1, "mappings": 1}))

    formats_learned = set()
    total_mappings = 0

    for p in patterns:
        mappings = p.get('mappings', {})
        formats_learned.update(mappings.keys())
        total_mappings += len(mappings)

    logger.warning("DEPRECATED: /learn endpoint called. This endpoint is deprecated. Use populate_semantic_patterns.py script instead.")

    return {
        "status": "deprecated",
        "message": "⚠️ This endpoint is deprecated. SimplifiedSemanticLearningService uses static seed patterns. Use: uv run python scripts/populate_semantic_patterns.py",
        "current_patterns": {
            "total_patterns": len(patterns),
            "formats_learned": sorted(list(formats_learned)),
            "total_mappings": total_mappings
        },
        "recommendation": "To update patterns, modify and run scripts/populate_semantic_patterns.py"
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


# ============================================================================
# DEMO ENDPOINTS FOR AUTO-CONFIGURATION UI
# ============================================================================

@router.get("/demo/scenarios")
async def get_demo_scenarios():
    """
    Get list of available auto-config demo scenarios

    Returns pre-configured scenarios with sample messages for common formats
    like MT192, MT205, MT202COV, etc.
    """
    try:
        scenarios = auto_config_builder.get_scenarios_list()
        return {
            "scenarios": scenarios,
            "total": len(scenarios)
        }
    except Exception as e:
        logger.error(f"Error getting demo scenarios: {e}")
        raise HTTPException(status_code=500, detail="Failed to load demo scenarios")


@router.get("/demo/scenarios/{scenario_id}/form")
async def get_scenario_form(
    scenario_id: str,
    include_values: bool = True
):
    """
    Get form schema for a specific auto-config scenario

    Args:
        scenario_id: Scenario identifier (e.g., 'mt192_to_pacs008')
        include_values: Whether to include pre-filled demo values

    Returns:
        Form schema with field definitions and optional demo values
    """
    form_schema = auto_config_builder.get_form_schema(
        scenario_id,
        include_demo_values=include_values
    )

    if not form_schema:
        raise HTTPException(
            status_code=404,
            detail=f"Scenario '{scenario_id}' not found"
        )

    return form_schema


@router.get("/demo/presets")
async def get_demo_presets():
    """
    Get quick demo presets for auto-configuration

    Returns pre-selected scenarios optimized for different demo purposes
    (e.g., fastest, most complex, highest confidence)
    """
    return {
        "presets": auto_config_builder.get_demo_presets()
    }


@router.post("/demo/scenarios/{scenario_id}/sample-message")
async def generate_sample_message(
    scenario_id: str,
    form_data: Dict[str, Any]
):
    """
    Generate a sample message from user-provided form data

    This endpoint takes form values and generates a properly formatted
    sample message for auto-configuration.
    """
    # Validate form data
    validation_result = auto_config_builder.validate_form_data(scenario_id, form_data)

    if not validation_result['valid']:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Form validation failed",
                "errors": validation_result['errors']
            }
        )

    # Generate sample message
    result = auto_config_builder.get_sample_message(scenario_id, form_data)

    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"Scenario '{scenario_id}' not found"
        )

    return result


class DemoAutoConfigRequest(BaseModel):
    """Request model for demo auto-configuration"""
    scenario_id: str
    form_data: Dict[str, Any]
    execute_immediately: bool = True  # Whether to run auto-config immediately


@router.post("/demo/execute-auto-config")
async def execute_demo_auto_config(
    request: DemoAutoConfigRequest,
    db_service=Depends(get_db),
    ai_service=Depends(get_ai_service)
):
    """
    Execute auto-configuration with demo scenario data

    This endpoint:
    1. Validates the form data
    2. Generates a sample message
    3. Executes auto-configuration
    4. Returns the generated configuration
    """

    # Get scenario details
    scenario = auto_config_builder.get_scenario(request.scenario_id)
    if not scenario:
        raise HTTPException(
            status_code=404,
            detail=f"Scenario '{request.scenario_id}' not found"
        )

    # Validate form data
    validation_result = auto_config_builder.validate_form_data(
        request.scenario_id,
        request.form_data
    )

    if not validation_result['valid']:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Form validation failed",
                "errors": validation_result['errors']
            }
        )

    # Generate sample message
    message_result = auto_config_builder.get_sample_message(
        request.scenario_id,
        request.form_data
    )

    if not message_result:
        raise HTTPException(
            status_code=500,
            detail="Failed to generate sample message"
        )

    # Execute auto-configuration if requested
    if request.execute_immediately:
        # Create auto-config request
        auto_config_request = AutoConfigRequest(
            source_format=scenario['source_format'],
            target_format=scenario['target_format'],
            sample_message=message_result['sample_message'],
            similar_to=scenario['similar_to']
        )

        # Use existing auto_configure endpoint logic
        return await auto_configure(auto_config_request, db_service, ai_service)
    else:
        # Just return the prepared data without executing
        return {
            "scenario_id": request.scenario_id,
            "source_format": scenario['source_format'],
            "target_format": scenario['target_format'],
            "sample_message": message_result['sample_message'],
            "similar_to": scenario['similar_to'],
            "ready_to_execute": True,
            "metadata": message_result['metadata']
        }


@router.get("/demo/statistics")
async def get_demo_statistics():
    """
    Get statistics about auto-configuration demo

    Returns metrics and statistics for dashboard display
    """
    return auto_config_builder.get_demo_statistics()


@router.get("/demo/scenarios/{scenario_id}/metadata")
async def get_scenario_metadata(scenario_id: str):
    """
    Get metadata and expectations for a scenario

    Returns expected confidence, field counts, and showcase features
    """
    metadata = auto_config_builder.get_configuration_metadata(scenario_id)

    if not metadata:
        raise HTTPException(
            status_code=404,
            detail=f"Scenario '{scenario_id}' not found"
        )

    return metadata


@router.post("/fix-parser-pattern")
async def fix_parser_pattern(
    request: FixParserRequest,
    db_service=Depends(get_db),
    ai_service=Depends(get_ai_service)
):
    """
    Fix parser pattern for a field with ambiguous party information

    This endpoint demonstrates MongoDB's dynamic schema discovery by:
    1. Detecting non-standard delimiters in payment fields
    2. Creating BIC-specific parser rules
    3. Storing rules as JSON documents in MongoDB
    4. Enabling self-healing payment processing
    """
    try:
        # Fetch the existing configuration
        config = db_service.db['conversion_registry'].find_one({"_id": request.conversion_id})

        if not config:
            raise HTTPException(
                status_code=404,
                detail=f"Configuration {request.conversion_id} not found"
            )

        # Analyze the sample data to detect pattern
        delimiter = request.detected_delimiter
        if not delimiter:
            # Auto-detect delimiter pattern
            if "///" in request.sample_data:
                delimiter = "///"
            elif "||" in request.sample_data:
                delimiter = "||"
            elif "~~" in request.sample_data:
                delimiter = "~~"
            else:
                delimiter = "\n"  # Default to newline

        logger.info(f"Detected delimiter '{delimiter}' in field {request.field_id}")

        # Create a new parser pattern for the problematic field
        field_config = config.get('parser', {}).get('fields', {}).get(request.field_id, {})
        original_pattern = field_config.get('pattern', '')

        # Modify pattern to handle the new delimiter
        if delimiter == "///":
            new_pattern = f":{{request.field_id}}:([^:]+(?:{delimiter}[^:]+)*)"
        else:
            new_pattern = original_pattern.replace(r'\n', f'(?:\n|{re.escape(delimiter)})')

        # Store BIC-specific override in metadata
        if 'metadata' not in config:
            config['metadata'] = {}

        if 'bic_overrides' not in config['metadata']:
            config['metadata']['bic_overrides'] = {}

        # Create BIC-specific rule
        bic_rule = {
            'field_id': request.field_id,
            'pattern': new_pattern,
            'delimiter': delimiter,
            'created_at': datetime.utcnow().isoformat(),
            'created_by': 'LLM_Resolution_Agent',
            'confidence': 0.95,
            'sample_data': request.sample_data[:100]  # Store sample for reference
        }

        # Store rule scoped to BIC if provided
        if request.sender_bic:
            config['metadata']['bic_overrides'][request.sender_bic] = bic_rule
            logger.info(f"Created BIC-specific rule for {request.sender_bic}")
        else:
            # Apply globally if no BIC specified
            config['parser']['fields'][request.field_id]['pattern'] = new_pattern
            config['parser']['fields'][request.field_id]['delimiter_variants'] = [delimiter]
            logger.info(f"Updated global pattern for field {request.field_id}")

        # Add self-healing metadata
        config['metadata']['self_healing_applied'] = True
        config['metadata']['last_self_heal'] = datetime.utcnow().isoformat()

        # Save the updated configuration
        db_service.db['conversion_registry'].replace_one(
            {"_id": request.conversion_id},
            config
        )

        # Log to a separate collection for audit trail
        db_service.db['dynamic_parsing_rules'].insert_one({
            'conversion_id': request.conversion_id,
            'field_id': request.field_id,
            'sender_bic': request.sender_bic,
            'delimiter': delimiter,
            'pattern': new_pattern,
            'sample_data': request.sample_data,
            'created_at': datetime.utcnow(),
            'status': 'active'
        })

        return {
            'success': True,
            'conversion_id': request.conversion_id,
            'field_id': request.field_id,
            'sender_bic': request.sender_bic,
            'delimiter_detected': delimiter,
            'new_pattern': new_pattern,
            'rule_scope': 'BIC-specific' if request.sender_bic else 'Global',
            'message': f"Successfully created {('BIC-specific' if request.sender_bic else 'global')} parsing rule for field {request.field_id}",
            'mongodb_showcase': {
                'schema_flexibility': 'Stored complex parsing rule as JSON document',
                'bic_scoping': f'Rule applies only to {request.sender_bic}' if request.sender_bic else 'Global rule',
                'self_healing': 'System can now process similar malformed data automatically'
            }
        }

    except Exception as e:
        logger.error(f"Error fixing parser pattern: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fix parser pattern: {str(e)}"
        )