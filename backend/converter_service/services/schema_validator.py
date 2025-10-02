"""
Schema Validator Service using JSON Schema
Validates conversion configurations against the official JSON Schema
and transforms results to match frontend expectations.
"""

import json
import logging
from typing import Dict, List, Any, Optional
from pathlib import Path
from datetime import datetime
import jsonschema
from jsonschema import validate, ValidationError as JSONSchemaError, Draft7Validator

logger = logging.getLogger(__name__)


class SchemaValidator:
    """
    Validates conversion configurations using JSON Schema validation.
    Replaces the manual config_validator.py with proper schema-based validation.
    """

    def __init__(self, schema_path: Optional[str] = None):
        """
        Initialize the Schema Validator

        Args:
            schema_path: Path to the JSON schema file. If not provided, uses default location.
        """
        if schema_path is None:
            # Default schema location
            schema_path = Path(__file__).parent.parent / "schemas" / "conversion_registry_schema.json"
        else:
            schema_path = Path(schema_path)

        if not schema_path.exists():
            raise FileNotFoundError(f"Schema file not found: {schema_path}")

        with open(schema_path, 'r') as f:
            self.schema = json.load(f)

        # Create validator instance for reuse
        self.validator = Draft7Validator(self.schema)

        logger.info(f"Schema validator initialized with schema: {schema_path}")

    def validate(self, config: Dict[str, Any], return_frontend_format: bool = True) -> Dict[str, Any]:
        """
        Validate a configuration against the JSON schema

        Args:
            config: Configuration dictionary to validate
            return_frontend_format: If True, returns in frontend-expected format

        Returns:
            Validation result dictionary
        """
        # Convert datetime objects to strings for validation
        config_copy = self._convert_datetimes(config)

        # Collect all validation errors
        errors = list(self.validator.iter_errors(config_copy))

        # Build validation result
        is_valid = len(errors) == 0

        # Group errors by category
        categorized_errors = self._categorize_errors(errors)

        # Calculate validation score
        score = self._calculate_score(config, errors)

        # Build checks for each category
        checks = self._build_checks(config, categorized_errors)

        # Prepare base result
        result = {
            "valid": is_valid,
            "score": score,
            "checks": checks,
            "error_count": len(errors),
            "errors": [self._format_error(e) for e in errors]
        }

        # Transform to frontend format if requested
        if return_frontend_format:
            result = self._transform_to_frontend_format(result)

        return result

    def _convert_datetimes(self, obj: Any) -> Any:
        """
        Recursively convert datetime objects to ISO format strings

        Args:
            obj: Object to convert

        Returns:
            Object with datetime objects converted to strings
        """
        if isinstance(obj, datetime):
            return obj.isoformat()
        elif isinstance(obj, dict):
            return {key: self._convert_datetimes(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [self._convert_datetimes(item) for item in obj]
        else:
            return obj

    def _categorize_errors(self, errors: List[JSONSchemaError]) -> Dict[str, List[JSONSchemaError]]:
        """
        Categorize validation errors by their type/location

        Args:
            errors: List of JSON schema validation errors

        Returns:
            Dictionary of categorized errors
        """
        categories = {
            "required_fields": [],
            "parser": [],
            "mappings": [],
            "ai_service": [],
            "builder": [],
            "human_review": [],
            "metadata": [],
            "other": []
        }

        for error in errors:
            path = list(error.absolute_path)

            # Categorize based on error path
            if error.validator == "required":
                categories["required_fields"].append(error)
            elif len(path) > 0:
                root_field = path[0]
                if root_field in categories:
                    categories[root_field].append(error)
                else:
                    categories["other"].append(error)
            else:
                categories["other"].append(error)

        return categories

    def _build_checks(self, config: Dict[str, Any], categorized_errors: Dict[str, List]) -> List[Dict]:
        """
        Build validation checks for each category

        Args:
            config: Configuration being validated
            categorized_errors: Errors grouped by category

        Returns:
            List of validation check results
        """
        checks = []

        # Required Fields Check
        required_errors = categorized_errors.get("required_fields", [])
        checks.append({
            "name": "Required Fields",
            "status": "failed" if required_errors else "passed",
            "details": f"Missing {len(required_errors)} required field(s)" if required_errors
                      else "All required fields are present",
            "icon": "📋",
            "errors": [self._format_error(e) for e in required_errors]
        })

        # Parser Configuration Check
        parser_errors = categorized_errors.get("parser", [])
        parser_present = "parser" in config
        checks.append({
            "name": "Parser Configuration",
            "status": "failed" if parser_errors or not parser_present else "passed",
            "details": f"Found {len(parser_errors)} issue(s) in parser" if parser_errors
                      else ("Parser is missing" if not parser_present
                           else f"Parser is valid with {len(config.get('parser', {}).get('fields', {}))} field(s)"),
            "icon": "⚙️",
            "errors": [self._format_error(e) for e in parser_errors]
        })

        # Mapping Structure Check
        mapping_errors = categorized_errors.get("mappings", [])
        mappings_present = "mappings" in config
        mapping_count = len(config.get("mappings", [])) if mappings_present else 0
        checks.append({
            "name": "Mapping Structure",
            "status": "failed" if mapping_errors or not mappings_present else "passed",
            "details": f"Found {len(mapping_errors)} issue(s) in {mapping_count} mapping(s)" if mapping_errors
                      else ("Mappings are missing" if not mappings_present
                           else f"All {mapping_count} mappings are valid"),
            "icon": "🔗",
            "errors": [self._format_error(e) for e in mapping_errors]
        })

        # AI Configuration Check (now optional based on schema analysis)
        ai_errors = categorized_errors.get("ai_service", [])
        ai_present = "ai_service" in config
        has_ai_mappings = any(m.get("processing_lane") == "AI" for m in config.get("mappings", []))

        # Determine if AI service is needed
        ai_needed = has_ai_mappings
        ai_status = "passed"
        ai_details = "AI service is properly configured"

        if ai_errors:
            ai_status = "failed"
            ai_details = f"Found {len(ai_errors)} issue(s) in AI config"
        elif ai_needed and not ai_present:
            ai_status = "warning"
            ai_details = "AI service missing but AI mappings present"
        elif not ai_present:
            ai_details = "AI service not configured (not required)"

        checks.append({
            "name": "AI Configuration",
            "status": ai_status,
            "details": ai_details,
            "icon": "🧠",
            "errors": [self._format_error(e) for e in ai_errors]
        })

        # Builder Template Check
        builder_errors = categorized_errors.get("builder", [])
        builder_present = "builder" in config
        checks.append({
            "name": "Builder Template",
            "status": "failed" if builder_errors or not builder_present else "passed",
            "details": f"Found {len(builder_errors)} issue(s) in builder" if builder_errors
                      else ("Builder is missing" if not builder_present
                           else "Builder configuration is valid"),
            "icon": "🏗️",
            "errors": [self._format_error(e) for e in builder_errors]
        })

        # Human Review Settings Check
        hr_errors = categorized_errors.get("human_review", [])
        hr_present = "human_review" in config
        checks.append({
            "name": "Human Review Settings",
            "status": "warning" if hr_errors else ("passed" if hr_present else "warning"),
            "details": f"Found {len(hr_errors)} issue(s) in human review config" if hr_errors
                      else ("Human review not configured" if not hr_present
                           else "Human review is properly configured"),
            "icon": "👤",
            "errors": [self._format_error(e) for e in hr_errors]
        })

        return checks

    def _calculate_score(self, config: Dict[str, Any], errors: List[JSONSchemaError]) -> int:
        """
        Calculate a validation score (0-100)

        Args:
            config: Configuration being validated
            errors: List of validation errors

        Returns:
            Score between 0 and 100
        """
        if not errors:
            return 100

        # Start with 100 and deduct points for errors
        score = 100

        for error in errors:
            # Deduct more points for required field errors
            if error.validator == "required":
                score -= 15
            # Deduct moderate points for type errors
            elif error.validator == "type":
                score -= 10
            # Deduct fewer points for pattern/format errors
            elif error.validator in ["pattern", "format", "enum"]:
                score -= 5
            # Deduct minimal points for other errors
            else:
                score -= 3

        # Ensure score doesn't go below 0
        return max(0, score)

    def _format_error(self, error: JSONSchemaError) -> Dict[str, Any]:
        """
        Format a JSON schema error into a user-friendly format

        Args:
            error: JSON schema validation error

        Returns:
            Formatted error dictionary
        """
        # Build field path
        path = ".".join(str(p) for p in error.absolute_path) if error.absolute_path else "root"

        # Determine severity
        severity = "error" if error.validator in ["required", "type"] else "warning"

        # Build user-friendly message
        message = error.message

        # Add suggestions based on error type
        suggestion = None
        if error.validator == "required":
            missing_fields = error.validator_value if isinstance(error.validator_value, list) else [error.validator_value]
            suggestion = f"Add required field(s): {', '.join(missing_fields)}"
        elif error.validator == "enum":
            suggestion = f"Valid values: {', '.join(error.validator_value)}"
        elif error.validator == "pattern":
            suggestion = f"Must match pattern: {error.validator_value}"
        elif error.validator == "type":
            suggestion = f"Expected type: {error.validator_value}"

        return {
            "field": path,
            "message": message,
            "severity": severity,
            "suggestion": suggestion,
            "validator": error.validator
        }

    def _transform_to_frontend_format(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform validation result to match frontend expectations

        The frontend expects:
        {
            "details": [{
                "is_valid": true/false,
                "check": "Required Fields",
                "errors": [...]
            }]
        }

        Args:
            result: Standard validation result

        Returns:
            Frontend-formatted result
        """
        frontend_result = {
            "valid": result["valid"],
            "score": result["score"],
            "details": []
        }

        # Transform each check to frontend format
        for check in result["checks"]:
            frontend_check = {
                "is_valid": check["status"] == "passed",
                "check": check["name"],
                "status": check["status"],
                "details": check["details"],
                "icon": check.get("icon", ""),
                "errors": check.get("errors", [])
            }
            frontend_result["details"].append(frontend_check)

        # Add summary
        frontend_result["summary"] = {
            "total_checks": len(result["checks"]),
            "passed": sum(1 for c in result["checks"] if c["status"] == "passed"),
            "warnings": sum(1 for c in result["checks"] if c["status"] == "warning"),
            "failed": sum(1 for c in result["checks"] if c["status"] == "failed"),
            "error_count": result["error_count"]
        }

        return frontend_result

    def validate_field(self, field_value: Any, field_schema: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate a single field against its schema definition

        Args:
            field_value: Value to validate
            field_schema: Schema definition for the field

        Returns:
            Validation result for the field
        """
        try:
            validate(field_value, field_schema)
            return {"valid": True, "errors": []}
        except JSONSchemaError as e:
            return {
                "valid": False,
                "errors": [self._format_error(e)]
            }

    def suggest_fixes(self, config: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Suggest fixes for common validation errors

        Args:
            config: Configuration with validation errors

        Returns:
            List of suggested fixes
        """
        suggestions = []
        errors = list(self.validator.iter_errors(config))

        for error in errors:
            if error.validator == "required":
                # Suggest adding missing required fields
                for field in error.validator_value:
                    if field == "ai_service":
                        suggestions.append({
                            "field": field,
                            "action": "add",
                            "value": {
                                "field_types": {}
                            },
                            "description": "Add AI service configuration"
                        })
                    elif field == "human_review":
                        suggestions.append({
                            "field": field,
                            "action": "add",
                            "value": {
                                "enabled": True,
                                "default_threshold": 0.8,
                                "field_thresholds": {}
                            },
                            "description": "Add human review configuration"
                        })

        return suggestions


# Convenience function for backward compatibility
def validate_config(config: Dict[str, Any], schema_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Validate a configuration using the schema validator

    Args:
        config: Configuration to validate
        schema_path: Optional path to schema file

    Returns:
        Validation result in frontend format
    """
    validator = SchemaValidator(schema_path)
    return validator.validate(config, return_frontend_format=True)