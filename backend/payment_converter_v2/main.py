"""FastAPI Application Entry Point"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import asyncio

from config import get_settings
from src.api import router
from src.services.circle_service import get_circle_service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# Initialize settings
settings = get_settings()


async def fund_all_wallets():
    """Request faucet funds for all wallets."""
    try:
        circle = get_circle_service()
        if circle and circle.api_key:
            wallets = circle.list_wallets().get("data", {}).get("wallets", [])
            for w in wallets:
                addr = w.get("address")
                circle.fund_usdc(addr)
                circle.fund_gas(addr)
                logger.info(f"Faucet requested for {addr[:10]}...")
    except Exception as e:
        logger.warning(f"Auto-fund failed: {e}")


async def hourly_faucet_task():
    """Request faucet funds every hour."""
    while True:
        await asyncio.sleep(3600)  # 1 hour
        logger.info("Hourly faucet request starting...")
        await fund_all_wallets()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Fund wallets on startup and schedule hourly refills."""
    await fund_all_wallets()
    task = asyncio.create_task(hourly_faucet_task())
    yield
    task.cancel()


# Create FastAPI app
app = FastAPI(
    title="Payment Converter V2",
    description="Simplified generic payment format converter with 3-lane processing (RULES/AI/HUMAN)",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(router, prefix="/api/v1")

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint - Service information"""
    return {
        "service": "Payment Converter V2",
        "version": "2.0.0",
        "status": "✅ Phase 1, 2, 3 & 4 Complete - Fully Operational",
        "completed": [
            "Phase 1: Core Services (Extractor, Transformer, Builder)",
            "Phase 2: Infrastructure (MongoDB, Bedrock, AI Lane)",
            "Phase 3: Application Layer (Converter Orchestration)",
            "Phase 4: API Layer (FastAPI Endpoints)"
        ],
        "capabilities": {
            "conversion_formats": ["MT103 → pacs.008", "...more via MongoDB configs"],
            "processing_lanes": ["RULES (80%)", "AI (15%)", "HUMAN (5%)"],
            "ai_models": ["Claude Haiku", "Claude Sonnet"]
        },
        "endpoints": {
            "docs": "/docs",
            "health": "/health",
            "api": "/api/v1"
        }
    }


# Health check
@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "phase": "All Phases Complete",
        "ready": True
    }


if __name__ == "__main__":
    import uvicorn
    
    logger.info(f"Starting Payment Converter V2 on port {settings.api_port}")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.api_port,
        reload=True
    )

