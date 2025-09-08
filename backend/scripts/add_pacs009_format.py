#!/usr/bin/env python3
"""
Add pacs.009 format to the formats collection with sample messages.
This moves the hardcoded frontend format to MongoDB for consistency.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, UTC
from db.mdb import MongoDBConnector
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_pacs009_format():
    """Create pacs.009 format document with template only."""
    
    # Template format with placeholders
    template_xml = """<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.009.001.08">
  <FICdtTrf>
    <GrpHdr>
      <MsgId>{Message ID}</MsgId>
      <CreDtTm>{Creation DateTime}</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <TtlIntrBkSttlmAmt Ccy="{Currency}">{Total Amount}</TtlIntrBkSttlmAmt>
      <IntrBkSttlmDt>{Settlement Date}</IntrBkSttlmDt>
      <SttlmInf>
        <SttlmMtd>INDA</SttlmMtd>
      </SttlmInf>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId>
        <EndToEndId>{End-to-End ID}</EndToEndId>
      </PmtId>
      <IntrBkSttlmAmt Ccy="{Currency}">{Amount}</IntrBkSttlmAmt>
      <IntrBkSttlmDt>{Settlement Date}</IntrBkSttlmDt>
      <InstgAgt>
        <FinInstnId>
          <BIC>{Instructing Agent BIC}</BIC>
        </FinInstnId>
      </InstgAgt>
      <InstdAgt>
        <FinInstnId>
          <BIC>{Instructed Agent BIC}</BIC>
        </FinInstnId>
      </InstdAgt>
      <IntrmyAgt1>
        <FinInstnId>
          <BIC>{Intermediary BIC}</BIC>
        </FinInstnId>
      </IntrmyAgt1>
      <CdtrAgt>
        <FinInstnId>
          <BIC>{Creditor Agent BIC}</BIC>
        </FinInstnId>
      </CdtrAgt>
      <Cdtr>
        <FinInstnId>
          <BIC>{Creditor BIC}</BIC>
          <Nm>{Creditor Name}</Nm>
        </FinInstnId>
      </Cdtr>
      <RmtInf>
        <Ustrd>{Remittance Information}</Ustrd>
      </RmtInf>
      <InstrForNxtAgt>
        <InstrInf>{Instructions}</InstrInf>
      </InstrForNxtAgt>
    </CdtTrfTxInf>
  </FICdtTrf>
</Document>"""
    
    return {
        "format_code": "pacs.009",
        "type": "target",
        "name": "ISO 20022 Financial Institution Credit Transfer",
        "description": "pacs.009 (FIToFIFinancialInstitutionCreditTransfer) is used for credit transfers between financial institutions. It's the ISO 20022 equivalent of MT202 COV messages.",
        "category": "ISO20022",
        "version": "001.08",
        "is_active": True,
        "samples": [
            {
                "name": "Template",
                "description": "Template with placeholders for preview",
                "message": template_xml,
                "is_default": True
            }
        ],
        "metadata": {
            "namespace": "urn:iso:std:iso:20022:tech:xsd:pacs.009.001.08",
            "root_element": "Document",
            "message_type": "FICdtTrf",
            "supported_currencies": ["USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD"],
            "supported_countries": ["All ISO countries"],
            "mandatory_fields": [
                "MsgId",
                "CreDtTm",
                "IntrBkSttlmAmt",
                "InstgAgt",
                "InstdAgt",
                "EndToEndId"
            ],
            "optional_fields": [
                "IntrmyAgt1",
                "IntrmyAgt2",
                "IntrmyAgt3",
                "CdtrAgt",
                "CdtrAcct",
                "RmtInf",
                "InstrForNxtAgt"
            ]
        },
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC)
    }


def add_pacs009_to_formats(db: MongoDBConnector):
    """Add or update pacs.009 format in the formats collection."""
    
    pacs009_format = create_pacs009_format()
    
    # Check if pacs.009 already exists
    existing = list(db.find("formats", {
        "format_code": "pacs.009",
        "type": "target"
    }))
    
    if existing:
        # Update existing
        modified_count = db.update_one(
            "formats",
            {"_id": existing[0]["_id"]},
            {"$set": pacs009_format}
        )
        logger.info(f"✅ Updated existing pacs.009 format (modified: {modified_count})")
    else:
        # Insert new
        inserted_id = db.insert_one("formats", pacs009_format)
        logger.info(f"✅ Added new pacs.009 format (ID: {inserted_id})")
    
    return True


def verify_pacs009_format(db: MongoDBConnector):
    """Verify the pacs.009 format was added correctly."""
    
    # Find the format
    formats = list(db.find("formats", {
        "format_code": "pacs.009",
        "type": "target"
    }))
    
    if not formats:
        logger.error("❌ pacs.009 format not found!")
        return False
    
    format_doc = formats[0]
    
    logger.info("\n📋 pacs.009 Format Details:")
    logger.info(f"  Name: {format_doc.get('name')}")
    logger.info(f"  Version: {format_doc.get('version')}")
    logger.info(f"  Category: {format_doc.get('category')}")
    logger.info(f"  Active: {format_doc.get('is_active')}")
    logger.info(f"  Samples: {len(format_doc.get('samples', []))}")
    
    if format_doc.get('samples'):
        logger.info("\n📄 Sample Messages:")
        for sample in format_doc['samples']:
            logger.info(f"  - {sample['name']}: {sample['description']}")
            logger.info(f"    Default: {sample.get('is_default', False)}")
            logger.info(f"    Size: {len(sample['message'])} characters")
    
    logger.info("\n🔧 Metadata:")
    metadata = format_doc.get('metadata', {})
    logger.info(f"  Namespace: {metadata.get('namespace')}")
    logger.info(f"  Mandatory fields: {len(metadata.get('mandatory_fields', []))}")
    logger.info(f"  Optional fields: {len(metadata.get('optional_fields', []))}")
    
    return True


def main():
    """Main function to add pacs.009 format."""
    logger.info("🔧 Adding pacs.009 format to formats collection...")
    
    db = MongoDBConnector()
    
    # Add the format
    if not add_pacs009_to_formats(db):
        logger.error("Failed to add pacs.009 format")
        return False
    
    # Verify it was added
    if not verify_pacs009_format(db):
        logger.error("Failed to verify pacs.009 format")
        return False
    
    logger.info("\n✅ Successfully added pacs.009 format with samples!")
    logger.info("The format is now available in the database and can be used by the backend.")
    
    # Check if we should also update pacs.008 if it's missing samples
    pacs008_list = list(db.find("formats", {"format_code": "pacs.008", "type": "target"}))
    if pacs008_list and not pacs008_list[0].get('samples'):
        logger.info("\n⚠️ Note: pacs.008 format exists but has no samples. Consider adding samples to it as well.")
    
    return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)