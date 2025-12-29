/**
 * Pre-configured payment scenarios for the Agentic AI converter
 * Each scenario includes a sample message and display metadata
 */

export const SCENARIOS = {
  japan: {
    id: 'japan',
    title: 'Germany → Japan Automotive Supply',
    description: 'Volkswagen AG pays Denso Corporation - ¥45M JPY (~€280K)',
    badge: 'TRANSLITERATION',
    badgeVariant: 'green',
    isAgentic: true,
    info: {
      problem: 'Japanese banks require creditor names in Katakana script, but the source MT103 contains "DENSO CORPORATION" in Latin characters.',
      solution: 'Transaction Agent detects this requirement and automatically transliterates the name to Katakana using Japan\'s official transliteration rules.',
      whyAgent: 'Rule-based conversion can\'t handle name transliteration - requires country-specific knowledge.'
    },
    sourceCountry: {
      name: 'Germany',
      code: 'DE',
      flag: '🇩🇪',
      bank: 'Deutsche Bank',
      city: 'Berlin',
      coords: [13.4050, 52.5200] // [longitude, latitude]
    },
    targetCountry: {
      name: 'Japan',
      code: 'JP',
      flag: '🇯🇵',
      bank: 'Bank of Tokyo',
      city: 'Tokyo',
      coords: [139.6503, 35.6762] // [longitude, latitude]
    },
    sourceFormat: 'MT103',
    targetFormat: 'pacs.008',
    nodes: 3,
    steps: 2,
    formats: 'MT103, ISO20022',
    message: `{1:F01DEUTDEFFAXXX0000000000}{2:I103BOTKJPJTXXXXN}{4:
:20:VW-DENSO-2025-Q1-001
:23B:CRED
:32A:250115JPY45000000,00
:50K:/DE89370400440532013000
VOLKSWAGEN AG
BERLINER RING 2
38440 WOLFSBURG
GERMANY
:57A:BOTKJPJT
:59:/JP1234567890123456789012
DENSO CORPORATION
1-1 SHOWA-CHO KARIYA
AICHI 448-8661
JAPAN
:70:INVOICE VW-JP-2025-Q1-8234 DATED 05.01.2025
ELECTRONIC COMPONENTS SHIPMENT Q1 2025
PO-AUTO-JP-2025-1156 QTY 50000 UNITS
PRECISION SENSORS AND ECU MODULES
:71A:SHA
-}`
  },

  india: {
    id: 'india',
    title: 'USA → India IT Services Payment',
    description: 'Google LLC pays Infosys Limited - ₹15M INR (~$180K)',
    badge: 'IFSC LOOKUP',
    badgeVariant: 'blue',
    isAgentic: true,
    info: {
      problem: 'Indian banking requires specific IFSC codes for bank identification, but the source MT103 only has descriptive details: "HDFC Bank, Fort Branch, Mumbai".',
      solution: 'Transaction Agent looks up the correct IFSC code from India\'s official database using bank name, branch, and location, then validates and inserts it.',
      whyAgent: 'IFSC lookup requires external database access and validation - beyond simple field mapping.'
    },
    sourceCountry: {
      name: 'United States',
      code: 'US',
      flag: '🇺🇸',
      bank: 'JPMorgan Chase',
      city: 'Mountain View',
      coords: [-122.0842, 37.3861] // [longitude, latitude]
    },
    targetCountry: {
      name: 'India',
      code: 'IN',
      flag: '🇮🇳',
      bank: 'HDFC Bank',
      city: 'Mumbai',
      coords: [72.8311, 19.0144] // [longitude, latitude]
    },
    sourceFormat: 'MT103',
    targetFormat: 'pacs.008',
    nodes: 4,
    steps: 3,
    formats: 'MT103, ISO20022',
    message: `{1:F01CHASUS33AXXX0000000000}{2:I103HDFCINBBXXXXN}{4:
:20:GOOG-INFY-2024-Q4-567
:23B:CRED
:32A:241220INR15000000,00
:50K:/US64CHAS0051234567890
GOOGLE LLC
MOUNTAIN VIEW CA UNITED STATES
:57D:HDFC Bank, Fort Branch, Mumbai
:59:/IN789012345678901234567
INFOSYS LIMITED
Mumbai, Maharashtra INDIA
:70:INVOICE GOOG-INFY-2024-Q4-9876 DATED 10.12.2024
SOFTWARE DEVELOPMENT SERVICES Q4 2024
CONTRACT SVC-BLR-2024 MILESTONE 4 COMPLETION
CLOUD INFRASTRUCTURE DEVELOPMENT
:71A:SHA
-}`
  },

  card_payment: {
    id: 'card_payment',
    title: 'UK → Singapore Card Purchase',
    description: 'UK Visa cardholder buys electronics at Sim Lim Square - S$2,500 SGD (~£1,500)',
    badge: 'CARD PAYMENT',
    badgeVariant: 'yellow',
    isAgentic: false,  // No country validation - shows conversion hop events instead
    info: {
      process: 'Cross-border card authorization converted from legacy ISO 8583 format to modern ISO 20022 cain.001 for interbank clearing.',
      aiExtraction: 'AI parses unstructured merchant field "SIM LIM SQUARE ELECTRONICS    SINGAPORE     SGP" into structured name, city, and country fields.',
      multiHop: 'Multi-hop conversion: ISO8583 → Canonical JSON → cain.001 XML, enabling format bridging through a universal intermediate.'
    },
    sourceCountry: {
      name: 'United Kingdom',
      code: 'GB',
      flag: '🇬🇧',
      bank: 'Barclays',
      city: 'London',
      coords: [-0.1276, 51.5074]
    },
    targetCountry: {
      name: 'Singapore',
      code: 'SG',
      flag: '🇸🇬',
      bank: 'DBS Bank',
      city: 'Singapore',
      coords: [103.8198, 1.3521]
    },
    sourceFormat: 'ISO8583_0200',
    targetFormat: 'cain.001',
    nodes: 3,
    steps: 2,
    formats: 'ISO8583, ISO20022',
    message: '0200|F220000000000000|4659010123456789|000000|000000250000|1205143022|845623|143022|1205|UKSG20241205|TERM0042|SGPSIMLIM000001|SIM LIM SQUARE ELECTRONICS       SINGAPORE     SGP|702'
  },

  internal_mx: {
    id: 'internal_mx',
    title: 'UK → Australia Internal MX Transition',
    description: 'BP PLC pays BHP Group - A$8.5M AUD for mining services',
    badge: 'MX TRANSITION',
    badgeVariant: 'lightgray',
    isAgentic: false,
    info: {
      process: 'Demonstrates internal MT-to-MX transition: bank receives pacs.008 externally, converts to internal canonical JSON for legacy system processing, then back to pacs.008 for outbound transmission.',
      hop1: 'pacs.008 → JSON: Incoming ISO 20022 message converted to canonical JSON for internal routing and legacy system compatibility.',
      hop2: 'JSON → pacs.008: After internal processing, canonical JSON converted back to ISO 20022 for cross-border settlement.'
    },
    sourceCountry: {
      name: 'United Kingdom',
      code: 'GB',
      flag: '🇬🇧',
      bank: 'Barclays',
      city: 'London',
      coords: [-0.1276, 51.5074]
    },
    targetCountry: {
      name: 'Australia',
      code: 'AU',
      flag: '🇦🇺',
      bank: 'ANZ Bank',
      city: 'Melbourne',
      coords: [144.9631, -37.8136]
    },
    sourceFormat: 'pacs.008',
    targetFormat: 'pacs.008',
    nodes: 3,
    steps: 2,
    formats: 'ISO20022, JSON, ISO20022',
    message: `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08">
  <FIToFICstmrCdtTrf>
    <GrpHdr>
      <MsgId>BP-BHP-2025-Q1-001</MsgId>
      <CreDtTm>2025-01-15T09:30:00Z</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <SttlmInf><SttlmMtd>CLRG</SttlmMtd></SttlmInf>
      <IntrBkSttlmDt>2025-01-15</IntrBkSttlmDt>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId>
        <InstrId>INSTR-GB-AU-2025-001</InstrId>
        <EndToEndId>E2E-BP-BHP-2025-Q1</EndToEndId>
      </PmtId>
      <PmtTpInf>
        <SvcLvl><Cd>URGP</Cd></SvcLvl>
      </PmtTpInf>
      <IntrBkSttlmAmt Ccy="AUD">8500000.00</IntrBkSttlmAmt>
      <ChrgBr>SHAR</ChrgBr>
      <Dbtr>
        <Nm>BP PLC</Nm>
        <PstlAdr>
          <AdrLine>1 ST JAMES SQUARE LONDON SW1Y 4PD UK</AdrLine>
        </PstlAdr>
      </Dbtr>
      <DbtrAcct>
        <Id><IBAN>GB82BARC20035344264823</IBAN></Id>
      </DbtrAcct>
      <DbtrAgt>
        <FinInstnId><BICFI>BABORGLGXXX</BICFI></FinInstnId>
      </DbtrAgt>
      <CdtrAgt>
        <FinInstnId><BICFI>ANZBAU3MXXX</BICFI></FinInstnId>
      </CdtrAgt>
      <Cdtr>
        <Nm>BHP GROUP LIMITED</Nm>
        <PstlAdr>
          <AdrLine>171 COLLINS STREET MELBOURNE VIC 3000 AUSTRALIA</AdrLine>
        </PstlAdr>
      </Cdtr>
      <CdtrAcct>
        <Id><IBAN>AU89ANZ0012345678901</IBAN></Id>
      </CdtrAcct>
      <RmtInf>
        <Ustrd>Q1 2025 MINING EQUIPMENT AND SERVICES</Ustrd>
        <Strd>
          <RfrdDocInf>
            <Tp><CdOrPrtry><Prtry>COMMERCIAL_INVOICE</Prtry></CdOrPrtry></Tp>
            <Nb>INV-BHP-2025-Q1-7892</Nb>
          </RfrdDocInf>
          <AddtlRmtInf>IRON ORE PROCESSING EQUIPMENT MAINTENANCE CONTRACT</AddtlRmtInf>
        </Strd>
      </RmtInf>
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>`
  },

  crypto: {
    id: 'crypto',
    title: 'India → USA → Mexico Crypto Settlement',
    description: 'Mumbai fintech pays US partner, final settlement to Mexico via Solana - $50,000 USD',
    badge: 'BLOCKCHAIN',
    badgeVariant: 'purple',
    isAgentic: false,
    isCryptoSettlement: true,
    info: {
      process: 'ISO 20022 payment converted to canonical JSON, then settled on Solana blockchain as last-mile payment to Mexico.',
      hop1: 'pacs.008 → JSON: Extract payment details and wallet addresses from RmtInf/Ustrd fields.',
      hop2: 'JSON → Solana: Execute blockchain transfer with real transaction hash and explorer link.'
    },
    sourceCountry: {
      name: 'India',
      code: 'IN',
      flag: '🇮🇳',
      bank: 'Mumbai Fintech Ltd',
      city: 'Mumbai',
      coords: [72.8777, 19.0760]
    },
    targetCountry: {
      name: 'United States',
      code: 'US',
      flag: '🇺🇸',
      bank: 'US Payment Hub',
      city: 'New York',
      coords: [-74.0060, 40.7128]
    },
    finalCountry: {
      name: 'Mexico',
      code: 'MX',
      flag: '🇲🇽',
      bank: 'Solana Wallet',
      city: 'Mexico City',
      coords: [-99.1332, 19.4326]
    },
    sourceFormat: 'pacs.008',
    targetFormat: 'JSON',
    nodes: 3,
    steps: 2,
    formats: 'ISO20022, JSON, Solana',
    message: `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08">
  <FIToFICstmrCdtTrf>
    <GrpHdr>
      <MsgId>CRYPTO-IN-MX-2025-001</MsgId>
      <CreDtTm>2025-01-15T10:30:00Z</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <SttlmInf><SttlmMtd>INDA</SttlmMtd></SttlmInf>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId>
        <EndToEndId>E2E-CRYPTO-IN-MX-001</EndToEndId>
      </PmtId>
      <Amt>
        <InstdAmt Ccy="USD">50000.00</InstdAmt>
      </Amt>
      <Dbtr>
        <Nm>MUMBAI FINTECH SOLUTIONS PVT LTD</Nm>
        <PstlAdr><Ctry>IN</Ctry><TwnNm>Mumbai</TwnNm></PstlAdr>
      </Dbtr>
      <DbtrAcct><Id><IBAN>IN64HDFC0051234567890</IBAN></Id></DbtrAcct>
      <Cdtr>
        <Nm>US PAYMENT PARTNERS LLC</Nm>
        <PstlAdr><Ctry>US</Ctry><TwnNm>New York</TwnNm></PstlAdr>
      </Cdtr>
      <CdtrAcct><Id><IBAN>US1234567890123456789012</IBAN></Id></CdtrAcct>
      <RmtInf>
        <Ustrd>INVOICE FINTECH-MX-2025-Q1-001 SOFTWARE SERVICES</Ustrd>
        <Ustrd>/CRYPTO/SOL/SETTLEMENT</Ustrd>
        <Ustrd>/RECEIVER/EJ4KSoUY3fisJQE4NvJWpErTRBKLKyqbaiJDLKFEkTtK</Ustrd>
        <Ustrd>/AMOUNT_SOL/50000</Ustrd>
      </RmtInf>
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>`
  },

  name_mismatch: {
    id: 'name_mismatch',
    title: 'USA → UK Banking Services',
    description: 'Goldman Sachs pays HSBC for custody services - £5M GBP - Name verification required',
    badge: 'NAME VERIFICATION',
    badgeVariant: 'yellow',
    isAgentic: true,
    info: {
      problem: 'Payment creditor shows "HSBC" but sanctions screening requires exact legal name match. Trading names and abbreviations often fail compliance checks.',
      solution: 'Transaction Agent searches the KYC registry to find "HSBC Holdings plc" as the official legal name matching the trading name "HSBC".',
      whyAgent: 'Name verification requires fuzzy matching against KYC registry - trading names, abbreviations, and typos need intelligent resolution.'
    },
    sourceCountry: {
      name: 'United States',
      code: 'US',
      flag: '🇺🇸',
      bank: 'Goldman Sachs',
      city: 'New York',
      coords: [-74.0060, 40.7128]
    },
    targetCountry: {
      name: 'United Kingdom',
      code: 'GB',
      flag: '🇬🇧',
      bank: 'HSBC',
      city: 'London',
      coords: [-0.1276, 51.5074]
    },
    sourceFormat: 'MT103',
    targetFormat: 'pacs.008',
    nodes: 3,
    steps: 2,
    formats: 'MT103, ISO20022',
    message: `{1:F01GABORUSS33XXX0000000000}{2:I103MIDLGB22XXXXN}{4:
:20:GS-HSBC-2025-Q1-001
:23B:CRED
:32A:250115GBP5000000,00
:50K:/US33GSBUS33XXX1234567890
GOLDMAN SACHS AND CO LLC
200 WEST STREET
NEW YORK NY 10282
UNITED STATES
:52A:GABORUSS33
:57A:MIDLGB22
:59:/GB82MIDL40051512345678
HSBC
8 CANADA SQUARE
CANARY WHARF LONDON E14 5HQ
UNITED KINGDOM
:70:INVOICE GS-HSBC-2025-Q1-8901 DATED 10.01.2025
GLOBAL CUSTODY SERVICES Q1 2025
SECURITIES SETTLEMENT AND CLEARING
ASSET SERVICING FEES
:71A:SHA
-}`
  }
};

/**
 * Get scenario configuration by ID
 */
export function getScenario(scenarioId) {
  return SCENARIOS[scenarioId];
}

/**
 * Get all available scenarios as an array
 */
export function getAllScenarios() {
  return Object.values(SCENARIOS);
}
