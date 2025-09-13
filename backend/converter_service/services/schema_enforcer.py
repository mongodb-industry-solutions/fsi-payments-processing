"""
Schema Enforcer Service
CRITICAL: This service MUST be used for ALL MongoDB operations to ensure schema compliance.
It validates data BEFORE insertion to prevent schema violations.
"""

import re
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
from enum import Enum
import logging
from pydantic import BaseModel, Field, field_validator, model_validator, ValidationError

logger = logging.getLogger(__name__)


# ============= STRICT ENUMS =============

class ProcessingLane(str, Enum):
    """STRICT: Only these processing lanes are allowed"""
    RULES = "RULES"
    AI = "AI"
    HUMAN = "HUMAN"


class ParserType(str, Enum):
    """STRICT: Only these parser types are allowed"""
    REGEX = "regex"
    XML = "xml"
    JSON = "json"
    TEMPLATE = "template"


class BuilderType(str, Enum):
    """STRICT: Only these builder types are allowed"""
    JSON = "json"
    XML = "xml"
    TEMPLATE = "template"


class TransformType(str, Enum):
    """STRICT: Only these transform types are allowed"""
    COPY = "copy"
    SET_VALUE = "set_value"
    DATE_FORMAT = "date_format"
    NORMALIZE_AMOUNT = "normalize_amount"
    EXTRACT_ACCOUNT = "extract_account"
    EXTRACT_NAME = "extract_name"
    EXTRACT_ADDRESS = "extract_address"
    EXTRACT_BIC = "extract_bic"
    AI_EXTRACT = "ai_extract"
    MAP_CHARGE_BEARER = "map_charge_bearer"
    PARSE_PARTY_FIELD = "parse_party_field"
    JOIN_ARRAY = "join_array"
    CUSTOM = "custom"


# ============= CONVERSION REGISTRY MODELS =============

class ParserField(BaseModel):
    """Parser field definition"""
    pattern: Optional[str] = None
    xpath: Optional[str] = None
    path: Optional[str] = None
    name: str
    multiline: Optional[bool] = False
    components: Optional[Dict[str, List[Optional[int]]]] = None
    attributes: Optional[List[str]] = None


class ParserConfig(BaseModel):
    """Parser configuration - STRICT validation"""
    type: ParserType
    block_pattern: Optional[str] = None
    content_block: Optional[str] = None
    namespace: Optional[str] = None
    fields: Dict[str, ParserField]
    
    @field_validator('fields')
    @classmethod
    def validate_fields_not_empty(cls, v):
        if not v:
            raise ValueError("Parser must define at least one field")
        return v


class MappingConfig(BaseModel):
    """Mapping configuration - STRICT validation"""
    source: str
    targets: List[str]
    transform: Optional[TransformType] = TransformType.COPY
    transform_config: Optional[Dict[str, Any]] = None
    processing_lane: ProcessingLane = ProcessingLane.RULES
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    field_type: Optional[str] = None
    confidence_threshold: Optional[float] = Field(None, ge=0.0, le=1.0)
    
    @field_validator('targets')
    @classmethod
    def validate_targets(cls, v):
        """Validate target naming conventions"""
        if not v:
            raise ValueError("Targets cannot be empty")
        
        for target in v:
            # Allow dots for XML paths (pacs formats) but warn about flat variables
            if '.' in target:
                # This is acceptable for XML paths but log for awareness
                logger.debug(f"Target '{target}' uses dotted notation (valid for XML paths)")
            
            # Check for invalid characters
            if not re.match(r'^[A-Za-z0-9._]+$', target):
                raise ValueError(f"Target '{target}' contains invalid characters")
                
        return v
    
    @model_validator(mode='after')
    def validate_ai_requirements(self):
        """Validate AI lane requirements"""
        if self.processing_lane == ProcessingLane.AI:
            if not self.field_type:
                raise ValueError("AI lane requires 'field_type'")
            if self.transform != TransformType.AI_EXTRACT:
                self.transform = TransformType.AI_EXTRACT
        return self


