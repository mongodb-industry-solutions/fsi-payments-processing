"""Schema validation - Enforces simplified immutable schema"""

from typing import Any, Dict, List, Union


# Simplified Schema Definition - IMMUTABLE
SIMPLIFIED_SCHEMA = {
    "_id": str,           # Required: {source}_to_{target}
    "extract": dict,      # Required: Field extraction patterns
    "map": list,          # Required: Field mappings (can be empty)
    "output": dict,       # Required: Output paths
    "expires_at": object  # Optional: TTL timestamp for config-builder configs (auto-delete)
}

# Allowed fields in map entries
ALLOWED_MAP_FIELDS = {
    "from": str,          # Source field
    "to": (str, list),    # Target field(s) - can be string or list
    "ai": str,            # Optional: AI field type (triggers AI lane)
    "patterns": dict,     # Optional: Regex patterns for rules-based extraction (alternative to AI)
    "split": list,        # Optional: Split indices for composite fields
    "multiline": bool,    # Optional: Multiline extraction flag
    "dateFormat": str,    # Optional: Date conversion format
    "valueMap": dict,     # Optional: Value mapping dictionary
    "decimal": bool       # Optional: Decimal conversion flag
}


def validate_config(config: Dict[str, Any]) -> bool:
    """
    Validates config against simplified schema.
    
    NO EXCEPTIONS - ALL configs must conform to this schema.
    
    Args:
        config: Configuration dictionary to validate
        
    Returns:
        True if valid
        
    Raises:
        ValueError: If config doesn't conform to schema
    """
    
    # Check all required fields are present
    required_fields = ["_id", "extract", "map", "output"]
    for field in required_fields:
        if field not in config:
            raise ValueError(f"Missing required field: '{field}'")
    
    # Check no extra fields beyond the schema
    for key in config:
        if key not in SIMPLIFIED_SCHEMA:
            raise ValueError(
                f"Field '{key}' not allowed in schema. "
                f"Only allowed: {list(SIMPLIFIED_SCHEMA.keys())}"
            )
    
    # Validate field types
    if not isinstance(config["_id"], str):
        raise ValueError("_id must be a string")
    
    if not isinstance(config["extract"], dict):
        raise ValueError("extract must be a dictionary")
    
    if not isinstance(config["map"], list):
        raise ValueError("map must be a list")
    
    if not isinstance(config["output"], dict):
        raise ValueError("output must be a dictionary")
    
    # Validate map structure
    for i, mapping in enumerate(config.get("map", [])):
        if not isinstance(mapping, dict):
            raise ValueError(f"map[{i}] must be a dictionary")
        
        # Check required fields in mapping
        if "from" not in mapping or "to" not in mapping:
            raise ValueError(f"map[{i}] must have 'from' and 'to' fields")
        
        # Check no extra fields in mapping
        for key in mapping:
            if key not in ALLOWED_MAP_FIELDS:
                raise ValueError(
                    f"map[{i}]: field '{key}' not allowed. "
                    f"Only allowed: {list(ALLOWED_MAP_FIELDS.keys())}"
                )
        
        # Validate 'to' field can be string or list
        if not isinstance(mapping["to"], (str, list)):
            raise ValueError(f"map[{i}]: 'to' must be string or list")
    
    # Validate _id format (should be {source}_to_{target})
    if "_to_" not in config["_id"]:
        raise ValueError(
            f"_id must follow format '{{source}}_to_{{target}}', got: {config['_id']}"
        )
    
    return True


def validate_and_raise(config: Dict[str, Any]) -> None:
    """
    Convenience function that validates and raises on error.
    
    Args:
        config: Configuration to validate
        
    Raises:
        ValueError: If validation fails
    """
    validate_config(config)


def is_valid_config(config: Dict[str, Any]) -> tuple[bool, str]:
    """
    Check if config is valid, return status and message.
    
    Args:
        config: Configuration to validate
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        validate_config(config)
        return True, ""
    except ValueError as e:
        return False, str(e)

