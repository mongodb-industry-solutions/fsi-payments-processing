"""
Request models for converter API
"""

from pydantic import BaseModel, Field
from typing import Optional
import uuid


class ConversionRequest(BaseModel):
    """Request model for payment message conversion"""
    
    source_format: str = Field(
        ...,
        description="Source format (e.g., MT103, MT202, ISO8583)",
        example="MT103"
    )
    
    target_format: str = Field(
        ...,
        description="Target format (e.g., pacs.008, pacs.009, JSON)",
        example="pacs.008"
    )
    
    message: str = Field(
        ...,
        description="Raw message content to convert",
        example="{1:F01CHASUS33XXXX0000000000}..."
    )
    
    save_result: bool = Field(
        default=False,
        description="Whether to save conversion result to database"
    )
    
    request_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Unique request identifier"
    )
    
    options: Optional[dict] = Field(
        default=None,
        description="Additional conversion options"
    )
    
    use_router: bool = Field(
        default=False,
        description="Use ConversionRouter for intelligent path finding (Phase 1 testing)"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "source_format": "MT103",
                "target_format": "pacs.008",
                "message": "{1:F01CHASUS33XXXX0000000000}{2:I103DEUTDEFFXXXXN}...",
                "save_result": True
            }
        }