from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, List, Optional
from datetime import datetime, UTC
from db.mdb import MongoDBConnector
from utils.parsers.mt103_parser import MT103Parser
from pathlib import Path
import json
from pydantic import BaseModel

router = APIRouter()
db = MongoDBConnector()


class ParseRequest(BaseModel):
    """Request model for parsing input"""
    content: Optional[str] = None
    sample_id: Optional[str] = None  # ID of a sample from database


@router.post("/parse/{format_type}")
async def parse_input_format(
    format_type: str,
    request: ParseRequest
) -> Dict[str, Any]:
    """Parse an input format and display field breakdown
    
    Users can either:
    1. Paste content directly in the 'content' field
    2. Select a sample by ID from the database using 'sample_id'
    
    Shows which fields were extracted and their processing lanes.
    """
    
    # Get content from either direct input or database sample
    content = request.content
    
    if request.sample_id and not content:
        # Load sample from database
        sample = db.find("sample_messages", {"_id": request.sample_id})
        if not sample:
            raise HTTPException(status_code=404, detail=f"Sample {request.sample_id} not found")
        content = sample[0].get("content", "")
    
    if not content:
        raise HTTPException(status_code=400, detail="Either content or sample_id must be provided")
    
    # Currently only MT103 is implemented
    if format_type.upper() != "MT103":
        raise HTTPException(
            status_code=400,
            detail=f"Format {format_type} parsing not yet implemented. Only MT103 is supported."
        )
    
    try:
        # Parse the message
        parser = MT103Parser(db)
        result = parser.parse_with_metadata(content)
        
        # Get field routing information for display
        routing_docs = db.find("field_model_routing", {"source_format": "MT103"})
        ai_fields = set()
        regex_fields = set()
        
        if routing_docs:
            for strategy in routing_docs[0].get("field_strategies", []):
                if strategy["model"] == "REGEX_FIRST":
                    regex_fields.add(strategy["field"])
                else:
                    ai_fields.add(strategy["field"])
        
        # Categorize parsed fields by processing lane
        fields_by_lane = {
            "rules": [],
            "ai": [],
            "regex": [],
            "unknown": []
        }
        
        for field, value in result["parsed_fields"].items():
            field_info = {
                "field": field,
                "value": value if not isinstance(value, dict) else json.dumps(value),
                "length": len(str(value))
            }
            
            if field in ai_fields:
                field_info["model"] = "CLAUDE_HAIKU" if field != "50K" else "CLAUDE_SONNET"
                field_info["estimated_cost"] = "$0.00025" if field != "50K" else "$0.00150"
                fields_by_lane["ai"].append(field_info)
            elif field in regex_fields:
                fields_by_lane["regex"].append(field_info)
            else:
                fields_by_lane["rules"].append(field_info)
        
        # Store parsed message in MongoDB for visibility
        parse_record = {
            "format_type": format_type,
            "parsed_at": datetime.now(UTC),
            "field_count": result["field_count"],
            "fields": result["parsed_fields"],
            "processing_summary": {
                "rules_fields": len(fields_by_lane["rules"]),
                "ai_fields": len(fields_by_lane["ai"]),
                "regex_fields": len(fields_by_lane["regex"])
            },
            "estimated_ai_cost": result.get("estimated_ai_cost", 0)
        }
        # Commented out - unnecessary database write
        # doc_id = db.insert_one("parsed_messages", parse_record)
        
        # Generate a simple ID without database
        import uuid
        doc_id = str(uuid.uuid4())
        
        return {
            "format_type": format_type,
            "message_id": doc_id,
            "parsing_result": {
                "success": True,
                "field_count": result["field_count"],
                "fields_by_lane": fields_by_lane,
                "estimated_ai_cost": result.get("estimated_ai_cost", 0),
                "confidence": result.get("average_confidence", 0)
            },
            "raw_fields": result["parsed_fields"],
            "mongodb_collection": "parsed_messages"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing {format_type}: {str(e)}")


@router.get("/samples/{format_type}")
async def list_sample_messages(format_type: str) -> Dict[str, Any]:
    """List available sample messages for a format type"""
    
    format_type = format_type.upper()
    
    # Map format types to file extensions
    format_extensions = {
        "MT103": ".txt",
        "PACS.008": ".xml",
        "PACS008": ".xml"
    }
    
    if format_type not in format_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown format type: {format_type}"
        )
    
    # Look for sample files
    data_dir = Path("data")
    format_dir_map = {
        "MT103": "mt103",
        "PACS.008": "pacs008",
        "PACS008": "pacs008"
    }
    
    format_dir = data_dir / format_dir_map.get(format_type, format_type.lower())
    
    samples = []
    if format_dir.exists():
        for file_path in format_dir.glob(f"*{format_extensions[format_type]}"):
            # Read file content
            with open(file_path, 'r') as f:
                content = f.read()
            
            samples.append({
                "filename": file_path.name,
                "path": str(file_path),
                "size": len(content),
                "preview": content[:200] + "..." if len(content) > 200 else content
            })
    
    return {
        "format_type": format_type,
        "sample_count": len(samples),
        "samples": samples
    }


