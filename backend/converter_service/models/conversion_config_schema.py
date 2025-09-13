"""
Conversion Configuration Schema Validation
Ensures all conversion configs follow the correct structure for the template-based system
"""

from pydantic import BaseModel, Field, validator, root_validator
from typing import Dict, Any, List, Optional, Union, Literal
from enum import Enum
from datetime import datetime


class ProcessingLane(str, Enum):
    """Valid processing lanes"""
    RULES = "RULES"
    AI = "AI"
    HUMAN = "HUMAN"


class ParserType(str, Enum):
    """Valid parser types"""
    REGEX = "regex"
    XML = "xml"
    JSON = "json"
    CSV = "csv"
    BINARY = "binary"


class TransformType(str, Enum):
    """Valid transform types"""
    COPY = "copy"
    SET_VALUE = "set_value"
    DATE_FORMAT = "date_format"
    NORMALIZE_AMOUNT = "normalize_amount"
    MAP_CHARGE_BEARER = "map_charge_bearer"
    PARSE_PARTY_FIELD = "parse_party_field"
    EXTRACT_ACCOUNT = "extract_account"
    AI_EXTRACT = "ai_extract"
    JOIN_ARRAY = "join_array"


class BuilderType(str, Enum):
    """Valid builder types"""
    JSON = "json"
    XML = "xml"
    TEMPLATE = "template"
    CSV = "csv"


# ============= Parser Configuration =============

class ParserField(BaseModel):
    """Parser field definition"""
    pattern: Optional[str] = Field(None, description="Regex pattern for extraction")
    xpath: Optional[str] = Field(None, description="XPath for XML extraction")
    path: Optional[str] = Field(None, description="JSON path for extraction")
    name: str = Field(..., description="Human-readable field name")
    multiline: bool = Field(False, description="Whether field spans multiple lines")
    components: Optional[Dict[str, List[Union[int, None]]]] = Field(
        None, description="Component extraction indices for composite fields"
    )
    attributes: Optional[List[str]] = Field(None, description="XML attributes to extract")
    
    @validator('pattern', 'xpath', 'path')
    def at_least_one_extraction_method(cls, v, values):
        """Ensure at least one extraction method is specified"""
        if not v and not values.get('pattern') and not values.get('xpath') and not values.get('path'):
            raise ValueError("Must specify pattern, xpath, or path for field extraction")
        return v


class ParserConfig(BaseModel):
    """Parser configuration"""
    type: ParserType = Field(..., description="Parser type")
    block_pattern: Optional[str] = Field(None, description="Block extraction pattern (MT formats)")
    content_block: Optional[str] = Field(None, description="Which block contains data")
    namespace: Optional[str] = Field(None, description="XML namespace")
    fields: Dict[str, ParserField] = Field(..., description="Field extraction definitions")
    
    @validator('fields')
    def validate_fields_not_empty(cls, v):
        if not v:
            raise ValueError("Parser must define at least one field")
        return v


# ============= Mapping Configuration =============

class TransformConfig(BaseModel):
    """Transform configuration parameters"""
    value: Optional[Any] = Field(None, description="Value for set_value transform")
    input_format: Optional[str] = Field(None, description="Input date format")
    output_format: Optional[str] = Field(None, description="Output date format")
    mapping: Optional[Dict[str, str]] = Field(None, description="Value mapping dictionary")
    separator: Optional[str] = Field(None, description="Separator for join_array")
    
    class Config:
        extra = "allow"  # Allow additional fields for custom transforms


class MappingConfig(BaseModel):
    """Field mapping configuration"""
    source: str = Field(..., description="Source field or _constant")
    targets: List[str] = Field(..., min_items=1, description="Target field names (FLAT, not nested)")
    transform: Optional[TransformType] = Field(None, description="Transform to apply")
    transform_config: Optional[TransformConfig] = Field(None, description="Transform parameters")
    processing_lane: ProcessingLane = Field(ProcessingLane.RULES, description="Processing lane")
    
    # For RULES lane
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="Fixed confidence")
    
    # For AI lane
    field_type: Optional[str] = Field(None, description="AI field type for prompt selection")
    confidence_threshold: Optional[float] = Field(None, ge=0.0, le=1.0, description="Min AI confidence")
    
    @root_validator
    def validate_lane_specific_fields(cls, values):
        """Validate lane-specific requirements"""
        lane = values.get('processing_lane')
        
        if lane == ProcessingLane.AI:
            if not values.get('field_type'):
                raise ValueError("AI lane requires field_type")
            if values.get('transform') != TransformType.AI_EXTRACT:
                values['transform'] = TransformType.AI_EXTRACT
        elif lane == ProcessingLane.RULES:
            if not values.get('transform'):
                values['transform'] = TransformType.COPY
        
        return values
    
    @validator('targets')
    def validate_flat_targets(cls, v):
        """Ensure targets are flat variable names, not nested paths"""
        for target in v:
            if '.' in target and not target.startswith('{{'):
                raise ValueError(
                    f"Target '{target}' appears to be a nested path. "
                    "Use flat variable names for template-based system (e.g., 'transaction_reference' not 'transaction.reference')"
                )
        return v


