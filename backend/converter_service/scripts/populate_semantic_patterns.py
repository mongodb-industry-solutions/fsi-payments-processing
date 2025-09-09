#!/usr/bin/env python3
"""
Populate MongoDB with learned semantic patterns
This script only handles database operations - actual learning is done by semantic_learning_service
Following the same pattern as populate_mt103_with_3lanes.py
"""

import sys
import os
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent.parent))

from converter_service.services.db_service import MongoDBService
from converter_service.services.semantic_learning_service import SemanticLearningService
from datetime import datetime

# Load environment variables
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / '.env')


def get_seed_patterns():
    """
    Define seed patterns for core payment concepts
    These ensure consistency across runs and provide a foundation for learning
    Enhanced schema to track field variations and learning
    """
    return {
        "transaction_reference": {
            "_id": "transaction_reference",
            "concept": "Transaction Reference",
            "description": "Unique identifier for a payment transaction",
            "known_fields": ["20", "TxId", "transaction_id", "reference"],
            "learned_patterns": {},
            "field_variations": {},  # Will track: {"MT103": "20", "MT192": "11S", etc.}
            "discovery_log": [],  # Will track when new variations are discovered
            "is_seed": True,
            "learning_metadata": {
                "source": "seed",
                "confidence": 1.0,
                "first_seen": datetime.utcnow(),
                "last_updated": datetime.utcnow(),
                "seen_in_formats": [],
                "usage_count": 0
            }
        },
        "amount": {
            "_id": "amount",
            "concept": "Transaction Amount",
            "description": "Monetary value being transferred",
            "known_fields": ["32A", "32B", "amount", "IntrBkSttlmAmt", "transaction_amount"],
            "learned_patterns": {},
            "field_variations": {},
            "discovery_log": [],
            "is_seed": True,
            "learning_metadata": {
                "source": "seed",
                "confidence": 1.0,
                "first_seen": datetime.utcnow(),
                "last_updated": datetime.utcnow(),
                "seen_in_formats": [],
                "usage_count": 0
            }
        },
        "sender": {
            "_id": "sender",
            "concept": "Sender/Ordering Customer",
            "description": "Party initiating the payment",
            "known_fields": ["50K", "50A", "50F", "52A", "ordering_customer", "Dbtr"],
            "learned_patterns": {},
            "field_variations": {},
            "discovery_log": [],
            "is_seed": True,
            "learning_metadata": {
                "source": "seed",
                "confidence": 1.0,
                "first_seen": datetime.utcnow(),
                "last_updated": datetime.utcnow(),
                "seen_in_formats": [],
                "usage_count": 0
            }
        },
        "receiver": {
            "_id": "receiver",
            "concept": "Receiver/Beneficiary",
            "description": "Party receiving the payment",
            "known_fields": ["59", "59A", "59F", "58A", "beneficiary", "Cdtr"],
            "learned_patterns": {},
            "field_variations": {},
            "discovery_log": [],
            "is_seed": True,
            "learning_metadata": {
                "source": "seed",
                "confidence": 1.0,
                "first_seen": datetime.utcnow(),
                "last_updated": datetime.utcnow(),
                "seen_in_formats": [],
                "usage_count": 0
            }
        },
        "remittance_info": {
            "_id": "remittance_info",
            "concept": "Remittance Information",
            "description": "Payment purpose and details",
            "known_fields": ["70", "remittance_information", "RmtInf", "payment_details"],
            "learned_patterns": {},
            "field_variations": {},
            "discovery_log": [],
            "is_seed": True,
            "learning_metadata": {
                "source": "seed",
                "confidence": 1.0,
                "first_seen": datetime.utcnow(),
                "last_updated": datetime.utcnow(),
                "seen_in_formats": [],
                "usage_count": 0
            }
        },
        "bank_instructions": {
            "_id": "bank_instructions",
            "concept": "Bank-to-Bank Information",
            "description": "Instructions between financial institutions",
            "known_fields": ["72", "sender_to_receiver_info", "InstrForNxtAgt"],
            "learned_patterns": {},
            "field_variations": {},
            "discovery_log": [],
            "is_seed": True,
            "learning_metadata": {
                "source": "seed",
                "confidence": 1.0,
                "first_seen": datetime.utcnow(),
                "last_updated": datetime.utcnow(),
                "seen_in_formats": [],
                "usage_count": 0
            }
        },
        "value_date": {
            "_id": "value_date",
            "concept": "Value Date",
            "description": "Date when funds become available",
            "known_fields": ["32A", "value_date", "IntrBkSttlmDt"],
            "learned_patterns": {},
            "field_variations": {},
            "discovery_log": [],
            "is_seed": True,
            "learning_metadata": {
                "source": "seed",
                "confidence": 1.0,
                "first_seen": datetime.utcnow(),
                "last_updated": datetime.utcnow(),
                "seen_in_formats": [],
                "usage_count": 0
            }
        },
        "charges": {
            "_id": "charges",
            "concept": "Charge Bearer",
            "description": "Who pays the transaction charges",
            "known_fields": ["71A", "charge_bearer", "ChrgBr"],
            "learned_patterns": {},
            "field_variations": {},
            "discovery_log": [],
            "is_seed": True,
            "learning_metadata": {
                "source": "seed",
                "confidence": 1.0,
                "first_seen": datetime.utcnow(),
                "last_updated": datetime.utcnow(),
                "seen_in_formats": [],
                "usage_count": 0
            }
        }
    }


