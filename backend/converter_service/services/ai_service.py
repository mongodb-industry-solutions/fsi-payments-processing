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
    
    def __init__(self, region: str = "us-east-1"):
        """
        Initialize Bedrock service.
        
        Args:
            region: AWS region for Bedrock
        """
        self.region = region
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
                extracted_data = json.loads(ai_response)
            except json.JSONDecodeError:
                # If not JSON, treat as plain text
                extracted_data = {"extracted_text": ai_response}
            
            # Add confidence score (would be calculated based on model's confidence)
            confidence = self._calculate_confidence(extracted_data, field_type)
            
            return {
                "success": True,
                "data": extracted_data,
                "confidence": confidence,
                "model": "claude-3-haiku",
                "processing_lane": "AI"
            }
            
        except Exception as e:
            logger.error(f"Bedrock API call failed: {e}")
            return self._fallback_extraction(field_value, field_type)
    
    def _build_prompt(self, field_value: str, field_type: str, custom_template: str = None) -> str:
        """Build prompt for AI extraction"""
        
        if custom_template:
            return custom_template.replace("{{field_value}}", field_value)
        
        # Default prompts for different field types
        prompts = {
            "remittance": f"""Extract structured information from this payment remittance text:

{field_value}

Return a JSON object with these fields:
- invoice_number: The invoice number if present
- payment_purpose: Brief description of what the payment is for
- amount: Any amount mentioned
- reference_numbers: List of any reference numbers (PO, contract, etc.)
- summary: One-line summary (max 140 chars)

Example output:
{{"invoice_number": "INV-2024-001", "payment_purpose": "Electronic components", "reference_numbers": ["PO-12345"], "summary": "Payment for electronic components, INV-2024-001"}}""",
            
            "party_details": f"""Extract party information from this SWIFT field:

{field_value}

Return a JSON object with:
- account: Account number (remove leading /)
- name: Party name
- address: Full address as single string
- country: Country if identifiable

Be precise and extract only what's clearly present.""",
            
            "default": f"""Extract key information from this field:

{field_value}

Return a JSON object with the main data elements you can identify."""
        }
        
        return prompts.get(field_type, prompts["default"])
    
    def _calculate_confidence(self, extracted_data: Dict, field_type: str) -> float:
        """
        Calculate confidence score for extracted data.
        
        Simple heuristic: Check if expected fields are present and non-empty.
        """
        
        if field_type == "remittance":
            expected_fields = ["invoice_number", "payment_purpose", "summary"]
            present_fields = sum(1 for f in expected_fields if extracted_data.get(f))
            confidence = present_fields / len(expected_fields)
        elif field_type == "party_details":
            expected_fields = ["account", "name", "address"]
            present_fields = sum(1 for f in expected_fields if extracted_data.get(f))
            confidence = present_fields / len(expected_fields)
        else:
            # Default: if we got any data, 0.7 confidence
            confidence = 0.7 if extracted_data else 0.3
        
        return round(confidence, 2)
    
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