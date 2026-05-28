"""Request and response models for converter API.

Wire convention (matches accounts/transactions services):
  - Request + response field names are camelCase.
  - Every BIAN request model declares `extra="forbid"` — unknown fields → 422.
  - Responses use a top-level envelope: `{ <refId>: "...", <record>: {...} }`.

The 4 non-BIAN /api/v1/* models (HumanReviewDecision, ResumeAgentRequest,
AIReviewDecision, ResumeAIReviewRequest) keep their existing snake_case shape
per the prior scope decision to leave the legacy agent routes untouched.
"""

from pydantic import BaseModel, ConfigDict, Field
from typing import Dict, List, Optional, Any


class MultiHopConversionRequest(BaseModel):
    """Request model for multi-hop conversion endpoint."""
    sourceFormat: str = Field(..., description="Source format (e.g., MT103)")
    targetFormat: str = Field(..., description="Target format (e.g., pacs.008)")
    message: str = Field(..., description="Source message to convert")
    useJsonBridge: bool = Field(
        default=True,
        description="Use canonical JSON as intermediate format"
    )
    useAi: bool = Field(
        default=True,
        description="Use AI lane for unstructured fields (false = rules/regex only)"
    )

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "examples": [
                {
                    "sourceFormat": "MT103",
                    "targetFormat": "pacs.008",
                    "message": "{1:F01BANK...}{4:\n:20:REF123\n:23B:CRED\n...}",
                    "useJsonBridge": True,
                    "useAi": True
                }
            ]
        },
    )


class HealthResponse(BaseModel):
    """Health check response (not a BIAN route — left as-is)."""
    status: str = Field(..., description="Service status")
    mongodb: str = Field(..., description="MongoDB connection status")
    bedrock: str = Field(..., description="AWS Bedrock status")
    version: str = Field(..., description="Service version")


class AutoConfigureRequest(BaseModel):
    """Request model for auto-configure endpoint."""
    sourceFormat: str = Field(..., description="Source format (e.g., MT202)")
    targetFormat: str = Field(..., description="Target format (e.g., JSON)")
    sampleMessage: str = Field(..., description="Sample message to learn from")

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "examples": [
                {
                    "sourceFormat": "MT202",
                    "targetFormat": "JSON",
                    "sampleMessage": "{1:F01CHASUS33AXXX...}{4:\n:20:MT202TEST\n:21:REF2024\n:32A:241215EUR500000,00\n...}"
                }
            ]
        },
    )


class AutoConfigureResponse(BaseModel):
    """Response envelope for auto-configure endpoint.

    Envelope shape:
      configurationId (refId)  - generated configuration ID
      config           (record) - the generated configuration document
      <telemetry...>            - flat at envelope root (matches accounts pattern)
    """
    configurationId: str = Field(..., description="Generated configuration ID")
    config: Dict[str, Any] = Field(..., description="Generated configuration")
    confidence: float = Field(..., description="Target coverage ratio: (mapped + ai) / required")
    sourceFieldsIdentified: int = Field(..., description="Number of source fields extracted from message")
    targetFieldsRequired: int = Field(..., description="Total fields in target format specification")
    targetFieldsMapped: int = Field(..., description="Target fields covered by pattern-matched source fields")
    targetFieldsAi: int = Field(..., description="Target fields covered by AI suggestions for unknown source fields")
    matchedFields: List[str] = Field(..., description="Source field IDs matched from existing configs")
    unknownFields: List[str] = Field(..., description="Source field IDs not found in any existing config")
    learnedFrom: List[str] = Field(..., description="Config IDs used for learning")
    notCoveredFields: List[str] = Field(default=[], description="Target field names with no source or AI mapping")
    suggestions: List[Dict[str, Any]] = Field(default=[], description="LLM-suggested mappings for unknown fields (display-only)")
    llmPromptInfo: Optional[Dict[str, Any]] = Field(default=None, description="LLM prompt construction details for frontend display")


class ApproveConfigResponse(BaseModel):
    """Response envelope for approve config endpoint."""
    configurationId: str = Field(..., description="Configuration ID")
    status: str = Field(..., description="Approval status (e.g., 'approved')")


class HumanReviewDecision(BaseModel):
    """Human reviewer's decision on proposed change (legacy /api/v1/* route — snake_case retained)."""
    approved: bool = Field(..., description="Whether the change is approved")
    modified_value: Optional[str] = Field(default=None, description="Optional modified value")


class ResumeAgentRequest(BaseModel):
    """Request to resume agent workflow after human review (legacy /api/v1/* route)."""
    thread_id: str = Field(..., description="Thread ID from the review_required event")
    decision: HumanReviewDecision = Field(..., description="Human reviewer's decision")


class AIReviewDecision(BaseModel):
    """Human's decision on AI-extracted fields (legacy /api/v1/* route)."""
    approved: bool = Field(..., description="Whether all AI extractions are approved")
    corrections: Optional[Dict[str, Any]] = Field(default=None, description="Optional corrections to AI extractions")


class ResumeAIReviewRequest(BaseModel):
    """Request to resume conversion after AI field review (legacy /api/v1/* route)."""
    conversion_run_id: str = Field(..., description="Conversion run ID from ai_review_required event")
    decision: AIReviewDecision = Field(..., description="Human reviewer's decision on AI fields")