def populate_database():
    """
    Populate MongoDB with semantic patterns learned from existing configurations
    This script only handles the database population - learning logic is in semantic_learning_service
    """
    
    print("=" * 70)
    print("POPULATING SEMANTIC PATTERNS COLLECTION")
    print("=" * 70)
    
    # Connect to MongoDB
    mongodb_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    database_name = os.getenv("DATABASE_NAME", "payment_converter")
    
    db_service = MongoDBService(mongodb_uri, database_name)
    collection = db_service.db['semantic_patterns']
    
    # Check if patterns already exist
    existing_count = collection.count_documents({})
    if existing_count > 0:
        print(f"\n⚠️  Found {existing_count} existing semantic patterns")
        print("   Clearing existing patterns...")
        collection.delete_many({})
        print("✓ Cleared existing semantic patterns")
    
    # Step 1: Insert seed patterns
    print("\n🌱 Inserting seed patterns...")
    seed_patterns = get_seed_patterns()
    seed_list = list(seed_patterns.values())
    seed_result = collection.insert_many(seed_list)
    print(f"✓ Inserted {len(seed_result.inserted_ids)} seed patterns")
    
    # Initialize the semantic learning service
    print("\n🧠 Initializing Semantic Learning Service...")
    
    try:
        # Try to initialize with AI service
        from converter_service.services.ai_service import BedrockService
        
        # Get AI configuration from any existing conversion config
        sample_config = db_service.db['conversion_registry'].find_one()
        ai_service = None
        
        if sample_config and 'ai_service' in sample_config:
            try:
                ai_service = BedrockService(sample_config['ai_service'])
                print("✓ AI service initialized for intelligent learning")
            except Exception as e:
                print(f"⚠️  Could not initialize AI service: {e}")
                print("   Will proceed without LLM support")
        
        learning_service = SemanticLearningService(db_service, ai_service)
        
    except ImportError:
        print("⚠️  SemanticLearningService not found - creating basic service")
        # If the service doesn't exist yet, we'll create a basic version
        learning_service = SemanticLearningService(db_service, None)
    
    # Step 2: Learn patterns from existing configurations
    print("\n📚 Learning patterns from existing configurations...")
    learned_patterns = learning_service.learn_from_existing_configs()
    
    if not learned_patterns:
        print("\n⚠️  No additional patterns learned from configurations")
        print("   Using seed patterns only")
    else:
        # Merge learned patterns with seed patterns (learned patterns update seeds)
        print(f"\n🔀 Merging {len(learned_patterns)} learned patterns with seed patterns...")
        
        for pattern_id, pattern in learned_patterns.items():
            # Check if this updates a seed pattern
            existing = collection.find_one({"_id": pattern_id})
            if existing and existing.get("is_seed"):
                # Update seed pattern with learned data
                collection.update_one(
                    {"_id": pattern_id},
                    {
                        "$set": {
                            "learned_patterns": pattern.get("learned_patterns", {}),
                            "learning_metadata.last_updated": datetime.utcnow(),
                            "learning_metadata.seen_in_formats": pattern.get("learning_metadata", {}).get("seen_in_formats", [])
                        }
                    }
                )
                print(f"   ✓ Updated seed pattern: {pattern_id}")
            else:
                # Insert new learned pattern
                pattern["is_seed"] = False
                collection.insert_one(pattern)
                print(f"   ✓ Added learned pattern: {pattern_id}")
        
        print(f"\n✓ Successfully merged patterns")
    
    # Verify insertion
    count = collection.count_documents({})
    print(f"\n✅ Semantic patterns successfully populated!")
    print(f"   - Total patterns in collection: {count}")
    
    # Display summary
    print("\n📋 Semantic Patterns Summary:")
    for pattern in collection.find({}, {"_id": 1, "concept": 1}).sort("_id", 1).limit(10):
        print(f"   - {pattern['_id']:<35} {pattern['concept']}")
    
    if count > 10:
        print(f"   ... and {count - 10} more patterns")
    
    # Display readiness
    print("\n💡 System Status:")
    
    # Check what formats we learned from
    formats_seen = set()
    for pattern in collection.find({}, {"learning_metadata.seen_in_formats": 1}):
        formats_seen.update(pattern.get('learning_metadata', {}).get('seen_in_formats', []))
    
    if formats_seen:
        print(f"   ✓ Learned from formats: {', '.join(sorted(formats_seen))}")
        print("   ✓ Ready for intelligent auto-configuration")
        print("   ✓ Can now generate configs for similar formats")
    else:
        print("   ⚠️  No format patterns detected")
    
    print("\n🚀 Next steps:")
    print("   1. Use /api/v1/converter/auto-configure to generate new configs")
    print("   2. System will use learned patterns to map fields")
    print("   3. Human review and approve generated configs")


if __name__ == "__main__":
    populate_database()