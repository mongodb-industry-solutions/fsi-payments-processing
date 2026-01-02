"""Converter - Main orchestration service for payment format conversion"""

import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

from src.core import Extractor, Transformer, Builder
from src.services.mongodb_service import MongoDBService
from src.services.ai_lane_service import AILaneService
from src.exceptions import CountryValidationException
from src.validators import validate_country_rules

logger = logging.getLogger(__name__)


class Converter:
    """
    Main orchestration service for payment format conversion.
    
    Orchestrates the complete conversion flow:
    1. Load config from MongoDB
    2. Extract fields from source message
    3. Transform fields through 3 lanes (RULES/AI/HUMAN)
    4. Process AI fields
    5. Build output message
    6. Return results with metadata
    """
    
    def __init__(
        self,
        mongodb_service: MongoDBService,
        ai_lane_service: AILaneService,
        ai_confidence_threshold: float = 0.8
    ):
        """
        Initialize converter with required services.
        
        Args:
            mongodb_service: MongoDB service for config access
            ai_lane_service: AI service for AI lane processing
            ai_confidence_threshold: Threshold for human review (default: 0.8)
        """
        self.mongodb_service = mongodb_service
        self.ai_lane_service = ai_lane_service
        self.ai_confidence_threshold = ai_confidence_threshold
        
        # Initialize core components
        self.extractor = Extractor()
        self.transformer = Transformer(ai_confidence_threshold=ai_confidence_threshold)
        self.builder = Builder()
        
        logger.info("Converter initialized with AI confidence threshold: %.2f", ai_confidence_threshold)
    
    async def convert(
        self,
        source_format: str,
        target_format: str,
        message: str,
        request_id: Optional[str] = None,
        original_source_message: Optional[str] = None,
        conversion_run_id: Optional[str] = None,
        use_ai: bool = True
    ) -> Dict[str, Any]:
        """
        Convert a payment message from source to target format.

        NEW: Supports multi-hop JSON caching:
        - If target_format == "JSON": Save result to MongoDB
        - If source_format == "JSON": Check MongoDB for cached JSON first

        Args:
            source_format: Source format (e.g., "MT103")
            target_format: Target format (e.g., "pacs.008")
            message: Source message content
            request_id: Optional request ID for tracking
            original_source_message: Original source message for cache lookup (multi-hop)
            conversion_run_id: Optional unique ID for this conversion run (enables independence)
            use_ai: If True, use AI lane for unstructured fields. If False, use regex patterns.

        Returns:
            Dictionary containing:
            - converted_message: The converted output
            - processing_stats: Lane distribution and timing
            - confidence_scores: Per-field confidence
            - human_review_required: Boolean flag
            - fields_for_review: List of low-confidence fields
            - metadata: Additional processing information

        Raises:
            ValueError: If config not found or validation fails
            Exception: If conversion fails

        Example:
            result = await converter.convert("MT103", "pacs.008", message)
            print(result['converted_message'])
            print(result['processing_stats'])
        """
        start_time = datetime.utcnow()
        conversion_id = f"{source_format}_to_{target_format}"

        logger.info(f"Starting conversion: {conversion_id} (request_id: {request_id}, run_id: {conversion_run_id[:8] if conversion_run_id else 'N/A'}...)")

        # NEW: Check if we're converting FROM JSON and have cached data
        if source_format == "JSON" and conversion_run_id:
            cached = await self._get_cached_json(original_source_message, conversion_run_id)
            if cached:
                logger.info("✅ Using cached canonical JSON from previous hop")
                message = cached['json_data']
        
        try:
            # Step 1: Load configuration from MongoDB
            config = await self._load_config(conversion_id)
            
            # Step 2: Extract fields from source message
            extracted_fields = self._extract_fields(message, config['extract'])
            
            # Step 3: Transform fields through RULES and AI lanes
            internal_fields, ai_fields = self._transform_fields(
                extracted_fields,
                config['map'],
                use_ai=use_ai
            )
            
            # Step 4: Process AI fields
            ai_results = await self._process_ai_fields(ai_fields)
            
            # Step 5: Merge AI results with RULES results
            final_fields, confidence_scores = self._merge_results(
                internal_fields, 
                ai_results
            )
            
            # Step 6: Check for human review
            fields_for_review = self.transformer.check_human_review_needed(ai_results)
            
            # Step 7: Build output message
            output_format = self._detect_output_format(target_format)
            converted_message = self.builder.build(
                final_fields,
                config['output'],
                output_format
            )
            
            # Calculate processing time
            end_time = datetime.utcnow()
            processing_time = (end_time - start_time).total_seconds()
            
            # Compile processing statistics
            stats = self._compile_stats(
                extracted_fields=len(extracted_fields),
                rules_fields=len(internal_fields),
                ai_fields=len(ai_fields),
                total_fields=len(final_fields),
                processing_time=processing_time
            )
            
            logger.info(
                f"Conversion complete: {conversion_id} in {processing_time:.2f}s "
                f"(RULES: {len(internal_fields)}, AI: {len(ai_fields)})"
            )
            
            # Build detailed processing data
            detailed_processing = self._build_detailed_processing(
                config=config,
                extracted_fields=extracted_fields,
                internal_fields=internal_fields,
                ai_fields=ai_fields,
                ai_results=ai_results,
                confidence_scores=confidence_scores
            )

            # Build result
            result = {
                'conversion_id': conversion_id,
                'request_id': request_id,
                'converted_message': converted_message,
                'processing_stats': stats,
                'confidence_scores': confidence_scores,
                'human_review_required': len(fields_for_review) > 0,
                'fields_for_review': fields_for_review,
                'metadata': {
                    'source_format': source_format,
                    'target_format': target_format,
                    'timestamp': end_time.isoformat(),
                    'processing_time_seconds': processing_time
                },
                'detailed_processing': detailed_processing
            }
            
            # NEW: Save JSON if target is JSON (for multi-hop reuse)
            if target_format == "JSON":
                # Save to MongoDB FIRST (agent needs document to update)
                await self._save_canonical_json(
                    conversion_id=conversion_id,
                    source_message=message,
                    json_data=converted_message,
                    metadata=result['metadata'],
                    conversion_run_id=conversion_run_id
                )

                # Validate country-specific rules AFTER saving
                # Raises CountryValidationException if violated
                # Agent will update the saved document, then retry will use corrected version
                validate_country_rules(
                    canonical_json=json.loads(converted_message),
                    conversion_id=conversion_id,
                    source_format=source_format,
                    target_format=target_format,
                    conversion_run_id=conversion_run_id,
                    detailed_processing=detailed_processing
                )
            
            return result
            
        except Exception as e:
            logger.error(f"Conversion failed for {conversion_id}: {e}", exc_info=True)
            raise
    
    async def _load_config(self, conversion_id: str) -> Dict[str, Any]:
        """
        Load conversion configuration from MongoDB.
        
        Args:
            conversion_id: Configuration ID (e.g., "MT103_to_pacs.008")
            
        Returns:
            Configuration dictionary with extract, map, output
            
        Raises:
            ValueError: If config not found
        """
        config = await self.mongodb_service.get_config(conversion_id)
        
        if not config:
            raise ValueError(f"Configuration not found: {conversion_id}")
        
        # Validate config has required fields
        required_fields = ['extract', 'map', 'output']
        missing_fields = [f for f in required_fields if f not in config]
        
        if missing_fields:
            raise ValueError(
                f"Invalid configuration {conversion_id}: missing fields {missing_fields}"
            )
        
        logger.debug(f"Loaded config {conversion_id}: {len(config['map'])} mappings")
        return config
    
    def _extract_fields(
        self, 
        message: str, 
        patterns: Dict[str, str]
    ) -> Dict[str, Any]:
        """
        Extract fields from source message using regex patterns.
        
        Args:
            message: Source message content
            patterns: Field ID -> regex pattern mappings
            
        Returns:
            Dictionary of field_id -> extracted_value
        """
        extracted = self.extractor.extract(message, patterns)
        
        if not extracted:
            logger.warning("No fields extracted from message")
        
        logger.debug(f"Extracted {len(extracted)} fields")
        return extracted
    
    def _transform_fields(
        self,
        extracted_fields: Dict[str, Any],
        mappings: List[Dict],
        use_ai: bool = True
    ) -> tuple:
        """
        Transform fields through RULES and AI lanes.

        Args:
            extracted_fields: Extracted source fields
            mappings: Mapping configurations
            use_ai: If True, use AI lane. If False, use regex patterns for unstructured fields.

        Returns:
            Tuple of (internal_fields, ai_fields)
        """
        internal_fields, ai_fields = self.transformer.transform(
            extracted_fields,
            mappings,
            use_ai=use_ai
        )
        
        logger.debug(
            f"Transformed: {len(internal_fields)} RULES fields, "
            f"{len(ai_fields)} AI fields"
        )
        
        return internal_fields, ai_fields
    
    async def _process_ai_fields(
        self,
        ai_fields: List[Dict]
    ) -> Dict[str, Dict[str, Any]]:
        """
        Process fields through AI lane.

        Args:
            ai_fields: List of fields requiring AI processing

        Returns:
            Dictionary of target_field -> {confidence, data}
            Note: When target is a list (e.g., ["payment_purpose", "invoice_number"]),
            it's stored as a tuple key for hashability.
        """
        ai_results = {}

        for ai_field in ai_fields:
            target = ai_field['target']
            value = ai_field['value']
            field_type = ai_field['field_type']
            prompt = ai_field.get('prompt', '')

            # Convert list to tuple for use as dictionary key (lists aren't hashable)
            target_key = tuple(target) if isinstance(target, list) else target

            try:
                result = await self.ai_lane_service.extract_field(
                    input_text=value,
                    prompt=prompt if prompt else "",
                    field_type=field_type
                )

                ai_results[target_key] = result

                logger.debug(
                    f"AI processed {target}: confidence {result['confidence']:.2f}"
                )

            except Exception as e:
                logger.error(f"AI processing failed for {target}: {e}")
                # Use fallback - create data dict with first target if list
                fallback_key = target[0] if isinstance(target, list) else target
                ai_results[target_key] = {
                    'confidence': 0.3,
                    'data': {fallback_key: value},  # Raw value as fallback
                    'error': str(e)
                }

        return ai_results
    
    def _merge_results(
        self,
        internal_fields: Dict[str, Any],
        ai_results: Dict[str, Dict[str, Any]]
    ) -> tuple:
        """
        Merge RULES and AI lane results.
        
        Args:
            internal_fields: RULES lane results
            ai_results: AI lane results
            
        Returns:
            Tuple of (final_fields, confidence_scores)
        """
        final_fields = internal_fields.copy()
        confidence_scores = {}
        
        # Add confidence 1.0 for all RULES fields
        for field in internal_fields.keys():
            confidence_scores[field] = 1.0
        
        # Merge AI results
        for target_key, result in ai_results.items():
            data = result.get('data', {})
            confidence = result.get('confidence', 0.0)

            # If data has the target field, use it
            if isinstance(data, dict):
                for key, value in data.items():
                    final_fields[key] = value
                    confidence_scores[key] = confidence
            else:
                # Simple value - target_key might be tuple, use first element
                if isinstance(target_key, tuple):
                    final_fields[target_key[0]] = data
                    confidence_scores[target_key[0]] = confidence
                else:
                    final_fields[target_key] = data
                    confidence_scores[target_key] = confidence
        
        logger.debug(f"Merged results: {len(final_fields)} total fields")
        return final_fields, confidence_scores
    
    def _detect_output_format(self, target_format: str) -> str:
        """
        Detect output format type (xml or json).
        
        Args:
            target_format: Target format name
            
        Returns:
            "xml" or "json"
        """
        # ISO 20022 formats are XML
        if target_format.startswith('pacs.') or target_format.startswith('pain.'):
            return 'xml'
        
        # JSON format
        if target_format.lower() == 'json':
            return 'json'
        
        # Default to XML for most payment formats
        return 'xml'
    
    def _compile_stats(
        self,
        extracted_fields: int,
        rules_fields: int,
        ai_fields: int,
        total_fields: int,
        processing_time: float
    ) -> Dict[str, Any]:
        """
        Compile processing statistics.
        
        Args:
            extracted_fields: Number of fields extracted
            rules_fields: Number of RULES lane fields
            ai_fields: Number of AI lane fields
            total_fields: Total output fields
            processing_time: Processing time in seconds
            
        Returns:
            Statistics dictionary
        """
        return {
            'extracted_fields': extracted_fields,
            'rules_fields': rules_fields,
            'ai_fields': ai_fields,
            'total_fields': total_fields,
            'processing_time_seconds': round(processing_time, 3),
            'lane_distribution': {
                'RULES': rules_fields,
                'AI': ai_fields,
                'HUMAN': 0  # Will be determined by confidence threshold
            },
            'lane_percentages': {
                'RULES': round((rules_fields / total_fields * 100) if total_fields > 0 else 0, 1),
                'AI': round((ai_fields / total_fields * 100) if total_fields > 0 else 0, 1)
            }
        }

    def _build_detailed_processing(
        self,
        config: Dict[str, Any],
        extracted_fields: Dict[str, Any],
        internal_fields: Dict[str, Any],
        ai_fields: List[Dict],
        ai_results: Dict[str, Dict[str, Any]],
        confidence_scores: Dict[str, float]
    ) -> Dict[str, Any]:
        """
        Build detailed processing data for frontend visualization.

        Args:
            config: Conversion configuration
            extracted_fields: Extracted source fields
            internal_fields: RULES lane transformed fields
            ai_fields: AI lane field definitions
            ai_results: AI lane processing results
            confidence_scores: Field confidence scores

        Returns:
            Detailed processing dict with extraction, rules_lane, ai_lane, and configuration
        """
        # Build extraction details
        extraction_patterns = config.get('extract', {})
        extraction_details = {
            'total_fields': len(extracted_fields),
            'fields': [
                {
                    'field_id': field_id,
                    'value': str(value)[:200] if value else '',  # Limit for frontend display
                    'pattern': extraction_patterns.get(field_id, ''),
                    'extracted': True
                }
                for field_id, value in extracted_fields.items()
            ]
        }

        # Build rules lane details
        mappings = config.get('map', [])
        rules_lane_details = {
            'total_fields': len(internal_fields),
            'fields': []
        }

        # Match internal fields to their source mappings
        for mapping in mappings:
            # Skip AI lane mappings
            if mapping.get('processing_lane') == 'AI':
                continue

            # Handle different schema field names (from/to vs source/targets)
            source_field = mapping.get('from', mapping.get('source', mapping.get('source_field', '')))
            targets = mapping.get('to', mapping.get('targets', [mapping.get('target_field', '')]))
            if isinstance(targets, str):
                targets = [targets]
            elif not isinstance(targets, list):
                targets = [targets] if targets else []

            transform_type = mapping.get('transform', 'direct_copy')
            input_value = extracted_fields.get(source_field, '')

            # Find output values in internal_fields
            output_value = {}
            for target in targets:
                if target in internal_fields:
                    output_value[target] = internal_fields[target]

            rules_lane_details['fields'].append({
                'source_field': source_field,
                'target_field': targets,
                'transform_type': transform_type,
                'transform_config': mapping.get('transform_config', {}),
                'input_value': str(input_value)[:100] if input_value else '',
                'output_value': output_value,
                'confidence': 1.0
            })

        # Build AI lane details
        ai_lane_details = {
            'total_fields': len(ai_fields),
            'fields': []
        }

        for ai_field in ai_fields:
            target = ai_field['target']
            source_field = ai_field.get('source', '')
            input_text = ai_field['value']
            field_type = ai_field['field_type']

            # Get AI result - convert list to tuple for lookup (ai_results uses tuple keys)
            target_key = tuple(target) if isinstance(target, list) else target
            ai_result = ai_results.get(target_key, {})
            confidence = ai_result.get('confidence', 0.0)
            ai_response = ai_result.get('data', {})

            ai_lane_details['fields'].append({
                'source_field': source_field,
                'target_field': target,
                'field_type': field_type,
                'input_text': str(input_text)[:200] if input_text else '',
                'ai_response': ai_response,
                'confidence': confidence,
                'confidence_reason': self._get_confidence_reason(confidence, ai_response if isinstance(ai_response, dict) else {})
            })

        # Return detailed processing structure
        return {
            'extraction': extraction_details,
            'rules_lane': rules_lane_details,
            'ai_lane': ai_lane_details,
            'configuration': config  # Include full MongoDB config for "View Config" button
        }

    def _get_confidence_reason(self, confidence: float, data: Dict) -> str:
        """
        Get human-readable reason for confidence score.

        Args:
            confidence: Confidence score (0.0-1.0)
            data: Extracted data

        Returns:
            Reason string
        """
        if confidence >= 0.90:
            field_count = len([v for v in data.values() if v and str(v).strip()])
            return f"Excellent extraction ({field_count} fields, structured data)"
        elif confidence >= 0.85:
            return "Good extraction (complete, simple structure)"
        elif confidence >= 0.80:
            return "Minimal but complete extraction"
        elif confidence >= 0.50:
            return "Partial extraction with low confidence"
        else:
            return "Failed extraction or no meaningful data"

    async def _save_canonical_json(
        self,
        conversion_id: str,
        source_message: str,
        json_data: str,
        metadata: Dict[str, Any],
        conversion_run_id: Optional[str] = None
    ) -> None:
        """
        Save canonical JSON to MongoDB for multi-hop reuse.

        Args:
            conversion_id: Conversion ID (e.g., "MT103_to_JSON")
            source_message: Original source message
            json_data: Canonical JSON string
            metadata: Conversion metadata
            conversion_run_id: Optional unique ID for this conversion run
        """
        try:
            doc_id = await self.mongodb_service.save_canonical_json(
                conversion_id=conversion_id,
                source_message=source_message,
                json_data=json_data,
                metadata=metadata,
                conversion_run_id=conversion_run_id
            )
            logger.info(f"💾 Saved canonical JSON to MongoDB: {doc_id[:16]}...")
        except Exception as e:
            logger.error(f"Failed to save canonical JSON: {e}")
            # Don't fail conversion if caching fails

    async def _get_cached_json(
        self,
        source_message: str,
        conversion_run_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieve cached canonical JSON from MongoDB.

        Args:
            source_message: Original source message
            conversion_run_id: Optional unique ID for this conversion run

        Returns:
            Cached document or None if not found
        """
        try:
            return await self.mongodb_service.get_canonical_json(
                source_message,
                conversion_run_id=conversion_run_id
            )
        except Exception as e:
            logger.error(f"Failed to retrieve cached JSON: {e}")
            return None


# Singleton pattern
_converter_instance: Optional[Converter] = None


def get_converter(
    mongodb_service: MongoDBService,
    ai_lane_service: AILaneService,
    ai_confidence_threshold: float = 0.8
) -> Converter:
    """
    Get or create Converter singleton instance.
    
    Args:
        mongodb_service: MongoDB service
        ai_lane_service: AI lane service
        ai_confidence_threshold: Confidence threshold
        
    Returns:
        Converter instance
    """
    global _converter_instance
    
    if _converter_instance is None:
        _converter_instance = Converter(
            mongodb_service=mongodb_service,
            ai_lane_service=ai_lane_service,
            ai_confidence_threshold=ai_confidence_threshold
        )
    
    return _converter_instance
