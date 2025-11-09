"""AWS Bedrock Service - Thin wrapper around boto3 Bedrock client"""

import json
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class BedrockService:
    """
    Thin AWS Bedrock client wrapper.
    
    Only handles boto3 client initialization and raw API calls.
    Business logic (prompts, confidence, etc.) is in ai_lane_service.py
    """
    
    def __init__(self, region: str = "us-east-1"):
        """
        Initialize Bedrock service.
        
        Args:
            region: AWS region (default: us-east-1)
        """
        self.region = region
        self.client = None
        
        # Lazy initialization
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize boto3 Bedrock client using default credential chain"""
        try:
            import boto3
            self.client = boto3.client(
                "bedrock-runtime",
                region_name=self.region
            )
            logger.info(f"Bedrock client initialized in region: {self.region}")
        except Exception as e:
            logger.error(f"Failed to initialize Bedrock client: {e}")
            self.client = None
    
    def invoke_model(
        self,
        model_id: str,
        prompt: str,
        max_tokens: int = 1000,
        temperature: float = 0.1
    ) -> Dict[str, Any]:
        """
        Raw API call to Bedrock.
        
        Args:
            model_id: Claude model ID
            prompt: Complete prompt text
            max_tokens: Max tokens to generate
            temperature: Temperature (0.0-1.0)
            
        Returns:
            Raw response from Bedrock API
            
        Raises:
            Exception: If client not initialized or API call fails
        """
        if not self.client:
            raise Exception("Bedrock client not initialized")
        
        # Prepare request
        request_body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        }
        
        logger.debug(f"Invoking Bedrock model: {model_id}")
        
        # Call API
        response = self.client.invoke_model(
            modelId=model_id,
            body=json.dumps(request_body)
        )
        
        # Parse response
        response_body = json.loads(response['body'].read())
        
        logger.debug(f"Bedrock API call successful")
        
        return response_body
    
    def health_check(self) -> bool:
        """
        Check if Bedrock client is initialized.
        
        Returns:
            True if client is available
        """
        return self.client is not None


# Singleton instance
_bedrock_instance = None


def get_bedrock_service(region: str = "us-east-1") -> BedrockService:
    """
    Get or create a Bedrock service singleton instance.
    
    Args:
        region: AWS region
        
    Returns:
        BedrockService instance
    """
    global _bedrock_instance
    if _bedrock_instance is None:
        _bedrock_instance = BedrockService(region=region)
    return _bedrock_instance

