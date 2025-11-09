// Target Format Examples for Auto Configuration Builder
// Hardcoded expected outputs for preset scenarios

export const TARGET_FORMAT_EXAMPLES = {
  // MT103 → pacs.008
  'MT103_to_pacs.008': {
    sourceFormat: 'MT103',
    targetFormat: 'pacs.008',
    expectedOutput: `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08">
  <FIToFICstmrCdtTrf>
    <GrpHdr>
      <MsgId>MED-CH-ZA-2024-001</MsgId>
      <CreDtTm>2024-12-15T10:30:00</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <SttlmInf>
        <SttlmMtd>INDA</SttlmMtd>
      </SttlmInf>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId>
        <InstrId>MED-CH-ZA-2024-001</InstrId>
        <EndToEndId>MED-CH-ZA-2024-001</EndToEndId>
      </PmtId>
      <IntrBkSttlmAmt Ccy="CHF">180000.00</IntrBkSttlmAmt>
      <IntrBkSttlmDt>2024-12-15</IntrBkSttlmDt>
      <ChrgBr>SHAR</ChrgBr>
      <InstgAgt>
        <FinInstnId>
          <BIC>UBSWCHZH80A</BIC>
        </FinInstnId>
      </InstgAgt>
      <InstdAgt>
        <FinInstnId>
          <BIC>ABSAZAJJXXX</BIC>
        </FinInstnId>
      </InstdAgt>
      <Dbtr>
        <Nm>SWISS PHARMA INTERNATIONAL AG</Nm>
        <PstlAdr>
          <AdrLine>BAHNHOFSTRASSE 45</AdrLine>
          <AdrLine>8001 ZURICH</AdrLine>
          <Ctry>CH</Ctry>
        </PstlAdr>
      </Dbtr>
      <DbtrAcct>
        <Id>
          <IBAN>CH9300762011623852957</IBAN>
        </Id>
      </DbtrAcct>
      <Cdtr>
        <Nm>SOUTH AFRICAN HEALTH SUPPLIES PTY LTD</Nm>
        <PstlAdr>
          <AdrLine>123 MEDICAL PLAZA SANDTON</AdrLine>
          <AdrLine>JOHANNESBURG 2001</AdrLine>
          <Ctry>ZA</Ctry>
        </PstlAdr>
      </Cdtr>
      <CdtrAcct>
        <Id>
          <Othr>
            <Id>ZA123456789012345678901</Id>
          </Othr>
        </Id>
      </CdtrAcct>
      <RmtInf>
        <Ustrd>INVOICE MED-ZA-2024-5678 DATED 10.12.2024</Ustrd>
        <Ustrd>PHARMACEUTICAL SUPPLIES ORDER</Ustrd>
        <Ustrd>PO-MED-SA-9876 QTY 10000 UNITS VACCINES</Ustrd>
      </RmtInf>
      <InstrForCdtrAgt>
        <Cd>CHQB</Cd>
        <InstrInf>PRIORITY MEDICAL SHIPMENT</InstrInf>
        <InstrInf>NOTIFY LOGISTICS@SAHEALTHSUPPLIES.CO.ZA</InstrInf>
        <InstrInf>TEMPERATURE CONTROLLED DELIVERY REQUIRED</InstrInf>
      </InstrForCdtrAgt>
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>`,
    description: 'Cross-border pharmaceutical payment converted from SWIFT MT103 to ISO 20022 pacs.008 format'
  },

  // MT202 → pacs.009
  'MT202_to_pacs.009': {
    sourceFormat: 'MT202',
    targetFormat: 'pacs.009',
    expectedOutput: `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.009.001.08">
  <FIToFICstmrCdtTrf>
    <GrpHdr>
      <MsgId>MT202TEST</MsgId>
      <CreDtTm>2024-12-15T10:30:00</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <SttlmInf>
        <SttlmMtd>INDA</SttlmMtd>
      </SttlmInf>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId>
        <InstrId>MT202TEST</InstrId>
        <EndToEndId>REF2024MT202001</EndToEndId>
      </PmtId>
      <IntrBkSttlmAmt Ccy="EUR">500000.00</IntrBkSttlmAmt>
      <IntrBkSttlmDt>2024-12-15</IntrBkSttlmDt>
      <InstgAgt>
        <FinInstnId>
          <BIC>CHASUS33XXX</BIC>
        </FinInstnId>
      </InstgAgt>
      <InstdAgt>
        <FinInstnId>
          <BIC>DEUTDEFFXXX</BIC>
        </FinInstnId>
      </InstdAgt>
      <IntrmyAgt1>
        <FinInstnId>
          <BIC>DEUTDEFFXXX</BIC>
        </FinInstnId>
      </IntrmyAgt1>
      <CdtrAgt>
        <FinInstnId>
          <Nm>BENEFICIARY INSTITUTION</Nm>
        </FinInstnId>
      </CdtrAgt>
      <CdtrAcct>
        <Id>
          <Othr>
            <Id>DE12345678901234567890</Id>
          </Othr>
        </Id>
      </CdtrAcct>
      <InstrForNxtAgt>
        <Cd>CHQB</Cd>
        <InstrInf>TREASURY OPERATIONS</InstrInf>
        <InstrInf>PRIORITY PROCESSING</InstrInf>
      </InstrForNxtAgt>
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>`,
    description: 'Bank-to-bank treasury transfer converted from SWIFT MT202 to ISO 20022 pacs.009 format'
  },

  // MT205 → pacs.009
  'MT205_to_pacs.009': {
    sourceFormat: 'MT205',
    targetFormat: 'pacs.009',
    expectedOutput: `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.009.001.08">
  <FIToFICstmrCdtTrf>
    <GrpHdr>
      <MsgId>MT205TEST2024</MsgId>
      <CreDtTm>2024-12-15T08:30:00+01:00</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <SttlmInf>
        <SttlmMtd>CLSNET</SttlmMtd>
        <ClrSys>
          <Cd>CLS</Cd>
        </ClrSys>
      </SttlmInf>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId>
        <InstrId>MT205TEST2024</InstrId>
        <EndToEndId>RELREF20241115</EndToEndId>
        <TxId>MT205TEST2024</TxId>
      </PmtId>
      <IntrBkSttlmAmt Ccy="EUR">500000.00</IntrBkSttlmAmt>
      <IntrBkSttlmDt>2024-12-15</IntrBkSttlmDt>
      <SttlmTmIndctn>
        <CdtDtTm>2024-12-15T08:30:00+01:00</CdtDtTm>
      </SttlmTmIndctn>
      <SttlmTmReq>
        <CLSTm>08:30:00+01:00</CLSTm>
      </SttlmTmReq>
      <InstgAgt>
        <FinInstnId>
          <BIC>UBSWCHZHXXX</BIC>
        </FinInstnId>
      </InstgAgt>
      <InstdAgt>
        <FinInstnId>
          <BIC>DEUTDEFFXXX</BIC>
        </FinInstnId>
      </InstdAgt>
      <Cdtr>
        <FinInstnId>
          <BIC>COBADEFFXXX</BIC>
        </FinInstnId>
      </Cdtr>
      <CdtrAcct>
        <Id>
          <Othr>
            <Id>DE98765432109876543210</Id>
          </Othr>
        </Id>
      </CdtrAcct>
      <InstrForNxtAgt>
        <InstrInf>PRIORITY SETTLEMENT</InstrInf>
        <InstrInf>SAME DAY VALUE</InstrInf>
        <InstrInf>COVER FOR FI TRANSFER</InstrInf>
      </InstrForNxtAgt>
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>`,
    description: 'FX settlement with CLS time indication converted from SWIFT MT205 to ISO 20022 pacs.009 format'
  },

  // ISO8583_0200 → cain.001
  'ISO8583_0200_to_cain.001': {
    sourceFormat: 'ISO8583_0200',
    targetFormat: 'cain.001',
    expectedOutput: `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:cain.001.001.01">
  <AcqrrAuthstnInitn>
    <Hdr>
      <MsgId>AUTH0001234</MsgId>
      <CreDtTm>2024-12-15T10:30:45</CreDtTm>
    </Hdr>
    <Authstn>
      <TxId>
        <TxDtTm>2024-12-15T10:30:45</TxDtTm>
        <TxRef>123456</TxRef>
      </TxId>
      <Tx>
        <TxAmts>
          <AmtQlfr>TXAM</AmtQlfr>
          <Amt Ccy="USD">125.00</Amt>
        </TxAmts>
        <CardDataNtryMd>CTLS</CardDataNtryMd>
        <ICCRltdData>EMV CONTACTLESS</ICCRltdData>
      </Tx>
      <Mrchnt>
        <Id>
          <Id>MERCH123456</Id>
        </Id>
        <CmonNm>STARBUCKS NEW YORK USA</CmonNm>
      </Mrchnt>
      <POI>
        <Id>
          <Id>TERM0001</Id>
        </Id>
      </POI>
      <Acqrr>
        <Id>
          <Id>00000123456</Id>
        </Id>
      </Acqrr>
      <Card>
        <PAN>4916522800000000</PAN>
        <XpryDt>2025-12</XpryDt>
      </Card>
      <PrcgCd>000000</PrcgCd>
    </Authstn>
  </AcqrrAuthstnInitn>
</Document>`,
    description: 'Point-of-sale card authorization converted from ISO 8583 to ISO 20022 cain.001 format'
  },

  // pacs.008 → TARGET2 (Multi-hop example)
  'pacs.008_to_TARGET2': {
    sourceFormat: 'pacs.008',
    targetFormat: 'TARGET2',
    expectedOutput: `T2S:MSG:2024121501
FROM:TECH_SOLUTIONS_BANK
TO:GLOBAL_SUPPLIERS_BANK
AMT:EUR:125000.00
DATE:2024-12-15
REF:PACS008-2024-001
INSTRUCTION_ID:INSTR001
END_TO_END_ID:E2E001
PRIORITY:NORMAL
SETTLEMENT:INDA
DEBTOR:Tech Solutions Inc
CREDITOR:Global Suppliers Ltd
PURPOSE:CREDIT TRANSFER
DETAILS:FI to FI customer credit transfer`,
    description: 'ISO 20022 pacs.008 converted to TARGET2 format via multi-hop routing (pacs.008 → JSON → TARGET2)'
  },

  // MT103 → JSON (Canonical intermediate format)
  'MT103_to_JSON': {
    sourceFormat: 'MT103',
    targetFormat: 'JSON',
    expectedOutput: `{
  "header": {
    "message_id": "MED-CH-ZA-2024-001",
    "message_type": "customer_credit_transfer",
    "creation_date": "2024-12-15T10:30:00Z",
    "sender_bic": "UBSWCHZH80A",
    "receiver_bic": "ABSAZAJJXXX"
  },
  "transaction": {
    "instruction_id": "MED-CH-ZA-2024-001",
    "end_to_end_id": "MED-CH-ZA-2024-001",
    "bank_operation_code": "CRED"
  },
  "parties": {
    "debtor": {
      "name": "SWISS PHARMA INTERNATIONAL AG",
      "account": "CH9300762011623852957",
      "address": {
        "address_line_1": "BAHNHOFSTRASSE 45",
        "address_line_2": "8001 ZURICH",
        "country": "SWITZERLAND"
      }
    },
    "debtor_agent": {
      "bic": "UBSWCHZH80A"
    },
    "intermediary_agent": {
      "bic": "ABSAZAJJXXX"
    },
    "creditor": {
      "name": "SOUTH AFRICAN HEALTH SUPPLIES PTY LTD",
      "account": "ZA123456789012345678901",
      "address": {
        "address_line_1": "123 MEDICAL PLAZA SANDTON",
        "address_line_2": "JOHANNESBURG 2001",
        "country": "SOUTH AFRICA"
      }
    }
  },
  "amounts": {
    "instructed": {
      "value": "180000.00",
      "currency": "CHF"
    }
  },
  "dates": {
    "value_date": "2024-12-15"
  },
  "remittance": {
    "unstructured": [
      "INVOICE MED-ZA-2024-5678 DATED 10.12.2024",
      "PHARMACEUTICAL SUPPLIES ORDER",
      "PO-MED-SA-9876 QTY 10000 UNITS VACCINES"
    ]
  },
  "charges": {
    "bearer": "SHAR"
  },
  "instructions": {
    "creditor_agent": [
      "PRIORITY MEDICAL SHIPMENT",
      "NOTIFY LOGISTICS@SAHEALTHSUPPLIES.CO.ZA",
      "TEMPERATURE CONTROLLED DELIVERY REQUIRED"
    ]
  },
  "processing_metadata": {
    "conversion_timestamp": "2024-12-15T10:30:00Z",
    "source_format": "MT103",
    "intermediate_format": "JSON"
  }
}`,
    description: 'SWIFT MT103 converted to canonical JSON intermediate format for multi-hop routing'
  },

  // MT202 → JSON
  'MT202_to_JSON': {
    sourceFormat: 'MT202',
    targetFormat: 'JSON',
    expectedOutput: `{
  "header": {
    "message_id": "MT202TEST",
    "message_type": "financial_institution_transfer",
    "creation_date": "2024-12-15T10:30:00Z",
    "sender_bic": "CHASUS33XXX",
    "receiver_bic": "DEUTDEFFXXX",
    "priority": "PRIORITY"
  },
  "transaction": {
    "instruction_id": "MT202TEST",
    "related_reference": "REF2024MT202001"
  },
  "parties": {
    "ordering_institution": {
      "bic": "CHASUS33XXX"
    },
    "intermediary_agent": {
      "bic": "DEUTDEFFXXX"
    },
    "beneficiary_institution": {
      "name": "BENEFICIARY INSTITUTION",
      "account": "DE12345678901234567890"
    }
  },
  "amounts": {
    "instructed": {
      "value": "500000.00",
      "currency": "EUR"
    }
  },
  "dates": {
    "value_date": "2024-12-15"
  },
  "instructions": {
    "intermediary": [
      "TREASURY OPERATIONS",
      "PRIORITY PROCESSING"
    ]
  },
  "processing_metadata": {
    "conversion_timestamp": "2024-12-15T10:30:00Z",
    "source_format": "MT202",
    "intermediate_format": "JSON"
  }
}`,
    description: 'SWIFT MT202 converted to canonical JSON intermediate format'
  }
};

// Helper function to get target format example
export const getTargetFormatExample = (sourceFormat, targetFormat) => {
  const key = `${sourceFormat}_to_${targetFormat}`;
  return TARGET_FORMAT_EXAMPLES[key] || null;
};

// Helper function to check if target format example exists
export const hasTargetFormatExample = (sourceFormat, targetFormat) => {
  const key = `${sourceFormat}_to_${targetFormat}`;
  return key in TARGET_FORMAT_EXAMPLES;
};

// Get all available conversion pairs
export const getAvailableConversionPairs = () => {
  return Object.keys(TARGET_FORMAT_EXAMPLES).map(key => {
    const [source, , target] = key.split('_to_');
    return {
      key,
      sourceFormat: source.replace(/_/g, ''),
      targetFormat: target,
      ...TARGET_FORMAT_EXAMPLES[key]
    };
  });
};
