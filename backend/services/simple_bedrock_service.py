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
        
        # Build batch prompt
        batch_prompt = self._build_batch_prompt(fields_data)
        
        # Make single AI call
        try:
            start_time = time.time()
            response = self.invoke_claude(batch_prompt, model=model, **kwargs)
            elapsed = time.time() - start_time
            
            logger.debug(f"   Batch AI call ({model}) processed {len(fields_data)} fields in {elapsed:.1f}s")
            
            # Parse batch response
            results = self._parse_batch_response(response, fields_data)
            return results
            
        except Exception as e:
            logger.error(f"Batch AI processing failed: {str(e)[:200]}")
            # Fallback to empty results - let caller handle individual processing
            return {}
    
    def _build_batch_prompt(self, fields_data: list) -> str:
        """Build a prompt that processes multiple fields at once."""
        prompt_parts = [
            "Process the following payment fields and return structured JSON for each.",
            "Return your response as a JSON object with field IDs as keys.",
            "",
            "Fields to process:"
        ]
        
        for field_id, field_content, prompt_template in fields_data:
            prompt_parts.append(f"\n--- Field {field_id} ---")
            if prompt_template:
                # Use custom prompt template if provided
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
            # Try to parse as JSON first
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group())
                
                # Map parsed results to field IDs
                for field_id, _, _ in fields_data:
                    if field_id in parsed:
                        results[field_id] = parsed[field_id]
                    elif str(field_id) in parsed:
                        results[field_id] = parsed[str(field_id)]
                    else:
                        # Try to find field in various formats
                        for key in parsed:
                            if field_id in key or key in field_id:
                                results[field_id] = parsed[key]
                                break
                
                return results
                
        except (json.JSONDecodeError, AttributeError) as e:
            logger.debug(f"   Failed to parse batch response as JSON: {str(e)[:100]}")
        
        # Fallback: Try to extract individual field responses
        for field_id, _, _ in fields_data:
            # Look for field-specific sections in response
            field_pattern = rf"(?:Field |^){re.escape(str(field_id))}[:\s]+(.+?)(?=Field \w+:|$)"
            match = re.search(field_pattern, response, re.MULTILINE | re.DOTALL)
            if match:
                results[field_id] = {"extracted_data": match.group(1).strip(), "confidence": 0.7}
        
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