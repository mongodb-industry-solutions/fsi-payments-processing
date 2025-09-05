from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
from datetime import datetime, UTC
from db.mdb import MongoDBConnector
from pydantic import BaseModel, Field
from bson import ObjectId

router = APIRouter()
db = MongoDBConnector()


class RuleCreate(BaseModel):
    """Request model for creating a new rule"""
    source_field: str = Field(..., description="Source field identifier (e.g., '20', '32A')")
    target_field: str = Field(..., description="Target field identifier (e.g., 'MsgId', 'Amount')")
    transformation: str = Field(default="direct_copy", description="Transformation type")
    description: Optional[str] = Field(None, description="Rule description")
    mapping: Optional[Dict[str, str]] = Field(None, description="Value mapping for map_value transformation")
    prefix: Optional[str] = Field(None, description="Prefix for concatenate transformation")
    suffix: Optional[str] = Field(None, description="Suffix for concatenate transformation")
    value: Optional[str] = Field(None, description="Fixed value for fixed_value transformation")


class RuleUpdate(BaseModel):
    """Request model for updating a rule"""
    target_field: Optional[str] = None
    transformation: Optional[str] = None
    description: Optional[str] = None
    mapping: Optional[Dict[str, str]] = None
    is_active: Optional[bool] = None


class FieldRoutingCreate(BaseModel):
    """Request model for creating field routing"""
    field: str = Field(..., description="Field identifier")
    model: str = Field(..., description="Model to use: CLAUDE_HAIKU, CLAUDE_SONNET, or REGEX_FIRST")
    strategy: str = Field(..., description="Processing strategy")
    description: Optional[str] = Field(None, description="Field description")


@router.get("/")
async def list_all_rules(
    source_format: Optional[str] = Query(None, description="Filter by source format"),
    target_format: Optional[str] = Query(None, description="Filter by target format"),
    is_active: Optional[bool] = Query(True, description="Filter by active status")
) -> Dict[str, Any]:
    """List all conversion rules with optional filtering"""
    
    query = {}
    if source_format:
        query["source_format"] = source_format
    if target_format:
        query["target_format"] = target_format
    if is_active is not None:
        query["is_active"] = is_active
    
    rules_docs = db.find("conversion_rules", query)
    
    all_rules = []
    for doc in rules_docs:
        doc_info = {
            "id": str(doc.get("_id", "")),
            "source_format": doc.get("source_format"),
            "target_format": doc.get("target_format"),
            "rule_count": len(doc.get("rules", [])),
            "is_active": doc.get("is_active", True),
            "created_at": doc.get("created_at", ""),
            "updated_at": doc.get("updated_at", "")
        }
        all_rules.append(doc_info)
    
    return {
        "total": len(all_rules),
        "rules_sets": all_rules,
        "filters_applied": query
    }


@router.get("/{source_format}/{target_format}")
async def get_rules_for_pair(source_format: str, target_format: str) -> Dict[str, Any]:
    """Get all rules for a specific format pair"""
    
    rules_docs = db.find("conversion_rules", {
        "source_format": source_format,
        "target_format": target_format,
        "is_active": True
    })
    
    if not rules_docs:
        raise HTTPException(
            status_code=404,
            detail=f"No rules found for {source_format} → {target_format}"
        )
    
    doc = rules_docs[0]
    rules = doc.get("rules", [])
    
    # Categorize rules by transformation type
    rules_by_type = {}
    for rule in rules:
        transform = rule.get("transformation", "direct_copy")
        if transform not in rules_by_type:
            rules_by_type[transform] = []
        rules_by_type[transform].append(rule)
    
    # Get field routing to identify AI/Regex fields
    routing_docs = db.find("field_model_routing", {"source_format": source_format})
    ai_fields = set()
    regex_fields = set()
    
    if routing_docs:
        for strategy in routing_docs[0].get("field_strategies", []):
            if strategy["model"] == "REGEX_FIRST":
                regex_fields.add(strategy["field"])
            else:
                ai_fields.add(strategy["field"])
    
    return {
        "source_format": source_format,
        "target_format": target_format,
        "total_rules": len(rules),
        "rules": rules,
        "rules_by_transformation": rules_by_type,
        "ai_fields": list(ai_fields),
        "regex_fields": list(regex_fields),
        "created_at": doc.get("created_at", ""),
        "updated_at": doc.get("updated_at", ""),
        "mongodb_collection": "conversion_rules"
    }


