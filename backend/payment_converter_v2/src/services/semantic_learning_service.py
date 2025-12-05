"""
Semantic Learning Service - Auto-generates conversion configs by learning from existing configs.

No separate patterns collection - learns at runtime from stored configs in MongoDB.
Builds combined field-to-mapping lookup from ALL existing configurations.

Supports multiple message formats:
- SWIFT MT: Fields like :20:, :32A:, :50K:
- ISO8583: Pipe-delimited fields (demo format)
"""

import re
import logging
from typing import Dict, List, Any, Optional, Tuple, Set

logger = logging.getLogger(__name__)


class SemanticLearningService:
    """
    Auto-generates conversion configs by learning from ALL existing configs.
    No separate patterns collection - learns at runtime from stored configs.

    Supports SWIFT MT and ISO8583 message formats.
    """

    # SWIFT MT field pattern: :20:, :32A:, :50K:, etc.
    SWIFT_FIELD_PATTERN = r':(\d{2}[A-Z]?):([^\n]*(?:\n(?!:)[^\n]*)*)'

    # ISO8583 pipe-delimited format (demo): 0200|bitmap|pan|proc_code|amount|...
    # Field positions: mti(0), bitmap(1), pan(2), proc_code(3), amount(4), datetime(5),
    #                  stan(6), time(7), date(8), rrn(9), terminal(10), merchant_id(11),
    #                  merchant_info(12), currency(13)
    ISO8583_FIELD_NAMES = [
        "mti", "bitmap", "pan", "processing_code", "amount", "transmission_datetime",
        "stan", "local_time", "local_date", "rrn", "terminal_id", "merchant_id",
        "merchant_info", "currency_code"
    ]

    def __init__(self, mongodb_service):
        """
        Initialize with MongoDB service.

        Args:
            mongodb_service: MongoDBService instance
        """
        self.db = mongodb_service
        self._field_lookup: Optional[Dict[str, Dict[str, Any]]] = None
        self._source_configs: Set[str] = set()
        logger.info("SemanticLearningService initialized")

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
        matched, unknown, learned_from = self._match_fields(detected_fields)
        logger.info(f"Matched {len(matched)} fields, {len(unknown)} unknown")

        # 4. Build new config
        new_config = self._build_config(
            source_format, target_format,
            detected_fields, matched, unknown
        )

        # 5. Calculate confidence
        confidence = len(matched) / len(detected_fields) if detected_fields else 0

        return {
            "configuration_id": new_config["_id"],
            "config": new_config,
            "confidence": round(confidence, 2),
            "fields_detected": len(detected_fields),
            "matched_fields": list(matched.keys()),
            "unknown_fields": unknown,
            "learned_from": learned_from
        }

    async def _build_combined_lookup(self) -> None:
        """
        Load ALL configs from MongoDB and build combined field-to-mapping lookup.

        Result structure:
        {
            "20": {"mapping": {...}, "source_config": "MT103_to_JSON"},
            "32A": {"mapping": {...}, "source_config": "MT103_to_JSON"},
            ...
        }
        """
        # Get all configs from MongoDB
        all_configs = await self.db.list_configs()

        self._field_lookup = {}
        self._source_configs = set()

        for config in all_configs:
            config_id = config.get("_id", "")
            self._source_configs.add(config_id)

            # Get extract patterns from this config
            extract_patterns = config.get("extract", {})

            # Process each mapping
            for mapping in config.get("map", []):
                field_id = mapping.get("from")

                # Skip if field already in lookup (first config wins)
                if field_id and field_id not in self._field_lookup:
                    # has_extract_pattern: True if field has a regex pattern in extract section
                    # This distinguishes source fields (need extraction) from derived fields
                    has_pattern = field_id in extract_patterns
                    self._field_lookup[field_id] = {
                        "mapping": mapping.copy(),
                        "extract_pattern": extract_patterns.get(field_id),
                        "source_config": config_id,
                        "has_extract_pattern": has_pattern
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
            Format identifier: "SWIFT", "ISO8583", or "UNKNOWN"
        """
        # ISO8583 demo format: starts with 0200| or 0100| etc.
        if re.match(r'^0[12]\d{2}\|', message):
            return "ISO8583"

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

    def _match_fields(
        self,
        detected: Dict[str, str]
    ) -> Tuple[Dict[str, Dict], List[str], List[str]]:
        """
        Match detected fields against combined lookup.

        Also includes derived field mappings (like value_date -> value_date with dateFormat)
        when their parent field outputs to that derived field.

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
        unknown: List[str]
    ) -> Dict[str, Any]:
        """
        Build new config in simplified schema {_id, extract, map, output}.

        Only includes matched fields. Unknown fields are excluded from config
        and reported separately for manual review.

        Args:
            source_format: Source format name
            target_format: Target format name
            detected_fields: All detected fields
            matched: Matched field mappings
            unknown: Unknown field IDs (excluded from config)

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

        # Add matched mappings (normalize to consistent format)
        for field_id, mapping in matched.items():
            new_mapping = self._normalize_mapping(mapping)
            map_array.append(new_mapping)

            # Add to output based on "to" field
            to_field = new_mapping.get("to")
            if isinstance(to_field, list):
                for field in to_field:
                    output[field] = field
            elif to_field:
                output[to_field] = to_field

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
                # AI fields use string format (e.g., "to": "remittance_info", "ai": "remittance")
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

    def invalidate_cache(self) -> None:
        """Clear the field lookup cache to force rebuild on next call."""
        self._field_lookup = None
        self._source_configs = set()
        logger.info("SemanticLearningService cache invalidated")
