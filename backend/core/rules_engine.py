from typing import Dict, List, Any, Optional
from datetime import datetime, UTC
import logging
from db.mdb import MongoDBConnector

# Configure logging
logger = logging.getLogger(__name__)


class RulesEngine:
    """Generic rules engine for any payment format conversion
    
    Demo Implementation: MT103 → pacs.008 rules are pre-loaded in MongoDB.
    Production: Would support dynamic rule creation via UI.
    """
    
    def __init__(self, db_connector: MongoDBConnector, source_format: str, target_format: str):
        self.db = db_connector
        self.source_format = source_format  # Demo: "MT103"
        self.target_format = target_format  # Demo: "pacs.008"
        self.rules = self._load_rules()
    
    def _load_rules(self) -> List[Dict]:
        """Load conversion rules from MongoDB for specific format pair"""
        rules_doc = self.db.find("conversion_rules", {
            "source_format": self.source_format,
            "target_format": self.target_format,
            "is_active": True
        })
        return rules_doc[0]["rules"] if rules_doc else []
    
    def apply_rules(self, parsed_fields: Dict[str, Any]) -> Dict[str, Any]:
        """Apply direct mapping rules to parsed fields"""
        
        mapped_fields = {}
        processing_details = []
        rules_applied_count = 0
        
        for rule in self.rules:
            source_field = rule.get("source_field")
            
            # Check if field exists in parsed data
            field_value = self._get_field_value(parsed_fields, source_field)
            if field_value is None:
                continue
            
            # Apply transformation
            transformed = self._apply_transformation(
                field_value, 
                rule.get("transformation", "direct_copy"), 
                rule
            )
            
            # Map to target field(s)
            target_field = rule.get("target_field")
            if target_field:
                mapped_fields[target_field] = transformed
                rules_applied_count += 1
                
                processing_details.append({
                    "source_field": source_field,
                    "target_field": target_field,
                    "transformation": rule.get("transformation"),
                    "value": transformed,
                    "processing_lane": "RULES",  # Use consistent naming
                    "confidence": 1.0  # Rules have perfect confidence
                })
        
        # Store rules processing in MongoDB for demo
        # NOTE: Commented out for performance optimization in demo
        # Can be re-enabled for detailed audit logging if needed
        # if rules_applied_count > 0:
        #     rules_record = {
        #         "operation": "rules_processing",
        #         "source_format": self.source_format,
        #         "target_format": self.target_format,
        #         "fields_processed": rules_applied_count,
        #         "timestamp": datetime.now(UTC)
        #     }
        #     self.db.insert_one("rules_operations", rules_record)
        
        return {
            "mapped_fields": mapped_fields,
            "processing_details": processing_details,
            "rules_applied": rules_applied_count,
            "mongodb_collections_used": ["conversion_rules"]
        }
    
    def _get_field_value(self, fields: Dict, field_key: str) -> Optional[Any]:
        """Get field value, handling nested structures"""
        # Handle simple field lookup
        if field_key in fields:
            return fields[field_key]
        
        # Handle structured fields like 32A components
        if "32A" in field_key and "32A" in fields:
            if isinstance(fields["32A"], dict):
                if "currency" in field_key.lower():
                    return fields["32A"].get("currency")
                elif "amount" in field_key.lower():
                    return fields["32A"].get("amount")
                elif "date" in field_key.lower():
                    return fields["32A"].get("value_date")
        
        return None
    
    def _apply_transformation(self, value: Any, transform_type: str, rule: Dict) -> Any:
        """Apply transformation to field value"""
        
        if transform_type == "direct_copy":
            return value
        
        elif transform_type == "map_value":
            # Map specific values (e.g., SHA -> SHAR for charges)
            mapping = rule.get("mapping", {})
            return mapping.get(str(value), value)
        
        elif transform_type == "parse_amount":
            # Convert amount format
            if isinstance(value, str):
                return value.replace(",", ".")
            return value
        
        elif transform_type == "convert_date_format":
            # Convert YYMMDD to YYYY-MM-DD
            if isinstance(value, str) and len(value) == 6:
                yy, mm, dd = value[:2], value[2:4], value[4:6]
                year = f"20{yy}" if int(yy) <= 50 else f"19{yy}"
                return f"{year}-{mm}-{dd}"
            return value
        
        elif transform_type == "extract_reference":
            # Extract reference number, remove non-alphanumeric
            if isinstance(value, str):
                import re
                return re.sub(r'[^A-Za-z0-9]', '', value)
            return value
        
        elif transform_type == "fixed_value":
            # Return a fixed value from the rule
            return rule.get("value", "")
        
        elif transform_type == "concatenate":
            # Concatenate with other fields or fixed values
            prefix = rule.get("prefix", "")
            suffix = rule.get("suffix", "")
            return f"{prefix}{value}{suffix}"
        
        return value
    
    def get_rules_summary(self) -> Dict[str, Any]:
        """Get summary of loaded rules for debugging/demo"""
        rules_by_type = {}
        for rule in self.rules:
            transform = rule.get("transformation", "direct_copy")
            if transform not in rules_by_type:
                rules_by_type[transform] = []
            rules_by_type[transform].append({
                "source": rule.get("source_field"),
                "target": rule.get("target_field")
            })
        
        return {
            "source_format": self.source_format,
            "target_format": self.target_format,
            "total_rules": len(self.rules),
            "ai_fields": list(self.field_routing.get("ai_fields", [])),
            "rules_by_transformation": rules_by_type
        }
    
    def validate_rules(self, parsed_fields: Dict[str, Any]) -> Dict[str, Any]:
        """Validate which rules can be applied to given fields"""
        applicable_rules = []
        missing_source_fields = []
        
        for rule in self.rules:
            source_field = rule.get("source_field")
            
            # Skip AI fields
            if source_field in self.field_routing["ai_fields"]:
                continue
            
            field_value = self._get_field_value(parsed_fields, source_field)
            if field_value is not None:
                applicable_rules.append({
                    "source": source_field,
                    "target": rule.get("target_field"),
                    "transformation": rule.get("transformation")
                })
            else:
                missing_source_fields.append(source_field)
        
        return {
            "applicable_rules": applicable_rules,
            "missing_fields": missing_source_fields,
            "coverage": len(applicable_rules) / len(self.rules) if self.rules else 0
        }