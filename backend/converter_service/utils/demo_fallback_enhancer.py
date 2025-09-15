"""
Demo Fallback Enhancer
Intelligently replaces "NOTPROVIDED" values in demo conversions with realistic defaults
"""

import re
import json
from typing import Dict, Any, Optional
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class DemoFallbackEnhancer:
    """
    Enhances demo conversions by replacing placeholder values with intelligent defaults.
    This ensures demo outputs look realistic and professional.
    """

    # Default BIC codes for different institution types (from demo_scenarios.json)
    DEFAULT_BICS = {
        "sender": "CHASUS33XXX",
        "receiver": "DEUTDEFFXXX",
        "intermediary": "BNPAFRPPXXX",
        "correspondent": "INGBNL2AXXX",
        "instructed": "CITIUS33XXX",  # Fallback for InstdAgt
        "instructing": "CHASUS33XXX",
        "creditor_agent": "DEUTDEFFXXX",
        "debtor_agent": "CHASUS33XXX"
    }

    # Default institution names
    DEFAULT_NAMES = {
        "sender": "CHASE BANK USA",
        "receiver": "DEUTSCHE BANK AG",
        "intermediary": "BNP PARIBAS",
        "correspondent": "ING BANK N.V.",
        "instructed": "CITIBANK USA",
        "creditor": "GLOBAL SUPPLIES GMBH",
        "debtor": "ACME TECHNOLOGIES INC"
    }

    # Default addresses
    DEFAULT_ADDRESSES = {
        "sender": "270 PARK AVENUE, NEW YORK NY 10017, USA",
        "receiver": "TAUNUSANLAGE 12, 60325 FRANKFURT, GERMANY",
        "intermediary": "16 BOULEVARD DES ITALIENS, 75009 PARIS, FRANCE",
        "correspondent": "BIJLMERPLEIN 888, 1102 MG AMSTERDAM, NETHERLANDS",
        "instructed": "388 GREENWICH STREET, NEW YORK NY 10013, USA"
    }

    @classmethod
    def enhance_conversion_output(
        cls,
        converted_message: str,
        source_format: str,
        target_format: str,
        demo_values: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Enhance conversion output by replacing placeholder values with realistic defaults.

        Args:
            converted_message: The converted message (XML/JSON string)
            source_format: Source format (e.g., "MT202")
            target_format: Target format (e.g., "pacs.009")
            demo_values: Optional demo values from demo_scenarios.json

        Returns:
            Enhanced message with intelligent defaults
        """

        if not converted_message:
            return converted_message

        try:
            # Load demo values if not provided
            if demo_values is None:
                demo_values = cls._load_demo_values(source_format, target_format)

            # Apply replacements based on target format
            if target_format.startswith("pacs"):
                converted_message = cls._enhance_pacs_message(converted_message, demo_values)
                # Remove InstdAgt entirely for MT202 to pacs.009 (no source field exists)
                if source_format == "MT202" and target_format == "pacs.009":
                    converted_message = cls._remove_instdagt_from_pacs009(converted_message)
            elif target_format == "TARGET2":
                converted_message = cls._enhance_target2_message(converted_message, demo_values)
            elif target_format.startswith("cain"):
                converted_message = cls._enhance_cain_message(converted_message, demo_values)

            return converted_message

        except Exception as e:
            logger.warning(f"Failed to enhance demo output: {e}")
            return converted_message

    @classmethod
    def _enhance_pacs_message(cls, message: str, demo_values: Dict[str, Any]) -> str:
        """Enhance pacs.008 or pacs.009 messages"""

        # Replace NOTPROVIDED BIC codes with intelligent defaults
        replacements = {
            # InstdAgt (Instructed Agent) - often missing in MT202
            r'<InstdAgt>.*?<BICFI>NOTPROVIDED</BICFI>':
                f'<InstdAgt><FinInstnId><BICFI>{cls.DEFAULT_BICS["instructed"]}</BICFI>',

            # PrvsInstgAgt1 (Previous Instructing Agent)
            r'<PrvsInstgAgt1>.*?<BICFI>NOTPROVIDED</BICFI>':
                f'<PrvsInstgAgt1><FinInstnId><BICFI>{cls.DEFAULT_BICS["correspondent"]}</BICFI>',

            # IntrmyAgt1 (Intermediary Agent 1)
            r'<IntrmyAgt1>.*?<BICFI>NOTPROVIDED</BICFI>':
                f'<IntrmyAgt1><FinInstnId><BICFI>{cls.DEFAULT_BICS["intermediary"]}</BICFI>',

            # IntrmyAgt2 (Intermediary Agent 2)
            r'<IntrmyAgt2>.*?<BICFI>NOTPROVIDED</BICFI>':
                f'<IntrmyAgt2><FinInstnId><BICFI>{cls.DEFAULT_BICS["correspondent"]}</BICFI>',

            # Generic NOTPROVIDED BICs
            r'<BICFI>NOTPROVIDED</BICFI>':
                f'<BICFI>{cls.DEFAULT_BICS["receiver"]}</BICFI>',

            # Institution names
            r'<Nm>NOT PROVIDED</Nm>':
                '<Nm></Nm>',  # Empty is better than NOT PROVIDED for names

            # Empty address lines
            r'<AdrLine/>':
                '<AdrLine></AdrLine>',

            # Empty member IDs
            r'<MmbId/>':
                '<MmbId></MmbId>'
        }

        # Apply regex replacements
        for pattern, replacement in replacements.items():
            message = re.sub(pattern, replacement, message, flags=re.DOTALL)

        # Context-aware name replacements
        message = cls._replace_institution_names(message)

        return message

    @classmethod
    def _enhance_target2_message(cls, message: str, demo_values: Dict[str, Any]) -> str:
        """Enhance TARGET2 messages"""

        # Similar to pacs but with TARGET2-specific enhancements
        message = cls._enhance_pacs_message(message, demo_values)

        # TARGET2-specific replacements
        replacements = {
            r'<SettlementBIC>NOTPROVIDED</SettlementBIC>':
                f'<SettlementBIC>{cls.DEFAULT_BICS["receiver"]}</SettlementBIC>',
        }

        for pattern, replacement in replacements.items():
            message = re.sub(pattern, replacement, message)

        return message

    @classmethod
    def _enhance_cain_message(cls, message: str, demo_values: Dict[str, Any]) -> str:
        """Enhance cain.001 (card payment) messages"""

        replacements = {
            r'<AcquirerBIC>NOTPROVIDED</AcquirerBIC>':
                f'<AcquirerBIC>{cls.DEFAULT_BICS["receiver"]}</AcquirerBIC>',

            r'<IssuerBIC>NOTPROVIDED</IssuerBIC>':
                f'<IssuerBIC>{cls.DEFAULT_BICS["sender"]}</IssuerBIC>',

            r'<MerchantName>NOT PROVIDED</MerchantName>':
                '<MerchantName>GLOBAL RETAIL STORES</MerchantName>',
        }

        for pattern, replacement in replacements.items():
            message = re.sub(pattern, replacement, message)

        return message

    @classmethod
    def _replace_institution_names(cls, message: str) -> str:
        """Replace institution names based on context"""

        # Context-aware replacements based on surrounding tags
        context_replacements = [
            (r'(<InstgAgt>.*?<Nm>)NOT PROVIDED(</Nm>)', r'\1' + cls.DEFAULT_NAMES["sender"] + r'\2'),
            (r'(<InstdAgt>.*?<Nm>)NOT PROVIDED(</Nm>)', r'\1' + cls.DEFAULT_NAMES["instructed"] + r'\2'),
            (r'(<CdtrAgt>.*?<Nm>)NOT PROVIDED(</Nm>)', r'\1' + cls.DEFAULT_NAMES["receiver"] + r'\2'),
            (r'(<DbtrAgt>.*?<Nm>)NOT PROVIDED(</Nm>)', r'\1' + cls.DEFAULT_NAMES["sender"] + r'\2'),
            (r'(<IntrmyAgt1>.*?<Nm>)NOT PROVIDED(</Nm>)', r'\1' + cls.DEFAULT_NAMES["intermediary"] + r'\2'),
            (r'(<IntrmyAgt2>.*?<Nm>)NOT PROVIDED(</Nm>)', r'\1' + cls.DEFAULT_NAMES["correspondent"] + r'\2'),
            (r'(<Cdtr>.*?<Nm>)NOT PROVIDED(</Nm>)', r'\1' + cls.DEFAULT_NAMES["creditor"] + r'\2'),
            (r'(<Dbtr>.*?<Nm>)NOT PROVIDED(</Nm>)', r'\1' + cls.DEFAULT_NAMES["debtor"] + r'\2'),
        ]

        for pattern, replacement in context_replacements:
            message = re.sub(pattern, replacement, message, flags=re.DOTALL)

        return message

    @classmethod
    def _remove_instdagt_from_pacs009(cls, message: str) -> str:
        """
        Remove InstdAgt element from pacs.009 XML since MT202 has no source field for it.
        This makes the output cleaner for demo purposes.
        """
        try:
            # Remove entire InstdAgt element including all its children
            # Pattern matches from <InstdAgt> to its closing </InstdAgt>
            pattern = r'<InstdAgt>[\s\S]*?</InstdAgt>\s*'
            message = re.sub(pattern, '', message)

            # Clean up any extra whitespace left behind
            message = re.sub(r'\n\s*\n', '\n', message)

            return message
        except Exception as e:
            logger.warning(f"Failed to remove InstdAgt: {e}")
            return message

    @classmethod
    def _load_demo_values(cls, source_format: str, target_format: str) -> Dict[str, Any]:
        """Load demo values from demo_scenarios.json"""

        try:
            demo_file = Path(__file__).parent.parent / "data" / "demo_scenarios.json"
            with open(demo_file, 'r') as f:
                data = json.load(f)

            # Find matching payment type
            for payment_type in data.get('payment_types', []):
                if (payment_type.get('source_format') == source_format and
                    payment_type.get('target_format') == target_format):
                    return payment_type.get('demo_values', {})

            return {}

        except Exception as e:
            logger.warning(f"Failed to load demo values: {e}")
            return {}

    @classmethod
    def enhance_response(
        cls,
        response: Dict[str, Any],
        source_format: str,
        target_format: str
    ) -> Dict[str, Any]:
        """
        Enhance a complete conversion response.

        Args:
            response: The conversion response dictionary
            source_format: Source format
            target_format: Target format

        Returns:
            Enhanced response with improved demo values
        """

        if 'converted_message' in response:
            response['converted_message'] = cls.enhance_conversion_output(
                response['converted_message'],
                source_format,
                target_format
            )

        # Add demo enhancement flag
        if 'metadata' not in response:
            response['metadata'] = {}
        response['metadata']['demo_enhanced'] = True

        return response


# Convenience function for direct use
def enhance_demo_output(
    converted_message: str,
    source_format: str,
    target_format: str
) -> str:
    """
    Convenience function to enhance demo output.

    Args:
        converted_message: The converted message
        source_format: Source format
        target_format: Target format

    Returns:
        Enhanced message
    """
    return DemoFallbackEnhancer.enhance_conversion_output(
        converted_message,
        source_format,
        target_format
    )