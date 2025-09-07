from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from db.mdb import MongoDBConnector
from datetime import datetime, UTC

router = APIRouter()
db = MongoDBConnector()


@router.get("/")
async def list_formats() -> Dict[str, List[Dict]]:
    """List all available target formats
    
    Returns both source and target formats available in the system.
    This helps users understand what conversions are possible.
    """
    # Use unified formats collection
    all_formats = db.find("formats", {"is_active": True})
    
    source_formats = [fmt for fmt in all_formats if fmt.get("type") == "source"]
    target_formats = [fmt for fmt in all_formats if fmt.get("type") == "target"]
    
    return {
        "source_formats": [
            {
                "format_code": fmt["format_code"],
                "format_name": fmt.get("name", fmt["format_code"]),  # Changed from format_name to name
                "version": fmt.get("metadata", {}).get("version", "latest"),
                "description": fmt.get("description", "")
            }
            for fmt in source_formats
        ],
        "target_formats": [
            {
                "format_code": fmt["format_code"],
                "format_name": fmt.get("name", fmt["format_code"]),  # Changed from format_name to name
                "version": fmt.get("metadata", {}).get("version", "latest"),
                "description": fmt.get("description", "")
            }
            for fmt in target_formats
        ]
    }


@router.get("/source/{format_code}")
async def get_source_format_details(format_code: str) -> Dict:
    """Get detailed information about a specific source format"""
    format_docs = db.find("formats", {"format_code": format_code, "type": "source"})
    
    if not format_docs:
        raise HTTPException(status_code=404, detail=f"Source format {format_code} not found")
    
    format_doc = format_docs[0]
    
    # Get field routing information from conversion_configs
    config_docs = db.find("conversion_configs", {"source_format": format_code})
    field_strategies = []
    if config_docs:
        # Extract AI fields from conversion config
        ai_fields = config_docs[0].get("ai_fields", [])
        field_strategies = ai_fields
    
    # Categorize fields by processing lane
    ai_fields = []
    regex_fields = []
    for strategy in field_strategies:
        if strategy.get("model") == "REGEX_FIRST":
            regex_fields.append({
                "field": strategy["field"],
                "description": strategy.get("description", "")
            })
        else:
            ai_fields.append({
                "field": strategy["field"],
                "model": strategy.get("model", "CLAUDE_HAIKU"),
                "description": strategy.get("description", "")
            })
    
    return {
        "format_code": format_doc["format_code"],
        "format_name": format_doc.get("name", format_doc["format_code"]),  # Changed from format_name to name
        "version": format_doc.get("metadata", {}).get("version", "latest"),
        "description": format_doc.get("description", ""),
        "is_active": format_doc.get("is_active", True),
        "processing_lanes": {
            "ai_fields": ai_fields,
            "regex_fields": regex_fields,
            "rules_fields": "All other fields use rules-based processing"
        },
        "created_at": format_doc.get("metadata", {}).get("migrated_at", ""),
        "mongodb_collection": "formats"
    }


@router.get("/target/{format_code}")
async def get_target_format_details(format_code: str) -> Dict:
    """Get detailed information about a specific target format"""
    format_docs = db.find("formats", {"format_code": format_code, "type": "target"})
    
    if not format_docs:
        raise HTTPException(status_code=404, detail=f"Target format {format_code} not found")
    
    format_doc = format_docs[0]
    
    # Get conversion rules to this target from conversion_configs
    rules_docs = db.find("conversion_configs", {
        "target_format": format_code,
        "is_active": True
    })
    
    available_conversions = []
    for rule_doc in rules_docs:
        available_conversions.append({
            "from_format": rule_doc["source_format"],
            "rule_count": len(rule_doc.get("rules", [])),
            "created_at": rule_doc.get("created_at", "")
        })
    
    return {
        "format_code": format_doc["format_code"],
        "format_name": format_doc.get("name", format_doc["format_code"]),  # Changed from format_name to name
        "version": format_doc.get("metadata", {}).get("version", "latest"),
        "description": format_doc.get("description", ""),
        "namespace": format_doc.get("metadata", {}).get("xml_namespace", ""),
        "is_active": format_doc.get("is_active", True),
        "available_conversions": available_conversions,
        "created_at": format_doc.get("metadata", {}).get("migrated_at", ""),
        "mongodb_collection": "formats"
    }


