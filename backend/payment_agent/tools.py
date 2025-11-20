"""
Tool functions for payment agent system.

This module contains all @tool decorated functions that agents can use.
The @tool decorator registers these functions with LangChain, making them
available to agents via the ReAct pattern.

Key Points:
- Each tool has a detailed docstring - THIS IS HOW LLMs DECIDE WHICH TOOL TO USE
- Tools are organized by agent type (Resolution, Execution)
- Tools should be focused and do one thing well
- Return structured data (dicts) for easy processing

Resolution Agent Tools:
- transliterate_text: Convert text to Japanese script (AI fallback)
- lookup_company_katakana: Look up pre-translated Katakana names (fast DB lookup)
- lookup_ifsc: Look up IFSC code for Indian banks

Execution Agent Tools:
- update_payment_field: Update a field in payment document
- validate_payment: Validate payment data after changes
"""

import logging
from typing import Dict, Any
from langchain_core.tools import tool

logger = logging.getLogger(__name__)


# =============================================================================
# RESOLUTION AGENT TOOLS
# =============================================================================


@tool
def transliterate_text(text: str, target_script: str = "katakana") -> Dict[str, Any]:
    """
    Transliterate text to Japanese script (katakana or hiragana).

    Use this tool when you need to convert Western names or text to Japanese format
    for payments going to Japan. This is essential for beneficiary names, company
    names, or addresses that need to appear in Japanese characters.

    Katakana is the standard script for:
    - Foreign company names (e.g., "Microsoft" -> "マイクロソフト")
    - Foreign person names (e.g., "John Smith" -> "ジョン・スミス")
    - Foreign place names

    Hiragana is less common but used for:
    - Native Japanese words written phonetically
    - Specific stylistic requirements

    Args:
        text: The text to transliterate (e.g., "John Smith Corporation")
        target_script: Either "katakana" or "hiragana" (default: "katakana")

    Returns:
        dict: {
            "original": str,           # Original input text
            "transliterated": str,     # Transliterated result
            "script": str,             # Script used (katakana/hiragana)
            "confidence": float        # Confidence score (0-1)
        }

    Example:
        >>> transliterate_text("John Smith Corporation", "katakana")
        {
            "original": "John Smith Corporation",
            "transliterated": "ジョン・スミス・コーポレーション",
            "script": "katakana",
            "confidence": 0.9
        }
    """
    from services.bedrock_service import get_bedrock_service

    logger.info(f"Transliterating text: '{text}' to {target_script}")

    try:
        bedrock = get_bedrock_service()

        # Craft prompt for Claude to do transliteration
        prompt = f"""Transliterate the following text to Japanese {target_script}.

Text to transliterate: {text}

Rules:
- Use proper {target_script} characters only
- For company names, use katakana (standard for foreign companies in Japan)
- For person names, use katakana with middle dot (・) to separate names
- Preserve meaning and approximate pronunciation
- Be consistent with standard Japanese transliterations
- Do NOT add any explanation, just return the transliterated text

Respond with ONLY the transliterated text in {target_script}, nothing else."""

        # Call Claude Haiku (fast and cheap for this task)
        response = bedrock.invoke_claude(
            prompt=prompt,
            max_tokens=200,
            temperature=0.0,  # Deterministic for consistency
            model_id="anthropic.claude-3-haiku-20240307-v1:0"
        )

        transliterated = response["text"].strip()

        logger.info(f"Transliteration result: '{transliterated}'")

        return {
            "original": text,
            "transliterated": transliterated,
            "script": target_script,
            "confidence": 0.9  # Claude is generally reliable for transliteration
        }

    except Exception as e:
        logger.error(f"Error during transliteration: {e}")
        # Return error result but don't crash
        return {
            "original": text,
            "transliterated": "",
            "script": target_script,
            "confidence": 0.0,
            "error": str(e)
        }


