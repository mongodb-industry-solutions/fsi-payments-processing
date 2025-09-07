"""
Conversion API endpoints for payment format conversion

This module provides REST API endpoints for converting payment messages
between different formats using the MongoDB-powered conversion pipeline.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Dict, List, Optional, Any
from datetime import datetime, UTC
from pydantic import BaseModel, Field
import json

from models.payment_schemas import PaymentStatus, ConversionResponse as BaseConversionResponse
from services.converter_orchestrator import ConverterOrchestrator
from utils.parsers.mt103_parser import MT103Parser
from utils.parsers.mongodb_parser import MongoDBDrivenParser
from utils.builders.pacs008_builder import Pacs008Builder
from utils.builders.mongodb_builder import MongoDBDrivenBuilder
from db.mdb import MongoDBConnector
import logging

# Set up logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(
    prefix="/api/v1/convert",
    tags=["Conversion"],
    responses={404: {"description": "Not found"}}
)

# Initialize MongoDB connection
db = MongoDBConnector()


# Request/Response models specific to conversion API
class ConversionRequest(BaseModel):
    """Request model for message conversion"""
    source_format: str = Field(..., description="Source format code (e.g., MT103)")
    target_format: str = Field(..., description="Target format code (e.g., pacs.008)")
    message: str = Field(..., description="Raw message content to convert")
    trace_id: Optional[str] = Field(None, description="Optional trace ID for tracking")
    options: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional conversion options")


class ConversionResponse(BaseModel):
    """Response model for message conversion"""
    conversion_id: str
    source_format: str
    target_format: str
    status: str
    success: bool
    converted_message: Optional[str] = None
    confidence_score: Optional[float] = None
    processing_time: float
    processing_metadata: Dict[str, Any]
    statistics: Dict[str, Any]
    human_review_required: bool = False
    human_review_fields: List[str] = Field(default_factory=list)
    error: Optional[str] = None


class ConversionDetails(BaseModel):
    """Detailed conversion information"""
    conversion_id: str
    source_format: str
    target_format: str
    source_message: str
    converted_message: Optional[str]
    status: str
    confidence_score: Optional[float]
    processing_details: Dict[str, Any]
    field_level_details: List[Dict[str, Any]]
    mongodb_metadata: Dict[str, Any]
    created_at: datetime
    updated_at: Optional[datetime]


# Converter instances cache (created on demand)
_converters = {}


def get_converter(source_format: str, target_format: str) -> ConverterOrchestrator:
    """
    Get or create a converter orchestrator for the specified format pair.
    
    Args:
        source_format: Source format code
        target_format: Target format code
        
    Returns:
        ConverterOrchestrator instance
    """
    cache_key = f"{source_format}->{target_format}"
    
    if cache_key not in _converters:
        # Create new orchestrator
        orchestrator = ConverterOrchestrator(db, source_format, target_format)
        
        # Set up parser - use MongoDB-driven if config exists, otherwise use specific parser
        parser_config = db.find("parser_configs", {"format": source_format, "is_active": True})
        if parser_config:
            # Use MongoDB-driven parser
            orchestrator.set_parser(MongoDBDrivenParser(db, source_format))
            logger.info(f"Using MongoDB-driven parser for {source_format}")
        elif source_format == "MT103":
            # Fallback to hardcoded parser
            orchestrator.set_parser(MT103Parser(db))
            logger.info(f"Using hardcoded MT103Parser")
        elif source_format == "MT202":
            # Use MT202 parser
            from utils.parsers.mt202_parser import MT202Parser
            orchestrator.set_parser(MT202Parser(db))
            logger.info(f"Using MT202Parser")
        else:
            raise ValueError(f"Parser not implemented for format: {source_format}")
        
        # Set up builder - use MongoDB-driven if config exists, otherwise use specific builder
        builder_config = db.find("builder_configs", {"format": target_format, "is_active": True})
        if builder_config:
            # Use MongoDB-driven builder
            orchestrator.set_builder(MongoDBDrivenBuilder(db, target_format))
            logger.info(f"Using MongoDB-driven builder for {target_format}")
        elif target_format == "pacs.008":
            # Fallback to hardcoded builder
            orchestrator.set_builder(Pacs008Builder(db))
            logger.info(f"Using hardcoded Pacs008Builder")
        elif target_format == "pacs.009":
            from utils.builders.pacs009_builder import Pacs009Builder
            orchestrator.set_builder(Pacs009Builder(db))
            logger.info(f"Using Pacs009Builder")
        else:
            raise ValueError(f"Builder not implemented for format: {target_format}")
        
        _converters[cache_key] = orchestrator
    
    return _converters[cache_key]


@router.post("/", response_model=ConversionResponse)
async def convert_message(request: ConversionRequest) -> ConversionResponse:
    """
    Convert a payment message from one format to another.
    
    This endpoint orchestrates the complete conversion pipeline:
    1. Validates source and target formats
    2. Parses the source message
    3. Applies rules-based mappings
    4. Processes complex fields with AI
    5. Builds the target format message
    6. Stores everything in MongoDB
    
    Returns conversion ID for tracking and retrieval.
    """
    
    # Validate formats are supported
    all_formats = db.find("formats", {"is_active": True})
    
    supported_sources = [f["format_code"] for f in all_formats if f.get("type") == "source"]
    supported_targets = [f["format_code"] for f in all_formats if f.get("type") == "target"]
    
    if request.source_format not in supported_sources:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported source format: {request.source_format}. Supported: {supported_sources}"
        )
    
    if request.target_format not in supported_targets:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported target format: {request.target_format}. Supported: {supported_targets}"
        )
    
    try:
        # Get or create converter
        logger.info(f"Converting {request.source_format} to {request.target_format}")
        converter = get_converter(request.source_format, request.target_format)
        
        # Perform conversion
        result = converter.convert(request.message, trace_id=request.trace_id)
        
        # Build response
        return ConversionResponse(
            conversion_id=result["conversion_id"],
            source_format=request.source_format,
            target_format=request.target_format,
            status="completed" if result["success"] else "failed",
            success=result["success"],
            converted_message=result.get("converted_message"),
            confidence_score=result["statistics"].get("average_confidence"),
            processing_time=result["processing_metadata"]["processing_time"],
            processing_metadata=result["processing_metadata"],
            statistics=result["statistics"],
            human_review_required=result.get("human_review_required", False),
            human_review_fields=result.get("human_review_fields", []),
            error=result.get("error")
        )
        
    except Exception as e:
        # Log the actual error for debugging
        logger.error(f"Conversion error: {str(e)}", exc_info=True)
        
        # Log error to MongoDB - Commented out unnecessary database write
        # error_id = db.insert_one("conversion_errors", {
        #     "source_format": request.source_format,
        #     "target_format": request.target_format,
        #     "error": str(e),
        #     "trace_id": request.trace_id,
        #     "timestamp": datetime.now(UTC)
        # })
        
        # Generate a simple error ID without database
        import uuid
        error_id = str(uuid.uuid4())[:8]
        
        raise HTTPException(
            status_code=500,
            detail=f"Conversion failed: {str(e)}. Error ID: {error_id}"
        )


@router.get("/{conversion_id}", response_model=ConversionDetails)
async def get_conversion(conversion_id: str) -> ConversionDetails:
    """
    Retrieve a specific conversion by ID.
    
    Returns both the source and converted messages along with
    complete processing details and MongoDB metadata.
    """
    
    # Retrieve from MongoDB
    from bson import ObjectId
    
    # Try to get the conversion document using ObjectId
    try:
        conversions = db.find("conversions", {"_id": ObjectId(conversion_id)})
    except:
        # If conversion_id is not a valid ObjectId, try as string
        conversions = db.find("conversions", {"conversion_id": conversion_id})
    
    if not conversions:
        raise HTTPException(
            status_code=404,
            detail=f"Conversion {conversion_id} not found"
        )
    
    record = conversions[0] if conversions else None
    if not record:
        raise HTTPException(
            status_code=404,
            detail=f"Conversion {conversion_id} not found"
        )
    
    # Build detailed response
    return ConversionDetails(
        conversion_id=str(record.get("_id", conversion_id)),
        source_format=record["source_format"],
        target_format=record["target_format"],
        source_message=record.get("raw_message", ""),
        converted_message=record.get("target_message"),
        status=record.get("status", "unknown"),
        confidence_score=record.get("confidence_score"),
        processing_details=record.get("processing_stats", {}),
        field_level_details=record.get("converted_fields", []),
        mongodb_metadata={
            "collection": "conversions",
            "document_id": str(record.get("_id", "")),
            "created_at": record.get("created_at"),
            "updated_at": record.get("updated_at")
        },
        created_at=record.get("created_at", datetime.now(UTC)),
        updated_at=record.get("updated_at")
    )


@router.get("/{conversion_id}/details")
async def get_conversion_details(conversion_id: str) -> Dict[str, Any]:
    """
    Get detailed field-by-field processing information for a conversion.
    
    Shows which processing lane handled each field, confidence scores,
    and any AI models used.
    """
    
    # Retrieve conversion
    from bson import ObjectId
    
    # Try to get the conversion document using ObjectId
    try:
        conversions = db.find("conversions", {"_id": ObjectId(conversion_id)})
    except:
        # If conversion_id is not a valid ObjectId, try as string
        conversions = db.find("conversions", {"conversion_id": conversion_id})
    
    if not conversions:
        raise HTTPException(
            status_code=404,
            detail=f"Conversion {conversion_id} not found"
        )
    
    record = conversions[0] if conversions else None
    if not record:
        raise HTTPException(
            status_code=404,
            detail=f"Conversion {conversion_id} not found"
        )
    
    # Extract field-level details
    field_details = []
    
    # Get parsed and converted fields
    parsed_fields = record.get("parsed_fields", {})
    converted_fields = record.get("converted_fields", {})
    field_mappings = record.get("field_mappings", {})
    processing_stats = record.get("processing_stats", {})
    
    # Use field_mappings if available (new approach)
    if field_mappings:
        # Build field-by-field breakdown from field_mappings
        for mapping_key, mapping_data in field_mappings.items():
            source_field = mapping_data.get("source_field")
            target_field = mapping_data.get("target_field")
            
            # Get source value, handling structured fields
            source_value = ""
            if source_field in parsed_fields:
                source_value = parsed_fields.get(source_field, "")
            else:
                # Check if this is a subfield of a structured field
                # e.g., "32A_amount" -> look for "32A" dict with "amount" key
                if "_" in source_field:
                    parts = source_field.split("_", 1)
                    parent_field = parts[0]
                    sub_field = parts[1]
                    
                    if parent_field in parsed_fields and isinstance(parsed_fields[parent_field], dict):
                        # Map common naming variations
                        if sub_field == "date":
                            source_value = parsed_fields[parent_field].get("value_date", "")
                        else:
                            source_value = parsed_fields[parent_field].get(sub_field, "")
                        
                        # If still empty, show the whole dict as string
                        if not source_value and parsed_fields[parent_field]:
                            source_value = str(parsed_fields[parent_field])
            
            detail = {
                "field_id": source_field,  # Use source field ID for consistency
                "source_value": source_value,  # Get original value with structured field support
                "target_field": target_field,
                "value": mapping_data.get("value", ""),  # Converted value
                "processing_lane": mapping_data.get("processing_lane", "UNKNOWN"),
                "confidence": mapping_data.get("confidence", 1.0),
                "model_used": mapping_data.get("model_used")
            }
            field_details.append(detail)
    
    else:
        # Fallback to old approach for backward compatibility
        for field_id, field_data in converted_fields.items():
            # Skip internal AI tracking fields
            if field_id.startswith("_ai_"):
                continue
                
            detail = {
                "field_id": field_id,
                "source_value": parsed_fields.get(field_id, ""),  # Original parsed value
                "value": field_data.get("value") if isinstance(field_data, dict) else field_data,
                "processing_lane": "UNKNOWN",
                "confidence": 1.0,
                "model_used": None
            }
            
            # Determine processing lane
            if field_id in processing_stats.get("rules_lane", {}).get("fields", []):
                detail["processing_lane"] = "RULES"
            elif field_id in processing_stats.get("ai_lane", {}).get("fields", []):
                detail["processing_lane"] = "AI"
                if isinstance(field_data, dict):
                    detail["confidence"] = field_data.get("confidence", 0.85)
                    detail["model_used"] = field_data.get("model_used")
            elif field_id in processing_stats.get("human_lane", {}).get("fields", []):
                detail["processing_lane"] = "HUMAN_REVIEW"
                detail["confidence"] = 0.0
            
            field_details.append(detail)
    
    # Add human review fields that might not be in field_mappings/converted_fields
    human_fields = processing_stats.get("human_lane", {}).get("fields", [])
    for field_id in human_fields:
        # Check if this field is already in our details
        if not any(f["field_id"] == field_id for f in field_details):
            # Skip structured fields if their subfields have been processed
            field_value = parsed_fields.get(field_id)
            if isinstance(field_value, dict):
                # Check if any subfields of this structured field have been processed
                has_processed_subfields = any(
                    f["field_id"].startswith(f"{field_id}_")
                    for f in field_details
                )
                if has_processed_subfields:
                    continue  # Skip the parent structured field
            
            field_details.append({
                "field_id": field_id,
                "source_value": parsed_fields.get(field_id, ""),
                "value": None,  # No converted value for human review
                "processing_lane": "HUMAN_REVIEW",
                "confidence": 0.0,
                "model_used": None
            })
    
    # Recalculate accurate counts based on actual field_details
    rules_count = len([f for f in field_details if f.get("processing_lane") == "RULES"])
    ai_count = len([f for f in field_details if f.get("processing_lane") == "AI"])
    human_count = len([f for f in field_details if f.get("processing_lane") == "HUMAN_REVIEW"])
    
    return {
        "conversion_id": conversion_id,
        "field_count": len(field_details),
        "processing_summary": {
            "rules_fields": rules_count,
            "ai_fields": ai_count,
            "human_review_fields": human_count
        },
        "field_details": field_details,
        "processing_time": record.get("processing_time"),
        "overall_confidence": sum(f["confidence"] for f in field_details if f["confidence"] > 0) / max(1, len([f for f in field_details if f["confidence"] > 0]))
    }


@router.get("/history/recent")
async def get_conversion_history(
    limit: int = Query(10, ge=1, le=100),
    source_format: Optional[str] = None,
    target_format: Optional[str] = None,
    status: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get recent conversion history with optional filters.
    
    Query parameters:
    - limit: Number of records to return (1-100, default 10)
    - source_format: Filter by source format
    - target_format: Filter by target format
    - status: Filter by status (completed, failed, in_progress)
    """
    
    # Build query
    query = {}
    if source_format:
        query["source_format"] = source_format
    if target_format:
        query["target_format"] = target_format
    if status:
        query["status"] = status
    
    # Retrieve from MongoDB (db.find returns a list)
    conversions = db.find("conversions", query)
    
    # Sort by created_at descending and limit
    conversions = sorted(conversions, key=lambda x: x.get("created_at", datetime.now(UTC)), reverse=True)[:limit]
    
    # Format results
    history = []
    for conv in conversions:
        history.append({
            "conversion_id": str(conv.get("_id", "")),
            "source_format": conv["source_format"],
            "target_format": conv["target_format"],
            "status": conv.get("status", "unknown"),
            "processing_time": conv.get("processing_time"),
            "confidence_score": conv.get("confidence_score"),
            "created_at": conv.get("created_at"),
            "trace_id": conv.get("trace_id")
        })
    
    return {
        "total": len(history),
        "limit": limit,
        "filters": {
            "source_format": source_format,
            "target_format": target_format,
            "status": status
        },
        "conversions": history
    }