@router.get("/mapping/{source_format}/{target_format}")
async def get_mapping_preview(source_format: str, target_format: str) -> Dict:
    """Preview the mapping rules between two formats
    
    Shows which fields will be mapped, how they'll be transformed,
    and which processing lane (Rules/AI/Regex) will handle each field.
    """
    
    # Get conversion rules from conversion_configs
    rules_docs = db.find("conversion_configs", {
        "source_format": source_format,
        "target_format": target_format,
        "is_active": True
    })
    
    if not rules_docs:
        raise HTTPException(
            status_code=404, 
            detail=f"No conversion rules found for {source_format} → {target_format}"
        )
    
    rules = rules_docs[0].get("rules", [])
    
    # Get field routing for AI fields from conversion_configs
    ai_fields = set()
    regex_fields = set()
    field_strategies = {}
    
    if rules_docs:
        for strategy in rules_docs[0].get("ai_fields", []):
            field = strategy["field"]
            if strategy.get("model") == "REGEX_FIRST":
                regex_fields.add(field)
            else:
                ai_fields.add(field)
            field_strategies[field] = strategy
    
    # Categorize mappings by processing lane
    rules_mappings = []
    ai_mappings = []
    regex_mappings = []
    
    # Process rules-based mappings
    for rule in rules:
        source_field = rule.get("source_field")
        if source_field not in ai_fields and source_field not in regex_fields:
            rules_mappings.append({
                "source_field": source_field,
                "target_field": rule.get("target_field"),
                "transformation": rule.get("transformation", "direct_copy"),
                "description": rule.get("description", "")
            })
    
    # Add AI field mappings
    for field in ai_fields:
        strategy = field_strategies.get(field, {})
        ai_mappings.append({
            "source_field": field,
            "model": strategy.get("model", "CLAUDE_HAIKU"),
            "strategy": strategy.get("strategy", ""),
            "description": strategy.get("description", ""),
            "estimated_cost": "$0.00025" if "HAIKU" in strategy.get("model", "") else "$0.00150"
        })
    
    # Add Regex field mappings
    for field in regex_fields:
        strategy = field_strategies.get(field, {})
        regex_mappings.append({
            "source_field": field,
            "strategy": strategy.get("strategy", ""),
            "description": strategy.get("description", "")
        })
    
    # Calculate statistics
    total_fields = len(rules_mappings) + len(ai_mappings) + len(regex_mappings)
    estimated_ai_cost = len([m for m in ai_mappings if "HAIKU" in m.get("model", "")]) * 0.00025
    estimated_ai_cost += len([m for m in ai_mappings if "SONNET" in m.get("model", "")]) * 0.00150
    
    return {
        "source_format": source_format,
        "target_format": target_format,
        "mapping_summary": {
            "total_fields": total_fields,
            "rules_fields": len(rules_mappings),
            "ai_fields": len(ai_mappings),
            "regex_fields": len(regex_mappings),
            "estimated_ai_cost_per_message": f"${estimated_ai_cost:.5f}"
        },
        "processing_lanes": {
            "rules": {
                "description": "Deterministic field mappings with 100% confidence",
                "fields": rules_mappings
            },
            "ai": {
                "description": "AI-powered extraction for unstructured fields",
                "fields": ai_mappings
            },
            "regex": {
                "description": "Pattern-based extraction for semi-structured fields",
                "fields": regex_mappings
            }
        },
        "mongodb_collections_used": [
            "conversion_configs"
        ],
        "created_at": rules_docs[0].get("created_at", datetime.now(UTC))
    }


@router.get("/capabilities")
async def get_system_capabilities() -> Dict:
    """Get overall system capabilities and statistics
    
    Returns information about what the system can do,
    available conversions, and processing statistics.
    """
    
    # Count documents in unified formats collection
    all_formats = db.find("formats", {"is_active": True})
    source_count = len([f for f in all_formats if f.get("type") == "source"])
    target_count = len([f for f in all_formats if f.get("type") == "target"])
    rules_count = len(db.find("conversion_configs", {"is_active": True}))
    
    # Get all available conversion pairs
    conversion_pairs = []
    rules_docs = db.find("conversion_configs", {"is_active": True})
    for rule_doc in rules_docs:
        conversion_pairs.append({
            "from": rule_doc["source_format"],
            "to": rule_doc["target_format"],
            "rule_count": len(rule_doc.get("rules", []))
        })
    
    # Processing statistics not tracked in demo
    total_conversions = 0
    
    return {
        "system_name": "Generic Payment Format Converter",
        "version": "1.0.0",
        "demo_implementation": "MT103 → pacs.008",
        "capabilities": {
            "source_formats_supported": source_count,
            "target_formats_supported": target_count,
            "conversion_rules_configured": rules_count,
            "available_conversions": conversion_pairs
        },
        "processing_architecture": {
            "lanes": ["Rules Engine", "AI Processing", "Regex Extraction"],
            "ai_models": {
                "CLAUDE_HAIKU": "Cost-optimized for simple extractions ($0.00025/call)",
                "CLAUDE_SONNET": "Accuracy-optimized for complex fields ($0.00150/call)"
            },
            "confidence_tracking": "Yes",
            "cost_tracking": "Yes",
            "mongodb_integrated": "Yes"
        },
        "statistics": {
            "total_conversions_processed": total_conversions,
            "mongodb_collections": [
                "formats",  # Unified collection for source and target formats
                "conversion_configs",  # Unified conversion configurations
                "conversions",  # Conversion history
                "format_processors"  # Parser and builder configs
            ]
        },
        "api_endpoints": {
            "formats": {
                "GET /formats/": "List all formats",
                "GET /formats/source/{code}": "Get source format details",
                "GET /formats/target/{code}": "Get target format details",
                "GET /formats/mapping/{source}/{target}": "Preview field mappings",
                "GET /formats/capabilities": "System capabilities"
            }
        }
    }