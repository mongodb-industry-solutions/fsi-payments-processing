export const SIMPLIFIED_SCENARIOS = {
  simpleTransfer: {
    id: 'simple-transfer',
    name: '🌐 Cross-Border Transfer',
    description: 'US to UK payment via universal JSON bridge',
    complexity: 'simple',
    hops: [
      { id: 'usa', country: 'USA', format: 'MT103', icon: '🇺🇸', city: 'New York' },
      { id: 'uk', country: 'UK', format: 'CHAPS', icon: '🇬🇧', city: 'London' }
    ],
    conversions: [
      {
        from: 'MT103',
        to: 'JSON',
        location: 'Processing',
        time: 2000,
        description: 'Extracting payment fields',
        details: 'Converting SWIFT MT103 format to universal JSON structure',
        useRealAPI: true
      },
      {
        from: 'JSON',
        to: 'CHAPS',
        location: 'UK Gateway',
        time: 2000,
        description: 'Building UK format',
        details: 'Transforming JSON to UK CHAPS payment message',
        useRealAPI: true
      }
    ],
    totalTime: 4000,
    // Sample MT103 message with field 70 for AI processing
    sampleMessage: `{1:F01CHASUS33XXXX0000000000}{2:I103DEUTDEFFXXXXN}{3:{108:ILOVESEPA}}{4:
:20:TEST001
:23B:CRED
:32A:241215USD125750,50
:50K:/US64209876543210987654
ACME TECHNOLOGIES INC
1234 INNOVATION DRIVE
SILICON VALLEY CA 94025
USA
:52A:CHASUS33XXX
:53A:DEUTDEFFXXX
:59:/GB89370400440532013000
GLOBAL SUPPLIES GMBH
123 HIGH STREET
LONDON EC1A 1BB
UNITED KINGDOM
:70:INV-2024-11-3847 DATED 15.11.2024
PAYMENT FOR ELECTRONIC COMPONENTS
ORDER PO-8934567 QTY 5000 UNITS
:71A:SHA
:72:/ACC/URGENT PROCESSING REQUIRED
/REC/NOTIFY ACCOUNTS@GLOBALSUPPLIES.DE
-}`,
    mongoDbAdvantages: {
      title: '🍃 MongoDB: Universal Payment Hub',
      message: "MongoDB's Canonical JSON format eliminates N×N conversion complexity. Instead of building direct MT103→CHAPS converters, payments flow through a universal JSON structure, enabling instant support for new formats with zero code changes."
    },
    pipelineStory: {
      source: 'MT103 SWIFT message from USA with 21 payment fields',
      mongodb: 'Transforms to Canonical JSON - a universal payment language',
      target: 'Outputs as UK CHAPS format for local clearing',
      story: 'MongoDB eliminates the need for direct MT103→CHAPS converters. Every payment flows through JSON, making new format support instant and code-free.'
    },
    // MongoDB configuration details for this scenario
    mongodbConfig: {
      bridge: {
        title: 'Universal JSON Bridge',
        from: 'MT103 (SWIFT)',
        through: 'Canonical JSON',
        to: 'CHAPS (UK)',
        description: 'Eliminates need for MT103→CHAPS direct converter'
      },
      mapping: {
        totalFields: 21,
        rulesLane: 18,
        aiLane: 3,
        humanLane: 0,
        examples: [
          { source: ':20:', target: 'transaction_reference', type: 'rules', description: 'Transaction ID' },
          { source: ':32A:', target: 'value_date + amount', type: 'rules', description: 'Payment amount' },
          { source: ':50K:', target: 'debtor.name + account', type: 'rules', description: 'Ordering customer' },
          { source: ':70:', target: 'remittance.unstructured', type: 'ai', description: 'Invoice details' }
        ]
      },
      conversion: {
        steps: [
          { step: 1, action: 'Parse MT103', time: '45ms', details: 'Extract 21 fields using regex' },
          { step: 2, action: 'Transform to JSON', time: '1.2s', details: '18 rules + 3 AI mappings' },
          { step: 3, action: 'Build CHAPS', time: '30ms', details: 'XML template population' }
        ],
        totalTime: '1.28s'
      },
      metrics: {
        accuracy: '99.8%',
        straightThrough: '95%',
        aiConfidence: '88%',
        costSaving: '92%',
        setupTime: '5 seconds'
      },
      insights: {
        key: 'Zero-Code Architecture',
        value: 'Adding MT192 support would take 5 seconds with auto-config vs 3 months traditional development',
        impact: 'New payment formats added instantly without deploying code'
      }
    }
  },

  multiHop: {
    id: 'multi-hop',
    name: '🔄 Multi-Hop Journey',
    description: 'Payment routing through 3 countries',
    complexity: 'moderate',
    hops: [
      { id: 'usa', country: 'USA', format: 'MT103', icon: '🇺🇸', city: 'New York' },
      { id: 'uk', country: 'UK', format: 'CHAPS', icon: '🇬🇧', city: 'London' },
      { id: 'germany', country: 'Germany', format: 'TARGET2', icon: '🇩🇪', city: 'Frankfurt' }
    ],
    conversions: [
      {
        from: 'MT103',
        to: 'JSON',
        location: 'US Gateway',
        time: 2000,
        description: 'US format extraction',
        details: 'Parsing SWIFT fields and extracting payment data'
      },
      {
        from: 'JSON',
        to: 'CHAPS',
        location: 'UK Processing',
        time: 2000,
        description: 'UK format creation',
        details: 'Building CHAPS message for UK clearing'
      },
      {
        from: 'CHAPS',
        to: 'JSON',
        location: 'UK Gateway',
        time: 2000,
        description: 'Bridging to Europe',
        details: 'Converting UK format back to universal JSON'
      },
      {
        from: 'JSON',
        to: 'TARGET2',
        location: 'EU Gateway',
        time: 2000,
        description: 'EU format creation',
        details: 'Building TARGET2 message for European settlement'
      }
    ],
    totalTime: 8000,
    // Placeholder for future implementation
    sampleMessage: null,
    useRealAPI: false,
    mongoDbAdvantages: {
      title: '🍃 MongoDB: Intelligent Routing Engine',
      message: "MongoDB's graph-based routing finds optimal paths through multiple payment networks. The conversion_graph collection enables real-time path discovery while caching successful routes for sub-100ms subsequent conversions."
    },
    pipelineStory: {
      source: 'Payment originating from USA in MT103 format',
      mongodb: 'JSON acts as the universal bridge between all formats',
      target: 'Reaches Germany via UK, adapting to local standards',
      story: 'One JSON format connects all payment networks. MongoDB finds the optimal path and caches it for lightning-fast future conversions.'
    },
    mongodbConfig: {
      bridge: {
        title: 'Multi-Hop JSON Routing',
        from: 'MT103 (USA)',
        through: 'JSON → CHAPS → JSON → TARGET2',
        to: 'TARGET2 (Germany)',
        description: 'Graph-based routing finds optimal path through networks'
      },
      mapping: {
        totalFields: 42,
        rulesLane: 36,
        aiLane: 6,
        humanLane: 0,
        examples: [
          { source: 'MT103:20', target: 'JSON.transaction_ref', type: 'rules', description: 'Reference tracking' },
          { source: 'JSON.amount', target: 'CHAPS.InstructedAmount', type: 'rules', description: 'Amount conversion' },
          { source: 'CHAPS.RemittanceInfo', target: 'JSON.remittance', type: 'ai', description: 'Info extraction' },
          { source: 'JSON.debtor', target: 'TARGET2.Originator', type: 'rules', description: 'Party mapping' }
        ]
      },
      conversion: {
        steps: [
          { step: 1, action: 'MT103→JSON', time: '1.1s', details: 'Initial conversion with AI' },
          { step: 2, action: 'JSON→CHAPS', time: '35ms', details: 'UK format creation' },
          { step: 3, action: 'CHAPS→JSON', time: '1.0s', details: 'Bridge extraction' },
          { step: 4, action: 'JSON→TARGET2', time: '40ms', details: 'EU format build' }
        ],
        totalTime: '2.18s'
      },
      metrics: {
        accuracy: '99.5%',
        straightThrough: '92%',
        aiConfidence: '85%',
        costSaving: '89%',
        setupTime: '8 seconds',
        hopEfficiency: '98%'
      },
      insights: {
        key: 'Intelligent Path Finding',
        value: 'MongoDB\'s conversion_graph collection automatically finds optimal routing through 3+ payment networks',
        impact: 'Complex multi-country payments execute in seconds, not days'
      }
    }
  },

  cryptoLastMile: {
    id: 'crypto-last-mile',
    name: '🪙 Crypto Payroll Settlement',
    description: 'India to Mexico with USDC last-mile delivery',
    complexity: 'hybrid-crypto',
    hops: [
      { id: 'india', country: 'India', format: 'MT103', icon: '🇮🇳', city: 'Mumbai', info: 'Tech company HQ' },
      { id: 'usa', country: 'USA', format: 'pacs.008', icon: '🇺🇸', city: 'New York', info: 'Correspondent bank', isCorrespondent: true },
      { id: 'mexico', country: 'Mexico', format: 'SPEI', icon: '🇲🇽', city: 'Mexico City', info: 'Payroll service provider' },
      { id: 'crypto', country: 'Blockchain', format: 'USDC', icon: '🪙', city: 'Polygon', info: '25 employee wallets', isCrypto: true }
    ],
    conversions: [
      {
        from: 'MT103',
        to: 'JSON',
        location: 'India → USA',
        time: 2000,
        description: 'SWIFT to Universal',
        details: 'Converting SWIFT MT103 to JSON at correspondent bank',
        useRealAPI: true
      },
      {
        from: 'JSON',
        to: 'pacs.008',
        location: 'USA Processing',
        time: 1500,
        description: 'ISO 20022 Creation',
        details: 'Building pacs.008 message for cross-border transfer',
        useRealAPI: true
      },
      {
        from: 'pacs.008',
        to: 'SPEI',
        location: 'Mexico Gateway',
        time: 2000,
        description: 'Local Format Conversion',
        details: 'Converting ISO 20022 to Mexican SPEI format',
        useRealAPI: true
      },
      {
        from: 'SPEI',
        to: 'JSON',
        location: 'Mexico Processing',
        time: 1500,
        description: 'Normalize to Universal',
        details: 'Converting SPEI to canonical JSON for crypto bridge',
        useRealAPI: true
      },
      {
        from: 'JSON',
        to: 'USDC',
        location: 'Crypto Bridge',
        time: 3000,
        description: 'Fiat to Stablecoin',
        details: 'Converting $50,000 to USDC on Polygon for 25 wallets',
        useRealAPI: true,
        cryptoDetails: {
          network: 'Polygon',
          gasEstimate: '$0.50',
          walletCount: 25,
          avgAmount: '$2000',
          settlementTime: '~10 seconds',
          traditionalTime: '2-3 days',
          costSavings: '88%'
        }
      }
    ],
    totalTime: 10000,
    // Sample MT103 message for Indian payroll
    sampleMessage: `{1:F01ICICINBBXXXX0000000000}{2:I103CHASUS33XXXXN}{3:{108:PAYROLL}}{4:
:20:PAYROLL202412
:23B:CRED
:32A:241215USD50000,00
:50K:/IN987654321012345678
TECHCORP INDIA PVT LTD
PLOT 45 TECH PARK
MUMBAI MAHARASHTRA 400001
INDIA
:52A:ICICINBBXXX
:53A:CHASUS33XXX
:59:/MX123456789012345678
PAYROLL SERVICES MEXICO SA
AV REFORMA 250
MEXICO CITY 06600
MEXICO
:70:MONTHLY PAYROLL DECEMBER 2024
REMOTE ENGINEERING TEAM
25 EMPLOYEES
:71A:SHA
:72:/ACC/PAYROLL PROCESSING
/REC/DISTRIBUTE TO WALLETS
-}`,
    useRealAPI: true,
    mongoDbAdvantages: {
      title: '🍃 MongoDB: Bridging Traditional & Digital Finance',
      message: "MongoDB seamlessly handles both traditional (MT103, SPEI) and blockchain formats (USDC). The same universal JSON structure processes payroll from Indian banks to Mexican wallets, with AI extracting complex remittance data in real-time."
    },
    pipelineStory: {
      source: 'Traditional MT103 bank transfer from India for payroll',
      mongodb: 'JSON seamlessly bridges banking and blockchain worlds',
      target: 'Distributed as USDC tokens to 25 employee wallets',
      story: 'MongoDB proves that traditional banking and blockchain can speak the same language. One JSON format handles both worlds effortlessly.'
    },
    mongodbConfig: {
      bridge: {
        title: 'TradFi to DeFi Bridge',
        from: 'MT103 (India)',
        through: 'JSON → pacs.008 → SPEI → JSON → USDC',
        to: 'USDC (Polygon)',
        description: 'Seamless traditional to blockchain conversion'
      },
      mapping: {
        totalFields: 65,
        rulesLane: 52,
        aiLane: 10,
        humanLane: 3,
        examples: [
          { source: 'MT103:50K', target: 'JSON.employer', type: 'rules', description: 'Company details' },
          { source: 'MT103:70', target: 'JSON.payroll_info', type: 'ai', description: 'Extract employee count' },
          { source: 'JSON.amount', target: 'USDC.total_value', type: 'rules', description: 'Fiat to crypto' },
          { source: 'JSON.payroll_info', target: 'USDC.wallet_distribution', type: 'ai', description: 'Split calculation' }
        ]
      },
      conversion: {
        steps: [
          { step: 1, action: 'MT103→JSON', time: '1.5s', details: 'Parse payroll data with AI' },
          { step: 2, action: 'JSON→pacs.008', time: '40ms', details: 'ISO 20022 creation' },
          { step: 3, action: 'pacs.008→SPEI', time: '1.2s', details: 'Mexican format + AI' },
          { step: 4, action: 'SPEI→JSON', time: '1.1s', details: 'Normalize for crypto' },
          { step: 5, action: 'JSON→USDC', time: '2.5s', details: 'Blockchain preparation' }
        ],
        totalTime: '6.34s'
      },
      metrics: {
        accuracy: '99.2%',
        straightThrough: '88%',
        aiConfidence: '82%',
        costSaving: '88%',
        setupTime: '12 seconds',
        gasEfficiency: '95%',
        walletSuccess: '100%'
      },
      insights: {
        key: 'Cross-Platform Innovation',
        value: 'MongoDB handles both SWIFT messages and blockchain smart contracts with the same JSON core',
        impact: 'Payroll costs reduced by 88% while settlement time drops from 3 days to 10 seconds'
      }
    }
  }
};

// Helper function to get all scenarios as array
export const getAllScenarios = () => Object.values(SIMPLIFIED_SCENARIOS);

// Helper function to get scenario by ID
export const getScenarioById = (id) => SIMPLIFIED_SCENARIOS[id] || null;