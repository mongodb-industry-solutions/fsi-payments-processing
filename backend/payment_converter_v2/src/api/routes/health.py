"""Health check endpoints (operational — kept outside the BIAN URL convention)."""

from fastapi import APIRouter, HTTPException, status
import logging

from src.api.models import HealthResponse
from src.api.dependencies import mongodb_service, bedrock_service, solana_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/api/v1/health", response_model=HealthResponse, status_code=status.HTTP_200_OK)
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


@router.get("/api/v1/solana/health", status_code=status.HTTP_200_OK)
async def solana_health_check():
    """Check Solana devnet RPC connectivity and wallet status."""
    if solana_service is None:
        return {
            "healthy": False,
            "network": None,
            "current_slot": None,
            "wallet_balance_sol": None,
            "error": "Solana service not configured"
        }

    try:
        result = solana_service.health_check()
        return {
            "healthy": result.get("healthy", False),
            "network": result.get("network"),
            "current_slot": result.get("current_slot"),
            "wallet_balance_sol": result.get("wallet", {}).get("balance_sol") if result.get("wallet") else None,
            "error": result.get("error")
        }
    except Exception as e:
        logger.error(f"Solana health check failed: {e}")
        return {
            "healthy": False,
            "network": None,
            "current_slot": None,
            "wallet_balance_sol": None,
            "error": str(e)
        }


