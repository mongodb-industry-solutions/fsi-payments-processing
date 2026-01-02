"""Transformer - 3-lane field transformation (RULES/AI/HUMAN)"""

import logging
import re
from typing import Dict, Any, List, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)


class Transformer:
    """
    Transform fields through 3-lane processing: RULES, AI, HUMAN.

    Lane detection (controlled by use_ai flag):
    - use_ai=True AND has 'ai' key → AI lane (LLM extraction)
    - use_ai=False AND has 'patterns' key → RULES lane (regex extraction)
    - No 'ai' or 'patterns' key → RULES lane (standard transforms)
    - AI confidence < threshold → HUMAN lane (flagged)
    """
    
    def __init__(self, ai_confidence_threshold: float = 0.8):
        """
        Initialize transformer.
        
        Args:
            ai_confidence_threshold: Confidence threshold for human review (default: 0.8)
        """
        self.ai_confidence_threshold = ai_confidence_threshold
    
    def transform(
        self,
        extracted_fields: Dict[str, Any],
        mappings: List[Dict],
        use_ai: bool = True
    ) -> Tuple[Dict[str, Any], List[Dict]]:
        """
        Apply mappings to extracted fields through 3 lanes.

        Args:
            extracted_fields: Fields extracted from source message
            mappings: List of mapping configurations from MongoDB
            use_ai: If True, use AI lane for mappings with 'ai' key.
                    If False, use 'patterns' key for regex extraction instead.

        Returns:
            Tuple of (internal_fields, ai_fields):
            - internal_fields: RULES lane transformed fields
            - ai_fields: Fields requiring AI processing (empty if use_ai=False)

        Example:
            mappings = [
                {"from": "20", "to": "transaction_ref"},  # RULES
                {"from": "70", "to": ["payment_purpose", "invoice_number", "details"],
                 "ai": "remittance", "patterns": {...}}  # AI or RULES based on use_ai
            ]
        """
        internal_fields = {}
        ai_fields = []

        if not mappings:
            logger.warning("No mappings provided")
            return internal_fields, ai_fields

        for mapping in mappings:
            source = mapping.get('from')
            target = mapping.get('to')

            if not source or not target:
                logger.warning(f"Mapping missing 'from' or 'to': {mapping}")
                continue

            value = extracted_fields.get(source)

            if value is None:
                logger.debug(f"No value found for source field: {source}")
                continue

            # Lane detection based on use_ai flag
            if 'ai' in mapping and use_ai:
                # AI lane - use LLM extraction
                ai_fields.append({
                    'source': source,
                    'target': target,
                    'value': value,
                    'field_type': mapping['ai'],
                    'prompt': mapping.get('prompt', '')
                })
                logger.debug(f"Field {source} → AI lane ({mapping['ai']})")

            elif 'patterns' in mapping:
                # RULES lane with pattern-based extraction (regex)
                targets = target if isinstance(target, list) else [target]
                extracted = self._apply_patterns(value, mapping['patterns'], targets)

                for t in targets:
                    if t in extracted:
                        internal_fields[t] = extracted[t]

                logger.debug(f"Field {source} → RULES lane (patterns) → {targets}")

            # RULES lane (default - standard transforms)
            else:
                transformed = self._apply_transform(value, mapping)

                # Handle multiple targets (composite fields)
                if isinstance(target, list):
                    if isinstance(transformed, list):
                        for i, t in enumerate(target):
                            internal_fields[t] = transformed[i] if i < len(transformed) else None
                    else:
                        # Single value to first target
                        internal_fields[target[0]] = transformed
                else:
                    internal_fields[target] = transformed

                logger.debug(f"Field {source} → RULES lane → {target}")

        logger.info(f"Transformed {len(internal_fields)} RULES fields, {len(ai_fields)} AI fields")
        return internal_fields, ai_fields
    
    def _apply_transform(self, value: Any, mapping: Dict) -> Any:
        """
        Apply transformation based on mapping configuration.
        
        Supports:
        - split: Composite field splitting
        - multiline: Multiline extraction
        - dateFormat: Date conversion
        - valueMap: Value mapping
        - decimal: Decimal formatting
        - Default: Direct copy
        
        Args:
            value: Source field value
            mapping: Mapping configuration
            
        Returns:
            Transformed value (can be single value or list)
        """
        # Split composite field (e.g., 32A → date, currency, amount)
        if 'split' in mapping:
            return self._split_field(value, mapping['split'])
        
        # Multiline extraction (e.g., 50K → account, name)
        elif 'multiline' in mapping:
            return self._extract_multiline(value, mapping)
        
        # Date formatting
        elif 'dateFormat' in mapping:
            return self._format_date(value, mapping['dateFormat'])
        
        # Value mapping
        elif 'valueMap' in mapping:
            return mapping['valueMap'].get(value, value)
        
        # Decimal format
        elif mapping.get('decimal'):
            return self._format_decimal(value)
        
        # Default: direct copy
        return value
    
    def _split_field(self, value: str, indices: List[int]) -> List[str]:
        """
        Split composite field at specified indices.
        
        Args:
            value: Field value to split
            indices: List of split indices (e.g., [6, 9] for 32A)
            
        Returns:
            List of split values
            
        Example:
            _split_field("241215USD10000", [6, 9])
            Returns: ["241215", "USD", "10000"]
        """
        if not value:
            return [''] * (len(indices) + 1)
        
        splits = []
        start = 0
        
        for end in indices:
            splits.append(value[start:end] if len(value) >= end else value[start:])
            start = end
        
        # Add remaining
        splits.append(value[start:] if len(value) > start else '')
        
        return splits
    
    def _extract_multiline(self, value: str, mapping: Dict) -> Any:
        """
        Extract multiline field (account, name, address).
        
        Args:
            value: Multiline field value
            mapping: Mapping configuration with 'to' targets
            
        Returns:
            List if multiple targets, single value otherwise
            
        Example:
            Input: "/CH93007620...\nSWISS PHARMA AG\nZURICH"
            Returns: ["CH93007620...", "SWISS PHARMA AG", "ZURICH"]
        """
        lines = value.split('\n') if value else []
        
        logger.debug(f"Multiline extraction - Input lines: {len(lines)}, Targets: {mapping.get('to')}")
        
        if not lines:
            return ['', ''] if isinstance(mapping['to'], list) else ''
        
        account = ''
        name = ''
        address = ''
        
        # First line: account (may start with /)
        if lines[0]:
            account = lines[0][1:] if lines[0].startswith('/') else lines[0]
        
        # Second line: name
        if len(lines) > 1:
            name = lines[1]
        
        # Remaining lines: address
        if len(lines) > 2:
            address = ' '.join(lines[2:])
        
        logger.debug(f"Extracted - account: '{account}', name: '{name}', address: '{address}'")
        
        # Return based on target structure
        if isinstance(mapping['to'], list):
            targets = mapping['to']
            if len(targets) == 2:
                result = [account, name]
                logger.debug(f"Returning 2 targets: {result}")
                return result
            elif len(targets) == 3:
                result = [account, name, address]
                logger.debug(f"Returning 3 targets: {result}")
                return result
        
        return name or account
    
    def _format_date(self, value: str, date_format: str) -> str:
        """
        Format date from one format to another.
        
        Args:
            value: Date value
            date_format: Format specification (e.g., "YYMMDD->YYYY-MM-DD")
            
        Returns:
            Formatted date string
            
        Example:
            _format_date("241215", "YYMMDD->YYYY-MM-DD")
            Returns: "2024-12-15"
        """
        if not value or '->' not in date_format:
            return value
        
        source_format, target_format = date_format.split('->', 1)
        
        # Handle YYMMDD -> YYYY-MM-DD
        if source_format == "YYMMDD" and len(value) == 6:
            try:
                year = int(value[:2])
                # Assume 00-50 = 2000-2050, 51-99 = 1951-1999
                year = 2000 + year if year <= 50 else 1900 + year
                month = value[2:4]
                day = value[4:6]
                
                if target_format == "YYYY-MM-DD":
                    return f"{year}-{month}-{day}"
                elif target_format == "YYYYMMDD":
                    return f"{year}{month}{day}"
            except (ValueError, IndexError) as e:
                logger.warning(f"Date format error: {e}")
                return value
        
        return value
    
    def _format_decimal(self, value: str) -> str:
        """
        Format decimal value (replace comma with period).

        Args:
            value: Decimal value (e.g., "10000,00")

        Returns:
            Formatted decimal (e.g., "10000.00")
        """
        if not value:
            return value

        return value.replace(',', '.')

    def _apply_patterns(
        self,
        value: str,
        patterns: Dict[str, Dict],
        targets: List[str]
    ) -> Dict[str, Any]:
        """
        Apply regex patterns to extract structured data from unstructured text.

        This is the rules-based alternative to AI extraction, using regex patterns
        defined in the config to extract fields like payment_purpose, invoice_number, etc.

        Args:
            value: Source field value (e.g., field 70 content)
            patterns: Pattern definitions from config, keyed by target field name
            targets: List of target field names to extract

        Returns:
            Dict of target_field -> extracted_value

        Example:
            patterns = {
                "payment_purpose": {"regex": "^(INVOICE|PAYMENT)", "group": 1, "default": "PAYMENT"},
                "invoice_number": {"regex": "([A-Z]{2,}-[A-Z0-9-]+)", "group": 1, "default": ""},
                "details": {"join_lines": ". ", "strip": True}
            }
        """
        result = {}

        for target in targets:
            pattern_config = patterns.get(target, {})

            if 'join_lines' in pattern_config:
                # Special case: join all lines with separator
                separator = pattern_config['join_lines']
                lines = value.strip().split('\n') if value else []
                extracted = separator.join(
                    line.strip() for line in lines if line.strip()
                )
                if pattern_config.get('strip', False):
                    extracted = extracted.strip()

            elif 'regex' in pattern_config:
                # Regex extraction with group capture
                regex_pattern = pattern_config['regex']
                group = pattern_config.get('group', 1)
                default = pattern_config.get('default', '')

                try:
                    match = re.search(regex_pattern, value, re.MULTILINE)
                    if match:
                        extracted = match.group(group)
                    else:
                        extracted = default
                        logger.debug(f"Pattern '{regex_pattern}' did not match for {target}, using default")
                except re.error as e:
                    logger.warning(f"Invalid regex pattern for {target}: {e}")
                    extracted = default
                except IndexError:
                    logger.warning(f"Regex group {group} not found for {target}")
                    extracted = default

            else:
                # No pattern defined, use default or empty
                extracted = pattern_config.get('default', '')

            result[target] = extracted
            logger.debug(
                f"Pattern extracted {target}: '{extracted[:50]}...'"
                if len(str(extracted)) > 50
                else f"Pattern extracted {target}: '{extracted}'"
            )

        return result

    def check_human_review_needed(
        self,
        ai_results: Dict[str, Dict[str, Any]]
    ) -> List[str]:
        """
        Check which AI-processed fields need human review.

        Args:
            ai_results: Dictionary of target_field -> AI result
                Each result contains: {"confidence": 0.85, "data": {...}}
                Note: Keys may be tuples for multi-target fields

        Returns:
            List of field names requiring human review

        Example:
            ai_results = {
                "remittance_info": {"confidence": 0.75, "data": {...}},
                ("payment_purpose", "invoice_number"): {"confidence": 0.90, "data": {...}}
            }
            Returns: ["remittance_info"]  # Below 0.8 threshold
        """
        human_review_fields = []

        for field_key, result in ai_results.items():
            confidence = result.get('confidence', 0.0)

            if confidence < self.ai_confidence_threshold:
                # Convert tuple to readable string for display
                field_name = ', '.join(field_key) if isinstance(field_key, tuple) else field_key
                human_review_fields.append(field_name)
                logger.info(f"Field {field_name} needs human review (confidence: {confidence:.2f})")

        return human_review_fields
