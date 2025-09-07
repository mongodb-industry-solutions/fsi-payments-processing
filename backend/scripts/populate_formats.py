#!/usr/bin/env python3
"""
Script to populate MongoDB with additional payment formats
Run with: uv run python scripts/populate_formats.py
"""

from datetime import datetime, UTC
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.mdb import MongoDBConnector

def populate_formats():
    """Populate MongoDB with payment format definitions"""
    
    db = MongoDBConnector()
    print("Connected to MongoDB")
    print("=" * 60)
    
    # Source formats to add
    source_formats = [
        {
            "format_code": "MT103",
            "format_name": "SWIFT MT103 Wire Transfer",
            "version": "latest",
            "description": "Standard wire transfer format for customer credit transfers",
            "is_active": True,
            "created_at": datetime.now(UTC)
        },
        {
            "format_code": "MT202",
            "format_name": "SWIFT MT202 Bank to Bank",
            "version": "latest",
            "description": "Financial institution transfer between banks",
            "is_active": True,
            "created_at": datetime.now(UTC)
        },
        {
            "format_code": "MT900",
            "format_name": "SWIFT MT900 Confirmation of Debit",
            "version": "latest",
            "description": "Confirmation of debit to account",
            "is_active": True,
            "created_at": datetime.now(UTC)
        },
        {
            "format_code": "ISO8583",
            "format_name": "ISO 8583 Card Payments",
            "version": "1987",
            "description": "Card payment transaction messages",
            "is_active": True,
            "created_at": datetime.now(UTC)
        },
        {
            "format_code": "ACH",
            "format_name": "ACH (NACHA) Format",
            "version": "2024",
            "description": "Automated Clearing House payment format",
            "is_active": True,
            "created_at": datetime.now(UTC)
        }
    ]
    
    # Target formats to add
    target_formats = [
        {
            "format_code": "pacs.008",
            "format_name": "ISO 20022 FIToFICustomerCreditTransfer",
            "version": "001.08",
            "description": "Customer credit transfer between financial institutions",
            "is_active": True,
            "created_at": datetime.now(UTC)
        },
        {
            "format_code": "pacs.004",
            "format_name": "ISO 20022 PaymentReturn",
            "version": "001.08",
            "description": "Payment return message for rejected payments",
            "is_active": True,
            "created_at": datetime.now(UTC)
        },
        {
            "format_code": "pacs.009",
            "format_name": "ISO 20022 FinancialInstitutionCreditTransfer",
            "version": "001.08",
            "description": "Credit transfer between financial institutions",
            "is_active": True,
            "created_at": datetime.now(UTC)
        },
        {
            "format_code": "ISO8583",
            "format_name": "ISO 8583 Card Payments",
            "version": "1987",
            "description": "Card payment transaction messages",
            "is_active": True,
            "created_at": datetime.now(UTC)
        },
        {
            "format_code": "pain.001",
            "format_name": "ISO 20022 CustomerCreditTransferInitiation",
            "version": "001.08",
            "description": "Customer initiation of credit transfer",
            "is_active": True,
            "created_at": datetime.now(UTC)
        }
    ]
    
    # Clear existing formats (optional - comment out if you want to keep existing)
    print("Clearing existing formats...")
    db.db["source_formats"].delete_many({})
    db.db["target_formats"].delete_many({})
    
    # Insert source formats
    print("\nInserting source formats:")
    for fmt in source_formats:
        # Check if format already exists
        existing = db.find("source_formats", {"format_code": fmt["format_code"]})
        if existing:
            # Update existing
            db.update_one("source_formats", 
                         {"format_code": fmt["format_code"]}, 
                         {"$set": fmt})
            print(f"  ✓ Updated: {fmt['format_code']} - {fmt['format_name']}")
        else:
            # Insert new
            db.insert_one("source_formats", fmt)
            print(f"  ✓ Added: {fmt['format_code']} - {fmt['format_name']}")
    
    # Insert target formats
    print("\nInserting target formats:")
    for fmt in target_formats:
        # Check if format already exists
        existing = db.find("target_formats", {"format_code": fmt["format_code"]})
        if existing:
            # Update existing
            db.update_one("target_formats", 
                         {"format_code": fmt["format_code"]}, 
                         {"$set": fmt})
            print(f"  ✓ Updated: {fmt['format_code']} - {fmt['format_name']}")
        else:
            # Insert new
            db.insert_one("target_formats", fmt)
            print(f"  ✓ Added: {fmt['format_code']} - {fmt['format_name']}")
    
    # Add sample conversion rules for new format pairs
    print("\nAdding sample conversion rules for new format pairs...")
    
    # MT202 to pacs.009 rules
    mt202_to_pacs009_rules = {
        "source_format": "MT202",
        "target_format": "pacs.009",
        "is_active": True,
        "rules": [
            {
                "source_field": "20",
                "target_field": "MsgId",
                "transformation": "direct_copy",
                "description": "Transaction reference"
            },
            {
                "source_field": "21",
                "target_field": "RelatedReference",
                "transformation": "direct_copy",
                "description": "Related reference"
            },
            {
                "source_field": "32A_amount",
                "target_field": "IntrBkSttlmAmt",
                "transformation": "parse_amount",
                "description": "Settlement amount"
            }
        ],
        "created_at": datetime.now(UTC)
    }
    
    # Check if rule already exists
    existing_rule = db.find("conversion_rules", {
        "source_format": "MT202",
        "target_format": "pacs.009"
    })
    
    if not existing_rule:
        db.insert_one("conversion_rules", mt202_to_pacs009_rules)
        print(f"  ✓ Added conversion rules: MT202 → pacs.009")
    else:
        print(f"  → Conversion rules already exist: MT202 → pacs.009")
    
    # Verify what we have in the database
    print("\n" + "=" * 60)
    print("Verification - Current formats in MongoDB:")
    print("\nSource Formats:")
    sources = db.find("source_formats", {"is_active": True})
    for fmt in sources:
        print(f"  • {fmt['format_code']}: {fmt['format_name']}")
    
    print("\nTarget Formats:")
    targets = db.find("target_formats", {"is_active": True})
    for fmt in targets:
        print(f"  • {fmt['format_code']}: {fmt['format_name']}")
    
    print("\n✅ Format population complete!")
    

if __name__ == "__main__":
    try:
        populate_formats()
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)