class BuilderConfig(BaseModel):
    """Builder configuration - STRICT validation"""
    type: BuilderType
    template: Optional[Dict[str, Any]] = None
    structure: Optional[Dict[str, Any]] = None  # Deprecated
    pretty_print: Optional[bool] = True
    null_handling: Optional[str] = "omit"
    array_handling: Optional[str] = "preserve_empty"
    namespace: Optional[str] = None
    root_element: Optional[str] = None
    placeholders: Optional[Dict[str, Any]] = None
    
    @model_validator(mode='after')
    def validate_builder(self):
        """Validate builder has template or structure"""
        if not self.template and not self.structure:
            raise ValueError("Builder must have 'template' or 'structure'")
        
        # Warn about deprecated structure
        if self.structure and not self.template:
            logger.warning("Using 'structure' is deprecated. Use 'template' instead.")
            
        return self


class ConversionRegistryConfig(BaseModel):
    """Complete conversion registry configuration - STRICT validation"""
    id: str = Field(..., alias="_id")
    parser: ParserConfig
    mappings: List[MappingConfig]
    builder: BuilderConfig
    ai_service: Optional[Dict[str, Any]] = None
    human_review: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None
    statistics: Optional[Dict[str, Any]] = None
    
    model_config = {
        "populate_by_name": True,
        "use_enum_values": True,
        "extra": "forbid"  # STRICT: No extra fields allowed
    }
    
    @field_validator('id')
    @classmethod
    def validate_id_format(cls, v):
        """STRICT: Validate ID format"""
        if not re.match(r'^[A-Za-z0-9\.]+_to_[A-Za-z0-9\.]+$', v):
            raise ValueError(f"ID must follow 'SOURCE_to_TARGET' format, got: {v}")
        return v
    
    @field_validator('mappings')
    @classmethod
    def validate_mappings_not_empty(cls, v):
        if not v:
            raise ValueError("Mappings cannot be empty")
        return v
    
    @model_validator(mode='after')
    def validate_template_consistency(self):
        """Validate template placeholders match mapping targets"""
        if self.builder and self.builder.template and self.mappings:
            # Extract placeholders from template
            template_str = str(self.builder.template)
            placeholders = set(re.findall(r'{{([^}]+)}}', template_str))
            
            # Extract targets from mappings
            targets = set()
            for mapping in self.mappings:
                targets.update(mapping.targets)
            
            # System variables that are always available
            system_vars = {'current_time', 'sender_bic', 'receiver_bic', 'namespace', 'message_id'}
            
            # Check for orphaned placeholders
            orphaned = placeholders - targets - system_vars
            if orphaned:
                logger.warning(f"Template has undefined placeholders: {orphaned}")
                # Don't fail, just warn - some might be provided at runtime
            
        return self


# ============= SEMANTIC PATTERNS MODELS =============

class SemanticPatternConfig(BaseModel):
    """Semantic pattern configuration - STRICT validation"""
    id: str = Field(..., alias="_id")
    concept: str
    description: Optional[str] = None
    known_fields: Optional[List[str]] = None
    learned_patterns: Optional[Dict[str, Any]] = None
    field_variations: Optional[Dict[str, str]] = None
    discovery_log: Optional[List[Dict[str, Any]]] = None
    is_seed: Optional[bool] = False
    learning_metadata: Optional[Dict[str, Any]] = None
    purpose: Optional[str] = None
    recognition_rules: Optional[Dict[str, Any]] = None
    
    model_config = {
        "populate_by_name": True,
        "extra": "forbid"
    }


# ============= CONVERSION GRAPH MODELS =============

class ConversionGraphEdge(BaseModel):
    """Conversion graph edge - STRICT validation"""
    source: str
    target: str
    conversion_id: str
    active: Optional[bool] = True
    metadata: Optional[Dict[str, Any]] = None
    
    model_config = {"extra": "forbid"}
    
    @field_validator('conversion_id')
    @classmethod
    def validate_conversion_id(cls, v):
        """Validate conversion_id matches source_to_target pattern"""
        if not re.match(r'^[A-Za-z0-9\.]+_to_[A-Za-z0-9\.]+$', v):
            raise ValueError(f"conversion_id must follow 'SOURCE_to_TARGET' format, got: {v}")
        return v


