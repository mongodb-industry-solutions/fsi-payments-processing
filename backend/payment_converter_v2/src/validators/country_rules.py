"""
Country-specific business rule validators.

Each country has specific requirements for payment processing:
- Japan: Names must be in katakana/hiragana
- India: IFSC codes required and must be valid format
- Switzerland: IBANs must follow specific formats (future)

Add new countries by creating a new validate_<country>_rules() function.
"""

import re
from typing import Dict, Any
from ..exceptions import CountryValidationException


def validate_country_rules(
    canonical_json: Dict[str, Any],
    conversion_id: str,
    source_format: str,
    target_format: str,
    conversion_run_id: str = None,
    detailed_processing: Dict[str, Any] = None
) -> None:
    """
    Validate country-specific business rules.

    Raises CountryValidationException if any rules are violated.
    The exception contains all information needed to call payment_agent.

    Args:
        canonical_json: The canonical JSON payment data
        conversion_id: Conversion identifier (e.g., "MT103_to_JSON")
        source_format: Source format (e.g., "MT103")
        target_format: Target format (e.g., "pacs.008")
        conversion_run_id: Optional unique ID for this conversion run
        detailed_processing: Detailed processing data from hop1 (for frontend display)

    Raises:
        CountryValidationException: If country rules violated
    """

    # Extract country indicators
    currency = canonical_json.get("currency", "")
    creditor_country = canonical_json.get("creditor_country", "")
    debtor_country = canonical_json.get("debtor_country", "")

    # Determine target country (where money is going)
    target_country = creditor_country or _infer_country_from_currency(currency)

    # Apply country-specific validations
    if target_country == "JP" or currency == "JPY":
        validate_japan_rules(canonical_json, conversion_id, source_format, target_format, conversion_run_id, detailed_processing)

    if target_country == "IN" or currency == "INR":
        validate_india_rules(canonical_json, conversion_id, source_format, target_format, conversion_run_id, detailed_processing)

    # Add more countries here:
    # if target_country == "CH" or currency == "CHF":
    #     validate_switzerland_rules(...)

    # Universal validation: Name verification
    # Only applies to countries WITHOUT dedicated rules (skip JP, IN which have their own)
    countries_with_dedicated_rules = {"JP", "IN"}
    currencies_with_dedicated_rules = {"JPY", "INR"}

    if target_country not in countries_with_dedicated_rules and currency not in currencies_with_dedicated_rules:
        validate_name_verification_rules(canonical_json, conversion_id, source_format, target_format, conversion_run_id, detailed_processing)


def validate_japan_rules(
    canonical_json: Dict[str, Any],
    conversion_id: str,
    source_format: str,
    target_format: str,
    conversion_run_id: str = None,
    detailed_processing: Dict[str, Any] = None
) -> None:
    """
    Validate Japan-specific payment rules.

    Requirements:
    - Creditor name must be in katakana/hiragana (Japanese characters)
    - Debtor name should be in katakana if Japanese entity

    Args:
        canonical_json: Payment data
        conversion_id: Conversion ID
        source_format: Source format
        target_format: Target format
        conversion_run_id: Optional unique ID for this conversion run
        detailed_processing: Detailed processing data from hop1 (for frontend display)

    Raises:
        CountryValidationException: If Japanese name requirements not met
    """

    creditor_name = canonical_json.get("creditor_name", "")
    debtor_name = canonical_json.get("debtor_name", "")

    # Check if creditor name contains Western characters
    if creditor_name and _contains_western_text(creditor_name):
        raise CountryValidationException(
            task_type="japan_transliteration",
            field_name="creditor_name",
            original_value=creditor_name,
            reason=(
                "Japanese payments require beneficiary names in katakana/hiragana. "
                f"Found Western characters: '{creditor_name}'"
            ),
            payment_data=canonical_json,
            conversion_context={
                "source_format": source_format,
                "target_format": target_format,
                "conversion_id": conversion_id,
                "conversion_run_id": conversion_run_id,  # Include for MongoDB lookup
                "detailed_processing": detailed_processing or {},  # Include for frontend display
                "additional_context": {
                    "country": "JP",
                    "currency": canonical_json.get("currency", "JPY"),
                    "validation_rule": "japanese_name_format"
                }
            }
        )

    # Optionally validate debtor name too
    if debtor_name and _is_japanese_entity(canonical_json) and _contains_western_text(debtor_name):
        raise CountryValidationException(
            task_type="japan_transliteration",
            field_name="debtor_name",
            original_value=debtor_name,
            reason="Japanese entity names should be in katakana",
            payment_data=canonical_json,
            conversion_context={
                "source_format": source_format,
                "target_format": target_format,
                "conversion_id": conversion_id,
                "detailed_processing": detailed_processing or {}
            }
        )


