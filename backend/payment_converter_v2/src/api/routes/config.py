"""Configuration management endpoints (config-builder page) — BIAN v14 URL convention.

Service Domain: PaymentOrderInitiation
Control Record: PaymentOrderInitiationTransaction
BIAN v14 valid BQs for this SD: Compliance, Confirmation, OrderInitiation.
CR-level actions: Initiate, Retrieve, Update.

Mapping rationale:
  - List conversion configs  -> OrderInitiation.Retrieve
  - List format specs        -> Compliance.Retrieve   (format specs are compliance/standards reference data)
  - Auto-configure (propose) -> OrderInitiation.Exchange  (LLM proposes a draft, awaits human review)
  - Approve config           -> CR.Update             (finalize draft to approved state)
"""

from fastapi import APIRouter, HTTPException, status
from datetime import datetime, timedelta
import logging
import uuid

from pydantic import BaseModel, Field

from src.api.models import (
    AutoConfigureRequest,
    AutoConfigureResponse,
    ApproveConfigResponse,
)
from src.api.dependencies import mongodb_service, semantic_learning_service

logger = logging.getLogger(__name__)
router = APIRouter()


class ApproveConfigRequest(BaseModel):
    """Body for the CR-level Update endpoint — replaces the legacy {config_id} path param."""
    paymentMessageConversionReference: str = Field(
        ..., description="The conversion ID to approve (e.g. 'MT103_to_JSON')."
    )


@router.post(
    "/PaymentOrderInitiationTransaction/OrderInitiation/Retrieve",
    status_code=status.HTTP_200_OK,
)
async def list_all_configs():
    """
    List all conversion configurations with full details.

    Returns complete config documents from MongoDB for the Config Builder UI.
    """
    try:
        configs = await mongodb_service.list_configs()
        return {"configs": configs}
    except Exception as e:
        logger.error(f"Failed to list configs: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list configs: {str(e)}"
        )


@router.post(
    "/PaymentOrderInitiationTransaction/Compliance/Retrieve",
    status_code=status.HTTP_200_OK,
)
async def list_format_specifications():
    """
    List all target format specifications.

    Returns format specs from MongoDB for the Config Builder target format dropdown.
    """
    try:
        specs = await mongodb_service.list_format_specifications()
        return {"specifications": specs}
    except Exception as e:
        logger.error(f"Failed to list format specifications: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list format specifications: {str(e)}"
        )


@router.post(
    "/PaymentOrderInitiationTransaction/OrderInitiation/Exchange",
    response_model=AutoConfigureResponse,
    status_code=status.HTTP_200_OK,
)
async def auto_configure(request: AutoConfigureRequest) -> AutoConfigureResponse:
    """
    Auto-generate a conversion configuration by learning from existing configs.

    Uses semantic learning to extract fields from the sample message,
    match against known patterns, and generate a new config.
    Stored temporarily (5 min TTL) for review.
    """
    try:
        logger.info(f"Auto-configure: {request.source_format} → {request.target_format}")

        result = await semantic_learning_service.generate_config(
            source_format=request.source_format,
            target_format=request.target_format,
            sample_message=request.sample_message
        )

        config_id = result["configuration_id"]
        await mongodb_service.save_temp_config(
            config_id=config_id,
            config=result["config"],
            ttl_seconds=300
        )

        logger.info(
            f"Generated config {config_id}: "
            f"source={result['source_fields_identified']}, "
            f"target_required={result['target_fields_required']}, "
            f"mapped={result['target_fields_mapped']}, "
            f"ai={result['target_fields_ai']}, "
            f"confidence={result['confidence']}"
        )

        return AutoConfigureResponse(
            configuration_id=result["configuration_id"],
            config=result["config"],
            confidence=result["confidence"],
            source_fields_identified=result["source_fields_identified"],
            target_fields_required=result["target_fields_required"],
            target_fields_mapped=result["target_fields_mapped"],
            target_fields_ai=result["target_fields_ai"],
            matched_fields=result["matched_fields"],
            unknown_fields=result["unknown_fields"],
            learned_from=result["learned_from"],
            not_covered_fields=result.get("not_covered_fields", []),
            suggestions=result.get("suggestions", []),
            llm_prompt_info=result.get("llm_prompt_info")
        )

    except ValueError as e:
        logger.error(f"Auto-configure validation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Auto-configure failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Auto-configure failed: {str(e)}"
        )


@router.post(
    "/PaymentOrderInitiationTransaction/Update",
    response_model=ApproveConfigResponse,
    status_code=status.HTTP_200_OK,
)
async def approve_config(body: ApproveConfigRequest) -> ApproveConfigResponse:
    """
    Approve and save an auto-generated configuration with 10-minute TTL.

    Moves config from temporary storage to conversionConfigs collection.
    A unique session suffix prevents ID conflicts between users.
    """
    config_id = body.paymentMessageConversionReference
    try:
        logger.info(f"Approving config: {config_id}")

        temp_config = await mongodb_service.get_temp_config(config_id)
        if not temp_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Config not found or expired: {config_id}"
            )

        # Clean up temp markers
        if "map" in temp_config:
            for mapping in temp_config["map"]:
                mapping.pop("_unknown", None)

        # Generate unique ID (session-unique)
        unique_suffix = uuid.uuid4().hex[:8]
        unique_config_id = f"{config_id}_{unique_suffix}"
        temp_config["_id"] = unique_config_id

        # Add 10-minute TTL for config-builder configs
        temp_config["expires_at"] = datetime.utcnow() + timedelta(minutes=10)

        # Ensure TTL index exists (idempotent)
        await mongodb_service.ensure_configs_ttl_index()

        await mongodb_service.insert_config(temp_config)
        await mongodb_service.delete_temp_config(config_id)

        logger.info(f"Config {unique_config_id} approved and saved (expires in 10 min)")

        return ApproveConfigResponse(
            status="approved",
            configuration_id=unique_config_id
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to approve config: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to approve config: {str(e)}"
        )