@router.get("/sample/{format_type}/{filename}")
async def get_sample_content(format_type: str, filename: str) -> Dict[str, Any]:
    """Get full content of a sample message"""
    
    format_type = format_type.upper()
    
    # Map format types to directories
    format_dir_map = {
        "MT103": "mt103",
        "PACS.008": "pacs008",
        "PACS008": "pacs008"
    }
    
    if format_type not in format_dir_map:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown format type: {format_type}"
        )
    
    # Build file path
    data_dir = Path("data")
    file_path = data_dir / format_dir_map[format_type] / filename
    
    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Sample file {filename} not found for format {format_type}"
        )
    
    # Read file content
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Parse if MT103
    parsed_fields = None
    if format_type == "MT103":
        try:
            parser = MT103Parser(db)
            result = parser.parse_with_metadata(content)
            parsed_fields = result["parsed_fields"]
        except:
            parsed_fields = None
    
    return {
        "format_type": format_type,
        "filename": filename,
        "path": str(file_path),
        "content": content,
        "size": len(content),
        "parsed_fields": parsed_fields
    }


class ValidateRequest(BaseModel):
    """Request model for validation"""
    content: Optional[str] = None
    sample_id: Optional[str] = None


@router.post("/validate/{format_type}")
async def validate_message_format(
    format_type: str,
    request: ValidateRequest
) -> Dict[str, Any]:
    """Validate if a message conforms to the expected format
    
    Checks structure, required fields, and format-specific rules.
    Users can provide content directly or select a sample from database.
    """
    
    # Get content from either direct input or database sample
    content = request.content
    
    if request.sample_id and not content:
        # Load sample from database
        sample = db.find("sample_messages", {"_id": request.sample_id})
        if not sample:
            raise HTTPException(status_code=404, detail=f"Sample {request.sample_id} not found")
        content = sample[0].get("content", "")
    
    if not content:
        raise HTTPException(status_code=400, detail="Either content or sample_id must be provided")
    
    format_type = format_type.upper()
    
    if format_type != "MT103":
        raise HTTPException(
            status_code=400,
            detail=f"Validation for {format_type} not yet implemented"
        )
    
    validation_result = {
        "format_type": format_type,
        "is_valid": True,
        "errors": [],
        "warnings": [],
        "field_analysis": {}
    }
    
    # Check for SWIFT block structure
    if not content.startswith("{1:"):
        validation_result["is_valid"] = False
        validation_result["errors"].append("Missing SWIFT block 1 (Basic Header)")
    
    if "{2:" not in content:
        validation_result["is_valid"] = False
        validation_result["errors"].append("Missing SWIFT block 2 (Application Header)")
    
    if "{4:" not in content:
        validation_result["is_valid"] = False
        validation_result["errors"].append("Missing SWIFT block 4 (Text Block)")
    
    # Parse and check required fields
    try:
        parser = MT103Parser(db)
        result = parser.parse_with_metadata(content)
        parsed_fields = result["parsed_fields"]
        
        # Check required MT103 fields
        required_fields = ["20", "32A", "50K", "59"]
        missing_fields = []
        
        for field in required_fields:
            if field not in parsed_fields:
                missing_fields.append(field)
                validation_result["warnings"].append(f"Missing required field: {field}")
        
        # Field-specific validations
        if "32A" in parsed_fields:
            if isinstance(parsed_fields["32A"], dict):
                # Validate date format
                date_val = parsed_fields["32A"].get("value_date", "")
                if len(date_val) != 6:
                    validation_result["errors"].append("Field 32A: Invalid date format (should be YYMMDD)")
                
                # Validate currency
                currency = parsed_fields["32A"].get("currency", "")
                if len(currency) != 3:
                    validation_result["errors"].append("Field 32A: Invalid currency code (should be 3 characters)")
        
        if "20" in parsed_fields:
            ref = parsed_fields["20"]
            if len(ref) > 16:
                validation_result["warnings"].append("Field 20: Reference exceeds 16 characters")
        
        validation_result["field_analysis"] = {
            "total_fields": len(parsed_fields),
            "required_fields_present": len(required_fields) - len(missing_fields),
            "required_fields_missing": len(missing_fields),
            "fields_found": list(parsed_fields.keys())
        }
        
    except Exception as e:
        validation_result["is_valid"] = False
        validation_result["errors"].append(f"Failed to parse message: {str(e)}")
    
    # Store validation result
    validation_record = {
        "format_type": format_type,
        "validated_at": datetime.now(UTC),
        "is_valid": validation_result["is_valid"],
        "errors": validation_result["errors"],
        "warnings": validation_result["warnings"],
        "field_analysis": validation_result["field_analysis"]
    }
    # NOTE: Commented out for performance optimization in demo
    # Can be re-enabled for detailed audit logging if needed
    # db.insert_one("validation_results", validation_record)
    
    return validation_result


