#!/usr/bin/env python3
"""
Add indexes to MongoDB collections for optimized access patterns.

This is Step 3.1 of the MongoDB Optimization Plan.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.mdb import MongoDBConnector
from pymongo import ASCENDING, DESCENDING, TEXT
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def add_indexes():
    """Add optimized indexes to MongoDB collections"""
    
    db = MongoDBConnector()
    
    logger.info("Adding indexes to MongoDB collections...")
    
    # 1. Formats collection indexes
    logger.info("\n1. Adding indexes to 'formats' collection...")
    
    # Compound index for format lookups
    db.db["formats"].create_index(
        [("format_code", ASCENDING), ("type", ASCENDING)],
        unique=True,
        name="format_lookup_idx"
    )
    logger.info("  ✓ Created compound index on (format_code, type)")
    
    # Index for active formats
    db.db["formats"].create_index(
        [("is_active", ASCENDING)],
        name="active_formats_idx"
    )
    logger.info("  ✓ Created index on is_active")
    
    # 2. Conversion configs collection indexes
    logger.info("\n2. Adding indexes to 'conversion_configs' collection...")
    
    # Compound index for conversion lookups
    db.db["conversion_configs"].create_index(
        [("source_format", ASCENDING), ("target_format", ASCENDING), ("is_active", ASCENDING)],
        unique=True,
        name="conversion_lookup_idx"
    )
    logger.info("  ✓ Created compound index on (source_format, target_format, is_active)")
    
    # Index for finding all conversions from a source
    db.db["conversion_configs"].create_index(
        [("source_format", ASCENDING)],
        name="source_format_idx"
    )
    logger.info("  ✓ Created index on source_format")
    
    # Index for finding all conversions to a target
    db.db["conversion_configs"].create_index(
        [("target_format", ASCENDING)],
        name="target_format_idx"
    )
    logger.info("  ✓ Created index on target_format")
    
    # 3. Conversions collection indexes
    logger.info("\n3. Adding indexes to 'conversions' collection...")
    
    # Index on conversion_id for lookups (sparse to handle nulls)
    db.db["conversions"].create_index(
        [("conversion_id", ASCENDING)],
        unique=True,
        sparse=True,  # Ignore documents without conversion_id
        name="conversion_id_idx"
    )
    logger.info("  ✓ Created unique sparse index on conversion_id")
    
    # Index on created_at for recent conversions
    db.db["conversions"].create_index(
        [("created_at", DESCENDING)],
        name="created_at_idx"
    )
    logger.info("  ✓ Created index on created_at (descending)")
    
    # Compound index for conversion history queries
    db.db["conversions"].create_index(
        [("source_format", ASCENDING), ("target_format", ASCENDING), ("created_at", DESCENDING)],
        name="conversion_history_idx"
    )
    logger.info("  ✓ Created compound index for conversion history")
    
    # 4. Format processors collection indexes (if used)
    logger.info("\n4. Adding indexes to 'format_processors' collection...")
    
    # Compound index for processor lookups
    db.db["format_processors"].create_index(
        [("format", ASCENDING), ("type", ASCENDING)],
        unique=True,
        name="processor_lookup_idx"
    )
    logger.info("  ✓ Created compound index on (format, type)")
    
    logger.info("\n✅ All indexes created successfully!")
    
    # List all indexes for verification
    logger.info("\n📊 Index Summary:")
    for collection_name in ["formats", "conversion_configs", "conversions", "format_processors"]:
        indexes = db.db[collection_name].list_indexes()
        logger.info(f"\n{collection_name}:")
        for index in indexes:
            logger.info(f"  - {index['name']}: {index['key']}")
    
    return True


def verify_index_usage():
    """Verify that indexes are being used by running explain on common queries"""
    
    db = MongoDBConnector()
    
    logger.info("\n🔍 Verifying index usage with explain plans...")
    
    # Test 1: Format lookup
    explain = db.db["formats"].find(
        {"format_code": "MT103", "type": "source"}
    ).explain()
    
    if "winningPlan" in explain["executionStats"]:
        plan = explain["executionStats"]["winningPlan"]
        if "inputStage" in plan and plan["inputStage"]["stage"] == "IXSCAN":
            logger.info("✓ Format lookup using index")
        else:
            logger.warning("⚠️ Format lookup not using index")
    
    # Test 2: Conversion config lookup
    explain = db.db["conversion_configs"].find(
        {"source_format": "MT103", "target_format": "pacs.008", "is_active": True}
    ).explain()
    
    if "winningPlan" in explain["executionStats"]:
        plan = explain["executionStats"]["winningPlan"]
        if "inputStage" in plan and plan["inputStage"]["stage"] == "IXSCAN":
            logger.info("✓ Conversion config lookup using index")
        else:
            logger.warning("⚠️ Conversion config lookup not using index")
    
    # Test 3: Recent conversions
    explain = db.db["conversions"].find().sort("created_at", -1).limit(10).explain()
    
    if "winningPlan" in explain["executionStats"]:
        plan = explain["executionStats"]["winningPlan"]
        if "inputStage" in plan and plan["inputStage"]["stage"] == "IXSCAN":
            logger.info("✓ Recent conversions query using index")
        else:
            logger.warning("⚠️ Recent conversions query not using index")
    
    logger.info("\n✅ Index verification complete!")


def main():
    """Main function"""
    
    try:
        # Add indexes
        add_indexes()
        
        # Verify usage
        verify_index_usage()
        
        logger.info("\n🎉 MongoDB index optimization complete!")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error adding indexes: {str(e)}")
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)