def validate_india_rules(
    canonical_json: Dict[str, Any],
    conversion_id: str,
    source_format: str,
    target_format: str,
    conversion_run_id: str = None,
    detailed_processing: Dict[str, Any] = None
) -> None:
    """
    Validate India-specific payment rules.

    Requirements:
    - Creditor agent BIC must contain valid IFSC code (11 characters)
    - Format: XXXX0YYYYYY (4 alpha, 1 zero, 6 alphanumeric)

    Args:
        canonical_json: Payment data
        conversion_id: Conversion ID
        source_format: Source format
        target_format: Target format
        conversion_run_id: Optional unique ID for this conversion run
        detailed_processing: Detailed processing data from hop1 (for frontend display)

    Raises:
        CountryValidationException: If IFSC code missing or invalid
    """

    creditor_agent_bic = canonical_json.get("creditor_agent_bic", "")
    creditor_bank = canonical_json.get("creditor_bank", "")

    # Check if IFSC code is missing
    if not creditor_agent_bic:
        raise CountryValidationException(
            task_type="india_ifsc",
            field_name="creditor_agent_bic",
            original_value="",
            reason="Indian payments require IFSC code in creditor_agent_bic field",
            payment_data=canonical_json,
            conversion_context={
                "source_format": source_format,
                "target_format": target_format,
                "conversion_id": conversion_id,
                "conversion_run_id": conversion_run_id,
                "detailed_processing": detailed_processing or {},  # Include for frontend display
                "additional_context": {
                    "country": "IN",
                    "currency": canonical_json.get("currency", "INR"),
                    "creditor_bank": creditor_bank,
                    "validation_rule": "ifsc_required"
                }
            }
        )

    # Check if IFSC code is invalid format
    if not _is_valid_ifsc_format(creditor_agent_bic):
        raise CountryValidationException(
            task_type="india_ifsc",
            field_name="creditor_agent_bic",
            original_value=creditor_agent_bic,
            reason=(
                f"Invalid IFSC code format: '{creditor_agent_bic}'. "
                "Expected 11 characters: XXXX0YYYYYY"
            ),
            payment_data=canonical_json,
            conversion_context={
                "source_format": source_format,
                "target_format": target_format,
                "conversion_id": conversion_id,
                "conversion_run_id": conversion_run_id,
                "detailed_processing": detailed_processing or {},  # Include for frontend display
                "additional_context": {
                    "country": "IN",
                    "creditor_bank": creditor_bank,
                    "validation_rule": "ifsc_format"
                }
            }
        )


