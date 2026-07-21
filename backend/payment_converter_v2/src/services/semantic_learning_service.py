"""
Semantic Learning Service - Auto-generates conversion configs by learning from existing configs.

No separate patterns collection - learns at runtime from stored configs in MongoDB.
Builds combined field-to-mapping lookup from ALL existing configurations.

Supports multiple message formats:
- SWIFT MT: Fields like :20:, :32A:, :50K:
- ISO8583: Pipe-delimited fields (demo format)
- ISO 20022 (MX): XML messages like pacs.008, pacs.009, camt.053
"""

import re
import logging
from typing import Dict, List, Any, Optional, Tuple, Set

logger = logging.getLogger(__name__)


class SemanticLearningService:
    """
    Auto-generates conversion configs by learning from ALL existing configs.
    No separate patterns collection - learns at runtime from stored configs.

    Supports SWIFT MT, ISO8583, and ISO 20022 (MX) message formats.
    """

    # SWIFT MT field pattern: :20:, :32A:, :50K:, etc.
    SWIFT_FIELD_PATTERN = r':(\d{2}[A-Z]?):([^\n]*(?:\n(?!:)[^\n]*)*)'

    # ISO8583 pipe-delimited format (demo): 0200|bitmap|pan|proc_code|amount|...
    # Field positions: mti(0), bitmap(1), pan(2), processingCode(3), amount(4),
    #                  transmissionDateTime(5), stan(6), localTime(7), localDate(8),
    #                  rrn(9), terminalId(10), merchantId(11), merchantInfo(12),
    #                  currencyCode(13). Field IDs are camelCase to match canonical JSON.
    ISO8583_FIELD_NAMES = [
        "mti", "bitmap", "pan", "processingCode", "amount", "transmissionDateTime",
        "stan", "localTime", "localDate", "rrn", "terminalId", "merchantId",
        "merchantInfo", "currencyCode"
    ]

    # ISO 20022 XML detection patterns
    ISO20022_NAMESPACE_PATTERN = r'xmlns[^>]*iso:std:iso:20022'
    ISO20022_DOCTYPE_PATTERN = r'<Document[^>]*>'
    ISO20022_MESSAGE_PATTERN = r'<(FIToFICstmrCdtTrf|FICdtTrf|BkToCstmrStmt|PmtRtr|CardTx)'

    def __init__(self, mongodb_service, llm_field_mapper=None):
        """
        Initialize with MongoDB service and optional LLM field mapper.

        Args:
            mongodb_service: MongoDBService instance
            llm_field_mapper: Optional LLMFieldMapper instance for unknown field suggestions
        """
        self.db = mongodb_service
        self.llm_mapper = llm_field_mapper
        self._field_lookup: Optional[Dict[str, Dict[str, Any]]] = None
        self._source_configs: Set[str] = set()
        logger.info(f"SemanticLearningService initialized (LLM mapper: {'enabled' if llm_field_mapper else 'disabled'})")

    async def generate_config(
        self,
        source_format: str,
        target_format: str,
        sample_message: str
    ) -> Dict[str, Any]:
        """
        Generate a conversion config by learning from ALL existing configs.

        Args:
            source_format: Source format (e.g., "MT202")
            target_format: Target format (e.g., "JSON")
            sample_message: Sample message to extract fields from

        Returns:
            Dictionary with generated config and metadata
        """
        logger.info(f"Generating config for {source_format}_to_{target_format}")

        # 1. Load ALL existing configs and build combined lookup
        await self._build_combined_lookup()

        # 2. Extract fields from sample message
        detected_fields = self._extract_fields(sample_message)
        logger.info(f"Detected {len(detected_fields)} fields from sample")

        if not detected_fields:
            raise ValueError("No fields detected in sample message")

        # 3. Match detected fields against combined lookup
        # matched includes both source fields and derived fields (for config building)
        matched, unknown, learned_from = self._match_fields(detected_fields)
        logger.info(f"Matched {len(matched)} fields ({len(unknown)} unknown) from {len(detected_fields)} source fields")

        # 4. Get LLM suggestions for unknown fields (included in config, marked ai_suggested: true)
        suggestions = []
        prompt_info = None
        if unknown and self.llm_mapper:
            try:
                # Build unknown field info with values
                unknown_with_values = [
                    {"field_id": f, "value": detected_fields.get(f, "")}
                    for f in unknown
                ]

                # Extract already-mapped target fields to avoid duplicate suggestions
                already_mapped_targets = []
                for mapping in matched.values():
                    to_field = mapping.get("to")
                    if isinstance(to_field, list):
                        already_mapped_targets.extend(to_field)
                    elif to_field:
                        already_mapped_targets.append(to_field)

                # Get LLM suggestions (returns dict with suggestions and prompt_info)
                llm_result = await self.llm_mapper.suggest_mappings(
                    unknown_with_values,
                    target_format,
                    source_format,
                    already_mapped_targets
                )
                suggestions = llm_result.get("suggestions", [])
                prompt_info = llm_result.get("prompt_info")
                logger.info(f"LLM provided {len(suggestions)} suggestions for unknown fields")
            except Exception as e:
                logger.warning(f"LLM suggestion failed: {e}")
                suggestions = []

        # 5. Get target format spec for output paths
        target_format_spec = await self.db.get_format_specification(target_format)

        # 6. Build new config (includes matched fields + AI-suggested mappings for unknown fields)
        new_config = self._build_config(
            source_format, target_format,
            detected_fields, matched, unknown,
            target_format_spec,
            suggestions=suggestions
        )

        # 7. Count target fields — how much of the target format did we cover?

        # Target fields mapped from pattern-matched source fields (exclude derived)
        target_fields_mapped = 0
        for field_id, mapping in matched.items():
            if field_id in detected_fields:  # Source fields only, not derived
                to_field = mapping.get("to")
                if isinstance(to_field, list):
                    target_fields_mapped += len(to_field)
                elif to_field:
                    target_fields_mapped += 1

        # Target fields covered by AI suggestions for unknown source fields
        target_fields_ai = 0
        for suggestion in suggestions:
            to_field = suggestion.get("suggested_mapping", {}).get("to", [])
            if isinstance(to_field, list):
                target_fields_ai += len(to_field)
            elif to_field:
                target_fields_ai += 1

        # Total target fields from format specification
        target_fields_required = 0
        if target_format_spec:
            target_fields_required = len(target_format_spec.get("supported_fields", {}))

        # Source-only matched fields list (for unknown fields display)
        source_matched_fields = [f for f in matched.keys() if f in detected_fields]

        # Collect covered target field names
        covered_target_fields = set()
        for field_id, mapping in matched.items():
            if field_id in detected_fields:
                to_field = mapping.get("to")
                if isinstance(to_field, list):
                    covered_target_fields.update(to_field)
                elif to_field:
                    covered_target_fields.add(to_field)
        for suggestion in suggestions:
            to_field = suggestion.get("suggested_mapping", {}).get("to", [])
            if isinstance(to_field, list):
                covered_target_fields.update(to_field)
            elif to_field:
                covered_target_fields.add(to_field)

        # Not covered = target fields with no source or AI mapping
        all_target_fields = set(target_format_spec.get("supported_fields", {}).keys()) if target_format_spec else set()
        not_covered_fields = sorted(all_target_fields - covered_target_fields)

        # Confidence = target coverage rate (mapped + ai) / required
        confidence = (target_fields_mapped + target_fields_ai) / target_fields_required if target_fields_required > 0 else 0

        return {
            "configurationId": new_config["_id"],
            "config": new_config,
            "confidence": round(confidence, 2),
            "sourceFieldsIdentified": len(detected_fields),
            "targetFieldsRequired": target_fields_required,
            "targetFieldsMapped": target_fields_mapped,
            "targetFieldsAi": target_fields_ai,
            "matchedFields": source_matched_fields,
            "unknownFields": unknown,
            "learnedFrom": learned_from,
            "notCoveredFields": not_covered_fields,
            "suggestions": suggestions,
            "llmPromptInfo": prompt_info
        }

    async def _build_combined_lookup(self) -> None:
        """
        Load field lookup from MongoDB using aggregation pipeline.

        Always fetches fresh data - no caching.
        Uses database-level aggregation for efficient processing.

        Result structure:
        {
            "20": {"mapping": {...}, "source_config": "MT103_to_JSON", "has_extract_pattern": True},
            "32A": {"mapping": {...}, "source_config": "MT103_to_JSON", "has_extract_pattern": True},
            ...
        }
        """
        # Use aggregation pipeline - always fresh, no caching
        self._field_lookup = await self.db.get_field_lookup()

        # Build source_configs set from lookup values
        self._source_configs = {
            info["source_config"]
            for info in self._field_lookup.values()
        }

        logger.info(
            f"Built lookup with {len(self._field_lookup)} fields "
            f"from {len(self._source_configs)} configs"
        )

    def _detect_format(self, message: str) -> str:
        """
        Detect message format from content.

        Args:
            message: Raw message string

        Returns:
            Format identifier: "SWIFT", "ISO8583", "ISO20022", or "UNKNOWN"
        """
        # ISO8583 demo format: starts with 0200| or 0100| etc.
        if re.match(r'^0[12]\d{2}\|', message):
            return "ISO8583"

        # ISO 20022 (MX) XML format - check BEFORE SWIFT because XML can contain :XX: in data
        # (e.g., timestamps like 10:30:00Z contain :30: which matches SWIFT pattern)
        if (re.search(self.ISO20022_DOCTYPE_PATTERN, message) or
            re.search(self.ISO20022_NAMESPACE_PATTERN, message) or
            re.search(self.ISO20022_MESSAGE_PATTERN, message)):
            return "ISO20022"

        # Generic XML detection - check before SWIFT
        if message.strip().startswith('<?xml') or (
            message.strip().startswith('<') and '</Document>' in message
        ):
            return "ISO20022"

        # SWIFT MT format: has block structure {1:...}{2:...} or field tags :XX:
        if re.search(r'\{[1-4]:', message) or re.search(r':\d{2}[A-Z]?:', message):
            return "SWIFT"

        return "UNKNOWN"

    def _extract_fields(self, message: str) -> Dict[str, str]:
        """
        Extract fields from message based on detected format.

        Supports:
        - SWIFT MT: :20:, :32A:, :50K: format
        - ISO8583: Pipe-delimited demo format
        - ISO20022: XML with patterns from existing configs

        Args:
            message: Raw message string

        Returns:
            Dictionary of field_id -> value
        """
        msg_format = self._detect_format(message)
        logger.info(f"Detected message format: {msg_format}")

        if msg_format == "ISO8583":
            return self._extract_iso8583_fields(message)
        elif msg_format == "SWIFT":
            return self._extract_swift_fields(message)
        elif msg_format == "ISO20022":
            return self._extract_iso20022_fields(message)
        else:
            # Try SWIFT as default fallback
            logger.warning("Unknown format, attempting SWIFT extraction")
            return self._extract_swift_fields(message)

    def _extract_swift_fields(self, message: str) -> Dict[str, str]:
        """
        Extract SWIFT MT fields using :XX: pattern.

        Args:
            message: Raw SWIFT message

        Returns:
            Dictionary of field_id -> value (e.g., {"20": "REF123", "32A": "241215EUR500000,00"})
        """
        fields = {}
        matches = re.findall(self.SWIFT_FIELD_PATTERN, message)

        for field_id, value in matches:
            clean_value = value.strip()
            fields[field_id] = clean_value

        return fields

    def _extract_iso8583_fields(self, message: str) -> Dict[str, str]:
        """
        Extract ISO8583 fields from pipe-delimited demo format.

        Args:
            message: Pipe-delimited ISO8583 message

        Returns:
            Dictionary of field_name -> value (e.g., {"pan": "4539...", "amount": "000000025000"})
        """
        fields = {}
        parts = message.strip().split('|')

        for i, value in enumerate(parts):
            if i < len(self.ISO8583_FIELD_NAMES):
                field_name = self.ISO8583_FIELD_NAMES[i]
                if value:  # Skip empty values
                    fields[field_name] = value.strip()

        return fields

    def _extract_iso20022_fields(self, message: str) -> Dict[str, str]:
        """
        Extract ISO 20022 (MX) fields from XML message.

        Two-phase extraction (similar to SWIFT which extracts ALL :XX: fields):
        1. Extract using learned patterns from _field_lookup (field_id as key)
        2. Extract ALL leaf elements from XML (tag name as key for unknown discovery)

        Args:
            message: ISO 20022 XML message

        Returns:
            Dictionary of field_id -> value (e.g., {"messageId": "MSG001", "RtrId": "RTN001"})
        """
        fields = {}
        extracted_values = set()  # Track values already extracted to avoid duplicates

        # Phase 1: Apply learned patterns from existing configs
        if self._field_lookup:
            for field_id, info in self._field_lookup.items():
                pattern = info.get("extract_pattern")
                if not pattern:
                    continue

                # Only use XML patterns (they start with '<' or contain XML tags)
                if not (pattern.startswith('<') or '<' in pattern):
                    continue

                try:
                    match = re.search(pattern, message, re.DOTALL)
                    if match:
                        value = match.group(1).strip()
                        if value:
                            fields[field_id] = value
                            extracted_values.add(value)  # Track extracted value
                            logger.debug(f"Extracted {field_id}: {value[:50]}...")
                except re.error as e:
                    logger.warning(f"Invalid regex pattern for {field_id}: {e}")
                    continue

        # Phase 2: Extract ALL leaf elements (like SWIFT extracts all :XX: fields)
        # This discovers fields that don't have patterns yet
        leaf_pattern = r'<(\w+)>([^<]+)</\1>'
        for match in re.finditer(leaf_pattern, message):
            tag_name = match.group(1)
            value = match.group(2).strip()

            # Skip if already extracted by a learned pattern (same tag or same value)
            if tag_name in fields:
                continue

            # Skip if this value was already extracted by a Phase 1 pattern
            # This avoids duplicates like MsgId when message_id already has the value
            if value in extracted_values:
                continue

            # Skip empty values
            if not value:
                continue

            # Use tag name as field_id (will be unknown if not in _field_lookup)
            fields[tag_name] = value
            extracted_values.add(value)

        logger.info(f"Extracted {len(fields)} ISO20022 fields")
        return fields

    def _match_fields(
        self,
        detected: Dict[str, str]
    ) -> Tuple[Dict[str, Dict], List[str], List[str]]:
        """
        Match detected fields against combined lookup.

        Also includes derived field mappings (like value_date -> value_date with dateFormat)
        when their parent field outputs to that derived field. Derived fields are included
        in the config but excluded from match/unknown counts since they aren't source fields.

        Args:
            detected: Dictionary of detected field_id -> value

        Returns:
            Tuple of (matched_mappings, unknown_fields, learned_from_configs)
        """
        matched = {}
        unknown = []
        learned_from = set()
        output_fields = set()  # Track all output fields from matched mappings

        # First pass: match SWIFT fields from message
        for field_id in detected:
            if field_id in self._field_lookup:
                matched[field_id] = self._field_lookup[field_id]["mapping"]
                learned_from.add(self._field_lookup[field_id]["source_config"])

                # Collect output fields from this mapping
                to_field = self._field_lookup[field_id]["mapping"].get("to")
                if isinstance(to_field, list):
                    output_fields.update(to_field)
                elif to_field:
                    output_fields.add(to_field)
            else:
                unknown.append(field_id)

        # Second pass: find self-transform mappings with actual transformations
        # e.g., value_date -> value_date with dateFormat
        # Skip passthrough mappings (from == to with no transformation)
        # These are included in the config but NOT counted as matched source fields
        transform_keys = {"dateFormat", "split", "multiline", "ai", "transform"}

        for field_id, info in self._field_lookup.items():
            # Derived fields: don't have extract patterns (not directly from source message)
            if not info.get("has_extract_pattern") and field_id in output_fields:
                mapping = info["mapping"]
                to_field = mapping.get("to")

                # Check if this is a self-transform (from == to)
                is_self_transform = False
                if isinstance(to_field, list) and len(to_field) == 1 and to_field[0] == field_id:
                    is_self_transform = True
                elif isinstance(to_field, str) and to_field == field_id:
                    is_self_transform = True

                # Only include if it has actual transformation logic
                has_transform = bool(transform_keys & set(mapping.keys()))

                if is_self_transform and has_transform and field_id not in matched:
                    matched[field_id] = mapping
                    learned_from.add(info["source_config"])

        return matched, unknown, sorted(list(learned_from))

    def _build_config(
        self,
        source_format: str,
        target_format: str,
        detected_fields: Dict[str, str],
        matched: Dict[str, Dict],
        unknown: List[str],
        target_format_spec: Optional[Dict[str, Any]] = None,
        suggestions: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Build new config in simplified schema {_id, extract, map, output}.

        Includes matched fields and LLM-suggested mappings for unknown fields.
        All mappings use the standard config schema (from, to, split, multiline, ai, patterns).

        Args:
            source_format: Source format name
            target_format: Target format name
            detected_fields: All detected fields
            matched: Matched field mappings
            unknown: Unknown field IDs
            target_format_spec: Optional format specification for output paths
            suggestions: LLM-suggested mappings for unknown fields

        Returns:
            Complete configuration dictionary
        """
        config_id = f"{source_format}_to_{target_format}"

        # Build extract patterns only for source fields (not derived fields like value_date)
        extract = {}
        for field_id in matched.keys():
            # Skip derived fields - they don't need extract patterns
            if field_id in self._field_lookup and not self._field_lookup[field_id].get("has_extract_pattern"):
                continue

            # Use learned pattern from existing config
            if field_id in self._field_lookup and self._field_lookup[field_id].get("extract_pattern"):
                extract[field_id] = self._field_lookup[field_id]["extract_pattern"]
            else:
                # Fallback: generate pattern (only works for SWIFT fields)
                pattern = self._generate_extract_pattern(field_id)
                if pattern:
                    extract[field_id] = pattern
                # If pattern is None, field will be in unknown_fields for manual review

        # Build map array
        map_array = []
        output = {}

        # Get supported fields from format spec for output path lookup
        supported_fields = {}
        if target_format_spec:
            supported_fields = target_format_spec.get("supported_fields", {})

        # Add matched mappings (normalize to consistent format)
        for field_id, mapping in matched.items():
            new_mapping = self._normalize_mapping(mapping)
            map_array.append(new_mapping)

            # Add to output based on "to" field, using format spec paths when available
            to_field = new_mapping.get("to")
            if isinstance(to_field, list):
                for field in to_field:
                    # Look up actual path from format spec, fallback to field name
                    if field in supported_fields:
                        output[field] = supported_fields[field].get("path", field)
                    else:
                        output[field] = field
            elif to_field:
                if to_field in supported_fields:
                    output[to_field] = supported_fields[to_field].get("path", to_field)
                else:
                    output[to_field] = to_field

        # Include LLM-suggested mappings for unknown fields
        # Uses the same schema as all other mappings (from, to)
        if suggestions:
            for suggestion in suggestions:
                field_id = suggestion.get("field_id")
                suggested_mapping = suggestion.get("suggested_mapping", {})
                target_info = suggestion.get("target_field_info", {})

                if not field_id or not suggested_mapping:
                    continue

                # Add extract pattern for the unknown field
                if field_id not in extract:
                    pattern = self._generate_extract_pattern(field_id)
                    if pattern:
                        extract[field_id] = pattern

                # Build mapping entry using standard config schema
                new_mapping = {
                    "from": suggested_mapping.get("from", field_id),
                    "to": suggested_mapping.get("to", [])
                }
                map_array.append(new_mapping)

                # Add to output using target field path
                to_fields = suggested_mapping.get("to", [])
                if isinstance(to_fields, list):
                    for field in to_fields:
                        if field in supported_fields:
                            output[field] = supported_fields[field].get("path", field)
                        elif target_info.get("path"):
                            output[field] = target_info["path"]
                        else:
                            output[field] = field
                elif to_fields:
                    if to_fields in supported_fields:
                        output[to_fields] = supported_fields[to_fields].get("path", to_fields)
                    elif target_info.get("path"):
                        output[to_fields] = target_info["path"]
                    else:
                        output[to_fields] = to_fields

                logger.info(f"Included LLM-suggested mapping: {field_id} → {suggested_mapping.get('to')}")

        return {
            "_id": config_id,
            "extract": extract,
            "map": map_array,
            "output": output
        }

    def _normalize_mapping(self, mapping: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normalize a mapping to consistent format.

        - Ensures 'to' is always an array (except for AI fields which use string)
        - Removes any internal markers

        Args:
            mapping: Original mapping from source config

        Returns:
            Normalized mapping
        """
        new_mapping = {}

        for key, value in mapping.items():
            # Skip internal markers
            if key.startswith("_"):
                continue

            # Normalize 'to' field
            if key == "to":
                # AI fields use string format (e.g., "to": "remittanceInfo", "ai": "remittance")
                if "ai" in mapping:
                    new_mapping[key] = value
                # All other fields use array format
                elif isinstance(value, str):
                    new_mapping[key] = [value]
                else:
                    new_mapping[key] = value
            else:
                new_mapping[key] = value

        return new_mapping

    def _generate_extract_pattern(self, field_id: str) -> str:
        """
        Generate a fallback regex extraction pattern when no learned pattern exists.

        Currently only supports SWIFT MT format. ISO8583 patterns are too complex
        (position-based) to auto-generate - they must be learned from existing configs.

        Args:
            field_id: Field ID (e.g., "20", "32A", "50K" for SWIFT)

        Returns:
            Regex pattern string, or None if can't generate
        """
        # Check if this looks like a SWIFT field ID
        if re.match(r'^\d{2}[A-Z]?$', field_id):
            # SWIFT: Use multiline pattern (captures until next field marker)
            return f":{field_id}:([^\\n]*(?:\\n(?!:)[^\\n]*)*)"

        # For non-SWIFT fields (like ISO8583), can't auto-generate
        # These must be learned from existing configs
        logger.warning(f"Cannot generate extract pattern for non-SWIFT field: {field_id}")
        return None
