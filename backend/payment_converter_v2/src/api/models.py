"""Request and response models for converter API."""

from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any


class MultiHopConversionRequest(BaseModel):
    """Request model for multi-hop conversion endpoint"""
    source_format: str = Field(..., description="Source format (e.g., MT103)")
    target_format: str = Field(..., description="Target format (e.g., pacs.008)")
    message: str = Field(..., description="Source message to convert")
    use_json_bridge: bool = Field(
        default=True,
        description="Use canonical JSON as intermediate format"
    )
    use_ai: bool = Field(
        default=True,
        description="Use AI lane for unstructured fields (false = rules/regex only)"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "source_format": "MT103",
                    "target_format": "pacs.008",
                    "message": "{1:F01BANK...}{4:\n:20:REF123\n:23B:CRED\n...}",
                    "use_json_bridge": True,
                    "use_ai": True
                }
            ]
        }
    }


class HealthResponse(BaseModel):
    """Health check response"""
    status: str = Field(..., description="Service status")
    mongodb: str = Field(..., description="MongoDB connection status")
    bedrock: str = Field(..., description="AWS Bedrock status")
    version: str = Field(..., description="Service version")


class AutoConfigureRequest(BaseModel):
    """Request model for auto-configure endpoint"""
    source_format: str = Field(..., description="Source format (e.g., MT202)")
    target_format: str = Field(..., description="Target format (e.g., JSON)")
    sample_message: str = Field(..., description="Sample message to learn from")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "source_format": "MT202",
                    "target_format": "JSON",
                    "sample_message": "{1:F01CHASUS33AXXX...}{4:\n:20:MT202TEST\n:21:REF2024\n:32A:241215EUR500000,00\n...}"
                }
            ]
        }
    }


class AutoConfigureResponse(BaseModel):
    """Response model for auto-configure endpoint"""
    configuration_id: str = Field(..., description="Generated configuration ID")
    config: Dict[str, Any] = Field(..., description="Generated configuration")
    confidence: float = Field(..., description="Target coverage ratio: (mapped + ai) / required")
    source_fields_identified: int = Field(..., description="Number of source fields extracted from message")
    target_fields_required: int = Field(..., description="Total fields in target format specification")
    target_fields_mapped: int = Field(..., description="Target fields covered by pattern-matched source fields")
    target_fields_ai: int = Field(..., description="Target fields covered by AI suggestions for unknown source fields")
    matched_fields: List[str] = Field(..., description="Source field IDs matched from existing configs")
    unknown_fields: List[str] = Field(..., description="Source field IDs not found in any existing config")
    learned_from: List[str] = Field(..., description="Config IDs used for learning")
    not_covered_fields: List[str] = Field(default=[], description="Target field names with no source or AI mapping")
    suggestions: List[Dict[str, Any]] = Field(default=[], description="LLM-suggested mappings for unknown fields (display-only)")
    llm_prompt_info: Optional[Dict[str, Any]] = Field(default=None, description="LLM prompt construction details for frontend display")


class ApproveConfigResponse(BaseModel):
    """Response model for approve config endpoint"""
    status: str = Field(..., description="Approval status")
    configuration_id: str = Field(..., description="Configuration ID")


class HumanReviewDecision(BaseModel):
    """Human reviewer's decision on proposed change."""
    approved: bool = Field(..., description="Whether the change is approved")
    modified_value: Optional[str] = Field(default=None, description="Optional modified value")


class ResumeAgentRequest(BaseModel):
    """Request to resume agent workflow after human review."""
    thread_id: str = Field(..., description="Thread ID from the review_required event")
    decision: HumanReviewDecision = Field(..., description="Human reviewer's decision")


class AIReviewDecision(BaseModel):
    """Human's decision on AI-extracted fields."""
    approved: bool = Field(..., description="Whether all AI extractions are approved")
    corrections: Optional[Dict[str, Any]] = Field(default=None, description="Optional corrections to AI extractions")


class ResumeAIReviewRequest(BaseModel):
    """Request to resume conversion after AI field review."""
    conversion_run_id: str = Field(..., description="Conversion run ID from ai_review_required event")
    decision: AIReviewDecision = Field(..., description="Human reviewer's decision on AI fields")
