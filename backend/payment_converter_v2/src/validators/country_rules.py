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
    conversion_run_id: str = None
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
        validate_japan_rules(canonical_json, conversion_id, source_format, target_format, conversion_run_id)

    if target_country == "IN" or currency == "INR":
        validate_india_rules(canonical_json, conversion_id, source_format, target_format, conversion_run_id)

    # Add more countries here:
    # if target_country == "CH" or currency == "CHF":
    #     validate_switzerland_rules(...)


def validate_japan_rules(
    canonical_json: Dict[str, Any],
    conversion_id: str,
    source_format: str,
    target_format: str,
    conversion_run_id: str = None
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
                "conversion_id": conversion_id
            }
        )


def validate_india_rules(
    canonical_json: Dict[str, Any],
    conversion_id: str,
    source_format: str,
    target_format: str,
    conversion_run_id: str = None
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
                "additional_context": {
                    "country": "IN",
                    "creditor_bank": creditor_bank,
                    "validation_rule": "ifsc_format"
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
