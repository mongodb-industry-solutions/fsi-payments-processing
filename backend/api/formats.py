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
    target_formats = db.find("target_formats", {"is_active": True})
    source_formats = db.find("source_formats", {"is_active": True})
    
    return {
        "source_formats": [
            {
                "format_code": fmt["format_code"],
                "format_name": fmt["format_name"],
                "version": fmt.get("version", "latest"),
                "description": fmt.get("description", "")
            }
            for fmt in source_formats
        ],
        "target_formats": [
            {
                "format_code": fmt["format_code"],
                "format_name": fmt["format_name"],
                "version": fmt.get("version", "latest"),
                "description": fmt.get("description", "")
            }
            for fmt in target_formats
        ]
    }


@router.get("/source/{format_code}")
async def get_source_format_details(format_code: str) -> Dict:
    """Get detailed information about a specific source format"""
    format_docs = db.find("source_formats", {"format_code": format_code})
    
    if not format_docs:
        raise HTTPException(status_code=404, detail=f"Source format {format_code} not found")
    
    format_doc = format_docs[0]
    
    # Get field routing information
    routing_docs = db.find("field_model_routing", {"source_format": format_code})
    field_strategies = []
    if routing_docs:
        field_strategies = routing_docs[0].get("field_strategies", [])
    
    # Categorize fields by processing lane
    ai_fields = []
    regex_fields = []
    for strategy in field_strategies:
        if strategy["model"] == "REGEX_FIRST":
            regex_fields.append({
                "field": strategy["field"],
                "description": strategy.get("description", "")
            })
        else:
            ai_fields.append({
                "field": strategy["field"],
                "model": strategy["model"],
                "description": strategy.get("description", "")
            })
    
    return {
        "format_code": format_doc["format_code"],
        "format_name": format_doc["format_name"],
        "version": format_doc.get("version", "latest"),
        "description": format_doc.get("description", ""),
        "is_active": format_doc.get("is_active", True),
        "processing_lanes": {
            "ai_fields": ai_fields,
            "regex_fields": regex_fields,
            "rules_fields": "All other fields use rules-based processing"
        },
        "created_at": format_doc.get("created_at", ""),
        "mongodb_collection": "source_formats"
    }


@router.get("/target/{format_code}")
async def get_target_format_details(format_code: str) -> Dict:
    """Get detailed information about a specific target format"""
    format_docs = db.find("target_formats", {"format_code": format_code})
    
    if not format_docs:
        raise HTTPException(status_code=404, detail=f"Target format {format_code} not found")
    
    format_doc = format_docs[0]
    
    # Get conversion rules to this target
    rules_docs = db.find("conversion_rules", {
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
        "format_name": format_doc["format_name"],
        "version": format_doc.get("version", "latest"),
        "description": format_doc.get("description", ""),
        "namespace": format_doc.get("namespace", ""),
        "is_active": format_doc.get("is_active", True),
        "available_conversions": available_conversions,
        "created_at": format_doc.get("created_at", ""),
        "mongodb_collection": "target_formats"
    }


@router.get("/mapping/{source_format}/{target_format}")
async def get_mapping_preview(source_format: str, target_format: str) -> Dict:
    """Preview the mapping rules between two formats
    
    Shows which fields will be mapped, how they'll be transformed,
    and which processing lane (Rules/AI/Regex) will handle each field.
    """
    
    # Get conversion rules
    rules_docs = db.find("conversion_rules", {
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
    
    # Get field routing for AI fields
    routing_docs = db.find("field_model_routing", {"source_format": source_format})
    ai_fields = set()
    regex_fields = set()
    field_strategies = {}
    
    if routing_docs:
        for strategy in routing_docs[0].get("field_strategies", []):
            field = strategy["field"]
            if strategy["model"] == "REGEX_FIRST":
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
            "conversion_rules",
            "field_model_routing"
        ],
        "created_at": rules_docs[0].get("created_at", datetime.now(UTC))
    }


@router.get("/capabilities")
async def get_system_capabilities() -> Dict:
    """Get overall system capabilities and statistics
    
    Returns information about what the system can do,
    available conversions, and processing statistics.
    """
    
    # Count documents in each collection
    source_count = len(db.find("source_formats", {"is_active": True}))
    target_count = len(db.find("target_formats", {"is_active": True}))
    rules_count = len(db.find("conversion_rules", {"is_active": True}))
    
    # Get all available conversion pairs
    conversion_pairs = []
    rules_docs = db.find("conversion_rules", {"is_active": True})
    for rule_doc in rules_docs:
        conversion_pairs.append({
            "from": rule_doc["source_format"],
            "to": rule_doc["target_format"],
            "rule_count": len(rule_doc.get("rules", []))
        })
    
    # Get processing statistics if available
    rules_ops = db.find("rules_operations", {})
    ai_ops = db.find("ai_operations", {})
    
    total_conversions = len(rules_ops) + len(ai_ops)
    
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
                "source_formats",
                "target_formats", 
                "conversion_rules",
                "field_model_routing",
                "prompt_templates",
                "rules_operations",
                "ai_operations",
                "builder_operations"
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