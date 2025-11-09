"""Validate all configs in database against simplified schema"""

import sys
import os
import asyncio

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.services.mongodb_service import MongoDBService
from config.settings import get_settings
from config.validator import validate_config


async def validate_all():
    """Validate all configs in the database"""
    settings = get_settings()
    db_service = MongoDBService(settings.mongodb_uri, settings.database_name)
    
    print("\n🔍 Validating all configs in database...")
    print(f"Database: {settings.database_name}\n")
    
    try:
        configs = await db_service.list_configs()
        
        if not configs:
            print("⚠️  No configs found in database")
            return True
        
        valid = 0
        invalid = []
        
        for config in configs:
            config_id = config.get('_id', 'UNKNOWN')
            try:
                validate_config(config)
                valid += 1
                print(f"✅ {config_id}")
            except ValueError as e:
                invalid.append((config_id, str(e)))
                print(f"❌ {config_id}: {e}")
        
        print(f"\n📊 Results: {valid} valid, {len(invalid)} invalid")
        
        if invalid:
            print("\n❌ Invalid configs:")
            for config_id, error in invalid:
                print(f"  - {config_id}: {error}")
            return False
        
        print("\n✅ All configs are valid!")
        return True
        
    except Exception as e:
        print(f"❌ Error during validation: {e}")
        return False
    finally:
        db_service.close()


if __name__ == "__main__":
    success = asyncio.run(validate_all())
    sys.exit(0 if success else 1)

