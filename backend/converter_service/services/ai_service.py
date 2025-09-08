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
        self.prompt_templates = self.ai_config.get('prompt_templates', {})
        self.confidence_config = self.ai_config.get('confidence_config', {})
        self.hybrid_model = self.confidence_config.get('hybrid_model', {})
        self.validation_rules = self.confidence_config.get('validation_rules', {})
        self.fallback_confidence = self.confidence_config.get('fallback_confidence', {})
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
        
        # Build prompt based on field type
        prompt = self._build_prompt(field_value, field_type, prompt_template)
        
        try:
            # Call Claude Haiku for fast, cheap extraction
            response = self.client.invoke_model(
                modelId="anthropic.claude-3-haiku-20240307-v1:0",
                body=json.dumps({
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": 500,
                    "temperature": 0.1,  # Low temperature for consistent extraction
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
            
            # Clean the data (remove confidence_scores from actual data)
            clean_data = {k: v for k, v in extracted_data.items() 
                          if k != 'confidence_scores'}
            
            return {
                "success": True,
                "data": clean_data,
                "confidence": confidence,
                "field_confidences": field_confidences,  # Individual field confidences
                "model": "claude-3-haiku",
                "processing_lane": "AI"
            }
            
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
        Calculate hybrid confidence combining AI and validation scores
        """
        # 1. Get AI's self-reported confidence
        ai_confidence_scores = extracted_data.get('confidence_scores', {})
        ai_overall_confidence = ai_confidence_scores.get('overall', None)
        
        
        # 2. Calculate validation confidence
        # Remove confidence_scores for validation
        extracted_data_clean = {k: v for k, v in extracted_data.items() 
                               if k != 'confidence_scores'}
        validation_confidence = self._calculate_validation_confidence(
            extracted_data_clean, field_type
        )
        
        # 3. Combine using configured weights
        if self.hybrid_model.get('enabled', False) and ai_overall_confidence is not None:
            weights = self.hybrid_model.get('weights', {})
            ai_weight = weights.get('ai_confidence', 0.7)
            val_weight = weights.get('validation_confidence', 0.3)
            
            final_confidence = (
                ai_overall_confidence * ai_weight + 
                validation_confidence * val_weight
            )
        else:
            # Fallback to validation-only if no AI confidence
            final_confidence = validation_confidence
        
        return round(final_confidence, 2)
    
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
    
    def _fallback_extraction(self, field_value: str, field_type: str) -> Dict[str, Any]:
        """
        Fallback extraction when AI is not available.
        Uses simple rules-based extraction.
        """
        
        result = {
            "success": False,
            "data": {},
            "confidence": 0.5,
            "model": "rules_fallback",
            "processing_lane": "RULES"
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