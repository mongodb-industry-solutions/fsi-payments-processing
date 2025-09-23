"""
Response models for converter API
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List, Union


class ProcessingStats(BaseModel):
    """Processing statistics for conversion"""
    
    rules_lane: Dict[str, Any] = Field(
        default={},
        description="Statistics for rules-based processing"
    )
    
    ai_lane: Dict[str, Any] = Field(
        default={},
        description="Statistics for AI processing"
    )
    
    human_lane: Dict[str, Any] = Field(
        default={},
        description="Statistics for human review items"
    )


class ConversionMetadata(BaseModel):
    """Metadata about the conversion process"""
    
    source_format: str
    target_format: str
    conversion_id: str
    start_time: str
    end_time: Optional[str] = None
    processing_time_seconds: Optional[float] = None
    status: str = Field(default="pending", description="Status: pending, completed, failed")
    parsed_fields_count: Optional[int] = None
    transformed_fields_count: Optional[int] = None
    processing_stats: Optional[ProcessingStats] = None
    human_review_required: bool = False
    human_review_fields: List[Union[str, Dict[str, Any]]] = Field(default_factory=list)
    confidence_scores: Dict[str, float] = Field(default_factory=dict)
    routing: Optional[Dict[str, Any]] = Field(default=None, description="Routing information from ConversionRouter")


class ConversionResponse(BaseModel):
    """Response model for conversion result"""

    success: bool = Field(
        description="Whether conversion was successful"
    )

    converted_message: Optional[str] = Field(
        default=None,
        description="Converted message in target format"
    )

    metadata: Optional[ConversionMetadata] = Field(
        default=None,
        description="Conversion metadata and statistics"
    )

    error: Optional[str] = Field(
        default=None,
        description="Error message if conversion failed"
    )

    request_id: str = Field(
        description="Request identifier for tracking"
    )

    # Top-level fields for backward compatibility
    processing_stats: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Processing statistics (rules/AI/human lanes)"
    )

    confidence_scores: Optional[Dict[str, float]] = Field(
        default=None,
        description="AI confidence scores for processed fields"
    )

    human_review_required: Optional[bool] = Field(
        default=None,
        description="Whether human review is required"
    )

    processing_time_seconds: Optional[float] = Field(
        default=None,
        description="Total processing time in seconds"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "converted_message": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>...",
                "metadata": {
                    "source_format": "MT103",
                    "target_format": "pacs.008",
                    "conversion_id": "MT103_to_pacs.008",
                    "processing_time_seconds": 0.123,
                    "human_review_required": False
                },
                "request_id": "123e4567-e89b-12d3-a456-426614174000"
            }
        }