# ============= CONVERSION PATHS MODELS =============

class PathStep(BaseModel):
    """Path step in conversion path"""
    step: int = Field(..., ge=1)
    from_format: str = Field(..., alias="from")
    to_format: str = Field(..., alias="to")
    conversion_id: str
    estimated_ms: Optional[int] = Field(None, ge=0)
    cost: Optional[float] = Field(None, ge=0.0)
    reliability: Optional[float] = Field(None, ge=0.0, le=1.0)
    
    class Config:
        allow_population_by_field_name = True


class ConversionPath(BaseModel):
    """Conversion path - STRICT validation"""
    id: Optional[str] = Field(None, alias="_id")
    source: str
    target: str
    path: List[PathStep]
    hop_count: int = Field(..., ge=1)
    total_cost: Optional[float] = Field(None, ge=0.0)
    total_latency_ms: Optional[int] = Field(None, ge=0)
    cached_at: Optional[str] = None
    usage_count: Optional[int] = Field(0, ge=0)
    last_used: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    
    model_config = {
        "populate_by_name": True,
        "extra": "forbid"
    }
    
    @model_validator(mode='after')
    def validate_hop_count(self):
        """Validate hop_count matches path length"""
        if self.hop_count and self.path and len(self.path) != self.hop_count:
            raise ValueError(f"hop_count ({self.hop_count}) doesn't match path length ({len(self.path)})")
            
        return self


# ============= CANONICAL JSON MODELS =============

class CanonicalAmount(BaseModel):
    """Canonical amount structure"""
    value: str = Field(..., pattern=r'^\d+(\.\d{1,5})?$')
    currency: str = Field(..., pattern=r'^[A-Z]{3}$')


class CanonicalHeader(BaseModel):
    """Canonical header structure"""
    message_type: str
    timestamp: str
    sender: Optional[str] = None
    receiver: Optional[str] = None
    reference: Optional[str] = None
    priority: Optional[str] = Field(None, pattern=r'^(NORMAL|URGENT|HIGH)$')
    test_flag: Optional[bool] = None


class CanonicalTransaction(BaseModel):
    """Canonical transaction structure"""
    reference: str
    end_to_end_id: Optional[str] = None
    instruction_id: Optional[str] = None
    transaction_id: Optional[str] = None
    related_reference: Optional[str] = None
    type: Optional[str] = None
    service_level: Optional[str] = None
    local_instrument: Optional[str] = None
    category_purpose: Optional[str] = None


class CanonicalAmounts(BaseModel):
    """Canonical amounts structure"""
    instructed: CanonicalAmount
    settlement: Optional[CanonicalAmount] = None
    interbank: Optional[CanonicalAmount] = None
    charges: Optional[List[Dict[str, Any]]] = None


class CanonicalDates(BaseModel):
    """Canonical dates structure"""
    value_date: str = Field(..., pattern=r'^\d{4}-\d{2}-\d{2}$')
    execution_date: Optional[str] = None
    requested_execution_date: Optional[str] = None
    acceptance_datetime: Optional[str] = None


class CanonicalProcessingMetadata(BaseModel):
    """Canonical processing metadata"""
    conversion_timestamp: str
    source_format: str
    target_format: str
    version: Optional[str] = None
    processing_lanes: Optional[Dict[str, int]] = None


class CanonicalJSON(BaseModel):
    """STRICT Canonical JSON structure for all X_to_JSON conversions"""
    header: CanonicalHeader
    transaction: CanonicalTransaction
    parties: Optional[Dict[str, Any]] = None
    amounts: CanonicalAmounts
    dates: CanonicalDates
    remittance: Optional[Dict[str, Any]] = None
    instructions: Optional[Dict[str, Any]] = None
    references: Optional[Dict[str, Any]] = None
    charges: Optional[Dict[str, Any]] = None
    regulatory: Optional[Dict[str, Any]] = None
    original_fields: Optional[Dict[str, Any]] = None
    processing_metadata: CanonicalProcessingMetadata
    
    model_config = {"extra": "forbid"}  # STRICT: No extra fields allowed


