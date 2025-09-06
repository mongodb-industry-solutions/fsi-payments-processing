#!/usr/bin/env python3
"""
Load builder configuration into MongoDB for generic building.
This moves pacs.008 building template and rules from code to MongoDB configuration.
"""

from db.mdb import MongoDBConnector
from datetime import datetime, UTC
import json

def load_pacs008_builder_config():
    """Load pacs.008 builder configuration to MongoDB"""
    
    # Initialize MongoDB connection
    db = MongoDBConnector()
    
    # pacs.008 Builder Configuration
    pacs008_config = {
        "format": "pacs.008",
        "format_name": "ISO 20022 Customer Credit Transfer",
        "format_type": "ISO20022",
        "description": "FIToFI Customer Credit Transfer",
        "created_at": datetime.now(UTC).isoformat(),
        "is_active": True,
        
        # XML configuration
        "xml_config": {
            "namespace": "urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08",
            "encoding": "UTF-8",
            "pretty_print": True,
            "indent": "    "
        },
        
        # Template with placeholders
        "template": """<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="{{NAMESPACE}}">
  <FIToFICstmrCdtTrf>
    <GrpHdr>
      <MsgId>{{MSG_ID}}</MsgId>
      <CreDtTm>{{CREATE_TIME}}</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <SttlmInf>
        <SttlmMtd>INDA</SttlmMtd>
      </SttlmInf>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId>
        <InstrId>{{INSTR_ID}}</InstrId>
        <EndToEndId>{{END_TO_END_ID}}</EndToEndId>
        <TxId>{{TX_ID}}</TxId>
      </PmtId>
      <IntrBkSttlmAmt Ccy="{{CURRENCY}}">{{AMOUNT}}</IntrBkSttlmAmt>
      <IntrBkSttlmDt>{{SETTLEMENT_DATE}}</IntrBkSttlmDt>
      <ChrgBr>{{CHARGE_BEARER}}</ChrgBr>
      <Dbtr>
        <Nm>{{DEBTOR_NAME}}</Nm>
        <PstlAdr>
          <AdrLine>{{DEBTOR_ADDRESS_LINE1}}</AdrLine>
          <AdrLine>{{DEBTOR_ADDRESS_LINE2}}</AdrLine>
        </PstlAdr>
      </Dbtr>
      <DbtrAcct>
        <Id>
          <Othr>
            <Id>{{DEBTOR_ACCOUNT}}</Id>
          </Othr>
        </Id>
      </DbtrAcct>
      <DbtrAgt>
        <FinInstnId>
          <BIC>{{DEBTOR_AGENT_BIC}}</BIC>
        </FinInstnId>
      </DbtrAgt>
      <CdtrAgt>
        <FinInstnId>
          <BIC>{{CREDITOR_AGENT_BIC}}</BIC>
        </FinInstnId>
      </CdtrAgt>
      <Cdtr>
        <Nm>{{CREDITOR_NAME}}</Nm>
        <PstlAdr>
          <AdrLine>{{CREDITOR_ADDRESS_LINE1}}</AdrLine>
          <AdrLine>{{CREDITOR_ADDRESS_LINE2}}</AdrLine>
        </PstlAdr>
      </Cdtr>
      <CdtrAcct>
        <Id>
          <Othr>
            <Id>{{CREDITOR_ACCOUNT}}</Id>
          </Othr>
        </Id>
      </CdtrAcct>
      <RmtInf>
        <Ustrd>{{REMITTANCE_INFO}}</Ustrd>
      </RmtInf>
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>""",
        
        # Field mappings from source to template placeholders
        "field_mappings": [
            {
                "placeholder": "{{NAMESPACE}}",
                "source": "_constant",
                "value": "urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08",
                "formatter": "direct"
            },
            {
                "placeholder": "{{MSG_ID}}",
                "source": "MsgId",
                "formatter": "direct",
                "required": True
            },
            {
                "placeholder": "{{CREATE_TIME}}",
                "source": "_generated",
                "generator": "iso_timestamp",
                "formatter": "direct"
            },
            {
                "placeholder": "{{INSTR_ID}}",
                "source": "InstrId",
                "formatter": "direct",
                "required": True
            },
            {
                "placeholder": "{{END_TO_END_ID}}",
                "source": "EndToEndId",
                "formatter": "direct",
                "required": True
            },
            {
                "placeholder": "{{TX_ID}}",
                "source": "TxId",
                "formatter": "direct",
                "default": ""
            },
            {
                "placeholder": "{{CURRENCY}}",
                "source": "Currency",
                "formatter": "uppercase",
                "required": True
            },
            {
                "placeholder": "{{AMOUNT}}",
                "source": "Amount",
                "formatter": "decimal:2",
                "required": True
            },
            {
                "placeholder": "{{SETTLEMENT_DATE}}",
                "source": "SettlementDate",
                "formatter": "iso_date",
                "default": "_today"
            },
            {
                "placeholder": "{{CHARGE_BEARER}}",
                "source": "ChargeBearer",
                "formatter": "map",
                "mapping": {
                    "OUR": "DEBT",
                    "BEN": "CRED",
                    "SHA": "SHAR"
                },
                "default": "SHAR"
            },
            {
                "placeholder": "{{DEBTOR_NAME}}",
                "source": "DebtorName",
                "formatter": "extract_first_line",
                "required": True
            },
            {
                "placeholder": "{{DEBTOR_ADDRESS_LINE1}}",
                "source": "DebtorAddress",
                "formatter": "extract_line:1",
                "default": ""
            },
            {
                "placeholder": "{{DEBTOR_ADDRESS_LINE2}}",
                "source": "DebtorAddress",
                "formatter": "extract_line:2",
                "default": ""
            },
            {
                "placeholder": "{{DEBTOR_ACCOUNT}}",
                "source": "DebtorAccount",
                "formatter": "extract_account",
                "default": ""
            },
            {
                "placeholder": "{{DEBTOR_AGENT_BIC}}",
                "source": "DebtorAgentBIC",
                "formatter": "uppercase",
                "default": "NOTPROVIDED"
            },
            {
                "placeholder": "{{CREDITOR_AGENT_BIC}}",
                "source": "CreditorAgentBIC",
                "formatter": "uppercase",
                "default": "NOTPROVIDED"
            },
            {
                "placeholder": "{{CREDITOR_NAME}}",
                "source": "CreditorName",
                "formatter": "extract_first_line",
                "required": True
            },
            {
                "placeholder": "{{CREDITOR_ADDRESS_LINE1}}",
                "source": "CreditorAddress",
                "formatter": "extract_line:1",
                "default": ""
            },
            {
                "placeholder": "{{CREDITOR_ADDRESS_LINE2}}",
                "source": "CreditorAddress",
                "formatter": "extract_line:2",
                "default": ""
            },
            {
                "placeholder": "{{CREDITOR_ACCOUNT}}",
                "source": "CreditorAccount",
                "formatter": "extract_account",
                "default": ""
            },
            {
                "placeholder": "{{REMITTANCE_INFO}}",
                "source": "RemittanceInfo",
                "formatter": "direct",
                "default": ""
            }
        ],
        
        # Formatter definitions
        "formatters": {
            "direct": {
                "description": "Use value as-is"
            },
            "uppercase": {
                "description": "Convert to uppercase"
            },
            "decimal:2": {
                "description": "Format as decimal with 2 places"
            },
            "iso_date": {
                "description": "Format as ISO date (YYYY-MM-DD)"
            },
            "iso_timestamp": {
                "description": "Format as ISO timestamp"
            },
            "extract_first_line": {
                "description": "Extract first line from multiline text"
            },
            "extract_line:1": {
                "description": "Extract specific line number"
            },
            "extract_account": {
                "description": "Extract account number from text"
            },
            "map": {
                "description": "Map value using provided mapping"
            }
        }
    }
    
    # Check if config already exists
    existing = db.find("builder_configs", {"format": "pacs.008"})
    
    if existing:
        # Update existing config
        db.update_one(
            "builder_configs",
            {"format": "pacs.008"},
            {"$set": pacs008_config}
        )
        print("✅ Updated existing pacs.008 builder configuration")
    else:
        # Insert new config
        db.insert_one("builder_configs", pacs008_config)
        print("✅ Created new pacs.008 builder configuration")
    
    # Verify the configuration was saved
    saved_config = db.find("builder_configs", {"format": "pacs.008"})
    
    if saved_config:
        print("\n📋 Verification - Config saved successfully:")
        print(f"  - Format: {saved_config[0]['format']}")
        print(f"  - Field mappings: {len(saved_config[0]['field_mappings'])}")
        print(f"  - Formatters defined: {len(saved_config[0]['formatters'])}")
        
        # Show some mappings
        print("\n📌 Sample field mappings:")
        for mapping in saved_config[0]['field_mappings'][:5]:
            source = mapping.get('source', 'N/A')
            placeholder = mapping['placeholder']
            formatter = mapping.get('formatter', 'direct')
            print(f"    {placeholder} <- {source} [{formatter}]")
        
        return True
    else:
        print("❌ Error: Configuration not found after saving")
        return False

