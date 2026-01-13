"""AWS Bedrock Service for Payment Agent System"""

import json
import logging
from typing import Dict, Any, Optional, List
import os

logger = logging.getLogger(__name__)


class BedrockService:
    """
    AWS Bedrock service for AI-powered operations.
    Provides access to Claude models for agent reasoning and tool operations.
    """

    def __init__(self, region: str = "us-east-1", profile: str = None):
        """
        Initialize Bedrock service

        Args:
            region: AWS region (default: us-east-1)
            profile: AWS profile name (optional)
        """
        self.region = region
        self.profile = profile
        self.client = None
        self._initialize_client()

    def _initialize_client(self):
        """Initialize boto3 Bedrock client"""
        try:
            import boto3

            # Set profile if provided
            if self.profile:
                os.environ["AWS_PROFILE"] = self.profile

            # Create Bedrock Runtime client
            session = boto3.Session(profile_name=self.profile) if self.profile else boto3.Session()
            self.client = session.client(
                "bedrock-runtime",
                region_name=self.region
            )
            logger.info(f"Bedrock client initialized in region: {self.region}")
        except Exception as e:
            logger.error(f"Failed to initialize Bedrock client: {e}")
            self.client = None
            raise

    def invoke_claude(
        self,
        prompt: str,
        max_tokens: int = 1000,
        temperature: float = 0.1,
        model_id: str = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
    ) -> Dict[str, Any]:
        """
        Invoke Claude model for text generation

        Args:
            prompt: The prompt text
            max_tokens: Maximum tokens to generate
            temperature: Temperature for generation (0.0-1.0)
            model_id: Claude model ID to use

        Returns:
            Response containing generated text and metadata
        """
        if not self.client:
            raise Exception("Bedrock client not initialized")

        try:
            # Prepare request body for Claude
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

            # Invoke the model
            response = self.client.invoke_model(
                modelId=model_id,
                body=json.dumps(request_body),
                contentType="application/json",
                accept="application/json"
            )

            # Parse response
            response_body = json.loads(response["body"].read())

            return {
                "text": response_body.get("content", [{}])[0].get("text", ""),
                "usage": response_body.get("usage", {}),
                "stop_reason": response_body.get("stop_reason"),
                "model": model_id
            }
        except Exception as e:
            logger.error(f"Error invoking Claude model: {e}")
            raise

    def close(self):
        """Close/cleanup Bedrock client"""
        self.client = None
        logger.info("Bedrock client closed")


# Singleton instance holder
_bedrock_service: Optional[BedrockService] = None


def get_bedrock_service(region: str = None, profile: str = None) -> BedrockService:
    """
    Get or create Bedrock service singleton

    Args:
        region: AWS region (uses settings if not provided)
        profile: AWS profile (uses settings if not provided)

    Returns:
        BedrockService instance
    """
    global _bedrock_service

    if _bedrock_service is None:
        from config.settings import settings

        aws_region = region or settings.aws_region
        aws_profile = profile or settings.aws_profile

        _bedrock_service = BedrockService(aws_region, aws_profile)

    return _bedrock_service