"""Application settings using Pydantic"""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # MongoDB Configuration
    mongodb_uri: str = Field(..., description="MongoDB connection URI")
    database_name: str = Field(default="fsi-payments-processing", description="Database name")
    
    # AWS Configuration (boto3 uses default credential chain)
    aws_default_region: str = Field(default="us-east-1", description="AWS Region")
    
    # AI Configuration
    ai_confidence_threshold: float = Field(default=0.8, description="AI confidence threshold for human review")
    ai_model_haiku: str = Field(
        default="anthropic.claude-3-haiku-20240307-v1:0",
        description="Haiku model ID for simple AI tasks"
    )
    ai_model_sonnet: str = Field(
        default="anthropic.claude-3-5-sonnet-20240620-v1:0",
        description="Sonnet model ID for complex AI tasks"
    )
    
    # Service Configuration
    log_level: str = Field(default="INFO", description="Logging level")
    api_port: int = Field(default=8001, description="API port")
    cors_origins: str = Field(
        default="http://localhost:3000,http://localhost:3001",
        description="Comma-separated CORS origins"
    )

    # Payment Agent Integration
    payment_agent_url: str = Field(
        default="http://localhost:8002",
        description="Payment agent service URL"
    )
    payment_agent_timeout: int = Field(
        default=30,
        description="Payment agent request timeout in seconds"
    )

    # Solana Configuration (Crypto/Blockchain Payments)
    solana_rpc_endpoint: str = Field(
        default="https://api.devnet.solana.com",
        description="Solana RPC endpoint URL"
    )
    solana_private_key: str = Field(
        default="",
        description="Base58-encoded private key for sender wallet"
    )
    solana_network: str = Field(
        default="devnet",
        description="Solana network: devnet, testnet, or mainnet-beta"
    )
    solana_private_key_2: str = Field(
        default="",
        description="Base58-encoded private key for receiver wallet (for auto-refund)"
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"  # Ignore extra fields from converter_service .env
    )
    
    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins as a list"""
        return [origin.strip() for origin in self.cors_origins.split(",")]


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()

