"""Configuration settings for Payment Agent System"""

from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # MongoDB Configuration
    mongodb_uri: str = Field(..., description="MongoDB connection URI")
    database_name: str = Field(default="leafy_bank_bian", description="Database name")

    # AWS Bedrock Configuration (for Claude via Bedrock)
    aws_region: str = Field(default="us-east-1", description="AWS Region for Bedrock")
    aws_profile: Optional[str] = Field(default=None, description="AWS Profile (optional)")

    # Service Configuration
    log_level: str = Field(default="INFO", description="Logging level")

    # Agent LLM Configuration
    agent_model_id: str = Field(default="arn:aws:bedrock:us-east-1:275662791714:application-inference-profile/q93cifjfcpa1", description="Bedrock model ID for agents")
    agent_temperature: float = Field(default=0.1, description="Default temperature for agent LLM")
    execution_temperature: float = Field(default=0.0, description="Temperature for execution agent (deterministic)")

    # Atlas Search Configuration
    atlas_search_enabled: bool = Field(default=True, description="Enable Atlas Search fuzzy matching")
    fuzzy_search_min_score: float = Field(default=0.5, description="Minimum score for fuzzy search results")
    atlas_search_max_edits: int = Field(default=2, description="Max edit distance for fuzzy matching (1-2)")

    # Vector Search Configuration
    vector_search_enabled: bool = Field(default=True, description="Enable Atlas Vector Search")
    voyage_api_key: str = Field(default="", description="Voyage AI API key for embeddings")
    embedding_model: str = Field(default="voyage-3", description="Voyage AI embedding model")
    embedding_dimensions: int = Field(default=1024, description="Embedding vector dimensions")
    vector_search_min_score: float = Field(default=0.5, description="Minimum similarity score for vector search")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"  # Ignore extra fields in .env
    )


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# Create a singleton instance
settings = get_settings()