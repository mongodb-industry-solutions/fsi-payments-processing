export const FORMAT_INFO = {
  MT103: {
    name: "MT103 - Customer Credit Transfer",
    description: "SWIFT message type for international wire transfers between banks on behalf of customers. The global standard for cross-border payments.",
    usage: [
      "Cross-border customer payments",
      "International wire transfers",
      "Commercial transactions",
      "Personal remittances"
    ],
    structure: `{1:F01CHASUS33XXXX0000000000}{2:I103DEUTDEFFXXXXN}{4:
:20:TEST001              // Transaction Reference
:23B:CRED                // Bank Operation Code
:32A:241215USD125750,50  // Value Date, Currency, Amount
:50K:/US64209876543210987654
ACME TECHNOLOGIES INC    // Ordering Customer
1234 INNOVATION DRIVE
SILICON VALLEY CA 94025
:52A:CHASUS33XXX        // Ordering Institution
:53A:DEUTDEFFXXX        // Sender's Correspondent
:59:/DE89370400440532013000
GLOBAL SUPPLIES GMBH    // Beneficiary Customer
INDUSTRIESTRASSE 78
60329 FRANKFURT
:70:INV-2024-11-3847    // Remittance Information
PAYMENT FOR ELECTRONIC COMPONENTS
:71A:SHA                // Charge Bearer
:72:/ACC/URGENT PROCESSING
-}`,
    mongoConfig: {
      parser: {
        fields: [
          { field: ":20", pattern: ":20:([^\\n:]+)", name: "transaction_reference" },
          { field: ":23B", pattern: ":23B:([^\\n:]+)", name: "bank_operation_code" },
          { field: ":32A", pattern: ":32A:([^\\n:]+)", name: "value_date_amount" },
          { field: ":50K", pattern: ":50K:([^\\n:]+(?:\\n(?!:)[^\\n:]+)*)", name: "ordering_customer" },
          { field: ":59", pattern: ":59:([^\\n:]+(?:\\n(?!:)[^\\n:]+)*)", name: "beneficiary" },
          { field: ":70", pattern: ":70:([^\\n:]+(?:\\n(?!:)[^\\n:]+)*)", name: "remittance_information" },
          { field: ":71A", pattern: ":71A:([^\\n:]+)", name: "details_of_charges" },
          { field: ":72", pattern: ":72:([\\s\\S]+?)(?=\\n:|$|\\n-})", name: "sender_to_receiver_info" }
        ]
      },
      mappings: [
        { source: "20", targets: ["MsgId", "EndToEndId"], lane: "RULES", transform: "copy" },
        { source: "32A.currency", targets: ["Currency"], lane: "RULES", transform: "copy" },
        { source: "32A.amount", targets: ["Amount"], lane: "RULES", transform: "remove_comma" },
        { source: "32A.value_date", targets: ["ValueDate"], lane: "RULES", transform: "date_format" },
        { source: "50K", targets: ["Dbtr.Nm"], lane: "RULES", transform: "extract_party" },
        { source: "59", targets: ["Cdtr.Nm"], lane: "RULES", transform: "extract_party" },
        { source: "70", targets: ["RmtInf.Ustrd"], lane: "AI", transform: "ai_extract" },
        { source: "72", targets: ["InstrForNxtAgt"], lane: "AI", transform: "ai_extract" }
      ],
      builder: {
        templateType: "xml",
        namespace: "urn:iso:std:iso:20022"
      },
      stats: {
        totalFields: 21,
        rulesLane: 18,
        aiLane: 3
      }
    }
  },

  MT202: {
    name: "MT202 - General Financial Institution Transfer",
    description: "SWIFT message for bank-to-bank transfers. Used for cover payments and interbank settlements.",
    usage: [
      "Bank-to-bank transfers",
      "Cover payments for MT103",
      "Interbank settlements",
      "Liquidity management"
    ],
    structure: `{1:F01CHASUS33AXXX0000000000}{2:I202DEUTDEFFXXXXN}{4:
:20:MT202TEST           // Transaction Reference
:21:REF2024MT202001    // Related Reference
:32A:241215EUR500000,00 // Value Date, Currency, Amount
:52A:CHASUS33XXX       // Ordering Institution
:53A:CORRBANK1XXX      // Sender's Correspondent
:56A:INTBANK2XXX       // Intermediary
:57A:DEUTDEFFXXX       // Account With Institution
:58A:/DE12345678901234567890
BENEFICIARY INSTITUTION // Beneficiary Institution
:72:/BNF/TREASURY OPERATIONS
/INS/PRIORITY PROCESSING
-}`,
    mongoConfig: {
      parser: {
        title: "15 Regex Patterns",
        description: "Extract bank-to-bank transfer fields",
        example: ":21:(.+) → Related Reference"
      },
      transformer: {
        title: "2-Lane Processing",
        rules: "13 fields via rules",
        ai: "2 fields via AI (field 72)",
        human: "Compliance check for large amounts"
      },
      builder: {
        title: "pacs.009 Construction",
        description: "Build ISO 20022 financial institution transfer"
      }
    }
  },

  CHAPS: {
    name: "CHAPS - Clearing House Automated Payment System",
    description: "UK's high-value, same-day sterling payment system. Guaranteed same-day settlement for time-critical payments.",
    usage: [
      "House purchases and deposits",
      "Large business payments",
      "Financial market transactions",
      "Time-critical payments"
    ],
    structure: `<Document xmlns="urn:iso:std:iso:20022">
  <FIToFICstmrCdtTrf>
    <GrpHdr>
      <MsgId>CHAPS2024001</MsgId>
      <CreDtTm>2024-12-15T10:00:00</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <SttlmInf>
        <SttlmMtd>CLRG</SttlmMtd>
      </SttlmInf>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId>
        <EndToEndId>PROPERTY-PURCHASE-001</EndToEndId>
      </PmtId>
      <Amt>
        <InstdAmt Ccy="GBP">250000.00</InstdAmt>
      </Amt>
      <Dbtr><Nm>John Smith</Nm></Dbtr>
      <Cdtr><Nm>Property Vendor Ltd</Nm></Cdtr>
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>`,
    mongoConfig: {
      parser: {
        title: "XPath Expressions",
        description: "Extract from XML using path queries",
        example: "//PmtId/EndToEndId → Payment ID"
      },
      transformer: {
        title: "Direct Mapping",
        rules: "All fields via rules",
        ai: "Not required",
        human: "High-value review (>£1M)"
      },
      builder: {
        title: "UK-Specific Template",
        description: "Build CHAPS-compliant XML message"
      }
    }
  },

  "pacs.008": {
    name: "pacs.008 - Customer Credit Transfer",
    description: "ISO 20022 standard for customer credit transfers. The modern replacement for MT103 in many regions.",
    usage: [
      "SEPA credit transfers",
      "TARGET2 payments",
      "Modern payment rails",
      "Real-time payments"
    ],
    structure: `<Document xmlns="urn:iso:std:iso:20022">
  <FIToFICstmrCdtTrf>
    <CdtTrfTxInf>
      <PmtId>
        <InstrId>INSTR-001</InstrId>
        <EndToEndId>E2E-REF-001</EndToEndId>
        <TxId>TXN-123456</TxId>
      </PmtId>
      <IntrBkSttlmAmt Ccy="EUR">125750.50</IntrBkSttlmAmt>
      <ChrgBr>SHAR</ChrgBr>
      <Dbtr>
        <Nm>ACME Technologies Inc</Nm>
        <PstlAdr>
          <Ctry>US</Ctry>
        </PstlAdr>
      </Dbtr>
      <Cdtr>
        <Nm>Global Supplies GmbH</Nm>
        <PstlAdr>
          <Ctry>DE</Ctry>
        </PstlAdr>
      </Cdtr>
      <RmtInf>
        <Ustrd>Invoice INV-2024-11-3847</Ustrd>
      </RmtInf>
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>`,
    mongoConfig: {
      parser: {
        title: "XML Schema Validation",
        description: "Parse structured ISO 20022 XML",
        example: "CdtTrfTxInf/PmtId → Payment Identification"
      },
      transformer: {
        title: "Schema Mapping",
        rules: "Direct XML element mapping",
        ai: "Optional for remittance",
        human: "Compliance validation"
      },
      builder: {
        title: "ISO 20022 Compliant",
        description: "Generate valid pacs.008 message"
      }
    }
  },

  TARGET2: {
    name: "TARGET2 - Trans-European Payment System",
    description: "The real-time gross settlement system for the Euro, used by central banks in the Eurozone.",
    usage: [
      "Central bank operations",
      "Large-value Euro transfers",
      "Monetary policy implementation",
      "Cross-border Euro settlements"
    ],
    structure: "ISO 20022 XML format similar to pacs.008 with TARGET2-specific requirements",
    mongoConfig: {
      parser: {
        title: "TARGET2 Parser",
        description: "Extract Euro payment fields",
        example: "Settlement priority and cut-off times"
      },
      transformer: {
        title: "ECB Compliance",
        rules: "TARGET2-specific validations",
        ai: "Not typically required",
        human: "Central bank oversight"
      },
      builder: {
        title: "TARGET2 Message",
        description: "Build ECB-compliant payment message"
      }
    }
  },

  SPEI: {
    name: "SPEI - Sistema de Pagos Electrónicos Interbancarios",
    description: "Mexico's interbank electronic payment system for real-time peso transfers.",
    usage: [
      "Domestic Mexican transfers",
      "Payroll distributions",
      "Business payments",
      "Government disbursements"
    ],
    structure: "XML-based format with Mexican banking standards and CLABE account numbers",
    mongoConfig: {
      parser: {
        title: "SPEI Parser",
        description: "Extract Mexican payment fields",
        example: "CLABE validation and RFC extraction"
      },
      transformer: {
        title: "Mexican Standards",
        rules: "CLABE and RFC validation",
        ai: "Concept extraction",
        human: "Tax compliance review"
      },
      builder: {
        title: "SPEI Format",
        description: "Build Banxico-compliant message"
      }
    }
  },

  USDC: {
    name: "USDC - USD Coin Stablecoin",
    description: "USDC is a fully reserved digital dollar stablecoin, providing instant, global, and cost-effective payments on multiple blockchain networks. Each USDC is backed 1:1 by US dollars held in reserve, ensuring price stability and regulatory compliance. Circle, the issuer of USDC, maintains transparent monthly attestations of reserves.",
    usage: [
      "Cross-border B2B payments with instant settlement",
      "Crypto payroll and contractor payments globally",
      "DeFi liquidity provision and yield farming",
      "24/7 treasury operations and FX hedging",
      "Programmable money with smart contracts",
      "Micropayments and subscription services",
      "NFT marketplaces and gaming economies"
    ],
    structure: `// Full Web3 Transaction Template for USDC Transfer on Polygon
{
  // Network Configuration
  "chainId": 137,              // Polygon Mainnet (alternatives: 1=Ethereum, 56=BSC, 42161=Arbitrum)
  "network": "polygon",         // Human-readable network name
  "rpcUrl": "https://polygon-rpc.com",

  // Transaction Participants
  "from": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7",  // Sender wallet address
  "to": "0x5aAeb6053f3E94C9b9A09f33669435E7Ef1BeAed",    // Recipient wallet address

  // Token Contract Details
  "tokenAddress": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",  // USDC on Polygon
  "tokenSymbol": "USDC",
  "tokenDecimals": 6,          // USDC uses 6 decimal places (not 18 like ETH)

  // Transfer Amount
  "amount": "50000",            // Human-readable amount (50,000 USDC)
  "value": "50000000000",       // Wei equivalent (amount * 10^6 for USDC)

  // Smart Contract Call
  "data": "0xa9059cbb0000000000000000000000005aAeb6053f3E94C9b9A09f33669435E7Ef1BeAed000000000000000000000000000000000000000000000000000000ba43b7400",
  // Breakdown of data field:
  // 0xa9059cbb = transfer(address,uint256) function selector
  // Next 64 chars = recipient address (padded)
  // Last 64 chars = amount in hex (padded)

  // Gas Configuration
  "gasLimit": "100000",         // Maximum gas units for transaction
  "maxFeePerGas": "30000000000",        // Max fee per gas in wei (30 Gwei)
  "maxPriorityFeePerGas": "2000000000", // Priority fee for miners (2 Gwei)
  "estimatedGas": "65000",      // Typical USDC transfer uses ~65k gas

  // Transaction Metadata
  "nonce": 145,                 // Transaction count for sender address
  "type": 2,                    // EIP-1559 transaction type

  // Additional Context
  "memo": "Payroll batch #2024-12-001",
  "recipient_email": "contractor@example.com",
  "compliance": {
    "kycStatus": "verified",
    "amlCheck": "passed",
    "sanctionsScreening": "clear"
  },

  // MongoDB Conversion Metadata
  "conversion_id": "JSON_to_USDC",
  "source_format": "JSON",
  "target_format": "USDC",
  "processing_timestamp": "2024-12-15T14:30:00Z"
}

// Alternative: Simple Transfer Template
{
  "to": "0x5aAeb6053f3E94C9b9A09f33669435E7Ef1BeAed",
  "amount": "50000",
  "tokenAddress": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  "chainId": 137
}`,
    mongoConfig: {
      parser: {
        title: "JSON/Web3 Parser",
        description: "Extracts blockchain transaction parameters from JSON input",
        example: "from: 0x742d... → Sender wallet address extraction"
      },
      transformer: {
        title: "Blockchain Bridge Processing",
        rules: "Ethereum address validation, amount conversion (6 decimals), gas estimation",
        ai: "Not required for standard transfers",
        human: "Review for transfers > $100,000 or suspicious addresses"
      },
      builder: {
        title: "Web3 Transaction Builder",
        description: "Constructs ERC-20 transfer transaction with proper encoding"
      }
    }
  },

  JSON: {
    name: "Canonical JSON - Universal Format",
    description: "MongoDB's universal payment format that serves as the bridge between all payment types.",
    usage: [
      "Universal converter",
      "Format agnostic storage",
      "Multi-hop routing",
      "Zero-code integration"
    ],
    structure: `{
  "_id": "conv_20241215_TEST001",
  "header": {
    "message_type": "customer_transfer",
    "source_format": "MT103"
  },
  "transaction": {
    "transaction_id": "TXN-123456",
    "end_to_end_id": "E2E-001"
  },
  "parties": {
    "debtor": { "name": "...", "account": {...} },
    "creditor": { "name": "...", "account": {...} }
  },
  "amounts": {
    "instructed": { "value": "125750.50", "currency": "USD" }
  },
  "dates": { "value_date": "2024-12-15" },
  "remittance": { "unstructured": [...] },
  "original_fields": { /* Preserved source data */ }
}`,
    mongoConfig: {
      parser: {
        title: "Universal Parser",
        description: "Accept any format input",
        example: "Format-agnostic extraction"
      },
      transformer: {
        title: "Universal Mapping",
        rules: "Canonical structure",
        ai: "Smart field detection",
        human: "Validation only"
      },
      builder: {
        title: "Any Format Output",
        description: "Build any target format from JSON"
      }
    }
  }
};

// Helper function to get format info
export const getFormatInfo = (format) => {
  return FORMAT_INFO[format] || null;
};

// Get all format types
export const getAllFormats = () => Object.keys(FORMAT_INFO);