# ============= SCHEMA ENFORCER SERVICE =============

class SchemaEnforcer:
    """
    CRITICAL: Use this service for ALL MongoDB operations.
    It validates data BEFORE insertion to prevent schema violations.
    """
    
    @staticmethod
    def validate_conversion_registry(data: Dict[str, Any]) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
        """
        Validate conversion registry data before insertion
        
        Returns:
            Tuple of (is_valid, error_message, cleaned_data)
        """
        try:
            # Ensure _id field exists
            if "_id" not in data and "id" in data:
                data["_id"] = data.pop("id")
            
            # Validate using Pydantic model
            config = ConversionRegistryConfig(**data)
            
            # Convert back to dict for MongoDB
            cleaned_data = config.model_dump(by_alias=True, exclude_none=False)
            
            return True, None, cleaned_data
            
        except ValidationError as e:
            error_msg = f"Validation failed:\n"
            for error in e.errors():
                field = " -> ".join(str(x) for x in error['loc'])
                error_msg += f"  - {field}: {error['msg']}\n"
            
            return False, error_msg, None
        except Exception as e:
            return False, f"Unexpected error: {str(e)}", None
    
    @staticmethod
    def validate_semantic_pattern(data: Dict[str, Any]) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
        """Validate semantic pattern data before insertion"""
        try:
            # Ensure _id field exists
            if "_id" not in data and "id" in data:
                data["_id"] = data.pop("id")
            
            config = SemanticPatternConfig(**data)
            cleaned_data = config.model_dump(by_alias=True, exclude_none=False)
            
            return True, None, cleaned_data
            
        except ValidationError as e:
            error_msg = f"Validation failed:\n"
            for error in e.errors():
                field = " -> ".join(str(x) for x in error['loc'])
                error_msg += f"  - {field}: {error['msg']}\n"
            
            return False, error_msg, None
        except Exception as e:
            return False, f"Unexpected error: {str(e)}", None
    
    @staticmethod
    def validate_conversion_graph_edge(data: Dict[str, Any]) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
        """Validate conversion graph edge before insertion"""
        try:
            config = ConversionGraphEdge(**data)
            cleaned_data = config.model_dump(exclude_none=False)
            
            return True, None, cleaned_data
            
        except ValidationError as e:
            error_msg = f"Validation failed:\n"
            for error in e.errors():
                field = " -> ".join(str(x) for x in error['loc'])
                error_msg += f"  - {field}: {error['msg']}\n"
            
            return False, error_msg, None
        except Exception as e:
            return False, f"Unexpected error: {str(e)}", None
    
    @staticmethod
    def validate_conversion_path(data: Dict[str, Any]) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
        """Validate conversion path before insertion"""
        try:
            config = ConversionPath(**data)
            cleaned_data = config.model_dump(by_alias=True, exclude_none=False)
            
            return True, None, cleaned_data
            
        except ValidationError as e:
            error_msg = f"Validation failed:\n"
            for error in e.errors():
                field = " -> ".join(str(x) for x in error['loc'])
                error_msg += f"  - {field}: {error['msg']}\n"
            
            return False, error_msg, None
        except Exception as e:
            return False, f"Unexpected error: {str(e)}", None
    
    @staticmethod
    def validate_canonical_json(data: Dict[str, Any]) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
        """Validate canonical JSON structure"""
        try:
            config = CanonicalJSON(**data)
            cleaned_data = config.model_dump(exclude_none=False)
            
            return True, None, cleaned_data
            
        except ValidationError as e:
            error_msg = f"Validation failed:\n"
            for error in e.errors():
                field = " -> ".join(str(x) for x in error['loc'])
                error_msg += f"  - {field}: {error['msg']}\n"
            
            return False, error_msg, None
        except Exception as e:
            return False, f"Unexpected error: {str(e)}", None
    
    @staticmethod
    def validate_before_insert(collection_name: str, data: Dict[str, Any]) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
        """
        Main validation method - validates data based on collection name
        
        Args:
            collection_name: MongoDB collection name
            data: Data to validate
            
        Returns:
            Tuple of (is_valid, error_message, cleaned_data)
        """
        validators = {
            "conversion_registry": SchemaEnforcer.validate_conversion_registry,
            "semantic_patterns": SchemaEnforcer.validate_semantic_pattern,
            "conversion_graph": SchemaEnforcer.validate_conversion_graph_edge,
            "conversion_paths": SchemaEnforcer.validate_conversion_path,
            "canonical_json": SchemaEnforcer.validate_canonical_json,
        }
        
        validator = validators.get(collection_name)
        if not validator:
            logger.warning(f"No validator for collection: {collection_name}")
            return True, None, data  # Pass through if no validator
        
        return validator(data)


