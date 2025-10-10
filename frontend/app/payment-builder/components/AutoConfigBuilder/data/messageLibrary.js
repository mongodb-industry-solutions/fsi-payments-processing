// Message Library for Auto Configuration Builder
// Curated collection of sample payment messages for interactive browsing

export const MESSAGE_CATEGORIES = [
  { id: 'swift_mt', name: 'SWIFT MT', color: '#00684A' },
  { id: 'iso20022', name: 'ISO 20022', color: '#1254B7' },
  { id: 'iso8583', name: 'ISO 8583', color: '#5C3C92' },
  { id: 'domestic', name: 'Domestic', color: '#B35E00' },
  { id: 'other', name: 'Other', color: '#889397' }
];

export const MESSAGE_LIBRARY = [
  // SWIFT MT Messages
  {
    id: 'mt103_cross_border',
    name: 'MT103 - Customer Credit Transfer',
    category: 'swift_mt',
    sourceFormat: 'MT103',
    description: 'International wire transfer with detailed remittance information',
    sampleMessage: `{1:F01UBSWCHZH80A0000000000}{2:I103ABSAZAJJXXXXN}{4:
:20:MED-CH-ZA-2024-001
:23B:CRED
:32A:241215CHF180000,00
:50K:/CH9300762011623852957
SWISS PHARMA INTERNATIONAL AG
BAHNHOFSTRASSE 45
8001 ZURICH
SWITZERLAND
:52A:UBSWCHZH80A
:53A:ABSAZAJJXXX
:59:/ZA123456789012345678901
SOUTH AFRICAN HEALTH SUPPLIES PTY LTD
123 MEDICAL PLAZA SANDTON
JOHANNESBURG 2001
SOUTH AFRICA
:70:INVOICE MED-ZA-2024-5678 DATED 10.12.2024
PHARMACEUTICAL SUPPLIES ORDER
PO-MED-SA-9876 QTY 10000 UNITS VACCINES
:71A:SHA
:72:/ACC/PRIORITY MEDICAL SHIPMENT
/REC/NOTIFY LOGISTICS@SAHEALTHSUPPLIES.CO.ZA
/INS/TEMPERATURE CONTROLLED DELIVERY REQUIRED
-}`,
    tags: ['swift', 'cross-border', 'customer', 'credit', 'international'],
    targetFormats: ['pacs.008', 'JSON'],
    useCase: 'Cross-border pharmaceutical payment with priority handling'
  },
  {
    id: 'mt202_bank_transfer',
    name: 'MT202 - Financial Institution Transfer',
    category: 'swift_mt',
    sourceFormat: 'MT202',
    description: 'Bank-to-bank interbank transfer for treasury operations',
    sampleMessage: `{1:F01CHASUS33AXXX0000000000}{2:I202DEUTDEFFXXXXN}{3:{108:PRIORITY}}{4:
:20:MT202TEST
:21:REF2024MT202001
:32A:241215EUR500000,00
:52A:CHASUS33XXX
:57A:DEUTDEFFXXX
:58A:/DE12345678901234567890
BENEFICIARY INSTITUTION
:72:/BNF/TREASURY OPERATIONS
/INS/PRIORITY PROCESSING
-}`,
    tags: ['swift', 'interbank', 'treasury', 'financial institution'],
    targetFormats: ['pacs.009', 'JSON'],
    useCase: 'Interbank treasury transfer with priority processing'
  },
  {
    id: 'mt205_fx_settlement',
    name: 'MT205 - Foreign Exchange Settlement',
    category: 'swift_mt',
    sourceFormat: 'MT205',
    description: 'FX settlement with time indication for CLS processing',
    sampleMessage: `{1:F01CHASUS33AXXX0000000000}{2:I205DEUTDEFFXXXXN}{3:{108:PRIORITY}}{4:
:20:MT205TEST2024
:21:RELREF20241115
:13C:/CLSTIME/0830+0100
:32A:241215EUR500000,00
:52A:UBSWCHZHXXX
:57A:DEUTDEFFXXX
:58A:/DE98765432109876543210
COBADEFFXXX
:72:/BNF/PRIORITY SETTLEMENT
/INS/SAME DAY VALUE
/ACC/COVER FOR FI TRANSFER
-}`,
    tags: ['swift', 'fx', 'foreign exchange', 'settlement', 'cls'],
    targetFormats: ['pacs.009', 'JSON'],
    useCase: 'FX settlement with CLS time indication'
  },
  {
    id: 'mt101_batch_payment',
    name: 'MT101 - Request for Transfer',
    category: 'swift_mt',
    sourceFormat: 'MT101',
    description: 'Batch payment request with multiple transactions',
    sampleMessage: `{1:F01CHASUS33AXXX0000000000}{2:I101DEUTDEFFXXXXN}{4:
:20:BATCH2024120701
:28D:1/1
:50H:/US12345678901234567890
ACME CORPORATION
123 MAIN STREET
NEW YORK NY 10001
:30:241207
:21:TRANS001
:32B:USD50000,00
:50H:/US98765432109876543210
ACME CORPORATION
:59:/DE12345678901234567890
GLOBAL SUPPLIES GMBH
FRANKFURT GERMANY
:70:INVOICE INV-2024-12345
PAYMENT FOR MANUFACTURING SERVICES
CONTRACT NO MFG-2024-789
DELIVERY DATE 2024-12-15
-}`,
    tags: ['swift', 'batch', 'multiple', 'request', 'corporate'],
    targetFormats: ['pacs.008', 'JSON'],
    useCase: 'Corporate batch payment for multiple beneficiaries'
  },
  {
    id: 'mt940_statement',
    name: 'MT940 - Customer Statement',
    category: 'swift_mt',
    sourceFormat: 'MT940',
    description: 'Account statement message with transaction details',
    sampleMessage: `{1:F01CHASUS33AXXX0000000000}{2:I940CORPUSAAXXXXN}{4:
:20:STMT2024120801
:25:US12345678901234567890
:28C:001/001
:60F:C241207USD1000000,00
:61:2412080112C50000,00NTRF123456//INCOMING WIRE
DEUTSCHE BANK AG
:61:2412080112D25000,00NCHK789012//CHECK PAYMENT
VENDOR PAYMENT
:62F:C241208USD1025000,00
:64:C241208USD1025000,00
-}`,
    tags: ['swift', 'statement', 'account', 'balance', 'reporting'],
    targetFormats: ['camt.053', 'JSON'],
    useCase: 'Daily account statement with balance reporting'
  },

  // ISO 20022 Messages
  {
    id: 'pacs008_credit_transfer',
    name: 'pacs.008 - Credit Transfer',
    category: 'iso20022',
    sourceFormat: 'pacs.008',
    description: 'ISO 20022 credit transfer initiation message',
    sampleMessage: `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08">
  <FIToFICstmrCdtTrf>
    <GrpHdr>
      <MsgId>PACS008-2024-001</MsgId>
      <CreDtTm>2024-12-15T10:30:00</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <SttlmInf>
        <SttlmMtd>INDA</SttlmMtd>
      </SttlmInf>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId>
        <InstrId>INSTR001</InstrId>
        <EndToEndId>E2E001</EndToEndId>
      </PmtId>
      <IntrBkSttlmAmt Ccy="EUR">125000.00</IntrBkSttlmAmt>
      <IntrBkSttlmDt>2024-12-15</IntrBkSttlmDt>
      <Dbtr>
        <Nm>Tech Solutions Inc</Nm>
      </Dbtr>
      <Cdtr>
        <Nm>Global Suppliers Ltd</Nm>
      </Cdtr>
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>`,
    tags: ['iso20022', 'pacs', 'credit', 'xml', 'sepa'],
    targetFormats: ['MT103', 'JSON'],
    useCase: 'SEPA credit transfer in ISO 20022 format'
  },
  {
    id: 'pain001_initiation',
    name: 'pain.001 - Payment Initiation',
    category: 'iso20022',
    sourceFormat: 'pain.001',
    description: 'Customer credit transfer initiation from corporate',
    sampleMessage: `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>CORP-BATCH-001</MsgId>
      <CreDtTm>2024-12-15T08:00:00</CreDtTm>
      <NbOfTxs>5</NbOfTxs>
      <CtrlSum>250000.00</CtrlSum>
      <InitgPty>
        <Nm>Corporate Treasury Dept</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>PMT-001</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <ReqdExctnDt>2024-12-16</ReqdExctnDt>
      <Dbtr>
        <Nm>ACME Corporation</Nm>
      </Dbtr>
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`,
    tags: ['iso20022', 'pain', 'initiation', 'corporate', 'batch'],
    targetFormats: ['pacs.008', 'JSON'],
    useCase: 'Corporate batch payment initiation'
  },

  // ISO 8583 Messages
  {
    id: 'iso8583_0200_authorization',
    name: 'ISO8583_0200 - Authorization Request',
    category: 'iso8583',
    sourceFormat: 'ISO8583_0200',
    description: 'Card payment authorization request message',
    sampleMessage: `0200|PAN:4916522800000000|PROC:000000|AMT:12500|CUR:840|DT:1215103045|STAN:123456|REF:AUTH0001234|TERM:TERM0001|MID:MERCH123456|MERCHANT:STARBUCKS NEW YORK USA|EXP:2512|CVV:***|ACQ:00000123456|DATA:CONTACTLESS EMV`,
    tags: ['iso8583', 'card', 'authorization', 'pos', 'realtime'],
    targetFormats: ['cain.001', 'JSON'],
    useCase: 'Point-of-sale card authorization request'
  },
  {
    id: 'iso8583_0220_advice',
    name: 'ISO8583_0220 - Financial Advice',
    category: 'iso8583',
    sourceFormat: 'ISO8583_0220',
    description: 'Card transaction financial advice (offline/batch)',
    sampleMessage: `0220|PAN:4916522800000000|PROC:000000|AMT:12000|CUR:826|DT:1215103045|STAN:123456|REF:BATCH0001234|TERM:TERM0001|MID:MERCHANT123|MERCHANT:STARBUCKS LONDON UK|EXP:2512|ACQ:00000123456|DATA:OFFLINE BATCH SETTLEMENT`,
    tags: ['iso8583', 'card', 'advice', 'batch', 'settlement'],
    targetFormats: ['cain.001', 'JSON'],
    useCase: 'Offline card transaction batch settlement'
  },

  // Domestic Formats
  {
    id: 'target2_payment',
    name: 'TARGET2 - ECB Payment',
    category: 'domestic',
    sourceFormat: 'TARGET2',
    description: 'TARGET2 payment message for European Central Bank system',
    sampleMessage: `T2S:MSG:2024120801
FROM:DEUTDEFFXXX
TO:BNPAFRPPXXX
AMT:EUR:5000000.00
DATE:2024-12-08
REF:T2S-2024-123456
PRIORITY:URGENT
SETTLEMENT:RTGS
PURPOSE:MONETARY POLICY OPERATION
DETAILS:ECB LIQUIDITY FACILITY DRAWDOWN`,
    tags: ['target2', 'ecb', 'rtgs', 'europe', 'central bank'],
    targetFormats: ['pacs.009', 'JSON'],
    useCase: 'ECB monetary policy operation settlement'
  },
  {
    id: 'chaps_payment',
    name: 'CHAPS - UK High Value',
    category: 'domestic',
    sourceFormat: 'CHAPS',
    description: 'CHAPS payment for UK high-value clearing',
    sampleMessage: `CHAPS:V3:2024120801
SENDER:BARCGB22XXX
RECEIVER:HSBCGB2LXXX
AMOUNT:GBP:2500000.00
VALUE_DATE:2024-12-08
REFERENCE:CHAPS-2024-789012
DEBTOR:UK PROPERTY HOLDINGS LTD
DEBTOR_ACCT:GB29NWBK60161331926819
CREDITOR:LONDON REAL ESTATE CORP
CREDITOR_ACCT:GB82WEST12345698765432
PURPOSE:COMMERCIAL PROPERTY PURCHASE`,
    tags: ['chaps', 'uk', 'high-value', 'rtgs', 'sterling'],
    targetFormats: ['pacs.008', 'JSON'],
    useCase: 'UK property purchase high-value transfer'
  },
  {
    id: 'fedwire_transfer',
    name: 'FEDWIRE - US Wire Transfer',
    category: 'domestic',
    sourceFormat: 'FEDWIRE',
    description: 'Fedwire funds transfer for US domestic payments',
    sampleMessage: `{1500}FEDWIRE FUNDS TRANSFER
{1510}20241208
{1520}FED000123456789
{2000}USD25000000.00
{3100}021000021
{3400}JPMORGAN CHASE BANK NA
{3600}US1234567890123456789
{3700}ACME CORPORATION
{4200}026009593
{4400}BANK OF AMERICA NA
{5000}US9876543210987654321
{6000}GLOBAL INVESTMENTS LLC
{6500}/RFB/INVESTMENT PORTFOLIO FUNDING`,
    tags: ['fedwire', 'usa', 'wire', 'federal reserve', 'domestic'],
    targetFormats: ['pacs.009', 'JSON'],
    useCase: 'US domestic high-value investment funding'
  },

  // Other Formats
  {
    id: 'json_canonical',
    name: 'JSON - Canonical Format',
    category: 'other',
    sourceFormat: 'JSON',
    description: 'Universal canonical JSON intermediate format',
    sampleMessage: `{
  "header": {
    "message_id": "MSG-2024-001",
    "message_type": "credit_transfer",
    "creation_date": "2024-12-15T10:30:00Z"
  },
  "transaction": {
    "instruction_id": "INSTR-001",
    "end_to_end_id": "E2E-001"
  },
  "parties": {
    "debtor": {
      "name": "Tech Solutions Inc",
      "account": "US12345678901234567890"
    },
    "creditor": {
      "name": "Global Suppliers Ltd",
      "account": "DE89370400440532013000"
    }
  },
  "amounts": {
    "instructed": {
      "value": "125000.00",
      "currency": "EUR"
    }
  },
  "dates": {
    "value_date": "2024-12-15"
  },
  "remittance": {
    "unstructured": ["Payment for services rendered"]
  }
}`,
    tags: ['json', 'canonical', 'intermediate', 'universal'],
    targetFormats: ['pacs.008', 'MT103', 'TARGET2'],
    useCase: 'Universal intermediate format for multi-hop conversion'
  },
  {
    id: 'ach_nacha',
    name: 'ACH/NACHA - US Batch Payment',
    category: 'other',
    sourceFormat: 'ACH',
    description: 'US ACH/NACHA format for batch payments',
    sampleMessage: `101 021000021 1234567890 2412151030A094101JPMORGAN CHASE    ACME CORPORATION
5200ACME CORP PAYROLL   1234567890PPDPAYROLL   241215241215   1021000020000001
62212345678909876543210000005000001JOHN DOE              0021000020000001
822000000100123456789000000050000001234567890                         021000020000001
9000001000001000000010012345678900000005000001234567890`,
    tags: ['ach', 'nacha', 'usa', 'batch', 'payroll'],
    targetFormats: ['pain.001', 'JSON'],
    useCase: 'US corporate payroll batch processing'
  },
  {
    id: 'sepa_xml',
    name: 'SEPA - Direct Debit',
    category: 'other',
    sourceFormat: 'pain.008',
    description: 'SEPA direct debit collection initiation',
    sampleMessage: `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.08">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>DD-BATCH-001</MsgId>
      <CreDtTm>2024-12-15T08:00:00</CreDtTm>
      <NbOfTxs>100</NbOfTxs>
      <CtrlSum>50000.00</CtrlSum>
      <InitgPty>
        <Nm>Subscription Services Ltd</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>DD-PMT-001</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <ReqdColltnDt>2024-12-16</ReqdColltnDt>
      <Cdtr>
        <Nm>Monthly Billing Service</Nm>
      </Cdtr>
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`,
    tags: ['sepa', 'direct debit', 'collection', 'recurring'],
    targetFormats: ['pacs.003', 'JSON'],
    useCase: 'SEPA recurring subscription billing'
  }
];

