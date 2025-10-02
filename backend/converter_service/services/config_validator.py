"""
Configuration Validator Service
Validates auto-generated configs against MongoDB conversion_registry schema
"""

from typing import Dict, List, Any, Optional
import re
import logging

logger = logging.getLogger(__name__)


class ValidationError:
    """Represents a validation error"""
    def __init__(self, field: str, message: str, severity: str = "error", suggestion: str = None):
        self.field = field
        self.message = message
        self.severity = severity  # "error" or "warning"
        self.suggestion = suggestion

    def to_dict(self):
        return {
            "field": self.field,
            "message": self.message,
            "severity": self.severity,
            "suggestion": self.suggestion
        }


class ValidationCheck:
    """Represents a validation check result"""
    def __init__(self, name: str, status: str, details: str, icon: str = "📋", errors: List[ValidationError] = None):
        self.name = name
        self.status = status  # "passed", "warning", "failed"
        self.details = details
        self.icon = icon
        self.errors = errors or []

    def to_dict(self):
        return {
            "name": self.name,
            "status": self.status,
            "details": self.details,
            "icon": self.icon,
            "errors": [e.to_dict() for e in self.errors]
        }


class ValidationResult:
    """Validation result container"""
    def __init__(self):
        self.valid = True
        self.score = 100
        self.checks: List[ValidationCheck] = []
        self.errors: List[ValidationError] = []
        self.warnings: List[ValidationError] = []

    def add_check(self, check: ValidationCheck):
        self.checks.append(check)
        if check.status == "failed":
            self.valid = False
            self.errors.extend(check.errors)
        elif check.status == "warning":
            self.warnings.extend(check.errors)

    def calculate_score(self):
        """Calculate overall score based on passed checks"""
        if not self.checks:
            self.score = 0
            return

        total_checks = len(self.checks)
        passed_checks = sum(1 for c in self.checks if c.status == "passed")
        warning_checks = sum(1 for c in self.checks if c.status == "warning")

        # Full credit for passed, half credit for warnings
        self.score = int(((passed_checks + (warning_checks * 0.5)) / total_checks) * 100)

    def to_dict(self):
        self.calculate_score()
        return {
            "valid": self.valid,
            "score": self.score,
            "checks": [c.to_dict() for c in self.checks],
            "errors": [e.to_dict() for e in self.errors],
            "warnings": [w.to_dict() for w in self.warnings]
        }


