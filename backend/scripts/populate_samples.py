#!/usr/bin/env python3
"""
Populate MongoDB with payment format samples including free text fields for AI processing
Run with: uv run python scripts/populate_samples.py
"""

from datetime import datetime, UTC
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.mdb import MongoDBConnector

def populate_samples():
    """Populate MongoDB with payment samples and update formats with free text field definitions"""
    
    db = MongoDBConnector()
    print("Connected to MongoDB")
    print("=" * 60)
    
    # Update format definitions with free text fields
    print("Updating format definitions with free text fields...")
    
    # Update MT103 with free text field info
    db.update_one("source_formats", 
                  {"format_code": "MT103"},
                  {"$set": {
                      "free_text_fields": [
                          {"field": "70", "name": "Remittance Information", "max_length": 140, "description": "Payment details/invoice info"},
                          {"field": "72", "name": "Sender to Receiver Info", "max_length": 210, "description": "Additional instructions"}
                      ],
                      "ai_suitable_fields": ["50K", "59", "70", "72"]
                  }})
    
    # Update ISO8583 with free text fields
    db.update_one("source_formats",
                  {"format_code": "ISO8583"},
                  {"$set": {
                      "free_text_fields": [
                          {"field": "48", "name": "Additional Data", "max_length": 999, "description": "Merchant info, transaction details"},
                          {"field": "104", "name": "Transaction Description", "max_length": 100, "description": "Narrative text about transaction"},
                          {"field": "125", "name": "Additional Record Data", "max_length": 999, "description": "Free format additional data"}
                      ],
                      "ai_suitable_fields": ["48", "104", "125"]
                  }})
    
    # Update pacs.008 with free text fields
    db.update_one("target_formats",
                  {"format_code": "pacs.008"},
                  {"$set": {
                      "free_text_fields": [
                          {"field": "RmtInf.Ustrd", "name": "Unstructured Remittance Info", "max_length": 140, "description": "Free text payment details"},
                          {"field": "InstrForCdtrAgt", "name": "Instruction for Creditor Agent", "max_length": 140, "description": "Special instructions"},
                          {"field": "SplmtryData", "name": "Supplementary Data", "max_length": 1000, "description": "Additional custom data"}
                      ],
                      "ai_suitable_fields": ["RmtInf.Ustrd", "InstrForCdtrAgt", "SplmtryData"]
                  }})
    
    print("✓ Updated format definitions with free text fields")
    
    # Payment samples collection
    samples = [
        # MT103 Samples
        {
            "format_code": "MT103",
            "format_type": "source",
            "sample_name": "Corporate Invoice Payment",
            "sample_data": """{1:F01CHASUS33XXXX0000000000}{2:I103DEUTDEFFXXXXN}{3:{108:ILOVESEPA}}{4:
:20:FT24326789012345
:23B:CRED
:32A:241215USD125750,50
:50K:/US64209876543210987654
ACME TECHNOLOGIES INC
1234 INNOVATION DRIVE
SILICON VALLEY CA 94025
USA
:52A:CHASUS33XXX
:53A:DEUTDEFFXXX
:59:/DE89370400440532013000
GLOBAL SUPPLIES GMBH
INDUSTRIESTRASSE 78
60329 FRANKFURT
GERMANY
:70:INV-2024-11-3847 DATED 15.11.2024
PAYMENT FOR ELECTRONIC COMPONENTS
ORDER PO-8934567 QTY 5000 UNITS
PARTIAL SHIPMENT 3 OF 5
:71A:SHA
:72:/ACC/URGENT PROCESSING REQUIRED
/REC/NOTIFY ACCOUNTS@GLOBALSUPPLIES.DE
-}""",
            "fields_highlight": ["70", "72"],
            "tags": ["corporate", "invoice", "international", "free_text"],
            "description": "Corporate payment with rich remittance information in field 70",
            "created_at": datetime.now(UTC)
        },
        {
            "format_code": "MT103",
            "format_type": "source", 
            "sample_name": "Personal Remittance",
            "sample_data": """{1:F01CITIUS33XXXX0000000000}{2:I103HSBCHKHHXXXXN}{3:{108:FAMILY001}}{4:
:20:FT24327890123456
:23B:CRED
:32A:241220USD5000,00
:50K:/US12345678901234567890
JOHN SMITH
456 MAIN STREET APT 12B
NEW YORK NY 10001
USA
:59:/HK98765432109876543210
JANE SMITH
789 CENTRAL PLAZA
HONG KONG
:70:FAMILY SUPPORT MONTHLY REMITTANCE
DECEMBER 2024 LIVING EXPENSES
EDUCATION AND MEDICAL COSTS
:71A:OUR
:72:/REC/SMS TO +852-9876-5432
-}""",
            "fields_highlight": ["70", "72"],
            "tags": ["personal", "remittance", "family", "free_text"],
            "description": "Personal remittance with description in field 70",
            "created_at": datetime.now(UTC)
        },
        
        # ISO8583 Samples with free text fields
        {
            "format_code": "ISO8583",
            "format_type": "source",
            "sample_name": "Retail POS Transaction",
            "sample_data": "0200B23A800128C180020000000000000000161234567890123456120150120150120111300000001000012345612345606051105511092700123456789012345606WALMART STORE #567   SAN FRANCISCO    CAUS840[048:MERCHANT:WALMART|STORE:567|LOCATION:SAN FRANCISCO CA|TERMINAL:POS-789|CASHIER:JANE DOE|ITEMS:GROCERIES,ELECTRONICS][104:Purchase of groceries and electronics at Walmart Supercenter][125:LOYALTY:MEMBER_789456|POINTS_EARNED:150|DISCOUNT:5%]",
            "fields_highlight": ["48", "104", "125"],
            "tags": ["retail", "pos", "card", "free_text"],
            "description": "POS transaction with merchant details in field 48",
            "created_at": datetime.now(UTC)
        },
        {
            "format_code": "ISO8583", 
            "format_type": "source",
            "sample_name": "E-commerce Transaction",
            "sample_data": "0200B23A800128C180020000000000000000164111111111111111120150120150120111500000005000098765498765412051105511092710AMAZON.COM           SEATTLE          WAUS840[048:MERCHANT:AMAZON|ORDER:WEB-2024-789456|IP:192.168.1.100|DEVICE:MOBILE_APP|SESSION:abc123xyz][104:Online purchase - Order #WEB-2024-789456 - Express shipping selected][125:SHIPPING:EXPRESS|ADDRESS:123 Main St, NYC 10001|ESTIMATED:2024-12-17]",
            "fields_highlight": ["48", "104", "125"],
            "tags": ["ecommerce", "online", "card", "free_text"],
            "description": "E-commerce transaction with order details in field 48",
            "created_at": datetime.now(UTC)
        },
        
        # pacs.008 Samples with free text
        {
            "format_code": "pacs.008",
            "format_type": "target",
            "sample_name": "Invoice Payment with Remittance",
            "sample_data": """<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08">
  <FIToFICstmrCdtTrf>
    <GrpHdr>
      <MsgId>MSG20241215123456</MsgId>
      <CreDtTm>2024-12-15T10:30:00</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <SttlmInf><SttlmMtd>INDA</SttlmMtd></SttlmInf>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId>
        <InstrId>INSTR20241215123456</InstrId>
        <EndToEndId>E2E20241215123456</EndToEndId>
      </PmtId>
      <IntrBkSttlmAmt Ccy="USD">125750.50</IntrBkSttlmAmt>
      <ChrgBr>SHAR</ChrgBr>
      <Dbtr><Nm>ACME TECHNOLOGIES INC</Nm></Dbtr>
      <Cdtr><Nm>GLOBAL SUPPLIES GMBH</Nm></Cdtr>
      <RmtInf>
        <Ustrd>Invoice INV-2024-11-3847 dated 15.11.2024 for electronic components. Purchase Order PO-8934567 for 5000 units. This is partial shipment 3 of 5. Contract reference TRD-2024-ACME-789. Please apply payment to outstanding balance.</Ustrd>
      </RmtInf>
      <InstrForCdtrAgt>
        <InstrInf>URGENT: Credit to account immediately. Notify treasury department upon receipt. Apply forex rate as of value date.</InstrInf>
      </InstrForCdtrAgt>
      <SplmtryData>
        <PlcAndNm>CustomData</PlcAndNm>
        <Envlp>
          <Document>{"internal_ref":"TRX-2024-789","compliance_check":"PASSED","risk_score":25,"processing_notes":"Verified against sanctions list"}</Document>
        </Envlp>
      </SplmtryData>
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>""",
            "fields_highlight": ["RmtInf.Ustrd", "InstrForCdtrAgt", "SplmtryData"],
            "tags": ["invoice", "b2b", "iso20022", "free_text"],
            "description": "pacs.008 with unstructured remittance info",
            "created_at": datetime.now(UTC)
        },
        
        # ACH Sample
        {
            "format_code": "ACH",
            "format_type": "source",
            "sample_name": "Payroll Batch",
            "sample_data": """101 091000019 1234567892024121510A094101WELLS FARGO            ACME CORP              PAYROLL
5225ACME CORP               1234567890CCDPAYROLL         241215   1123456780000001
62709100001912345678900000000100000000000000000001JOHN DOE                0123456780000001
62709100001998765432100000000250000000000000000002JANE SMITH              0123456780000002
62709100001987654321000000000175000000000000000003ROBERT JOHNSON          0123456780000003
705DECEMBER 2024 PAYROLL - INCLUDES YEAR END BONUS                                00001
82250000040037530864000000005250000000000000000001234567890                     123456780000001
9000001000001000000040037530864000000005250000000000000000                                       
9999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999""",
            "fields_highlight": ["705"],
            "tags": ["payroll", "ach", "batch"],
            "description": "ACH payroll batch with addenda record",
            "created_at": datetime.now(UTC)
        }
    ]
    
    # Clear existing samples
    print("\nClearing existing payment samples...")
    db.db["payment_samples"].delete_many({})
    
    # Insert new samples
    print("Inserting payment samples with free text fields...")
    for sample in samples:
        db.insert_one("payment_samples", sample)
        print(f"  ✓ Added: {sample['format_code']} - {sample['sample_name']}")
    
    # Update field routing for new free text fields
    print("\nUpdating field routing for AI processing...")
    
    # Add ISO8583 field routing
    iso8583_routing = {
        "source_format": "ISO8583",
        "field_strategies": [
            {"field": "48", "model": "CLAUDE_HAIKU", "strategy": "EXTRACTION", "description": "Additional merchant/transaction data"},
            {"field": "104", "model": "CLAUDE_HAIKU", "strategy": "TEXT_ANALYSIS", "description": "Transaction description"},
            {"field": "125", "model": "CLAUDE_HAIKU", "strategy": "EXTRACTION", "description": "Additional record data"}
        ],
        "created_at": datetime.now(UTC)
    }
    
    existing = db.find("field_model_routing", {"source_format": "ISO8583"})
    if existing:
        db.update_one("field_model_routing", 
                     {"source_format": "ISO8583"},
                     {"$set": iso8583_routing})
        print("  ✓ Updated ISO8583 field routing")
    else:
        db.insert_one("field_model_routing", iso8583_routing)
        print("  ✓ Added ISO8583 field routing")
    
    # Verify samples
    print("\n" + "=" * 60)
    print("Verification - Payment samples in MongoDB:")
    
    sample_count = db.db["payment_samples"].count_documents({})
    print(f"\nTotal samples: {sample_count}")
    
    for format_code in ["MT103", "ISO8583", "pacs.008", "ACH"]:
        format_samples = db.find("payment_samples", {"format_code": format_code})
        if format_samples:
            print(f"\n{format_code} samples:")
            for sample in format_samples:
                free_text = ", ".join(sample.get("fields_highlight", []))
                print(f"  • {sample['sample_name']} - Free text fields: {free_text}")
    
    print("\n✅ Sample population complete with free text fields!")
    

if __name__ == "__main__":
    try:
        populate_samples()
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)