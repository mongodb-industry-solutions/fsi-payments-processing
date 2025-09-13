#!/usr/bin/env python3
"""
Demo Reset Script - Resets the system to a clean demo state
Removes auto-generated configurations while preserving base configs

NO SCHEMA CHANGES - Only deletes auto-generated documents
"""

import os
import sys
from datetime import datetime
import logging

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DemoResetService:
    """Service to reset demo environment to clean state"""
    
    def __init__(self, mongodb_uri: str = None, database_name: str = None):
        """Initialize with MongoDB connection"""
        self.mongodb_uri = mongodb_uri or os.getenv('MONGODB_URI', 'mongodb://localhost:27017/')
        self.database_name = database_name or os.getenv('DATABASE_NAME', 'payment_converter')
        
        self.client = MongoClient(self.mongodb_uri)
        self.db = self.client[self.database_name]
        
    def reset_to_base_state(self):
        """
        Reset system to base demo state
        - Removes auto-generated configurations
        - Keeps base MT103_to_pacs.008 and MT202_to_pacs.009
        
        Returns:
            Dictionary with reset statistics
        """
        
        stats = {
            'started_at': datetime.utcnow().isoformat(),
            'configs_removed': 0,
            'configs_preserved': 0,
            'success': False,
            'errors': []
        }
        
        try:
            # Base configurations to preserve (these are manually created)
            base_configs = [
                'MT103_to_pacs.008',
                'MT202_to_pacs.009'
            ]
            
            # Count total configs before
            total_before = self.db.conversion_registry.count_documents({})
            
            # Remove auto-generated configurations
            # These have metadata.auto_generated = true (set by semantic_learning_service)
            delete_result = self.db.conversion_registry.delete_many({
                '$and': [
                    {'_id': {'$nin': base_configs}},  # Not in base configs
                    {'$or': [
                        {'metadata.auto_generated': True},  # Explicitly auto-generated
                        {'metadata.auto_generated': {'$exists': True}}  # Has the auto_generated field
                    ]}
                ]
            })
            
            stats['configs_removed'] = delete_result.deleted_count
            
            # Count remaining configs
            total_after = self.db.conversion_registry.count_documents({})
            stats['configs_preserved'] = total_after
            
            # Clear semantic patterns that are not seeds (if collection exists)
            if 'semantic_patterns' in self.db.list_collection_names():
                # Only remove non-seed patterns (learned from auto-config)
                patterns_deleted = self.db.semantic_patterns.delete_many({
                    'is_seed': {'$ne': True}
                }).deleted_count
                stats['patterns_removed'] = patterns_deleted
                logger.info(f"Removed {patterns_deleted} learned semantic patterns")
            
            stats['completed_at'] = datetime.utcnow().isoformat()
            stats['success'] = True
            
            logger.info(f"Demo reset completed: Removed {stats['configs_removed']} configs, preserved {stats['configs_preserved']}")
            
        except Exception as e:
            logger.error(f"Error during demo reset: {e}")
            stats['errors'].append(str(e))
            stats['success'] = False
            
        return stats
    
    def get_reset_preview(self):
        """
        Preview what would be reset without actually doing it
        
        Returns:
            Dictionary with preview information
        """
        
        base_configs = [
            'MT103_to_pacs.008',
            'MT202_to_pacs.009'
        ]
        
        # Count auto-generated configs
        auto_generated_count = self.db.conversion_registry.count_documents({
            '$and': [
                {'_id': {'$nin': base_configs}},
                {'$or': [
                    {'metadata.auto_generated': True},
                    {'metadata.auto_generated': {'$exists': True}}
                ]}
            ]
        })
        
        # Count total configs
        total_configs = self.db.conversion_registry.count_documents({})
        
        # Count learned patterns
        learned_patterns = 0
        if 'semantic_patterns' in self.db.list_collection_names():
            learned_patterns = self.db.semantic_patterns.count_documents({
                'is_seed': {'$ne': True}
            })
        
        preview = {
            'total_configs': total_configs,
            'base_configs': base_configs,
            'auto_generated_configs': auto_generated_count,
            'configs_to_remove': auto_generated_count,
            'configs_to_preserve': total_configs - auto_generated_count,
            'learned_patterns_to_remove': learned_patterns
        }
        
        return preview


def main():
    """Main function for command line usage"""
    
    import json
    import argparse
    
    parser = argparse.ArgumentParser(description='Reset demo environment')
    parser.add_argument('--preview', action='store_true', help='Preview reset without executing')
    
    args = parser.parse_args()
    
    # Initialize service
    reset_service = DemoResetService()
    
    if args.preview:
        # Show preview
        preview = reset_service.get_reset_preview()
        print("\n=== Demo Reset Preview ===")
        print(json.dumps(preview, indent=2, default=str))
        print("\nNo changes made. Remove --preview to execute reset.")
        
    else:
        # Execute reset
        print("\n=== Executing Demo Reset ===")
        result = reset_service.reset_to_base_state()
        
        if result['success']:
            print("\n✅ Demo reset completed successfully!")
            print(f"- Configs removed: {result.get('configs_removed', 0)}")
            print(f"- Configs preserved: {result.get('configs_preserved', 0)}")
            if 'patterns_removed' in result:
                print(f"- Patterns removed: {result.get('patterns_removed', 0)}")
        else:
            print("\n❌ Demo reset failed!")
            print(f"Errors: {result.get('errors', [])}")


if __name__ == '__main__':
    main()