# ============= Builder Configuration =============

class BuilderConfig(BaseModel):
    """Builder configuration"""
    type: BuilderType = Field(..., description="Builder type")
    template: Optional[Union[Dict[str, Any], str]] = Field(
        None, description="Template structure with {{placeholders}}"
    )
    structure: Optional[Dict[str, Any]] = Field(
        None, description="Structure for non-template builders (deprecated)"
    )
    pretty_print: bool = Field(True, description="Pretty print output")
    null_handling: Literal["omit", "include", "empty"] = Field(
        "omit", description="How to handle null values"
    )
    array_handling: Literal["preserve_empty", "omit_empty"] = Field(
        "preserve_empty", description="How to handle empty arrays"
    )
    placeholders: Optional[Dict[str, Any]] = Field(
        None, description="Default placeholder values"
    )
    namespace: Optional[str] = Field(None, description="XML namespace")
    root_element: Optional[str] = Field(None, description="XML root element")
    
    @root_validator
    def validate_builder_requirements(cls, values):
        """Validate builder has required fields"""
        builder_type = values.get('type')
        
        if builder_type in [BuilderType.JSON, BuilderType.XML]:
            if not values.get('template') and not values.get('structure'):
                raise ValueError(f"{builder_type} builder requires template or structure")
            
            # Prefer template over structure
            if values.get('structure') and not values.get('template'):
                import warnings
                warnings.warn(
                    "Using 'structure' is deprecated. Use 'template' with {{placeholders}} instead",
                    DeprecationWarning
                )
        
        return values
    
    @validator('template')
    def validate_template_placeholders(cls, v, values):
        """Validate template contains proper placeholders"""
        if v and isinstance(v, (dict, str)):
            template_str = str(v)
            # Check for placeholder pattern
            import re
            placeholders = re.findall(r'{{(\w+)}}', template_str)
            if not placeholders and values.get('type') != BuilderType.XML:
                import warnings
                warnings.warn(
                    "Template doesn't contain any {{placeholders}}. "
                    "Ensure mappings create variables that match template placeholders",
                    UserWarning
                )
        return v


# ============= AI Service Configuration =============

class AIModelConfig(BaseModel):
    """AI model configuration"""
    model_id: str = Field(..., description="Full model identifier")
    max_tokens: int = Field(1000, description="Maximum tokens for response")
    temperature: float = Field(0.1, ge=0.0, le=1.0, description="Model temperature")
    complexity_threshold: Optional[Dict[str, int]] = Field(
        None, description="Complexity thresholds for model selection"
    )


class AIFieldType(BaseModel):
    """AI field type definition"""
    description: str = Field(..., description="Field type description")
    used_by: List[str] = Field(..., description="Formats that use this field type")
    prompt_template: str = Field(..., description="Prompt template with {{field_value}}")
    validation_rules: Optional[Dict[str, Any]] = Field(
        default_factory=dict, description="Validation rules for AI output"
    )


class AIServiceConfig(BaseModel):
    """AI service configuration"""
    provider: str = Field("bedrock", description="AI provider")
    region: str = Field("us-east-1", description="AWS region")
    models: Dict[str, AIModelConfig] = Field(..., description="Available models")
    field_types: Optional[Dict[str, AIFieldType]] = Field(
        None, description="Field type definitions"
    )
    prompt_templates: Optional[Dict[str, str]] = Field(
        None, description="Simple prompt templates (deprecated)"
    )
    confidence_config: Optional[Dict[str, Any]] = Field(
        None, description="Confidence calculation configuration"
    )


# ============= Human Review Configuration =============

