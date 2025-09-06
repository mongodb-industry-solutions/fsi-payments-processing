from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter
from datetime import datetime
from db.mdb import MongoDBConnector
from api import formats, rules, input, conversion

from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="Payment Format Conversion API",
    description="AI-powered payment format conversion system",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter()

# Include API routers
app.include_router(formats.router, prefix="/api/v1/formats", tags=["formats"])
app.include_router(rules.router, prefix="/api/v1/rules", tags=["rules"])
app.include_router(input.router, prefix="/api/v1/input", tags=["input"])
app.include_router(conversion.router, tags=["conversion"])

@app.get("/")
async def read_root(request: Request):
    return {"message":"Payment Format Conversion API is running"}

@app.get("/health")
async def health_check():
    """Health check endpoint to verify service status and dependencies"""
    
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "payment-format-conversion",
        "version": "1.0.0",
        "checks": {}
    }
    
    # Check MongoDB connection
    try:
        mdb = MongoDBConnector()
        # Try a simple ping to verify connection
        mdb.db.command('ping')
        health_status["checks"]["mongodb"] = {
            "status": "connected",
            "database": mdb.database_name
        }
    except Exception as e:
        health_status["status"] = "unhealthy"
        health_status["checks"]["mongodb"] = {
            "status": "disconnected",
            "error": str(e)
        }
    
    # Check data availability
    try:
        from pathlib import Path
        data_path = Path("data")
        mt103_count = len(list((data_path / "mt103").glob("*.txt")))
        pacs008_count = len(list((data_path / "pacs008").glob("*.xml")))
        
        health_status["checks"]["test_data"] = {
            "status": "available",
            "mt103_samples": mt103_count,
            "pacs008_samples": pacs008_count
        }
    except Exception as e:
        health_status["checks"]["test_data"] = {
            "status": "unavailable",
            "error": str(e)
        }
    
    return health_status