def test_config_structure():
    """Test that the saved config has the expected structure"""
    db = MongoDBConnector()
    
    config = db.find("builder_configs", {"format": "pacs.008"})
    
    if not config:
        print("❌ No pacs.008 config found")
        return False
    
    config = config[0]
    
    # Check required top-level fields
    required_fields = ["format", "template", "field_mappings", "xml_config"]
    for field in required_fields:
        if field not in config:
            print(f"❌ Missing required field: {field}")
            return False
    
    # Check template has placeholders
    if "{{MSG_ID}}" not in config["template"]:
        print("❌ Template missing MSG_ID placeholder")
        return False
    
    # Check field mappings structure
    if len(config["field_mappings"]) < 10:
        print("❌ Not enough field mappings")
        return False
    
    first_mapping = config["field_mappings"][0]
    if "placeholder" not in first_mapping:
        print("❌ Field mapping missing placeholder")
        return False
    
    print("✅ Configuration structure is valid")
    
    # Print template preview
    template_lines = config["template"].split('\n')[:10]
    print(f"\n🔍 Template preview:")
    for line in template_lines:
        print(f"   {line}")
    
    return True

if __name__ == "__main__":
    print("=" * 60)
    print("MongoDB Builder Configuration Loader")
    print("=" * 60)
    
    # Load configuration
    success = load_pacs008_builder_config()
    
    if success:
        print("\n" + "=" * 60)
        print("Testing configuration structure...")
        print("=" * 60)
        test_success = test_config_structure()
        
        if test_success:
            print("\n✅ Step 5 Complete: Builder configuration loaded and verified")
        else:
            print("\n⚠️ Configuration loaded but structure test failed")
    else:
        print("\n❌ Failed to load builder configuration")