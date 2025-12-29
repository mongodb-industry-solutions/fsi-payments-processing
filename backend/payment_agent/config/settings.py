"""Configuration settings for Payment Agent System"""

from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # MongoDB Configuration
    mongodb_uri: str = Field(..., description="MongoDB connection URI")
    database_name: str = Field(default="fsi-payments-processing", description="Database name")

    # AWS Bedrock Configuration (for Claude via Bedrock)
    aws_region: str = Field(default="us-east-1", description="AWS Region for Bedrock")
    aws_profile: Optional[str] = Field(default=None, description="AWS Profile (optional)")

    # Service Configuration
    service_port: int = Field(default=8003, description="Service port")
    log_level: str = Field(default="INFO", description="Logging level")

    # Agent Configuration
    agent_temperature: float = Field(default=0.1, description="Temperature for agent LLM")
    agent_max_retries: int = Field(default=3, description="Max retries for agent actions")
    tool_timeout_seconds: int = Field(default=30, description="Timeout for tool calls")

    # Atlas Search Configuration
    atlas_search_enabled: bool = Field(default=True, description="Enable Atlas Search fuzzy matching")
    fuzzy_search_min_score: float = Field(default=0.5, description="Minimum score for fuzzy search results")
    atlas_search_max_edits: int = Field(default=2, description="Max edit distance for fuzzy matching (1-2)")

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