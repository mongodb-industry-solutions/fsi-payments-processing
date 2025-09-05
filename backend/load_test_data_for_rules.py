#!/usr/bin/env python3
"""Load test data into MongoDB for Rules Engine testing"""

from datetime import datetime, UTC
from db.mdb import MongoDBConnector

def load_test_data():
    """Load minimal test data for rules engine testing"""
    db = MongoDBConnector()
    
    print("Loading test data for Rules Engine...")
    
    # Clear existing test data
    db.get_collection("conversion_rules").delete_many({
        "source_format": "MT103",
        "target_format": "pacs.008"
    })
    db.get_collection("field_model_routing").delete_many({
        "source_format": "MT103"
    })
    db.get_collection("target_formats").delete_many({
        "format_code": "pacs.008"
    })
    db.get_collection("source_formats").delete_many({
        "format_code": "MT103"
    })
    
    # 1. Load conversion rules for MT103 → pacs.008
    conversion_rules = {
        "source_format": "MT103",
        "target_format": "pacs.008",
        "is_active": True,
        "rules": [
            # Direct field mappings
            {
                "source_field": "20",
                "target_field": "MsgId",
                "transformation": "direct_copy",
                "description": "Reference to Message ID"
            },
            {
                "source_field": "20",
                "target_field": "InstrId", 
                "transformation": "direct_copy",
                "description": "Reference to Instruction ID"
            },
            {
                "source_field": "20",
                "target_field": "EndToEndId",
                "transformation": "direct_copy",
                "description": "Reference to End-to-End ID"
            },
            {
                "source_field": "20",
                "target_field": "TxId",
                "transformation": "direct_copy",
                "description": "Reference to Transaction ID"
            },
            # Amount and currency from 32A
            {
                "source_field": "32A_amount",
                "target_field": "Amount",
                "transformation": "parse_amount",
                "description": "Transaction amount"
            },
            {
                "source_field": "32A_currency",
                "target_field": "Currency",
                "transformation": "direct_copy",
                "description": "Currency code"
            },
            {
                "source_field": "32A_date",
                "target_field": "SettlementDate",
                "transformation": "convert_date_format",
                "description": "Value date to settlement date"
            },
            # Charge bearer mapping
            {
                "source_field": "71A",
                "target_field": "ChargeBearer",
                "transformation": "map_value",
                "mapping": {
                    "SHA": "SHAR",
                    "OUR": "DEBT", 
                    "BEN": "CRED"
                },
                "description": "Charge bearer code mapping"
            },
            # Bank codes
            {
                "source_field": "52A",
                "target_field": "DebtorAgent",
                "transformation": "direct_copy",
                "description": "Ordering institution"
            },
            {
                "source_field": "57A",
                "target_field": "CreditorAgent",
                "transformation": "direct_copy",
                "description": "Account with institution"
            }
        ],
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC)
    }
    
    result = db.insert_one("conversion_rules", conversion_rules)
    print(f"✅ Loaded {len(conversion_rules['rules'])} conversion rules")
    
    # 2. Load field model routing (which fields need AI)
    field_routing = {
        "source_format": "MT103",
        "field_strategies": [
            {
                "field": "50K",
                "model": "CLAUDE_SONNET",
                "strategy": "ADDRESS_EXTRACTION",
                "description": "Ordering customer name and address"
            },
            {
                "field": "59",
                "model": "CLAUDE_HAIKU",
                "strategy": "ADDRESS_EXTRACTION", 
                "description": "Beneficiary name and address"
            },
            {
                "field": "70",
                "model": "CLAUDE_HAIKU",
                "strategy": "REMITTANCE_INFO",
                "description": "Remittance information"
            },
            {
                "field": "72",
                "model": "REGEX_FIRST",
                "strategy": "ADDITIONAL_INFO",
                "description": "Sender to receiver information"
            }
        ],
        "created_at": datetime.now(UTC)
    }
    
    db.insert_one("field_model_routing", field_routing)
    print(f"✅ Loaded field model routing with {len(field_routing['field_strategies'])} strategies")
    
    # 3. Create format definitions
    mt103_format = {
        "format_code": "MT103",
        "format_name": "SWIFT MT103 Wire Transfer",
        "version": "2024",
        "description": "Single Customer Credit Transfer",
        "is_active": True,
        "created_at": datetime.now(UTC)
    }
    
    pacs008_format = {
        "format_code": "pacs.008",
        "format_name": "ISO 20022 FIToFICustomerCreditTransfer",
        "version": "001.08",
        "description": "Payment instruction between financial institutions",
        "namespace": "urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08",
        "is_active": True,
        "created_at": datetime.now(UTC)
    }
    
    db.insert_one("source_formats", mt103_format)
    db.insert_one("target_formats", pacs008_format)
    print("✅ Created format definitions for MT103 and pacs.008")
    
    # Verify data was loaded
    rules_count = len(db.find("conversion_rules", {"source_format": "MT103"}))
    routing_count = len(db.find("field_model_routing", {"source_format": "MT103"}))
    
    print(f"\n📊 Data Loading Summary:")
    print(f"   - Conversion rules documents: {rules_count}")
    print(f"   - Field routing documents: {routing_count}")
    print(f"   - Source formats: 1 (MT103)")
    print(f"   - Target formats: 1 (pacs.008)")
    
    return True

if __name__ == "__main__":
    try:
        load_test_data()
        print("\n✅ Test data loaded successfully!")
    except Exception as e:
        print(f"\n❌ Error loading test data: {e}")
        import traceback
        traceback.print_exc()