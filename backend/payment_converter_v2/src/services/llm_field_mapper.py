"""LLM Field Mapper Service - Suggests field mappings for unknown source fields.

Uses LLM to suggest mappings constrained by target format's supported fields.
Suggestions are display-only, not auto-integrated into configs.
"""

import json
import logging
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)


class LLMFieldMapper:
    """
    Uses LLM to suggest field mappings for unknown source fields.

    Suggestions are display-only - shown to users as hints for manual review.
    NOT auto-integrated into configs.
    """

    # Claude model for field mapping suggestions
    MODEL_ID = "anthropic.claude-3-haiku-20240307-v1:0"

    def __init__(self, mongodb_service, bedrock_service):
        """
        Initialize LLM field mapper.

        Args:
            mongodb_service: MongoDBService instance for format specs lookup
            bedrock_service: BedrockService instance for LLM calls
        """
        self.db = mongodb_service
        self.bedrock = bedrock_service
        logger.info("LLMFieldMapper initialized")

    async def suggest_mappings(
        self,
        unknown_fields: List[Dict[str, str]],
        target_format: str,
        source_format: str,
        already_mapped_targets: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Suggest mappings for unknown fields (display-only).

        Args:
            unknown_fields: List of unknown field info
                           [{"field_id": "13C", "value": "/CLSTIME/1800+0100"}, ...]
            target_format: Target format ID (e.g., "pacs.009", "JSON")
            source_format: Source format name (e.g., "MT205")
            already_mapped_targets: List of target field names already used by matched fields

        Returns:
            List of suggestions for user to review:
            [
                {
                    "field_id": "13C",
                    "field_value": "/CLSTIME/1800+0100",
                    "suggested_mapping": {
                        "from": "13C",
                        "to": ["settlement_time"]
                    },
                    "target_field_info": {
                        "name": "settlement_time",
                        "path": "...",
                        "description": "..."
                    },
                    "reasoning": "..."
                }
            ]
        """
        if not unknown_fields:
            return []

        # Get target format specification
        target_spec = await self.db.get_format_specification(target_format)
        if not target_spec:
            logger.warning(f"No format spec for {target_format}, cannot suggest mappings")
            return []

        supported_fields = target_spec.get("supported_fields", {})
        if not supported_fields:
            logger.warning(f"Format spec {target_format} has no supported_fields")
            return []

        # Build and call LLM
        prompt = self._build_prompt(
            unknown_fields, supported_fields, source_format, target_format,
            already_mapped_targets or []
        )

        try:
            response = self.bedrock.invoke_model(
                model_id=self.MODEL_ID,
                prompt=prompt,
                max_tokens=2000,
                temperature=0.1
            )

            # Extract text from response
            response_text = response.get("content", [{}])[0].get("text", "")

            # Parse and validate suggestions
            suggestions = self._parse_suggestions(response_text, unknown_fields, supported_fields)

            logger.info(f"LLM suggested {len(suggestions)} mappings for {len(unknown_fields)} unknown fields")
            return suggestions

        except Exception as e:
            logger.error(f"Error getting LLM suggestions: {e}")
            return []

    def _build_prompt(
        self,
        unknown_fields: List[Dict[str, str]],
        supported_fields: Dict[str, Dict],
        source_format: str,
        target_format: str,
        already_mapped_targets: List[str]
    ) -> str:
        """Build LLM prompt with field constraints."""
        # Format supported fields list, marking already-mapped ones
        fields_list = []
        available_fields = []
        for field_name, info in supported_fields.items():
            desc = info.get("description", "")
            path = info.get("path", "")
            if field_name in already_mapped_targets:
                fields_list.append(f"  - {field_name}: {desc} (path: {path}) [ALREADY MAPPED - DO NOT USE]")
            else:
                fields_list.append(f"  - {field_name}: {desc} (path: {path})")
                available_fields.append(field_name)

        supported_fields_text = "\n".join(fields_list)

        # Format unknown fields
        unknown_fields_text = json.dumps(unknown_fields, indent=2)

        # Add warning about already-mapped fields if any
        already_mapped_warning = ""
        if already_mapped_targets:
            already_mapped_warning = f"""
IMPORTANT: The following target fields are ALREADY MAPPED by other source fields and must NOT be suggested:
{', '.join(already_mapped_targets)}

Choose from the AVAILABLE fields only."""

        return f"""You are a payment message expert. Analyze unknown fields and suggest mappings to target format fields.

SOURCE FORMAT: {source_format}
TARGET FORMAT: {target_format}

UNKNOWN FIELDS (field_id and sample value):
{unknown_fields_text}

TARGET FORMAT SUPPORTED FIELDS (you MUST choose from these, or "NONE" if no match):
{supported_fields_text}
{already_mapped_warning}

For each unknown field, analyze its:
1. Field ID pattern (e.g., SWIFT field tags like 13C, 23B)
2. Sample value structure and content
3. Semantic meaning in payment context

Then suggest the best matching target field from the AVAILABLE list above.

Respond ONLY with a JSON array. For each field:
- "field_id": the unknown field ID
- "suggested_to": target field name from the list (or "NONE" if no match)
- "reasoning": brief explanation (1-2 sentences)

Example response:
[
  {{"field_id": "13C", "suggested_to": "settlement_time", "reasoning": "Field 13C with /CLSTIME/ prefix indicates CLS settlement time window."}}
]

JSON response:"""

    def _parse_suggestions(
        self,
        response_text: str,
        unknown_fields: List[Dict[str, str]],
        supported_fields: Dict[str, Dict]
    ) -> List[Dict[str, Any]]:
        """Parse and validate LLM response."""
        suggestions = []

        # Try to extract JSON from response
        try:
            # Find JSON array in response
            start = response_text.find("[")
            end = response_text.rfind("]") + 1
            if start == -1 or end == 0:
                logger.warning("No JSON array found in LLM response")
                return []

            json_text = response_text[start:end]
            raw_suggestions = json.loads(json_text)

            if not isinstance(raw_suggestions, list):
                logger.warning("LLM response is not a list")
                return []

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}")
            return []

        # Build lookup for unknown fields
        field_values = {f["field_id"]: f.get("value", "") for f in unknown_fields}

        # Process each suggestion
        for raw in raw_suggestions:
            field_id = raw.get("field_id")
            suggested_to = raw.get("suggested_to")
            reasoning = raw.get("reasoning", "")

            # Skip if no match suggested
            if not field_id or not suggested_to or suggested_to == "NONE":
                continue

            # Validate suggested field exists in target format
            if suggested_to not in supported_fields:
                logger.warning(f"LLM suggested invalid field: {suggested_to}")
                continue

            # Get target field info
            target_info = supported_fields[suggested_to]

            suggestion = {
                "field_id": field_id,
                "field_value": field_values.get(field_id, ""),
                "suggested_mapping": {
                    "from": field_id,
                    "to": [suggested_to]
                },
                "target_field_info": {
                    "name": suggested_to,
                    "path": target_info.get("path", ""),
                    "description": target_info.get("description", "")
                },
                "reasoning": reasoning
            }

            suggestions.append(suggestion)

        return suggestions
