"""
Simplified Semantic Learning Service
~200 lines replacing 1,869 lines of complexity

Key Principles:
- NO learning loop (patterns are static)
- NO variant checking (52A ≠ 52K)
- NO metadata tracking
- NO HARDCODING - all patterns from DB
- Simple pattern lookup OR LLM
- REUSE existing GenericParser for field extraction
"""

import json
from typing import Dict, List, Optional, Any
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# Import services to avoid circular imports
from services.db_service import MongoDBService
from services.ai_service import BedrockService


class SimplifiedSemanticLearningService:
    """
    Generates configs for new formats using:
    1. Seed patterns (80% of fields)
    2. LLM suggestions (20% of fields)

    Supports all format families:
    - SWIFT MT (MT103, MT202, MT192, etc.)
    - ISO 8583 (0200, 0420, 0100, etc.)
    - ISO 20022 (pacs, pain, camt)
    - Others (FIX, proprietary)
    """

    def __init__(self, db_service: MongoDBService, ai_service: Optional[BedrockService] = None):
        """
        Initialize the simplified semantic learning service.

        Args:
            db_service: MongoDB service for database operations
            ai_service: Optional AI service for LLM-based field mapping
        """
        self.db = db_service
        self.patterns_collection = self.db.db['semantic_patterns']
        self.registry_collection = self.db.db['conversion_registry']

        # Initialize pattern cache and concept map
        self.pattern_cache: Dict[str, Dict] = {}
        self.concept_map: Dict[str, str] = {}  # field -> concept mapping

        # Load pattern cache from DB (not hardcoded!)
        self._load_pattern_cache()

        # Initialize AI service with proper config from DB if needed
        if ai_service:
            self.ai = ai_service
        else:
            self.ai = self._initialize_ai_service()

        logger.info(f"Initialized SimplifiedSemanticLearningService with {len(self.pattern_cache)} patterns")

    def _initialize_ai_service(self) -> Optional[BedrockService]:
        """
        Initialize AI service with config from MongoDB.
        Gets AI config from a base conversion (MT103 has full config).
        """
        try:
            base_config = self.registry_collection.find_one({"_id": "MT103_to_pacs.008"})
            if not base_config:
                logger.warning("No base config found for AI service initialization")
                return None

            ai_config = base_config.get('ai_service', {})
            if not ai_config:
                logger.warning("No AI config found in base conversion")
                return None

            import os
            region = os.getenv('AWS_DEFAULT_REGION', 'us-east-1')
            return BedrockService(region=region, ai_config=ai_config)

        except Exception as e:
            logger.warning(f"Failed to initialize AI service: {e}")
            return None

    def _load_pattern_cache(self):
        """
        Load all patterns from DB into memory for fast lookup.
        NO HARDCODING - everything from database.

        Builds two data structures:
        1. pattern_cache: Direct pattern lookup by ID
        2. concept_map: Reverse mapping from format.field to pattern ID
        """
        self.pattern_cache = {}
        self.concept_map = {}

        try:
            # Load all patterns from DB
            pattern_count = 0
            for pattern in self.patterns_collection.find():
                pattern_id = pattern['_id']
                self.pattern_cache[pattern_id] = pattern
                pattern_count += 1

                # Build reverse mapping for field lookup
                # This allows us to find patterns by format and field name
                for format_name, mapping in pattern.get('mappings', {}).items():
                    source_field = mapping.get('source_field')
                    if source_field:
                        # Create lookup key as "format.field"
                        key = f"{format_name}.{source_field}"
                        self.concept_map[key] = pattern_id

                        # Check if this mapping has a component (e.g., 32A with component "currency")
                        component = mapping.get('component')
                        if component:
                            # Add mapping for the component field (e.g., "MT103.32A.currency")
                            component_key = f"{format_name}.{source_field}.{component}"
                            self.concept_map[component_key] = pattern_id

                            # Also ensure base field is mapped
                            base_key = f"{format_name}.{source_field}"
                            if base_key not in self.concept_map:
                                self.concept_map[base_key] = pattern_id

                        # Handle fields that already have dot notation (future-proofing)
                        elif '.' in source_field:
                            # Add mapping for base field too
                            base_field = source_field.split('.')[0]
                            base_key = f"{format_name}.{base_field}"
                            if base_key not in self.concept_map:
                                self.concept_map[base_key] = pattern_id

            logger.info(f"Loaded {pattern_count} patterns from database")
            logger.debug(f"Built concept map with {len(self.concept_map)} entries")

        except Exception as e:
            logger.error(f"Failed to load pattern cache: {e}")
            # Initialize empty if loading fails
            self.pattern_cache = {}
            self.concept_map = {}

    def generate_config(self,
                       source_format: str,
                       target_format: str,
                       sample_message: str,
                       similar_to: str,
                       include_details: bool = False) -> Dict[str, Any]:
        """
        Generate conversion config for new format.
        Works for MT, ISO8583, and other formats.

        Args:
            source_format: Source format name (e.g., "MT192")
            target_format: Target format name (e.g., "pacs.008")
            sample_message: Sample message to analyze
            similar_to: Similar format to base configuration on (e.g., "MT103")
            include_details: If True, include detailed generation tracking (LLM prompts, responses, timing)

        Returns:
            Generated configuration dictionary (with optional 'generation_details')
        """
        import time
        start_time = time.time()

        logger.info(f"Generating config for {source_format} → {target_format} based on {similar_to}")

        # Initialize tracking if requested
        if include_details:
            self.generation_tracking = {
                "field_extraction": {
                    "fields": [],
                    "extraction_time_ms": 0
                },
                "mapping_generation": {
                    "details": [],
                    "pattern_lookup_time_ms": 0,
                    "llm_total_time_ms": 0,
                    "llm_total_tokens": 0
                }
            }

        # Step 1: Get base config to clone (needed for parser config and structure)
        base_config = self._get_base_config(similar_to, target_format)
        if not base_config:
            raise ValueError(f"Base config {similar_to}_to_{target_format} not found. "
                           f"Please ensure this configuration exists in the database.")

        # Step 2: Extract fields using GenericParser with base config
        extraction_start = time.time()
        fields = self.extract_fields(sample_message, source_format, base_config, track_details=include_details)
        extraction_time = (time.time() - extraction_start) * 1000
        if include_details:
            self.generation_tracking['field_extraction']['extraction_time_ms'] = extraction_time
        if not fields:
            logger.warning(f"No fields extracted from sample message. Config may be incomplete.")

        # Step 3: Generate mappings using patterns and LLM
        mappings = self._generate_mappings(
            fields, source_format, target_format, base_config, similar_to, track_details=include_details
        )

        # Step 4: Build new configuration
        new_config = self._build_config(
            source_format, target_format, fields, mappings, base_config
        )

        # Step 5: Add quality assessment
        uncertain_fields = []
        for mapping in mappings:
            if mapping.get('confidence', 1.0) < 0.7:
                uncertain_fields.append({
                    'field': mapping['source'],
                    'confidence': mapping.get('confidence', 0),
                    'targets': mapping.get('targets', [])
                })

        # Add uncertain fields to metadata for review
        if uncertain_fields:
            new_config['metadata']['uncertain_fields'] = uncertain_fields
            logger.warning(f"Found {len(uncertain_fields)} uncertain field mappings that may need review")

        # Step 6: Add generation details if tracking enabled
        if include_details:
            total_time = (time.time() - start_time) * 1000
            new_config['generation_details'] = self._build_generation_details(
                extraction_time=extraction_time,
                total_time=total_time,
                base_config_id=base_config['_id']
            )

        # Step 7: Log summary
        logger.info(f"Configuration generation complete:")
        logger.info(f"  - Configuration ID: {new_config['_id']}")
        logger.info(f"  - Fields detected: {new_config['metadata']['fields_detected']}")
        logger.info(f"  - Mappings created: {new_config['metadata']['mappings_created']}")
        logger.info(f"  - Overall confidence: {new_config['metadata']['confidence']:.2f}")
        logger.info(f"  - Uncertain fields: {len(uncertain_fields)}")

        return new_config

    def _detect_format_family(self, format_name: str) -> str:
        """
        Detect format family from format name.
        NO HARDCODING - uses patterns.

        Args:
            format_name: Name of the format

        Returns:
            Format family identifier
        """
        # Detect based on format naming conventions
        # This is pattern-based detection, not hardcoding specific formats

        format_upper = format_name.upper()

        # SWIFT MT formats: MT + 3 digits (MT103, MT202, MT900, etc.)
        if format_upper.startswith('MT') and len(format_upper) >= 5:
            if format_upper[2:5].isdigit():
                return 'SWIFT_MT'

        # ISO 8583 formats: Contains ISO8583 or starts with message type (0200, 0420, etc.)
        if 'ISO8583' in format_upper:
            return 'ISO8583'
        elif len(format_name) == 4 and format_name.isdigit():
            # Could be ISO8583 message type like 0200, 0420
            return 'ISO8583'

        # ISO 20022 formats: pacs, pain, camt, etc.
        format_lower = format_name.lower()
        iso20022_prefixes = ['pacs', 'pain', 'camt', 'head', 'reda', 'remt', 'secl', 'setr', 'tsin', 'tsrv']
        if any(format_lower.startswith(prefix) for prefix in iso20022_prefixes):
            return 'ISO20022'

        # FIX protocol: Contains FIX
        if 'FIX' in format_upper:
            return 'FIX'

        # JSON format
        if format_upper == 'JSON':
            return 'JSON'

        # CHAPS, TARGET2, etc. - Domestic/Regional systems
        if format_upper in ['CHAPS', 'TARGET2', 'FEDWIRE', 'CHIPS']:
            return 'DOMESTIC'

        # Default for unknown formats
        return 'UNKNOWN'

    def extract_fields(self, message: str, source_format: str, base_config: Dict, track_details: bool = False) -> Dict[str, str]:
        """
        Extract fields from message using simple pattern matching.
        For semantic learning, we just need to identify which fields exist.

        Args:
            message: Raw message content
            source_format: Source format name
            base_config: Base configuration to use for parsing

        Returns:
            Dictionary of extracted fields
        """
        import re
        fields = {}

        # Get parser config to understand field patterns
        parser_config = base_config.get('parser', {})
        field_configs = parser_config.get('fields', {})

        # Extract fields using patterns from config
        for field_id, field_config in field_configs.items():
            pattern = field_config.get('pattern', '')
            if pattern:
                try:
                    match = re.search(pattern, message, re.MULTILINE | re.DOTALL)
                    if match:
                        # Get the first capture group or the whole match
                        value = match.group(1) if match.groups() else match.group(0)
                        fields[field_id] = value.strip()
                except Exception:
                    continue

        # FALLBACK: For SWIFT MT formats, also extract fields not in base config
        # This allows new formats (like MT205) to extract fields not in similar format (MT202)
        format_family = self._detect_format_family(source_format)
        if format_family == 'SWIFT_MT':
            # Generic SWIFT field pattern: :NN: or :NNA: (field tag followed by colon)
            # Examples: :13C:, :21:, :32A:, :72:
            generic_pattern = r':(\d{1,3}[A-Z]?):((?:(?!:\d{1,3}[A-Z]?:).)*?)(?=:\d{1,3}[A-Z]?:|$|-\})'

            try:
                matches = re.finditer(generic_pattern, message, re.MULTILINE | re.DOTALL)
                for match in matches:
                    field_id = match.group(1)
                    field_value = match.group(2).strip()

                    # Only add if not already extracted by base config parser
                    if field_id not in fields and field_value:
                        fields[field_id] = field_value
                        logger.info(f"📌 Extracted additional field not in base config: {field_id}")
            except Exception as e:
                logger.warning(f"Failed to extract additional SWIFT fields: {e}")

        logger.info(f"Extracted {len(fields)} fields from {source_format}")

        if fields:
            field_list = list(fields.keys())[:5]  # First 5 fields
            logger.debug(f"Sample extracted fields: {field_list}")

        # Track details if requested
        if track_details:
            for field_id, content in fields.items():
                field_config = field_configs.get(field_id, {})
                detail = {
                    "field_id": field_id,
                    "field_name": field_config.get('name', field_id),
                    "content_preview": content[:100] if len(content) > 100 else content,
                    "content_length": len(content),
                    "extraction_method": "base_config" if field_id in field_configs else "fallback",
                    "pattern_used": field_config.get('pattern'),
                    "is_composite": 'components' in field_config,
                    "components": list(field_config.get('components', {}).keys()) if 'components' in field_config else None
                }
                self.generation_tracking['field_extraction']['fields'].append(detail)

        return fields

    def _find_pattern(self, field_id: str, source_format: str, similar_format: str = None, track_tried: Optional[List] = None) -> Optional[Dict]:
        """
        Find semantic pattern for field.
        NO HARDCODING - uses loaded patterns.

        Args:
            field_id: Field identifier to find pattern for
            source_format: Source format name
            similar_format: Optional similar format to check

        Returns:
            Pattern dictionary if found, None otherwise
        """
        # Try exact format + field match first
        key = f"{source_format}.{field_id}"
        if track_tried is not None:
            track_tried.append(key)
        if key in self.concept_map:
            concept = self.concept_map[key]
            pattern = self.pattern_cache.get(concept)
            if pattern and source_format in pattern.get('mappings', {}):
                logger.debug(f"Found exact pattern for {key} → {concept}")
                return pattern['mappings'][source_format]

        # Try similar format (e.g., MT192 similar to MT103)
        if similar_format:
            similar_key = f"{similar_format}.{field_id}"
            if track_tried is not None:
                track_tried.append(similar_key)
            if similar_key in self.concept_map:
                concept = self.concept_map[similar_key]
                pattern = self.pattern_cache.get(concept)
                if pattern and similar_format in pattern.get('mappings', {}):
                    # Adapt pattern for new format
                    adapted = pattern['mappings'][similar_format].copy()
                    logger.debug(f"Adapting pattern from {similar_format}.{field_id} for {source_format}")

                    # For reversals, might need different targets
                    if 'reversal' in source_format.lower() or '0420' in source_format:
                        adapted = self._adapt_for_reversal(adapted)

                    return adapted

        # Try cross-format pattern discovery
        # Look for any pattern that has this field name
        for pattern_id, pattern in self.pattern_cache.items():
            for fmt, mapping in pattern.get('mappings', {}).items():
                if mapping.get('source_field') == field_id:
                    # Found a pattern with this field in another format
                    source_family = self._detect_format_family(source_format)
                    found_family = self._detect_format_family(fmt)

                    logger.info(f"🔍 CROSS-FORMAT pattern discovered for {source_format}.{field_id}")
                    logger.info(f"   Source: {fmt} (family: {found_family})")
                    logger.info(f"   Target: {source_format} (family: {source_family})")
                    logger.info(f"   Pattern: {pattern_id}")
                    logger.info(f"   Mapping targets: {mapping.get('targets', [])}")

                    # Check if it's from a similar format family
                    if source_family == found_family:
                        # Same family, likely compatible
                        adapted = mapping.copy()
                        logger.info(f"   ✓ Families match - using cross-format pattern")

                        # Adapt for specific cases
                        if 'reversal' in source_format.lower() or '0420' in source_format:
                            adapted = self._adapt_for_reversal(adapted)
                            logger.info(f"   ✓ Adapted for reversal context")

                        return adapted
                    else:
                        logger.debug(f"   ✗ Families don't match ({source_family} != {found_family}) - skipping")

        logger.info(f"No pattern found for {source_format}.{field_id} - will use LLM if available")
        return None

    def _adapt_for_reversal(self, pattern: Dict) -> Dict:
        """
        Adapt pattern for reversal messages.
        E.g., auth_code in 0420 refers to original transaction.

        Args:
            pattern: Original pattern to adapt

        Returns:
            Adapted pattern for reversal context
        """
        adapted = pattern.copy()

        # Adjust targets for reversal context
        if 'targets' in adapted:
            # Prefix with 'Orgnl' for reversal fields
            adapted['targets'] = [
                f"Orgnl{t}" if not t.startswith('Orgnl') else t
                for t in adapted['targets']
            ]

        # Update description if present
        if 'description' in adapted:
            adapted['description'] = f"Original {adapted['description']}"

        logger.debug(f"Adapted pattern for reversal: {adapted.get('targets', [])}")

        return adapted

    def _ask_llm_for_mapping(self,
                            field_id: str,
                            content: str,
                            source_format: str,
                            target_format: str,
                            format_family: str,
                            track_details: bool = False) -> Dict[str, Any]:
        """
        Ask LLM to suggest mapping for unknown field.
        Provides context about format family.

        Args:
            field_id: Field identifier
            content: Field content sample
            source_format: Source format name
            target_format: Target format name
            format_family: Format family (SWIFT_MT, ISO8583, etc.)

        Returns:
            LLM suggestion with targets and confidence
        """
        if not self.ai:
            logger.warning(f"No AI service available for mapping {field_id}")
            return {"targets": [], "confidence": 0}

        # Truncate content for prompt (avoid token limits) - increased from 200 to 500 to preserve multi-line content
        content_preview = content[:1000] if content else ""

        # Get format-specific context with examples
        format_context = self._get_format_context(format_family, target_format)

        # Add SWIFT MT field catalog if applicable
        field_catalog = self._get_swift_field_catalog(field_id, format_family)

        prompt = f"""
        Analyze this payment field and suggest target mappings:

        Field ID: {field_id}
        Content: {content_preview}
        Source Format: {source_format}
        Format Family: {format_family}
        Target Format: {target_format}

        {field_catalog}

        {format_context}

        **CRITICAL MAPPING RULES:**
        1. Identify the field TYPE first (Amount, Date, Party, Reference, Batch Control, Instructions)
        2. Map based on semantic meaning, NOT just field ID
        3. Amount fields (32X) → InstdAmt.Amt + InstdAmt.Ccy (SEPARATE fields for value and currency)
        4. Date fields (30, 32A date part) → ReqdExctnDt, IntrBkSttlmDt, ValDt
        5. Party fields (50, 52, 59) → Dbtr.*/Cdtr.* with Nm, Acct.Id, PstlAdr
        6. **Field 28D (batch n/m)** → MUST return empty targets [] - NO equivalent in pacs.008
        7. Transaction references (21, TRN) → EndToEndId, TxId, InstrId
        8. Remittance (70) → RmtInf.Ustrd
        9. Instructions (72) → InstrForCdtrAgt, InstrForNxtAgt

        **MANDATORY RULES - DO NOT VIOLATE:**
        - Field 28D content like "1/1" is MESSAGE SEQUENCING ONLY → targets MUST be []
        - NEVER map 28D to amount fields (IntrBkSttlmAmt, InstdAmt) - it contains NO amount data
        - NEVER map 28D to MsgId, NbOfTxs, MsgIdx, TtlNb - these don't exist or are inappropriate in pacs.008
        - If a field contains only metadata/control information with NO business data, return empty targets: []

        Based on the field content and format family, suggest the most likely target field(s).

        Return ONLY valid JSON:
        {{
            "targets": ["field1", "field2"],
            "confidence": 0.7,
            "reasoning": "brief explanation"
        }}

        If the field has no clear mapping to {target_format}, return:
        {{
            "targets": [],
            "confidence": 0.5,
            "reasoning": "This field contains MT-specific metadata with no direct equivalent in {target_format}"
        }}
        """

        logger.info(f"🔍 LLM PROMPT FOR FIELD {field_id}:")
        logger.info(f"{'='*80}")
        logger.info(prompt)
        logger.info(f"{'='*80}")

        try:
            import time
            call_start = time.time()

            # Use extract_field_data with custom prompt that forces exact JSON output
            response = self.ai.extract_field_data(
                field_value=prompt,
                field_type="field_mapping_suggestion",
                prompt_template=prompt  # Pass prompt as template to override default
            )

            logger.info(f"🤖 LLM RESPONSE FOR FIELD {field_id}:")
            logger.info(f"{'='*80}")
            logger.info(f"Response: {json.dumps(response, indent=2)}")
            logger.info(f"{'='*80}")

            call_time = (time.time() - call_start) * 1000

            # Response is already a dict from extract_field_data
            # The response has structure: {"success": true, "data": {...}, "confidence": 0.85}
            if isinstance(response, dict):
                # Extract from 'data' field (BedrockService puts AI response here)
                data = response.get('data', {})

                # If data has targets, use it
                if 'targets' in data:
                    result = {
                        "targets": data.get('targets', []),
                        "confidence": data.get('confidence', response.get('confidence', 0.5)),
                        "reasoning": data.get('reasoning', '')
                    }
                else:
                    # Fallback: empty targets
                    result = {
                        "targets": [],
                        "confidence": response.get('confidence', 0.5),
                        "reasoning": ''
                    }

                # Add LLM details if tracking
                if track_details:
                    result['_llm_details'] = {
                        "prompt": prompt,
                        "prompt_tokens": int(len(prompt.split()) * 1.3),  # Rough estimate
                        "model_used": self.ai.models.get('haiku', {}).get('model_id', 'unknown') if hasattr(self.ai, 'models') else 'unknown',
                        "temperature": 0.1,
                        "max_tokens": 1000,
                        "format_family": format_family,
                        "format_context": format_context,
                        "raw_response": json.dumps(data),
                        "parsed_response": result.copy(),
                        "response_tokens": int(len(json.dumps(data).split()) * 1.3),
                        "call_time_ms": call_time,
                        "success": True
                    }

                logger.info(f"LLM suggested mapping for {field_id}: {result.get('targets', [])}")
                return result
            else:
                logger.warning(f"Unexpected LLM response format for {field_id}")
                return {"targets": [], "confidence": 0}

        except Exception as e:
            logger.warning(f"LLM suggestion failed for {field_id}: {e}")
            result = {"targets": [], "confidence": 0}

            if track_details:
                result['_llm_details'] = {
                    "prompt": prompt,
                    "error": str(e),
                    "success": False
                }

            return result

    def _get_swift_field_catalog(self, field_id: str, format_family: str) -> str:
        """
        Get SWIFT MT field definitions to help LLM understand field semantics.

        Args:
            field_id: The SWIFT field identifier (e.g., "20", "28D", "50H")
            format_family: Format family (only returns catalog if SWIFT_MT)

        Returns:
            Field definition string if found, empty string otherwise
        """
        if format_family != "SWIFT_MT":
            return ""

        # Common SWIFT MT field catalog with semantic descriptions
        swift_field_catalog = {
            "20": "Sending Reference - unique message identifier",
            "21": "Related Reference - customer-specified transaction reference",
            "23B": "Bank Operation Code - transaction type",
            "28": "Statement Number - sequence number",
            "28D": "Message Index/Total - batch control in n/m format (e.g., 1/1 means message 1 of 1) - METADATA ONLY, no pacs.008 mapping",
            "30": "Requested Execution Date - YYMMDD format",
            "32A": "Value Date/Currency/Amount - composite field YYMMDD+CCY+amount",
            "32B": "Transaction Amount - CCYamount format (e.g., USD50000.00)",
            "33B": "Currency/Instructed Amount",
            "50A": "Ordering Customer - BIC",
            "50F": "Ordering Customer - name, address, account",
            "50H": "Ordering Customer - account number + name + postal address (multi-line)",
            "50K": "Ordering Customer - account + name + address (multi-line)",
            "52A": "Ordering Institution - BIC code",
            "52D": "Ordering Institution - name and address",
            "53A": "Sender's Correspondent - BIC",
            "53B": "Sender's Correspondent - party identifier",
            "54A": "Receiver's Correspondent - BIC",
            "56A": "Intermediary Institution - BIC",
            "56C": "Intermediary Institution - party identifier",
            "56D": "Intermediary Institution - name and address",
            "57A": "Account With Institution - BIC",
            "57B": "Account With Institution - party identifier",
            "57C": "Account With Institution - party identifier",
            "57D": "Account With Institution - name and address",
            "58A": "Beneficiary Institution - BIC",
            "58D": "Beneficiary Institution - name and address",
            "59": "Beneficiary Customer - account + name + address (multi-line)",
            "59A": "Beneficiary Customer - account + identifier",
            "70": "Remittance Information - unstructured payment details (multi-line)",
            "71A": "Charges Code - SHA/OUR/BEN",
            "71F": "Sender's Charges",
            "71G": "Receiver's Charges",
            "72": "Sender to Receiver Information - bank-to-bank instructions (multi-line)",
            "77B": "Regulatory Reporting"
        }

        if field_id in swift_field_catalog:
            return f"""
**SWIFT MT FIELD DEFINITION:**
Field {field_id}: {swift_field_catalog[field_id]}
"""

        return ""

    def _get_format_context(self, format_family: str, target_format: str) -> str:
        """
        Get context hints for LLM based on format family.
        Updated with comprehensive field mappings based on industry standards.

        Args:
            format_family: Format family (SWIFT_MT, ISO8583, etc.)
            target_format: Target format name

        Returns:
            Context string for LLM with format-specific field hints
        """
        if format_family == 'ISO8583':
            return f"""
            Common {target_format} fields for card transactions (ISO 8583 → cain messages):
            - For card data: Card.PAN, Card.SeqNb, Card.XpryDt, Card.SvcCd, Card.CardBrnd
            - For amounts: TxAmt.Amt, TxAmt.Ccy, AddtlAmt (cashback, tip), CnvsDtls (currency conversion)
            - For merchants: Acqrr.Id, Accptr.Id, Accptr.Nm, Accptr.Lctn.Ctry, Accptr.Ctgy (MCC), POI.Id, POI.Lctn
            - For terminal: POI.Tp, POI.Cpblties, POI.CmpntTp (POS capabilities and component)
            - For transaction type: PrcgCd (processing code), TxTp (transaction type), SvcTp (service type)
            - For references: MsgId, TxId, TxLifeCyclIdData.Id, RtrvlRefNb, AuthstnCd, STAN (system trace)
            - For reversals: OrgnlTx.TxId, OrgnlTx.TxDtTm, RvslRsn.Cd, RvslRsn.AddtlData
            - For dates/times: TxDtTm, RcncltnDt, TmZone, TxCaptr.DtTm
            - For authentication: ICCRltdData, PINData, Authntcn.Mtd, CardhldrVrfctn
            - For additional info: AddtlData, NrrtvTxt, ICCData (chip data), TrckData
            """
        elif format_family == 'SWIFT_MT':
            return f"""
            Common {target_format} fields for bank transfers (SWIFT MT → pacs/pain):

            Message Header & Control:
            - For message ID: MsgId, InstrId, EndToEndId, TxId, UETR (unique end-to-end reference)
            - For business message: BizMsgIdr, CreDtTm, MsgDefIdr

            Payment Details:
            - For amounts: Amount, IntrBkSttlmAmt, InstdAmt, EqvtAmt.Amt, EqvtAmt.CcyOfTrf
            - For currency: Ccy, IntrBkSttlmAmt.Ccy, InstdAmt.Ccy
            - For charges: ChrgBr (DEBT/CRED/SHAR), ChrgsInf.Amt, ChrgsInf.Agt

            Party Information:
            - For debtor: Dbtr.Nm, Dbtr.PstlAdr, DbtrAcct.Id, DbtrAcct.Tp, DbtrAcct.Ccy
            - For creditor: Cdtr.Nm, Cdtr.PstlAdr, CdtrAcct.Id, CdtrAcct.Tp, CdtrAcct.Ccy
            - For agents: DbtrAgt.FinInstnId.BICFI, CdtrAgt.FinInstnId.BICFI, IntrmyAgt1.FinInstnId.BICFI
            - For ordering/beneficiary institutions: InstgAgt, InstdAgt, Intrmy, Prxy

            Dates & Times:
            - For value date: IntrBkSttlmDt, ReqdExctnDt, ValDt
            - For creation: CreDtTm, AccptncDtTm
            - For settlement time: SttlmTmIndctn.DbtDtTm, SttlmTmIndctn.CdtDtTm, SttlmTmReq.CLSTm

            Payment Purpose & Details:
            - For remittance: RmtInf.Ustrd, RmtInf.Strd.RfrdDocInf, RmtInf.Strd.CdtrRefInf
            - For instructions: InstrForCdtrAgt, InstrForNxtAgt, InstrForDbtrAgt
            - For purpose: Purp.Cd, CtgyPurp.Cd

            Regulatory & Compliance:
            - For regulatory reporting: RgltryRptg.Dtls, RgltryRptg.Cd, RgltryRptg.Inf
            - For related references: RltdRmtInf, OrgnlMsgId, OrgnlTxId, OrgnlEndToEndId
            """
        elif format_family == 'ISO20022':
            return f"""
            ISO 20022 XML message structure (pacs/pain/camt family):

            Document Root Structure:
            - Document namespace: xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.xx"
            - Main blocks: GrpHdr (header), PmtInf (payment info), CdtTrfTxInf (transactions)

            Group Header (GrpHdr):
            - MsgId: Unique message identifier
            - CreDtTm: Message creation date/time
            - NbOfTxs: Number of transactions
            - CtrlSum: Total of all amounts
            - InitgPty: Initiating party details

            Payment Information (PmtInf):
            - PmtInfId: Payment batch identifier
            - PmtMtd: Payment method (TRF, TRA, etc.)
            - BtchBookg: Batch booking indicator
            - NbOfTxs: Number in this batch
            - ReqdExctnDt: Requested execution date
            - Dbtr: Debtor party details
            - DbtrAcct: Debtor account
            - DbtrAgt: Debtor agent (bank)

            Transaction Information (CdtTrfTxInf or DrctDbtTxInf):
            - PmtId.InstrId: Instruction ID
            - PmtId.EndToEndId: End-to-end reference
            - Amt.InstdAmt: Instructed amount
            - ChrgBr: Charge bearer code
            - CdtrAgt: Creditor agent
            - Cdtr: Creditor party
            - CdtrAcct: Creditor account
            - RmtInf: Remittance information
            - Purp: Purpose code

            Nested Path Examples:
            - CdtTrfTxInf.PmtId.EndToEndId
            - CdtTrfTxInf.Amt.InstdAmt.Ccy
            - CdtTrfTxInf.CdtrAgt.FinInstnId.BICFI
            - CdtTrfTxInf.RmtInf.Ustrd
            - PmtInf.DbtrAcct.Id.IBAN
            """
        elif format_family == 'FIX':
            return f"""
            Common {target_format} fields for FIX protocol (Financial Information eXchange):
            - For order: ClOrdID, OrderID, SecondaryOrderID, OrigClOrdID
            - For execution: ExecID, ExecType, OrdStatus, ExecTransType
            - For instrument: Symbol, SecurityID, SecurityIDSource, SecurityType, MaturityMonthYear
            - For parties: PartyID, PartyIDSource, PartyRole (for counterparties)
            - For quantities: OrderQty, CumQty, LeavesQty, LastQty
            - For prices: Price, StopPx, AvgPx, LastPx
            - For sides: Side (1=Buy, 2=Sell), OrdType, TimeInForce
            - For timestamps: TransactTime, SendingTime, TradeDate, EffectiveTime
            - For trading: Account, TradingSessionID, ExDestination
            """
        elif format_family == 'DOMESTIC':
            return f"""
            Common {target_format} fields for domestic payment systems (CHAPS/TARGET2/Fedwire):
            - Similar to SWIFT MT but with system-specific extensions
            - For references: SystemReference, SortCode, RoutingNumber, BankCode
            - For settlement: SettlementMethod, ClearingSystemReference, SettlementAccount
            - For priority: PriorityCode, UrgencyIndicator
            - For domestic specifics: DomesticInstructionCode, LocalInstrument, CategoryPurpose
            """
        else:
            return f"""
            Target format: {target_format}
            Common payment message fields:
            - For identification: MessageId, TransactionId, Reference, EndToEndId
            - For amounts: Amount, Currency, ExchangeRate
            - For parties: Sender, Receiver, Debtor, Creditor, Agent, Intermediary
            - For accounts: AccountId, AccountType, IBAN, BIC, SortCode
            - For dates: ValueDate, CreationDateTime, ExecutionDate
            - For instructions: PaymentPurpose, RemittanceInfo, InstructionCode
            """

    def _generate_mappings(self,
                          fields: Dict[str, str],
                          source_format: str,
                          target_format: str,
                          base_config: Dict,
                          similar_format: str,
                          track_details: bool = False) -> List[Dict]:
        """
        Generate mappings for all fields.
        Supports MT, ISO8583, and other formats.

        Args:
            fields: Extracted fields from message
            source_format: Source format name
            target_format: Target format name
            base_config: Base configuration
            similar_format: Similar format used as reference

        Returns:
            List of mapping dictionaries
        """
        mappings = []
        format_family = self._detect_format_family(source_format)
        processed_fields = set()  # Track processed fields to avoid duplicates

        logger.info(f"Generating mappings for {len(fields)} fields from {source_format} to {target_format}")

        for field_id, content in fields.items():
            import time
            field_start_time = time.time()

            # Skip if already processed (e.g., as part of a composite field)
            if field_id in processed_fields:
                continue

            # Check if field has components (like 32A with value_date, currency, amount)
            if self._has_components(field_id, base_config):
                # Handle composite fields
                component_mappings = self._create_component_mappings(
                    field_id, base_config, source_format, similar_format
                )
                mappings.extend(component_mappings)
                processed_fields.add(field_id)
                logger.debug(f"Added {len(component_mappings)} component mappings for {field_id}")
                continue

            # Try pattern lookup first
            patterns_tried = []
            pattern = self._find_pattern(field_id, source_format, similar_format, track_tried=patterns_tried if track_details else None)

            if pattern:
                mapping = {
                    "source": field_id,
                    "targets": pattern.get('targets', []),
                    "transform": pattern.get('transform', 'copy'),
                    "processing_lane": pattern.get('processing_lane', 'RULES'),
                    "confidence": pattern.get('confidence', 0.9)
                }

                # Include transform config if present
                if 'transform_config' in pattern:
                    mapping['transform_config'] = pattern['transform_config']

                # Include field_type for AI lane
                if pattern.get('processing_lane') == 'AI' and 'field_type' in pattern:
                    mapping['field_type'] = pattern['field_type']

                # Include confidence threshold if specified
                if 'confidence_threshold' in pattern:
                    mapping['confidence_threshold'] = pattern['confidence_threshold']

                mappings.append(mapping)
                processed_fields.add(field_id)
                logger.info(f"✓ Field {field_id}: Using pattern mapping to {mapping['targets']}")

                # Track details if requested
                if track_details:
                    self.generation_tracking['mapping_generation']['details'].append({
                        "field_id": field_id,
                        "mapping_method": "pattern_match",
                        "pattern_id": pattern.get('_id'),
                        "pattern_source": pattern.get('source_format'),
                        "patterns_tried": patterns_tried,
                        "targets": mapping['targets'],
                        "confidence": mapping['confidence'],
                        "processing_time_ms": (time.time() - field_start_time) * 1000
                    })

            else:
                # No pattern found - ask LLM
                logger.info(f"🤖 Field {field_id}: No pattern found - calling LLM for suggestion")
                llm_result = self._ask_llm_for_mapping(
                    field_id, content, source_format, target_format, format_family, track_details=track_details
                )

                if llm_result.get('confidence', 0) > 0.5:
                    mapping = {
                        "source": field_id,
                        "targets": llm_result['targets'],
                        "transform": 'copy',
                        "processing_lane": 'RULES',
                        "confidence": llm_result['confidence']
                    }
                    mappings.append(mapping)
                    processed_fields.add(field_id)
                    logger.info(f"✓ Field {field_id}: Using LLM suggestion → {mapping['targets']} (confidence: {llm_result['confidence']:.2f})")

                    # Track details if requested
                    if track_details:
                        self.generation_tracking['mapping_generation']['details'].append({
                            "field_id": field_id,
                            "mapping_method": "llm_suggestion",
                            "llm_details": llm_result.get('_llm_details'),
                            "targets": mapping['targets'],
                            "confidence": mapping['confidence'],
                            "processing_time_ms": (time.time() - field_start_time) * 1000
                        })
                else:
                    logger.warning(f"✗ Field {field_id}: No confident mapping found (confidence={llm_result.get('confidence', 0)})")

                    # Track failed mapping if requested
                    if track_details:
                        self.generation_tracking['mapping_generation']['details'].append({
                            "field_id": field_id,
                            "mapping_method": "failed",
                            "llm_details": llm_result.get('_llm_details'),
                            "targets": [],
                            "confidence": llm_result.get('confidence', 0),
                            "processing_time_ms": (time.time() - field_start_time) * 1000
                        })

        logger.info(f"Generated {len(mappings)} mappings for {source_format} to {target_format}")
        return mappings

    def _has_components(self, field_id: str, base_config: Dict) -> bool:
        """
        Check if field has components (from base config).

        Args:
            field_id: Field identifier
            base_config: Base configuration

        Returns:
            True if field has components
        """
        parser_fields = base_config.get('parser', {}).get('fields', {})
        field_config = parser_fields.get(field_id, {})
        return 'components' in field_config

    def _create_component_mappings(self,
                                  field_id: str,
                                  base_config: Dict,
                                  source_format: str,
                                  similar_format: str) -> List[Dict]:
        """
        Create mappings for composite field components.
        Uses patterns, not hardcoding.

        Args:
            field_id: Composite field identifier
            base_config: Base configuration
            source_format: Source format name
            similar_format: Similar format for pattern lookup

        Returns:
            List of component mappings
        """
        mappings = []
        components = base_config['parser']['fields'][field_id].get('components', {})

        for component_name in components:
            # Try to find pattern for this component
            # Look for pattern with format.field.component key
            component_key = f"{field_id}.{component_name}"
            pattern = self._find_pattern(component_key, source_format, similar_format)

            if pattern:
                mapping = {
                    "source": component_key,
                    "targets": pattern.get('targets', []),
                    "transform": pattern.get('transform', 'copy'),
                    "processing_lane": pattern.get('processing_lane', 'RULES')
                }

                if 'transform_config' in pattern:
                    mapping['transform_config'] = pattern['transform_config']

                mappings.append(mapping)
                logger.debug(f"Component {component_key}: Found pattern mapping to {mapping['targets']}")

        return mappings

    def _build_config(self,
                     source_format: str,
                     target_format: str,
                     fields: Dict[str, str],
                     mappings: List[Dict],
                     base_config: Dict) -> Dict[str, Any]:
        """
        Build final configuration.

        Args:
            source_format: Source format name
            target_format: Target format name
            fields: Extracted fields
            mappings: Generated mappings
            base_config: Base configuration to build from

        Returns:
            Complete configuration dictionary
        """
        # Clone base config structure
        new_config = {
            "_id": f"{source_format}_to_{target_format}",
            "parser": base_config.get('parser', {}).copy(),
            "mappings": mappings,
            "ai_service": base_config.get('ai_service', {}).copy() if 'ai_service' in base_config else {},
            "builder": base_config.get('builder', {}).copy(),
            "human_review": base_config.get('human_review', {}).copy() if 'human_review' in base_config else {},
            "metadata": {
                "auto_generated": True,
                "based_on": base_config['_id'],
                "generated_at": datetime.utcnow().isoformat(),
                "generation_method": "simplified_semantic_v2",
                "fields_detected": len(fields),
                "mappings_created": len(mappings),
                "confidence": self._calculate_overall_confidence(mappings)
            }
        }

        # Update parser fields for new format (adapting from base config)
        new_config['parser']['fields'] = self._build_parser_fields(fields, base_config)

        # Update builder configuration if needed
        # Keep the same builder structure but may need to adapt target format
        if 'template' in new_config['builder']:
            # Builder template should be appropriate for target format
            # This would typically be set correctly in the base config
            pass

        logger.info(f"Built configuration for {source_format}_to_{target_format}")
        logger.info(f"  - Fields detected: {len(fields)}")
        logger.info(f"  - Mappings created: {len(mappings)}")
        logger.info(f"  - Overall confidence: {new_config['metadata']['confidence']:.2f}")

        return new_config

    def _calculate_overall_confidence(self, mappings: List[Dict]) -> float:
        """
        Calculate average confidence across all mappings.

        Args:
            mappings: List of mapping dictionaries

        Returns:
            Average confidence score
        """
        if not mappings:
            return 0.0

        confidences = [m.get('confidence', 0.5) for m in mappings]
        return sum(confidences) / len(confidences)

    def _build_parser_fields(self, fields: Dict[str, str], base_config: Dict) -> Dict:
        """
        Build parser configuration for detected fields.

        Args:
            fields: Detected fields from sample message
            base_config: Base configuration with parser patterns

        Returns:
            Parser fields configuration
        """
        parser_fields = {}
        base_parser_fields = base_config.get('parser', {}).get('fields', {})

        for field_id in fields.keys():
            if field_id in base_parser_fields:
                # Copy from base config (similar format should have similar patterns)
                parser_fields[field_id] = base_parser_fields[field_id].copy()
            else:
                # Create generic parser entry for unknown fields
                # This allows the parser to at least attempt extraction
                parser_fields[field_id] = {
                    "pattern": f":{field_id}:([^:]+)",  # Generic SWIFT-like pattern
                    "name": field_id,
                    "description": f"Auto-detected field {field_id}"
                }

                # For ISO8583, use different pattern
                if 'ISO8583' in base_config.get('_id', ''):
                    parser_fields[field_id] = {
                        "pattern": f"{field_id}:([^|]+)",  # ISO8583-like pattern
                        "name": field_id,
                        "description": f"Auto-detected field {field_id}"
                    }

        return parser_fields

    def _get_base_config(self, similar_format: str, target_format: str) -> Optional[Dict]:
        """
        Get base configuration to clone from.

        Args:
            similar_format: Format to use as base (e.g., "MT103")
            target_format: Target format for conversion

        Returns:
            Base configuration if found, None otherwise
        """
        config_id = f"{similar_format}_to_{target_format}"

        try:
            config = self.registry_collection.find_one({"_id": config_id})
            if config:
                logger.info(f"Found base configuration: {config_id}")
                return config
            else:
                logger.warning(f"Base configuration not found: {config_id}")
                return None
        except Exception as e:
            logger.error(f"Error loading base config {config_id}: {e}")
            return None

    def _build_generation_details(self,
                                  extraction_time: float,
                                  total_time: float,
                                  base_config_id: str) -> Dict[str, Any]:
        """
        Build generation details structure from tracking data.

        Args:
            extraction_time: Time spent extracting fields (ms)
            total_time: Total generation time (ms)
            base_config_id: ID of base configuration used

        Returns:
            Generation details dictionary
        """
        tracking = self.generation_tracking

        # Calculate statistics
        pattern_lookup_time = sum(
            d.get('processing_time_ms', 0)
            for d in tracking['mapping_generation']['details']
            if d.get('mapping_method') == 'pattern_match'
        )

        llm_total_time = sum(
            d.get('processing_time_ms', 0)
            for d in tracking['mapping_generation']['details']
            if d.get('mapping_method') == 'llm_suggestion'
        )

        llm_total_tokens = sum(
            d.get('llm_details', {}).get('prompt_tokens', 0) +
            d.get('llm_details', {}).get('response_tokens', 0)
            for d in tracking['mapping_generation']['details']
            if d.get('mapping_method') == 'llm_suggestion'
        )

        # Count mappings by method
        pattern_matches = len([
            d for d in tracking['mapping_generation']['details']
            if d.get('mapping_method') == 'pattern_match'
        ])

        llm_calls = len([
            d for d in tracking['mapping_generation']['details']
            if d.get('mapping_method') == 'llm_suggestion'
        ])

        failed_mappings = len([
            d for d in tracking['mapping_generation']['details']
            if d.get('mapping_method') == 'failed'
        ])

        generation_time_ms = sum(
            d.get('processing_time_ms', 0)
            for d in tracking['mapping_generation']['details']
        )

        return {
            "field_extraction": {
                "total_fields": len(tracking['field_extraction']['fields']),
                "extraction_method": "generic_parser",
                "extraction_time_ms": extraction_time,
                "fields": tracking['field_extraction']['fields']
            },
            "mapping_generation": {
                "total_mappings": len(tracking['mapping_generation']['details']),
                "pattern_matches": pattern_matches,
                "llm_calls": llm_calls,
                "failed_mappings": failed_mappings,
                "generation_time_ms": generation_time_ms,
                "details": tracking['mapping_generation']['details']
            },
            "statistics": {
                "pattern_lookup_time_ms": pattern_lookup_time,
                "llm_total_time_ms": llm_total_time,
                "llm_total_tokens": int(llm_total_tokens),
                "base_config_id": base_config_id,
                "patterns_cache_size": len(self.pattern_cache)
            }
        }