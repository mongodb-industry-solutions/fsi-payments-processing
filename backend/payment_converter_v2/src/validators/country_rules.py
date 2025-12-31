"""
Country-specific business rule validators.

Each country has specific requirements for payment processing.
When a rule is violated, we raise a CountryValidationException with
a rich problem description that agents can analyze autonomously.

The agent decides which tools to use based on the problem - we don't
prescribe specific task types or tool selections.
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
    The exception contains a problem description for agents to analyze.

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
    """

    creditor_name = canonical_json.get("creditor_name", "")

    # Check if creditor name contains Western characters
    if creditor_name and _contains_western_text(creditor_name):
        raise CountryValidationException(
            problem=(
                f"The creditor name '{creditor_name}' contains Western/Latin characters. "
                f"Japanese payment regulations require beneficiary names to be written in "
                f"Japanese script (katakana for foreign company names, or hiragana/kanji for "
                f"Japanese entities). The payment cannot proceed until the name is converted "
                f"to the appropriate Japanese script format."
            ),
            field_name="creditor_name",
            original_value=creditor_name,
            payment_data=canonical_json,
            conversion_context={
                "source_format": source_format,
                "target_format": target_format,
                "conversion_id": conversion_id,
                "conversion_run_id": conversion_run_id,
                "detailed_processing": detailed_processing or {},
                "additional_context": {
                    "country": "JP",
                    "currency": canonical_json.get("currency", "JPY"),
                    "validation_rule": "japanese_name_format"
                }
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
    """

    creditor_agent_bic = canonical_json.get("creditor_agent_bic", "")
    creditor_bank = canonical_json.get("creditor_bank", "")

    # Check if IFSC code is missing
    if not creditor_agent_bic:
        raise CountryValidationException(
            problem=(
                f"Indian payment regulations require an IFSC (Indian Financial System Code) "
                f"to identify the beneficiary's bank branch. The current payment is missing "
                f"this code in the creditor_agent_bic field. The bank information available "
                f"is: '{creditor_bank}'. An IFSC code needs to be looked up or determined "
                f"based on the bank name, branch, and location information."
            ),
            field_name="creditor_agent_bic",
            original_value="",
            payment_data=canonical_json,
            conversion_context={
                "source_format": source_format,
                "target_format": target_format,
                "conversion_id": conversion_id,
                "conversion_run_id": conversion_run_id,
                "detailed_processing": detailed_processing or {},
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
            problem=(
                f"The IFSC code '{creditor_agent_bic}' has an invalid format. "
                f"Valid IFSC codes are 11 characters: 4 letters (bank code) + '0' + "
                f"6 alphanumeric (branch code). Example: HDFC0001234. "
                f"The correct IFSC code needs to be determined for the bank: '{creditor_bank}'."
            ),
            field_name="creditor_agent_bic",
            original_value=creditor_agent_bic,
            payment_data=canonical_json,
            conversion_context={
                "source_format": source_format,
                "target_format": target_format,
                "conversion_id": conversion_id,
                "conversion_run_id": conversion_run_id,
                "detailed_processing": detailed_processing or {},
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
    """

    creditor_name = canonical_json.get("creditor_name", "")

    if creditor_name and _looks_like_trading_name(creditor_name):
        raise CountryValidationException(
            problem=(
                f"The creditor name '{creditor_name}' appears to be a trading name or "
                f"abbreviation rather than the full legal entity name. For compliance and "
                f"sanctions screening purposes, payments should use the official registered "
                f"legal name (e.g., 'HSBC' should be 'HSBC Holdings plc', 'IBM' should be "
                f"'International Business Machines Corporation'). The correct legal name "
                f"needs to be verified against registered entity databases."
            ),
            field_name="creditor_name",
            original_value=creditor_name,
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