@router.get("/statistics/summary")
async def get_conversion_statistics() -> Dict[str, Any]:
    """
    Get conversion statistics and performance metrics.
    
    Returns aggregate statistics about conversions including
    success rates, average processing times, and lane distribution.
    """
    
    # Get all conversions for statistics
    all_conversions = db.find("conversions", {})
    
    if not all_conversions:
        return {
            "total_conversions": 0,
            "success_rate": 0.0,
            "average_processing_time": 0.0,
            "format_pairs": [],
            "lane_distribution": {}
        }
    
    # Calculate statistics
    total = len(all_conversions)
    successful = len([c for c in all_conversions if c.get("status") == "completed"])
    
    # Processing times
    times = []
    for conv in all_conversions:
        if "processing_time" in conv:
            times.append(conv["processing_time"])
    
    avg_time = sum(times) / len(times) if times else 0.0
    
    # Format pairs
    format_pairs = {}
    for conv in all_conversions:
        pair = f"{conv['source_format']}->{conv['target_format']}"
        format_pairs[pair] = format_pairs.get(pair, 0) + 1
    
    # Lane distribution
    total_rules = 0
    total_ai = 0
    total_human = 0
    
    for conv in all_conversions:
        stats = conv.get("processing_stats", {})
        total_rules += stats.get("rules_lane", {}).get("count", 0)
        total_ai += stats.get("ai_lane", {}).get("count", 0)
        total_human += stats.get("human_lane", {}).get("count", 0)
    
    return {
        "total_conversions": total,
        "success_rate": (successful / total * 100) if total > 0 else 0.0,
        "average_processing_time": round(avg_time, 2),
        "format_pairs": [
            {"pair": pair, "count": count}
            for pair, count in format_pairs.items()
        ],
        "lane_distribution": {
            "rules": total_rules,
            "ai": total_ai,
            "human_review": total_human
        },
        "mongodb_collections": [
            "conversions",
            "conversion_rules",
            "field_model_routing",
            "prompt_templates",
            "ai_processing_history"
        ]
    }