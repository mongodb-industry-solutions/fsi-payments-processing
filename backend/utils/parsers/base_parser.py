from abc import ABC, abstractmethod
from typing import Dict, List, Any
from datetime import datetime, UTC
from db.mdb import MongoDBConnector


class BaseParser(ABC):
    """Base parser for all payment formats - MongoDB integrated"""
    
    def __init__(self, db_connector: MongoDBConnector):
        self.db = db_connector
        self.format_config = self._load_format_config()
        self.field_routing = self._load_field_routing()
        self.conversion_rules = self._load_conversion_rules()
    
    def _load_format_config(self) -> Dict:
        """Load format configuration from MongoDB"""
        configs = self.db.find("source_formats", {"format_code": self.format_type})
        return configs[0] if configs else {}
    
    def _load_field_routing(self) -> Dict:
        """Load field routing strategy from MongoDB"""
        routing = self.db.find("field_model_routing", {"source_format": self.format_type})
        if routing:
            return {s["field"]: s for s in routing[0]["field_strategies"]}
        return {}
    
    def _load_conversion_rules(self) -> List[Dict]:
        """Load conversion rules from MongoDB"""
        rules = self.db.find("conversion_rules", {
            "source_format": self.format_type,
            "is_active": True
        })
        return rules[0]["rules"] if rules else []
    
    @abstractmethod
    def parse(self, raw_message: str) -> Dict[str, Any]:
        """Parse raw message into structured fields"""
        pass
    
    def parse_with_metadata(self, raw_message: str) -> Dict[str, Any]:
        """Parse message and add processing metadata for MongoDB demo"""
        
        # Parse the raw message
        parsed_fields = self.parse(raw_message)
        
        # Categorize fields by processing lane
        fields_by_lane = {
            "rules": [],
            "ai": [],
            "regex": []
        }
        
        # Determine processing lane for each field
        for field_num, field_value in parsed_fields.items():
            if field_num in self.field_routing:
                routing = self.field_routing[field_num]
                if routing["model"] == "REGEX_FIRST":
                    fields_by_lane["regex"].append(field_num)
                elif routing["model"] in ["claude-3-haiku", "claude-3-sonnet"]:
                    fields_by_lane["ai"].append({
                        "field": field_num,
                        "model": routing["model"],
                        "cost": routing["cost_per_call"]
                    })
            else:
                # Default to rules lane for unmapped fields
                fields_by_lane["rules"].append(field_num)
        
        # Calculate estimated cost for AI processing
        estimated_cost = sum(f["cost"] for f in fields_by_lane["ai"])
        
        # Prepare result with full metadata
        result = {
            "format_type": self.format_type,
            "parsed_fields": parsed_fields,
            "field_count": len(parsed_fields),
            "processing_lanes": fields_by_lane,
            "ai_cost_estimate": estimated_cost,
            "requires_ai_processing": len(fields_by_lane["ai"]) > 0,
            "timestamp": datetime.now(UTC),
            "mongodb_collections_used": [
                "source_formats",
                "field_model_routing", 
                "conversion_rules"
            ]
        }
        
        # Store parsing result in MongoDB for demo visibility
        parse_record = {
            "operation": "parse_with_routing",
            "format_type": self.format_type,
            "result": result,
            "timestamp": datetime.now(UTC)
        }
        self.db.insert_one("parsing_operations", parse_record)
        
        return result
    
    def get_confidence_scores(self, parsed_fields: Dict[str, Any]) -> Dict[str, float]:
        """Calculate confidence scores for each parsed field"""
        confidence_scores = {}
        
        for field_num, field_value in parsed_fields.items():
            if field_num in self.field_routing:
                routing = self.field_routing[field_num]
                # Rules and regex have perfect confidence
                if routing["model"] == "REGEX_FIRST":
                    confidence_scores[field_num] = 1.0
                else:
                    # AI fields have expected confidence from config
                    confidence_scores[field_num] = routing.get("expected_confidence", 0.85)
            else:
                # Default rules have perfect confidence
                confidence_scores[field_num] = 1.0
        
        return confidence_scores
    
    @property
    @abstractmethod
    def format_type(self) -> str:
        """Return the format type this parser handles"""
        pass