class HumanReviewConfig(BaseModel):
    """Human review configuration"""
    enabled: bool = Field(True, description="Whether human review is enabled")
    default_threshold: float = Field(0.8, ge=0.0, le=1.0, description="Default confidence threshold")
    field_thresholds: Optional[Dict[str, float]] = Field(
        None, description="Field-specific thresholds"
    )


# ============= Complete Conversion Configuration =============

class ConversionConfig(BaseModel):
    """Complete conversion configuration schema"""
    id: str = Field(..., alias="_id", description="Conversion ID (SOURCE_to_TARGET)")
    parser: ParserConfig = Field(..., description="Parser configuration")
    mappings: List[MappingConfig] = Field(..., min_items=1, description="Field mappings")
    builder: BuilderConfig = Field(..., description="Builder configuration")
    ai_service: Optional[AIServiceConfig] = Field(None, description="AI service configuration")
    human_review: Optional[HumanReviewConfig] = Field(None, description="Human review configuration")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Configuration metadata")
    
    class Config:
        populate_by_name = True
        allow_population_by_field_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}
    
    @validator('id', pre=True, always=True)
    def validate_id_format(cls, v):
        """Validate ID follows SOURCE_to_TARGET format"""
        if '_to_' not in v:
            raise ValueError(f"ID must follow 'SOURCE_to_TARGET' format, got: {v}")
        return v
    
    @root_validator
    def validate_mapping_target_consistency(cls, values):
        """Ensure mapping targets match builder template placeholders"""
        mappings = values.get('mappings', [])
        builder = values.get('builder')
        
        if not builder or not mappings:
            return values
        
        # Extract all target variables from mappings
        target_vars = set()
        for mapping in mappings:
            target_vars.update(mapping.targets)
        
        # Extract placeholders from template
        template = builder.template
        if template and isinstance(template, (dict, str)):
            import re
            template_str = str(template)
            placeholders = set(re.findall(r'{{(\w+)}}', template_str))
            
            # Check for orphaned placeholders (in template but not in mappings)
            orphaned = placeholders - target_vars - {'current_time', 'sender_bic', 'receiver_bic'}
            if orphaned:
                import warnings
                warnings.warn(
                    f"Template contains placeholders not created by mappings: {orphaned}. "
                    "These will need default values or will be empty",
                    UserWarning
                )
            
            # Check for unused variables (in mappings but not in template)
            unused = target_vars - placeholders
            if unused and len(unused) < len(target_vars):  # Some are used
                import warnings
                warnings.warn(
                    f"Mappings create variables not used in template: {unused}",
                    UserWarning
                )
        
        return values
    
    @root_validator
    def validate_ai_lane_configuration(cls, values):
        """Ensure AI lane mappings have corresponding field types"""
        mappings = values.get('mappings', [])
        ai_service = values.get('ai_service')
        
        ai_mappings = [m for m in mappings if m.processing_lane == ProcessingLane.AI]
        
        if ai_mappings and not ai_service:
            raise ValueError("AI lane mappings require ai_service configuration")
        
        if ai_mappings and ai_service and ai_service.field_types:
            for mapping in ai_mappings:
                if mapping.field_type and mapping.field_type not in ai_service.field_types:
                    import warnings
                    warnings.warn(
                        f"AI mapping uses undefined field_type: {mapping.field_type}",
                        UserWarning
                    )
        
        return values


# ============= Validation Functions =============

def validate_conversion_config(config_dict: Dict[str, Any]) -> ConversionConfig:
    """
    Validate a conversion configuration dictionary
    
    Args:
        config_dict: Raw configuration dictionary
        
    Returns:
        Validated ConversionConfig object
        
    Raises:
        ValidationError: If configuration is invalid
    """
    return ConversionConfig(**config_dict)


def validate_canonical_json_consistency(
    source_config: ConversionConfig,
    target_config: ConversionConfig
) -> bool:
    """
    Validate that two configs produce/consume consistent canonical JSON
    
    Args:
        source_config: X_to_JSON configuration
        target_config: JSON_to_Y configuration
        
    Returns:
        True if configurations are compatible
    """
    if not source_config.id.endswith("_to_JSON"):
        raise ValueError(f"Source config must be X_to_JSON, got: {source_config.id}")
    
    if not target_config.id.startswith("JSON_to_"):
        raise ValueError(f"Target config must be JSON_to_Y, got: {target_config.id}")
    
    # Extract output variables from source
    source_outputs = set()
    for mapping in source_config.mappings:
        source_outputs.update(mapping.targets)
    
    # Extract input variables from target
    target_inputs = set()
    for mapping in target_config.mappings:
        if mapping.source != "_constant":
            target_inputs.add(mapping.source)
    
    # Check compatibility
    missing_inputs = target_inputs - source_outputs
    if missing_inputs:
        import warnings
        warnings.warn(
            f"Target config expects variables not produced by source: {missing_inputs}",
            UserWarning
        )
        return False
    
    return True


