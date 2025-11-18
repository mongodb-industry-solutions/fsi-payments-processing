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
    formats: 'MT103+JSON',
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
    formats: 'MT103+JSON+Agent',
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
