"""
Simple Bedrock Service - Direct, efficient AWS Bedrock integration

This module provides a minimal, thread-safe interface to AWS Bedrock for the payment converter.
No complex inheritance, no session managers, just direct boto3 calls that work.
"""

import os
import json
import time
import threading
from typing import Optional, Dict, Any
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
import logging

logger = logging.getLogger(__name__)


class SimpleBedrock:
    """
    Simple, efficient Bedrock client for AI field processing.
    
    Features:
    - Direct boto3 integration (no inheritance complexity)
    - Thread-safe client reuse
    - Built-in retry logic
    - Timeout protection
    - Connection pooling
    """
    
    # Class-level client cache (shared across all instances)
    _clients = {}
    _client_lock = threading.Lock()
    
    # Model configurations
    MODELS = {
        "CLAUDE_HAIKU": "anthropic.claude-3-haiku-20240307-v1:0",
        "CLAUDE_SONNET": "anthropic.claude-3-sonnet-20240229-v1:0"
    }
    
    def __init__(self, region: str = None):
        """
        Initialize the Bedrock service.
        
        Args:
            region: AWS region (defaults to env var or us-east-1)
        """
        self.region = region or os.environ.get("AWS_REGION", "us-east-1")
        self._ensure_client()
    
    def _ensure_client(self):
        """Ensure Bedrock client exists (create if needed)."""
        if "bedrock" not in self._clients:
            with self._client_lock:
                # Double-check after acquiring lock
                if "bedrock" not in self._clients:
                    self._create_client()
    
    def _create_client(self):
        """Create the Bedrock Runtime client with optimal configuration."""
        print(f"Creating Bedrock client for region: {self.region}")
        
        # Configuration for reliability and performance
        config = Config(
            region_name=self.region,
            retries={
                "max_attempts": 2,  # Quick failure for better user experience
                "mode": "adaptive",  # Adaptive retry with backoff
            },
            connect_timeout=5,
            read_timeout=30,
            max_pool_connections=10  # Connection pooling for parallel requests
        )
        
        try:
            # Try to create client with default credentials
            # This will use (in order):
            # 1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
            # 2. Shared credentials file (~/.aws/credentials)
            # 3. IAM role (if on EC2/Lambda)
            # 4. SSO (if configured)
            
            client = boto3.client(
                "bedrock-runtime",
                config=config
            )
            
            # Store the client
            self._clients["bedrock"] = client
            print("✓ Bedrock client created successfully")
            
        except Exception as e:
            logger.error(f"Failed to create Bedrock client: {e}")
            raise RuntimeError(f"Cannot initialize Bedrock: {str(e)[:200]}")
    
    def invoke_claude(self, 
                     prompt: str, 
                     model: str = "CLAUDE_HAIKU",
                     max_tokens: int = 512,
                     temperature: float = 0.01) -> str:
        """
        Invoke Claude model with the given prompt.
        
        Args:
            prompt: The prompt text
            model: Model name (CLAUDE_HAIKU or CLAUDE_SONNET)
            max_tokens: Maximum tokens in response
            temperature: Temperature for randomness
            
        Returns:
            Model response text
            
        Raises:
            RuntimeError: If the model invocation fails
        """
        if model not in self.MODELS:
            raise ValueError(f"Unknown model: {model}. Use CLAUDE_HAIKU or CLAUDE_SONNET")
        
        model_id = self.MODELS[model]
        
        # Build the request
        request_body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [
                {
                    "role": "user",
                    "content": [{"type": "text", "text": prompt}]
                }
            ]
        }
        
        # Get the client
        client = self._clients.get("bedrock")
        if not client:
            self._ensure_client()
            client = self._clients["bedrock"]
        
        # Invoke with retry logic
        max_retries = 2
        for attempt in range(max_retries):
            try:
                # Make the API call
                response = client.invoke_model(
                    modelId=model_id,
                    body=json.dumps(request_body)
                )
                
                # Parse response
                response_body = json.loads(response["body"].read())
                
                # Extract text from Claude's response format
                if "content" in response_body and len(response_body["content"]) > 0:
                    return response_body["content"][0]["text"]
                else:
                    raise RuntimeError("Unexpected response format from Claude")
                    
            except ClientError as e:
                error_code = e.response.get("Error", {}).get("Code", "Unknown")
                error_msg = e.response.get("Error", {}).get("Message", str(e))
                
                # Handle specific errors
                if error_code == "ThrottlingException" and attempt < max_retries - 1:
                    # Throttled - wait and retry
                    wait_time = (attempt + 1) * 2
                    logger.warning(f"Throttled by AWS, waiting {wait_time}s...")
                    time.sleep(wait_time)
                    continue
                elif error_code == "AccessDeniedException":
                    raise RuntimeError(f"Access denied to Bedrock. Check IAM permissions: {error_msg}")
                elif error_code == "ValidationException":
                    raise RuntimeError(f"Invalid request to Bedrock: {error_msg}")
                else:
                    raise RuntimeError(f"Bedrock API error ({error_code}): {error_msg}")
                    
            except Exception as e:
                if attempt < max_retries - 1:
                    logger.warning(f"Request failed (attempt {attempt + 1}), retrying: {str(e)[:100]}")
                    time.sleep(1)
                    continue
                else:
                    raise RuntimeError(f"Failed to invoke model after {max_retries} attempts: {str(e)[:200]}")
        
        raise RuntimeError("Failed to get response from Bedrock")
    
    def invoke_haiku(self, prompt: str, **kwargs) -> str:
        """
        Invoke Claude 3 Haiku (fast, cost-optimized).
        
        Args:
            prompt: The prompt text
            **kwargs: Additional parameters for invoke_claude
            
        Returns:
            Model response text
        """
        return self.invoke_claude(prompt, model="CLAUDE_HAIKU", **kwargs)
    
    def invoke_sonnet(self, prompt: str, **kwargs) -> str:
        """
        Invoke Claude 3 Sonnet (balanced performance).
        
        Args:
            prompt: The prompt text
            **kwargs: Additional parameters for invoke_claude
            
        Returns:
            Model response text
        """
        return self.invoke_claude(prompt, model="CLAUDE_SONNET", **kwargs)
    
    def invoke_batch(self, fields_data: list, model: str = "CLAUDE_HAIKU", **kwargs) -> dict:
        """
        Process multiple fields in a single AI call for efficiency.
        
        Args:
            fields_data: List of tuples (field_id, field_content, prompt_template)
            model: Model to use (CLAUDE_HAIKU or CLAUDE_SONNET)
            **kwargs: Additional parameters for the model
            
        Returns:
            Dictionary mapping field_id to processed result
        """
        if not fields_data:
            return {}
        
        # Log field IDs being processed
        field_ids = [field_id for field_id, _, _ in fields_data]
        logger.info(f"   Batch processing fields: {field_ids}")
        
        # Build batch prompt
        batch_prompt = self._build_batch_prompt(fields_data)
        
        # Make single AI call
        try:
            start_time = time.time()
            
            # Enhanced debug logging
            logger.debug(f"   Batch prompt length: {len(batch_prompt)} chars")
            logger.debug(f"   Processing {len(fields_data)} fields: {field_ids}")
            
            # Log more of the prompt for debugging
            if len(batch_prompt) < 2000:
                logger.debug(f"   Full batch prompt:\n{batch_prompt}")
            else:
                logger.debug(f"   Batch prompt preview (first 1000 chars):\n{batch_prompt[:1000]}...")
                logger.debug(f"   Batch prompt end (last 500 chars):\n...{batch_prompt[-500:]}")
            
            # Increase max_tokens for batch processing
            batch_kwargs = kwargs.copy()
            batch_kwargs['max_tokens'] = max(kwargs.get('max_tokens', 512), 1024)
            
            response = self.invoke_claude(batch_prompt, model=model, **batch_kwargs)
            elapsed = time.time() - start_time
            
            logger.info(f"   Batch AI call ({model}) completed in {elapsed:.1f}s")
            logger.debug(f"   Response length: {len(response)} chars")
            
            # Log full response for debugging
            if len(response) < 1000:
                logger.debug(f"   Full response:\n{response}")
            else:
                logger.debug(f"   Response preview (first 500 chars):\n{response[:500]}...")
                logger.debug(f"   Response end (last 500 chars):\n...{response[-500:]}")
            
            # Parse batch response
            results = self._parse_batch_response(response, fields_data)
            
            # Log parsing results
            logger.info(f"   Parsed {len(results)}/{len(fields_data)} fields successfully")
            for field_id in field_ids:
                if field_id in results:
                    logger.debug(f"    ✓ Field {field_id}: parsed successfully")
                else:
                    logger.warning(f"    ✗ Field {field_id}: NOT found in response")
            
            return results
            
        except Exception as e:
            logger.error(f"Batch AI processing failed: {str(e)}")
            logger.debug(f"   Exception details: {repr(e)}")
            # Fallback to empty results - let caller handle individual processing
            return {}
    
    def _build_batch_prompt(self, fields_data: list) -> str:
        """Build a prompt that processes multiple fields at once."""
        # Check if we have pre-built prompts (from AIFieldProcessor) or templates
        has_prebuilt_prompts = any(
            prompt and "{field_content}" not in prompt 
            for _, _, prompt in fields_data
        )
        
        if has_prebuilt_prompts:
            # Handle pre-built prompts from AIFieldProcessor
            # Build a unified batch prompt that overrides individual output formats
            prompt_parts = [
                "You are processing multiple payment fields for format conversion.",
                "Process each field independently using the instructions provided.",
                "IMPORTANT: Ignore any output format instructions in individual field prompts.",
                "Return ALL results as a SINGLE JSON object with field IDs as keys.",
                "",
                "Fields to process:",
                ""
            ]
            
            for field_id, field_content, prompt_template in fields_data:
                prompt_parts.append(f"=== Field {field_id} ===")
                
                if prompt_template:
                    # Extract core instructions from pre-built prompt
                    # Remove JSON output format instructions that might conflict
                    clean_prompt = prompt_template
                    
                    # Remove common JSON output format instructions
                    clean_prompt = clean_prompt.replace("Output ONLY valid JSON", "Process")
                    clean_prompt = clean_prompt.replace("Return as JSON", "Extract")
                    clean_prompt = clean_prompt.replace("Return JSON", "Extract")
                    clean_prompt = clean_prompt.replace("Output JSON", "Extract")
                    
                    # Add the cleaned prompt
                    prompt_parts.append(clean_prompt)
                else:
                    # Fallback to simple extraction
                    prompt_parts.append(f"Content: {field_content}")
                    prompt_parts.append("Extract and structure this field's information.")
                
                prompt_parts.append("")  # Add spacing between fields
            
            # Clear, unified output instructions
            prompt_parts.extend([
                "=== FINAL OUTPUT INSTRUCTIONS ===",
                "Combine ALL field results into a SINGLE JSON response.",
                "Use the exact field IDs as keys (e.g., '20', '23B', '50K', '59', '70', '71A', '72').",
                "Each field must have 'extracted_data' and 'confidence' keys.",
                "",
                "Required format:",
                "{",
                '  "20": {',
                '    "extracted_data": <processed field 20 data>,',
                '    "confidence": 0.95',
                '  },',
                '  "23B": {',
                '    "extracted_data": <processed field 23B data>,',
                '    "confidence": 0.95',
                '  },',
                '  // ... continue for all fields',
                "}",
                "",
                "IMPORTANT: Return ONLY the JSON object, no additional text."
            ])
        else:
            # Original logic for template-based prompts
            prompt_parts = [
                "Process the following payment fields and return structured JSON for each.",
                "Return your response as a JSON object with field IDs as keys.",
                "",
                "Fields to process:"
            ]
            
            for field_id, field_content, prompt_template in fields_data:
                prompt_parts.append(f"\n--- Field {field_id} ---")
                if prompt_template:
                    # Template with placeholder - replace it
                    prompt_parts.append(prompt_template.replace("{field_content}", field_content))
                else:
                    # Default prompt
                    prompt_parts.append(f"Content: {field_content}")
                    prompt_parts.append("Extract and structure this field's information.")
            
            prompt_parts.extend([
                "",
                "Return as JSON in this format:",
                "{",
                '  "field_id": {',
                '    "extracted_data": {...},',
                '    "confidence": 0.85',
                "  },",
                "  ...",
                "}"
            ])
        
        return "\n".join(prompt_parts)
    
    def _parse_batch_response(self, response: str, fields_data: list) -> dict:
        """Parse batch AI response into individual field results."""
        import re
        
        results = {}
        
        try:
            # Clean the response - remove markdown code blocks if present
            clean_response = response.strip()
            if clean_response.startswith("```json"):
                clean_response = clean_response[7:]
            elif clean_response.startswith("```"):
                clean_response = clean_response[3:]
            if clean_response.endswith("```"):
                clean_response = clean_response[:-3]
            clean_response = clean_response.strip()
            
            # Try to parse as JSON first
            json_match = re.search(r'\{.*\}', clean_response, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group())
                
                # Debug: Log parsed keys
                logger.debug(f"   Parsed JSON keys: {list(parsed.keys())}")
                
                # Map parsed results to field IDs
                for field_id, _, _ in fields_data:
                    field_id_str = str(field_id)
                    
                    # Try different key variations
                    found = False
                    
                    # Direct match
                    if field_id_str in parsed:
                        results[field_id] = parsed[field_id_str]
                        found = True
                        logger.debug(f"    ✓ Found field {field_id} (direct match)")
                    
                    # With "field_" prefix
                    elif f"field_{field_id}" in parsed:
                        results[field_id] = parsed[f"field_{field_id}"]
                        found = True
                        logger.debug(f"    ✓ Found field {field_id} (with field_ prefix)")
                    
                    # Case variations for special fields like "23B"
                    elif field_id != field_id_str:  # For non-string field IDs
                        if field_id in parsed:
                            results[field_id] = parsed[field_id]
                            found = True
                            logger.debug(f"    ✓ Found field {field_id} (original type)")
                    
                    # Check all keys for partial matches
                    if not found:
                        for key in parsed:
                            if key == field_id or key == field_id_str or key == f"field_{field_id}":
                                results[field_id] = parsed[key]
                                found = True
                                logger.debug(f"    ✓ Found field {field_id} (key: {key})")
                                break
                    
                    if not found:
                        logger.debug(f"    ⚠️ Field {field_id} not found in response")
                
                # Validate the results have correct structure
                for field_id, value in results.items():
                    if isinstance(value, dict):
                        # Ensure extracted_data and confidence exist
                        if "extracted_data" not in value and "confidence" not in value:
                            # Wrap the entire value as extracted_data
                            results[field_id] = {
                                "extracted_data": value,
                                "confidence": 0.85
                            }
                    else:
                        # Wrap non-dict values
                        results[field_id] = {
                            "extracted_data": value,
                            "confidence": 0.85
                        }
                
                logger.debug(f"   Successfully parsed {len(results)}/{len(fields_data)} fields from batch response")
                return results
                
        except (json.JSONDecodeError, AttributeError) as e:
            logger.error(f"   Failed to parse batch response as JSON: {str(e)[:100]}")
            logger.debug(f"   Response preview: {response[:500]}...")
        
        # Fallback: Try to extract individual field responses
        logger.debug("   Attempting fallback parsing...")
        for field_id, _, _ in fields_data:
            # Look for field-specific sections in response
            field_pattern = rf"(?:Field |field_|=== Field ){re.escape(str(field_id))}.*?[:\s]+(.+?)(?=(?:Field |field_|=== Field )\w+|$)"
            match = re.search(field_pattern, response, re.MULTILINE | re.DOTALL | re.IGNORECASE)
            if match:
                try:
                    # Try to parse the extracted part as JSON
                    field_json = re.search(r'\{.*?\}', match.group(1), re.DOTALL)
                    if field_json:
                        results[field_id] = json.loads(field_json.group())
                        logger.debug(f"    ✓ Extracted field {field_id} via fallback")
                    else:
                        results[field_id] = {"extracted_data": match.group(1).strip(), "confidence": 0.7}
                        logger.debug(f"    ✓ Extracted field {field_id} as text via fallback")
                except:
                    results[field_id] = {"extracted_data": match.group(1).strip(), "confidence": 0.7}
                    logger.debug(f"    ✓ Extracted field {field_id} with error handling")
        
        logger.debug(f"   Fallback parsing recovered {len(results)}/{len(fields_data)} fields")
        return results
    
    def health_check(self) -> bool:
        """
        Check if Bedrock service is accessible.
        
        Returns:
            True if service is healthy, False otherwise
        """
        try:
            # Try a minimal invocation
            response = self.invoke_haiku(
                "Respond with just 'OK'",
                max_tokens=10,
                temperature=0
            )
            return "OK" in response
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return False
    
    @classmethod
    def clear_clients(cls):
        """Clear all cached clients (useful for testing or credential refresh)."""
        with cls._client_lock:
            cls._clients.clear()
            print("Bedrock client cache cleared")


# Global singleton instance (optional - can also create instances as needed)
_global_bedrock = None
_global_lock = threading.Lock()


def get_bedrock_service() -> SimpleBedrock:
    """
    Get the global Bedrock service instance (singleton pattern).
    
    Returns:
        SimpleBedrock instance
    """
    global _global_bedrock
    if _global_bedrock is None:
        with _global_lock:
            if _global_bedrock is None:
                _global_bedrock = SimpleBedrock()
    return _global_bedrock