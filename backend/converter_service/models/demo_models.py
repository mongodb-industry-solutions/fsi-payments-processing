"""
Demo Models
Request and response models for the payment builder demo API
"""

from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from enum import Enum
from datetime import datetime


class PaymentTypeEnum(str, Enum):
    """Enumeration of available payment types"""
    CROSS_BORDER = "cross_border"
    BANK_TRANSFER = "bank_transfer"
    CARD_PAYMENT = "card_payment"
    FX_SETTLEMENT = "fx_settlement"
    INSTANT_PAYMENT = "instant_payment"
    PAYROLL = "payroll"


class FormFieldType(str, Enum):
    """Types of form fields"""
    TEXT = "text"
    NUMBER = "number"
    SELECT = "select"
    TEXTAREA = "textarea"
    DATE = "date"
    EMAIL = "email"
    TEL = "tel"
    CHECKBOX = "checkbox"
    RADIO = "radio"


class FormField(BaseModel):
    """Individual form field definition"""
    id: str = Field(..., description="Unique field identifier")
    label: str = Field(..., description="Display label for the field")
    type: str = Field(..., description="Field type (text, number, select, etc)")
    placeholder: Optional[str] = Field(None, description="Placeholder text")
    required: bool = Field(False, description="Whether field is required")
    default: Optional[Any] = Field(None, description="Default value")
    pattern: Optional[str] = Field(None, description="Validation pattern (regex)")
    min: Optional[float] = Field(None, description="Minimum value for numbers")
    max: Optional[float] = Field(None, description="Maximum value for numbers")
    step: Optional[float] = Field(None, description="Step increment for numbers")
    options: Optional[List[Any]] = Field(None, description="Options for select fields")
    mask: Optional[bool] = Field(False, description="Whether to mask input (e.g., card numbers)")
    maxLength: Optional[int] = Field(None, description="Maximum character length")


class FormSection(BaseModel):
    """Group of related form fields"""
    title: str = Field(..., description="Section title")
    fields: List[FormField] = Field(..., description="Fields in this section")


class FormSchema(BaseModel):
    """Complete form schema for a payment type"""
    sections: List[FormSection] = Field(..., description="Form sections")


class PaymentTypeSummary(BaseModel):
    """Summary of a payment type for listing"""
    id: str = Field(..., description="Payment type identifier")
    name: str = Field(..., description="Display name with icon")
    description: str = Field(..., description="Brief description")
    icon: str = Field(..., description="Icon/emoji for the payment type")


class PaymentScenario(BaseModel):
    """Complete payment scenario configuration"""
    id: str = Field(..., description="Unique scenario identifier")
    display_name: str = Field(..., description="User-friendly display name")
    description: str = Field(..., description="Scenario description")
    icon: str = Field(..., description="Visual icon/emoji")
    source_format: str = Field(..., description="Source message format")
    target_format: str = Field(..., description="Target message format")
    message_template: str = Field(..., description="Message template with placeholders")
    form_schema: FormSchema = Field(..., description="Form field definitions")
    demo_values: Optional[Dict[str, Any]] = Field(None, description="Pre-filled demo values")
    note: Optional[str] = Field(None, description="Additional notes about the scenario")


class BuildPaymentRequest(BaseModel):
    """Request to build a payment message"""
    payment_type: str = Field(..., description="Type of payment to build")
    form_data: Dict[str, Any] = Field(..., description="User-provided form data")
    use_demo_values: bool = Field(False, description="Whether to merge with demo values")


class BuildPaymentResponse(BaseModel):
    """Response from building a payment message"""
    success: bool = Field(..., description="Whether build was successful")
    payment_type: str = Field(..., description="Type of payment built")
    source_format: str = Field(..., description="Format of built message")
    target_format: str = Field(..., description="Target format for conversion")
    message: str = Field(..., description="Built payment message")
    metadata: Dict[str, Any] = Field(..., description="Build metadata")


class ExecutePaymentRequest(BaseModel):
    """Request to build and execute a payment conversion"""
    payment_type: str = Field(..., description="Type of payment to execute")
    form_data: Dict[str, Any] = Field(..., description="User-provided form data")
    use_demo_values: bool = Field(False, description="Whether to use demo values")
    save_result: bool = Field(False, description="Whether to save conversion result")


class ExecutePaymentResponse(BaseModel):
    """Response from executing a payment conversion"""
    success: bool = Field(..., description="Whether execution was successful")
    payment_type: str = Field(..., description="Type of payment executed")
    source_format: str = Field(..., description="Source format")
    target_format: str = Field(..., description="Target format")
    source_message: str = Field(..., description="Built source message")
    converted_message: Optional[str] = Field(None, description="Converted message")
    conversion_metadata: Dict[str, Any] = Field(..., description="Conversion details")
    processing_stats: Optional[Dict[str, Any]] = Field(None, description="Processing statistics")
    confidence_scores: Optional[Dict[str, float]] = Field(None, description="Field confidence scores")
    human_review_required: bool = Field(False, description="Whether human review is needed")
    demo_insights: Optional[Dict[str, Any]] = Field(None, description="Demo visualization data")


class GetFormSchemaResponse(BaseModel):
    """Response containing form schema for a payment type"""
    payment_type: str = Field(..., description="Payment type ID")
    display_name: str = Field(..., description="Display name")
    form_schema: FormSchema = Field(..., description="Form field definitions")
    demo_values: Optional[Dict[str, Any]] = Field(None, description="Demo values if requested")
    demo_context: Optional[Dict[str, str]] = Field(None, description="Context about demo data")


class ValidationResult(BaseModel):
    """Result of form data validation"""
    valid: bool = Field(..., description="Whether data is valid")
    errors: List[str] = Field(default_factory=list, description="Validation errors")
    warnings: List[str] = Field(default_factory=list, description="Validation warnings")


class PaymentJourneyHop(BaseModel):
    """Individual hop in a payment journey"""
    hop_number: int = Field(..., description="Sequential hop number")
    description: str = Field(..., description="What happens at this hop")
    format_in: str = Field(..., description="Input format")
    format_out: str = Field(..., description="Output format")
    processing_time_ms: int = Field(..., description="Estimated processing time")
    processing_lane: Optional[str] = Field(None, description="Processing lane (RULES/AI/HUMAN)")


class PaymentJourney(BaseModel):
    """Complete payment journey visualization"""
    payment_type: str = Field(..., description="Type of payment")
    total_hops: int = Field(..., description="Number of processing hops")
    hops: List[PaymentJourneyHop] = Field(..., description="Individual hops")
    total_time_ms: int = Field(..., description="Total processing time")
    complexity_score: float = Field(..., description="Journey complexity (0-1)")