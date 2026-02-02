"""Service initialization and shared constants for API layer."""

import logging

from config import get_settings
from src.services import (
    MongoDBService,
    get_bedrock_service,
    get_ai_lane_service,
    Converter
)
from src.services.payment_agent_client import PaymentAgentClient
from src.services.semantic_learning_service import SemanticLearningService
from src.services.llm_field_mapper import LLMFieldMapper
from src.services.solana_service import init_solana_service

logger = logging.getLogger(__name__)

settings = get_settings()

# Core services
mongodb_service = MongoDBService(settings.mongodb_uri, settings.database_name)
bedrock_service = get_bedrock_service(settings.aws_default_region)
ai_lane_service = get_ai_lane_service(
    model_haiku=settings.ai_model_haiku,
    model_sonnet=settings.ai_model_sonnet
)
converter = Converter(
    mongodb_service=mongodb_service,
    ai_lane_service=ai_lane_service,
    ai_confidence_threshold=settings.ai_confidence_threshold
)

# Payment agent client
agent_client = PaymentAgentClient(
    agent_url=settings.payment_agent_url,
    timeout=settings.payment_agent_timeout
)

# Config builder services
llm_field_mapper = LLMFieldMapper(mongodb_service, bedrock_service)
semantic_learning_service = SemanticLearningService(mongodb_service, llm_field_mapper)

# Solana service (optional)
solana_service = None
if settings.solana_private_key:
    try:
        solana_service = init_solana_service(
            rpc_endpoint=settings.solana_rpc_endpoint,
            private_key=settings.solana_private_key,
            network=settings.solana_network
        )
        logger.info(f"Solana service initialized on {settings.solana_network}")
    except Exception as e:
        logger.warning(f"Failed to initialize Solana service: {e}")

# Shared SSE response headers
SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}