@router.post("/{source_format}/{target_format}")
async def add_rule(
    source_format: str,
    target_format: str,
    rule: RuleCreate
) -> Dict[str, Any]:
    """Add a new rule to an existing format pair"""
    
    # Find existing rules document
    rules_docs = db.find("conversion_rules", {
        "source_format": source_format,
        "target_format": target_format
    })
    
    if not rules_docs:
        # Create new rules document if it doesn't exist
        new_doc = {
            "source_format": source_format,
            "target_format": target_format,
            "is_active": True,
            "rules": [],
            "created_at": datetime.now(UTC),
            "updated_at": datetime.now(UTC)
        }
        doc_id = db.insert_one("conversion_rules", new_doc)
        rules_docs = db.find("conversion_rules", {"_id": ObjectId(doc_id)})
    
    doc = rules_docs[0]
    
    # Create new rule
    new_rule = {
        "source_field": rule.source_field,
        "target_field": rule.target_field,
        "transformation": rule.transformation,
        "description": rule.description or f"{rule.source_field} to {rule.target_field}"
    }
    
    # Add optional fields based on transformation type
    if rule.transformation == "map_value" and rule.mapping:
        new_rule["mapping"] = rule.mapping
    elif rule.transformation == "concatenate":
        if rule.prefix:
            new_rule["prefix"] = rule.prefix
        if rule.suffix:
            new_rule["suffix"] = rule.suffix
    elif rule.transformation == "fixed_value" and rule.value:
        new_rule["value"] = rule.value
    
    # Add rule to document
    doc["rules"].append(new_rule)
    doc["updated_at"] = datetime.now(UTC)
    
    # Update in MongoDB
    db.update_one(
        "conversion_rules",
        {"_id": doc["_id"]},
        {"$set": {
            "rules": doc["rules"],
            "updated_at": doc["updated_at"]
        }}
    )
    
    return {
        "message": "Rule added successfully",
        "rule": new_rule,
        "total_rules": len(doc["rules"]),
        "source_format": source_format,
        "target_format": target_format
    }


@router.put("/{source_format}/{target_format}/{source_field}")
async def update_rule(
    source_format: str,
    target_format: str,
    source_field: str,
    rule_update: RuleUpdate
) -> Dict[str, Any]:
    """Update an existing rule"""
    
    # Find rules document
    rules_docs = db.find("conversion_rules", {
        "source_format": source_format,
        "target_format": target_format
    })
    
    if not rules_docs:
        raise HTTPException(
            status_code=404,
            detail=f"No rules found for {source_format} → {target_format}"
        )
    
    doc = rules_docs[0]
    rules = doc.get("rules", [])
    
    # Find and update the specific rule
    rule_found = False
    for i, rule in enumerate(rules):
        if rule.get("source_field") == source_field:
            rule_found = True
            # Update fields if provided
            if rule_update.target_field is not None:
                rule["target_field"] = rule_update.target_field
            if rule_update.transformation is not None:
                rule["transformation"] = rule_update.transformation
            if rule_update.description is not None:
                rule["description"] = rule_update.description
            if rule_update.mapping is not None:
                rule["mapping"] = rule_update.mapping
            rules[i] = rule
            break
    
    if not rule_found:
        raise HTTPException(
            status_code=404,
            detail=f"Rule for source field {source_field} not found"
        )
    
    # Update in MongoDB
    db.update_one(
        "conversion_rules",
        {"_id": doc["_id"]},
        {"$set": {
            "rules": rules,
            "updated_at": datetime.now(UTC)
        }}
    )
    
    return {
        "message": "Rule updated successfully",
        "source_field": source_field,
        "updated_rule": rule
    }


@router.delete("/{source_format}/{target_format}/{source_field}")
async def delete_rule(
    source_format: str,
    target_format: str,
    source_field: str
) -> Dict[str, Any]:
    """Delete a specific rule"""
    
    # Find rules document
    rules_docs = db.find("conversion_rules", {
        "source_format": source_format,
        "target_format": target_format
    })
    
    if not rules_docs:
        raise HTTPException(
            status_code=404,
            detail=f"No rules found for {source_format} → {target_format}"
        )
    
    doc = rules_docs[0]
    original_rules = doc.get("rules", [])
    
    # Filter out the rule to delete
    new_rules = [r for r in original_rules if r.get("source_field") != source_field]
    
    if len(new_rules) == len(original_rules):
        raise HTTPException(
            status_code=404,
            detail=f"Rule for source field {source_field} not found"
        )
    
    # Update in MongoDB
    db.update_one(
        "conversion_rules",
        {"_id": doc["_id"]},
        {"$set": {
            "rules": new_rules,
            "updated_at": datetime.now(UTC)
        }}
    )
    
    return {
        "message": "Rule deleted successfully",
        "source_field": source_field,
        "remaining_rules": len(new_rules)
    }


@router.get("/field-routing/{source_format}")
async def get_field_routing(source_format: str) -> Dict[str, Any]:
    """Get field routing configuration for a source format"""
    
    routing_docs = db.find("field_model_routing", {"source_format": source_format})
    
    if not routing_docs:
        raise HTTPException(
            status_code=404,
            detail=f"No field routing found for {source_format}"
        )
    
    doc = routing_docs[0]
    strategies = doc.get("field_strategies", [])
    
    # Categorize by model type
    ai_fields = []
    regex_fields = []
    
    for strategy in strategies:
        if strategy["model"] == "REGEX_FIRST":
            regex_fields.append(strategy)
        else:
            ai_fields.append(strategy)
    
    return {
        "source_format": source_format,
        "total_fields": len(strategies),
        "ai_fields": ai_fields,
        "regex_fields": regex_fields,
        "field_strategies": strategies,
        "created_at": doc.get("created_at", ""),
        "mongodb_collection": "field_model_routing"
    }


