#!/usr/bin/env python3
"""
Backup and Restore MongoDB conversion_registry Collection

This script creates backups of the conversion_registry collection
and can restore from backups if needed.

Usage:
    python scripts/backup_conversion_registry.py --backup    # Create backup
    python scripts/backup_conversion_registry.py --restore   # Restore from backup
    python scripts/backup_conversion_registry.py --list      # List available backups
"""

import json
import sys
import os
from pathlib import Path
import argparse
from datetime import datetime
from typing import Dict, Any, List, Optional
from pymongo import MongoClient
import logging

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.settings import get_settings

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class ConversionRegistryBackup:
    """Manages backups of the conversion_registry collection"""

    def __init__(self):
        """Initialize MongoDB connection and backup directory"""
        settings = get_settings()
        self.client = MongoClient(settings.mongodb_uri)
        self.db = self.client[settings.database_name]
        self.collection_name = "conversion_registry"

        # Create backup directory
        self.backup_dir = Path(__file__).parent.parent / "backups" / "conversion_registry"
        self.backup_dir.mkdir(parents=True, exist_ok=True)

        logger.info(f"Connected to MongoDB: {settings.database_name}")
        logger.info(f"Backup directory: {self.backup_dir}")

    def create_backup(self, description: str = "") -> str:
        """
        Create a backup of the conversion_registry collection

        Args:
            description: Optional description for the backup

        Returns:
            Backup filename
        """
        try:
            # Get all documents from the collection
            documents = list(self.db[self.collection_name].find())

            if not documents:
                logger.warning(f"Collection '{self.collection_name}' is empty")
                return None

            # Create backup filename with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_filename = f"conversion_registry_backup_{timestamp}.json"
            backup_path = self.backup_dir / backup_filename

            # Convert datetime objects to strings for JSON serialization
            documents = self._convert_datetimes(documents)

            # Create backup metadata
            backup_data = {
                "metadata": {
                    "collection": self.collection_name,
                    "timestamp": datetime.now().isoformat(),
                    "document_count": len(documents),
                    "description": description or f"Backup before schema validation implementation",
                    "database": self.db.name
                },
                "documents": documents
            }

            # Write backup to file
            with open(backup_path, 'w', encoding='utf-8') as f:
                json.dump(backup_data, f, indent=2, ensure_ascii=False)

            logger.info(f"✅ Backup created successfully: {backup_filename}")
            logger.info(f"   - Documents backed up: {len(documents)}")
            logger.info(f"   - File size: {backup_path.stat().st_size / 1024:.2f} KB")
            logger.info(f"   - Location: {backup_path}")

            # Also list the documents backed up
            logger.info("\n📋 Configurations backed up:")
            for doc in documents:
                logger.info(f"   - {doc.get('_id', 'unknown')}")

            return backup_filename

        except Exception as e:
            logger.error(f"❌ Error creating backup: {e}")
            return None

    def list_backups(self) -> List[Dict[str, Any]]:
        """
        List all available backups

        Returns:
            List of backup information
        """
        backups = []

        try:
            for backup_file in sorted(self.backup_dir.glob("conversion_registry_backup_*.json")):
                try:
                    with open(backup_file, 'r') as f:
                        data = json.load(f)
                        metadata = data.get("metadata", {})

                        backups.append({
                            "filename": backup_file.name,
                            "timestamp": metadata.get("timestamp"),
                            "document_count": metadata.get("document_count"),
                            "description": metadata.get("description"),
                            "size_kb": backup_file.stat().st_size / 1024
                        })
                except Exception as e:
                    logger.warning(f"Could not read backup {backup_file.name}: {e}")

            return backups

        except Exception as e:
            logger.error(f"Error listing backups: {e}")
            return []

    def restore_backup(self, backup_filename: str = None, force: bool = False) -> bool:
        """
        Restore from a backup file

        Args:
            backup_filename: Specific backup to restore (if None, uses latest)
            force: If True, doesn't ask for confirmation

        Returns:
            True if successful
        """
        try:
            # Get backup file
            if backup_filename:
                backup_path = self.backup_dir / backup_filename
            else:
                # Get latest backup
                backup_files = sorted(self.backup_dir.glob("conversion_registry_backup_*.json"))
                if not backup_files:
                    logger.error("No backup files found")
                    return False
                backup_path = backup_files[-1]
                backup_filename = backup_path.name

            if not backup_path.exists():
                logger.error(f"Backup file not found: {backup_filename}")
                return False

            # Load backup data
            with open(backup_path, 'r') as f:
                backup_data = json.load(f)

            metadata = backup_data.get("metadata", {})
            documents = backup_data.get("documents", [])

            logger.info(f"\n📁 Backup to restore: {backup_filename}")
            logger.info(f"   - Created: {metadata.get('timestamp')}")
            logger.info(f"   - Documents: {metadata.get('document_count')}")
            logger.info(f"   - Description: {metadata.get('description')}")

            # Get current document count
            current_count = self.db[self.collection_name].count_documents({})
            logger.info(f"\n⚠️  Current collection has {current_count} documents")

            if not force:
                response = input("\n🔄 Proceed with restore? This will REPLACE all current documents (y/n): ")
                if response.lower() != 'y':
                    logger.info("Restore cancelled by user")
                    return False

            # Clear current collection
            logger.info(f"\n🗑️  Clearing current collection...")
            result = self.db[self.collection_name].delete_many({})
            logger.info(f"   Deleted {result.deleted_count} documents")

            # Restore documents
            logger.info(f"\n📥 Restoring {len(documents)} documents...")

            # Convert datetime strings back to datetime objects
            documents = self._restore_datetimes(documents)

            if documents:
                result = self.db[self.collection_name].insert_many(documents)
                logger.info(f"✅ Restored {len(result.inserted_ids)} documents successfully")

                # List restored documents
                logger.info("\n📋 Configurations restored:")
                for doc in documents:
                    logger.info(f"   - {doc.get('_id', 'unknown')}")

                return True
            else:
                logger.warning("No documents to restore")
                return False

        except Exception as e:
            logger.error(f"❌ Error restoring backup: {e}")
            return False

    def _convert_datetimes(self, obj: Any) -> Any:
        """Convert datetime objects to ISO strings for JSON serialization"""
        if isinstance(obj, datetime):
            return {"$datetime": obj.isoformat()}
        elif isinstance(obj, dict):
            return {key: self._convert_datetimes(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [self._convert_datetimes(item) for item in obj]
        else:
            return obj

    def _restore_datetimes(self, obj: Any) -> Any:
        """Convert ISO strings back to datetime objects"""
        if isinstance(obj, dict):
            if "$datetime" in obj:
                return datetime.fromisoformat(obj["$datetime"])
            else:
                return {key: self._restore_datetimes(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [self._restore_datetimes(item) for item in obj]
        else:
            return obj

    def verify_backup(self, backup_filename: str) -> bool:
        """
        Verify a backup file is valid and readable

        Args:
            backup_filename: Backup file to verify

        Returns:
            True if backup is valid
        """
        try:
            backup_path = self.backup_dir / backup_filename

            if not backup_path.exists():
                logger.error(f"Backup file not found: {backup_filename}")
                return False

            with open(backup_path, 'r') as f:
                backup_data = json.load(f)

            # Check required fields
            if "metadata" not in backup_data or "documents" not in backup_data:
                logger.error("Invalid backup format: missing metadata or documents")
                return False

            metadata = backup_data["metadata"]
            documents = backup_data["documents"]

            logger.info(f"✅ Backup is valid: {backup_filename}")
            logger.info(f"   - Documents: {len(documents)}")
            logger.info(f"   - Created: {metadata.get('timestamp')}")

            return True

        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in backup file: {e}")
            return False
        except Exception as e:
            logger.error(f"Error verifying backup: {e}")
            return False


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Backup and restore conversion_registry collection")
    parser.add_argument("--backup", action="store_true", help="Create a backup")
    parser.add_argument("--restore", action="store_true", help="Restore from backup")
    parser.add_argument("--list", action="store_true", help="List available backups")
    parser.add_argument("--verify", action="store_true", help="Verify a backup file")
    parser.add_argument("--file", type=str, help="Specific backup filename for restore/verify")
    parser.add_argument("--description", type=str, help="Description for the backup")
    parser.add_argument("--force", action="store_true", help="Skip confirmation prompts")

    args = parser.parse_args()

    # Initialize backup manager
    backup_manager = ConversionRegistryBackup()

    if args.backup:
        logger.info("\n🔐 Creating backup of conversion_registry collection...")
        description = args.description or "Backup before MongoDB schema validation"
        backup_manager.create_backup(description)

    elif args.restore:
        logger.info("\n♻️  Restoring conversion_registry collection from backup...")
        backup_manager.restore_backup(args.file, args.force)

    elif args.list:
        logger.info("\n📚 Available backups:")
        backups = backup_manager.list_backups()

        if not backups:
            logger.info("No backups found")
        else:
            for backup in backups:
                logger.info(f"\n📁 {backup['filename']}")
                logger.info(f"   - Created: {backup['timestamp']}")
                logger.info(f"   - Documents: {backup['document_count']}")
                logger.info(f"   - Size: {backup['size_kb']:.2f} KB")
                logger.info(f"   - Description: {backup['description']}")

    elif args.verify:
        if not args.file:
            logger.error("Please specify a backup file with --file")
        else:
            logger.info(f"\n🔍 Verifying backup: {args.file}")
            backup_manager.verify_backup(args.file)

    else:
        parser.print_help()


if __name__ == "__main__":
    main()