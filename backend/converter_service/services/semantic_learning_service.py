"""
Semantic Learning Service - Learns patterns from existing conversions
and generates configurations for new formats
"""

import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
import json
import re
from .generation_tracker import GenerationTracker

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
            Dictionary of detected fields, semantic mappings, and AI analysis details
        """
        
        # Get the similar format's configuration(s)
        # If similar_to already contains '_to_', use it directly
        if '_to_' in similar_to:
            similar_configs = list(self.conversion_registry.find(
                {"_id": similar_to}
            ))
        else:
            # Otherwise look for configs starting with that format prefix
            # This allows similar_to="MT" to match MT103, MT202, MT205, etc.
            similar_configs = list(self.conversion_registry.find(
                {"_id": {"$regex": f"^{similar_to}.*_to_"}}
            ))

        if not similar_configs:
            raise ValueError(f"No configuration found for {similar_to}")

        logger.info(f"Found {len(similar_configs)} similar configurations for '{similar_to}': {[c['_id'] for c in similar_configs]}")

        # Use ALL similar configs for comprehensive learning
        # Primary config is first one for base structure
        similar_config = similar_configs[0]
        
        # First extract actual fields from the message
        actual_fields = self._extract_fields_from_message(sample_message)
        logger.info(f"Extracted {len(actual_fields)} fields from sample message")

        # Build prompt for LLM with ALL similar configs for comprehensive learning
        prompt = self._build_analysis_prompt(sample_message, similar_configs, actual_fields)

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

                # Capture AI analysis details
                llm_result['_ai_analysis_details'] = {
                    'prompt_used': prompt,
                    'raw_response': str(response.get('data', {})) if isinstance(response, dict) else str(response),
                    'model': response.get('model', 'unknown') if isinstance(response, dict) else 'unknown',
                    'processing_lane': response.get('processing_lane', 'AI') if isinstance(response, dict) else 'AI',
                    'extraction_method': 'llm_analysis'
                }

                # If we didn't get detected_fields, fall back to pattern-based analysis
                if not llm_result.get('detected_fields'):
                    logger.warning("LLM response missing detected_fields, using pattern-based analysis")
                    fallback_result = self._pattern_based_analysis(sample_message, similar_configs)
                    # Preserve the LLM attempt details for transparency
                    fallback_result['_ai_analysis_details'] = {
                        'prompt_used': prompt,
                        'raw_response': str(response.get('data', {})) if isinstance(response, dict) else str(response),
                        'model': response.get('model', 'unknown') if isinstance(response, dict) else 'unknown',
                        'processing_lane': 'PATTERN',
                        'extraction_method': 'pattern_matching',
                        'fallback_reason': 'LLM response missing detected_fields'
                    }
                    return fallback_result

                # Merge with actual fields to ensure we don't miss any
                merged_result = self._merge_analysis_results(llm_result, actual_fields)
                # Preserve AI analysis details in merged result
                if '_ai_analysis_details' in llm_result:
                    merged_result['_ai_analysis_details'] = llm_result['_ai_analysis_details']
                return merged_result
                
            except Exception as e:
                logger.error(f"LLM analysis failed: {e}")
                # Fall back to pattern-based analysis
                fallback_result = self._pattern_based_analysis(sample_message, similar_configs)
                fallback_result['_ai_analysis_details'] = {
                    'prompt_used': prompt,
                    'raw_response': f'Error: {str(e)}',
                    'model': 'none',
                    'processing_lane': 'PATTERN',
                    'extraction_method': 'pattern_matching',
                    'fallback_reason': 'LLM analysis failed'
                }
                return fallback_result
        else:
            # No AI service, use pattern-based analysis
            fallback_result = self._pattern_based_analysis(sample_message, similar_configs)
            fallback_result['_ai_analysis_details'] = {
                'prompt_used': None,
                'raw_response': 'AI service not available',
                'model': 'none',
                'processing_lane': 'PATTERN',
                'extraction_method': 'pattern_matching',
                'fallback_reason': 'AI service not initialized'
            }
            return fallback_result
    
    def generate_config_for_new_format(
        self,
        source_format: str,
        target_format: str,
        sample_message: str,
        similar_to: str
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """
        Generate complete configuration for a new format

        Args:
            source_format: New source format (e.g., "MT192")
            target_format: Target format (e.g., "pacs.008")
            sample_message: Sample message in the new format
            similar_to: Existing format this is similar to

        Returns:
            Tuple of (configuration, generation_metadata)
        """

        tracker = GenerationTracker()
        logger.info(f"Generating configuration for {source_format} to {target_format}")
        
        # Step 1: Field extraction and analysis
        step_id = tracker.start_step("field_extraction_and_analysis")

        # For JSON source format, skip LLM analysis and just copy the base config
        if source_format == 'JSON':
            logger.info("JSON source format detected - skipping LLM analysis")
            field_analysis = {"detected_fields": [], "format_family": "JSON", "overall_similarity": 1.0}

            tracker.complete_step(step_id, {
                "fields_found": 0,
                "extraction_method": "json_direct",
                "format_family": "JSON"
            })
        else:
            # Analyze the new format
            field_analysis = self.analyze_new_format_with_llm(sample_message, similar_to)

            # Prepare step result
            step_result = {
                "fields_found": len(field_analysis.get('detected_fields', [])),
                "extraction_method": "llm_analysis" if self.ai else "pattern_matching",
                "format_family": field_analysis.get('format_family', 'Unknown'),
                "overall_similarity": field_analysis.get('overall_similarity', 0.0),
                "fields": [
                    {
                        "field_id": f['field_id'],
                        "semantic_concept": f.get('semantic_concept', 'unknown'),
                        "confidence": f.get('confidence', 0.0)
                    }
                    for f in field_analysis.get('detected_fields', [])
                ]
            }

            # Include AI analysis details if available
            if '_ai_analysis_details' in field_analysis:
                step_result['ai_analysis'] = field_analysis['_ai_analysis_details']

            tracker.complete_step(step_id, step_result)
        
        # Step 2: Base configuration lookup
        step_id = tracker.start_step("base_configuration_lookup")

        # Find all similar configs for pattern learning (same logic as in analyze_new_format_with_llm)
        all_similar_configs = []
        if '_to_' in similar_to:
            all_similar_configs = list(self.conversion_registry.find(
                {"_id": similar_to}
            ))
        else:
            # Look for configs starting with that format prefix for pattern learning
            all_similar_configs = list(self.conversion_registry.find(
                {"_id": {"$regex": f"^{similar_to}.*_to_"}}
            ))

        # Get base configuration to clone (structural template)
        base_config = None
        base_config_id = None

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
            # Check if similar_to is a format family prefix (e.g., "MT", "ISO") or specific format (e.g., "MT202")
            # Format family prefixes are typically short (2-4 chars) and uppercase
            is_format_family = len(similar_to) <= 4 and similar_to.isupper()

            if is_format_family:
                # Search for any config matching the format family prefix
                logger.info(f"'{similar_to}' detected as format family prefix, searching for configs like '{similar_to}*_to_{target_format}'")
                base_configs = list(self.conversion_registry.find(
                    {"_id": {"$regex": f"^{similar_to}.*_to_{target_format}$"}}
                ))
                logger.info(f"Found {len(base_configs)} configs matching '{similar_to}*_to_{target_format}'")

                if base_configs:
                    # Use the first matching config
                    base_config = base_configs[0]
                    base_config_id = base_config['_id']
                    logger.info(f"Using base config: {base_config_id}")
                else:
                    # No configs found with this format family and target
                    logger.warning(f"No configs found matching '{similar_to}*_to_{target_format}'")
            else:
                # Specific format - construct exact config ID
                base_config_id = f"{similar_to}_to_{target_format}"
                logger.info(f"Looking for constructed config ID: {base_config_id}")
                base_config = self.conversion_registry.find_one({"_id": base_config_id})

        # Fallback: if still no config, try to find ANY config with the target format
        if not base_config:
            logger.info(f"Searching for any config ending with _to_{target_format}")
            base_configs = list(self.conversion_registry.find(
                {"_id": {"$regex": f"_to_{target_format}$"}}
            ))
            logger.info(f"Found {len(base_configs)} configs with target format {target_format}")
            if base_configs:
                base_config = base_configs[0]
                base_config_id = base_config['_id']
                logger.info(f"Using fallback config: {base_config_id}")
            else:
                # Log all available configs for debugging
                all_configs = list(self.conversion_registry.find({}, {"_id": 1}))
                logger.error(f"Available configs: {[c['_id'] for c in all_configs]}")
                raise ValueError(f"Base configuration '{similar_to}_to_{target_format}' not found. Available configurations: {[c['_id'] for c in all_configs]}")

        tracker.complete_step(step_id, {
            "base_configuration_id": base_config_id,
            "base_config_found": True,
            "fields_in_base": len(base_config.get('parser', {}).get('fields', {})),
            "mappings_in_base": len(base_config.get('mappings', [])),
            "configs_analyzed": [c['_id'] for c in all_similar_configs],
            "total_configs_analyzed": len(all_similar_configs)
        })

        # Track learning sources (will be updated with actual formats after mappings generation)
        initial_similar_formats = list(set([similar_to, base_config_id.split('_to_')[0]]))  # Remove duplicates
        tracker.set_learning_sources(
            base_config=base_config_id,
            similar_formats=initial_similar_formats,
            patterns_referenced=0  # Will be updated during mapping generation
        )
        
        # Step 3: Parser configuration generation
        step_id = tracker.start_step("parser_generation")

        if source_format == 'JSON':
            parser_config = base_config.get('parser')
            tracker.complete_step(step_id, {
                "method": "copied_from_base",
                "parser_type": parser_config.get('type', 'unknown'),
                "fields_generated": len(parser_config.get('fields', {})),
                "fields_list": list(parser_config.get('fields', {}).keys())
            })
        else:
            parser_config = self._generate_parser_config(field_analysis, base_config)

            # Get sample field patterns for display (first 5 fields)
            field_patterns = []
            for field_id, field_config in list(parser_config.get('fields', {}).items())[:5]:
                field_patterns.append({
                    "field_id": field_id,
                    "pattern": field_config.get('pattern', ''),
                    "multiline": field_config.get('multiline', False)
                })

            tracker.complete_step(step_id, {
                "method": "generated_from_analysis",
                "parser_type": parser_config.get('type', 'regex'),
                "fields_generated": len(parser_config.get('fields', {})),
                "fields_list": list(parser_config.get('fields', {}).keys()),
                "sample_patterns": field_patterns,
                "block_pattern": parser_config.get('block_pattern'),
                "content_block": parser_config.get('content_block')
            })

        # Step 4: Mappings generation
        step_id = tracker.start_step("mappings_generation")

        if source_format == 'JSON' and not field_analysis.get('detected_fields'):
            mappings = base_config.get('mappings')
            tracker.complete_step(step_id, {
                "method": "copied_from_base",
                "mappings_generated": len(mappings),
                "semantic_patterns_used": 0
            })
        else:
            mappings, semantic_usage = self._generate_mappings_with_tracking(field_analysis, base_config, target_format, tracker)
            tracker.complete_step(step_id, {
                "method": "semantic_pattern_matching",
                "mappings_generated": len(mappings),
                "semantic_patterns_used": len(semantic_usage),
                "patterns_matched": semantic_usage
            })

            # Update learning sources with patterns count and actual formats that contributed
            tracker.learning_sources["semantic_patterns_referenced"] = len(semantic_usage)

            # Collect all unique formats that contributed patterns
            contributed_formats = set(tracker.learning_sources.get("similar_formats", []))
            for pattern_usage in semantic_usage:
                if 'learned_from_formats' in pattern_usage and pattern_usage['learned_from_formats']:
                    contributed_formats.update(pattern_usage['learned_from_formats'])

            if contributed_formats:
                tracker.learning_sources["similar_formats"] = sorted(list(contributed_formats))

        # Step 5: Overall confidence calculation
        step_id = tracker.start_step("confidence_calculation")
        overall_confidence = self._calculate_overall_confidence(field_analysis)
        tracker.complete_step(step_id, {
            "overall_confidence": overall_confidence,
            "method": "field_confidence_average"
        })

        # Generate new configuration
        new_config = {
            "_id": f"{source_format}_to_{target_format}",
            "parser": parser_config,
            "mappings": mappings,
            "builder": base_config.get('builder'),
            "ai_service": base_config.get('ai_service'),
            "human_review": base_config.get('human_review'),
            "metadata": {
                "auto_generated": True,
                "based_on": base_config_id,
                "generation_confidence": overall_confidence,
                "generated_at": datetime.utcnow().isoformat(),
                "human_validated": False,
                "source_format": source_format,
                "target_format": target_format,
                "similar_to": similar_to
            }
        }

        # Generate comparison for UI display (not part of generation flow)
        comparison = self._compare_with_base_config(new_config, base_config)

        # Add comparison to metadata for frontend visualization
        metadata = tracker.get_metadata()
        metadata['base_comparison'] = comparison

        return new_config, metadata
    
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
    
    def _build_analysis_prompt(self, sample_message: str, similar_configs: List[Dict[str, Any]], actual_fields: Dict[str, str]) -> str:
        """
        Build prompt for LLM to analyze new format
        Include actual fields found and examples from ALL similar configs
        """

        # Aggregate field examples from ALL similar configs
        all_field_examples = {}
        format_names = []
        all_target_fields = set()

        for config in similar_configs:
            format_name = config['_id'].split('_to_')[0]
            format_names.append(format_name)

            # Collect fields from this config
            for field_id, field_config in config.get('parser', {}).get('fields', {}).items():
                field_name = field_config.get('name', 'Unknown')
                # Track which formats have this field
                if field_id not in all_field_examples:
                    all_field_examples[field_id] = {
                        'name': field_name,
                        'formats': []
                    }
                all_field_examples[field_id]['formats'].append(format_name)

            # Collect all target fields from mappings
            for mapping in config.get('mappings', []):
                all_target_fields.update(mapping.get('targets', []))

        # Build field examples list with format attribution
        # CRITICAL: Prioritize fields that exist in the actual message
        priority_fields = []
        other_fields = []

        for field_id, info in sorted(all_field_examples.items()):
            formats_str = ", ".join(info['formats'][:3])  # Show up to 3 formats
            if len(info['formats']) > 3:
                formats_str += f" (+{len(info['formats'])-3} more)"
            field_line = f"- Field {field_id}: {info['name']} (from {formats_str})"

            # Prioritize fields that exist in actual message
            if field_id in actual_fields:
                priority_fields.append(field_line)
            else:
                other_fields.append(field_line)

        # Combine: priority fields first, then others (up to 30 total)
        field_examples = priority_fields + other_fields[:max(0, 30 - len(priority_fields))]

        # List actual fields found
        actual_field_list = []
        for tag, content in actual_fields.items():
            preview = content[:50] + "..." if len(content) > 50 else content
            actual_field_list.append(f"- Field {tag}: {preview}")

        # Format names for prompt
        formats_display = ", ".join(set(format_names[:5]))  # Show up to 5 unique formats
        if len(set(format_names)) > 5:
            formats_display += f" and {len(set(format_names))-5} more"

        # Get target format from first config
        target_format = similar_configs[0]['_id'].split('_to_')[1] if similar_configs else "target"

        # Format target fields for display (limit to 40 most common)
        target_fields_list = sorted(all_target_fields)[:40]
        target_fields_display = chr(10).join(f"- {field}" for field in target_fields_list)
        if len(all_target_fields) > 40:
            target_fields_display += f"\n... and {len(all_target_fields) - 40} more"

        prompt = f"""Analyze this new payment message format and identify field mappings.

