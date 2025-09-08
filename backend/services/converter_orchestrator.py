"""
Simplified Converter Orchestrator for Payment Format Conversion

This module orchestrates the complete conversion process using:
- Parser: Extract fields from source format
- Rules Engine: Apply direct mapping rules
- AI Processor: Handle complex/unstructured fields
- Builder: Construct target format message

Designed for MongoDB technical demo showcasing innovative approaches.
"""

from typing import Dict, Any, Tuple, Optional, List
from datetime import datetime, UTC
import json
# Removed ThreadPoolExecutor and as_completed - using batch processing instead
import logging

from db.mdb import MongoDBConnector
from core.rules_engine import RulesEngine
from services.ai_field_processor import AIFieldProcessor
from utils.parsers.base_parser import BaseParser
from utils.builders.base_builder import BaseBuilder

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class ConverterOrchestrator:
    """
    Orchestrates the complete payment conversion pipeline.
    
    Integrates parser, rules engine, AI processor, and builder into
    a cohesive 3-lane processing system (Rules → AI → Human).
    
    Example:
        orchestrator = ConverterOrchestrator(db, "MT103", "pacs.008")
        result = orchestrator.convert(raw_mt103_message)
    """
    
    def __init__(self, db_connector: MongoDBConnector, source_format: str, target_format: str):
        """
        Initialize orchestrator for a specific format conversion.
        
        Args:
            db_connector: MongoDB connection instance
            source_format: Source format code (e.g., "MT103")
            target_format: Target format code (e.g., "pacs.008")
        """
        self.db = db_connector
        self.source_format = source_format
        self.target_format = target_format
        
        # Initialize components
        self.rules_engine = RulesEngine(db_connector, source_format, target_format)
        self.ai_processor = AIFieldProcessor(db_connector, source_format, target_format)
        
        # Track conversion statistics
        self.conversion_id = None
        self.processing_stats = {
            "rules_lane": {"count": 0, "fields": []},
            "ai_lane": {"count": 0, "fields": []},
            "human_lane": {"count": 0, "fields": []},
            "total_fields": 0,
            "start_time": None,
            "end_time": None
        }
        # Track field mappings: source_field -> {target_field, value, lane, confidence}
        self.field_mappings = {}
    
    def set_parser(self, parser: BaseParser):
        """Set the parser for source format."""
        self.parser = parser
    
    def set_builder(self, builder: BaseBuilder):
        """Set the builder for target format."""
        self.builder = builder
    
    def convert(self, raw_message: str, trace_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Convert a payment message from source to target format.
        
        This is the main entry point that orchestrates the entire conversion:
        1. Parse source message into fields
        2. Apply rules-based mappings
        3. Process complex fields with AI
        4. Build target format message
        5. Track everything in MongoDB
        
        Args:
            raw_message: Raw source format message
            trace_id: Optional trace ID for tracking
            
        Returns:
            Dictionary containing:
            - converted_message: Target format message
            - processing_metadata: Details about conversion
            - conversion_id: MongoDB document ID
            - statistics: Processing statistics
        """
        
        # Start tracking
        self.processing_stats["start_time"] = datetime.now(UTC)
        self.conversion_id = self._create_conversion_record(raw_message, trace_id)
        
        try:
            # Step 1: Parse source message
            logger.info(f"🚀 Starting conversion: {self.source_format} → {self.target_format}")
            logger.info(f"📋 Conversion ID: {self.conversion_id}")
            
            parsed_data = self.parser.parse_with_metadata(raw_message)
            parsed_fields = parsed_data.get("parsed_fields", {})
            self.processing_stats["total_fields"] = len(parsed_fields)
            
            logger.info(f"📝 Parsed {len(parsed_fields)} fields from {self.source_format}")
            
            # Step 2: Apply rules-based conversion
            logger.info("⚙️ Applying Rules Engine...")
            rules_output = self.rules_engine.apply_rules(parsed_fields)
            converted_fields = rules_output.get("mapped_fields", {})
            rules_applied = rules_output.get("processing_details", [])
            
            # Track rules lane fields and mappings
            for rule in rules_applied:
                self.processing_stats["rules_lane"]["count"] += 1
                self.processing_stats["rules_lane"]["fields"].append(rule.get("target_field"))
                # Store field mapping
                source_field = rule.get("source_field")
                if source_field:
                    # Create a unique mapping key for display purposes
                    mapping_key = f"{source_field}_{rule.get('target_field')}"
                    self.field_mappings[mapping_key] = {
                        "source_field": source_field,  # Include source field in mapping
                        "target_field": rule.get("target_field"),
                        "value": rule.get("value"),
                        "processing_lane": rule.get("processing_lane", "RULES"),
                        "confidence": rule.get("confidence", 1.0)
                    }
            
            logger.info(f"✅ Rules engine processed {self.processing_stats['rules_lane']['count']} fields")
            
            # Step 3: Process remaining fields with AI
            logger.info("🤖 Processing AI fields...")
            ai_enhanced_fields = self._process_with_ai(parsed_fields, converted_fields)
            
            # Transform AI fields into flat structure for builder
            self._transform_ai_fields(ai_enhanced_fields, converted_fields)
            
            # Also keep original AI fields for tracking (but not for building)
            for field_id, field_data in ai_enhanced_fields.items():
                if field_id not in converted_fields:
                    # Store original AI field with metadata for audit
                    converted_fields[f"_ai_{field_id}"] = field_data
            
            logger.info(f"✅ AI processor handled {self.processing_stats['ai_lane']['count']} fields")
            
            # Step 4: Identify fields needing human review
            human_review_fields = self._identify_human_review(converted_fields, parsed_fields)
            self.processing_stats["human_lane"]["count"] = len(human_review_fields)
            self.processing_stats["human_lane"]["fields"] = human_review_fields
            
            if human_review_fields:
                logger.warning(f"⚠️ {len(human_review_fields)} fields flagged for human review: {', '.join(human_review_fields)}")
            
            # Step 5: Build target format message
            logger.info(f"🏗️ Building {self.target_format} message...")
            logger.info(f"   Fields being sent to builder: {list(converted_fields.keys())}")
            if self.source_format == "MT202":
                # Debug what we're sending to the builder
                for key, value in converted_fields.items():
                    if key in ["InstructingAgent", "OrderingInstitution", "IntermediaryAgent1", 
                              "IntermediaryInstitution", "CreditorAgentBIC", "AccountWithInstitution",
                              "BeneficiaryInstitution", "Creditor", "CreditorAccount"]:
                        logger.info(f"     {key}: {value}")
            build_metadata = {
                "conversion_id": str(self.conversion_id),
                "source_format": self.source_format,
                "rules_applied": len(rules_applied),
                "ai_fields": self.processing_stats["ai_lane"]["count"],
                "human_review": self.processing_stats["human_lane"]["count"]
            }
            
            output_data = self.builder.build_with_metadata(converted_fields, build_metadata)
            # Handle both "message" and "message_output" keys for compatibility
            target_message = output_data.get("message_output") or output_data.get("message", "")
            
            logger.info(f"✅ Successfully built {self.target_format} message")
            
            # Step 6: Update conversion record with results
            self.processing_stats["end_time"] = datetime.now(UTC)
            processing_time = (self.processing_stats["end_time"] - self.processing_stats["start_time"]).total_seconds()
            
            self._update_conversion_record(
                parsed_fields=parsed_fields,  # Store original parsed fields
                converted_fields=converted_fields,
                field_mappings=self.field_mappings,  # Store field mappings for traceability
                target_message=target_message,
                processing_stats=self.processing_stats,
                success=True
            )
            
            logger.info(f"✅ Conversion complete! Time: {processing_time:.2f}s")
            logger.info(f"📊 Processing Distribution:")
            logger.info(f"  • Rules Lane: {self.processing_stats['rules_lane']['count']} fields")
            logger.info(f"  • AI Lane: {self.processing_stats['ai_lane']['count']} fields")
            logger.info(f"  • Human Lane: {self.processing_stats['human_lane']['count']} fields")
            
            return {
                "success": True,
                "conversion_id": str(self.conversion_id),
                "converted_message": target_message,
                "processing_metadata": {
                    "source_format": self.source_format,
                    "target_format": self.target_format,
                    "processing_time": processing_time,
                    "lanes_used": self._get_lanes_summary()
                },
                "statistics": self.processing_stats,
                "human_review_required": len(human_review_fields) > 0,
                "human_review_fields": human_review_fields
            }
            
        except Exception as e:
            # Log error and update record
            self.processing_stats["end_time"] = datetime.now(UTC)
            processing_time = (self.processing_stats["end_time"] - self.processing_stats["start_time"]).total_seconds()
            
            self._update_conversion_record(
                error=str(e),
                success=False
            )
            
            logger.error(f"❌ Conversion failed: {str(e)}")
            
            return {
                "success": False,
                "conversion_id": str(self.conversion_id),
                "error": str(e),
                "processing_metadata": {
                    "source_format": self.source_format,
                    "target_format": self.target_format,
                    "processing_time": processing_time,
                    "lanes_used": self._get_lanes_summary()
                },
                "statistics": self.processing_stats
            }
    
    def _process_with_ai(self, parsed_fields: Dict, converted_fields: Dict) -> Dict[str, Any]:
        """
        Process fields that need AI enhancement using BATCH processing.
        Groups fields by model type to minimize AI calls.
        
        Args:
            parsed_fields: Original parsed fields
            converted_fields: Fields already converted by rules
            
        Returns:
            Dictionary of AI-processed fields
        """
        fields_to_process = []
        
        # Check field_transformations configuration to determine which fields need AI
        ai_required_fields = set()
        configs = self.db.find("conversion_configs", {
            "source_format": self.source_format,
            "target_format": self.target_format,
            "is_active": True
        })
        
        if configs and "field_transformations" in configs[0]:
            for field_config in configs[0]["field_transformations"]:
                if field_config.get("source_type") == "ai":
                    ai_required_fields.add(field_config["source_field"])
                    logger.debug(f"  Field {field_config['source_field']}: marked for AI processing in config")
        
        # Identify fields that need AI processing
        for field_id, field_content in parsed_fields.items():
            # Check if field is explicitly marked for AI in configuration
            if field_id in ai_required_fields:
                logger.debug(f"  Field {field_id}: sending to AI (marked in config)")
                fields_to_process.append((field_id, field_content))
                continue
                
            # Skip if already handled by rules
            if field_id in converted_fields:
                logger.debug(f"  Field {field_id}: already handled by rules, skipping AI")
                continue
            
            # Skip structured dict fields - they should be handled by rules via flattening
            if isinstance(field_content, dict):
                logger.debug(f"  Field {field_id}: is structured dict, should be handled by rules")
                continue
            
            # Skip "_option" fields unless explicitly configured for AI
            # These are metadata fields that don't need AI processing
            if field_id.endswith("_option") and field_id not in ai_required_fields:
                logger.debug(f"  Field {field_id}: is option metadata, skipping AI")
                continue
            
            # Skip "block" fields unless explicitly configured for AI
            # These are SWIFT header blocks that rarely need AI processing
            if field_id.startswith("block") and field_id not in ai_required_fields:
                logger.debug(f"  Field {field_id}: is SWIFT block header, skipping AI")
                continue
                
            # All unmapped non-dict fields go to AI for processing
            logger.debug(f"  Field {field_id}: no rule found, sending to AI")
            fields_to_process.append((field_id, field_content))
        
        if not fields_to_process:
            return {}
        
        logger.debug(f"  Processing {len(fields_to_process)} fields with AI using batch calls...")
        
        # Pre-initialize Bedrock clients
        self.ai_processor.pre_initialize_clients()
        
        # Use batch processing - this will group by model and make only 2 AI calls
        ai_fields = self.ai_processor.process_fields_batch(fields_to_process)
        
        # Log results
        for field_id in ai_fields:
            result = ai_fields[field_id]
            logger.debug(f"    ✓ Field {field_id} processed via {result.get('model_used', 'AI')} (confidence: {result.get('confidence', 0):.2f})")
        
        return ai_fields
    
    def _transform_ai_fields(self, ai_fields: Dict[str, Any], converted_fields: Dict[str, Any]) -> None:
        """
        Generic field transformation based on MongoDB configuration.
        Works for any source/target format pair.
        
        Args:
            ai_fields: Dictionary of AI-processed fields with complex structures
            converted_fields: Target dictionary to add flattened fields to
        """
        # Load transformation rules from MongoDB
        configs = list(self.db.find("conversion_configs", {
            "source_format": self.source_format,
            "target_format": self.target_format,
            "is_active": True
        }))
        
        config = configs[0] if configs else None
        
        if not config:
            logger.debug("No config found for MT202 to pacs.009")
            self._legacy_transform_ai_fields(ai_fields, converted_fields)
            return
            
        if "field_transformations" not in config:
            logger.debug("No field_transformations in config, using legacy transformation")
            self._legacy_transform_ai_fields(ai_fields, converted_fields)
            return
            
        # Check if field_transformations is a list or dict
        field_transformations = config.get("field_transformations", [])
        if not isinstance(field_transformations, list):
            logger.error(f"field_transformations is not a list! Type: {type(field_transformations)}")
            self._legacy_transform_ai_fields(ai_fields, converted_fields)
            return
            
        logger.debug(f"Found {len(field_transformations)} field transformations in config")
        
        # Process each field transformation rule
        for field_config in field_transformations:
            source_field = field_config["source_field"]
            source_type = field_config.get("source_type", "rules")
            
            # Only process AI-type fields here
            if source_type != "ai":
                continue
                
            # Skip if field not in AI results
            if source_field not in ai_fields:
                logger.debug(f"  Field {source_field} marked for AI but not in AI results")
                continue
                
            field_data = ai_fields[source_field]
            
            # Process each transformation for this field
            for transform in field_config.get("transformations", []):
                try:
                    # Extract value using path
                    source_path = transform.get("source_path", "")
                    target_field = transform.get("target_field", "")
                    logger.debug(f"    Processing transform for {source_field}: path={repr(source_path)}")
                    
                    # Debug logging for MT202 institution fields
                    if source_field in ["52", "56", "57", "58"]:
                        logger.info(f"  🔍 Processing {source_field} -> {target_field}:")
                        logger.info(f"    Source path: '{source_path}'")
                        logger.info(f"    Field data type: {type(field_data).__name__}")
                        if isinstance(field_data, dict):
                            logger.info(f"    Field data keys: {list(field_data.keys())}")
                            if "value" in field_data:
                                logger.info(f"    Value content: {field_data['value']}")
                    
                    # Backward-compatible extraction:
                    # - If path starts with "value.", extract from field_data directly (MT103 style)
                    # - Otherwise, extract from field_data["value"] (MT202 style)
                    if source_path.startswith("value."):
                        # MT103 style: paths like "value.name" expect the wrapper
                        value = self._extract_value_by_path(field_data, source_path)
                    else:
                        # MT202 style: paths like "field52.accountOwner" expect the inner value
                        # Also handles empty paths for fields 70, 72
                        if "value" in field_data:
                            value = self._extract_value_by_path(field_data["value"], source_path)
                        else:
                            # Fallback if no "value" wrapper
                            value = self._extract_value_by_path(field_data, source_path)
                    
                    # Debug what we extracted
                    if source_field in ["52", "56", "57", "58"]:
                        logger.info(f"    🔍 Processing {source_field}:")
                        logger.info(f"       Field data: {field_data}")
                        logger.info(f"       Source path: '{source_path}'")
                        logger.info(f"       Extracted value: '{value}'")
                        logger.info(f"       Target field: {target_field}")
                    
                    if value is None:
                        continue
                    
                    # Apply transformation based on type
                    transformed_value = self._apply_transformation(
                        value, 
                        transform.get("transform_type", "direct"),
                        transform
                    )
                    
                    if transformed_value is None or transformed_value == "":
                        continue
                    
                    # Store in converted_fields
                    converted_fields[target_field] = transformed_value
                    
                    # Track mapping for audit
                    self._track_field_mapping(
                        source_field,
                        target_field,
                        transformed_value,
                        field_data.get("confidence", 0.85),
                        field_data.get("model_used", "AI")
                    )
                    
                except Exception as e:
                    logger.warning(f"Transform failed for {source_field}: {e}")
                    continue
    
    def _extract_value_by_path(self, data: Any, path: str) -> Any:
        """
        Extract value from nested structure using dot notation.
        Examples: "value.name", "value.address.street"
        
        Args:
            data: The data structure to extract from
            path: Dot-notation path to the value
            
        Returns:
            The extracted value or None if not found
        """
        if not path:
            return data
        
        # Add type checking for path
        if not isinstance(path, str):
            logger.error(f"ERROR: path is not a string! Type: {type(path)}, Value: {path}")
            return None
            
        parts = path.split(".")
        current = data
        
        for part in parts:
            if isinstance(current, dict):
                current = current.get(part)
                if current is None:
                    return None
            else:
                return None
                
        return current
    
    def _apply_transformation(self, value: Any, transform_type: str, config: Dict) -> Any:
        """
        Apply transformation based on type.
        
        Args:
            value: The value to transform
            transform_type: Type of transformation to apply
            config: Transformation configuration
            
        Returns:
            Transformed value
        """
        if transform_type == "direct":
            return value
            
        elif transform_type == "address_format":
            # Format address from structured data
            if isinstance(value, dict):
                template = config.get("format_template", "{street}, {city}")
                # Safe formatting with missing keys
                format_dict = {
                    "street": value.get("street", ""),
                    "city": value.get("city", ""),
                    "state": value.get("state", ""),
                    "postal_code": value.get("postal_code", ""),
                    "country": value.get("country", "")
                }
                # Remove empty values
                format_dict = {k: v for k, v in format_dict.items() if v}
                
                # Build address string
                parts = []
                if format_dict.get("street"):
                    parts.append(str(format_dict["street"]))
                if format_dict.get("city"):
                    city_part = str(format_dict["city"])
                    if format_dict.get("state"):
                        city_part += f" {str(format_dict['state'])}"
                    if format_dict.get("postal_code"):
                        city_part += f" {str(format_dict['postal_code'])}"
                    parts.append(city_part)
                if format_dict.get("country"):
                    parts.append(str(format_dict["country"]))
                    
                return ", ".join(parts) if parts else ""
            return str(value) if value else ""
            
        elif transform_type == "remittance_format":
            # Handle remittance with field mapping
            if isinstance(value, dict):
                # Apply field mappings (e.g., invoice_number -> invoiceNumber)
                field_mappings = config.get("field_mappings", {})
                
                # Build remittance string from available fields
                parts = []
                
                # Check for payment purpose/description
                if value.get("payment_purpose"):
                    parts.append(value["payment_purpose"])
                elif value.get("description"):
                    parts.append(value["description"])
                
                # Check for invoice number
                if value.get("invoice_number"):
                    parts.append(value["invoice_number"])
                elif value.get("invoiceNumber"):
                    parts.append(value["invoiceNumber"])
                    
                # Add other relevant fields
                if value.get("purchase_order"):
                    parts.append(f"PO: {value['purchase_order']}")
                if value.get("contract_reference"):
                    parts.append(f"Contract: {value['contract_reference']}")
                    
                return " ".join(parts) if parts else str(value)
            return str(value) if value else ""
            
        elif transform_type == "json_to_string":
            # Convert JSON/dict to string representation
            if isinstance(value, dict):
                # Convert dict to key-value string
                parts = []
                for k, v in value.items():
                    if v:
                        parts.append(f"{k}: {v}")
                return " | ".join(parts) if parts else ""
            return str(value) if value else ""
            
        elif transform_type == "join_array":
            # Join array elements
            if isinstance(value, list):
                separator = config.get("separator", ", ")
                return separator.join(str(v) for v in value if v)
            return str(value) if value else ""
            
        else:
            # Unknown transformation - return as is
            return value
    
    def _track_field_mapping(self, source_field: str, target_field: str, 
                             value: Any, confidence: float, model_used: str):
        """
        Track field mapping for audit and statistics.
        
        Args:
            source_field: Source field identifier
            target_field: Target field name
            value: The transformed value
            confidence: AI confidence score
            model_used: Which model was used
        """
        mapping_key = f"{source_field}_{target_field}"
        self.field_mappings[mapping_key] = {
            "source_field": source_field,
            "target_field": target_field,
            "value": value,
            "processing_lane": "AI",
            "confidence": confidence,
            "model_used": model_used
        }
        
        # Update statistics
        if mapping_key not in self.processing_stats["ai_lane"]["fields"]:
            self.processing_stats["ai_lane"]["count"] += 1
            self.processing_stats["ai_lane"]["fields"].append(mapping_key)
    
    def _legacy_transform_ai_fields(self, ai_fields: Dict[str, Any], converted_fields: Dict[str, Any]) -> None:
        """
        Transform AI-extracted complex fields into flat fields expected by the builder.
        
        This method takes AI fields like 50K, 59, 70 which contain structured data
        and flattens them into individual fields like DebtorName, CreditorName, etc.
        
        Args:
            ai_fields: Dictionary of AI-processed fields with complex structures
            converted_fields: Target dictionary to add flattened fields to
        """
        # Transform field 50K (Ordering Customer/Debtor)
        if '50K' in ai_fields:
            debtor_data = ai_fields['50K']
            if isinstance(debtor_data, dict):
                # Extract the value from AI field structure
                if 'value' in debtor_data and isinstance(debtor_data['value'], dict):
                    debtor_info = debtor_data['value']
                    confidence = debtor_data.get('confidence', 0.85)
                    model_used = debtor_data.get('model_used')
                    
                    # Track DebtorName mapping
                    debtor_name = debtor_info.get('name', '')
                    converted_fields['DebtorName'] = debtor_name
                    self.field_mappings['50K_name'] = {
                        "source_field": "50K",
                        "target_field": "DebtorName",
                        "value": debtor_name,
                        "processing_lane": "AI",
                        "confidence": confidence,
                        "model_used": model_used
                    }
                    self.processing_stats["ai_lane"]["count"] += 1
                    self.processing_stats["ai_lane"]["fields"].append("50K_name")
                    
                    # Track DebtorAddress mapping
                    address_lines = debtor_info.get('addressLines', [])
                    if address_lines:
                        address = ', '.join(address_lines)
                        converted_fields['DebtorAddress'] = address
                        self.field_mappings['50K_address'] = {
                            "source_field": "50K",
                            "target_field": "DebtorAddress",
                            "value": address,
                            "processing_lane": "AI",
                            "confidence": confidence,
                            "model_used": model_used
                        }
                        self.processing_stats["ai_lane"]["count"] += 1
                        self.processing_stats["ai_lane"]["fields"].append("50K_address")
                    
                    # Track DebtorAccount mapping
                    account = debtor_info.get('accountNumber', '')
                    if account:
                        converted_fields['DebtorAccount'] = account
                        self.field_mappings['50K_account'] = {
                            "source_field": "50K",
                            "target_field": "DebtorAccount",
                            "value": account,
                            "processing_lane": "AI",
                            "confidence": confidence,
                            "model_used": model_used
                        }
                        self.processing_stats["ai_lane"]["count"] += 1
                        self.processing_stats["ai_lane"]["fields"].append("50K_account")
        
        # Transform field 59 (Beneficiary/Creditor)
        if '59' in ai_fields:
            creditor_data = ai_fields['59']
            if isinstance(creditor_data, dict):
                # Extract the value from AI field structure
                if 'value' in creditor_data and isinstance(creditor_data['value'], dict):
                    creditor_info = creditor_data['value']
                    confidence = creditor_data.get('confidence', 0.85)
                    model_used = creditor_data.get('model_used')
                    
                    # Track CreditorName mapping
                    creditor_name = creditor_info.get('name', '')
                    converted_fields['CreditorName'] = creditor_name
                    self.field_mappings['59_name'] = {
                        "source_field": "59",
                        "target_field": "CreditorName",
                        "value": creditor_name,
                        "processing_lane": "AI",
                        "confidence": confidence,
                        "model_used": model_used
                    }
                    self.processing_stats["ai_lane"]["count"] += 1
                    self.processing_stats["ai_lane"]["fields"].append("59_name")
                    
                    # Track CreditorAddress mapping
                    address_lines = creditor_info.get('addressLines', [])
                    city = creditor_info.get('city', '')
                    state = creditor_info.get('state', '')
                    postal = creditor_info.get('postalCode', '')
                    
                    full_address = ', '.join(address_lines)
                    if city and state and postal:
                        full_address += f', {city}, {state} {postal}'
                    
                    if full_address:
                        converted_fields['CreditorAddress'] = full_address
                        self.field_mappings['59_address'] = {
                            "source_field": "59",
                            "target_field": "CreditorAddress",
                            "value": full_address,
                            "processing_lane": "AI",
                            "confidence": confidence,
                            "model_used": model_used
                        }
                        self.processing_stats["ai_lane"]["count"] += 1
                        self.processing_stats["ai_lane"]["fields"].append("59_address")
                    
                    # Track CreditorAccount mapping
                    account = creditor_info.get('accountNumber', '')
                    if account:
                        converted_fields['CreditorAccount'] = account
                        self.field_mappings['59_account'] = {
                            "source_field": "59",
                            "target_field": "CreditorAccount",
                            "value": account,
                            "processing_lane": "AI",
                            "confidence": confidence,
                            "model_used": model_used
                        }
                        self.processing_stats["ai_lane"]["count"] += 1
                        self.processing_stats["ai_lane"]["fields"].append("59_account")
        
        # Transform field 70 (Remittance Information)
        if '70' in ai_fields:
            remittance_data = ai_fields['70']
            if isinstance(remittance_data, dict):
                # Extract the value from AI field structure
                if 'value' in remittance_data and isinstance(remittance_data['value'], dict):
                    remittance_info = remittance_data['value']
                    confidence = remittance_data.get('confidence', 0.85)
                    model_used = remittance_data.get('model_used')
                    
                    # Build remittance info string
                    parts = []
                    if remittance_info.get('description'):
                        parts.append(remittance_info['description'])
                    if remittance_info.get('invoiceNumber'):
                        parts.append(remittance_info['invoiceNumber'])
                    
                    remittance_text = ' '.join(parts)
                    if remittance_text:
                        converted_fields['RemittanceInfo'] = remittance_text
                        self.field_mappings['70'] = {
                            "source_field": "70",
                            "target_field": "RemittanceInfo",
                            "value": remittance_text,
                            "processing_lane": "AI",
                            "confidence": confidence,
                            "model_used": model_used
                        }
                        self.processing_stats["ai_lane"]["count"] += 1
                        self.processing_stats["ai_lane"]["fields"].append("70")
        
        # Transform field 72 (Sender to Receiver Information)
        if '72' in ai_fields:
            sender_info_data = ai_fields['72']
            if isinstance(sender_info_data, dict):
                # Extract the value from AI field structure
                if 'value' in sender_info_data:
                    sender_info = sender_info_data['value']
                    confidence = sender_info_data.get('confidence', 0.85)
                    model_used = sender_info_data.get('model_used')
                    
                    # Map to InstructionInformation or similar field
                    converted_fields['InstructionInformation'] = sender_info
                    self.field_mappings['72'] = {
                        "source_field": "72",
                        "target_field": "InstructionInformation",
                        "value": sender_info,
                        "processing_lane": "AI",
                        "confidence": confidence,
                        "model_used": model_used
                    }
                    self.processing_stats["ai_lane"]["count"] += 1
                    self.processing_stats["ai_lane"]["fields"].append("72")
    
    
    def _identify_human_review(self, converted_fields: Dict, original_fields: Dict) -> List[str]:
        """
        Identify fields that need human review.
        
        Criteria:
        - AI confidence below threshold (0.7)
        - Missing required fields
        - Fields that failed both rules and AI
        
        Args:
            converted_fields: All converted fields
            original_fields: Original parsed fields
            
        Returns:
            List of field IDs needing review
        """
        review_fields = []
        
        # Check for low confidence AI fields
        for field_id, field_data in converted_fields.items():
            # Skip internal AI tracking fields
            if field_id.startswith("_ai_"):
                continue
            if isinstance(field_data, dict):
                confidence = field_data.get("confidence", 1.0)
                if confidence < 0.7:
                    review_fields.append(field_id)
        
        # Check for unconverted fields
        for field_id in original_fields:
            # Skip if field is in converted_fields (processed by rules)
            if field_id in converted_fields:
                continue
            
            # Skip if field was processed by AI (stored with _ai_ prefix)
            if f"_ai_{field_id}" in converted_fields:
                continue
                
            # Skip structured fields if their subfields have been processed
            if isinstance(original_fields[field_id], dict):
                # Check if any subfield was processed via field_mappings
                has_processed_subfields = any(
                    mapping_key.startswith(f"{field_id}_")
                    for mapping_key in self.field_mappings
                )
                if has_processed_subfields:
                    continue  # Don't add parent structured field to human review
            
            # Also check if this field was processed as source field in any mapping
            # (handles cases where AI fields are transformed to different target names)
            field_was_processed = any(
                mapping_data.get("source_field") == field_id
                for mapping_data in self.field_mappings.values()
            )
            if field_was_processed:
                continue
            
            # Field wasn't processed by rules or AI
            review_fields.append(field_id)
        
        return review_fields
    
    def _create_conversion_record(self, raw_message: str, trace_id: Optional[str]) -> Any:
        """Create initial conversion record in MongoDB."""
        record = {
            "source_format": self.source_format,
            "target_format": self.target_format,
            "trace_id": trace_id,
            "raw_message": raw_message[:1000],  # Store first 1000 chars
            "status": "in_progress",
            "created_at": datetime.now(UTC),
            "processing_stats": {}
        }
        
        return self.db.insert_one("conversions", record)
    
    def _update_conversion_record(self, **kwargs):
        """Update conversion record with results."""
        update_data = {
            "status": "completed" if kwargs.get("success") else "failed",
            "updated_at": datetime.now(UTC)
        }
        
        # Add all provided fields
        for key, value in kwargs.items():
            if key != "success":
                update_data[key] = value
        
        self.db.update_one(
            "conversions",
            {"_id": self.conversion_id},
            {"$set": update_data}
        )
    
    def _get_lanes_summary(self) -> Dict[str, int]:
        """Get summary of processing lanes used."""
        return {
            "rules": self.processing_stats["rules_lane"]["count"],
            "ai": self.processing_stats["ai_lane"]["count"],
            "human": self.processing_stats["human_lane"]["count"]
        }
    
    def get_conversion_history(self, limit: int = 10) -> List[Dict]:
        """
        Get recent conversion history from MongoDB.
        
        Args:
            limit: Number of records to retrieve
            
        Returns:
            List of conversion records
        """
        return self.db.find(
            "conversions",
            {
                "source_format": self.source_format,
                "target_format": self.target_format
            },
            limit=limit,
            sort=[("created_at", -1)]
        )
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """
        Get performance metrics for this conversion type.
        
        Returns:
            Dictionary with metrics like success rate, avg time, lane distribution
        """
        # Aggregate metrics from MongoDB
        conversions = self.db.find(
            "conversions",
            {
                "source_format": self.source_format,
                "target_format": self.target_format,
                "status": {"$in": ["completed", "failed"]}
            }
        )
        
        if not conversions:
            return {
                "total_conversions": 0,
                "success_rate": 0.0,
                "average_time": 0.0,
                "lane_distribution": {}
            }
        
        # Calculate metrics
        total = len(conversions)
        successful = len([c for c in conversions if c["status"] == "completed"])
        
        # Calculate average processing time
        times = []
        lane_totals = {"rules": 0, "ai": 0, "human": 0}
        
        for conv in conversions:
            stats = conv.get("processing_stats", {})
            if stats.get("start_time") and stats.get("end_time"):
                duration = (stats["end_time"] - stats["start_time"]).total_seconds()
                times.append(duration)
            
            # Aggregate lane usage
            for lane in ["rules_lane", "ai_lane", "human_lane"]:
                if lane in stats:
                    lane_key = lane.replace("_lane", "")
                    lane_totals[lane_key] += stats[lane].get("count", 0)
        
        avg_time = sum(times) / len(times) if times else 0.0
        
        return {
            "total_conversions": total,
            "success_rate": (successful / total) * 100 if total > 0 else 0.0,
            "average_time": avg_time,
            "lane_distribution": lane_totals,
            "mongodb_collections": [
                "conversions",
                "conversion_rules", 
                "field_model_routing",
                "prompt_templates",
                "ai_processing_history"
            ]
        }