@tool
def lookup_company_katakana(company_name: str) -> Dict[str, Any]:
    """
    Look up pre-translated Katakana name for a company from database.

    Use this tool when processing payments to Japan that require company names
    in Katakana script. This tool searches a database of known companies with
    their official Katakana translations.

    This is FASTER and MORE ACCURATE than AI transliteration for known companies
    because it uses official registered names from the database. Always try this
    tool FIRST before using transliterate_text as a fallback.

    The database contains major Japanese companies and common international companies
    that frequently do business with Japan.

    Args:
        company_name: English company name (e.g., "DENSO CORPORATION", "SONY CORPORATION")

    Returns:
        dict: {
            "found": bool,              # True if company found in database
            "name_english": str,        # Original English name
            "name_katakana": str,       # Official Katakana translation
            "name_hiragana": str,       # Optional Hiragana version
            "bank_name": str,           # Associated bank (if known)
            "swift_code": str,          # Bank SWIFT code (if known)
            "city": str,                # City location
            "country": str,             # ISO 2-letter country code
            "confidence": float         # 1.0 if found, 0.0 if not found
        }

    Example:
        >>> lookup_company_katakana("DENSO CORPORATION")
        {
            "found": True,
            "name_english": "DENSO CORPORATION",
            "name_katakana": "デンソー",
            "bank_name": "Bank of Tokyo-Mitsubishi UFJ",
            "confidence": 1.0
        }

    Important: If this tool returns found=False, you should fallback to using
    the transliterate_text tool to generate the Katakana name using AI.
    """
    from services.mongodb_service import get_mongodb_service

    logger.info(f"Looking up Katakana name for company: {company_name}")

    try:
        mongo = get_mongodb_service()
        collection = mongo.get_collection("bank_details")

        # Case-insensitive exact match on company name
        result = collection.find_one({
            "name_english": {"$regex": f"^{company_name}$", "$options": "i"}
        })

        if result:
            logger.info(f"Found company in database: {result.get('name_katakana')}")
            return {
                "found": True,
                "name_english": result.get("name_english"),
                "name_katakana": result.get("name_katakana"),
                "name_hiragana": result.get("name_hiragana"),
                "bank_name": result.get("bank_name"),
                "swift_code": result.get("swift_code"),
                "city": result.get("city"),
                "country": result.get("country"),
                "confidence": 1.0
            }
        else:
            logger.warning(f"Company not found in database: {company_name}")
            return {
                "found": False,
                "name_english": company_name,
                "name_katakana": None,
                "name_hiragana": None,
                "bank_name": None,
                "swift_code": None,
                "city": None,
                "country": None,
                "confidence": 0.0,
                "error": "Company not found in database - use transliterate_text as fallback"
            }

    except Exception as e:
        logger.error(f"Error looking up company Katakana name: {e}")
        return {
            "found": False,
            "name_english": company_name,
            "confidence": 0.0,
            "error": str(e)
        }


