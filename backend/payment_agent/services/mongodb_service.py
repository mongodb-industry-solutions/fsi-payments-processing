"""MongoDB Service for Payment Agent System"""

from typing import Dict, Any, Optional, List
import logging
from pymongo import MongoClient
from pymongo.database import Database
from pymongo.collection import Collection

logger = logging.getLogger(__name__)


class MongoDBService:
    """MongoDB service for agent operations"""

    def __init__(self, connection_string: str, database_name: str):
        """
        Initialize MongoDB service

        Args:
            connection_string: MongoDB connection URI
            database_name: Name of the database to use
        """
        self.connection_string = connection_string
        self.database_name = database_name
        self.client: Optional[MongoClient] = None
        self.db: Optional[Database] = None
        self._connect()

    def _connect(self):
        """Establish MongoDB connection"""
        try:
            self.client = MongoClient(self.connection_string)
            self.db = self.client[self.database_name]
            # Test connection
            self.client.server_info()
            logger.info(f"Connected to MongoDB database: {self.database_name}")
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise

    def get_collection(self, collection_name: str) -> Collection:
        """Get a collection from the database"""
        if self.db is None:
            raise Exception("Database not connected")
        return self.db[collection_name]

    def close(self):
        """Close MongoDB connection"""
        if self.client is not None:
            self.client.close()
            logger.info("MongoDB connection closed")


# Singleton instance holder
_mongodb_service: Optional[MongoDBService] = None


def get_mongodb_service(connection_string: str = None, database_name: str = None) -> MongoDBService:
    """
    Get or create MongoDB service singleton

    Args:
        connection_string: MongoDB URI (uses settings if not provided)
        database_name: Database name (uses settings if not provided)

    Returns:
        MongoDBService instance
    """
    global _mongodb_service

    if _mongodb_service is None:
        from config.settings import settings

        conn_str = connection_string or settings.mongodb_uri
        db_name = database_name or settings.database_name

        _mongodb_service = MongoDBService(conn_str, db_name)

    return _mongodb_service