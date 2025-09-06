#!/usr/bin/env python3
"""
Load parser configuration into MongoDB for generic parsing.
This moves MT103 parsing rules from code to MongoDB configuration.
"""

from db.mdb import MongoDBConnector
from datetime import datetime, UTC
import json

def load_mt103_parser_config():
    """Load MT103 parser configuration to MongoDB"""
    
    # Initialize MongoDB connection
    db = MongoDBConnector()
    
    # MT103 Parser Configuration
    mt103_config = {
        "format": "MT103",
        "format_name": "SWIFT MT103 Wire Transfer",
        "format_type": "SWIFT",
        "description": "Customer credit transfer message",
        "created_at": datetime.now(UTC).isoformat(),
        "is_active": True,
        
        # Block parsing configuration
        "block_parser": {
            "pattern": r'\{([1-4]):([^}]*)\}',
            "required_blocks": ["4"],
            "content_block": "4"
        },
        
        # Field extraction patterns
        "field_patterns": {
            "20": {
                "pattern": r':20:([^\n:]+)',
                "type": "regex",
                "description": "Transaction Reference Number",
                "required": True
            },
            "23B": {
                "pattern": r':23B:([^\n:]+)',
                "type": "regex",
                "description": "Bank Operation Code",
                "required": True
            },
            "32A": {
                "pattern": r':32A:([^\n:]+)',
                "type": "structured",
                "description": "Value Date, Currency and Amount",
                "required": True,
                "components": {
                    "value_date": {"start": 0, "length": 6},
                    "currency": {"start": 6, "length": 3},
                    "amount": {"start": 9, "length": "remaining"}
                }
            },
            "50K": {
                "pattern": r':50K:([^\n:]+(?:\n(?!:)[^\n:]+)*)',
                "type": "multiline",
                "description": "Ordering Customer",
                "required": True
            },
            "52A": {
                "pattern": r':52A:([^\n:]+)',
                "type": "regex",
                "description": "Ordering Institution",
                "required": False
            },
            "53A": {
                "pattern": r':53A:([^\n:]+)',
                "type": "regex",
                "description": "Sender's Correspondent",
                "required": False
            },
            "57A": {
                "pattern": r':57A:([^\n:]+)',
                "type": "regex",
                "description": "Account With Institution",
                "required": False
            },
            "59": {
                "pattern": r':59:([^\n:]+(?:\n(?!:)[^\n:]+)*)',
                "type": "multiline",
                "description": "Beneficiary Customer",
                "required": True
            },
            "70": {
                "pattern": r':70:([^\n:]+(?:\n(?!:)[^\n:]+)*)',
                "type": "multiline",
                "description": "Remittance Information",
                "required": False
            },
            "71A": {
                "pattern": r':71A:([^\n:]+)',
                "type": "regex",
                "description": "Details of Charges",
                "required": True
            },
            "72": {
                "pattern": r':72:([^\n:]+(?:\n(?!:)[^\n:]+)*)',
                "type": "multiline",
                "description": "Sender to Receiver Information",
                "required": False
            }
        },
        
        # Validation rules
        "validation_rules": {
            "message_start": "{1:",
            "message_end": "-}",
            "max_length": 10000,
            "required_fields": ["20", "23B", "32A", "50K", "59", "71A"]
        }
    }
    
    # Check if config already exists
    existing = db.find("parser_configs", {"format": "MT103"})
    
    if existing:
        # Update existing config
        db.update_one(
            "parser_configs",
            {"format": "MT103"},
            {"$set": mt103_config}
        )
        print("✅ Updated existing MT103 parser configuration")
    else:
        # Insert new config
        db.insert_one("parser_configs", mt103_config)
        print("✅ Created new MT103 parser configuration")
    
    # Verify the configuration was saved
    saved_config = db.find("parser_configs", {"format": "MT103"})
    
    if saved_config:
        print("\n📋 Verification - Config saved successfully:")
        print(f"  - Format: {saved_config[0]['format']}")
        print(f"  - Fields configured: {len(saved_config[0]['field_patterns'])}")
        print(f"  - Required fields: {saved_config[0]['validation_rules']['required_fields']}")
        
        # List all configured fields
        print("\n📌 Configured fields:")
        for field_id, config in saved_config[0]['field_patterns'].items():
            req = "✓ Required" if config.get('required') else "○ Optional"
            print(f"    {field_id}: {config['description']} [{req}]")
        
        return True
    else:
        print("❌ Error: Configuration not found after saving")
        return False

def test_config_structure():
    """Test that the saved config has the expected structure"""
    db = MongoDBConnector()
    
    config = db.find("parser_configs", {"format": "MT103"})
    
    if not config:
        print("❌ No MT103 config found")
        return False
    
    config = config[0]
    
    # Check required top-level fields
    required_fields = ["format", "field_patterns", "block_parser", "validation_rules"]
    for field in required_fields:
        if field not in config:
            print(f"❌ Missing required field: {field}")
            return False
    
    # Check field patterns structure
    if "20" not in config["field_patterns"]:
        print("❌ Field 20 pattern missing")
        return False
    
    field_20 = config["field_patterns"]["20"]
    if "pattern" not in field_20 or "type" not in field_20:
        print("❌ Field 20 missing pattern or type")
        return False
    
    print("✅ Configuration structure is valid")
    
    # Print sample pattern for verification
    print(f"\n🔍 Sample - Field 20 pattern: {field_20['pattern']}")
    print(f"           Type: {field_20['type']}")
    
    return True

if __name__ == "__main__":
    print("=" * 60)
    print("MongoDB Parser Configuration Loader")
    print("=" * 60)
    
    # Load configuration
    success = load_mt103_parser_config()
    
    if success:
        print("\n" + "=" * 60)
        print("Testing configuration structure...")
        print("=" * 60)
        test_success = test_config_structure()
        
        if test_success:
            print("\n✅ Step 1 Complete: Parser configuration loaded and verified")
        else:
            print("\n⚠️ Configuration loaded but structure test failed")
    else:
        print("\n❌ Failed to load parser configuration")