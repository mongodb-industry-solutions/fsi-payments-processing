"""
Centralized dependency injection for FastAPI endpoints
Provides singleton instances and common dependencies
"""

from typing import Optional
from fastapi import Depends, HTTPException
import functools

from ..services.db_service import MongoDBService, get_mongodb_service
from ..services.ai_service import BedrockService, get_bedrock_service
from ..config.settings import Settings, get_settings
from ..config.feature_flags import feature_flags


# Cache for singleton instances
_settings_cache: Optional[Settings] = None
_db_service_cache: Optional[MongoDBService] = None
_ai_service_cache: Optional[BedrockService] = None


def get_settings_cached() -> Settings:
    """
    Get cached settings instance
    Avoids repeated environment variable parsing
    """
    global _settings_cache
    if _settings_cache is None:
        _settings_cache = get_settings()
    return _settings_cache


def get_db_service() -> MongoDBService:
    """
    Dependency injection for MongoDB service
    Returns singleton instance with connection pooling

    Usage:
        @router.get("/example")
        async def example(db: MongoDBService = Depends(get_db_service)):
            # Use db instance
    """
    global _db_service_cache
    if _db_service_cache is None:
        settings = get_settings_cached()
        _db_service_cache = get_mongodb_service(
            connection_string=settings.mongodb_uri,
            database_name=settings.database_name
        )
    return _db_service_cache


def get_ai_service() -> BedrockService:
    """
    Dependency injection for AI service
    Returns cached BedrockService instance

    Usage:
        @router.post("/ai-process")
        async def process(ai: BedrockService = Depends(get_ai_service)):
            # Use ai instance
    """
    global _ai_service_cache
    if _ai_service_cache is None:
        settings = get_settings_cached()
        # Get AI config from a sample configuration or use defaults
        try:
            db_service = get_db_service()
            # Try to get AI config from an existing configuration
            sample_config = db_service.db['conversion_registry'].find_one(
                {'ai_service': {'$exists': True}}
            )
            if sample_config and sample_config.get('ai_service'):
                _ai_service_cache = BedrockService(sample_config['ai_service'])
            else:
                # Use default configuration
                _ai_service_cache = get_bedrock_service(region="us-east-1")
        except Exception:
            # Fallback to default if database is not available
            _ai_service_cache = get_bedrock_service(region="us-east-1")

    return _ai_service_cache


def require_demo_mode():
    """
    Dependency that ensures demo mode is enabled
    Raises HTTPException if not in demo mode

    Usage:
        @router.post("/demo-only")
        async def demo_endpoint(
            _: None = Depends(require_demo_mode),
            db: MongoDBService = Depends(get_db_service)
        ):
            # This endpoint only works in demo mode
    """
    if not feature_flags.is_demo_mode():
        raise HTTPException(
            status_code=403,
            detail="Demo mode is not enabled. Set ENABLE_DEMO_MODE=true to access this endpoint."
        )
    return None


def require_feature(feature_name: str):
    """
    Dependency factory for checking specific feature flags

    Usage:
        @router.post("/ai-enhanced")
        async def ai_endpoint(
            _: None = Depends(require_feature("enable_ai_processing"))
        ):
            # Endpoint that requires AI processing to be enabled
    """
    def check_feature():
        if not feature_flags.is_enabled(feature_name):
            raise HTTPException(
                status_code=403,
                detail=f"Feature '{feature_name}' is not enabled"
            )
        return None
    return check_feature


# Optional: Cleanup function for application shutdown
def cleanup_dependencies():
    """
    Clean up cached instances on application shutdown
    Should be called in the FastAPI shutdown event
    """
    global _settings_cache, _db_service_cache, _ai_service_cache

    # Close database connections if needed
    if _db_service_cache:
        try:
            if hasattr(_db_service_cache, 'client'):
                _db_service_cache.client.close()
        except Exception:
            pass

    # Reset caches
    _settings_cache = None
    _db_service_cache = None
    _ai_service_cache = None


# Convenience function for getting both DB and settings
def get_db_and_settings():
    """
    Get both database service and settings in one call

    Usage:
        @router.get("/example")
        async def example(deps = Depends(get_db_and_settings)):
            db, settings = deps
            # Use both
    """
    return get_db_service(), get_settings_cached()