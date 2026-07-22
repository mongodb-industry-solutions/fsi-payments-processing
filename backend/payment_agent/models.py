"""Request and response models for payment agent API."""

from typing import Dict, Any, Optional
from pydantic import BaseModel, Field


class ConversionContext(BaseModel):
    """Context from payment converter about the conversion."""
    source_format: str = Field(..., description="Source payment format (e.g., MT103)")
    target_format: str = Field(..., description="Target payment format (e.g., pacs.008)")
    conversion_id: str = Field(..., description="Unique conversion identifier")
    conversion_run_id: Optional[str] = Field(default=None, description="Unique run ID for this conversion (UUID)")
    additional_context: Optional[Dict[str, Any]] = Field(default=None, description="Additional context fields")


class ProcessPaymentRequest(BaseModel):
    """Request model for processing a payment through the agent system."""

    problem: str = Field(
        ...,
        description="Rich description of the problem for autonomous agent analysis",
        examples=[
            "The creditor name contains Western/Latin characters but Japanese payment regulations require katakana script",
            "India requires valid IFSC code for domestic transfers but provided bank identifier doesn't match IFSC format"
        ]
    )

    field_name: str = Field(
        ...,
        description="Name of field to modify in payment data",
        examples=["creditorName", "creditorBank", "creditorAccount"]
    )

    original_value: Optional[str] = Field(
        default=None,
        description="Original field value before modification (for audit)"
    )

    payment_data: Dict[str, Any] = Field(
        ...,
        description="Canonical JSON payment data from payment_converter_v2"
    )

    conversion_context: ConversionContext = Field(
        ...,
        description="Context from payment converter"
    )


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = Field(..., description="Service status")
    timestamp: str = Field(..., description="Current server timestamp")
    service: str = Field(..., description="Service name")
    version: str = Field(..., description="Service version")


class HumanReviewDecision(BaseModel):
    """Human reviewer's decision on proposed change."""
    approved: bool = Field(..., description="Whether the change is approved")
    modified_value: Optional[str] = Field(default=None, description="Optional modified value if human wants to change proposed value")


class ResumeWorkflowRequest(BaseModel):
    """Request to resume workflow after human review."""
    thread_id: str = Field(..., description="Thread ID from the initial request")
    decision: HumanReviewDecision = Field(..., description="Human reviewer's decision")