@tool
def lookup_ifsc(bank_name: str, branch: str, city: str) -> Dict[str, Any]:
    """
    Look up IFSC code for an Indian bank branch from database.

    Use this tool when processing payments to India that need an IFSC (Indian Financial
    System Code). IFSC codes are mandatory for NEFT, RTGS, and IMPS transfers in India.

    This tool searches the MongoDB database for exact IFSC codes based on bank name,
    branch, and city. It performs case-insensitive matching.

    IFSC Code Format: XXXX0YYYYYY
    - First 4 characters: Bank code (e.g., "HDFC", "ICIC", "SBIN")
    - 5th character: Always "0" (reserved)
    - Last 6 characters: Branch code

    Common Indian Banks:
    - HDFC Bank: HDFC0XXXXXX
    - ICICI Bank: ICIC0XXXXXX
    - State Bank of India: SBIN0XXXXXX
    - Axis Bank: UTIB0XXXXXX
    - Punjab National Bank: PUNB0XXXXXX

    Args:
        bank_name: Name of the bank (e.g., "HDFC Bank", "State Bank of India")
        branch: Branch name (e.g., "Connaught Place", "Anna Nagar")
        city: City where branch is located (e.g., "New Delhi", "Chennai")

    Returns:
        dict: {
            "ifsc": str,              # The IFSC code (11 characters) or empty if not found
            "bank_name": str,         # Standardized bank name from database
            "branch": str,            # Branch name
            "city": str,              # City
            "confidence": float,      # 1.0 if found, 0.0 if not found
            "found": bool            # True if found in database, False otherwise
        }

    Example:
        >>> lookup_ifsc("HDFC Bank", "Connaught Place", "New Delhi")
        {
            "ifsc": "HDFC0000123",
            "bank_name": "HDFC Bank",
            "branch": "Connaught Place",
            "city": "New Delhi",
            "confidence": 1.0,
            "found": True
        }
    """
    from services.mongodb_service import get_mongodb_service

    logger.info(f"Looking up IFSC for: {bank_name}, {branch}, {city}")

    try:
        mongo = get_mongodb_service()
        collection = mongo.get_collection("ifsc_codes")

        # Search for matching IFSC code
        # Case-insensitive search on bank name, branch, and city
        query = {
            "$and": [
                {"bank": {"$regex": bank_name, "$options": "i"}},
                {"branch": {"$regex": branch, "$options": "i"}},
                {"city": {"$regex": city, "$options": "i"}}
            ]
        }

        result = collection.find_one(query)

        if result:
            logger.info(f"Found IFSC in database: {result.get('ifsc')}")
            return {
                "ifsc": result.get("ifsc"),
                "bank_name": result.get("bank"),
                "branch": result.get("branch"),
                "city": result.get("city"),
                "confidence": 1.0,
                "found": True
            }
        else:
            logger.warning(f"IFSC not found in database for: {bank_name}, {branch}, {city}")
            return {
                "ifsc": "",
                "bank_name": bank_name,
                "branch": branch,
                "city": city,
                "confidence": 0.0,
                "found": False,
                "error": "IFSC code not found in database"
            }

    except Exception as e:
        logger.error(f"Error looking up IFSC: {e}")
        return {
            "ifsc": "",
            "bank_name": bank_name,
            "branch": branch,
            "city": city,
            "confidence": 0.0,
            "found": False,
            "error": str(e)
        }


# =============================================================================
# EXECUTION AGENT TOOLS
# =============================================================================