Known formats ({formats_display}) have these fields:
{chr(10).join(field_examples)}

The new message contains these actual fields:
{chr(10).join(actual_field_list)}

Available target fields in {target_format}:
{target_fields_display}

Full message:
{sample_message}

For each field found, identify:
1. Semantic concept (what it represents)
2. Similar field from known formats (if any)
3. Suggested target field(s) from the available {target_format} fields above
4. Confidence score (0.0-1.0)

Return ONLY a JSON object:
{{
  "detected_fields": [
    {{
      "field_id": "11S",
      "content": "sample content",
      "similar_to": "20",
      "semantic_concept": "transaction_reference",
      "suggested_targets": ["GrpHdr.MsgId"],
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
    
    def _pattern_based_analysis(self, sample_message: str, similar_configs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyze new format using pattern matching when LLM is not available
        Generic approach - no hardcoded field mappings
        Uses ALL similar configs for comprehensive pattern matching
        """

        # Use first config as primary reference
        similar_config = similar_configs[0] if similar_configs else {}

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
    
    def _generate_mappings_with_tracking(
        self,
        field_analysis: Dict[str, Any],
        base_config: Dict[str, Any],
        target_format: str,
        tracker: GenerationTracker
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Generate mappings based on semantic patterns
        """
        
        mappings = []

        # Load semantic patterns from database
        semantic_patterns = list(self.semantic_patterns.find())

        # Create lookup for semantic patterns
        pattern_lookup = {p['_id']: p for p in semantic_patterns}

        # Track semantic patterns used
        semantic_usage = []

        # Track unmapped fields
        unmapped_fields = []

        # Generate mappings for detected fields
        for field in field_analysis.get('detected_fields', []):
            semantic_concept = field.get('semantic_concept')
            logger.debug(f"Processing field {field['field_id']}: semantic_concept={semantic_concept}")

            if semantic_concept and semantic_concept in pattern_lookup:
                pattern = pattern_lookup[semantic_concept]

                # Track this pattern usage
                learned_from = pattern.get('learning_metadata', {}).get('seen_in_formats', [])
                semantic_usage.append({
                    "concept_id": semantic_concept,
                    "concept_name": pattern.get('concept', 'Unknown'),
                    "used_for_field": field['field_id'],
                    "learned_from_formats": learned_from,
                    "confidence": field.get('confidence', 0.5)
                })

                # Add to tracker
                tracker.add_semantic_pattern(
                    concept_id=semantic_concept,
                    concept_name=pattern.get('concept', 'Unknown'),
                    used_for_fields=[field['field_id']],
                    learned_from=learned_from
                )
                
                # Find how this concept maps to target format
                # Look for existing patterns that map to same target
                mapped_via_pattern = False
                for pattern_key, format_patterns in pattern['learned_patterns'].items():
                    if format_patterns.get('target_format') == target_format:
                        # Found a pattern that maps to our target format

                        # CRITICAL: Validate field variant compatibility
                        # Extract base field and variant from both learned and new field
                        learned_field = format_patterns.get('field', '')
                        new_field_id = field['field_id']

                        # Get base field number (e.g., "52" from "52K", "52A")
                        learned_base = ''.join(c for c in learned_field.split('.')[0] if c.isdigit())
                        new_base = ''.join(c for c in new_field_id.split('.')[0] if c.isdigit())

                        # Get variant letter (A, D, K, etc.)
                        learned_variant = learned_field.split('.')[0].replace(learned_base, '') if learned_base else ''
                        new_variant = new_field_id.split('.')[0].replace(new_base, '') if new_base else ''

                        # Only use this pattern if:
                        # 1. Base field matches (52 == 52), AND
                        # 2. Variant matches (A == A) OR no variant in either
                        if learned_base == new_base:
                            # Check variant compatibility
                            if learned_variant != new_variant and learned_variant and new_variant:
                                # Different variants (e.g., 52A vs 52K) - likely incompatible structure
                                logger.debug(f"Skipping pattern: field {new_field_id} variant '{new_variant}' differs from learned '{learned_field}' variant '{learned_variant}'")
                                continue  # Try next pattern
                        else:
                            # Different base field number
                            continue  # Try next pattern
                        
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

                        # Mark as successfully mapped via pattern
                        mapped_via_pattern = True
                        break
                else:
                    # Loop completed without break - check why
                    if not mapped_via_pattern:
                        # Pattern found but either no mapping to target format OR variant incompatibility
                        # Check if there were any patterns for this target format at all
                        has_target_patterns = any(
                            fp.get('target_format') == target_format
                            for fp in pattern['learned_patterns'].values()
                        )

                        if has_target_patterns:
                            # Patterns exist but variant incompatible
                            reason = f"Field variant incompatible with learned patterns (learned: {', '.join(fp.get('field', '?') for fp in pattern['learned_patterns'].values() if fp.get('target_format') == target_format)[:50]})"
                        else:
                            # No patterns for this target format
                            reason = f"No learned pattern maps to {target_format}"

                        unmapped_fields.append({
                            "field_id": field['field_id'],
                            "semantic_concept": semantic_concept,
                            "reason": reason,
                            "confidence": field.get('confidence', 0.0)
                        })
            else:
                # No semantic pattern found, try to map based on similar field
                similar_field = field.get('similar_to')
                if similar_field:
                    # Find mapping for similar field in base config
                    mapped = False
                    new_field_id = field['field_id']

                    # CRITICAL: Check variant compatibility before using similar field
                    # Get base and variant for both fields
                    similar_base = ''.join(c for c in similar_field.split('.')[0] if c.isdigit())
                    similar_variant = similar_field.split('.')[0].replace(similar_base, '') if similar_base else ''

                    new_base = ''.join(c for c in new_field_id.split('.')[0] if c.isdigit())
                    new_variant = new_field_id.split('.')[0].replace(new_base, '') if new_base else ''

                    # Only use similar_field if variants match OR one has no variant
                    variant_compatible = (
                        similar_variant == new_variant or  # Exact match (52A == 52A)
                        not similar_variant or  # Similar has no variant
                        not new_variant  # New has no variant
                    )

                    if not variant_compatible:
                        # Different variants - don't use similar field mapping
                        logger.debug(f"Skipping similar_field fallback: {new_field_id} variant '{new_variant}' incompatible with similar '{similar_field}' variant '{similar_variant}'")
                        unmapped_fields.append({
                            "field_id": field['field_id'],
                            "semantic_concept": field.get('semantic_concept', 'unknown'),
                            "similar_to": similar_field,
                            "reason": f"Similar field '{similar_field}' has incompatible variant (needs '{new_variant}' but found '{similar_variant}')",
                            "confidence": field.get('confidence', 0.0)
                        })
                    else:
                        # Variant compatible - proceed with similar field mapping
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
                                mapped = True
                                logger.debug(f"Field {field['field_id']} mapped via similar_field fallback")

                                # Add to semantic_usage for transparency
                                # Get concept name from semantic_concept if available
                                concept_name = "Similar Field Mapping"
                                if field.get('semantic_concept'):
                                    # Convert snake_case to Title Case (e.g., related_reference -> Related Reference)
                                    concept_name = field['semantic_concept'].replace('_', ' ').title()

                                # Try to find which formats use this similar field
                                learned_from_formats = []
                                for base_map in base_config.get('mappings', []):
                                    if base_map.get('source', '').split('.')[0] == similar_field:
                                        # This mapping is for the similar field, try to find its source format
                                        # We can infer from the base config ID (e.g., MT202_to_pacs.009 -> MT202)
                                        source_format = base_config.get('_id', '').split('_to_')[0] if '_to_' in base_config.get('_id', '') else 'Unknown'
                                        learned_from_formats.append(source_format)
                                        break

                                semantic_usage.append({
                                    "concept_id": field.get('semantic_concept', 'similar_field_mapping'),
                                    "concept_name": concept_name,
                                    "used_for_field": field['field_id'],
                                    "learned_from_formats": learned_from_formats if learned_from_formats else [similar_field],
                                    "confidence": field.get('confidence', 0.6),
                                    "mapping_method": "similar_field"
                                })
                                break

                        if not mapped and variant_compatible:
                            # Similar field specified and compatible but no mapping found in base config
                            unmapped_fields.append({
                                "field_id": field['field_id'],
                                "semantic_concept": field.get('semantic_concept', 'unknown'),
                                "similar_to": similar_field,
                                "reason": f"Similar field '{similar_field}' not found in base config",
                                "confidence": field.get('confidence', 0.0)
                            })
                else:
                    # No semantic pattern and no similar field - try LLM suggested_targets
                    suggested_targets = field.get('suggested_targets', [])

                    if suggested_targets:
                        # Validate suggested targets against base config
                        all_valid_targets = set()
                        for base_mapping in base_config.get('mappings', []):
                            all_valid_targets.update(base_mapping.get('targets', []))

                        # Filter to only valid targets
                        valid_suggested = [t for t in suggested_targets if t in all_valid_targets]

                        if valid_suggested:
                            # Create mapping with LLM suggestions
                            llm_confidence = field.get('confidence', 0.5) * 0.7  # Reduce confidence for LLM guess

                            new_mapping = {
                                "source": field['field_id'],
                                "targets": valid_suggested,
                                "transform": "copy",
                                "processing_lane": "RULES",
                                "confidence": llm_confidence
                            }

                            mappings.append(new_mapping)

                            # Track in semantic_usage
                            semantic_usage.append({
                                "concept_id": "llm_suggested",
                                "concept_name": "🤖 LLM Suggested Mapping",
                                "used_for_field": field['field_id'],
                                "learned_from_formats": [],
                                "confidence": llm_confidence,
                                "mapping_method": "llm_suggested_targets",
                                "suggested_targets": valid_suggested
                            })

                            logger.debug(f"Field {field['field_id']} mapped via LLM suggestions: {valid_suggested}")
                            continue  # Successfully mapped, skip unmapped
                        else:
                            # LLM suggested targets but none were valid
                            logger.debug(f"LLM suggested targets {suggested_targets} for {field['field_id']} but none were valid")

                    # No semantic pattern, no similar field, no valid LLM suggestions - completely unmappable
                    unmapped_fields.append({
                        "field_id": field['field_id'],
                        "semantic_concept": field.get('semantic_concept', 'unknown'),
                        "reason": "No semantic pattern, similar field, or valid LLM suggestions",
                        "confidence": field.get('confidence', 0.0)
                    })

        # Add unmapped fields to semantic_usage for transparency
        if unmapped_fields:
            logger.warning(f"{len(unmapped_fields)} fields could not be mapped: {[f['field_id'] for f in unmapped_fields]}")
            for unmapped in unmapped_fields:
                semantic_usage.append({
                    "concept_id": "unmapped_field",
                    "concept_name": "⚠️ Unmapped Field",
                    "used_for_field": unmapped['field_id'],
                    "learned_from_formats": [],
                    "confidence": unmapped.get('confidence', 0.0),
                    "reason": unmapped['reason'],
                    "status": "unmapped"
                })

        return mappings, semantic_usage

    def _generate_mappings(
        self,
        field_analysis: Dict[str, Any],
        base_config: Dict[str, Any],
        target_format: str
    ) -> List[Dict[str, Any]]:
        """
        Generate mappings without tracking (for backward compatibility)
        """
        dummy_tracker = GenerationTracker()
        mappings, _ = self._generate_mappings_with_tracking(field_analysis, base_config, target_format, dummy_tracker)
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

    def _compare_with_base_config(self, new_config: Dict[str, Any], base_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compare generated config with base config to highlight differences

        Returns:
            Dictionary with additions, modifications, and preserved items
        """

        # Compare parser fields
        base_fields = set(base_config.get('parser', {}).get('fields', {}).keys())
        new_fields = set(new_config.get('parser', {}).get('fields', {}).keys())

        added_fields = sorted(new_fields - base_fields)
        removed_fields = sorted(base_fields - new_fields)
        common_fields = sorted(base_fields & new_fields)

        # Compare mappings
        base_mapping_sources = set(m['source'] for m in base_config.get('mappings', []))
        new_mapping_sources = set(m['source'] for m in new_config.get('mappings', []))

        added_mappings = []
        modified_mappings = []
        preserved_mappings = []

        # Create lookup for quick comparison
        base_mappings_dict = {m['source']: m for m in base_config.get('mappings', [])}
        new_mappings_dict = {m['source']: m for m in new_config.get('mappings', [])}

        for source in new_mapping_sources:
            if source not in base_mapping_sources:
                # New mapping
                new_mapping = new_mappings_dict[source]
                added_mappings.append({
                    "source": source,
                    "targets": new_mapping.get('targets', []),
                    "confidence": new_mapping.get('confidence', 1.0),
                    "processing_lane": new_mapping.get('processing_lane', 'RULES'),
                    "reason": "New field in format" if source.split('.')[0] in added_fields else "New mapping for existing field"
                })
            else:
                # Check if modified
                base_mapping = base_mappings_dict[source]
                new_mapping = new_mappings_dict[source]

                if (base_mapping.get('targets') != new_mapping.get('targets') or
                    base_mapping.get('transform') != new_mapping.get('transform') or
                    base_mapping.get('processing_lane') != new_mapping.get('processing_lane')):
                    # Modified
                    modified_mappings.append({
                        "source": source,
                        "base_targets": base_mapping.get('targets', []),
                        "new_targets": new_mapping.get('targets', []),
                        "base_lane": base_mapping.get('processing_lane', 'RULES'),
                        "new_lane": new_mapping.get('processing_lane', 'RULES'),
                        "confidence": new_mapping.get('confidence', 1.0)
                    })
                else:
                    # Preserved unchanged
                    preserved_mappings.append({
                        "source": source,
                        "targets": new_mapping.get('targets', [])
                    })

        # Summary statistics
        total_new_fields = len(added_fields)
        total_new_mappings = len(added_mappings)
        total_modified = len(modified_mappings)
        total_preserved = len(preserved_mappings)

        return {
            "base_config_id": base_config.get('_id'),
            "new_config_id": new_config.get('_id'),
            "summary": {
                "fields_added": total_new_fields,
                "fields_removed": len(removed_fields),
                "fields_preserved": len(common_fields),
                "mappings_added": total_new_mappings,
                "mappings_modified": total_modified,
                "mappings_preserved": total_preserved,
                "total_changes": total_new_fields + total_new_mappings + total_modified
            },
            "details": {
                "added_fields": [
                    {
                        "field_id": field_id,
                        "name": new_config['parser']['fields'][field_id].get('name', 'Unknown'),
                        "pattern": new_config['parser']['fields'][field_id].get('pattern', '')
                    }
                    for field_id in added_fields
                ],
                "removed_fields": removed_fields,
                "added_mappings": added_mappings,
                "modified_mappings": modified_mappings,
                "preserved_mappings": preserved_mappings[:5]  # Show first 5 only
            },
            "highlights": [
                f"✨ {total_new_fields} new field(s) discovered in {new_config.get('_id').split('_to_')[0]}",
                f"🆕 {total_new_mappings} new mapping(s) created",
                f"✏️ {total_modified} mapping(s) modified from base",
                f"✅ {total_preserved} mapping(s) preserved from {base_config.get('_id')}"
            ]
        }

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