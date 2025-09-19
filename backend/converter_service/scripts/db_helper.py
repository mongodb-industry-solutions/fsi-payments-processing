"""
Database helper for scripts
Provides simple database connection management for scripts that can't use FastAPI dependency injection
"""

import os
import sys
from pathlib import Path
from typing import Optional, Tuple
from functools import lru_cache

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from services.db_service import MongoDBService
from services.schema_enforcer import SafeMongoDBService
from config.settings import Settings, get_settings
from services.ai_service import BedrockService

# Cache instances to avoid repeated connections
_db_cache: Optional[MongoDBService] = None
_safe_db_cache: Optional[SafeMongoDBService] = None
_settings_cache: Optional[Settings] = None


@lru_cache(maxsize=1)
def get_settings_cached() -> Settings:
    """
    Get cached settings instance
    Uses lru_cache for automatic caching
    """
    return get_settings()


def get_db() -> MongoDBService:
    """
    Get MongoDB service instance for scripts
    Returns cached instance to avoid multiple connections

    Usage:
        from db_helper import get_db

        db = get_db()
        config = db.db['conversion_registry'].find_one({"_id": config_id})
    """
    global _db_cache

    if _db_cache is None:
        settings = get_settings_cached()
        _db_cache = MongoDBService(
            connection_string=settings.mongodb_uri,
            database_name=settings.database_name
        )
        print(f"Connected to MongoDB: {settings.database_name}")

    return _db_cache


def get_safe_db() -> SafeMongoDBService:
    """
    Get SafeMongoDBService wrapper for schema enforcement
    Useful when writing configurations to ensure schema compliance

    Usage:
        from db_helper import get_safe_db

        safe_db = get_safe_db()
        safe_db.insert_conversion_config(config)
    """
    global _safe_db_cache

    if _safe_db_cache is None:
        db_service = get_db()
        _safe_db_cache = SafeMongoDBService(db_service)

    return _safe_db_cache


def get_db_and_settings() -> Tuple[MongoDBService, Settings]:
    """
    Get both database and settings in one call
    Convenience function for scripts that need both

    Usage:
        from db_helper import get_db_and_settings

        db, settings = get_db_and_settings()
    """
    return get_db(), get_settings_cached()


def get_ai_service(config: Optional[dict] = None) -> BedrockService:
    """
    Get AI service instance for scripts

    Args:
        config: Optional AI configuration dict. If not provided,
                will try to get from existing configs or use defaults

    Usage:
        from db_helper import get_ai_service

        ai_service = get_ai_service()
        # Or with specific config
        ai_service = get_ai_service(config['ai_service'])
    """
    if config:
        return BedrockService(config)

    # Try to get from existing configuration
    try:
        db = get_db()
        sample_config = db.db['conversion_registry'].find_one(
            {'ai_service': {'$exists': True, '$ne': None}}
        )
        if sample_config and sample_config.get('ai_service'):
            return BedrockService(sample_config['ai_service'])
    except Exception:
        pass

    # Default configuration
    return BedrockService({
        "provider": "bedrock",
        "region": "us-east-1",
        "models": {
            "claude-3-haiku": {
                "model_id": "anthropic.claude-3-haiku-20240307-v1:0"
            }
        }
    })


def cleanup():
    """
    Clean up database connections
    Should be called at the end of scripts if needed
    """
    global _db_cache, _safe_db_cache

    if _db_cache and hasattr(_db_cache, 'client'):
        try:
            _db_cache.client.close()
            print("Database connection closed")
        except Exception:
            pass

    _db_cache = None
    _safe_db_cache = None


def validate_connection() -> bool:
    """
    Validate database connection
    Useful for scripts that want to check connection before proceeding

    Returns:
        True if connection is successful, False otherwise
    """
    try:
        db = get_db()
        # Try a simple operation
        db.db.list_collection_names()
        return True
    except Exception as e:
        print(f"Database connection failed: {e}")
        return False


def ensure_collections_exist():
    """
    Ensure required collections exist in the database
    Creates them if they don't exist
    """
    db = get_db()
    required_collections = [
        'conversion_registry',
        'semantic_patterns',
        'conversion_graph',
        'conversion_paths',
        'conversion_results',
        'human_review_queue'
    ]

    existing = set(db.db.list_collection_names())
    for collection in required_collections:
        if collection not in existing:
            db.db.create_collection(collection)
            print(f"Created collection: {collection}")


# Context manager for automatic cleanup
class DatabaseConnection:
    """
    Context manager for database connections in scripts

    Usage:
        from db_helper import DatabaseConnection

        with DatabaseConnection() as (db, settings):
            # Use db and settings
            config = db.db['conversion_registry'].find_one(...)
        # Connection automatically cleaned up
    """

    def __enter__(self):
        return get_db_and_settings()

    def __exit__(self, exc_type, exc_val, exc_tb):
        cleanup()


# Convenience function for scripts
def main_script_setup():
    """
    Standard setup for scripts
    Loads environment, validates connection, returns db and settings

    Usage:
        from db_helper import main_script_setup

        db, settings = main_script_setup()
    """
    from dotenv import load_dotenv

    # Load environment variables
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
        print(f"Loaded environment from: {env_path}")

    # Validate connection
    if not validate_connection():
        print("Failed to connect to database. Check your MONGODB_URI in .env")
        sys.exit(1)

    return get_db_and_settings()