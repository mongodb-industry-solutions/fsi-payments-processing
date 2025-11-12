"""MongoDB Service - Database operations for configuration management"""

from typing import Dict, Any, Optional, List
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from datetime import datetime
import hashlib
import json
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
        self.json_storage_collection = self.db["canonical_json_storage"]
        
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
    
    async def save_canonical_json(
        self,
        conversion_id: str,
        source_message: str,
        json_data: str,
        metadata: Dict[str, Any],
        conversion_run_id: Optional[str] = None
    ) -> str:
        """
        Save canonical JSON to MongoDB for multi-hop reuse.

        Args:
            conversion_id: Source conversion ID (e.g., "MT103_to_JSON")
            source_message: Original source message
            json_data: Canonical JSON string
            metadata: Conversion metadata (timestamp, processing time, etc.)
            conversion_run_id: Optional unique ID for this conversion run (makes each run independent)

        Returns:
            Document ID (conversion_run_id if provided, otherwise message hash)
        """
        try:
            # Create hash of source message
            message_hash = hashlib.sha256(source_message.encode()).hexdigest()

            # Use conversion_run_id as doc ID if provided (for independence)
            # Otherwise use message_hash (for backward compatibility/caching)
            doc_id = conversion_run_id if conversion_run_id else message_hash

            # Parse JSON string to dict for proper MongoDB storage
            try:
                json_dict = json.loads(json_data)
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON data: {e}")
                # Fallback: store as string if parsing fails
                json_dict = {"_raw": json_data, "_parse_error": str(e)}

            doc = {
                "_id": doc_id,
                "conversion_id": conversion_id,
                "json_data": json_dict,  # Store as dict/object, not string
                "metadata": metadata,
                "created_at": datetime.utcnow()
            }

            # Upsert to handle duplicate conversions
            await self.json_storage_collection.replace_one(
                {"_id": doc_id},
                doc,
                upsert=True
            )

            logger.info(f"Saved canonical JSON to MongoDB: {doc_id[:16]}...")
            return doc_id

        except Exception as e:
            logger.error(f"Error saving canonical JSON: {e}")
            raise
    
    async def get_canonical_json(
        self,
        source_message: str,
        conversion_run_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieve cached canonical JSON by conversion_run_id or source message hash.

        Args:
            source_message: Original source message (used if conversion_run_id not provided)
            conversion_run_id: Optional unique ID for this conversion run

        Returns:
            Document with json_data (as JSON string for compatibility) or None if not found
        """
        try:
            # Use conversion_run_id if provided, otherwise fall back to message hash
            if conversion_run_id:
                doc_id = conversion_run_id
                logger.debug(f"Looking up by conversion_run_id: {doc_id[:16]}...")
            else:
                message_hash = hashlib.sha256(source_message.encode()).hexdigest()
                doc_id = message_hash
                logger.debug(f"Looking up by message hash: {doc_id[:16]}...")

            cached = await self.json_storage_collection.find_one({"_id": doc_id})

            if cached:
                logger.debug(f"Cache HIT for ID: {doc_id[:16]}...")

                # Convert json_data dict back to string for converter compatibility
                # Use ensure_ascii=False to preserve Unicode characters (Japanese, etc.)
                if isinstance(cached.get('json_data'), dict):
                    cached['json_data'] = json.dumps(cached['json_data'], ensure_ascii=False)

            else:
                logger.debug(f"Cache MISS for ID: {doc_id[:16]}...")

            return cached

        except Exception as e:
            logger.error(f"Error retrieving canonical JSON: {e}")
            return None
    
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