@tool
def update_payment_field(payment_id: str, field_name: str, new_value: str) -> Dict[str, Any]:
    """
    Update a specific field in a payment record.

    Use this tool when you need to apply a correction or enrichment to a payment field
    in the database. This is the execution step after the Resolution Agent has determined
    the correct value for a field.

    Common use cases:
    - Update creditor_name with transliterated Japanese text
    - Add IFSC code to creditor_bank field
    - Correct any payment field based on resolution findings
    - Enrich missing information in payment data

    The tool validates that:
    1. The payment record exists in the database
    2. The field_name is a valid canonical JSON field
    3. The update is successfully applied

    Args:
        payment_id: Unique identifier for the payment (e.g., conversion_id or transaction_ref)
        field_name: Name of the field to update (must be from canonical JSON vocabulary)
        new_value: The new value to set for the field

    Returns:
        dict: {
            "payment_id": str,         # Payment identifier
            "field_name": str,         # Field that was updated
            "old_value": str,          # Previous value (for audit)
            "new_value": str,          # New value applied
            "updated": bool,           # True if update succeeded
            "timestamp": str           # ISO timestamp of update
        }

    Example:
        >>> update_payment_field(
        ...     payment_id="MT103_to_pacs008_12345",
        ...     field_name="creditor_name",
        ...     new_value="トヨタ自動車株式会社"
        ... )
        {
            "payment_id": "MT103_to_pacs008_12345",
            "field_name": "creditor_name",
            "old_value": "Toyota Motor Corporation",
            "new_value": "トヨタ自動車株式会社",
            "updated": True,
            "timestamp": "2024-01-15T10:30:00Z"
        }
    """
    from services.mongodb_service import get_mongodb_service
    from datetime import datetime, timezone

    logger.info(f"Updating payment {payment_id}, field '{field_name}' to '{new_value}'")

    # Define canonical JSON field vocabulary for validation
    VALID_FIELDS = {
        # Required fields
        "transaction_ref", "amount", "currency", "value_date",
        # Party fields
        "debtor_name", "debtor_account", "debtor_address", "debtor_country",
        "debtor_agent", "debtor_agent_bic",
        "creditor_name", "creditor_account", "creditor_address", "creditor_country",
        "creditor_agent", "creditor_bic", "creditor_bank",
        "intermediary_agent", "intermediary_agent_bic",
        # Payment details
        "remittance_info", "payment_purpose", "instruction_code",
        "end_to_end_id", "instruction_id", "message_id",
        "charge_bearer", "charges", "exchange_rate",
        # Additional fields
        "priority", "payment_method", "service_level",
        "local_instrument", "category_purpose",
        "regulatory_reporting", "related_reference",
        "creditor_agent_name", "creditor_agent_address",
        "debtor_agent_name", "debtor_agent_address",
        "ultimate_debtor", "ultimate_creditor"
    }

    try:
        # Validate field_name
        if field_name not in VALID_FIELDS:
            logger.warning(f"Field '{field_name}' not in canonical vocabulary")
            return {
                "payment_id": payment_id,
                "field_name": field_name,
                "old_value": "",
                "new_value": new_value,
                "updated": False,
                "error": f"Invalid field name. Must be one of: {sorted(VALID_FIELDS)}"
            }

        mongo = get_mongodb_service()
        collection = mongo.get_collection("canonical_json_storage")

        # Determine search field based on payment_id format
        # If payment_id is a UUID (36 chars with hyphens), search by _id (conversion_run_id)
        # Otherwise search by conversion_id (backward compatibility)
        if len(payment_id) == 36 and payment_id.count('-') == 4:
            # This is a UUID (conversion_run_id)
            query = {"_id": payment_id}
            logger.info(f"Searching by conversion_run_id: {payment_id[:16]}...")
        else:
            # This is a conversion_id (e.g., "MT103_to_JSON")
            query = {"conversion_id": payment_id}
            logger.info(f"Searching by conversion_id: {payment_id}")

        # Find the payment record
        payment_record = collection.find_one(query)

        if not payment_record:
            logger.error(f"Payment not found: {payment_id}")
            return {
                "payment_id": payment_id,
                "field_name": field_name,
                "old_value": "",
                "new_value": new_value,
                "updated": False,
                "error": "Payment record not found"
            }

        # Get old value for audit (json_data contains the canonical JSON)
        json_data = payment_record.get("json_data", {})
        old_value = json_data.get(field_name, "")

        # Update the field
        now = datetime.now(timezone.utc).isoformat()
        update_result = collection.update_one(
            query,  # Use same query as find_one (either by _id or conversion_id)
            {
                "$set": {
                    f"json_data.{field_name}": new_value,
                    "metadata.last_updated": now,
                    f"metadata.audit_trail.{field_name}": {
                        "old_value": old_value,
                        "new_value": new_value,
                        "updated_at": now,
                        "updated_by": "payment_agent"
                    }
                }
            }
        )

        if update_result.modified_count > 0:
            logger.info(f"Successfully updated {field_name} for payment {payment_id}")
            return {
                "payment_id": payment_id,
                "field_name": field_name,
                "old_value": old_value,
                "new_value": new_value,
                "updated": True,
                "timestamp": now
            }
        else:
            logger.warning(f"No changes made to payment {payment_id}")
            return {
                "payment_id": payment_id,
                "field_name": field_name,
                "old_value": old_value,
                "new_value": new_value,
                "updated": False,
                "error": "No changes were made (value might be the same)"
            }

    except Exception as e:
        logger.error(f"Error updating payment field: {e}")
        return {
            "payment_id": payment_id,
            "field_name": field_name,
            "old_value": "",
            "new_value": new_value,
            "updated": False,
            "error": str(e)
        }