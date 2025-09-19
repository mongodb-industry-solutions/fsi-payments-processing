#!/usr/bin/env python3
"""
Upload a conversion configuration to MongoDB with validation
Ensures the config is valid before uploading
"""

import json
import sys
import os
from pathlib import Path
from pymongo import MongoClient
from datetime import datetime

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

# Load environment variables
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / '.env')

# Import the validation function
from validate_config_before_upload import validate_config


def upload_config(config_file: str, replace: bool = False) -> int:
    """
    Upload a configuration file to MongoDB after validation

    Args:
        config_file: Path to JSON configuration file
        replace: Whether to replace existing config

    Returns:
        0 if successful, 1 if failed
    """

    # Load the configuration
    try:
        with open(config_file, 'r') as f:
            config = json.load(f)
    except FileNotFoundError:
        print(f"Error: File '{config_file}' not found")
        return 1
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in file: {e}")
        return 1

    config_id = config.get('_id', 'UNKNOWN')
    print(f"\nConfiguration ID: {config_id}")
    print("=" * 60)

    # Step 1: Validate the configuration
    print("Step 1: Validating configuration...")
    is_valid, errors = validate_config(config)

    if not is_valid:
        print("❌ Configuration validation FAILED\n")
        print("Errors found:")
        for error in errors:
            print(f"  ❌ {error}")
        print(f"\nTotal errors: {len(errors)}")
        print("\nFix these errors before uploading")
        return 1

    print("✅ Configuration is valid")

    # Step 2: Connect to MongoDB
    print("\nStep 2: Connecting to MongoDB...")
    mongodb_uri = os.getenv('MONGODB_URI')
    database_name = os.getenv('DATABASE_NAME')

    if not mongodb_uri:
        print("Error: MONGODB_URI not set in environment")
        return 1

    try:
        client = MongoClient(mongodb_uri)
        db = client[database_name]
        collection = db['conversion_registry']
        print("✅ Connected to MongoDB")
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {e}")
        return 1

    # Step 3: Check if configuration already exists
    print(f"\nStep 3: Checking if {config_id} already exists...")
    existing = collection.find_one({'_id': config_id})

    if existing:
        print(f"⚠️  Configuration {config_id} already exists")
        if not replace:
            response = input("Do you want to replace it? (yes/no): ").lower()
            if response != 'yes':
                print("Upload cancelled")
                return 0
        else:
            print("Replacing existing configuration")
    else:
        print(f"Configuration {config_id} does not exist, will create new")

    # Step 4: Add metadata
    print("\nStep 4: Adding metadata...")
    if 'metadata' not in config:
        config['metadata'] = {}

    config['metadata']['uploaded_at'] = datetime.utcnow().isoformat()
    config['metadata']['human_validated'] = True
    config['metadata']['schema_version'] = '3.0'

    # Step 5: Upload to MongoDB
    print("\nStep 5: Uploading to MongoDB...")
    try:
        if existing:
            result = collection.replace_one({'_id': config_id}, config)
            if result.modified_count > 0:
                print(f"✅ Successfully replaced {config_id}")
            else:
                print(f"✅ No changes needed for {config_id}")
        else:
            collection.insert_one(config)
            print(f"✅ Successfully uploaded {config_id}")

        # Print summary
        print("\n" + "=" * 60)
        print("UPLOAD SUCCESSFUL")
        print("=" * 60)
        print(f"\nConfiguration: {config_id}")
        print(f"Parser fields: {len(config.get('parser', {}).get('fields', {}))}")
        print(f"Total mappings: {len(config.get('mappings', []))}")
        rules = sum(1 for m in config.get('mappings', []) if m.get('processing_lane') == 'RULES')
        ai = sum(1 for m in config.get('mappings', []) if m.get('processing_lane') == 'AI')
        print(f"Processing lanes: {rules} RULES, {ai} AI")
        print(f"Builder type: {config.get('builder', {}).get('type', 'unknown')}")
        print(f"Human review: {'enabled' if config.get('human_review', {}).get('enabled') else 'disabled'}")

        return 0

    except Exception as e:
        print(f"❌ Failed to upload: {e}")
        return 1
    finally:
        client.close()


def main():
    """Main function"""

    if len(sys.argv) < 2:
        print("Usage: python upload_config_to_mongodb.py <config_file.json> [--replace]")
        print("\nThis script validates and uploads a conversion config to MongoDB")
        print("\nOptions:")
        print("  --replace    Replace existing config without asking")
        print("\nExample:")
        print("  python upload_config_to_mongodb.py my_config.json")
        print("  python upload_config_to_mongodb.py my_config.json --replace")
        return 1

    config_file = sys.argv[1]
    replace = '--replace' in sys.argv

    return upload_config(config_file, replace)


if __name__ == "__main__":
    exit(main())