# ============= SAFE MONGODB SERVICE =============

class SafeMongoDBService:
    """
    MongoDB service wrapper that enforces schema validation
    Use this instead of direct MongoDB operations
    """
    
    def __init__(self, db_service):
        """
        Initialize with existing MongoDB service
        
        Args:
            db_service: Existing MongoDBService instance
        """
        self.db_service = db_service
        self.db = db_service.db
        self.enforcer = SchemaEnforcer()
    
    def insert_one(self, collection_name: str, document: Dict[str, Any], skip_validation: bool = False) -> Any:
        """
        Insert a document with schema validation
        
        Args:
            collection_name: Collection name
            document: Document to insert
            skip_validation: Skip validation (use with caution!)
            
        Returns:
            Inserted document ID or raises exception
        """
        if not skip_validation:
            is_valid, error_msg, cleaned_data = self.enforcer.validate_before_insert(
                collection_name, document
            )
            
            if not is_valid:
                raise ValueError(f"Schema validation failed for {collection_name}:\n{error_msg}")
            
            document = cleaned_data
        
        collection = self.db[collection_name]
        result = collection.insert_one(document)
        logger.info(f"✅ Inserted document into {collection_name}: {result.inserted_id}")
        return result.inserted_id
    
    def replace_one(self, collection_name: str, filter_dict: Dict[str, Any], 
                   document: Dict[str, Any], upsert: bool = False, skip_validation: bool = False) -> Any:
        """
        Replace a document with schema validation
        
        Args:
            collection_name: Collection name
            filter_dict: Filter to find document
            document: Replacement document
            upsert: Insert if not exists
            skip_validation: Skip validation (use with caution!)
            
        Returns:
            Result object or raises exception
        """
        if not skip_validation:
            is_valid, error_msg, cleaned_data = self.enforcer.validate_before_insert(
                collection_name, document
            )
            
            if not is_valid:
                raise ValueError(f"Schema validation failed for {collection_name}:\n{error_msg}")
            
            document = cleaned_data
        
        collection = self.db[collection_name]
        result = collection.replace_one(filter_dict, document, upsert=upsert)
        
        if result.upserted_id:
            logger.info(f"✅ Upserted document into {collection_name}: {result.upserted_id}")
        elif result.modified_count > 0:
            logger.info(f"✅ Replaced document in {collection_name}")
        else:
            logger.warning(f"⚠️ No document modified in {collection_name}")
            
        return result
    
    def validate_only(self, collection_name: str, document: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """
        Validate a document without inserting
        
        Args:
            collection_name: Collection name
            document: Document to validate
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        is_valid, error_msg, _ = self.enforcer.validate_before_insert(collection_name, document)
        return is_valid, error_msg


# ============= USAGE EXAMPLE =============

def example_usage():
    """Example of how to use the schema enforcer"""
    from services.db_service import MongoDBService
    from config.settings import get_settings
    
    # Initialize services
    settings = get_settings()
    db_service = MongoDBService(settings.mongodb_uri, settings.database_name)
    safe_db = SafeMongoDBService(db_service)
    
    # Example: Insert a conversion config
    config = {
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
    
    # Validate before insert
    is_valid, error_msg = safe_db.validate_only("conversion_registry", config)
    if is_valid:
        print("✅ Configuration is valid!")
        # Now insert
        safe_db.replace_one(
            "conversion_registry",
            {"_id": config["_id"]},
            config,
            upsert=True
        )
    else:
        print(f"❌ Validation failed:\n{error_msg}")


if __name__ == "__main__":
    # Run example
    example_usage()