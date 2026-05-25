"""Storage-boundary translator for canonicalJsonStorage.

SYNCED COPY — do not edit directly. Edit the canonical file and re-sync:
  backend/shared/translator.py
The umbrella copy is source of truth; this per-service copy exists because
the payment_agent Docker context does not include backend/shared/.

Runtime pipeline (conversion configs, regex patterns, in-memory JSON) stays
snake_case. MongoDB storage shape is camelCase to align with BIAN canonical
field naming. This module flips between the two at every read/write touching
the canonicalJsonStorage collection.

Public API:
  - to_storage(doc)            : recursive snake -> camel for writes
  - from_storage(doc)          : recursive camel -> snake for reads
  - dotted_path_to_storage(p)  : "json_data.creditor_name" -> "jsonData.creditorName"
  - query_to_storage(filter)   : {"conversion_id": x} -> {"conversionId": x}

Unknown keys pass through. Snake-shaped keys (contain '_') not in any rename
map emit a WARN log so drift is visible before it bites.

SWIFT MT tag keys ("20", "23B", "32A", "50K", ...) are all-digit/letter and
contain no underscore, so they pass silently.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


# Top-level document fields (wrapper around the payload).
WRAPPER_RENAME: dict[str, str] = {
    "conversion_id": "conversionId",
    "json_data": "jsonData",
    "created_at": "createdAt",
    # _id and source_message left as-is.
}

# Fields under metadata{}.
METADATA_RENAME: dict[str, str] = {
    "source_format": "sourceFormat",
    "target_format": "targetFormat",
    "processing_time_seconds": "processingTimeSeconds",
    "last_updated": "lastUpdated",
    "audit_trail": "auditTrail",
}

# Fields inside json_data{} (the payment payload).
# Union across all 7 conversion configs (MT103, pacs.008, pacs.009,
# ISO 8583, cain.001, JSON). Keep in sync as configs evolve.
FIELD_RENAME: dict[str, str] = {
    # Identifiers
    "transaction_ref": "transactionRef",
    "end_to_end_id": "endToEndId",
    "instruction_id": "instructionId",
    "message_id": "messageId",
    "uetr": "uetr",
    "transaction_id": "transactionId",
    # Times / dates
    "creation_datetime": "creationDateTime",
    "value_date": "valueDate",
    "settlement_date": "settlementDate",
    "local_date": "localDate",
    "local_time": "localTime",
    "transaction_time": "transactionTime",
    "transmission_datetime": "transmissionDateTime",
    # Amounts / FX
    "amount": "amount",
    "currency": "currency",
    "currency_code": "currencyCode",
    "original_amount": "originalAmount",
    "original_currency": "originalCurrency",
    # Debtor / creditor
    "debtor_name": "debtorName",
    "debtor_account": "debtorAccount",
    "debtor_address": "debtorAddress",
    "debtor_bank": "debtorBank",
    "debtor_bic": "debtorBic",
    "debtor_city": "debtorCity",
    "debtor_country": "debtorCountry",
    "creditor_name": "creditorName",
    "creditor_account": "creditorAccount",
    "creditor_address": "creditorAddress",
    "creditor_bank": "creditorBank",
    "creditor_bic": "creditorBic",
    "creditor_city": "creditorCity",
    "creditor_country": "creditorCountry",
    # Agents / correspondents
    "instructing_agent_bic": "instructingAgentBic",
    "instructed_agent_bic": "instructedAgentBic",
    "intermediary_agent_bic": "intermediaryAgentBic",
    # Charges / purpose / remittance
    "charge_bearer": "chargeBearer",
    "category_purpose": "categoryPurpose",
    "payment_purpose": "paymentPurpose",
    "remittance_info": "remittanceInfo",
    "remittance_unstructured": "remittanceUnstructured",
    "invoice_number": "invoiceNumber",
    "instruction_info": "instructionInfo",
    # Settlement / message
    "settlement_method": "settlementMethod",
    "number_of_transactions": "numberOfTransactions",
    "service_level": "serviceLevel",
    "bank_operation_code": "bankOperationCode",
    "message_type": "messageType",
    # Card (cain.001 / ISO 8583)
    "card_number": "cardNumber",
    "pan": "pan",
    "processing_code": "processingCode",
    "merchant_id": "merchantId",
    "merchant_name": "merchantName",
    "merchant_city": "merchantCity",
    "merchant_country": "merchantCountry",
    "merchant_info": "merchantInfo",
    "terminal_id": "terminalId",
    "mti": "mti",
    "stan": "stan",
    "rrn": "rrn",
    # Crypto (pacs.008 / crypto-marker conversion path).
    # Sourced from conversion_configs `map.to[]` entries — i.e. the final
    # canonical-JSON key names, not the intermediate `extract` keys.
    "crypto_amount": "cryptoAmount",
    "crypto_blockchain": "cryptoBlockchain",
    "crypto_receiver_wallet": "cryptoReceiverWallet",
    "details": "details",
    # Audit-trail leaf keys (under metadata.auditTrail.<field>.*).
    # The BIAN spec types these as camelCase; the agent writes them as
    # snake_case at tools.py:653, so the translator must flip both.
    "old_value": "oldValue",
    "new_value": "newValue",
    "updated_at": "updatedAt",
    "updated_by": "updatedBy",
}


# Combined snake->camel lookup for the recursive walker. Order of inclusion
# does not matter — keys are globally unique across the three maps.
_SNAKE_TO_CAMEL: dict[str, str] = {**WRAPPER_RENAME, **METADATA_RENAME, **FIELD_RENAME}
_CAMEL_TO_SNAKE: dict[str, str] = {v: k for k, v in _SNAKE_TO_CAMEL.items()}


def _looks_snake(key: str) -> bool:
    """A key 'looks snake_case' if it contains an underscore.

    SWIFT MT tags like "20", "23B", "50K" carry no underscore and are
    treated as pass-through tokens (not renamed, not warned).
    """
    return isinstance(key, str) and "_" in key


# Keys that legitimately contain '_' but must never be renamed or warned about.
# Mongo system field (_id) and the canonical source_message wrapper field that
# the spec intentionally leaves snake_case (it is not a BIAN canonical field).
SILENT_PASSTHROUGH: frozenset[str] = frozenset({"_id", "source_message"})


def _rename_key(key: str, mapping: dict[str, str], *, direction: str) -> str:
    """Translate one key. Pass-through with WARN on unmapped snake-shaped keys."""
    if key in mapping:
        return mapping[key]
    if (
        direction == "to_storage"
        and _looks_snake(key)
        and key not in SILENT_PASSTHROUGH
    ):
        logger.warning(
            "translator: unknown snake_case key '%s' passed through unchanged. "
            "Add it to translator.FIELD_RENAME if it is a json_data payload field.",
            key,
        )
    return key


def _walk(value: Any, mapping: dict[str, str], direction: str) -> Any:
    """Recursively translate dict keys. Lists are walked element-wise.

    Scalar values pass through. Dict keys are renamed via `mapping`;
    values are descended.
    """
    if isinstance(value, dict):
        return {
            _rename_key(k, mapping, direction=direction): _walk(v, mapping, direction)
            for k, v in value.items()
        }
    if isinstance(value, list):
        return [_walk(item, mapping, direction) for item in value]
    return value


def to_storage(doc: dict[str, Any]) -> dict[str, Any]:
    """Snake_case -> camelCase for writes to canonicalJsonStorage.

    Caller passes the dict it would have written. Returns a new dict in
    storage shape. Original is not mutated.
    """
    return _walk(doc, _SNAKE_TO_CAMEL, direction="to_storage")


def from_storage(doc: dict[str, Any]) -> dict[str, Any]:
    """CamelCase -> snake_case for reads from canonicalJsonStorage.

    Caller passes the dict returned by find_one() etc. Returns a new dict
    in runtime shape (matches the snake_case conversion configs).
    Idempotent — re-applying on an already-snake_case dict is a no-op
    because the inverse map has no snake_case keys.
    """
    return _walk(doc, _CAMEL_TO_SNAKE, direction="from_storage")


def dotted_path_to_storage(path: str) -> str:
    """Translate a dotted Mongo $set / projection path to storage shape.

    Example:
      "json_data.creditor_name"               -> "jsonData.creditorName"
      "metadata.audit_trail.creditor_name"    -> "metadata.auditTrail.creditorName"
      "metadata.last_updated"                 -> "metadata.lastUpdated"

    Each segment is translated independently against the combined map.
    Segments not in the map pass through (with WARN if snake-shaped).
    """
    return ".".join(
        _rename_key(segment, _SNAKE_TO_CAMEL, direction="to_storage")
        for segment in path.split(".")
    )


def query_to_storage(filter_doc: dict[str, Any]) -> dict[str, Any]:
    """Translate a find / find_one filter dict to storage shape.

    Used at agent query sites that filter on wrapper fields like
    {"conversion_id": payment_id}. Filter VALUES are not translated —
    only the keys.

    Nested dicts and arrays are not walked because Mongo query operators
    (e.g. $and, $or) introduce a different key namespace. If a future
    caller needs operator-aware translation, extend this function with
    operator passthrough.
    """
    return {
        _rename_key(k, _SNAKE_TO_CAMEL, direction="to_storage"): v
        for k, v in filter_doc.items()
    }
