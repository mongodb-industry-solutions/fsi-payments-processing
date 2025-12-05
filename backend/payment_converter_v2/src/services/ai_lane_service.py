"""AI Lane Service - Business logic for AI-powered field extraction"""

import json
import logging
from typing import Dict, Any, Optional

from .bedrock_service import BedrockService, get_bedrock_service

logger = logging.getLogger(__name__)


class AILaneService:
    """
    AI Lane processing service.
    
    Handles all AI business logic: prompt building, extraction, confidence calculation,
    and fallback handling. Uses BedrockService for raw API calls.
    """
    
    def __init__(
        self,
        bedrock_service: BedrockService = None,
        model_haiku: str = "anthropic.claude-haiku-4-5-20251001-v1:0",
        model_sonnet: str = "anthropic.claude-3-5-sonnet-20240620-v1:0"
    ):
        """
        Initialize AI Lane service.
        
        Args:
            bedrock_service: BedrockService instance (uses singleton if None)
            model_haiku: Haiku model ID for simple tasks
            model_sonnet: Sonnet model ID for complex tasks
        """
        self.bedrock = bedrock_service or get_bedrock_service()
        self.model_haiku = model_haiku
        self.model_sonnet = model_sonnet
    
    async def extract_field(
        self,
        input_text: str,
        prompt: str = "",
        field_type: str = "remittance",
        use_sonnet: bool = False
    ) -> Dict[str, Any]:
        """
        Extract structured data from unstructured field using AI.
        
        Args:
            input_text: Text to extract from
            prompt: Optional custom prompt (uses default if empty)
            field_type: Type of field being extracted
            use_sonnet: Use Sonnet instead of Haiku for complex tasks
            
        Returns:
            Dictionary with:
                - data: Extracted data (structured)
                - confidence: Extraction confidence (0.0 - 1.0)
                - raw_response: Raw AI response
                - model_used: Model ID used
                - processing_lane: "AI"
        """
        # Check if Bedrock is available
        if not self.bedrock.health_check():
            logger.warning("Bedrock not available, using fallback")
            return self._fallback_extraction(input_text, field_type)
        
        try:
            # Select model
            model_id = self.model_sonnet if use_sonnet else self.model_haiku
            
            # Build complete prompt
            full_prompt = self._build_prompt(prompt, input_text, field_type)
            
            logger.debug(f"Extracting {field_type} using {model_id}")
            
            # Call Bedrock API
            response_body = self.bedrock.invoke_model(
                model_id=model_id,
                prompt=full_prompt,
                max_tokens=1000,
                temperature=0.1
            )
            
            # Extract content from response
            content = response_body.get('content', [])
            if content and len(content) > 0:
                extracted_text = content[0].get('text', '')
            else:
                extracted_text = ''
            
            # Parse JSON response
            try:
                # Try to extract JSON from response
                import re
                json_match = re.search(r'[{\[].*[}\]]', extracted_text, re.DOTALL)
                if json_match:
                    cleaned_response = json_match.group(0)
                else:
                    cleaned_response = extracted_text

                extracted_data = json.loads(cleaned_response)
            except json.JSONDecodeError:
                # If not JSON, treat as plain text
                extracted_data = {"text": extracted_text}

            # Calculate confidence based on extraction quality
            confidence = self._calculate_confidence(
                extracted_data,
                input_text,
                response_body
            )

            logger.info(f"AI extraction complete: {field_type}, confidence: {confidence:.2f}")
            
            return {
                "data": extracted_data,
                "confidence": confidence,
                "raw_response": extracted_text,
                "model_used": model_id,
                "processing_lane": "AI"
            }
            
        except Exception as e:
            logger.error(f"AI extraction failed: {e}")
            return self._fallback_extraction(input_text, field_type)
    
    def _build_prompt(self, base_prompt: str, input_text: str, field_type: str) -> str:
        """
        Build complete prompt with instructions and input.
        
        Args:
            base_prompt: Base prompt template (empty = use default)
            input_text: Input text to process
            field_type: Type of field
            
        Returns:
            Complete prompt string
        """
        # If custom prompt provided, use it
        if base_prompt and base_prompt.strip():
            return base_prompt.replace("{input}", input_text)
        
        # Default prompts by field type
        default_prompts = {
            "remittance": (
                "Extract structured payment information from multi-line remittance text.\n\n"
                "<example>\n"
                "Input text:\n"
                "```\n"
                "INVOICE INV-2024-001 DATED 05.12.2024\n"
                "MEDICAL EQUIPMENT AND SUPPLIES\n"
                "URGENT DELIVERY REQUIRED\n"
                "```\n\n"
                "Expected JSON:\n"
                "{{\n"
                '  "payment_purpose": "INVOICE",\n'
                '  "invoice_number": "INV-2024-001",\n'
                '  "details": "MEDICAL EQUIPMENT AND SUPPLIES. URGENT DELIVERY REQUIRED"\n'
                "}}\n"
                "</example>\n\n"
                "Now extract from this input:\n"
                "```\n{input}\n```\n\n"
                "Rules:\n"
                "1. payment_purpose = first keyword from line 1\n"
                "2. invoice_number = reference number from line 1\n"
                "3. details = join ALL text from lines after line 1 with periods\n\n"
                "Output JSON only:"
            ),
            "instructions": (
                "Extract bank-to-bank instructions from the following text. "
                "Return a JSON object with:\n"
                "- instruction_type: Type of instruction\n"
                "- details: Key instruction details\n\n"
                "Input text:\n{input}\n\n"
                "Return only valid JSON, no explanations."
            ),
            "address": (
                "Extract and structure address information. "
                "Return JSON with: street, city, postal_code, country\n\n"
                "Input text:\n{input}\n\n"
                "Return only valid JSON, no explanations."
            ),
            "merchant_details": (
                "Extract merchant information from ISO 8583 Field 43 (40 characters).\n\n"
                "<example>\n"
                "Input: STARBUCKS STORE #123         LONDON        GBR\n"
                "Expected JSON:\n"
                "{{\n"
                '  "merchant_name": "STARBUCKS STORE #123",\n'
                '  "merchant_city": "LONDON",\n'
                '  "merchant_country": "GBR"\n'
                "}}\n"
                "</example>\n\n"
                "<example>\n"
                "Input: SINGAPORE ELECTRONICS PTE    SINGAPORE  SG\n"
                "Expected JSON:\n"
                "{{\n"
                '  "merchant_name": "SINGAPORE ELECTRONICS PTE",\n'
                '  "merchant_city": "SINGAPORE",\n'
                '  "merchant_country": "SG"\n'
                "}}\n"
                "</example>\n\n"
                "Now extract from this input:\n"
                "```\n{input}\n```\n\n"
                "Rules:\n"
                "1. merchant_name = first ~25 chars (trim trailing spaces)\n"
                "2. merchant_city = next ~13 chars (trim spaces)\n"
                "3. merchant_country = last 2-3 chars (country code)\n\n"
                "Output JSON only:"
            )
        }
        
        # Get default for field type or use remittance as fallback
        prompt_template = default_prompts.get(field_type, default_prompts["remittance"])
        return prompt_template.replace("{input}", input_text)
    
    def _calculate_confidence(
        self,
        extracted_data: Any,
        original_text: str,
        response_body: Dict
    ) -> float:
        """
        Calculate extraction confidence based on quality assessment.
        
        Uses extraction quality (not AI self-reported confidence) for reliability.
        
        Args:
            extracted_data: Extracted structured data
            original_text: Original input text
            response_body: Full API response
            
        Returns:
            Confidence score (0.0 - 1.0)
        """
        # Check if extraction succeeded
        if not extracted_data or extracted_data == {}:
            return 0.3  # Failed extraction
        
        # If data is just the original text, low confidence
        if isinstance(extracted_data, dict):
            text_value = extracted_data.get("text", "")
            if text_value == original_text:
                return 0.5  # No transformation
        
        # Calculate content metrics
        extracted_length = len(str(extracted_data))
        original_length = len(original_text)
        
        # Progressive confidence based on extraction characteristics
        if extracted_length < 10:
            # Very minimal (e.g., "PAY") - but complete if that's all there was
            confidence = 0.80
        elif extracted_length < 50:
            # Single field with modest content - likely complete simple extraction
            confidence = 0.85
        elif isinstance(extracted_data, dict) and len(extracted_data) > 3:
            # Rich structured data with multiple fields
            confidence = 0.90
        elif isinstance(extracted_data, dict) and len(extracted_data) > 1:
            # Structured data with multiple fields
            confidence = 0.85
        else:
            # Default good extraction
            confidence = 0.80
        
        # Check for stop reason (completion indicates good response)
        stop_reason = response_body.get('stop_reason', '')
        if stop_reason != 'end_turn':
            confidence *= 0.9  # Slight penalty for non-standard completion
        
        return round(confidence, 2)
    
    async def batch_extract(
        self,
        extractions: list[Dict[str, Any]]
    ) -> list[Dict[str, Any]]:
        """
        Process multiple AI extractions in batch.
        
        Args:
            extractions: List of extraction requests, each with:
                - input_text: Text to extract from
                - prompt: Optional prompt template
                - field_type: Field type
                - use_sonnet: Optional, use Sonnet model
                
        Returns:
            List of extraction results
        """
        results = []
        
        for extraction in extractions:
            result = await self.extract_field(
                input_text=extraction.get("input_text", ""),
                prompt=extraction.get("prompt", ""),
                field_type=extraction.get("field_type", "remittance"),
                use_sonnet=extraction.get("use_sonnet", False)
            )
            results.append(result)
        
        logger.info(f"Batch AI extraction complete: {len(results)} items")
        return results
    
    def _fallback_extraction(self, input_text: str, field_type: str) -> Dict[str, Any]:
        """
        Fallback extraction when AI is not available.
        
        Args:
            input_text: Input text
            field_type: Field type
            
        Returns:
            Fallback result with low confidence
        """
        logger.warning(f"Using fallback extraction for {field_type}")
        return {
            "data": {"text": input_text},
            "confidence": 0.3,
            "model_used": "fallback",
            "processing_lane": "AI",
            "fallback": True
        }


# Singleton instance
_ai_lane_instance = None


def get_ai_lane_service(
    model_haiku: str = "anthropic.claude-3-haiku-20240307-v1:0",
    model_sonnet: str = "anthropic.claude-3-5-sonnet-20240620-v1:0"
) -> AILaneService:
    """
    Get or create an AI Lane service singleton instance.
    
    Args:
        model_haiku: Haiku model ID
        model_sonnet: Sonnet model ID
        
    Returns:
        AILaneService instance
    """
    global _ai_lane_instance
    if _ai_lane_instance is None:
        _ai_lane_instance = AILaneService(
            model_haiku=model_haiku,
            model_sonnet=model_sonnet
        )
    return _ai_lane_instance

