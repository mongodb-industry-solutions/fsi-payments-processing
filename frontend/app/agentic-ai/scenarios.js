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
    badgeVariant: 'blue',
    isAgentic: true,
    agentCollection: 'bankDetails',
    mongoFeature: 'ATLAS SEARCH',
    info: {
      problem: 'Japanese banks require creditor names in Katakana script, but the source MT103 contains "DENSO CORPORATION" in Latin characters.',
      solution: 'Transaction Agent detects this requirement and automatically transliterates the name to Katakana using Japan\'s official transliteration rules.',
      whyAgent: 'Rule-based conversion can\'t handle name transliteration - requires country-specific knowledge.'
    },
    // Story steps that appear during the payment journey
    // position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'bottom-center'
    story: [
      {
        trigger: 'start',
        position: 'bottom-center',
        icon: 'bank',
        title: 'Cross-Border Payment Request',
        description: 'Deutsche Bank receives wire transfer request: ¥45M from Volkswagen AG to Denso Corporation, Japan.',
        color: '#00A35C',
        delay: 0
      },
      {
        trigger: 'hop1_start',
        position: 'bottom-center',
        icon: 'document',
        title: 'SWIFT Message Processing',
        description: 'Bank gateway parses MT103 message and initiates ISO 20022 conversion for Japanese clearing.',
        highlight: 'MT103 → pacs.008',
        color: '#0B61A4',
        delay: 0
      },
      {
        trigger: 'validation_failed',
        position: 'bottom-center',
        icon: 'problem',
        title: 'Compliance Check Failed',
        description: 'BOJ (Bank of Japan) requires beneficiary names in Katakana script. Latin characters rejected.',
        highlight: 'DENSO CORPORATION ✗',
        color: '#CD4246',
        delay: 0
      },
      {
        trigger: 'agent_start',
        position: 'bottom-center',
        icon: 'agent',
        title: 'Transaction Agent Engaged',
        description: 'Routing to AI agent for automatic remediation. Human escalation avoided.',
        color: '#FFC010',
        delay: 0
      },
      {
        trigger: 'tool_call',
        position: 'bottom-center',
        icon: 'translate',
        title: 'Katakana Transliteration',
        description: 'Agent applies Japan Ministry of Justice romanization standards.',
        highlight: 'DENSO → デンソー',
        color: '#7C3AED',
        delay: 0
      },
      {
        trigger: 'agent_complete',
        position: 'bottom-center',
        icon: 'check',
        title: 'Remediation Complete',
        description: 'Beneficiary name converted. Payment resubmitted to clearing queue.',
        highlight: 'デンソー コーポレーション',
        color: '#00A35C',
        delay: 0
      },
      {
        trigger: 'complete',
        position: 'bottom-center',
        icon: 'japan',
        title: 'Payment Settled',
        description: '¥45,000,000 credited to Denso Corporation via BOJ-NET. STP achieved.',
        color: '#00A35C',
        delay: 0
      }
    ],
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
    agentCollection: 'ifscCodes',
    mongoFeature: 'ATLAS SEARCH',
    info: {
      problem: 'Indian banking requires specific IFSC codes for bank identification, but the source MT103 only has descriptive details: "HDFC Bank, Fort Branch, Mumbai".',
      solution: 'Transaction Agent looks up the correct IFSC code from India\'s official database using bank name, branch, and location, then validates and inserts it.',
      whyAgent: 'IFSC lookup requires external database access and validation - beyond simple field mapping.'
    },
    story: [
      {
        trigger: 'start',
        position: 'bottom-center',
        icon: 'bank',
        title: 'Cross-Border Payment Request',
        description: 'JPMorgan Chase receives wire transfer: ₹15M from Google LLC to Infosys Limited, India.',
        color: '#00A35C',
        delay: 0
      },
      {
        trigger: 'hop1_start',
        position: 'bottom-center',
        icon: 'document',
        title: 'SWIFT Message Processing',
        description: 'Bank gateway parses MT103 and initiates ISO 20022 conversion for Indian clearing.',
        highlight: 'MT103 → pacs.008',
        color: '#0B61A4',
        delay: 0
      },
      {
        trigger: 'validation_failed',
        position: 'bottom-center',
        icon: 'problem',
        title: 'Compliance Check Failed',
        description: 'RBI requires IFSC code for beneficiary bank. Only descriptive text found.',
        highlight: 'HDFC Bank, Fort Branch ✗',
        color: '#CD4246',
        delay: 0
      },
      {
        trigger: 'agent_start',
        position: 'bottom-center',
        icon: 'agent',
        title: 'Transaction Agent Engaged',
        description: 'Routing to AI agent for IFSC code resolution. Manual lookup avoided.',
        color: '#FFC010',
        delay: 0
      },
      {
        trigger: 'tool_call',
        position: 'bottom-center',
        icon: 'search',
        title: 'IFSC Database Lookup',
        description: 'Agent queries RBI directory using bank name, branch, and location.',
        highlight: 'HDFC + Fort + Mumbai',
        color: '#7C3AED',
        delay: 0
      },
      {
        trigger: 'agent_complete',
        position: 'bottom-center',
        icon: 'check',
        title: 'IFSC Code Resolved',
        description: 'Bank identified and validated. IFSC code inserted into payment.',
        highlight: 'HDFC0000261',
        color: '#00A35C',
        delay: 0
      },
      {
        trigger: 'complete',
        position: 'bottom-center',
        icon: 'india',
        title: 'Payment Settled',
        description: '₹15,000,000 credited to Infosys Limited via NEFT/RTGS. STP achieved.',
        color: '#00A35C',
        delay: 0
      }
    ],
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
    agentCollection: null,
    mongoFeature: 'DOCUMENT MODEL',
    info: {
      process: 'Cross-border card authorization converted from legacy ISO 8583 (POS terminal format) to modern ISO 20022 cain.001 for card network processing between acquirer and issuer.',
      aiExtraction: 'AI parses unstructured merchant field "SIM LIM SQUARE ELECTRONICS    SINGAPORE     SGP" into structured name, city, and country fields.',
      multiHop: 'Multi-hop conversion: ISO8583 → Canonical JSON → cain.001 XML, enabling format bridging through a universal intermediate.'
    },
    story: [
      {
        trigger: 'start',
        position: 'bottom-center',
        icon: 'card',
        title: 'POS Terminal Transaction',
        description: 'UK cardholder taps Visa at Sim Lim Square electronics shop. S$2,500 purchase initiated.',
        highlight: '4659-01XX-XXXX-6789',
        color: '#00A35C',
        delay: 0
      },
      {
        trigger: 'hop1_start',
        position: 'bottom-center',
        icon: 'document',
        title: 'ISO 8583 Authorization',
        description: 'Acquirer bank receives 0200 message from POS terminal. Legacy format requires conversion.',
        highlight: 'ISO8583_0200 → JSON',
        color: '#0B61A4',
        delay: 0
      },
      {
        trigger: 'hop1_complete',
        position: 'bottom-center',
        icon: 'agent',
        title: 'AI Merchant Extraction',
        description: 'Unstructured merchant field parsed into structured data: name, city, country.',
        highlight: 'SIM LIM SQUARE ELECTRONICS',
        color: '#7C3AED',
        delay: 0
      },
      {
        trigger: 'hop2_start',
        position: 'bottom-center',
        icon: 'document',
        title: 'ISO 20022 Construction',
        description: 'Building cain.001 card authorization for Visa network inter-bank routing.',
        highlight: 'JSON → cain.001',
        color: '#0B61A4',
        delay: 0
      },
      {
        trigger: 'hop2_complete',
        position: 'bottom-center',
        icon: 'check',
        title: 'Authorization Request Ready',
        description: 'Card network message formatted per ISO 20022 cain.001 specification.',
        highlight: 'AccptrAuthstnReq XML',
        color: '#00A35C',
        delay: 0
      },
      {
        trigger: 'complete',
        position: 'bottom-center',
        icon: 'singapore',
        title: 'Authorization Approved',
        description: 'S$2,500 purchase authorized. Response routed back to Singapore acquirer in 340ms.',
        highlight: 'APPROVED',
        color: '#00A35C',
        delay: 0
      }
    ],
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
    description: 'BP PLC pays BHP Group for mining equipment - A$8.5M AUD',
    badge: 'MX TRANSITION',
    badgeVariant: 'lightgray',
    isAgentic: false,
    isDeterministic: true,
    agentCollection: null,
    mongoFeature: 'DOCUMENT MODEL',
    info: {
      process: 'Demonstrates internal MT-to-MX transition: bank receives pacs.008 externally, converts to internal canonical JSON for legacy system processing, then back to pacs.008 for outbound transmission.',
      hop1: 'pacs.008 → JSON: Incoming ISO 20022 message converted to canonical JSON for internal routing and legacy system compatibility.',
      hop2: 'JSON → pacs.008: After internal processing, canonical JSON converted back to ISO 20022 for cross-border settlement.'
    },
    story: [
      {
        trigger: 'start',
        position: 'bottom-center',
        icon: 'bank',
        title: 'Incoming SWIFT Message',
        description: 'Barclays receives pacs.008 from correspondent: BP PLC → BHP Group, A$8.5M.',
        highlight: 'SWIFT gpi inbound',
        color: '#00A35C',
        delay: 0
      },
      {
        trigger: 'hop1_start',
        position: 'bottom-center',
        icon: 'document',
        title: 'ISO 20022 Parsing',
        description: 'Extracting payment data from XML. Converting to internal canonical format.',
        highlight: 'pacs.008 → JSON',
        color: '#0B61A4',
        delay: 0
      },
      {
        trigger: 'hop1_complete',
        position: 'bottom-center',
        icon: 'transform',
        title: 'Internal Routing Format',
        description: 'Payment normalized for legacy core banking, AML screening, and sanctions check.',
        highlight: 'Canonical JSON',
        color: '#00A35C',
        delay: 0
      },
      {
        trigger: 'hop2_start',
        position: 'bottom-center',
        icon: 'document',
        title: 'Outbound Message Build',
        description: 'Internal processing complete. Reconstructing ISO 20022 for SWIFT transmission.',
        highlight: 'JSON → pacs.008',
        color: '#0B61A4',
        delay: 0
      },
      {
        trigger: 'hop2_complete',
        position: 'bottom-center',
        icon: 'check',
        title: 'Message Validated',
        description: 'pacs.008 schema validated. UETR assigned for gpi tracking.',
        highlight: 'UETR: 8a5...f2c',
        color: '#00A35C',
        delay: 0
      },
      {
        trigger: 'complete',
        position: 'bottom-center',
        icon: 'australia',
        title: 'Cross-Border Settlement',
        description: 'A$8,500,000 credited to BHP Group Limited via RITS (Australia RTGS). STP achieved.',
        color: '#00A35C',
        delay: 0
      }
    ],
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
    description: 'Mumbai fintech pays US partner, settles to Mexico via Solana - $50K USD',
    badge: 'BLOCKCHAIN',
    badgeVariant: 'blue',
    isAgentic: false,
    isCryptoSettlement: true,
    agentCollection: null,
    mongoFeature: 'DOCUMENT MODEL',
    info: {
      process: 'ISO 20022 payment converted to canonical JSON, then settled on Solana blockchain as last-mile payment to Mexico.',
      hop1: 'pacs.008 → JSON: Extract payment details and wallet addresses from RmtInf/Ustrd fields.',
      hop2: 'JSON → Solana: Execute blockchain transfer with real transaction hash and explorer link.'
    },
    story: [
      {
        trigger: 'start',
        position: 'bottom-center',
        icon: 'bank',
        title: 'Cross-Border Payment Request',
        description: 'Mumbai Fintech initiates $50K wire to US partner with crypto settlement for Mexico.',
        color: '#00A35C',
        delay: 0
      },
      {
        trigger: 'hop1_start',
        position: 'bottom-center',
        icon: 'document',
        title: 'ISO 20022 Processing',
        description: 'Bank gateway parses pacs.008, extracting crypto instructions from RmtInf fields.',
        highlight: 'pacs.008 → JSON',
        color: '#0B61A4',
        delay: 0
      },
      {
        trigger: 'hop1_complete',
        position: 'bottom-center',
        icon: 'transform',
        title: 'Canonical JSON Generated',
        description: 'Payment normalized with Solana wallet address and settlement instructions.',
        highlight: 'crypto_receiver_wallet',
        color: '#00A35C',
        delay: 0
      },
      {
        trigger: 'crypto_start',
        position: 'bottom-center',
        icon: 'chain',
        title: 'Blockchain Bridge Activated',
        description: 'Switching from traditional rails to Solana blockchain for last-mile settlement.',
        highlight: 'JSON → Solana',
        color: '#9945FF',
        delay: 0
      },
      {
        trigger: 'crypto_wallet_extract',
        position: 'bottom-center',
        icon: 'wallet',
        title: 'Wallet Address Validated',
        description: 'Destination wallet confirmed as valid Solana public key (Base58).',
        highlight: 'EJ4K...TtK',
        color: '#9945FF',
        delay: 0
      },
      {
        trigger: 'crypto_tx_build',
        position: 'bottom-center',
        icon: 'document',
        title: 'Transaction Constructed',
        description: 'SystemProgram.transfer instruction built with MessageV0.',
        highlight: '0.001 SOL',
        color: '#9945FF',
        delay: 0
      },
      {
        trigger: 'crypto_tx_sign',
        position: 'bottom-center',
        icon: 'sign',
        title: 'Cryptographic Signing',
        description: 'Service wallet signs transaction with Ed25519 algorithm.',
        highlight: '64-byte signature',
        color: '#9945FF',
        delay: 0
      },
      {
        trigger: 'crypto_tx_submit',
        position: 'bottom-center',
        icon: 'broadcast',
        title: 'Broadcasting to Solana',
        description: 'Transaction submitted to devnet RPC for validator processing.',
        highlight: 'sendRawTransaction',
        color: '#9945FF',
        delay: 0
      },
      {
        trigger: 'crypto_tx_confirm',
        position: 'bottom-center',
        icon: 'check',
        title: 'Validators Confirmed',
        description: 'Block consensus reached. Transaction included in recent block.',
        highlight: '~400ms',
        color: '#14F195',
        delay: 0
      },
      {
        trigger: 'crypto_complete',
        position: 'bottom-center',
        icon: 'money',
        title: 'On-Chain Settlement',
        description: 'Transfer finalized on immutable blockchain ledger.',
        highlight: 'Explorer link',
        color: '#14F195',
        delay: 0
      },
      {
        trigger: 'complete',
        position: 'bottom-center',
        icon: 'mexico',
        title: 'Payment Delivered',
        description: '$50,000 settled to Mexico via hybrid ISO 20022 + Solana rail.',
        color: '#00A35C',
        delay: 0
      }
    ],
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

  purpose_code: {
    id: 'purpose_code',
    title: 'Canada → Singapore Tech Services',
    description: 'Shopify Inc pays Grab Holdings for API integration - S$3.2M SGD',
    badge: 'PURPOSE CODE',
    badgeVariant: 'lightgray',
    isAgentic: true,
    agentCollection: 'purposeCodes',
    mongoFeature: 'VECTOR SEARCH',
    info: {
      problem: 'ISO 20022 requires standardized purpose codes (e.g., SALA, SUPP, SCVE), but the source MT103 only contains free-text: "Platform API integration and cloud infrastructure services".',
      solution: 'Transaction Agent uses semantic vector search to classify the payment description into the correct ISO 20022 purpose code: SCVE (Services).',
      whyAgent: 'Purpose code classification requires understanding payment intent from unstructured text - keyword matching fails when wording varies.'
    },
    story: [
      {
        trigger: 'start',
        position: 'bottom-center',
        icon: 'bank',
        title: 'Cross-Border Payment Request',
        description: 'RBC Royal Bank receives wire transfer: S$3.2M from Shopify Inc to Grab Holdings, Singapore.',
        color: '#00A35C',
        delay: 0
      },
      {
        trigger: 'hop1_start',
        position: 'bottom-center',
        icon: 'document',
        title: 'SWIFT Message Processing',
        description: 'Bank gateway parses MT103 and initiates ISO 20022 conversion for MAS clearing.',
        highlight: 'MT103 → pacs.008',
        color: '#0B61A4',
        delay: 0
      },
      {
        trigger: 'validation_failed',
        position: 'bottom-center',
        icon: 'problem',
        title: 'Compliance Check Failed',
        description: 'ISO 20022 requires standardized purpose code. Only free-text description found.',
        highlight: '"API integration services" ✗',
        color: '#CD4246',
        delay: 0
      },
      {
        trigger: 'agent_start',
        position: 'bottom-center',
        icon: 'agent',
        title: 'Transaction Agent Engaged',
        description: 'Routing to AI agent for purpose code classification. Manual review avoided.',
        color: '#FFC010',
        delay: 0
      },
      {
        trigger: 'tool_call',
        position: 'bottom-center',
        icon: 'brain',
        title: 'Semantic Classification',
        description: 'Agent analyzes payment description using vector similarity search.',
        highlight: '"cloud infrastructure" → ?',
        color: '#7C3AED',
        delay: 0
      },
      {
        trigger: 'agent_complete',
        position: 'bottom-center',
        icon: 'check',
        title: 'Purpose Code Resolved',
        description: 'Payment classified as technical services. ISO code inserted.',
        highlight: 'SCVE (Services)',
        color: '#00A35C',
        delay: 0
      },
      {
        trigger: 'complete',
        position: 'bottom-center',
        icon: 'singapore',
        title: 'Payment Settled',
        description: 'S$3,200,000 credited to Grab Holdings via FAST/MEPS+. STP achieved.',
        color: '#00A35C',
        delay: 0
      }
    ],
    sourceCountry: {
      name: 'Canada',
      code: 'CA',
      flag: '🇨🇦',
      bank: 'RBC Royal Bank',
      city: 'Ottawa',
      coords: [-75.6972, 45.4215]
    },
    targetCountry: {
      name: 'Singapore',
      code: 'SG',
      flag: '🇸🇬',
      bank: 'DBS Bank',
      city: 'Singapore',
      coords: [103.8198, 1.3521]
    },
    sourceFormat: 'MT103',
    targetFormat: 'pacs.008',
    nodes: 3,
    steps: 2,
    formats: 'MT103, ISO20022',
    message: `{1:F01ROABORYCXXX0000000000}{2:I103DBSSSGSGXXXXN}{4:
:20:SHOP-GRAB-2025-Q1-001
:23B:CRED
:32A:250120SGD3200000,00
:50K:/CA1234567890123456
SHOPIFY INC
150 ELGIN STREET
OTTAWA ON K2P 1L4
CANADA
:52A:ROABORYCXXX
:57A:DBSSSGSG
:59:/SG1234567890123456
GRAB HOLDINGS LIMITED
3 MEDIA CLOSE
SINGAPORE 138498
:70:PLATFORM API INTEGRATION SERVICES
CLOUD INFRASTRUCTURE AND PAYMENT GATEWAY
Q1 2025 TECHNICAL PARTNERSHIP MILESTONE
CONTRACT SHOP-GRAB-2024-API-001
:71A:SHA
-}`
  },

  name_mismatch: {
    id: 'name_mismatch',
    title: 'USA → UK Banking Services',
    description: 'Goldman Sachs pays HSBC for custody services - £5M GBP',
    badge: 'NAME VERIFICATION',
    badgeVariant: 'yellow',
    isAgentic: true,
    agentCollection: 'registeredEntities',
    mongoFeature: 'ATLAS SEARCH',
    info: {
      problem: 'Payment creditor shows "HSBC" but sanctions screening requires exact legal name match. Trading names and abbreviations often fail compliance checks.',
      solution: 'Transaction Agent searches the KYC registry to find "HSBC Holdings plc" as the official legal name matching the trading name "HSBC".',
      whyAgent: 'Name verification requires fuzzy matching against KYC registry - trading names, abbreviations, and typos need intelligent resolution.'
    },
    story: [
      {
        trigger: 'start',
        position: 'bottom-center',
        icon: 'bank',
        title: 'Cross-Border Payment Request',
        description: 'Goldman Sachs initiates wire transfer: £5M to HSBC for global custody services.',
        color: '#00A35C',
        delay: 0
      },
      {
        trigger: 'hop1_start',
        position: 'bottom-center',
        icon: 'document',
        title: 'SWIFT Message Processing',
        description: 'Bank gateway parses MT103 and initiates ISO 20022 conversion for CHAPS clearing.',
        highlight: 'MT103 → pacs.008',
        color: '#0B61A4',
        delay: 0
      },
      {
        trigger: 'validation_failed',
        position: 'bottom-center',
        icon: 'problem',
        title: 'Sanctions Screening Failed',
        description: 'Creditor name "HSBC" not found in registered legal entities. Requires exact match.',
        highlight: '"HSBC" ✗ (trading name)',
        color: '#CD4246',
        delay: 0
      },
      {
        trigger: 'agent_start',
        position: 'bottom-center',
        icon: 'agent',
        title: 'Transaction Agent Engaged',
        description: 'Routing to AI agent for legal name resolution. Manual compliance review avoided.',
        color: '#FFC010',
        delay: 0
      },
      {
        trigger: 'tool_call',
        position: 'bottom-center',
        icon: 'search',
        title: 'KYC Registry Lookup',
        description: 'Agent queries corporate registry using trading name and BIC code.',
        highlight: 'HSBC + MIDLGB22',
        color: '#7C3AED',
        delay: 0
      },
      {
        trigger: 'agent_complete',
        position: 'bottom-center',
        icon: 'shield',
        title: 'Legal Name Verified',
        description: 'Registered entity found. Creditor name updated for compliance.',
        highlight: 'HSBC Holdings plc',
        color: '#00A35C',
        delay: 0
      },
      {
        trigger: 'complete',
        position: 'bottom-center',
        icon: 'uk',
        title: 'Payment Settled',
        description: '£5,000,000 credited to HSBC Holdings plc via CHAPS. STP achieved.',
        color: '#00A35C',
        delay: 0
      }
    ],
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
