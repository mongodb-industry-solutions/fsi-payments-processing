"""
Semantic Learning Service - Learns patterns from existing conversions
and generates configurations for new formats
"""

import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
import json
import re

logger = logging.getLogger(__name__)


class SemanticLearningService:
    """Service for learning semantic patterns and auto-generating configurations"""
    
    def __init__(self, db_service, ai_service=None):
        """
        Initialize with database and AI services
        
        Args:
            db_service: MongoDB service instance
            ai_service: Bedrock AI service for LLM analysis (optional)
        """
        self.db = db_service
        self.ai = ai_service
        self.semantic_patterns = self.db.db['semantic_patterns']
        self.conversion_registry = self.db.db['conversion_registry']
        
    def learn_from_existing_configs(self) -> Dict[str, Any]:
        """
        Dynamically learn patterns from ANY existing configurations
        This is the main learning method that populates semantic_patterns
        
        Returns:
            Dictionary of learned patterns ready for MongoDB insertion
        """
        
        logger.info("Starting semantic pattern learning from existing configurations...")
        
        # Get ALL existing configurations
        configs = list(self.conversion_registry.find())
        
        if not configs:
            logger.warning("No configurations found in conversion_registry")
            return {}
        
        logger.info(f"Found {len(configs)} configurations to analyze")
        
        # Check for existing seed patterns
        existing_seeds = {}
        for seed in self.semantic_patterns.find({"is_seed": True}):
            existing_seeds[seed['_id']] = seed
        
        logger.info(f"Found {len(existing_seeds)} seed patterns to enhance")
        
        learned_patterns = {}
        
        for config in configs:
            config_id = config['_id']
            
            # Extract source and target formats
            parts = config_id.split('_to_')
            if len(parts) != 2:
                logger.warning(f"Skipping invalid config ID format: {config_id}")
                continue
                
            source_format = parts[0]
            target_format = parts[1]
            
            logger.info(f"Analyzing {config_id}...")
            
            # Get parser configuration for field details
            parser_fields = config.get('parser', {}).get('fields', {})
            
            # Analyze each mapping
            for mapping in config.get('mappings', []):
                source_field = mapping.get('source', '')
                if not source_field:
                    continue
                    
                base_field = source_field.split('.')[0]  # Get base field without components
                
                # Get parser configuration for this field
                parser_config = parser_fields.get(base_field, {})
                
                # Identify semantic concept
                concept_info = self._identify_semantic_concept(
                    mapping, parser_config, source_format, target_format
                )
                
                if concept_info:
                    concept_id = concept_info['concept_id']
                    
                    # Initialize pattern if new
                    if concept_id not in learned_patterns:
                        learned_patterns[concept_id] = self._create_pattern_document(
                            concept_id, concept_info
                        )
                    
                    # Check if this is a component mapping (e.g., 32A.value_date)
                    if '.' in source_field:
                        # Component-specific mapping
                        component_name = source_field.split('.')[1]
                        pattern_key = f"{source_format}.{component_name}"
                    else:
                        # Regular field mapping
                        pattern_key = source_format
                    
                    # Add this format's pattern with component awareness
                    learned_patterns[concept_id]['learned_patterns'][pattern_key] = {
                        'field': source_field,
                        'pattern': parser_config.get('pattern', ''),
                        'name': parser_config.get('name', ''),
                        'multiline': parser_config.get('multiline', False),
                        'components': parser_config.get('components'),
                        'targets': mapping.get('targets', []),
                        'target_format': target_format,
                        'transform': mapping.get('transform'),
                        'transform_config': mapping.get('transform_config'),
                        'processing_lane': mapping.get('processing_lane', 'RULES'),
                        'confidence': mapping.get('confidence', 1.0),
                        'field_type': mapping.get('field_type'),  # For AI fields
                        'confidence_threshold': mapping.get('confidence_threshold')
                    }
                    
                    # Track field variations for this concept
                    if 'field_variations' not in learned_patterns[concept_id]:
                        learned_patterns[concept_id]['field_variations'] = {}
                    learned_patterns[concept_id]['field_variations'][source_format] = base_field
                    
                    # Update metadata
                    self._update_pattern_metadata(
                        learned_patterns[concept_id], 
                        source_format, 
                        config_id, 
                        base_field,
                        mapping.get('targets', [])
                    )
                    
                    logger.debug(f"Learned: {source_field} → {concept_info['concept_name']}")
        
        return learned_patterns
    
    def analyze_new_format_with_llm(self, sample_message: str, similar_to: str) -> Dict[str, Any]:
        """
        Use LLM to analyze a new format and identify field mappings
        
        Args:
            sample_message: Sample message in the new format
            similar_to: Format this is similar to (e.g., "MT103")
            
        Returns:
            Dictionary of detected fields and their semantic mappings
        """
        
        # Get the similar format's configuration
        # If similar_to already contains '_to_', use it directly
        if '_to_' in similar_to:
            similar_configs = list(self.conversion_registry.find(
                {"_id": similar_to}
            ))
        else:
            # Otherwise look for configs starting with that format
            similar_configs = list(self.conversion_registry.find(
                {"_id": {"$regex": f"^{similar_to}_to_"}}
            ))
        
        if not similar_configs:
            raise ValueError(f"No configuration found for {similar_to}")
        
        similar_config = similar_configs[0]  # Use first matching config
        
        # First extract actual fields from the message
        actual_fields = self._extract_fields_from_message(sample_message)
        logger.info(f"Extracted {len(actual_fields)} fields from sample message")
        
        # Build prompt for LLM
        prompt = self._build_analysis_prompt(sample_message, similar_config, actual_fields)
        
        # Invoke LLM if available
        if self.ai:
            try:
                # Use extract_field_data with the prompt as field_value
                response = self.ai.extract_field_data(
                    field_value=prompt,
                    field_type="configuration_analysis",
                    prompt_template=None  # Will use default template
                )
                
                # Parse LLM response
                llm_result = self._parse_llm_response(response)
                
                # If we didn't get detected_fields, fall back to pattern-based analysis
                if not llm_result.get('detected_fields'):
                    logger.warning("LLM response missing detected_fields, using pattern-based analysis")
                    return self._pattern_based_analysis(sample_message, similar_config)
                
                # Merge with actual fields to ensure we don't miss any
                return self._merge_analysis_results(llm_result, actual_fields)
                
            except Exception as e:
                logger.error(f"LLM analysis failed: {e}")
                # Fall back to pattern-based analysis
                return self._pattern_based_analysis(sample_message, similar_config)
        else:
            # No AI service, use pattern-based analysis
            return self._pattern_based_analysis(sample_message, similar_config)
    
    def generate_config_for_new_format(
        self,
        source_format: str,
        target_format: str,
        sample_message: str,
        similar_to: str
    ) -> Dict[str, Any]:
        """
        Generate complete configuration for a new format
        
        Args:
            source_format: New source format (e.g., "MT192")
            target_format: Target format (e.g., "pacs.008")
            sample_message: Sample message in the new format
            similar_to: Existing format this is similar to
            
        Returns:
            Complete configuration ready for conversion_registry
        """
        
        logger.info(f"Generating configuration for {source_format} to {target_format}")
        
        # For JSON source format, skip LLM analysis and just copy the base config
        if source_format == 'JSON':
            logger.info("JSON source format detected - skipping LLM analysis")
            field_analysis = {"detected_fields": [], "format_family": "JSON", "overall_similarity": 1.0}
        else:
            # Analyze the new format
            field_analysis = self.analyze_new_format_with_llm(sample_message, similar_to)
        
        # Get base configuration to clone
        # First try the exact similar_to ID if it contains underscore (full config ID)
        if '_to_' in similar_to:
            base_config_id = similar_to
            logger.info(f"Looking for exact config ID: {base_config_id}")
            base_config = self.conversion_registry.find_one({"_id": base_config_id})
            if base_config:
                logger.info(f"Found config: {base_config_id}")
            else:
                logger.warning(f"Config not found: {base_config_id}")
        else:
            # Otherwise construct the config ID
            base_config_id = f"{similar_to}_to_{target_format}"
            logger.info(f"Looking for constructed config ID: {base_config_id}")
            base_config = self.conversion_registry.find_one({"_id": base_config_id})
        
        if not base_config:
            # Try to find any config with the target format
            logger.info(f"Searching for any config ending with _to_{target_format}")
            base_configs = list(self.conversion_registry.find(
                {"_id": {"$regex": f"_to_{target_format}$"}}
            ))
            logger.info(f"Found {len(base_configs)} configs with target format {target_format}")
            if base_configs:
                base_config = base_configs[0]
                base_config_id = base_config['_id']
                logger.info(f"Using config: {base_config_id}")
            else:
                # Log all available configs for debugging
                all_configs = list(self.conversion_registry.find({}, {"_id": 1}))
                logger.error(f"Available configs: {[c['_id'] for c in all_configs]}")
                raise ValueError(f"No configuration found for {similar_to}")
        
        # Generate new configuration
        new_config = {
            "_id": f"{source_format}_to_{target_format}",
            
            # For JSON source, use the parser from base config directly
            # For other formats, generate parser configuration
            "parser": base_config.get('parser') if source_format == 'JSON' else self._generate_parser_config(field_analysis, base_config),
            
            # Generate mappings based on semantic patterns (or copy from base for JSON)
            "mappings": base_config.get('mappings') if source_format == 'JSON' and not field_analysis.get('detected_fields') else self._generate_mappings(field_analysis, base_config, target_format),
            
            # Clone builder configuration
            "builder": base_config.get('builder'),
            
            # Clone AI service configuration
            "ai_service": base_config.get('ai_service'),
            
            # Clone human review configuration
            "human_review": base_config.get('human_review'),
            
            # Add metadata about auto-generation
            "metadata": {
                "auto_generated": True,
                "based_on": base_config_id,
                "generation_confidence": self._calculate_overall_confidence(field_analysis),
                "generated_at": datetime.utcnow().isoformat(),  # Convert to string immediately
                "human_validated": False,
                "source_format": source_format,
                "target_format": target_format,
                "similar_to": similar_to
            }
        }
        
        return new_config
    
    def save_generated_config(self, config: Dict[str, Any], trigger_learning: bool = True) -> Dict[str, Any]:
        """
        Save auto-generated configuration to conversion_registry
        Merges with existing config if found to preserve all field variations
        
        Args:
            config: Generated configuration
            trigger_learning: Whether to trigger semantic learning after saving (default: True)
            
        Returns:
            The saved configuration (merged if existing found)
        """
        
        # Check if config already exists
        existing = self.conversion_registry.find_one({"_id": config['_id']})
        if existing:
            logger.info(f"Configuration {config['_id']} exists - merging with new fields")
            # Merge configurations to preserve all field variations
            merged_config = self._merge_configurations(existing, config)
            self.conversion_registry.replace_one(
                {"_id": config['_id']}, 
                merged_config
            )
            logger.info(f"Merged configuration now has {len(merged_config['parser']['fields'])} fields")
            return merged_config  # Return the merged config, not just ID
        
        # Save to conversion_registry
        result = self.conversion_registry.insert_one(config)
        
        logger.info(f"Saved configuration: {config['_id']}")
        
        # Trigger learning to update semantic patterns from the new config (if enabled)
        if trigger_learning:
            logger.info("Triggering semantic pattern learning from new configuration...")
            learned_patterns = self.learn_from_existing_configs()
            
            # Save the learned patterns to the database
            for pattern_id, pattern_doc in learned_patterns.items():
                self.semantic_patterns.update_one(
                    {"_id": pattern_id},
                    {"$set": pattern_doc},
                    upsert=True
                )
                logger.info(f"Updated semantic pattern: {pattern_id}")
        else:
            logger.info("Skipping semantic pattern learning (trigger_learning=False)")
        
        return config  # Return the config, not just ID
    
    def _merge_configurations(self, existing_config: Dict[str, Any], new_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Merge two configurations to preserve all field variations
        Simple approach for demo - just combines fields
        
        Args:
            existing_config: Current configuration in database
            new_config: New configuration from latest sample
            
        Returns:
            Merged configuration with all fields from both
        """
        
        merged = existing_config.copy()
        
        # Merge parser fields - union of all fields seen
        existing_fields = existing_config.get('parser', {}).get('fields', {})
        new_fields = new_config.get('parser', {}).get('fields', {})
        
        # Combine all fields (new fields override if same key)
        all_fields = {**existing_fields, **new_fields}
        merged['parser']['fields'] = all_fields
        
        logger.debug(f"Merged fields: existing={len(existing_fields)}, new={len(new_fields)}, total={len(all_fields)}")
        
        # Merge mappings - keep all unique mappings
        merged['mappings'] = self._merge_mappings(
            existing_config.get('mappings', []),
            new_config.get('mappings', [])
        )
        
        # Update metadata to track variations
        if 'metadata' not in merged:
            merged['metadata'] = {}
            
        merged['metadata']['variation_count'] = existing_config.get('metadata', {}).get('variation_count', 1) + 1
        merged['metadata']['last_updated'] = datetime.utcnow().isoformat()  # Convert to string
        
        # Track all fields seen across variations
        if 'fields_seen' not in merged['metadata']:
            merged['metadata']['fields_seen'] = list(existing_fields.keys())
        
        # Add new fields to the seen list
        for field in new_fields.keys():
            if field not in merged['metadata']['fields_seen']:
                merged['metadata']['fields_seen'].append(field)
        
        logger.info(f"Configuration merged: {merged['metadata']['variation_count']} variations, {len(merged['metadata']['fields_seen'])} unique fields")
        
        return merged
    
    def _merge_mappings(self, existing_mappings: List[Dict[str, Any]], new_mappings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Merge mapping lists, keeping unique mappings by source field
        
        Args:
            existing_mappings: Current mappings
            new_mappings: New mappings from latest sample
            
        Returns:
            Merged list of mappings
        """
        
        # Create dict by source field for easy merging
        merged = {m['source']: m for m in existing_mappings}
        
        # Add new mappings (overwrites if same source)
        for new_mapping in new_mappings:
            source = new_mapping['source']
            if source not in merged:
                # New field mapping discovered
                logger.debug(f"Adding new mapping for field {source}")
                merged[source] = new_mapping
        
        return list(merged.values())
    
    def validate_and_update_config(
        self,
        config_id: str,
        human_corrections: Dict[str, Any]
    ) -> bool:
        """
        Apply human corrections to auto-generated config and learn from them
        
        Args:
            config_id: ID of the configuration
            human_corrections: Dictionary of corrections
            
        Returns:
            True if successful
        """
        
        # Update configuration
        self.conversion_registry.update_one(
            {"_id": config_id},
            {
                "$set": {
                    "metadata.human_validated": True,
                    "metadata.validated_at": datetime.utcnow()
                }
            }
        )
        
        # Learn from corrections
        if human_corrections:
            self._learn_from_corrections(config_id, human_corrections)
        
        return True
    
    # Private helper methods
    
    def _identify_semantic_concept(
        self, 
        mapping: Dict[str, Any], 
        parser_config: Dict[str, Any],
        source_format: str,
        target_format: str
    ) -> Optional[Dict[str, Any]]:
        """
        Identify semantic concept using LLM or pattern matching
        """
        
        # Try LLM if available
        if self.ai:
            concept = self._analyze_with_llm(mapping, parser_config, source_format, target_format)
            if concept:
                return concept
        
        # Fallback to generic extraction
        return self._extract_concept_from_field(mapping)
    
    def _analyze_with_llm(
        self,
        mapping: Dict[str, Any],
        parser_config: Dict[str, Any],
        source_format: str,
        target_format: str
    ) -> Optional[Dict[str, Any]]:
        """
        Use LLM to identify semantic concept
        """
        
        prompt = f"""Analyze this field mapping and identify its semantic concept.

Field Information:
- Source Format: {source_format}
- Target Format: {target_format}  
- Source Field: {mapping.get('source')}
- Field Name: {parser_config.get('name', 'Unknown')}
- Target Fields: {', '.join(mapping.get('targets', []))}
- Transform: {mapping.get('transform')}

Identify the semantic concept (what business purpose this field serves).

Return ONLY a JSON object:
{{
    "concept_id": "semantic_concept_in_snake_case",
    "concept_name": "Human Readable Name",
    "purpose": "Brief description",
    "confidence": 0.95
}}"""

        try:
            response = self.ai.invoke_model(prompt, field_type="default", field_value="")
            
            if isinstance(response, dict):
                return response
            
            # Parse JSON from string
            json_match = re.search(r'\{.*\}', str(response), re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
                
        except Exception as e:
            logger.debug(f"LLM analysis failed: {e}")
            
        return None
    
    def _extract_concept_from_field(self, mapping: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract semantic concept from field names without LLM
        """
        
        source = str(mapping.get('source', '')).lower()
        targets = ' '.join(mapping.get('targets', [])).lower()
        combined = f"{source} {targets}"
        
        # Check for matching seed patterns first
        seed_match = self._match_to_seed_pattern(source, targets, mapping)
        if seed_match:
            return seed_match
        
        # Identify concept based on keywords
        concept_parts = []
        
        keywords = {
            'reference': ['ref', 'reference', 'msgid', 'id', 'identifier', '20'],
            'amount': ['amount', 'amt', 'value', 'sum', '32a', '32b'],
            'date': ['date', 'dt', 'time', 'timestamp'],
            'currency': ['currency', 'ccy', 'cur'],
            'sender': ['sender', 'debtor', 'dbtr', 'ordering', 'payer', '50k', '50a', '52a'],
            'receiver': ['receiver', 'creditor', 'cdtr', 'beneficiary', 'payee', '59', '58a'],
            'institution': ['bank', 'institution', 'agent', 'agt', 'intermediary'],
            'information': ['instruction', 'instr', 'info', 'details', 'rmtinf', '70', '72'],
            'charge': ['charge', 'fee', 'commission', 'chrg', '71a'],
            'address': ['address', 'addr', 'adr', 'location'],
            'account': ['account', 'acct', 'acc']
        }
        
        for concept, terms in keywords.items():
            if any(term in combined for term in terms):
                concept_parts.append(concept)
        
        # Generate concept ID
        if concept_parts:
            concept_id = '_'.join(concept_parts[:2])  # Use first 2 parts
            concept_name = ' '.join(concept_parts).title()
        else:
            # Fallback to field name
            concept_id = re.sub(r'[^a-z0-9_]', '_', source)
            concept_name = f"Field {mapping.get('source', 'Unknown')}"
        
        return {
            "concept_id": concept_id,
            "concept_name": concept_name,
            "purpose": f"Extracted from {mapping.get('source', 'unknown field')}",
            "confidence": 0.7 if concept_parts else 0.5
        }
    
    def _match_to_seed_pattern(self, source: str, targets: str, mapping: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Try to match field to existing seed patterns
        """
        
        # Get seed patterns from database
        seed_patterns = list(self.semantic_patterns.find({"is_seed": True}))
        
        for seed in seed_patterns:
            known_fields = [f.lower() for f in seed.get('known_fields', [])]
            
            # Check if source field matches any known field
            if source in known_fields:
                return {
                    "concept_id": seed['_id'],
                    "concept_name": seed['concept'],
                    "purpose": seed['description'],
                    "confidence": 0.95  # High confidence for seed match
                }
            
            # Check if any target matches
            for known in known_fields:
                if known in targets:
                    return {
                        "concept_id": seed['_id'],
                        "concept_name": seed['concept'],
                        "purpose": seed['description'],
                        "confidence": 0.85  # Slightly lower for target match
                    }
        
        return None
    
    def _create_pattern_document(self, concept_id: str, concept_info: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new semantic pattern document with enhanced tracking
        """
        
        return {
            "_id": concept_id,
            "concept": concept_info['concept_name'],
            "purpose": concept_info['purpose'],
            "learned_patterns": {},
            "field_variations": {},  # Track different field tags per format
            "discovery_log": [  # Track when patterns are discovered
                {
                    "timestamp": datetime.utcnow(),
                    "event": f"Discovered concept: {concept_info['concept_name']}",
                    "source": "initial_learning"
                }
            ],
            "recognition_rules": {
                "field_indicators": [],
                "pattern_hints": [],
                "target_indicators": [],
                "confidence_threshold": 0.7
            },
            "learning_metadata": {
                "first_seen": datetime.utcnow(),
                "last_updated": datetime.utcnow(),
                "seen_in_formats": [],
                "seen_in_conversions": [],
                "learned_via": "llm" if self.ai else "pattern_extraction",
                "success_count": 0,
                "failure_count": 0,
                "avg_confidence": concept_info.get('confidence', 0.5),
                "usage_count": 0
            }
        }
    
    def _update_pattern_metadata(
        self,
        pattern: Dict[str, Any],
        source_format: str,
        config_id: str,
        base_field: str,
        targets: List[str]
    ):
        """
        Update metadata for a semantic pattern
        """
        
        metadata = pattern['learning_metadata']
        rules = pattern['recognition_rules']
        
        # Update formats seen
        if source_format not in metadata['seen_in_formats']:
            metadata['seen_in_formats'].append(source_format)
        
        # Update conversions seen
        if config_id not in metadata['seen_in_conversions']:
            metadata['seen_in_conversions'].append(config_id)
        
        # Update field indicators
        if base_field and base_field not in rules['field_indicators']:
            rules['field_indicators'].append(base_field)
        
        # Update target indicators
        for target in targets:
            if target and target not in rules['target_indicators']:
                rules['target_indicators'].append(target)
        
        # Update timestamp
        metadata['last_updated'] = datetime.utcnow()
    
    def _build_analysis_prompt(self, sample_message: str, similar_config: Dict[str, Any], actual_fields: Dict[str, str]) -> str:
        """
        Build prompt for LLM to analyze new format
        Include actual fields found to help LLM
        """
        
        # Extract field examples from similar config
        field_examples = []
        for field_id, field_config in similar_config.get('parser', {}).get('fields', {}).items():
            field_examples.append(
                f"- Field {field_id}: {field_config.get('name', 'Unknown')}"
            )
        
        # List actual fields found
        actual_field_list = []
        for tag, content in actual_fields.items():
            preview = content[:50] + "..." if len(content) > 50 else content
            actual_field_list.append(f"- Field {tag}: {preview}")
        
        prompt = f"""Analyze this new payment message format and identify field mappings.

Known format ({similar_config['_id'].split('_to_')[0]}) has these fields:
{chr(10).join(field_examples[:15])}

The new message contains these actual fields:
{chr(10).join(actual_field_list)}

Full message:
{sample_message}

For each field found, identify:
1. Semantic concept (what it represents)
2. Similar field from known format (if any)
3. Confidence score (0.0-1.0)

Return ONLY a JSON object:
{{
  "detected_fields": [
    {{
      "field_id": "11S",
      "content": "sample content",
      "similar_to": "20",
      "semantic_concept": "transaction_reference",
      "confidence": 0.95,
      "pattern": ":11S:([^\\\\n:]+)"
    }}
  ],
  "format_family": "SWIFT",
  "overall_similarity": 0.87
}}"""
        
        return prompt
    
    def _merge_analysis_results(self, llm_result: Dict[str, Any], actual_fields: Dict[str, str]) -> Dict[str, Any]:
        """
        Merge LLM analysis with actual fields to ensure completeness
        """
        
        # Create a set of fields already analyzed by LLM
        llm_fields = {f['field_id'] for f in llm_result.get('detected_fields', [])}
        
        # Add any missing fields
        for field_tag in actual_fields:
            if field_tag not in llm_fields:
                # Field was missed by LLM, add it with lower confidence
                llm_result['detected_fields'].append({
                    'field_id': field_tag,
                    'content': actual_fields[field_tag][:100],
                    'similar_to': None,
                    'semantic_concept': f'field_{field_tag.lower()}',
                    'confidence': 0.3,
                    'pattern': self._generate_field_pattern(field_tag, actual_fields[field_tag])
                })
        
        return llm_result
    
    def _parse_llm_response(self, response: Any) -> Dict[str, Any]:
        """
        Parse LLM response to extract field mappings
        Handles both direct responses and AI service extract_field_data responses
        """
        
        if isinstance(response, dict):
            # Handle response from AI service's extract_field_data
            if 'success' in response and 'data' in response:
                # The actual LLM response is in the 'data' field
                data = response.get('data', {})
                
                # If data has detected_fields, return it
                if 'detected_fields' in data:
                    return data
                
                # If it's extracted_text, try to parse the JSON from it
                if 'extracted_text' in data:
                    try:
                        text = data['extracted_text']
                        json_match = re.search(r'\{.*\}', text, re.DOTALL)
                        if json_match:
                            parsed = json.loads(json_match.group())
                            if 'detected_fields' in parsed:
                                return parsed
                    except (json.JSONDecodeError, KeyError):
                        pass
                
                # Log what we got for debugging
                logger.debug(f"AI response data keys: {data.keys()}")
                
            # If response already has detected_fields, return it
            elif 'detected_fields' in response:
                return response
        
        try:
            # Try to extract JSON from string response
            json_match = re.search(r'\{.*\}', str(response), re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group())
                if 'detected_fields' in parsed:
                    return parsed
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}")
        
        # Return empty detected_fields if we couldn't parse
        return {"detected_fields": []}
    
    def _pattern_based_analysis(self, sample_message: str, similar_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze new format using pattern matching when LLM is not available
        Generic approach - no hardcoded field mappings
        """
        
        # First, extract actual fields from the message
        actual_fields = self._extract_fields_from_message(sample_message)
        
        # Get semantic patterns from database to learn from
        semantic_patterns = list(self.semantic_patterns.find())
        
        detected_fields = []
        
        for field_tag, field_content in actual_fields.items():
            # Try to match against learned patterns
            best_match = self._find_best_semantic_match(
                field_tag, 
                field_content, 
                semantic_patterns
            )
            
            if best_match:
                detected_fields.append({
                    "field_id": field_tag,
                    "content": field_content[:100],  # Sample for analysis
                    "similar_to": best_match.get('similar_field'),
                    "semantic_concept": best_match.get('concept'),
                    "confidence": best_match.get('confidence', 0.5),
                    "pattern": self._generate_field_pattern(field_tag, field_content),
                    "multiline": '\n' in field_content
                })
            else:
                # Unknown field - let system learn it
                detected_fields.append({
                    "field_id": field_tag,
                    "content": field_content[:100],
                    "similar_to": None,
                    "semantic_concept": f"unknown_field_{field_tag.lower()}",
                    "confidence": 0.3,
                    "pattern": self._generate_field_pattern(field_tag, field_content),
                    "multiline": '\n' in field_content
                })
        
        return {
            "detected_fields": detected_fields,
            "format_family": self._detect_format_family(sample_message),
            "overall_similarity": 0.6 if detected_fields else 0.0
        }
    
    def _extract_fields_from_message(self, message: str) -> Dict[str, str]:
        """
        Generic field extraction - works for any message format
        Returns dict of field_tag -> content
        """
        
        fields = {}
        
        # Try JSON format extraction
        if message.strip().startswith('{') and message.strip().endswith('}'):
            try:
                import json
                data = json.loads(message)
                
                def extract_json_fields(obj, prefix=''):
                    """Recursively extract fields from JSON"""
                    if isinstance(obj, dict):
                        for key, value in obj.items():
                            field_path = f"{prefix}.{key}" if prefix else key
                            if isinstance(value, dict):
                                extract_json_fields(value, field_path)
                            elif isinstance(value, list):
                                # Handle lists - store the list as a field
                                fields[field_path] = json.dumps(value) if value else "[]"
                            else:
                                # Store primitive values
                                fields[field_path] = str(value) if value is not None else ""
                    return fields
                
                extract_json_fields(data)
                return fields
            except json.JSONDecodeError:
                pass  # Not valid JSON, try other formats
        
        # Try XML format extraction
        if message.strip().startswith('<') and message.strip().endswith('>'):
            try:
                import xml.etree.ElementTree as ET
                root = ET.fromstring(message)
                
                def extract_xml_fields(element, prefix=''):
                    """Recursively extract fields from XML"""
                    # Remove namespace if present
                    tag = element.tag.split('}')[-1] if '}' in element.tag else element.tag
                    field_path = f"{prefix}.{tag}" if prefix else tag
                    
                    # If element has children, recurse
                    if len(element) > 0:
                        for child in element:
                            extract_xml_fields(child, field_path)
                    else:
                        # Leaf node - store the text
                        if element.text:
                            fields[field_path] = element.text.strip()
                    
                    return fields
                
                extract_xml_fields(root)
                return fields
            except ET.ParseError:
                pass  # Not valid XML, try other formats
        
        # Try SWIFT format extraction
        if '{4:' in message:
            # Extract block 4 content
            block_match = re.search(r'\{4:(.*?)\-?\}', message, re.DOTALL)
            if block_match:
                content = block_match.group(1)
                # Generic pattern for SWIFT fields
                field_pattern = r':([A-Z0-9]+?):(.*?)(?=:[A-Z0-9]+?:|$)'
                matches = re.findall(field_pattern, content, re.DOTALL)
                for tag, value in matches:
                    fields[tag] = value.strip()
        
        return fields
    
    def _find_best_semantic_match(
        self, 
        field_tag: str, 
        field_content: str,
        semantic_patterns: List[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """
        Find best semantic match from learned patterns
        No hardcoding - uses what system has learned
        """
        
        best_match = None
        best_score = 0
        
        for pattern in semantic_patterns:
            # Check if this pattern has seen this field before
            learned = pattern.get('learned_patterns', {})
            
            for format_name, format_pattern in learned.items():
                pattern_field = format_pattern.get('field', '')
                
                # Exact field match
                if pattern_field == field_tag:
                    return {
                        'concept': pattern.get('_id'),
                        'similar_field': field_tag,
                        'confidence': 0.9
                    }
                
                # Content similarity check (generic, not hardcoded)
                if format_pattern.get('pattern'):
                    try:
                        if re.match(format_pattern['pattern'], f":{field_tag}:{field_content}"):
                            score = 0.7
                            if score > best_score:
                                best_score = score
                                best_match = {
                                    'concept': pattern.get('_id'),
                                    'similar_field': pattern_field,
                                    'confidence': score
                                }
                    except:
                        pass
        
        return best_match
    
    def _generate_field_pattern(self, field_tag: str, field_content: str) -> str:
        """
        Generate regex pattern for a field based on its content
        Generic approach - no assumptions about field types
        """
        
        if '\n' in field_content:
            # Multiline field
            return f":{field_tag}:([^\\n:]+(?:\\n(?!:)[^\\n:]+)*)"
        else:
            # Single line field
            return f":{field_tag}:([^\\n:]+)"
    
    def _detect_format_family(self, message: str) -> str:
        """
        Detect message format family generically
        """
        
        if '{1:' in message and '{2:' in message and '{4:' in message:
            # SWIFT format detected by block structure
            return "SWIFT"
        elif message.strip().startswith('<?xml'):
            return "XML"
        elif message.strip().startswith('{'):
            return "JSON"
        else:
            return "Unknown"
    
    def _generate_parser_config(
        self,
        field_analysis: Dict[str, Any],
        base_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate parser configuration for new format
        """
        
        parser_config = {
            "type": base_config.get('parser', {}).get('type', 'regex'),
            "block_pattern": base_config.get('parser', {}).get('block_pattern'),
            "content_block": base_config.get('parser', {}).get('content_block'),
            "fields": {}
        }
        
        # Add detected fields
        for field in field_analysis.get('detected_fields', []):
            field_id = field['field_id']
            
            # Get pattern from analysis or generate default
            pattern = field.get('pattern', f":{field_id}:([^\\n:]+)")
            
            parser_config['fields'][field_id] = {
                "pattern": pattern,
                "name": field.get('semantic_concept', field_id).replace('_', ' '),
                "multiline": field.get('multiline', False)
            }
            
            # Add components if field has them
            if field.get('components'):
                parser_config['fields'][field_id]['components'] = field['components']
            else:
                # Check semantic patterns for components
                semantic_concept = field.get('semantic_concept')
                if semantic_concept:
                    pattern = self.semantic_patterns.find_one({'_id': semantic_concept})
                    if pattern:
                        # Look for components in learned patterns
                        for format_data in pattern.get('learned_patterns', {}).values():
                            if format_data.get('components'):
                                parser_config['fields'][field_id]['components'] = format_data['components']
                                break
        
        return parser_config
    
    def _generate_mappings(
        self,
        field_analysis: Dict[str, Any],
        base_config: Dict[str, Any],
        target_format: str
    ) -> List[Dict[str, Any]]:
        """
        Generate mappings based on semantic patterns
        """
        
        mappings = []
        
        # Load semantic patterns from database
        semantic_patterns = list(self.semantic_patterns.find())
        
        # Create lookup for semantic patterns
        pattern_lookup = {p['_id']: p for p in semantic_patterns}
        
        # Generate mappings for detected fields
        for field in field_analysis.get('detected_fields', []):
            semantic_concept = field.get('semantic_concept')
            
            if semantic_concept and semantic_concept in pattern_lookup:
                pattern = pattern_lookup[semantic_concept]
                
                # Find how this concept maps to target format
                # Look for existing patterns that map to same target
                for format_patterns in pattern['learned_patterns'].values():
                    if format_patterns.get('target_format') == target_format:
                        # Found a pattern that maps to our target format
                        
                        # Check if this field has components in the pattern
                        if format_patterns.get('components'):
                            # Create a mapping for EACH component
                            # For 32A, this creates mappings for value_date, currency, and amount
                            for component_name, component_info in format_patterns['components'].items():
                                source_field = f"{field['field_id']}.{component_name}"
                                
                                # Look for component-specific mapping in learned patterns
                                # Search across ALL patterns, not just the current format
                                component_pattern_key = None
                                component_mapping = None
                                
                                # Search for component-specific pattern from ANY format
                                for pattern_key, other_pattern in pattern['learned_patterns'].items():
                                    # Check if this is a component pattern that matches our component name
                                    # e.g., "MT202.value_date" matches component "value_date"
                                    if '.' in pattern_key and pattern_key.endswith(f".{component_name}"):
                                        # Check if this pattern targets our desired format
                                        if other_pattern.get('target_format') == target_format:
                                            # Found a pattern for this specific component
                                            component_mapping = other_pattern
                                            component_pattern_key = pattern_key
                                            break
                                
                                if component_mapping:
                                    # Use component-specific targets and transforms
                                    new_mapping = {
                                        "source": source_field,
                                        "targets": component_mapping.get('targets', []),
                                        "transform": component_mapping.get('transform', 'copy'),
                                        "processing_lane": component_mapping.get('processing_lane', 'RULES'),
                                        "confidence": field.get('confidence', 0.7)
                                    }
                                    
                                    # Copy transform config if present
                                    if component_mapping.get('transform_config'):
                                        new_mapping['transform_config'] = component_mapping['transform_config']
                                    
                                    # Copy AI config if present
                                    if component_mapping.get('field_type'):
                                        new_mapping['field_type'] = component_mapping['field_type']
                                        new_mapping['confidence_threshold'] = component_mapping.get('confidence_threshold', 0.8)
                                    
                                    mappings.append(new_mapping)
                                    logger.debug(f"Created component mapping: {source_field} → {component_mapping.get('targets', [])} (from {component_pattern_key})")
                                else:
                                    # No specific component mapping found
                                    # Look for this component in a different semantic concept
                                    # For example, "currency" might be in "amount_currency" concept
                                    component_found = False
                                    
                                    # Search all semantic patterns for this component
                                    for other_concept_id, other_concept in pattern_lookup.items():
                                        if other_concept_id != semantic_concept:  # Don't search the same concept again
                                            for pk, pp in other_concept.get('learned_patterns', {}).items():
                                                if '.' in pk and pk.endswith(f".{component_name}") and pp.get('target_format') == target_format:
                                                    # Found the component in a different concept!
                                                    new_mapping = {
                                                        "source": source_field,
                                                        "targets": pp.get('targets', []),
                                                        "transform": pp.get('transform', 'copy'),
                                                        "processing_lane": pp.get('processing_lane', 'RULES'),
                                                        "confidence": field.get('confidence', 0.6)  # Slightly lower confidence
                                                    }
                                                    
                                                    if pp.get('transform_config'):
                                                        new_mapping['transform_config'] = pp['transform_config']
                                                    
                                                    mappings.append(new_mapping)
                                                    logger.debug(f"Created component mapping from different concept: {source_field} → {pp.get('targets', [])} (from {other_concept_id}/{pk})")
                                                    component_found = True
                                                    break
                                            if component_found:
                                                break
                                    
                                    if not component_found:
                                        logger.debug(f"No learned pattern for component {component_name} of field {field['field_id']}")
                                        continue
                        else:
                            # No components, create single mapping as before
                            source_field = field['field_id']
                            new_mapping = {
                                "source": source_field,
                                "targets": format_patterns['targets'],
                                "transform": format_patterns.get('transform', 'copy'),
                                "processing_lane": format_patterns.get('processing_lane', 'RULES'),
                                "confidence": field.get('confidence', 0.7)
                            }
                            
                            # Copy transform config if present
                            if format_patterns.get('transform_config'):
                                new_mapping['transform_config'] = format_patterns['transform_config']
                            
                            # Copy AI config if present
                            if format_patterns.get('field_type'):
                                new_mapping['field_type'] = format_patterns['field_type']
                                new_mapping['confidence_threshold'] = format_patterns.get('confidence_threshold', 0.8)
                            
                            mappings.append(new_mapping)
                        
                        break
            else:
                # No semantic pattern found, try to map based on similar field
                similar_field = field.get('similar_to')
                if similar_field:
                    # Find mapping for similar field in base config
                    for base_mapping in base_config.get('mappings', []):
                        if base_mapping.get('source', '').split('.')[0] == similar_field:
                            # Clone and adapt the mapping
                            new_mapping = {
                                "source": field['field_id'],
                                "targets": base_mapping['targets'],
                                "transform": base_mapping.get('transform', 'copy'),
                                "processing_lane": base_mapping.get('processing_lane', 'RULES'),
                                "confidence": field.get('confidence', 0.6)
                            }
                            
                            # Copy additional config
                            for key in ['transform_config', 'field_type', 'confidence_threshold']:
                                if key in base_mapping:
                                    new_mapping[key] = base_mapping[key]
                            
                            mappings.append(new_mapping)
                            break
        
        return mappings
    
    def _calculate_overall_confidence(self, field_analysis: Dict[str, Any]) -> float:
        """
        Calculate overall confidence for the generated configuration
        """
        
        detected_fields = field_analysis.get('detected_fields', [])
        
        if not detected_fields:
            return 0.0
        
        # Calculate average confidence
        total_confidence = sum(f.get('confidence', 0.5) for f in detected_fields)
        avg_confidence = total_confidence / len(detected_fields)
        
        # Apply similarity factor
        similarity = field_analysis.get('overall_similarity', 0.7)
        
        return round(avg_confidence * similarity, 2)
    
    def _learn_from_corrections(self, config_id: str, corrections: Dict[str, Any]):
        """
        Update semantic patterns based on human corrections
        """
        
        # Get the configuration
        config = self.conversion_registry.find_one({"_id": config_id})
        if not config:
            return
        
        source_format = config['metadata'].get('source_format')
        
        # Process each correction
        for field_correction in corrections.get('field_corrections', []):
            semantic_concept = field_correction.get('semantic_concept')
            
            if semantic_concept:
                # Update the semantic pattern
                self.semantic_patterns.update_one(
                    {"_id": semantic_concept},
                    {
                        "$inc": {
                            "learning_metadata.success_count": 1 if field_correction.get('correct') else 0,
                            "learning_metadata.failure_count": 0 if field_correction.get('correct') else 1
                        },
                        "$set": {
                            "learning_metadata.last_updated": datetime.utcnow()
                        }
                    }
                )
                
                # If correction includes new mapping, add it
                if field_correction.get('new_mapping'):
                    new_mapping = field_correction['new_mapping']
                    self.semantic_patterns.update_one(
                        {"_id": semantic_concept},
                        {
                            "$set": {
                                f"learned_patterns.{source_format}": new_mapping
                            }
                        }
                    )
        
        logger.info(f"Learned from {len(corrections.get('field_corrections', []))} corrections")