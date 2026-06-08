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
- atlas_search: MongoDB Atlas Search for lookups (exact or fuzzy)
  - Use fuzzy=False for exact lookups (confidence: 1.0)
  - Use fuzzy=True for typo-tolerant search (confidence: 0.7-0.95)
- vector_search: MongoDB Atlas Vector Search for semantic similarity
  - Works with ANY collection that has embeddings + vector index
  - Use for matching by meaning, not keywords (confidence: 0.65-0.95)
- transliterate_text: Convert text to Japanese script using AI (confidence: 0.9)

Tool Priority:
1. Exact lookup: atlas_search(..., fuzzy=False) → confidence: 1.0, ~20ms
2. Fuzzy search: atlas_search(..., fuzzy=True) → confidence: 0.7-0.95, ~20ms
3. Semantic search: vector_search(...) → confidence: 0.65-0.95, ~50ms
4. AI generation: transliterate_text → confidence: 0.9, ~1-2s

Execution Agent Tools:
- update_payment_field: Update a field in payment document
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
            model_id="us.anthropic.claude-haiku-4-5-20251001-v1:0"
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
def atlas_search(
    collection: str,
    query: str,
    search_fields: list,
    return_fields: list = None,
    fuzzy: bool = True,
    limit: int = 3
) -> Dict[str, Any]:
    """
    Search MongoDB collections using Atlas Search for exact or fuzzy matching.

    This is the PRIMARY lookup tool for finding data in the database. It supports:
    - Exact matching (fuzzy=False): For precise lookups, returns confidence 1.0
    - Fuzzy matching (fuzzy=True): For typo-tolerant search, returns confidence 0.7-0.95

    Strategy:
    1. First try with fuzzy=False for exact match (confidence 1.0)
    2. If not found, retry with fuzzy=True for typo tolerance (confidence 0.7-0.95)
    3. If still not found, use transliterate_text for AI generation

    Supported Collections:
    - "bankDetails": Company names, Katakana translations, bank info
    - "ifscCodes": Indian bank IFSC codes, branches, cities
    - "registeredEntities": Legal names and trading names for name verification

    Fuzzy Matching:
    - Handles typos like "DENSOO" → "DENSO CORPORATION"
    - Handles spacing issues like "VOLKS WAGEN" → "VOLKSWAGEN AG"
    - Handles partial matches like "Toyota Motor" → "TOYOTA MOTOR CORPORATION"

    Args:
        collection: Collection name ("bankDetails" or "ifscCodes")
        query: Search text (e.g., "DENSOO", "HDFC Connaught Delhi")
        search_fields: Fields to search in (e.g., ["name_english"] or ["bank", "branch", "city"])
        return_fields: Fields to return (optional, returns matched fields if not specified)
        fuzzy: Enable fuzzy matching for typo tolerance (default: True)
        limit: Max results to return (default: 3)

    Returns:
        dict: {
            "found": bool,           # True if results found with good score
            "results": list,         # All matching documents
            "top_result": dict,      # Best match (highest score)
            "search_score": float,   # Atlas Search relevance score
            "confidence": float,     # Mapped confidence (0.7-0.95 for fuzzy)
            "match_type": "fuzzy"    # Always "fuzzy" for this tool
        }

    Examples:
        # Find company with typo in name
        >>> atlas_search("bankDetails", "DENSOO CORP", ["name_english"])
        {"found": True, "top_result": {"name_english": "DENSO CORPORATION", ...}, ...}

        # Find IFSC with partial bank/branch info
        >>> atlas_search("ifscCodes", "HDFC Connaught Delhi", ["bank", "branch", "city"])
        {"found": True, "top_result": {"ifsc": "HDFC0000001", ...}, ...}

        # Find legal name from trading name
        >>> atlas_search("registeredEntities", "Acme Co.", ["legal_name", "trading_names"])
        {"found": True, "top_result": {"legal_name": "Acme Corporation Limited", ...}, ...}
    """
    from services.mongodb_service import get_mongodb_service
    from config.settings import settings

    logger.info(f"Atlas Search: collection={collection}, query='{query}', fields={search_fields}")

    # Check if Atlas Search is enabled
    if not settings.atlas_search_enabled:
        logger.info("Atlas Search is disabled in settings")
        return {
            "found": False,
            "results": [],
            "top_result": None,
            "search_score": 0,
            "confidence": 0,
            "match_type": "fuzzy",
            "error": "Atlas Search is disabled"
        }

    # Map collection (logical name) to its Atlas Search index.
    # bankDetails + ifscCodes were merged into correspondentBanks; registeredEntities
    # was renamed to legalEntities. The old logical keys are kept as aliases so the
    # agent prompt is unchanged. Physical collection resolution happens in
    # MongoDBService.get_collection. See collection-mapping-and-demo-changes.md.
    index_map = {
        "bankDetails": "correspondentBanksSearch",       # alias → merged collection
        "ifscCodes": "correspondentBanksSearch",         # alias → merged collection
        "correspondentBanks": "correspondentBanksSearch",
        "registeredEntities": "legalEntitiesSearch",     # alias → renamed collection
        "legalEntities": "legalEntitiesSearch",
    }
    index_name = index_map.get(collection)

    if not index_name:
        logger.error(f"No search index configured for collection: {collection}")
        return {
            "found": False,
            "results": [],
            "top_result": None,
            "search_score": 0,
            "confidence": 0,
            "match_type": "fuzzy",
            "error": f"No search index for collection: {collection}. Supported: {list(index_map.keys())}"
        }

    try:
        mongo = get_mongodb_service()
        coll = mongo.get_collection(collection)

        # Build search query - compound if multiple fields, text if single
        max_edits = settings.atlas_search_max_edits if fuzzy else 0
        fuzzy_config = {"maxEdits": max_edits} if fuzzy else {}

        if len(search_fields) == 1:
            search_query = {
                "text": {
                    "query": query,
                    "path": search_fields[0],
                    "fuzzy": fuzzy_config
                }
            }
        else:
            # Compound query for multiple fields
            search_query = {
                "compound": {
                    "should": [
                        {
                            "text": {
                                "query": query,
                                "path": field,
                                "fuzzy": fuzzy_config
                            }
                        }
                        for field in search_fields
                    ],
                    "minimumShouldMatch": 1
                }
            }

        # Build projection - always include search score
        projection = {"score": {"$meta": "searchScore"}, "_id": 0}
        if return_fields:
            for field in return_fields:
                projection[field] = 1
        else:
            # If no return_fields specified, include all search_fields
            for field in search_fields:
                projection[field] = 1

        # Build aggregation pipeline
        pipeline = [
            {"$search": {"index": index_name, **search_query}},
            {"$limit": limit},
            {"$project": projection}
        ]

        logger.debug(f"Atlas Search pipeline: {pipeline}")

        results = list(coll.aggregate(pipeline))

        min_score = settings.fuzzy_search_min_score
        if results and results[0].get("score", 0) > min_score:
            top = results[0]
            score = top.get("score", 0)
            # Confidence scoring:
            # - Exact match (fuzzy=False) with high score: 1.0
            # - Fuzzy match: 0.7-0.95 based on score
            if not fuzzy and score > 0.9:
                confidence = 1.0
            else:
                confidence = min(0.95, 0.7 + (score - 0.5) * 0.5)

            logger.info(f"Atlas Search found {len(results)} results, top score: {score:.2f}")

            return {
                "found": True,
                "results": results,
                "top_result": top,
                "search_score": round(score, 3),
                "confidence": round(confidence, 2),
                "match_type": "fuzzy"
            }

        logger.info(f"Atlas Search: no results above threshold for query '{query}'")
        return {
            "found": False,
            "results": results,
            "top_result": None,
            "search_score": 0,
            "confidence": 0,
            "match_type": "fuzzy"
        }

    except Exception as e:
        logger.error(f"Atlas Search error: {e}")
        return {
            "found": False,
            "results": [],
            "top_result": None,
            "search_score": 0,
            "confidence": 0,
            "match_type": "fuzzy",
            "error": str(e)
        }


