#!/usr/bin/env python3
"""
BIAN reference-collection migration for the fsi-payments-processing demo.

Accommodates the model changes in
bian-data-model/context/collection-mapping-and-demo-changes.md:

  1. bank_details + ifsc_codes  -> correspondentBanks  (merge, new data file)
  2. registeredEntities         -> legalEntities        (rename)
  3. purpose_codes              -> purposeCodes          (rename, if still snake_case)
  4. canonicalJsonStorage       -> no change (model annotation only)

Plus the Atlas Search / Vector Search indexes that back them.

The application code uses logical names (bankDetails / ifscCodes / registeredEntities)
that are aliased to the new physical collections in
payment_agent/services/mongodb_service.py — so this script only has to make the
physical collections and indexes match.

Usage:
    # Show current state and what WOULD happen (no writes):
    python migrate_bian_collections.py

    # Perform the migration (load + rename + create indexes):
    python migrate_bian_collections.py --apply

    # After verifying the agent's JP/IN/purpose lookups still work, drop the
    # superseded collections and their old indexes (destructive, opt-in):
    python migrate_bian_collections.py --apply --drop-old

Connection:
    MONGODB_URI    required (Atlas connection string)
    DATABASE_NAME  the DB the agent reads (must match the agent's setting).
                   Override with --db. No safe default — you must be explicit.

Notes:
  - Atlas Search / Vector Search index creation requires an Atlas cluster that
    supports the search index commands (M0+ Atlas; not a local mongod).
  - renameCollection may be blocked on some Atlas tiers; this script falls back
    to copy-then-drop automatically.
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

from pymongo import MongoClient
from pymongo.errors import OperationFailure

DATA_DIR = Path(__file__).resolve().parent
CORRESPONDENT_BANKS_FILE = DATA_DIR / "fsi-payments-processing.correspondentBanks.json"

# Atlas Search index for the merged correspondent-bank directory (union of the
# fields the agent searches across the JP and IN scenarios).
CORRESPONDENT_BANKS_SEARCH = {
    "name": "correspondentBanksSearch",
    "definition": {
        "mappings": {
            "dynamic": False,
            "fields": {
                "name_english": {"type": "string", "analyzer": "lucene.standard"},
                "name_katakana": {"type": "string", "analyzer": "lucene.standard"},
                "name_hiragana": {"type": "string", "analyzer": "lucene.standard"},
                "bank_name": {"type": "string", "analyzer": "lucene.standard"},
                "bank": {"type": "string", "analyzer": "lucene.standard"},
                "branch": {"type": "string", "analyzer": "lucene.standard"},
                "city": {"type": "string", "analyzer": "lucene.standard"},
            },
        }
    },
}

# Atlas Search index for the renamed legal-entity directory (same fields the old
# registeredEntitiesSearch covered).
LEGAL_ENTITIES_SEARCH = {
    "name": "legalEntitiesSearch",
    "definition": {
        "mappings": {
            "dynamic": False,
            "fields": {
                "legal_name": {"type": "string", "analyzer": "lucene.standard"},
                "trading_names": {"type": "string", "analyzer": "lucene.standard"},
            },
        }
    },
}

# Vector index for purposeCodes (vector_search derives the name as "{collection}Vector").
# voyage-3 embeddings: 1024 dims, cosine similarity, stored on `embedding`.
PURPOSE_CODES_VECTOR = {
    "name": "purposeCodesVector",
    "type": "vectorSearch",
    "definition": {
        "fields": [
            {
                "type": "vector",
                "path": "embedding",
                "numDimensions": 1024,
                "similarity": "cosine",
            }
        ]
    },
}


def log(msg: str) -> None:
    print(msg, flush=True)


def collection_names(db) -> set:
    return set(db.list_collection_names())


def existing_search_indexes(coll) -> set:
    try:
        return {ix["name"] for ix in coll.list_search_indexes()}
    except OperationFailure as e:
        log(f"    (could not list search indexes: {e})")
        return set()


def ensure_search_index(db, coll_name: str, spec: dict, apply: bool) -> None:
    coll = db[coll_name]
    existing = existing_search_indexes(coll)
    if spec["name"] in existing:
        log(f"    ✓ index '{spec['name']}' already exists on {coll_name}")
        return
    if not apply:
        log(f"    [dry-run] would create index '{spec['name']}' on {coll_name}")
        return
    model = {"name": spec["name"], "definition": spec["definition"]}
    if spec.get("type"):
        model["type"] = spec["type"]
    try:
        coll.create_search_index(model)
        log(f"    + created index '{spec['name']}' on {coll_name}")
    except OperationFailure as e:
        log(f"    ! failed to create index '{spec['name']}' on {coll_name}: {e}")
        log("      Create it manually via the Atlas UI (see correspondentBanks-merge-steps.md).")


def rename_collection(db, src: str, dst: str, apply: bool) -> None:
    names = collection_names(db)
    if src not in names:
        log(f"    · source '{src}' not present — skipping rename (already done?)")
        return
    if dst in names:
        log(f"    · target '{dst}' already exists — skipping rename")
        return
    if not apply:
        log(f"    [dry-run] would rename {src} -> {dst}")
        return
    client = db.client
    try:
        client.admin.command(
            "renameCollection",
            f"{db.name}.{src}",
            to=f"{db.name}.{dst}",
        )
        log(f"    + renamed {src} -> {dst}")
    except OperationFailure as e:
        log(f"    ! renameCollection blocked ({e}); falling back to copy + drop")
        docs = list(db[src].find({}))
        if docs:
            db[dst].insert_many(docs)
        db[src].drop()
        log(f"    + copied {len(docs)} docs {src} -> {dst} and dropped {src}")


def load_correspondent_banks(db, apply: bool) -> None:
    coll = db["correspondentBanks"]
    count = coll.estimated_document_count()
    if count > 0:
        log(f"    ✓ correspondentBanks already populated ({count} docs) — skipping load")
        return
    if not CORRESPONDENT_BANKS_FILE.exists():
        log(f"    ! data file not found: {CORRESPONDENT_BANKS_FILE}")
        return
    docs = json.loads(CORRESPONDENT_BANKS_FILE.read_text())
    if not apply:
        log(f"    [dry-run] would insert {len(docs)} docs into correspondentBanks")
        return
    coll.insert_many(docs)
    log(f"    + inserted {len(docs)} docs into correspondentBanks")


def drop_old(db, apply: bool) -> None:
    names = collection_names(db)
    targets = ["bankDetails", "ifscCodes", "registeredEntities"]
    for name in targets:
        if name not in names:
            log(f"    · '{name}' not present — nothing to drop")
            continue
        if not apply:
            log(f"    [dry-run] would DROP collection '{name}' (+ its search indexes)")
            continue
        db[name].drop()
        log(f"    + dropped collection '{name}'")

    # renameCollection carries the old search index onto the new collection, so
    # registeredEntitiesSearch survives on legalEntities. Drop the orphan — the
    # code only uses legalEntitiesSearch.
    if "legalEntities" in names:
        coll = db["legalEntities"]
        orphan = "registeredEntitiesSearch"
        if orphan in existing_search_indexes(coll):
            if not apply:
                log(f"    [dry-run] would drop orphaned index '{orphan}' on legalEntities")
            else:
                try:
                    coll.drop_search_index(orphan)
                    log(f"    + dropped orphaned index '{orphan}' on legalEntities")
                except OperationFailure as e:
                    log(f"    ! could not drop '{orphan}': {e}")


def main() -> int:
    parser = argparse.ArgumentParser(description="BIAN reference-collection migration")
    parser.add_argument("--apply", action="store_true", help="perform writes (default: dry-run)")
    parser.add_argument("--drop-old", action="store_true", help="drop superseded collections (destructive)")
    parser.add_argument("--db", default=os.getenv("DATABASE_NAME"), help="target database (or DATABASE_NAME env)")
    args = parser.parse_args()

    uri = os.getenv("MONGODB_URI")
    if not uri:
        log("ERROR: MONGODB_URI is not set.")
        return 1
    if not args.db:
        log("ERROR: target DB unknown. Pass --db <name> or set DATABASE_NAME "
            "(must match the agent's database_name setting).")
        return 1

    mode = "APPLY" if args.apply else "DRY-RUN"
    log(f"=== BIAN collection migration [{mode}] · db={args.db} ===\n")

    client = MongoClient(uri)
    db = client[args.db]
    try:
        client.admin.command("ping")
    except Exception as e:
        log(f"ERROR: cannot connect: {e}")
        return 1

    log("Current collections: " + ", ".join(sorted(collection_names(db))) + "\n")

    log("[1/4] correspondentBanks (merge bank_details + ifsc_codes)")
    load_correspondent_banks(db, args.apply)
    ensure_search_index(db, "correspondentBanks", CORRESPONDENT_BANKS_SEARCH, args.apply)

    log("\n[2/4] legalEntities (rename registeredEntities)")
    rename_collection(db, "registeredEntities", "legalEntities", args.apply)
    ensure_search_index(db, "legalEntities", LEGAL_ENTITIES_SEARCH, args.apply)

    log("\n[3/4] purposeCodes (rename purpose_codes if still snake_case)")
    rename_collection(db, "purpose_codes", "purposeCodes", args.apply)
    ensure_search_index(db, "purposeCodes", PURPOSE_CODES_VECTOR, args.apply)

    log("\n[4/4] canonicalJsonStorage — no change (model annotation only)")

    if args.drop_old:
        log("\n[drop-old] removing superseded collections")
        drop_old(db, args.apply)
    else:
        log("\n[drop-old] skipped — re-run with --drop-old after verifying lookups")

    if args.apply:
        log("\nWaiting 3s for search indexes to begin building...")
        time.sleep(3)

    log("\nDone. Verify with the agent's JP / IN / purpose-code scenarios "
        "(see correspondentBanks-merge-steps.md), then re-run with --drop-old.")
    client.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())