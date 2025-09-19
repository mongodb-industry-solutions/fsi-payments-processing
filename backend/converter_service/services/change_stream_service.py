"""
MongoDB Change Stream Service for real-time configuration monitoring
Simple implementation for demo purposes
"""

import asyncio
import logging
from typing import Dict, Any, List, Callable, Optional
from datetime import datetime
from pymongo import MongoClient
from pymongo.errors import PyMongoError
import threading

logger = logging.getLogger(__name__)


class ChangeStreamService:
    """
    Simple MongoDB change stream service for monitoring configuration updates
    Demo-focused implementation without complex error recovery
    """

    def __init__(self, mongodb_uri: str, database_name: str):
        """
        Initialize change stream service

        Args:
            mongodb_uri: MongoDB connection string
            database_name: Database to monitor
        """
        self.client = MongoClient(mongodb_uri)
        self.db = self.client[database_name]
        self.listeners: List[Callable] = []
        self.running = False
        self.watch_thread = None

    def add_listener(self, callback: Callable[[Dict[str, Any]], None]):
        """
        Add a listener for change events

        Args:
            callback: Function to call when changes occur
        """
        self.listeners.append(callback)
        logger.info(f"Added change stream listener: {callback.__name__}")

    def remove_listener(self, callback: Callable):
        """Remove a listener"""
        if callback in self.listeners:
            self.listeners.remove(callback)

    def start_watching(self):
        """Start watching for changes in a separate thread"""
        if self.running:
            logger.warning("Change stream already running")
            return

        self.running = True
        self.watch_thread = threading.Thread(target=self._watch_changes, daemon=True)
        self.watch_thread.start()
        logger.info("Started MongoDB change stream watcher")

    def stop_watching(self):
        """Stop watching for changes"""
        self.running = False
        if self.watch_thread:
            self.watch_thread.join(timeout=2)
        logger.info("Stopped MongoDB change stream watcher")

    def _watch_changes(self):
        """
        Main change stream watching loop
        Monitors conversion_registry for updates to auto-generated configs
        """
        # Pipeline to filter for auto-generated configs only
        pipeline = [
            {
                '$match': {
                    'operationType': {'$in': ['insert', 'update', 'replace']},
                    'ns.coll': 'conversion_registry',
                    '$or': [
                        {'fullDocument.metadata.auto_generated': True},
                        {'updateDescription.updatedFields.metadata.auto_generated': True}
                    ]
                }
            }
        ]

        try:
            # Start watching with full document on updates
            with self.db.watch(pipeline, full_document='updateLookup') as stream:
                logger.info("Change stream connected, monitoring conversion_registry")

                while self.running:
                    # Check for changes (with timeout to allow clean shutdown)
                    if stream.try_next():
                        change = stream.next()
                        self._handle_change(change)
                    else:
                        # No changes, sleep briefly
                        threading.Event().wait(0.1)

        except PyMongoError as e:
            logger.error(f"Change stream error: {e}")
            # Simple reconnect after error
            if self.running:
                logger.info("Attempting to reconnect change stream in 5 seconds...")
                threading.Event().wait(5)
                if self.running:
                    self._watch_changes()  # Recursive retry
        except Exception as e:
            logger.error(f"Unexpected error in change stream: {e}")

    def _handle_change(self, change: Dict[str, Any]):
        """
        Handle a change event from MongoDB

        Args:
            change: Change event from MongoDB
        """
        try:
            # Extract key information
            operation = change.get('operationType')
            config_id = change.get('documentKey', {}).get('_id')
            full_document = change.get('fullDocument')

            # Create simplified event for listeners
            event = {
                'type': 'config_change',
                'operation': operation,
                'config_id': config_id,
                'timestamp': datetime.utcnow().isoformat(),
                'confidence': None,
                'summary': None
            }

            # Extract confidence if available
            if full_document:
                metadata = full_document.get('metadata', {})
                event['confidence'] = metadata.get('generation_confidence', 0)
                event['summary'] = self._create_change_summary(operation, config_id, full_document)

            logger.info(f"Change detected: {operation} on {config_id}, confidence: {event['confidence']}")

            # Notify all listeners
            for listener in self.listeners:
                try:
                    listener(event)
                except Exception as e:
                    logger.error(f"Error in change listener {listener.__name__}: {e}")

        except Exception as e:
            logger.error(f"Error handling change event: {e}")

    def _create_change_summary(self, operation: str, config_id: str, document: Dict[str, Any]) -> str:
        """
        Create a human-readable summary of the change

        Args:
            operation: Type of operation
            config_id: Configuration ID
            document: Full document

        Returns:
            Summary string
        """
        if operation == 'insert':
            confidence = document.get('metadata', {}).get('generation_confidence', 0)
            return f"New configuration {config_id} auto-generated with {confidence:.1%} confidence"
        elif operation in ['update', 'replace']:
            confidence = document.get('metadata', {}).get('generation_confidence', 0)
            return f"Configuration {config_id} updated, confidence now {confidence:.1%}"
        else:
            return f"Configuration {config_id} changed ({operation})"


# Singleton instance for easy access
_change_stream_instance = None


def get_change_stream_service(mongodb_uri: str, database_name: str) -> ChangeStreamService:
    """
    Get or create the singleton change stream service

    Args:
        mongodb_uri: MongoDB connection string
        database_name: Database name

    Returns:
        ChangeStreamService instance
    """
    global _change_stream_instance
    if _change_stream_instance is None:
        _change_stream_instance = ChangeStreamService(mongodb_uri, database_name)
    return _change_stream_instance


def start_change_stream_monitoring(mongodb_uri: str, database_name: str) -> ChangeStreamService:
    """
    Convenience function to start change stream monitoring

    Args:
        mongodb_uri: MongoDB connection string
        database_name: Database name

    Returns:
        Running ChangeStreamService instance
    """
    service = get_change_stream_service(mongodb_uri, database_name)
    service.start_watching()
    return service