"""MongoDB Service - Database operations for configuration management"""

from typing import Dict, Any, Optional, List
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
import logging

from config.validator import validate_config

logger = logging.getLogger(__name__)


class MongoDBService:
    """
    MongoDB service for managing conversion configurations.
    
    Handles all database operations with automatic validation.
    Uses async Motor driver for FastAPI compatibility.
    """
    
    def __init__(self, mongodb_uri: str, database_name: str):
        """
        Initialize MongoDB service.
        
        Args:
            mongodb_uri: MongoDB connection string
            database_name: Database name to use
        """
        self.client: AsyncIOMotorClient = AsyncIOMotorClient(mongodb_uri)
        self.db: AsyncIOMotorDatabase = self.client[database_name]
        self.configs_collection = self.db["conversion_configs"]
        self.prompts_collection = self.db["ai_prompts"]
        
        logger.info(f"MongoDB service initialized for database: {database_name}")
    
    async def get_config(self, config_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve a conversion configuration by ID.
        
        Args:
            config_id: Configuration ID (format: {source}_to_{target})
            
        Returns:
            Configuration dictionary or None if not found
        """
        try:
            config = await self.configs_collection.find_one({"_id": config_id})
            
            if config:
                logger.debug(f"Retrieved config: {config_id}")
                # Validate on retrieval (runtime protection)
                try:
                    validate_config(config)
                except ValueError as e:
                    logger.error(f"Invalid config in database: {config_id} - {e}")
                    raise ValueError(f"Config {config_id} violates schema: {e}")
            else:
                logger.warning(f"Config not found: {config_id}")
            
            return config
            
        except Exception as e:
            logger.error(f"Error retrieving config {config_id}: {e}")
            raise
    
    async def insert_config(self, config: Dict[str, Any]) -> bool:
        """
        Insert a new configuration (with validation).
        
        Args:
            config: Configuration dictionary to insert
            
        Returns:
            True if successful
            
        Raises:
            ValueError: If config is invalid or already exists
        """
        try:
            # Validate before insert (enforcement layer)
            validate_config(config)
            
            # Check for duplicates
            existing = await self.get_config(config["_id"])
            if existing:
                raise ValueError(f"Config {config['_id']} already exists")
            
            # Insert
            result = await self.configs_collection.insert_one(config)
            
            if result.inserted_id:
                logger.info(f"✅ Config inserted: {config['_id']}")
                return True
            
            return False
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error inserting config: {e}")
            raise
    
    async def update_config(self, config_id: str, config: Dict[str, Any]) -> bool:
        """
        Update an existing configuration (with validation).
        
        Args:
            config_id: Configuration ID to update
            config: New configuration dictionary
            
        Returns:
            True if successful
            
        Raises:
            ValueError: If config is invalid
        """
        try:
            # Validate before update
            validate_config(config)
            
            # Ensure _id matches
            if config["_id"] != config_id:
                raise ValueError(f"Config _id mismatch: {config['_id']} != {config_id}")
            
            # Replace entire document
            result = await self.configs_collection.replace_one(
                {"_id": config_id},
                config,
                upsert=False
            )
            
            if result.modified_count > 0:
                logger.info(f"✅ Config updated: {config_id}")
                return True
            
            logger.warning(f"No config found to update: {config_id}")
            return False
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error updating config {config_id}: {e}")
            raise
    
    async def delete_config(self, config_id: str) -> bool:
        """
        Delete a configuration.
        
        Args:
            config_id: Configuration ID to delete
            
        Returns:
            True if deleted, False if not found
        """
        try:
            result = await self.configs_collection.delete_one({"_id": config_id})
            
            if result.deleted_count > 0:
                logger.info(f"Config deleted: {config_id}")
                return True
            
            logger.warning(f"No config found to delete: {config_id}")
            return False
            
        except Exception as e:
            logger.error(f"Error deleting config {config_id}: {e}")
            raise
    
    async def list_configs(self) -> List[Dict[str, Any]]:
        """
        List all available conversion configurations.
        
        Returns:
            List of configuration dictionaries
        """
        try:
            cursor = self.configs_collection.find()
            configs = await cursor.to_list(length=None)
            
            logger.debug(f"Retrieved {len(configs)} configs")
            return configs
            
        except Exception as e:
            logger.error(f"Error listing configs: {e}")
            raise
    
    async def get_ai_prompt(self, field_type: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve AI prompt template for a field type.
        
        Args:
            field_type: Field type (e.g., 'remittance', 'instructions')
            
        Returns:
            Prompt dictionary or None if not found
        """
        try:
            prompt = await self.prompts_collection.find_one({"_id": field_type})
            
            if prompt:
                logger.debug(f"Retrieved AI prompt: {field_type}")
            else:
                logger.debug(f"No custom prompt for: {field_type}, will use default")
            
            return prompt
            
        except Exception as e:
            logger.error(f"Error retrieving AI prompt {field_type}: {e}")
            return None
    
    async def insert_ai_prompt(self, field_type: str, prompt: str, model: str = "claude-3-haiku") -> bool:
        """
        Insert or update an AI prompt template.
        
        Args:
            field_type: Field type identifier
            prompt: Prompt template string
            model: AI model to use
            
        Returns:
            True if successful
        """
        try:
            prompt_doc = {
                "_id": field_type,
                "prompt": prompt,
                "model": model
            }
            
            result = await self.prompts_collection.replace_one(
                {"_id": field_type},
                prompt_doc,
                upsert=True
            )
            
            logger.info(f"AI prompt saved: {field_type}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving AI prompt {field_type}: {e}")
            raise
    
    async def health_check(self) -> bool:
        """
        Check if MongoDB connection is healthy.
        
        Returns:
            True if healthy
        """
        try:
            await self.client.admin.command('ping')
            return True
        except Exception as e:
            logger.error(f"MongoDB health check failed: {e}")
            return False
    
    def close(self):
        """Close MongoDB connection"""
        self.client.close()
        logger.info("MongoDB connection closed")

