"""Health check and format listing endpoints."""

from fastapi import APIRouter, HTTPException, status
from typing import List
import logging

from src.api.models import HealthResponse, FormatInfo
from src.api.dependencies import mongodb_service, bedrock_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/health", response_model=HealthResponse, status_code=status.HTTP_200_OK)
async def health_check() -> HealthResponse:
    """
    Health check endpoint.

    Checks connectivity to MongoDB and AWS Bedrock.
    """
    try:
        mongodb_status = "connected" if await mongodb_service.health_check() else "disconnected"
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

    Returns configured conversions with source/target format names.
    """
    try:
        configs = await mongodb_service.list_configs()

        formats = []
        for config in configs:
            conversion_id = config.get("_id", "")
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
