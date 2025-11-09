"""API Endpoints - Phase 4"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
import logging

from config import get_settings
from src.services import (
    MongoDBService,
    get_bedrock_service,
    get_ai_lane_service,
    Converter
)

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize settings
settings = get_settings()

# Initialize services (singleton pattern)
mongodb_service = MongoDBService(settings.mongodb_uri, settings.database_name)
bedrock_service = get_bedrock_service(settings.aws_default_region)
ai_lane_service = get_ai_lane_service(
    model_haiku=settings.ai_model_haiku,
    model_sonnet=settings.ai_model_sonnet
)
converter = Converter(
    mongodb_service=mongodb_service,
    ai_lane_service=ai_lane_service,
    ai_confidence_threshold=settings.ai_confidence_threshold
)


# ============================================================================
# Request/Response Models
# ============================================================================

class ConversionRequest(BaseModel):
    """Request model for conversion endpoint"""
    conversion_id: str = Field(..., description="Conversion ID (e.g., MT103_to_pacs.008)")
    message: str = Field(..., description="Source message to convert")
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "conversion_id": "MT103_to_pacs.008",
                    "message": "{1:F01BANK...}{4:\n:20:REF123\n:23B:CRED\n...}"
                }
            ]
        }
    }


class ProcessingStats(BaseModel):
    """Processing statistics"""
    rules_lane: int = Field(..., description="Number of fields processed via RULES lane")
    ai_lane: int = Field(..., description="Number of fields processed via AI lane")
    human_lane: int = Field(..., description="Number of fields requiring human review")


class ConversionResponse(BaseModel):
    """Response model for conversion endpoint"""
    output: str = Field(..., description="Converted message")
    processing_stats: ProcessingStats = Field(..., description="Processing lane statistics")
    confidence_scores: Dict[str, float] = Field(..., description="AI confidence scores")
    human_review_required: bool = Field(..., description="Whether human review is needed")
    metadata: Dict[str, Any] = Field(..., description="Conversion metadata")


class FormatInfo(BaseModel):
    """Format information"""
    conversion_id: str = Field(..., description="Conversion ID")
    source_format: str = Field(..., description="Source format name")
    target_format: str = Field(..., description="Target format name")
    description: Optional[str] = Field(None, description="Conversion description")


class HealthResponse(BaseModel):
    """Health check response"""
    status: str = Field(..., description="Service status")
    mongodb: str = Field(..., description="MongoDB connection status")
    bedrock: str = Field(..., description="AWS Bedrock status")
    version: str = Field(..., description="Service version")


class ConfigResponse(BaseModel):
    """Configuration response"""
    conversion_id: str = Field(..., description="Conversion ID")
    extract_patterns: int = Field(..., description="Number of extraction patterns")
    mappings: int = Field(..., description="Number of field mappings")
    output_fields: int = Field(..., description="Number of output fields")
    has_ai_mappings: bool = Field(..., description="Whether AI mappings are present")


# ============================================================================
# API Endpoints
# ============================================================================

@router.post("/convert", response_model=ConversionResponse, status_code=status.HTTP_200_OK)
async def convert_message(request: ConversionRequest) -> ConversionResponse:
    """
    Convert a payment message from source to target format.
    
    This endpoint orchestrates the full conversion pipeline:
    1. Load configuration from MongoDB
    2. Extract fields using regex patterns
    3. Transform through 3 lanes (RULES/AI/HUMAN)
    4. Build output message (XML/JSON)
    5. Return result with statistics
    """
    try:
        logger.info(f"Converting message: {request.conversion_id}")
        
        # Parse conversion_id (e.g., "MT103_to_pacs.008")
        parts = request.conversion_id.split("_to_")
        if len(parts) != 2:
            raise ValueError(
                f"Invalid conversion_id format: {request.conversion_id}. "
                "Expected format: SOURCE_to_TARGET (e.g., MT103_to_pacs.008)"
            )
        
        source_format = parts[0]
        target_format = parts[1]
        
        # Perform conversion
        result = await converter.convert(
            source_format=source_format,
            target_format=target_format,
            message=request.message
        )
        
        # Extract lane distribution from processing_stats
        stats = result["processing_stats"]
        lane_dist = stats.get("lane_distribution", {})
        
        # Add conversion_id to metadata
        metadata = result["metadata"].copy()
        metadata["conversion_id"] = request.conversion_id
        metadata["processing_time"] = metadata.pop("processing_time_seconds")
        
        # Map to response model
        return ConversionResponse(
            output=result["converted_message"],
            processing_stats=ProcessingStats(
                rules_lane=lane_dist.get("RULES", 0),
                ai_lane=lane_dist.get("AI", 0),
                human_lane=lane_dist.get("HUMAN", 0)
            ),
            confidence_scores=result["confidence_scores"],
            human_review_required=result["human_review_required"],
            metadata=metadata
        )
        
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Conversion failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Conversion failed: {str(e)}"
        )


@router.get("/health", response_model=HealthResponse, status_code=status.HTTP_200_OK)
async def health_check() -> HealthResponse:
    """
    Health check endpoint.
    
    Checks connectivity to:
    - MongoDB database
    - AWS Bedrock service
    
    Returns status for each component.
    """
    try:
        # Check MongoDB
        mongodb_status = "connected" if await mongodb_service.health_check() else "disconnected"
        
        # Check Bedrock
        bedrock_status = "initialized" if bedrock_service.health_check() else "not initialized"
        
        overall_status = "healthy" if mongodb_status == "connected" else "degraded"
        
        return HealthResponse(
            status=overall_status,
            mongodb=mongodb_status,
            bedrock=bedrock_status,
            version="2.0.0"
        )
        
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Health check failed: {str(e)}"
        )


@router.get("/formats", response_model=List[FormatInfo], status_code=status.HTTP_200_OK)
async def list_formats() -> List[FormatInfo]:
    """
    List all available conversion formats.
    
    Returns a list of all configured conversions with their:
    - Conversion ID
    - Source format
    - Target format
    - Description (if available)
    """
    try:
        configs = await mongodb_service.list_configs()
        
        formats = []
        for config in configs:
            conversion_id = config.get("_id", "")
            
            # Parse conversion_id (e.g., "MT103_to_pacs.008")
            parts = conversion_id.split("_to_")
            source_format = parts[0] if len(parts) > 0 else "unknown"
            target_format = parts[1] if len(parts) > 1 else "unknown"
            
            formats.append(FormatInfo(
                conversion_id=conversion_id,
                source_format=source_format,
                target_format=target_format,
                description=config.get("description")
            ))
        
        return formats
        
    except Exception as e:
        logger.error(f"Failed to list formats: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list formats: {str(e)}"
        )


@router.get("/config/{conversion_id}", response_model=ConfigResponse, status_code=status.HTTP_200_OK)
async def get_config(conversion_id: str) -> ConfigResponse:
    """
    Get configuration details for a specific conversion.
    
    Returns summary information about:
    - Number of extraction patterns
    - Number of field mappings
    - Number of output fields
    - Whether AI mappings are present
    """
    try:
        config = await mongodb_service.get_config(conversion_id)
        
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Configuration not found: {conversion_id}"
            )
        
        # Count patterns, mappings, and outputs
        extract_patterns = len(config.get("extract", {}))
        mappings = len(config.get("map", []))
        output_fields = len(config.get("output", {}))
        
        # Check for AI mappings
        has_ai = any("ai" in mapping for mapping in config.get("map", []))
        
        return ConfigResponse(
            conversion_id=conversion_id,
            extract_patterns=extract_patterns,
            mappings=mappings,
            output_fields=output_fields,
            has_ai_mappings=has_ai
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get config: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get config: {str(e)}"
        )

