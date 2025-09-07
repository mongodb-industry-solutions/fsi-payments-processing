from abc import ABC, abstractmethod
from typing import Dict, Any, List
from datetime import datetime, UTC
from db.mdb import MongoDBConnector


class BaseBuilder(ABC):
    """Base builder for all payment formats - MongoDB integrated"""
    
    def __init__(self, db_connector: MongoDBConnector):
        self.db = db_connector
        self.target_format_config = self._load_target_format()
        self.field_mappings = self._load_field_mappings()
    
    def _load_target_format(self) -> Dict:
        """Load target format configuration from MongoDB"""
        configs = self.db.find("target_formats", {"format_code": self.format_type})
        return configs[0] if configs else {}
    
    def _load_field_mappings(self) -> Dict:
        """Load field mapping rules from MongoDB"""
        rules = self.db.find("conversion_rules", {
            "target_format": self.format_type,
            "is_active": True
        })
        if rules:
            # Create mapping dictionary for quick lookup
            mappings = {}
            for rule in rules[0].get("rules", []):
                if rule.get("target_field"):
                    mappings[rule["target_field"]] = {
                        "source_field": rule.get("source_field"),
                        "transformation": rule.get("transformation", "direct_copy")
                    }
            return mappings
        return {}
    
    @abstractmethod
    def build(self, converted_fields: Dict[str, Any], metadata: Dict[str, Any]) -> str:
        """Build target format message from converted fields"""
        pass
    
    def build_with_metadata(self, converted_fields: Dict[str, Any], processing_metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Build message with full processing metadata for MongoDB demo"""
        
        # Build the actual message
        message_output = self.build(converted_fields, processing_metadata)
        
        # Track which fields came from which processing lane
        field_sources = {}
        for field, value in converted_fields.items():
            if field in processing_metadata.get("ai_processed_fields", []):
                field_sources[field] = {
                    "lane": "AI",
                    "confidence": processing_metadata.get("field_confidence", {}).get(field, 0.7)
                }
            elif field in processing_metadata.get("regex_processed_fields", []):
                field_sources[field] = {
                    "lane": "REGEX",
                    "confidence": 1.0
                }
            else:
                field_sources[field] = {
                    "lane": "RULES",
                    "confidence": 1.0
                }
        
        # Calculate overall confidence
        confidences = [fs["confidence"] for fs in field_sources.values()]
        overall_confidence = sum(confidences) / len(confidences) if confidences else 0.0
        
        # Prepare result with full metadata
        result = {
            "format_type": self.format_type,
            "message_output": message_output,
            "field_count": len(converted_fields),
            "field_sources": field_sources,
            "overall_confidence": overall_confidence,
            "processing_metadata": processing_metadata,
            "timestamp": datetime.now(UTC),
            "mongodb_collections_used": [
                "target_formats",
                "conversion_rules"
            ]
        }
        
        
        return result
    
    def validate_output(self, message_output: str) -> Dict[str, Any]:
        """Validate the built message against format requirements"""
        validation_result = {
            "is_valid": True,
            "warnings": [],
            "errors": []
        }
        
        # Basic validation - can be overridden by specific builders
        if not message_output or len(message_output) < 10:
            validation_result["is_valid"] = False
            validation_result["errors"].append("Output message too short")
        
        return validation_result
    
    @property
    @abstractmethod
    def format_type(self) -> str:
        """Return the format type this builder creates"""
        pass