@tool
def vector_search(
    collection: str,
    query: str,
    index_name: str = None,
    embedding_field: str = "embedding",
    return_fields: list = None,
    filter: dict = None,
    limit: int = 3
) -> Dict[str, Any]:
    """
    Search any MongoDB collection using Atlas Vector Search for semantic similarity.

    Use this tool for semantic/conceptual matching when exact or fuzzy text search
    won't work. Vector search finds semantically similar items even when the words
    are completely different (e.g., "monthly wages" matches "Salary Payment").

    This is a GENERALIZED tool - works with ANY collection that has:
    1. An embedding field (default: "embedding")
    2. A vector search index in MongoDB Atlas

    Best for:
    - Classifying free-text into categories
    - Finding semantically similar documents
    - Matching concepts rather than exact keywords
    - Any scenario where meaning matters more than wording

    When to use vs atlas_search:
    - atlas_search: Query contains specific keywords to match literally
    - vector_search: Query is natural language that needs conceptual matching

    Args:
        collection: Any MongoDB collection with embeddings (e.g., "purposeCodes", "products", "faqs")
        query: Free-text description to match semantically
        index_name: Vector search index name (default: "{collection}_vector")
        embedding_field: Field containing embeddings (default: "embedding")
        return_fields: Fields to return (optional, returns all non-embedding fields if not specified)
        filter: Optional filter criteria (e.g., {"category": "Payroll"})
        limit: Max results to return (default: 3)

    Returns:
        dict: {
            "found": bool,           # True if results found above threshold
            "results": list,         # All matching documents with scores
            "top_result": dict,      # Best match (highest similarity)
            "similarity_score": float, # Cosine similarity (0-1)
            "confidence": float,     # Mapped confidence (0.65-0.95)
            "match_type": "semantic" # Always "semantic" for vector search
        }

    Examples:
        # Classify payment description
        >>> vector_search("purposeCodes", "paying monthly salaries to staff")
        {"found": True, "top_result": {"code": "SALA", "name": "Salary Payment"}, ...}

        # Search product catalog
        >>> vector_search("products", "comfortable running shoes for marathon")
        {"found": True, "top_result": {"sku": "RUN-001", "name": "Marathon Pro"}, ...}

        # Search with custom index name
        >>> vector_search("documents", "contract termination clause", index_name="docs_semantic_idx")
        {"found": True, "top_result": {"title": "Service Agreement", ...}, ...}

        # Search with filter
        >>> vector_search("articles", "machine learning basics", filter={"category": "AI"})
        {"found": True, "top_result": {"title": "Introduction to ML", ...}, ...}
    """
    from services.mongodb_service import get_mongodb_service
    from services.embedding_service import get_embedding_service
    from config.settings import settings

    logger.info(f"Vector Search: collection={collection}, query='{query[:50]}...'")

    # Check if vector search is enabled
    if not settings.vector_search_enabled:
        logger.info("Vector Search is disabled in settings")
        return {
            "found": False,
            "results": [],
            "top_result": None,
            "similarity_score": 0,
            "confidence": 0,
            "match_type": "semantic",
            "error": "Vector Search is disabled"
        }

    # Use provided index_name or derive from collection name (camelCase + "Vector" suffix)
    vector_index_name = index_name or f"{collection}Vector"

    try:
        # Generate query embedding
        embedding_service = get_embedding_service()
        query_embedding = embedding_service.embed_text(query)

        logger.debug(f"Generated query embedding: {len(query_embedding)} dimensions")

        # Build vector search pipeline
        mongo = get_mongodb_service()
        coll = mongo.get_collection(collection)

        logger.info(f"Using vector index: {vector_index_name}")

        # Vector search stage
        vector_search_stage = {
            "$vectorSearch": {
                "index": vector_index_name,
                "path": embedding_field,
                "queryVector": query_embedding,
                "numCandidates": limit * 10,  # Search more candidates for better results
                "limit": limit
            }
        }

        # Add filter if provided
        if filter:
            vector_search_stage["$vectorSearch"]["filter"] = filter

        # Build projection
        projection = {
            "score": {"$meta": "vectorSearchScore"},
            "_id": 0,
            "embedding": 0,  # Don't return large embedding arrays
            "embedding_text": 0
        }
        if return_fields:
            # Reset projection and only include specified fields + score
            projection = {"score": {"$meta": "vectorSearchScore"}, "_id": 0}
            for field in return_fields:
                projection[field] = 1

        pipeline = [
            vector_search_stage,
            {"$project": projection}
        ]

        logger.debug(f"Vector Search pipeline: {pipeline}")

        results = list(coll.aggregate(pipeline))

        min_score = settings.vector_search_min_score
        if results and results[0].get("score", 0) > min_score:
            top = results[0]
            score = top.get("score", 0)

            # Confidence mapping for vector search:
            # - Score 0.9+ → confidence 0.95
            # - Score 0.7-0.9 → confidence 0.75-0.95
            # - Score 0.5-0.7 → confidence 0.65-0.75
            confidence = min(0.95, 0.65 + (score - 0.5) * 0.75)

            logger.info(f"Vector Search found {len(results)} results, top score: {score:.3f}, confidence: {confidence:.2f}")

            return {
                "found": True,
                "results": results,
                "top_result": top,
                "similarity_score": round(score, 3),
                "confidence": round(confidence, 2),
                "match_type": "semantic"
            }

        logger.info(f"Vector Search: no results above threshold ({min_score}) for query '{query[:30]}...'")
        return {
            "found": False,
            "results": results,
            "top_result": None,
            "similarity_score": 0,
            "confidence": 0,
            "match_type": "semantic"
        }

    except Exception as e:
        logger.error(f"Vector Search error: {e}")
        return {
            "found": False,
            "results": [],
            "top_result": None,
            "similarity_score": 0,
            "confidence": 0,
            "match_type": "semantic",
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
    - Update creditorName with transliterated Japanese text
    - Add IFSC code to creditorBic field
    - Correct any payment field based on resolution findings
    - Enrich missing information in payment data

    The tool validates that:
    1. The payment record exists in the database
    2. The field_name is a valid canonical JSON field
    3. The update is successfully applied

    Args:
        payment_id: Unique identifier for the payment (e.g., conversionId or transactionRef)
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
        ...     field_name="creditorName",
        ...     new_value="トヨタ自動車株式会社"
        ... )
        {
            "payment_id": "MT103_to_pacs008_12345",
            "field_name": "creditorName",
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
        "transactionRef", "amount", "currency", "valueDate",
        # Party fields
        "debtorName", "debtorAccount", "debtorAddress", "debtorCountry",
        "debtorAgent", "debtorAgentBic",
        "creditorName", "creditorAccount", "creditorAddress", "creditorCountry",
        "creditorAgent", "creditorBic", "creditorBank",
        "intermediaryAgent", "intermediaryAgentBic",
        # Payment details
        "remittanceInfo", "paymentPurpose", "instructionCode",
        "endToEndId", "instructionId", "messageId",
        "chargeBearer", "charges", "exchangeRate",
        # Additional fields
        "priority", "paymentMethod", "serviceLevel",
        "localInstrument", "categoryPurpose",
        "regulatoryReporting", "relatedReference",
        "creditorAgentName", "creditorAgentAddress",
        "debtorAgentName", "debtorAgentAddress",
        "ultimateDebtor", "ultimateCreditor"
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
        collection = mongo.get_collection("canonicalJsonStorage")

        # Determine search field based on payment_id format
        # If payment_id is a UUID (36 chars with hyphens), search by _id (conversion_run_id)
        # Otherwise search by conversion_id (backward compatibility)
        if len(payment_id) == 36 and payment_id.count('-') == 4:
            # This is a UUID (conversion_run_id)
            query = {"_id": payment_id}
            logger.info(f"Searching by conversion_run_id: {payment_id[:16]}...")
        else:
            # This is a conversion_id (e.g., "MT103_to_JSON").
            query = {"conversionId": payment_id}
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

        # Storage shape is camelCase end-to-end now — no translation needed.
        json_data = payment_record.get("jsonData", {})
        old_value = json_data.get(field_name, "")

        # Build $set with camelCase dotted paths directly.
        now = datetime.now(timezone.utc).isoformat()
        set_dict = {
            f"jsonData.{field_name}": new_value,
            "metadata.lastUpdated": now,
            f"metadata.auditTrail.{field_name}": {
                "oldValue": old_value,
                "newValue": new_value,
                "updatedAt": now,
                "updatedBy": "payment_agent",
            },
        }
        update_result = collection.update_one(
            query,  # Use same query as find_one (either by _id or conversionId)
            {"$set": set_dict},
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