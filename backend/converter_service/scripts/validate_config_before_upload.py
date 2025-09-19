#!/usr/bin/env python3
"""
Simple validation script to check if a conversion config is valid BEFORE uploading to MongoDB
Ensures it has all required fields and will work with parser, transformer, and builder
"""

import json
import sys
from typing import Dict, List, Any

def validate_config(config: Dict[str, Any]) -> tuple[bool, List[str]]:
    """
    Validate a conversion configuration matches our schema

    Returns:
        (is_valid, list_of_errors)
    """
    errors = []

    # 1. Check required top-level fields
    required_fields = ['_id', 'parser', 'mappings', 'ai_service', 'builder', 'human_review']
    for field in required_fields:
        if field not in config:
            errors.append(f"Missing required field: {field}")

    if not errors:  # Only check nested fields if top-level is present

        # 2. Validate parser section
        parser = config.get('parser', {})
        if 'type' not in parser:
            errors.append("parser.type is required")
        if 'fields' not in parser:
            errors.append("parser.fields is required")
        elif not isinstance(parser['fields'], dict):
            errors.append("parser.fields must be a dictionary")

        # 3. Validate mappings
        mappings = config.get('mappings', [])
        if not isinstance(mappings, list):
            errors.append("mappings must be a list")
        elif len(mappings) == 0:
            errors.append("mappings cannot be empty")
        else:
            for i, mapping in enumerate(mappings):
                # Each mapping needs these fields
                if 'source' not in mapping:
                    errors.append(f"mapping[{i}]: missing 'source'")
                if 'targets' not in mapping:
                    errors.append(f"mapping[{i}]: missing 'targets'")
                elif not isinstance(mapping['targets'], list):
                    errors.append(f"mapping[{i}]: 'targets' must be a list")
                if 'processing_lane' not in mapping:
                    errors.append(f"mapping[{i}]: missing 'processing_lane'")
                elif mapping['processing_lane'] not in ['RULES', 'AI']:
                    errors.append(f"mapping[{i}]: processing_lane must be 'RULES' or 'AI'")

                # Check transform exists
                if 'transform' not in mapping and mapping.get('processing_lane') == 'RULES':
                    errors.append(f"mapping[{i}]: RULES lane requires 'transform'")

                # AI lane needs field_type
                if mapping.get('processing_lane') == 'AI':
                    if mapping.get('transform') != 'ai_extract':
                        errors.append(f"mapping[{i}]: AI lane must use 'ai_extract' transform")
                    if 'field_type' not in mapping:
                        errors.append(f"mapping[{i}]: AI lane requires 'field_type'")

        # 4. Validate ai_service (minimal check - must exist)
        ai_service = config.get('ai_service', {})
        if 'provider' not in ai_service:
            errors.append("ai_service.provider is required")
        if 'region' not in ai_service:
            errors.append("ai_service.region is required")

        # 5. Validate builder
        builder = config.get('builder', {})
        if 'type' not in builder:
            errors.append("builder.type is required")
        elif builder['type'] not in ['xml', 'json', 'csv', 'fixed']:
            errors.append(f"builder.type '{builder['type']}' is not valid")
        if 'template' not in builder:
            errors.append("builder.template is required")

        # 6. Validate human_review
        human_review = config.get('human_review', {})
        if 'enabled' not in human_review:
            errors.append("human_review.enabled is required")

    return (len(errors) == 0, errors)


def main():
    """Main validation function"""

    if len(sys.argv) < 2:
        print("Usage: python validate_config_before_upload.py <config_file.json>")
        print("\nThis script validates a conversion config JSON file before uploading to MongoDB")
        return 1

    config_file = sys.argv[1]

    try:
        # Load the config file
        with open(config_file, 'r') as f:
            config = json.load(f)

        print(f"Validating configuration: {config.get('_id', 'UNKNOWN')}")
        print("=" * 60)

        # Validate the configuration
        is_valid, errors = validate_config(config)

        if is_valid:
            print("✅ Configuration is VALID and ready to upload!")
            print("\nThis config has:")
            print(f"  - {len(config.get('parser', {}).get('fields', {}))} parser fields")
            print(f"  - {len(config.get('mappings', []))} mappings")
            rules = sum(1 for m in config.get('mappings', []) if m.get('processing_lane') == 'RULES')
            ai = sum(1 for m in config.get('mappings', []) if m.get('processing_lane') == 'AI')
            print(f"  - {rules} RULES lane, {ai} AI lane")
            print(f"  - Builder type: {config.get('builder', {}).get('type', 'unknown')}")
            return 0
        else:
            print("❌ Configuration is INVALID\n")
            print("Errors found:")
            for error in errors:
                print(f"  ❌ {error}")
            print(f"\nTotal errors: {len(errors)}")
            print("\nFix these errors before uploading to MongoDB")
            return 1

    except FileNotFoundError:
        print(f"Error: File '{config_file}' not found")
        return 1
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in file: {e}")
        return 1
    except Exception as e:
        print(f"Error: {e}")
        return 1


if __name__ == "__main__":
    exit(main())