@router.post("/field-routing/{source_format}")
async def add_field_routing(
    source_format: str,
    routing: FieldRoutingCreate
) -> Dict[str, Any]:
    """Add or update field routing for a specific field"""
    
    # Find or create routing document
    routing_docs = db.find("field_model_routing", {"source_format": source_format})
    
    if not routing_docs:
        # Create new document
        new_doc = {
            "source_format": source_format,
            "field_strategies": [],
            "created_at": datetime.now(UTC)
        }
        doc_id = db.insert_one("field_model_routing", new_doc)
        routing_docs = db.find("field_model_routing", {"_id": ObjectId(doc_id)})
    
    doc = routing_docs[0]
    strategies = doc.get("field_strategies", [])
    
    # Check if field already exists
    existing_index = -1
    for i, strategy in enumerate(strategies):
        if strategy["field"] == routing.field:
            existing_index = i
            break
    
    # Create new strategy
    new_strategy = {
        "field": routing.field,
        "model": routing.model,
        "strategy": routing.strategy,
        "description": routing.description or f"Process {routing.field} field"
    }
    
    if existing_index >= 0:
        # Update existing
        strategies[existing_index] = new_strategy
        message = "Field routing updated"
    else:
        # Add new
        strategies.append(new_strategy)
        message = "Field routing added"
    
    # Update in MongoDB
    db.update_one(
        "field_model_routing",
        {"_id": doc["_id"]},
        {"$set": {
            "field_strategies": strategies,
            "updated_at": datetime.now(UTC)
        }}
    )
    
    return {
        "message": message,
        "field": routing.field,
        "model": routing.model,
        "strategy": routing.strategy,
        "total_fields": len(strategies)
    }


@router.get("/transformations")
async def list_transformation_types() -> Dict[str, Any]:
    """List all available transformation types and their descriptions"""
    
    transformations = [
        {
            "type": "direct_copy",
            "description": "Copy value without modification",
            "example": "20 → MsgId"
        },
        {
            "type": "map_value",
            "description": "Map specific values to new values",
            "example": "SHA → SHAR, OUR → DEBT, BEN → CRED",
            "requires": ["mapping"]
        },
        {
            "type": "parse_amount",
            "description": "Parse and format amount values",
            "example": "1000000,00 → 1000000.00"
        },
        {
            "type": "convert_date_format",
            "description": "Convert date formats",
            "example": "240315 → 2024-03-15"
        },
        {
            "type": "extract_reference",
            "description": "Extract and clean reference numbers",
            "example": "REF-123-ABC → REF123ABC"
        },
        {
            "type": "fixed_value",
            "description": "Set a fixed value regardless of input",
            "example": "Always set to 'INDA'",
            "requires": ["value"]
        },
        {
            "type": "concatenate",
            "description": "Add prefix/suffix to value",
            "example": "ABC → PREFIX-ABC-SUFFIX",
            "requires": ["prefix", "suffix"]
        },
        {
            "type": "current_timestamp",
            "description": "Set current timestamp",
            "example": "Sets to current ISO timestamp"
        }
    ]
    
    return {
        "available_transformations": transformations,
        "total": len(transformations)
    }


@router.get("/statistics")
async def get_rules_statistics() -> Dict[str, Any]:
    """Get statistics about rules and field routing"""
    
    # Get all conversion rules
    all_rules = db.find("conversion_rules", {})
    
    # Get all field routing
    all_routing = db.find("field_model_routing", {})
    
    # Calculate statistics
    total_rule_sets = len(all_rules)
    total_individual_rules = sum(len(doc.get("rules", [])) for doc in all_rules)
    
    # Count rules by transformation type
    transformation_counts = {}
    format_pairs = []
    
    for doc in all_rules:
        format_pair = f"{doc.get('source_format')} → {doc.get('target_format')}"
        format_pairs.append({
            "pair": format_pair,
            "rule_count": len(doc.get("rules", [])),
            "is_active": doc.get("is_active", True)
        })
        
        for rule in doc.get("rules", []):
            transform = rule.get("transformation", "direct_copy")
            transformation_counts[transform] = transformation_counts.get(transform, 0) + 1
    
    # Count field routing
    total_ai_fields = 0
    total_regex_fields = 0
    
    for doc in all_routing:
        for strategy in doc.get("field_strategies", []):
            if strategy["model"] == "REGEX_FIRST":
                total_regex_fields += 1
            else:
                total_ai_fields += 1
    
    return {
        "rules_summary": {
            "total_rule_sets": total_rule_sets,
            "total_individual_rules": total_individual_rules,
            "format_pairs": format_pairs,
            "rules_by_transformation": transformation_counts
        },
        "field_routing_summary": {
            "total_routing_configs": len(all_routing),
            "total_ai_fields": total_ai_fields,
            "total_regex_fields": total_regex_fields
        },
        "mongodb_collections": ["conversion_rules", "field_model_routing"],
        "generated_at": datetime.now(UTC)
    }