@router.get("/field-info/{format_type}/{field_code}")
async def get_field_information(format_type: str, field_code: str) -> Dict[str, Any]:
    """Get detailed information about a specific field in a format
    
    Shows field description, processing lane, transformation rules, etc.
    """
    
    format_type = format_type.upper()
    
    # MT103 field definitions
    mt103_fields = {
        "20": {
            "name": "Transaction Reference Number",
            "description": "Sender's reference that uniquely identifies the transaction",
            "max_length": 16,
            "format": "16x",
            "required": True
        },
        "23B": {
            "name": "Bank Operation Code",
            "description": "Type of operation (CRED for credit transfer)",
            "format": "4!c",
            "required": True
        },
        "32A": {
            "name": "Value Date, Currency, Amount",
            "description": "Value date (YYMMDD), ISO currency code (3 chars), and amount",
            "format": "6!n3!a15d",
            "required": True,
            "components": ["value_date", "currency", "amount"]
        },
        "50K": {
            "name": "Ordering Customer",
            "description": "Name and address of the ordering customer",
            "format": "35x[4*35x]",
            "required": True,
            "processing": "AI"
        },
        "52A": {
            "name": "Ordering Institution",
            "description": "BIC of the ordering institution",
            "format": "11c",
            "required": False
        },
        "53A": {
            "name": "Sender's Correspondent",
            "description": "BIC of sender's correspondent bank",
            "format": "11c",
            "required": False
        },
        "57A": {
            "name": "Account With Institution",
            "description": "BIC of the account with institution",
            "format": "11c",
            "required": False
        },
        "59": {
            "name": "Beneficiary Customer",
            "description": "Account and name/address of beneficiary",
            "format": "/34x[CRLF]4*35x",
            "required": True,
            "processing": "AI"
        },
        "70": {
            "name": "Remittance Information",
            "description": "Payment details/purpose",
            "format": "4*35x",
            "required": False,
            "processing": "AI"
        },
        "71A": {
            "name": "Details of Charges",
            "description": "Who bears the charges (SHA/OUR/BEN)",
            "format": "3!a",
            "required": True
        },
        "72": {
            "name": "Sender to Receiver Information",
            "description": "Additional information from sender to receiver",
            "format": "6*35x",
            "required": False,
            "processing": "REGEX"
        }
    }
    
    if format_type != "MT103":
        raise HTTPException(
            status_code=400,
            detail=f"Field information for {format_type} not yet implemented"
        )
    
    field_info = mt103_fields.get(field_code.upper())
    if not field_info:
        raise HTTPException(
            status_code=404,
            detail=f"Field {field_code} not found in {format_type}"
        )
    
    # Get processing lane information
    routing_docs = db.find("field_model_routing", {"source_format": format_type})
    processing_lane = "RULES"  # Default
    
    if routing_docs:
        for strategy in routing_docs[0].get("field_strategies", []):
            if strategy["field"] == field_code:
                if strategy["model"] == "REGEX_FIRST":
                    processing_lane = "REGEX"
                else:
                    processing_lane = "AI"
                    field_info["ai_model"] = strategy["model"]
                    field_info["ai_strategy"] = strategy.get("strategy", "")
                break
    
    # Get mapping rules for this field
    rules_docs = db.find("conversion_rules", {
        "source_format": format_type,
        "is_active": True
    })
    
    mapping_rules = []
    if rules_docs:
        for rule in rules_docs[0].get("rules", []):
            if rule.get("source_field") == field_code:
                mapping_rules.append({
                    "target_field": rule.get("target_field"),
                    "transformation": rule.get("transformation"),
                    "description": rule.get("description", "")
                })
    
    return {
        "format_type": format_type,
        "field_code": field_code,
        "field_info": field_info,
        "processing_lane": processing_lane,
        "mapping_rules": mapping_rules,
        "mongodb_collections_used": ["field_model_routing", "conversion_rules"]
    }


@router.get("/recent-parses")
async def get_recent_parses(
    limit: int = Query(10, description="Number of recent parses to return"),
    format_type: Optional[str] = Query(None, description="Filter by format type")
) -> Dict[str, Any]:
    """Get recently parsed messages from MongoDB
    
    Shows parsing history for demo visibility.
    """
    
    query = {}
    if format_type:
        query["format_type"] = format_type.upper()
    
    # Get recent parses from MongoDB - Commented out, return empty list
    # recent = db.find("parsed_messages", query)
    recent = []  # Return empty list since we're not storing parsed messages
    
    # Sort by timestamp (most recent first) and limit
    recent = sorted(recent, key=lambda x: x.get("parsed_at", ""), reverse=True)[:limit]
    
    # Format for display
    formatted_parses = []
    for parse in recent:
        formatted_parses.append({
            "message_id": str(parse.get("_id", "")),
            "format_type": parse.get("format_type"),
            "parsed_at": parse.get("parsed_at"),
            "field_count": parse.get("field_count"),
            "processing_summary": parse.get("processing_summary"),
            "estimated_ai_cost": parse.get("estimated_ai_cost", 0)
        })
    
    return {
        "total": len(formatted_parses),
        "recent_parses": formatted_parses,
        "filters_applied": query
    }