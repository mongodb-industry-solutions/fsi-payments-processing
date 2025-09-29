"""
Database Service - MongoDB abstraction layer
"""

from typing import Dict, Any, Optional
import logging
from pymongo import MongoClient
from pymongo.database import Database

logger = logging.getLogger(__name__)


class MongoDBService:
    """MongoDB service for converter operations"""
    
    def __init__(self, connection_string: str, database_name: str):
        """
        Initialize MongoDB service
        
        Args:
            connection_string: MongoDB connection URI
            database_name: Name of the database to use
        """
        self.connection_string = connection_string
        self.database_name = database_name
        self.client = None
        self.db = None
        self._connect()
    
    def _connect(self):
        """Establish MongoDB connection"""
        try:
            self.client = MongoClient(self.connection_string)
            self.db = self.client[self.database_name]
            logger.info(f"Connected to MongoDB database: {self.database_name}")
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise
    
    def get_conversion_config(self, conversion_id: str) -> Optional[Dict[str, Any]]:
        """
        Get conversion configuration from database

        Checks conversion_registry first, then falls back to pending_auto_configs.
        This allows testing of auto-generated configs before they are approved.

        Args:
            conversion_id: Conversion identifier (e.g., "MT103_to_pacs.008")

        Returns:
            Configuration dictionary or None if not found
        """
        try:
            # Try production registry first
            config = self.db['conversion_registry'].find_one({
                '_id': conversion_id
            })

            if config:
                logger.info(f"Using production config: {conversion_id}")
                return config

            # Fall back to pending configs (for testing before approval)
            config = self.db['pending_auto_configs'].find_one({
                '_id': conversion_id
            })

            if config:
                logger.info(f"Using pending config (not yet approved): {conversion_id}")
                return config

            logger.warning(f"Configuration not found in registry or pending: {conversion_id}")
            return None
        except Exception as e:
            logger.error(f"Error fetching conversion config: {e}")
            return None
    
    def save_conversion_result(self, result: Dict[str, Any]) -> bool:
        """
        Save conversion result to database
        
        Args:
            result: Conversion result to save
            
        Returns:
            True if successful, False otherwise
        """
        try:
            self.db['conversion_results'].insert_one(result)
            return True
        except Exception as e:
            logger.error(f"Error saving conversion result: {e}")
            return False
    
    def close(self):
        """Close database connection"""
        if self.client:
            self.client.close()
            logger.info("MongoDB connection closed")


# Singleton instance
_mongodb_instance = None

def get_mongodb_service(connection_string: str = None, database_name: str = None) -> MongoDBService:
    """Get or create MongoDB service instance"""
    global _mongodb_instance
    
    if _mongodb_instance is None:
        if not connection_string or not database_name:
            raise ValueError("Connection string and database name required for first initialization")
        _mongodb_instance = MongoDBService(connection_string, database_name)
    
    return _mongodb_instance