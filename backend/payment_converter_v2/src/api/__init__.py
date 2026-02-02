"""API layer — combines route modules into a single router."""

from fastapi import APIRouter

from .routes.conversion import router as conversion_router
from .routes.review import router as review_router
from .routes.config import router as config_router
from .routes.health import router as health_router

router = APIRouter()
router.include_router(conversion_router)
router.include_router(review_router)
router.include_router(config_router)
router.include_router(health_router)

__all__ = ["router"]
