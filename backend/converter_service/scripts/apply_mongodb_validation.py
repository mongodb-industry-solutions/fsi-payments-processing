#!/usr/bin/env python3
"""
Apply JSON Schema Validation to MongoDB conversion_registry Collection

This script applies the official JSON schema to the MongoDB collection to enforce
validation at the database level. It can also be used to remove validation if needed.

Usage:
    python scripts/apply_mongodb_validation.py --apply    # Apply validation
    python scripts/apply_mongodb_validation.py --remove   # Remove validation
    python scripts/apply_mongodb_validation.py --check    # Check current validation
"""

import json
import sys
import os
from pathlib import Path
import argparse
from typing import Dict, Any, Optional
from pymongo import MongoClient
from pymongo.errors import OperationFailure, WriteError
import logging

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.settings import get_settings

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class MongoDBSchemaValidator:
    """Manages MongoDB schema validation for conversion_registry collection"""

    def __init__(self):
        """Initialize MongoDB connection and load schema"""
        settings = get_settings()
        self.client = MongoClient(settings.mongodb_uri)
        self.db = self.client[settings.database_name]
        self.collection_name = "conversion_registry"

        # Load JSON schema
        schema_path = Path(__file__).parent.parent / "schemas" / "conversion_registry_schema.json"
        if not schema_path.exists():
            raise FileNotFoundError(f"Schema file not found: {schema_path}")

        with open(schema_path, 'r') as f:
            self.schema = json.load(f)

        logger.info(f"Connected to MongoDB: {settings.database_name}")
        logger.info(f"Loaded schema from: {schema_path}")

    def check_current_validation(self) -> Optional[Dict[str, Any]]:
        """
        Check current validation rules on the collection

        Returns:
            Current validation rules or None if not set
        """
        try:
            # Get collection information
            coll_info = self.db.get_collection(self.collection_name)
            collections = self.db.list_collection_names()

            if self.collection_name not in collections:
                logger.warning(f"Collection '{self.collection_name}' does not exist")
                return None

            # Get collection options including validator
            coll_options = self.db.command("listCollections", filter={"name": self.collection_name})

            for coll in coll_options["cursor"]["firstBatch"]:
                if coll["name"] == self.collection_name:
                    options = coll.get("options", {})
                    validator = options.get("validator")
                    validation_level = options.get("validationLevel", "strict")
                    validation_action = options.get("validationAction", "error")

                    if validator:
                        logger.info("Current validation settings:")
                        logger.info(f"  - Validation Level: {validation_level}")
                        logger.info(f"  - Validation Action: {validation_action}")
                        logger.info(f"  - Validator: {json.dumps(validator, indent=2)[:500]}...")
                        return {
                            "validator": validator,
                            "validationLevel": validation_level,
                            "validationAction": validation_action
                        }
                    else:
                        logger.info("No validation rules currently set on collection")
                        return None

        except Exception as e:
            logger.error(f"Error checking validation: {e}")
            return None

    def apply_validation(self, validation_level: str = "moderate", validation_action: str = "error") -> bool:
        """
        Apply JSON schema validation to the collection

        Args:
            validation_level: "strict" (all ops), "moderate" (insert/update only), or "off"
            validation_action: "error" (reject invalid) or "warn" (log but allow)

        Returns:
            True if successful, False otherwise
        """
        try:
            # Prepare the validator with JSON Schema
            validator = {"$jsonSchema": self.schema}

            # Apply validation using collMod command
            result = self.db.command({
                "collMod": self.collection_name,
                "validator": validator,
                "validationLevel": validation_level,
                "validationAction": validation_action
            })

            if result.get("ok") == 1:
                logger.info(f"✅ Successfully applied validation to '{self.collection_name}'")
                logger.info(f"  - Validation Level: {validation_level}")
                logger.info(f"  - Validation Action: {validation_action}")
                return True
            else:
                logger.error(f"Failed to apply validation: {result}")
                return False

        except OperationFailure as e:
            logger.error(f"MongoDB operation failed: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error applying validation: {e}")
            return False

    def remove_validation(self) -> bool:
        """
        Remove validation from the collection

        Returns:
            True if successful, False otherwise
        """
        try:
            # Remove validation by setting empty validator
            result = self.db.command({
                "collMod": self.collection_name,
                "validator": {}
            })

            if result.get("ok") == 1:
                logger.info(f"✅ Successfully removed validation from '{self.collection_name}'")
                return True
            else:
                logger.error(f"Failed to remove validation: {result}")
                return False

        except OperationFailure as e:
            logger.error(f"MongoDB operation failed: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error removing validation: {e}")
            return False

    def test_validation(self) -> bool:
        """
        Test validation by attempting to insert invalid documents

        Returns:
            True if validation is working correctly
        """
        logger.info("\n📋 Testing validation with sample documents...")

        # Test 1: Valid document (should succeed)
        valid_doc = {
            "_id": "TEST_VALID_DOC",
            "parser": {
                "type": "regex",
                "fields": {
                    "test_field": {
                        "pattern": ".*",
                        "name": "Test Field"
                    }
                }
            },
            "mappings": [
                {
                    "source": "test_field",
                    "targets": ["target_field"],
                    "transform": "copy"
                }
            ],
            "ai_service": {
                "field_types": {}
            },
            "builder": {
                "type": "json",
                "template": {}
            },
            "human_review": {
                "enabled": true,
                "default_threshold": 0.8
            }
        }

        # Test 2: Invalid document (missing required fields)
        invalid_doc = {
            "_id": "TEST_INVALID_DOC",
            "parser": {
                "type": "invalid_type",  # Invalid enum value
                "fields": {}
            }
            # Missing required fields: mappings, builder, etc.
        }

        try:
            # Try inserting valid document
            logger.info("  Testing valid document insertion...")
            try:
                self.db[self.collection_name].delete_one({"_id": "TEST_VALID_DOC"})
                self.db[self.collection_name].insert_one(valid_doc)
                logger.info("    ✅ Valid document inserted successfully")
                # Clean up
                self.db[self.collection_name].delete_one({"_id": "TEST_VALID_DOC"})
            except WriteError as e:
                logger.error(f"    ❌ Valid document rejected (unexpected): {e}")
                return False

            # Try inserting invalid document (should fail)
            logger.info("  Testing invalid document rejection...")
            try:
                self.db[self.collection_name].delete_one({"_id": "TEST_INVALID_DOC"})
                self.db[self.collection_name].insert_one(invalid_doc)
                logger.error("    ❌ Invalid document was accepted (validation not working)")
                # Clean up if it succeeded
                self.db[self.collection_name].delete_one({"_id": "TEST_INVALID_DOC"})
                return False
            except WriteError as e:
                logger.info(f"    ✅ Invalid document rejected correctly: {e.details.get('errmsg', '')[:100]}")
                return True

        except Exception as e:
            logger.error(f"Error during validation testing: {e}")
            return False

    def validate_existing_documents(self) -> Dict[str, Any]:
        """
        Validate all existing documents in the collection

        Returns:
            Dictionary with validation results
        """
        logger.info("\n📊 Validating existing documents...")

        results = {
            "total": 0,
            "valid": 0,
            "invalid": 0,
            "invalid_docs": []
        }

        try:
            # Import schema validator
            from services.schema_validator import SchemaValidator
            validator = SchemaValidator()

            # Get all documents
            documents = list(self.db[self.collection_name].find())
            results["total"] = len(documents)

            for doc in documents:
                doc_id = doc.get("_id", "unknown")
                logger.info(f"  Validating: {doc_id}")

                # Validate using schema validator
                validation_result = validator.validate(doc, return_frontend_format=False)

                if validation_result["valid"]:
                    results["valid"] += 1
                    logger.info(f"    ✅ Valid (score: {validation_result['score']})")
                else:
                    results["invalid"] += 1
                    results["invalid_docs"].append({
                        "id": doc_id,
                        "errors": validation_result["errors"][:3]  # First 3 errors
                    })
                    logger.warning(f"    ⚠️ Invalid (score: {validation_result['score']}, errors: {validation_result['error_count']})")

            # Summary
            logger.info("\n📈 Validation Summary:")
            logger.info(f"  Total documents: {results['total']}")
            logger.info(f"  Valid: {results['valid']} ({results['valid']/results['total']*100:.1f}%)")
            logger.info(f"  Invalid: {results['invalid']} ({results['invalid']/results['total']*100:.1f}%)")

            if results["invalid_docs"]:
                logger.warning("\n⚠️ Invalid documents that need fixing:")
                for doc in results["invalid_docs"]:
                    logger.warning(f"  - {doc['id']}: {len(doc['errors'])} error(s)")

        except Exception as e:
            logger.error(f"Error validating documents: {e}")

        return results


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Manage MongoDB schema validation")
    parser.add_argument("--apply", action="store_true", help="Apply schema validation")
    parser.add_argument("--remove", action="store_true", help="Remove schema validation")
    parser.add_argument("--check", action="store_true", help="Check current validation")
    parser.add_argument("--test", action="store_true", help="Test validation with sample docs")
    parser.add_argument("--validate-all", action="store_true", help="Validate all existing documents")
    parser.add_argument("--level", choices=["strict", "moderate", "off"], default="moderate",
                       help="Validation level (default: moderate)")
    parser.add_argument("--action", choices=["error", "warn"], default="error",
                       help="Validation action (default: error)")

    args = parser.parse_args()

    # Initialize validator
    validator = MongoDBSchemaValidator()

    # Execute requested action
    if args.check:
        validator.check_current_validation()

    elif args.apply:
        logger.info("\n🚀 Applying MongoDB Schema Validation...")

        # First validate existing documents
        results = validator.validate_existing_documents()

        if results["invalid"] > 0:
            logger.warning(f"\n⚠️ Found {results['invalid']} invalid documents")
            response = input("Continue with applying validation? (y/n): ")
            if response.lower() != 'y':
                logger.info("Aborted by user")
                return

        # Apply validation
        if validator.apply_validation(args.level, args.action):
            # Test validation
            if validator.test_validation():
                logger.info("\n✅ Validation successfully applied and tested!")
            else:
                logger.warning("\n⚠️ Validation applied but testing showed issues")
        else:
            logger.error("\n❌ Failed to apply validation")

    elif args.remove:
        logger.info("\n🗑️ Removing MongoDB Schema Validation...")
        if validator.remove_validation():
            logger.info("✅ Validation removed successfully")
        else:
            logger.error("❌ Failed to remove validation")

    elif args.test:
        if validator.test_validation():
            logger.info("\n✅ Validation is working correctly")
        else:
            logger.error("\n❌ Validation test failed")

    elif args.validate_all:
        validator.validate_existing_documents()

    else:
        parser.print_help()


if __name__ == "__main__":
    main()