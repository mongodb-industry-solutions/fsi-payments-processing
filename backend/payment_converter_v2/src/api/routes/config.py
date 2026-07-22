"""Configuration management endpoints (config-builder page).

These are converter admin routes — they don't represent a banking control record,
so they live under /api/v1/* rather than the BIAN URL surface. Request and
response bodies remain camelCase with `extra="forbid"` (matches the rest of the
service).
"""

from fastapi import APIRouter, HTTPException, status
from datetime import datetime, timedelta
import logging
import uuid

from src.api.models import (
    AutoConfigureRequest,
    AutoConfigureResponse,
    ApproveConfigResponse,
)
from src.api.dependencies import mongodb_service, semantic_learning_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/api/v1/configs",
    status_code=status.HTTP_200_OK,
)
async def list_all_configs():
    """List all conversion configurations with full details."""
    try:
        configs = await mongodb_service.list_configs()
        return {"configs": configs}
    except Exception as e:
        logger.error(f"Failed to list configs: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list configs: {str(e)}"
        )


@router.get(
    "/api/v1/format-specifications",
    status_code=status.HTTP_200_OK,
)
async def list_format_specifications():
    """List all target format specifications."""
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
    "/api/v1/auto-configure",
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
        logger.info(f"Auto-configure: {request.sourceFormat} → {request.targetFormat}")

        result = await semantic_learning_service.generate_config(
            source_format=request.sourceFormat,
            target_format=request.targetFormat,
            sample_message=request.sampleMessage
        )

        config_id = result["configurationId"]
        await mongodb_service.save_temp_config(
            config_id=config_id,
            config=result["config"],
            ttl_seconds=300
        )

        logger.info(
            f"Generated config {config_id}: "
            f"source={result['sourceFieldsIdentified']}, "
            f"target_required={result['targetFieldsRequired']}, "
            f"mapped={result['targetFieldsMapped']}, "
            f"ai={result['targetFieldsAi']}, "
            f"confidence={result['confidence']}"
        )

        return AutoConfigureResponse(**result)

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
    "/api/v1/auto-configure/{configuration_id}/approve",
    response_model=ApproveConfigResponse,
    status_code=status.HTTP_200_OK,
)
async def approve_config(configuration_id: str) -> ApproveConfigResponse:
    """
    Approve and save an auto-generated configuration with 10-minute TTL.

    Moves config from temporary storage to conversionConfigs collection.
    A unique session suffix prevents ID conflicts between users.
    """
    try:
        logger.info(f"Approving config: {configuration_id}")

        temp_config = await mongodb_service.get_temp_config(configuration_id)
        if not temp_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Config not found or expired: {configuration_id}"
            )

        if "map" in temp_config:
            for mapping in temp_config["map"]:
                mapping.pop("_unknown", None)

        unique_suffix = uuid.uuid4().hex[:8]
        unique_config_id = f"{configuration_id}_{unique_suffix}"
        temp_config["_id"] = unique_config_id

        temp_config["expires_at"] = datetime.utcnow() + timedelta(minutes=10)

        await mongodb_service.ensure_configs_ttl_index()

        await mongodb_service.insert_config(temp_config)
        await mongodb_service.delete_temp_config(configuration_id)

        logger.info(f"Config {unique_config_id} approved and saved (expires in 10 min)")

        return ApproveConfigResponse(
            configurationId=unique_config_id,
            status="approved",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to approve config: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to approve config: {str(e)}"
        )
