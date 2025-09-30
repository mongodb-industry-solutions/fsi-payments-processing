"""
Simple Bedrock Service for AI field processing
Minimal implementation for demo purposes
"""

import json
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class BedrockService:
    """
    Simple Bedrock client for AI field processing in payment conversion.
    """
    
    def __init__(self, region: str = "us-east-1", ai_config: Dict = None):
        """
        Initialize Bedrock service.
        
        Args:
            region: AWS region for Bedrock
            ai_config: Full AI configuration from MongoDB including prompt templates
        """
        self.region = region
        self.ai_config = ai_config or {}
        
        # Support both new field_types structure and old prompt_templates structure
        if 'field_types' in self.ai_config:
            # New structure: extract prompt_templates and validation_rules from field_types
            self.field_types = self.ai_config['field_types']
            self.prompt_templates = {}
            self.validation_rules = {}
            for field_type, config in self.field_types.items():
                if 'prompt_template' in config:
                    self.prompt_templates[field_type] = config['prompt_template']
                if 'validation_rules' in config:
                    self.validation_rules[field_type] = config['validation_rules']
            logger.info(f"Using new field_types structure with {len(self.field_types)} field types")
        else:
            # Old structure: use prompt_templates directly
            self.field_types = {}
            self.prompt_templates = self.ai_config.get('prompt_templates', {})
            self.validation_rules = self.ai_config.get('confidence_config', {}).get('validation_rules', {})
            logger.info("Using legacy prompt_templates structure")
        
        self.confidence_config = self.ai_config.get('confidence_config', {})
        self.hybrid_model = self.confidence_config.get('hybrid_model', {})
        # If validation_rules not set from field_types, get from confidence_config
        if not self.validation_rules:
            self.validation_rules = self.confidence_config.get('validation_rules', {})
        self.fallback_confidence = self.confidence_config.get('fallback_confidence', {})
        self.models = self.ai_config.get('models', {})
        self.client = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize boto3 Bedrock client"""
        try:
            import boto3
            self.client = boto3.client(
                'bedrock-runtime',
                region_name=self.region
            )
            logger.info(f"Initialized Bedrock client in region {self.region}")
        except Exception as e:
            logger.error(f"Failed to initialize Bedrock client: {e}")
            self.client = None
    
    def _select_model_for_field(self, field_value: str, field_type: str) -> tuple:
        """
        Select the appropriate model based on field complexity.
        
        Args:
            field_value: The field content to analyze
            field_type: Type of field for logging
            
        Returns:
            Tuple of (model_name, model_config)
        """
        # Calculate complexity metrics
        lines = len(field_value.split('\n'))
        chars = len(field_value)
        
        logger.info(f"Field {field_type} complexity: {lines} lines, {chars} chars")
        
        # If no models configured, use defaults
        if not self.models:
            logger.warning("No models configured, using hardcoded defaults")
            return "claude-3-haiku", {
                "model_id": "anthropic.claude-3-haiku-20240307-v1:0",
                "max_tokens": 1000,
                "temperature": 0.1
            }
        
        # Check each model's complexity threshold (ordered by preference)
        for model_name in ["claude-3-haiku", "claude-3-sonnet"]:
            if model_name not in self.models:
                continue
                
            config = self.models[model_name]
            threshold = config.get('complexity_threshold', {})
            max_lines = threshold.get('lines', 999)
            max_chars = threshold.get('chars', 9999)
            
            if lines <= max_lines and chars <= max_chars:
                logger.info(f"Selected {model_name} for field {field_type}")
                return model_name, config
        
        # Default to most capable model if available
        if "claude-3-sonnet" in self.models:
            logger.info(f"Defaulting to claude-3-sonnet for complex field {field_type}")
            return "claude-3-sonnet", self.models["claude-3-sonnet"]
        
        # Fallback to haiku if nothing else
        logger.warning(f"No suitable model found, using haiku for field {field_type}")
        return "claude-3-haiku", self.models.get("claude-3-haiku", {
            "model_id": "anthropic.claude-3-haiku-20240307-v1:0",
            "max_tokens": 1000,
            "temperature": 0.1
        })
    
    def extract_field_data(self, field_value: str, field_type: str, prompt_template: str = None) -> Dict[str, Any]:
        """
        Extract structured data from a field using AI.
        
        Args:
            field_value: The raw field value to process
            field_type: Type of field (e.g., "remittance", "party_details")
            prompt_template: Optional custom prompt template
            
        Returns:
            Dictionary with extracted data and confidence score
        """
        
        if not self.client:
            # Fallback if Bedrock not available
            return self._fallback_extraction(field_value, field_type)
        
        # Select model based on field complexity
        model_name, model_config = self._select_model_for_field(field_value, field_type)
        
        # Build prompt based on field type
        prompt = self._build_prompt(field_value, field_type, prompt_template)
        
        try:
            # Call selected model with its configuration
            response = self.client.invoke_model(
                modelId=model_config.get("model_id", "anthropic.claude-3-haiku-20240307-v1:0"),
                body=json.dumps({
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": model_config.get("max_tokens", 1000),
                    "temperature": model_config.get("temperature", 0.1),
                    "messages": [
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ]
                })
            )
            
            # Parse response
            response_body = json.loads(response['body'].read())
            ai_response = response_body.get('content', [{}])[0].get('text', '{}')
            
            # Try to parse as JSON
            try:
                # Clean response: strip any text before the first { or [
                import re
                json_match = re.search(r'[{\[].*[}\]]', ai_response, re.DOTALL)
                if json_match:
                    cleaned_response = json_match.group(0)
                else:
                    cleaned_response = ai_response
                
                extracted_data = json.loads(cleaned_response)
            except json.JSONDecodeError:
                # If not JSON, treat as plain text
                extracted_data = {"extracted_text": ai_response}
            
            # Use hybrid confidence calculation
            confidence = self._calculate_hybrid_confidence(extracted_data, field_type)
            
            # Store field-level confidence if provided by AI
            field_confidences = extracted_data.get('confidence_scores', {})
            
            # Check if AI retry is enabled via environment variable
            import os
            enable_ai_retry = os.getenv('ENABLE_AI_RETRY', 'false').lower() == 'true'
            
            # If confidence is low and we're not already using the best model, retry (if enabled)
            if enable_ai_retry and confidence < 0.7 and model_name == "claude-3-haiku" and "claude-3-sonnet" in self.models:
                logger.info(f"Low confidence {confidence:.2f} with {model_name}, retrying with claude-3-sonnet")
                # Force selection of Sonnet
                better_model = "claude-3-sonnet"
                better_config = self.models["claude-3-sonnet"]
                
                # Retry with better model
                retry_response = self.client.invoke_model(
                    modelId=better_config.get("model_id"),
                    body=json.dumps({
                        "anthropic_version": "bedrock-2023-05-31",
                        "max_tokens": better_config.get("max_tokens", 2000),
                        "temperature": better_config.get("temperature", 0.1),
                        "messages": [
                            {
                                "role": "user",
                                "content": prompt
                            }
                        ]
                    })
                )
                
                retry_body = json.loads(retry_response['body'].read())
                retry_ai_response = retry_body.get('content', [{}])[0].get('text', '{}')
                
                # Try to parse retry response
                try:
                    json_match = re.search(r'[{\[].*[}\]]', retry_ai_response, re.DOTALL)
                    if json_match:
                        cleaned_retry = json_match.group(0)
                    else:
                        cleaned_retry = retry_ai_response
                    
                    extracted_data = json.loads(cleaned_retry)
                    confidence = self._calculate_hybrid_confidence(extracted_data, field_type)
                    field_confidences = extracted_data.get('confidence_scores', {})
                    model_name = better_model
                    logger.info(f"Retry with {model_name} achieved confidence: {confidence:.2f}")
                except:
                    # If retry fails, keep original result
                    logger.warning(f"Retry with {better_model} failed to parse, keeping original")
            
            # Clean the data (remove confidence_scores from actual data)
            clean_data = {k: v for k, v in extracted_data.items() 
                          if k != 'confidence_scores'}
            
            # Add reasoning if demo mode is enabled
            result = {
                "success": True,
                "data": clean_data,
                "confidence": confidence,
                "field_confidences": field_confidences,  # Individual field confidences
                "model": model_name,
                "processing_lane": "AI"
            }
            
            # Capture AI reasoning for demo mode
            import os
            if os.getenv('SHOW_AI_REASONING', 'false').lower() == 'true':
                result["ai_reasoning"] = self._capture_reasoning(
                    field_type=field_type,
                    model_name=model_name,
                    model_config=model_config,
                    prompt=prompt[:500],  # First 500 chars of prompt
                    ai_response=ai_response[:500],  # First 500 chars of response
                    confidence=confidence,
                    field_value_length=len(field_value)
                )
            
            return result
            
        except Exception as e:
            logger.error(f"Bedrock API call failed: {e}")
            return self._fallback_extraction(field_value, field_type)
    
    def _build_prompt(self, field_value: str, field_type: str, custom_template: str = None) -> str:
        """Build prompt for AI extraction using MongoDB-configured prompts"""
        
        # Use custom template if provided (highest priority)
        if custom_template:
            return custom_template.replace("{{field_value}}", field_value)
        
        # Use MongoDB-configured template for field type
        if field_type in self.prompt_templates:
            template = self.prompt_templates[field_type]
            return template.replace('{{field_value}}', field_value)
        
        # Fall back to MongoDB default template
        if 'default' in self.prompt_templates:
            template = self.prompt_templates['default']
            return template.replace('{{field_value}}', field_value)
        
        # Last resort fallback (minimal prompt)
        return f"""Extract key information from this field:

{field_value}

Return a JSON object with the main data elements you can identify."""
    
    def _calculate_hybrid_confidence(self, extracted_data: Dict, field_type: str) -> float:
        """
        Calculate confidence based on extraction success, ignoring AI's self-reported confidence
        """
        # Check if extraction was successful
        if not extracted_data or extracted_data == {}:
            # Failed extraction - use low confidence
            logger.debug(f"Field {field_type}: Empty extraction, confidence = 0.3")
            return 0.3

        # Clean data for assessment (remove metadata)
        extracted_data_clean = {k: v for k, v in extracted_data.items()
                               if k not in ['confidence_scores', 'processing_metadata']}

        # Calculate confidence based on extraction quality
        confidence = self._calculate_extraction_confidence(extracted_data_clean, field_type)

        logger.info(f"Field {field_type}: Extraction confidence = {confidence:.2f} based on {len(extracted_data_clean)} fields")

        return round(confidence, 2)
    
    def _calculate_extraction_confidence(self, extracted_data: Dict, field_type: str) -> float:
        """
        Calculate confidence based on extraction quality
        Generic implementation that works for any format
        """
        if not extracted_data:
            return 0.3

        # Count meaningful fields extracted
        meaningful_fields = 0
        total_content_length = 0
        has_lists = False
        has_structured_data = False

        for key, value in extracted_data.items():
            # Skip empty values
            if not value:
                continue

            # Count meaningful fields based on content type
            if isinstance(value, str):
                if value.strip():
                    meaningful_fields += 1
                    total_content_length += len(value.strip())
            elif isinstance(value, list):
                has_lists = True
                if any(v for v in value if v):  # Non-empty list with content
                    meaningful_fields += 1
                    total_content_length += sum(len(str(v)) for v in value if v)
                    has_structured_data = True
            elif isinstance(value, dict):
                if value:  # Non-empty dict
                    meaningful_fields += 1
                    has_structured_data = True

        # Calculate confidence based on extraction quality
        # Progressive confidence based on extraction completeness
        # Simple complete extractions get high confidence
        # Complex partial extractions get moderate confidence

        if meaningful_fields == 0:
            # No meaningful data extracted
            return 0.3

        # Check for Ustrd field (common for remittance info)
        # If it's a single-line Ustrd, it's likely a complete simple extraction
        has_ustrd = 'Ustrd' in extracted_data
        ustrd_lines = 0
        if has_ustrd and isinstance(extracted_data.get('Ustrd'), list):
            ustrd_lines = len([line for line in extracted_data['Ustrd'] if line])

        # For simple single-line extractions that appear complete
        if meaningful_fields == 1 and total_content_length < 10:
            # Very minimal (e.g., just "PAY") - but if that's all there was, it's complete
            return 0.80  # Higher confidence for complete simple extraction

        elif meaningful_fields == 1 and total_content_length < 50:
            # Single field with modest content (e.g., "PAYMENT FOR SERVICES")
            # This is likely a complete extraction of simple input
            return 0.85  # High confidence for complete simple extraction

        elif has_ustrd and ustrd_lines == 1 and meaningful_fields <= 2:
            # Single-line Ustrd with maybe one other field - simple complete extraction
            return 0.85

        elif meaningful_fields == 2 and not has_structured_data:
            # Two fields but simple data - good extraction
            return 0.80

        elif has_ustrd and ustrd_lines > 1:
            # Multi-line Ustrd - complex extraction
            if meaningful_fields >= 3:
                # Multiple lines plus other fields - excellent
                return 0.90
            else:
                # Just multi-line Ustrd - very good
                return 0.85

        elif meaningful_fields >= 2 and has_structured_data:
            # Multiple fields with structured data - high confidence
            return 0.85

        elif meaningful_fields >= 3:
            # Many fields extracted - excellent extraction
            return 0.90

        elif meaningful_fields >= 2:
            # Multiple fields extracted - good extraction
            return 0.80

        else:
            # Default case: some extraction success
            return 0.75

    def _has_main_output_fields(self, extracted_data: Dict, field_type: str) -> bool:
        """
        Check if the main output fields for this field type are present
        Generic implementation - just checks if we have any meaningful data
        """
        if not extracted_data:
            return False

        # Generic check - if we have any non-empty data, consider it successful
        for key, value in extracted_data.items():
            # Skip metadata fields
            if key in ['confidence_scores', 'processing_metadata']:
                continue

            # Check if field has meaningful content
            if value and (
                (isinstance(value, str) and value.strip()) or
                (isinstance(value, list) and len(value) > 0 and any(v for v in value if v)) or
                (isinstance(value, dict) and len(value) > 0)
            ):
                return True

        return False

    def _calculate_validation_confidence(self, extracted_data: Dict, field_type: str) -> float:
        """
        Calculate confidence based on validation rules from MongoDB
        """
        import re
        
        if field_type not in self.validation_rules:
            # Use simple presence check
            return self.fallback_confidence.get('no_ai_confidence', 0.5) if extracted_data else self.fallback_confidence.get('extraction_failed', 0.3)
        
        rules = self.validation_rules[field_type]
        expected_fields = rules.get('expected_fields', [])
        field_patterns = rules.get('field_patterns', {})
        
        if not expected_fields:
            return self.fallback_confidence.get('no_ai_confidence', 0.5) if extracted_data else self.fallback_confidence.get('extraction_failed', 0.3)
        
        # Base confidence from field presence
        present_fields = sum(1 for f in expected_fields if extracted_data.get(f))
        base_confidence = present_fields / len(expected_fields) if expected_fields else 0.5
        
        # Apply pattern matching boosts/penalties
        pattern_boost = 0
        for field, pattern in field_patterns.items():
            if field in extracted_data:
                try:
                    if re.match(pattern, str(extracted_data[field])):
                        pattern_boost += rules.get('boost_if_matches', 0.1)
                except:
                    pass  # Skip if pattern matching fails
        
        # Apply missing field penalties
        missing_penalty = 0
        missing_count = len(expected_fields) - present_fields
        if missing_count > 0:
            missing_penalty = missing_count * rules.get('penalty_if_missing', 0.2) / len(expected_fields)
        
        final_confidence = base_confidence + pattern_boost - missing_penalty
        return max(0.0, min(1.0, final_confidence))
    
    def _capture_reasoning(self, **kwargs) -> Dict[str, Any]:
        """
        Capture AI reasoning details for demo visualization.
        Only called when SHOW_AI_REASONING flag is enabled.
        
        Args:
            field_type: Type of field being processed
            model_name: Name of model used
            model_config: Model configuration
            prompt: Prompt sent to AI (truncated)
            ai_response: AI response (truncated)
            confidence: Calculated confidence score
            field_value_length: Length of original field value
            
        Returns:
            Dictionary with reasoning details
        """
        
        reasoning = {
            "field_type": kwargs.get("field_type"),
            "model_selection": {
                "model_used": kwargs.get("model_name"),
                "model_id": kwargs.get("model_config", {}).get("model_id"),
                "temperature": kwargs.get("model_config", {}).get("temperature"),
                "max_tokens": kwargs.get("model_config", {}).get("max_tokens"),
                "selection_reason": self._get_model_selection_reason(
                    kwargs.get("field_value_length", 0),
                    kwargs.get("model_name")
                )
            },
            "complexity_analysis": {
                "field_length": kwargs.get("field_value_length", 0),
                "complexity_level": self._get_complexity_level(kwargs.get("field_value_length", 0)),
                "processing_difficulty": self._estimate_difficulty(kwargs.get("field_type"))
            },
            "prompt_details": {
                "template_used": f"{kwargs.get('field_type')}_template",
                "prompt_preview": kwargs.get("prompt", "")[:200] + "..." if len(kwargs.get("prompt", "")) > 200 else kwargs.get("prompt", "")
            },
            "response_analysis": {
                "response_preview": kwargs.get("ai_response", "")[:200] + "..." if len(kwargs.get("ai_response", "")) > 200 else kwargs.get("ai_response", ""),
                "confidence_achieved": kwargs.get("confidence"),
                "confidence_factors": self._get_confidence_factors(kwargs.get("confidence", 0))
            },
            "processing_metadata": {
                "timestamp": __import__('datetime').datetime.now().isoformat(),
                "retry_attempted": "claude-3-sonnet" in kwargs.get("model_name", "") and kwargs.get("confidence", 0) > 0.7
            }
        }
        
        return reasoning
    
    def _get_model_selection_reason(self, field_length: int, model_name: str) -> str:
        """Get reason for model selection"""
        
        if field_length < 500:
            return f"Selected {model_name} for simple field (< 500 chars)"
        elif field_length < 2000:
            return f"Selected {model_name} for moderate complexity field (500-2000 chars)"
        else:
            return f"Selected {model_name} for complex field (> 2000 chars)"
    
    def _get_complexity_level(self, field_length: int) -> str:
        """Determine complexity level based on field length"""
        
        if field_length < 200:
            return "simple"
        elif field_length < 500:
            return "moderate"
        elif field_length < 1000:
            return "complex"
        else:
            return "very_complex"
    
    def _estimate_difficulty(self, field_type: str) -> str:
        """Estimate processing difficulty for field type"""
        
        difficult_types = ["remittance", "party_details", "charges_details"]
        moderate_types = ["payment_purpose", "regulatory_reporting"]
        
        if field_type in difficult_types:
            return "high"
        elif field_type in moderate_types:
            return "medium"
        else:
            return "low"
    
    def _get_confidence_factors(self, confidence: float) -> Dict[str, Any]:
        """Get factors affecting confidence score"""
        
        factors = {
            "score_range": "high" if confidence >= 0.9 else "medium" if confidence >= 0.7 else "low",
            "likely_factors": []
        }
        
        if confidence >= 0.9:
            factors["likely_factors"] = [
                "All expected fields present",
                "Pattern matching successful",
                "High structural consistency"
            ]
        elif confidence >= 0.7:
            factors["likely_factors"] = [
                "Most expected fields present",
                "Partial pattern matching",
                "Acceptable structure"
            ]
        else:
            factors["likely_factors"] = [
                "Missing expected fields",
                "Limited pattern matching",
                "Uncertain structure"
            ]
        
        return factors
    
    def _fallback_extraction(self, field_value: str, field_type: str) -> Dict[str, Any]:
        """
        Fallback extraction when AI is not available.
        Uses simple rules-based extraction as a fallback strategy.
        """
        
        result = {
            "success": True,  # Fallback is a valid strategy, not a failure
            "data": {},
            "confidence": 0.5,
            "model": "rules_fallback",
            "processing_lane": "AI",  # Still part of AI lane, just using fallback
            "fallback_used": True  # Flag to indicate fallback was used
        }
        
        if field_type == "remittance":
            # Simple pattern matching for common fields
            lines = field_value.split('\n')
            data = {}
            
            for line in lines:
                line_upper = line.upper()
                if 'INVOICE' in line_upper or 'INV-' in line:
                    # Try to extract invoice number
                    import re
                    inv_match = re.search(r'(INV-\d{4}-\d+|\d{4}-\d+)', line)
                    if inv_match:
                        data['invoice_number'] = inv_match.group(1)
                if 'PAYMENT FOR' in line_upper:
                    data['payment_purpose'] = line.split('PAYMENT FOR')[-1].strip()
            
            data['summary'] = ' '.join(lines[:2])[:140]  # First two lines, max 140 chars
            result['data'] = data
            
        elif field_type == "party_details":
            lines = field_value.split('\n')
            data = {}
            
            if lines and lines[0].startswith('/'):
                data['account'] = lines[0][1:]
                data['name'] = lines[1] if len(lines) > 1 else ''
                data['address'] = ', '.join(lines[2:]) if len(lines) > 2 else ''
            else:
                data['name'] = lines[0] if lines else ''
                data['address'] = ', '.join(lines[1:]) if len(lines) > 1 else ''
            
            result['data'] = data
        
        return result


# Singleton instance for reuse
_bedrock_instance = None

def get_bedrock_service(region: str = "us-east-1") -> BedrockService:
    """Get or create a Bedrock service instance"""
    global _bedrock_instance
    if _bedrock_instance is None:
        _bedrock_instance = BedrockService(region)
    return _bedrock_instance