"""
Embedding service for generating text embeddings using Voyage AI.

Used by vector_search tool for semantic similarity matching.
"""

import logging
from typing import List
from config.settings import settings

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Generate text embeddings using Voyage AI."""

    def __init__(self):
        import voyageai

        if not settings.voyage_api_key:
            raise ValueError("VOYAGE_API_KEY not set in environment")

        self.client = voyageai.Client(api_key=settings.voyage_api_key)
        self.model = settings.embedding_model
        self.dimensions = settings.embedding_dimensions

        logger.info(f"Embedding service initialized: {self.model} ({self.dimensions} dims)")

    def embed_text(self, text: str) -> List[float]:
        """
        Generate embedding for a single text.

        Args:
            text: Text to embed

        Returns:
            List of floats representing the embedding vector
        """
        try:
            result = self.client.embed(
                texts=[text],
                model=self.model,
                input_type="query"
            )
            return result.embeddings[0]
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            raise

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for multiple texts (batch).

        Args:
            texts: List of texts to embed

        Returns:
            List of embedding vectors
        """
        try:
            result = self.client.embed(
                texts=texts,
                model=self.model,
                input_type="document"
            )
            return result.embeddings
        except Exception as e:
            logger.error(f"Batch embedding generation failed: {e}")
            raise


# Singleton instance
_embedding_service = None


def get_embedding_service() -> EmbeddingService:
    """Get or create embedding service singleton."""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service
