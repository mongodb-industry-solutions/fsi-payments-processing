"""Pydantic models for payment messages"""

from typing import Dict, List, Optional, Any
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field

class PaymentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing" 
    COMPLETED = "completed"
    FAILED = "failed"
    REVIEW = "review"

class ProcessingLane(str, Enum):
    RULES = "RULES"
    AI = "AI"
    REGEX = "REGEX"
    HYBRID = "HYBRID"

class FormatCategory(str, Enum):
    ISO20022 = "ISO20022"
    SWIFT = "SWIFT"
    ISO8583 = "ISO8583"
    PROPRIETARY = "PROPRIETARY"

class ProcessingLaneInfo(BaseModel):
    """Information about processing in a specific lane"""
    fields: List[str]
    duration_ms: int
    tokens_used: Optional[int] = None

class PaymentMessage(BaseModel):
    """Payment message document structure"""
    message_id: str
    batch_id: Optional[str] = None
    source_format: str
    target_format: str
    source_message: Dict[str, Any]
    converted_message: Optional[Dict[str, Any]] = None
    status: PaymentStatus = PaymentStatus.PENDING
    confidence_score: Optional[float] = None
    processing_lanes: Optional[Dict[str, ProcessingLaneInfo]] = None
    validation_errors: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    metadata: Optional[Dict[str, Any]] = None

class ConversionRequest(BaseModel):
    """API request for message conversion"""
    source_format: str
    target_format: str
    message: Dict[str, Any]
    options: Optional[Dict[str, Any]] = None

class ConversionResponse(BaseModel):
    """API response for message conversion"""
    conversion_id: str
    source_format: str
    target_format: str
    converted_message: Optional[Dict[str, Any]]
    confidence_score: float
    status: PaymentStatus
    needs_review: bool = False
    low_confidence_fields: List[str] = Field(default_factory=list)
    processing_time_ms: int
    cost_estimate: float
    errors: List[str] = Field(default_factory=list)

class FieldMapping(BaseModel):
    """Field mapping information for format preview"""
    target_field: str
    display_name: str
    source_field: Optional[str] = None
    processing_lane: Optional[ProcessingLane] = None
    expected_confidence: float = 0.0
    will_populate: bool = False

class FormatPreviewResponse(BaseModel):
    """Format preview response"""
    source_format: str
    target_format: str
    coverage_percentage: float
    field_mappings: List[FieldMapping]

class FormatDetails(BaseModel):
    """Format details for API response"""
    format_code: str
    format_name: str
    description: str
    category: FormatCategory
    version: Optional[str] = None
    supported_sources: List[str] = Field(default_factory=list)
    is_active: bool = True