def generate_config_report(config: ConversionConfig) -> Dict[str, Any]:
    """
    Generate a detailed report about a conversion configuration
    
    Args:
        config: Conversion configuration to analyze
        
    Returns:
        Report dictionary with statistics and analysis
    """
    report = {
        "id": config.id,
        "parser_type": config.parser.type,
        "builder_type": config.builder.type,
        "field_count": len(config.parser.fields),
        "mapping_count": len(config.mappings),
        "lane_distribution": {
            "RULES": 0,
            "AI": 0,
            "HUMAN": 0
        },
        "target_variables": set(),
        "ai_field_types": set(),
        "warnings": []
    }
    
    # Analyze mappings
    for mapping in config.mappings:
        report["lane_distribution"][mapping.processing_lane.value] += 1
        report["target_variables"].update(mapping.targets)
        
        if mapping.field_type:
            report["ai_field_types"].add(mapping.field_type)
    
    # Check for issues
    if report["lane_distribution"]["AI"] > 0 and not config.ai_service:
        report["warnings"].append("AI mappings present but no ai_service configured")
    
    if config.builder.structure and not config.builder.template:
        report["warnings"].append("Using deprecated 'structure' instead of 'template'")
    
    # Calculate percentages
    total_mappings = report["mapping_count"]
    if total_mappings > 0:
        report["lane_percentages"] = {
            lane: (count / total_mappings * 100)
            for lane, count in report["lane_distribution"].items()
        }
    
    return report


# ============= Testing Utilities =============

class ConfigValidator:
    """Utility class for validating conversion configurations"""
    
    @staticmethod
    def validate_file(file_path: str) -> ConversionConfig:
        """Validate a configuration file"""
        import json
        with open(file_path, 'r') as f:
            config_dict = json.load(f)
        return validate_conversion_config(config_dict)
    
    @staticmethod
    def validate_mongodb_document(document: Dict[str, Any]) -> ConversionConfig:
        """Validate a MongoDB document"""
        # MongoDB uses _id, Pydantic expects id
        if '_id' in document and 'id' not in document:
            document['id'] = document['_id']
        return validate_conversion_config(document)
    
    @staticmethod
    def batch_validate(configs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Validate multiple configurations and generate report"""
        results = {
            "total": len(configs),
            "valid": 0,
            "invalid": 0,
            "errors": [],
            "warnings": []
        }
        
        for config_dict in configs:
            try:
                config = validate_conversion_config(config_dict)
                results["valid"] += 1
                
                # Check for warnings
                report = generate_config_report(config)
                if report["warnings"]:
                    results["warnings"].append({
                        "id": config.id,
                        "warnings": report["warnings"]
                    })
                    
            except Exception as e:
                results["invalid"] += 1
                results["errors"].append({
                    "id": config_dict.get("_id", "unknown"),
                    "error": str(e)
                })
        
        return results


if __name__ == "__main__":
    # Example usage
    sample_config = {
        "_id": "MT103_to_JSON",
        "parser": {
            "type": "regex",
            "fields": {
                "20": {
                    "pattern": r":20:([^\n:]+)",
                    "name": "transaction_reference"
                }
            }
        },
        "mappings": [
            {
                "source": "20",
                "targets": ["transaction_reference"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 1.0
            }
        ],
        "builder": {
            "type": "json",
            "template": {
                "transaction": {
                    "reference": "{{transaction_reference}}"
                }
            }
        }
    }
    
    try:
        config = validate_conversion_config(sample_config)
        print("✅ Configuration is valid!")
        
        report = generate_config_report(config)
        print(f"\n📊 Configuration Report:")
        print(f"  Fields: {report['field_count']}")
        print(f"  Mappings: {report['mapping_count']}")
        print(f"  Lane distribution: {report['lane_distribution']}")
        
    except Exception as e:
        print(f"❌ Validation failed: {e}")