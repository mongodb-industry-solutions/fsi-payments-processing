"""
Main application entry point for converter service
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from converter_service.api.converter_api import router as converter_router
from converter_service.api.auto_config_routes import router as auto_config_router
from converter_service.config.settings import get_settings
from converter_service.config.feature_flags import feature_flags

# Configure logging
settings = get_settings()
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Payment Converter Service",
    description="Generic payment format conversion with AI support",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(converter_router)
app.include_router(auto_config_router, prefix="/api/v1/converter", tags=["Auto Configuration"])

# Include config review router
from api.config_review_api import router as config_review_router
app.include_router(config_review_router, prefix="/api/v1/review", tags=["Config Review"])

# Include conversion review router
from api.conversion_review_api import router as conversion_review_router
app.include_router(conversion_review_router, prefix="/api/v1/review", tags=["Conversion Review"])

# Include demo API routers if demo mode is enabled
if feature_flags.is_demo_mode():
    from converter_service.api.demo_api import router as demo_router
    from converter_service.api.demo_interactive_api import router as demo_interactive_router
    app.include_router(demo_router)
    app.include_router(demo_interactive_router)
    logger.info("Demo API endpoints enabled")


@app.on_event("startup")
async def startup_event():
    """Initialize service on startup"""
    logger.info(f"Starting {settings.service_name}")
    
    # Extract host without credentials for logging
    try:
        from urllib.parse import urlparse
        parsed_uri = urlparse(settings.mongodb_uri)
        safe_host = parsed_uri.hostname or "localhost"
        logger.info(f"MongoDB Host: {safe_host}")
    except:
        logger.info("MongoDB: Connected")
    
    logger.info(f"Database: {settings.database_name}")
    logger.info(f"AI Processing: {'Enabled' if settings.enable_ai_processing else 'Disabled'}")
    logger.info(f"Human Review: {'Enabled' if settings.enable_human_review else 'Disabled'}")
    
    # Log demo mode status
    if feature_flags.is_demo_mode():
        logger.info("Demo Mode: ENABLED")
        logger.info(f"Demo Features: {feature_flags.get_all_flags()}")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info(f"Shutting down {settings.service_name}")

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Payment Converter Service",
        "version": "1.0.0",
        "status": "running"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level=settings.log_level.lower()
    )