// Helper functions
export const getMessagesByCategory = (categoryId) => {
  return MESSAGE_LIBRARY.filter(msg => msg.category === categoryId);
};

export const searchMessages = (query) => {
  const lowerQuery = query.toLowerCase();
  return MESSAGE_LIBRARY.filter(msg =>
    msg.name.toLowerCase().includes(lowerQuery) ||
    msg.description.toLowerCase().includes(lowerQuery) ||
    msg.sourceFormat.toLowerCase().includes(lowerQuery) ||
    msg.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
};

export const getMessageById = (id) => {
  return MESSAGE_LIBRARY.find(msg => msg.id === id);
};

export const detectFormatFromMessage = (message) => {
  // SWIFT MT detection
  if (message.includes('{1:F01') && message.includes('{4:')) {
    if (message.includes(':103')) return 'MT103';
    if (message.includes(':202')) return 'MT202';
    if (message.includes(':205')) return 'MT205';
    if (message.includes(':101')) return 'MT101';
    if (message.includes(':940')) return 'MT940';
    if (message.includes(':204')) return 'MT204';
    if (message.includes(':201')) return 'MT201';
    return 'MT_UNKNOWN';
  }

  // ISO 20022 detection
  if (message.includes('<?xml') && message.includes('xmlns')) {
    if (message.includes('pacs.008')) return 'pacs.008';
    if (message.includes('pacs.009')) return 'pacs.009';
    if (message.includes('pain.001')) return 'pain.001';
    if (message.includes('pain.008')) return 'pain.008';
    if (message.includes('camt.053')) return 'camt.053';
    if (message.includes('cain.001')) return 'cain.001';
    return 'ISO20022_UNKNOWN';
  }

  // ISO 8583 detection
  if (message.startsWith('0200|') || message.includes('|PAN:')) return 'ISO8583_0200';
  if (message.startsWith('0220|')) return 'ISO8583_0220';

  // Domestic formats
  if (message.includes('T2S:MSG:') || message.includes('TARGET2')) return 'TARGET2';
  if (message.includes('CHAPS:V')) return 'CHAPS';
  if (message.includes('FEDWIRE') || message.includes('{1500}')) return 'FEDWIRE';
  if (message.includes('101 ') && message.includes('5200')) return 'ACH';

  // JSON detection
  try {
    const parsed = JSON.parse(message);
    if (parsed.header && parsed.transaction && parsed.parties) return 'JSON';
  } catch (e) {
    // Not JSON
  }

  return 'UNKNOWN';
};
