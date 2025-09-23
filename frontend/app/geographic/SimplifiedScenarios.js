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
-}`
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
    useRealAPI: false
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
    useRealAPI: true
  }
};

// Helper function to get all scenarios as array
export const getAllScenarios = () => Object.values(SIMPLIFIED_SCENARIOS);

// Helper function to get scenario by ID
export const getScenarioById = (id) => SIMPLIFIED_SCENARIOS[id] || null;