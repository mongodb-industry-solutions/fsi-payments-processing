"""Client for calling payment_agent service"""

import httpx
import logging
import json
from typing import Dict, Any, Optional, AsyncGenerator

logger = logging.getLogger(__name__)


class PaymentAgentClient:
    """
    HTTP client for payment_agent service.

    Handles communication with the payment_agent API to request
    automatic correction of country validation violations.
    """

    def __init__(self, agent_url: str, timeout: int = 30):
        """
        Initialize agent client.

        Args:
            agent_url: Base URL of payment_agent service (e.g., http://localhost:8002)
            timeout: Request timeout in seconds
        """
        self.agent_url = agent_url.rstrip('/')
        self.timeout = timeout
        self.client = httpx.AsyncClient(timeout=timeout)

    async def process_payment(
        self,
        task_type: str,
        field_name: str,
        original_value: str,
        payment_data: Dict[str, Any],
        conversion_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Call payment_agent to process a payment correction.

        Args:
            task_type: Type of correction (e.g., "japan_transliteration")
            field_name: Field to correct
            original_value: Current value
            payment_data: Full canonical JSON
            conversion_context: Conversion metadata

        Returns:
            Agent response with solution and execution result

        Raises:
            httpx.HTTPError: If agent request fails
        """

        endpoint = f"{self.agent_url}/api/v1/payment-agent/process"

        payload = {
            "task_type": task_type,
            "field_name": field_name,
            "original_value": original_value,
            "payment_data": payment_data,
            "conversion_context": conversion_context
        }

        logger.info(
            f"Calling payment_agent: task_type={task_type}, "
            f"field={field_name}, url={endpoint}"
        )

        try:
            response = await self.client.post(endpoint, json=payload)
            response.raise_for_status()

            result = response.json()

            logger.info(
                f"Agent completed: {result.get('result', {}).get('new_value')} "
                f"(processing_time={result.get('processing_time_ms')}ms)"
            )

            return result

        except httpx.HTTPError as e:
            logger.error(f"Payment agent request failed: {e}")
            raise

    async def process_payment_stream(
        self,
        task_type: str,
        field_name: str,
        original_value: str,
        payment_data: Dict[str, Any],
        conversion_context: Dict[str, Any]
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream payment processing with real-time updates via SSE.

        This method consumes Server-Sent Events from the payment_agent streaming
        endpoint, yielding parsed events as they arrive in real-time.

        Args:
            task_type: Type of correction (e.g., "japan_transliteration")
            field_name: Field to correct
            original_value: Current value
            payment_data: Full canonical JSON
            conversion_context: Conversion metadata

        Yields:
            Parsed SSE events:
            - Agent state updates: {"supervisor": {...}, "resolution": {...}, "execution": {...}}
            - Completion event: {"type": "complete", "success": true}
            - Error event: {"type": "error", "message": "...", "error_type": "..."}

        Raises:
            httpx.HTTPError: If agent request fails
        """

        endpoint = f"{self.agent_url}/api/v1/payment-agent/process-stream"

        payload = {
            "task_type": task_type,
            "field_name": field_name,
            "original_value": original_value,
            "payment_data": payment_data,
            "conversion_context": conversion_context
        }

        logger.info(
            f"Streaming from payment_agent: task_type={task_type}, "
            f"field={field_name}, url={endpoint}"
        )

        try:
            async with self.client.stream("POST", endpoint, json=payload) as response:
                response.raise_for_status()

                async for line in response.aiter_lines():
                    # SSE format: "data: {json}\n\n"
                    if line.startswith("data: "):
                        try:
                            event_data = json.loads(line[6:])  # Remove "data: " prefix

                            # Log agent transitions
                            if "supervisor" in event_data:
                                logger.info("→ Supervisor completed routing")
                            elif "resolution" in event_data:
                                logger.info("→ Resolution agent completed")
                            elif "execution" in event_data:
                                logger.info("→ Execution agent completed")
                            elif event_data.get("type") == "complete":
                                logger.info("✓ Payment agent workflow completed")
                            elif event_data.get("type") == "error":
                                logger.error(f"✗ Payment agent error: {event_data.get('message')}")

                            yield event_data

                        except json.JSONDecodeError as e:
                            logger.warning(f"Failed to parse SSE event: {line[:100]}... - {e}")
                            continue

        except httpx.HTTPError as e:
            logger.error(f"Payment agent streaming request failed: {e}")
            raise

    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()