class ConfigValidator:
    """
    Validates conversion configurations against MongoDB schema
    """

    # Valid values for schema fields
    VALID_PARSER_TYPES = ["regex", "xml", "json", "csv", "binary"]
    VALID_BUILDER_TYPES = ["xml", "json", "csv", "fixed"]
    VALID_PROCESSING_LANES = ["RULES", "AI"]
    VALID_TRANSFORM_TYPES = [
        "copy", "date_format", "map", "remove_comma",
        "extract_account", "extract_name", "extract_lines",
        "ai_extract", "extract_party"
    ]

    def __init__(self):
        pass

    def validate_config(self, config: Dict[str, Any]) -> ValidationResult:
        """
        Validate a configuration against MongoDB schema

        Args:
            config: Configuration dictionary to validate

        Returns:
            ValidationResult with detailed validation results
        """
        result = ValidationResult()

        # Run all validation checks
        result.add_check(self._validate_required_fields(config))
        result.add_check(self._validate_parser(config))
        result.add_check(self._validate_mappings(config))
        result.add_check(self._validate_ai_config(config))
        result.add_check(self._validate_builder(config))
        result.add_check(self._validate_human_review(config))

        return result

    def _validate_required_fields(self, config: Dict) -> ValidationCheck:
        """Validate that all required top-level fields are present"""
        errors = []
        required_fields = ["_id", "parser", "mappings", "ai_service", "builder", "human_review"]

        for field in required_fields:
            if field not in config:
                errors.append(ValidationError(
                    field=field,
                    message=f"Required field '{field}' is missing",
                    severity="error",
                    suggestion=f"Add '{field}' field to configuration"
                ))

        # Validate _id format
        if "_id" in config:
            config_id = config["_id"]
            if not re.match(r"^[A-Z0-9]+_to_[A-Za-z0-9.]+$", config_id):
                errors.append(ValidationError(
                    field="_id",
                    message=f"Invalid _id format: '{config_id}'",
                    severity="error",
                    suggestion="Format should be 'SOURCE_to_TARGET' (e.g., 'MT103_to_pacs.008')"
                ))

        if errors:
            return ValidationCheck(
                name="Required Fields",
                status="failed",
                details=f"Missing {len(errors)} required field(s)",
                icon="📋",
                errors=errors
            )
        else:
            return ValidationCheck(
                name="Required Fields",
                status="passed",
                details="All required fields are present",
                icon="📋"
            )

    def _validate_parser(self, config: Dict) -> ValidationCheck:
        """Validate parser configuration"""
        errors = []
        parser = config.get("parser", {})

        # Check parser type
        parser_type = parser.get("type")
        if not parser_type:
            errors.append(ValidationError(
                field="parser.type",
                message="Parser type is missing",
                severity="error",
                suggestion=f"Set parser.type to one of: {', '.join(self.VALID_PARSER_TYPES)}"
            ))
        elif parser_type not in self.VALID_PARSER_TYPES:
            errors.append(ValidationError(
                field="parser.type",
                message=f"Invalid parser type: '{parser_type}'",
                severity="error",
                suggestion=f"Valid types: {', '.join(self.VALID_PARSER_TYPES)}"
            ))

        # Check fields structure
        fields = parser.get("fields", {})
        if not fields:
            errors.append(ValidationError(
                field="parser.fields",
                message="Parser fields are empty",
                severity="error",
                suggestion="Add at least one field with pattern and name"
            ))
        else:
            # Validate each field
            for field_id, field_config in fields.items():
                if not isinstance(field_config, dict):
                    errors.append(ValidationError(
                        field=f"parser.fields.{field_id}",
                        message=f"Field '{field_id}' must be an object",
                        severity="error"
                    ))
                    continue

                # Check pattern
                if "pattern" not in field_config:
                    errors.append(ValidationError(
                        field=f"parser.fields.{field_id}.pattern",
                        message=f"Field '{field_id}' is missing 'pattern'",
                        severity="error"
                    ))
                else:
                    # Validate regex pattern
                    try:
                        re.compile(field_config["pattern"])
                    except re.error as e:
                        errors.append(ValidationError(
                            field=f"parser.fields.{field_id}.pattern",
                            message=f"Invalid regex pattern: {str(e)}",
                            severity="error",
                            suggestion="Fix the regex pattern syntax"
                        ))

                # Check name
                if "name" not in field_config:
                    errors.append(ValidationError(
                        field=f"parser.fields.{field_id}.name",
                        message=f"Field '{field_id}' is missing 'name'",
                        severity="warning",
                        suggestion="Add descriptive name for field"
                    ))

                # Validate components if present
                if "components" in field_config:
                    components = field_config["components"]
                    if not isinstance(components, dict):
                        errors.append(ValidationError(
                            field=f"parser.fields.{field_id}.components",
                            message="Components must be a dictionary",
                            severity="error"
                        ))

        if errors:
            status = "failed" if any(e.severity == "error" for e in errors) else "warning"
            return ValidationCheck(
                name="Parser Configuration",
                status=status,
                details=f"Found {len(errors)} issue(s) in parser",
                icon="⚙️",
                errors=errors
            )
        else:
            return ValidationCheck(
                name="Parser Configuration",
                status="passed",
                details=f"Parser is valid with {len(fields)} field(s)",
                icon="⚙️"
            )

    def _validate_mappings(self, config: Dict) -> ValidationCheck:
        """Validate mappings array"""
        errors = []
        mappings = config.get("mappings", [])

        if not mappings:
            errors.append(ValidationError(
                field="mappings",
                message="Mappings array is empty",
                severity="error",
                suggestion="Add at least one mapping"
            ))
            return ValidationCheck(
                name="Mapping Structure",
                status="failed",
                details="No mappings defined",
                icon="🔗",
                errors=errors
            )

        # Validate each mapping
        for idx, mapping in enumerate(mappings):
            # Check source
            if "source" not in mapping:
                errors.append(ValidationError(
                    field=f"mappings[{idx}].source",
                    message=f"Mapping {idx} is missing 'source' field",
                    severity="error"
                ))

            # Check targets
            if "targets" not in mapping:
                errors.append(ValidationError(
                    field=f"mappings[{idx}].targets",
                    message=f"Mapping {idx} is missing 'targets' field",
                    severity="error"
                ))
            elif not isinstance(mapping["targets"], list):
                errors.append(ValidationError(
                    field=f"mappings[{idx}].targets",
                    message=f"Mapping {idx} targets must be an array",
                    severity="error"
                ))
            elif len(mapping["targets"]) == 0:
                errors.append(ValidationError(
                    field=f"mappings[{idx}].targets",
                    message=f"Mapping {idx} has empty targets array",
                    severity="warning",
                    suggestion="Remove mapping or add target fields"
                ))

            # Check processing_lane
            lane = mapping.get("processing_lane", "RULES")
            if lane not in self.VALID_PROCESSING_LANES:
                errors.append(ValidationError(
                    field=f"mappings[{idx}].processing_lane",
                    message=f"Invalid processing lane: '{lane}'",
                    severity="error",
                    suggestion=f"Use 'RULES' or 'AI'"
                ))

            # Check transform
            transform = mapping.get("transform")
            if not transform:
                errors.append(ValidationError(
                    field=f"mappings[{idx}].transform",
                    message=f"Mapping {idx} is missing 'transform'",
                    severity="error"
                ))
            elif transform not in self.VALID_TRANSFORM_TYPES:
                errors.append(ValidationError(
                    field=f"mappings[{idx}].transform",
                    message=f"Unknown transform type: '{transform}'",
                    severity="warning",
                    suggestion=f"Common transforms: copy, date_format, ai_extract"
                ))

            # AI lane specific validation
            if lane == "AI":
                if transform != "ai_extract":
                    errors.append(ValidationError(
                        field=f"mappings[{idx}].transform",
                        message=f"AI lane should use 'ai_extract' transform",
                        severity="warning"
                    ))

                if "field_type" not in mapping:
                    errors.append(ValidationError(
                        field=f"mappings[{idx}].field_type",
                        message=f"AI mapping {idx} is missing 'field_type'",
                        severity="error",
                        suggestion="Add field_type for AI processing (e.g., 'remittance', 'sender_receiver_info')"
                    ))

            # Check confidence if present
            if "confidence" in mapping:
                conf = mapping["confidence"]
                if not isinstance(conf, (int, float)) or conf < 0 or conf > 1:
                    errors.append(ValidationError(
                        field=f"mappings[{idx}].confidence",
                        message=f"Confidence must be between 0.0 and 1.0, got {conf}",
                        severity="error"
                    ))

        if errors:
            status = "failed" if any(e.severity == "error" for e in errors) else "warning"
            return ValidationCheck(
                name="Mapping Structure",
                status=status,
                details=f"Found {len(errors)} issue(s) in {len(mappings)} mapping(s)",
                icon="🔗",
                errors=errors
            )
        else:
            return ValidationCheck(
                name="Mapping Structure",
                status="passed",
                details=f"All {len(mappings)} mappings are valid",
                icon="🔗"
            )

    def _validate_ai_config(self, config: Dict) -> ValidationCheck:
        """Validate AI service configuration"""
        errors = []
        ai_config = config.get("ai_service", {})

        # Check provider
        if "provider" not in ai_config:
            errors.append(ValidationError(
                field="ai_service.provider",
                message="AI provider is missing",
                severity="warning",
                suggestion="Add provider: 'bedrock'"
            ))

        # Check region
        if "region" not in ai_config:
            errors.append(ValidationError(
                field="ai_service.region",
                message="AWS region is missing",
                severity="warning",
                suggestion="Add region (e.g., 'us-east-1')"
            ))

        # Check models
        if "models" not in ai_config:
            errors.append(ValidationError(
                field="ai_service.models",
                message="Models configuration is missing",
                severity="warning",
                suggestion="Add models configuration"
            ))
        else:
            models = ai_config["models"]
            if not isinstance(models, dict) or len(models) == 0:
                errors.append(ValidationError(
                    field="ai_service.models",
                    message="Models must be a non-empty object",
                    severity="warning"
                ))

        # Check field_types
        if "field_types" not in ai_config:
            errors.append(ValidationError(
                field="ai_service.field_types",
                message="Field types are missing",
                severity="warning",
                suggestion="Add field_types configuration"
            ))
        else:
            field_types = ai_config["field_types"]
            if not isinstance(field_types, dict):
                errors.append(ValidationError(
                    field="ai_service.field_types",
                    message="Field types must be an object",
                    severity="error"
                ))

        if errors:
            status = "failed" if any(e.severity == "error" for e in errors) else "warning"
            return ValidationCheck(
                name="AI Configuration",
                status=status,
                details=f"Found {len(errors)} issue(s) in AI config",
                icon="🧠",
                errors=errors
            )
        else:
            return ValidationCheck(
                name="AI Configuration",
                status="passed",
                details="AI service is properly configured",
                icon="🧠"
            )

    def _validate_builder(self, config: Dict) -> ValidationCheck:
        """Validate builder configuration"""
        errors = []
        builder = config.get("builder", {})

        # Check builder type
        builder_type = builder.get("type")
        if not builder_type:
            errors.append(ValidationError(
                field="builder.type",
                message="Builder type is missing",
                severity="error",
                suggestion=f"Set builder.type to one of: {', '.join(self.VALID_BUILDER_TYPES)}"
            ))
        elif builder_type not in self.VALID_BUILDER_TYPES:
            errors.append(ValidationError(
                field="builder.type",
                message=f"Invalid builder type: '{builder_type}'",
                severity="error",
                suggestion=f"Valid types: {', '.join(self.VALID_BUILDER_TYPES)}"
            ))

        # Check template
        if "template" not in builder:
            errors.append(ValidationError(
                field="builder.template",
                message="Builder template is missing",
                severity="error",
                suggestion="Add template structure for output format"
            ))
        else:
            template = builder["template"]
            if not isinstance(template, dict):
                errors.append(ValidationError(
                    field="builder.template",
                    message="Template must be an object",
                    severity="error"
                ))

        # Check namespace for XML builders
        if builder_type == "xml" and "namespace" not in builder:
            errors.append(ValidationError(
                field="builder.namespace",
                message="XML builder requires namespace",
                severity="warning",
                suggestion="Add namespace URI (e.g., 'urn:iso:std:iso:20022')"
            ))

        if errors:
            status = "failed" if any(e.severity == "error" for e in errors) else "warning"
            return ValidationCheck(
                name="Builder Template",
                status=status,
                details=f"Found {len(errors)} issue(s) in builder",
                icon="🏗️",
                errors=errors
            )
        else:
            return ValidationCheck(
                name="Builder Template",
                status="passed",
                details="Builder configuration is valid",
                icon="🏗️"
            )

    def _validate_human_review(self, config: Dict) -> ValidationCheck:
        """Validate human review configuration"""
        errors = []
        human_review = config.get("human_review", {})

        # Check enabled flag
        if "enabled" not in human_review:
            errors.append(ValidationError(
                field="human_review.enabled",
                message="Human review enabled flag is missing",
                severity="warning",
                suggestion="Add 'enabled': true or false"
            ))

        # Check default threshold
        if "default_threshold" not in human_review:
            errors.append(ValidationError(
                field="human_review.default_threshold",
                message="Default threshold is missing",
                severity="warning",
                suggestion="Add default_threshold (e.g., 0.8)"
            ))
        else:
            threshold = human_review["default_threshold"]
            if not isinstance(threshold, (int, float)) or threshold < 0 or threshold > 1:
                errors.append(ValidationError(
                    field="human_review.default_threshold",
                    message=f"Threshold must be between 0.0 and 1.0, got {threshold}",
                    severity="error"
                ))

        if errors:
            status = "warning"  # Human review issues are typically non-critical
            return ValidationCheck(
                name="Human Review Settings",
                status=status,
                details=f"Found {len(errors)} issue(s) in human review config",
                icon="👤",
                errors=errors
            )
        else:
            return ValidationCheck(
                name="Human Review Settings",
                status="passed",
                details="Human review is properly configured",
                icon="👤"
            )
