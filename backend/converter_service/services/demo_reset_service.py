"""
Demo Reset Service - Manages demo environment cleanup and reset
"""

import os
from datetime import datetime
import logging
from typing import Dict, Any, List, Optional
from pymongo import MongoClient
from pymongo.database import Database

logger = logging.getLogger(__name__)


class DemoResetService:
    """Service to reset demo environment to clean state"""

    def __init__(self, mongodb_uri: str = None, database_name: str = None):
        """Initialize with MongoDB connection"""
        self.mongodb_uri = mongodb_uri or os.getenv('MONGODB_URI', 'mongodb://localhost:27017/')
        self.database_name = database_name or os.getenv('DATABASE_NAME', 'payment_converter')

        self.client = MongoClient(self.mongodb_uri)
        self.db: Database = self.client[self.database_name]

        # Base configurations to always preserve
        self.base_configs = [
            'MT103_to_pacs.008',
            'MT202_to_pacs.009',
            # Also preserve JSON configs if they exist (for multi-hop routing)
            'MT103_to_JSON',
            'MT202_to_JSON',
            'JSON_to_pacs.008',
            'JSON_to_pacs.009',
            'pacs.008_to_JSON',
            'pacs.009_to_JSON'
        ]

        # Common demo formats that get auto-generated
        self.demo_formats = [
            'MT205_to_pacs.009',
            'MT192_to_pacs.008',
            'MT202COV_to_pacs.009',
            'MT900_to_pacs.004',
            'MT910_to_camt.054'
        ]

    def reset_to_base_state(self, reset_type: str = "auto_generated") -> Dict[str, Any]:
        """
        Reset system to base demo state

        Args:
            reset_type: Type of reset to perform
                - "auto_generated": Remove only auto-generated configs
                - "demo_formats": Remove known demo format configs
                - "all": Remove all except base configs

        Returns:
            Dictionary with reset statistics
        """

        stats = {
            'started_at': datetime.utcnow().isoformat(),
            'reset_type': reset_type,
            'configs_removed': 0,
            'configs_preserved': 0,
            'patterns_removed': 0,
            'success': False,
            'errors': []
        }

        try:
            # Count total configs before
            total_before = self.db.conversion_registry.count_documents({})

            if reset_type == "auto_generated":
                # Remove configs that were auto-generated
                delete_result = self.db.conversion_registry.delete_many({
                    '$and': [
                        {'_id': {'$nin': self.base_configs}},
                        {'metadata.auto_generated': True}
                    ]
                })
                stats['configs_removed'] = delete_result.deleted_count

            elif reset_type == "demo_formats":
                # Remove known demo format configs
                delete_result = self.db.conversion_registry.delete_many({
                    '_id': {'$in': self.demo_formats}
                })
                stats['configs_removed'] = delete_result.deleted_count

            elif reset_type == "all":
                # Remove everything except base configs
                delete_result = self.db.conversion_registry.delete_many({
                    '_id': {'$nin': self.base_configs}
                })
                stats['configs_removed'] = delete_result.deleted_count

            # Count remaining configs
            total_after = self.db.conversion_registry.count_documents({})
            stats['configs_preserved'] = total_after

            # Clear non-seed semantic patterns if collection exists
            if 'semantic_patterns' in self.db.list_collection_names():
                patterns_deleted = self.db.semantic_patterns.delete_many({
                    '$and': [
                        {'is_seed': {'$ne': True}},
                        {'learning_metadata.source': {'$regex': '^(MT205|MT192|MT202COV)'}}
                    ]
                }).deleted_count
                stats['patterns_removed'] = patterns_deleted
                logger.info(f"Removed {patterns_deleted} learned semantic patterns")

            # Clear demo conversion results if they exist
            if 'conversion_results' in self.db.list_collection_names():
                results_deleted = self.db.conversion_results.delete_many({
                    'metadata.is_demo': True
                }).deleted_count
                stats['conversion_results_removed'] = results_deleted

            stats['completed_at'] = datetime.utcnow().isoformat()
            stats['success'] = True

            logger.info(f"Demo reset completed: Removed {stats['configs_removed']} configs, preserved {stats['configs_preserved']}")

        except Exception as e:
            logger.error(f"Error during demo reset: {e}")
            stats['errors'].append(str(e))
            stats['success'] = False

        return stats

    def get_reset_preview(self, reset_type: str = "auto_generated") -> Dict[str, Any]:
        """
        Preview what would be reset without actually doing it

        Args:
            reset_type: Type of reset to preview

        Returns:
            Dictionary with preview information
        """

        # Count total configs
        total_configs = self.db.conversion_registry.count_documents({})

        # Count configs that would be removed based on reset type
        if reset_type == "auto_generated":
            configs_to_remove = self.db.conversion_registry.count_documents({
                '$and': [
                    {'_id': {'$nin': self.base_configs}},
                    {'metadata.auto_generated': True}
                ]
            })
        elif reset_type == "demo_formats":
            configs_to_remove = self.db.conversion_registry.count_documents({
                '_id': {'$in': self.demo_formats}
            })
        elif reset_type == "all":
            configs_to_remove = self.db.conversion_registry.count_documents({
                '_id': {'$nin': self.base_configs}
            })
        else:
            configs_to_remove = 0

        # Count learned patterns that would be removed
        learned_patterns = 0
        if 'semantic_patterns' in self.db.list_collection_names():
            learned_patterns = self.db.semantic_patterns.count_documents({
                '$and': [
                    {'is_seed': {'$ne': True}},
                    {'learning_metadata.source': {'$regex': '^(MT205|MT192|MT202COV)'}}
                ]
            })

        # Get list of configs that would be removed
        if reset_type == "auto_generated":
            configs_list = list(self.db.conversion_registry.find(
                {
                    '$and': [
                        {'_id': {'$nin': self.base_configs}},
                        {'metadata.auto_generated': True}
                    ]
                },
                {'_id': 1, 'metadata.generation_confidence': 1}
            ))
        else:
            configs_list = []

        preview = {
            'reset_type': reset_type,
            'total_configs': total_configs,
            'configs_to_remove': configs_to_remove,
            'configs_to_preserve': total_configs - configs_to_remove,
            'learned_patterns_to_remove': learned_patterns,
            'base_configs_preserved': self.base_configs,
            'configs_to_be_removed': [
                {
                    'id': c['_id'],
                    'confidence': c.get('metadata', {}).get('generation_confidence', 0)
                }
                for c in configs_list
            ]
        }

        return preview

    def reset_specific_configs(self, config_ids: List[str]) -> Dict[str, Any]:
        """
        Reset specific configuration IDs

        Args:
            config_ids: List of configuration IDs to remove

        Returns:
            Dictionary with reset statistics
        """

        stats = {
            'started_at': datetime.utcnow().isoformat(),
            'requested_configs': config_ids,
            'configs_removed': 0,
            'success': False,
            'errors': []
        }

        try:
            # Don't allow deletion of base configs
            safe_to_delete = [
                config_id for config_id in config_ids
                if config_id not in self.base_configs
            ]

            if safe_to_delete:
                delete_result = self.db.conversion_registry.delete_many({
                    '_id': {'$in': safe_to_delete}
                })
                stats['configs_removed'] = delete_result.deleted_count

            stats['configs_protected'] = [
                config_id for config_id in config_ids
                if config_id in self.base_configs
            ]

            stats['completed_at'] = datetime.utcnow().isoformat()
            stats['success'] = True

        except Exception as e:
            logger.error(f"Error during specific config reset: {e}")
            stats['errors'].append(str(e))
            stats['success'] = False

        return stats

    def get_auto_generated_configs(self) -> List[Dict[str, Any]]:
        """
        Get list of all auto-generated configurations

        Returns:
            List of auto-generated config summaries
        """

        configs = list(self.db.conversion_registry.find(
            {'metadata.auto_generated': True},
            {
                '_id': 1,
                'metadata.auto_generated': 1,
                'metadata.generation_confidence': 1,
                'metadata.created_at': 1,
                'metadata.based_on': 1,
                'metadata.similar_to': 1
            }
        ))

        return [
            {
                'config_id': c['_id'],
                'confidence': c.get('metadata', {}).get('generation_confidence', 0),
                'created_at': c.get('metadata', {}).get('created_at'),
                'based_on': c.get('metadata', {}).get('based_on'),
                'similar_to': c.get('metadata', {}).get('similar_to')
            }
            for c in configs
        ]