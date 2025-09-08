"""
Configuration settings for converter service
"""

import os
from typing import Optional
from functools import lru_cache
from dataclasses import dataclass
from pathlib import Path

# Load .env file if it exists
from dotenv import load_dotenv

# Try to load .env from converter_service directory first
converter_service_dir = Path(__file__).parent.parent
env_file = converter_service_dir / ".env"
if env_file.exists():
    load_dotenv(env_file)
else:
    # Fallback to backend directory .env
    backend_env = converter_service_dir.parent / ".env"
    if backend_env.exists():
        load_dotenv(backend_env)


@dataclass
class Settings:
    """Application settings loaded from environment variables"""
    
    # MongoDB settings
    mongodb_uri: str = "mongodb://localhost:27017"
    database_name: str = "payment_converter"
    
    # AWS Bedrock settings
    aws_region: str = "us-east-1"
    bedrock_model_id: str = "anthropic.claude-3-haiku-20240307-v1:0"
    
    # Service settings
    service_name: str = "converter-service"
    log_level: str = "INFO"
    
    # API settings
    api_prefix: str = "/api/v1"
    cors_origins: list = None
    
    # Processing settings
    ai_confidence_threshold: float = 0.8
    max_processing_time: int = 30
    
    # Feature flags
    enable_ai_processing: bool = True
    enable_human_review: bool = True
    save_all_conversions: bool = False
    
    def __post_init__(self):
        # Load from environment variables
        self.mongodb_uri = os.getenv("MONGODB_URI", self.mongodb_uri)
        self.database_name = os.getenv("DATABASE_NAME", self.database_name)
        self.aws_region = os.getenv("AWS_REGION", self.aws_region)
        self.bedrock_model_id = os.getenv("BEDROCK_MODEL_ID", self.bedrock_model_id)
        self.service_name = os.getenv("SERVICE_NAME", self.service_name)
        self.log_level = os.getenv("LOG_LEVEL", self.log_level)
        self.api_prefix = os.getenv("API_PREFIX", self.api_prefix)
        
        # Handle list type for CORS origins
        cors_env = os.getenv("CORS_ORIGINS")
        if cors_env:
            self.cors_origins = cors_env.split(",")
        else:
            self.cors_origins = ["*"]
        
        # Handle numeric types
        self.ai_confidence_threshold = float(os.getenv("AI_CONFIDENCE_THRESHOLD", str(self.ai_confidence_threshold)))
        self.max_processing_time = int(os.getenv("MAX_PROCESSING_TIME", str(self.max_processing_time)))
        
        # Handle boolean types
        self.enable_ai_processing = os.getenv("ENABLE_AI_PROCESSING", "true").lower() == "true"
        self.enable_human_review = os.getenv("ENABLE_HUMAN_REVIEW", "true").lower() == "true"
        self.save_all_conversions = os.getenv("SAVE_ALL_CONVERSIONS", "false").lower() == "true"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()