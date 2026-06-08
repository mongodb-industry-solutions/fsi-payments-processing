"""MongoDB Service for Payment Agent System"""

from typing import Dict, Any, Optional, List
import logging
from pymongo import MongoClient
from pymongo.database import Database
from pymongo.collection import Collection

logger = logging.getLogger(__name__)


# Logical → physical collection aliases (BIAN reference-collection migration, 2026-06-03).
# The agent and UI keep calling the original logical names; these resolve to the
# merged/renamed physical collections, so no agent-prompt or frontend edits are needed.
# See bian-data-model/context/collection-mapping-and-demo-changes.md.
COLLECTION_ALIASES = {
    "bankDetails": "correspondentBanks",     # merged: bank_details + ifsc_codes
    "ifscCodes": "correspondentBanks",       # merged: bank_details + ifsc_codes
    "registeredEntities": "legalEntities",   # renamed
}


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
        """Get a collection from the database, resolving BIAN migration aliases."""
        if self.db is None:
            raise Exception("Database not connected")
        physical_name = COLLECTION_ALIASES.get(collection_name, collection_name)
        return self.db[physical_name]

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