def validate_name_verification_rules(
    canonical_json: Dict[str, Any],
    conversion_id: str,
    source_format: str,
    target_format: str,
    conversion_run_id: str = None,
    detailed_processing: Dict[str, Any] = None
) -> None:
    """
    Validate that creditor names are legal entity names, not trading names.

    Trading names (informal/abbreviated names like "HSBC", "IBM", "Acme")
    should be resolved to their full legal names for compliance.

    Detection heuristic: Names lacking legal suffixes (Ltd, Inc, Corp, etc.)
    are likely trading names that need verification.

    Args:
        canonical_json: Payment data
        conversion_id: Conversion ID
        source_format: Source format
        target_format: Target format
        conversion_run_id: Optional unique ID for this conversion run
        detailed_processing: Detailed processing data from hop1 (for frontend display)

    Raises:
        CountryValidationException: If creditor name appears to be a trading name
    """

    creditor_name = canonical_json.get("creditor_name", "")

    if creditor_name and _looks_like_trading_name(creditor_name):
        raise CountryValidationException(
            task_type="name_verification",
            field_name="creditor_name",
            original_value=creditor_name,
            reason=(
                f"Creditor name '{creditor_name}' appears to be a trading name "
                "(missing legal suffix like Ltd, Inc, Corp). "
                "Verification against registered entities required."
            ),
            payment_data=canonical_json,
            conversion_context={
                "source_format": source_format,
                "target_format": target_format,
                "conversion_id": conversion_id,
                "conversion_run_id": conversion_run_id,
                "detailed_processing": detailed_processing or {},
                "additional_context": {
                    "validation_rule": "name_verification",
                    "detection_method": "missing_legal_suffix"
                }
            }
        )


# Helper functions

def _contains_western_text(text: str) -> bool:
    """
    Check if text contains Western (Latin) characters.

    Returns True if text has ASCII letters (a-z, A-Z).
    Japanese text should only contain katakana, hiragana, kanji, and symbols.
    """
    return bool(re.search(r'[a-zA-Z]', text))


def _is_japanese_entity(canonical_json: Dict[str, Any]) -> bool:
    """
    Determine if debtor is a Japanese entity.

    Indicators: debtor_country=JP, debtor_account starts with JP, etc.
    """
    debtor_country = canonical_json.get("debtor_country", "")
    debtor_account = canonical_json.get("debtor_account", "")

    return (
        debtor_country == "JP" or
        debtor_account.startswith("JP")
    )


def _is_valid_ifsc_format(code: str) -> bool:
    """
    Validate IFSC code format.

    Format: XXXX0YYYYYY
    - First 4 characters: Bank code (alpha)
    - 5th character: Always '0'
    - Last 6 characters: Branch code (alphanumeric)

    Example: SBIN0125620
    """
    if len(code) != 11:
        return False

    # Pattern: 4 letters + '0' + 6 alphanumeric
    pattern = r'^[A-Z]{4}0[A-Z0-9]{6}$'
    return bool(re.match(pattern, code.upper()))


def _infer_country_from_currency(currency: str) -> str:
    """
    Infer country code from currency code.

    Not always accurate (EUR used by many countries), but useful fallback.
    """
    currency_map = {
        "JPY": "JP",
        "INR": "IN",
        "CHF": "CH",
        "USD": "US",
        "GBP": "GB",
        "EUR": "EU"  # Generic
    }
    return currency_map.get(currency.upper(), "")


def _looks_like_trading_name(name: str) -> bool:
    """
    Check if a name appears to be a trading/informal name rather than legal name.

    Trading names typically lack legal suffixes like Ltd, Inc, Corp, etc.
    Examples:
        "HSBC" → True (trading name, should be "HSBC Holdings plc")
        "IBM" → True (trading name, should be "International Business Machines Corporation")
        "Acme Corporation Limited" → False (has legal suffix)

    Args:
        name: Company name to check

    Returns:
        True if name appears to be a trading name (missing legal suffix)
    """
    legal_suffixes = [
        # English
        'limited', 'ltd', 'ltd.',
        'incorporated', 'inc', 'inc.',
        'corporation', 'corp', 'corp.',
        'company', 'co', 'co.',
        'plc', 'p.l.c.',
        'llc', 'l.l.c.',
        'llp', 'l.l.p.',
        # German
        'ag', 'gmbh', 'kg',
        # French
        'sa', 's.a.', 'sarl',
        # Dutch
        'bv', 'b.v.', 'nv', 'n.v.',
        # Other
        'pty', 'pte', 'sdn bhd'
    ]

    name_lower = name.lower().strip()

    # Check if name ends with any legal suffix
    for suffix in legal_suffixes:
        if name_lower.endswith(suffix) or name_lower.endswith(' ' + suffix):
            return False

    return True
