export const WILD_SCENARIOS = {
  grandTour: {
    id: 'grand-tour',
    name: '🌍 The Grand World Tour',
    description: '7-country payment circumnavigation using JSON bridges',
    hops: [
      { id: 'usa', country: 'USA', format: 'MT103', icon: '🇺🇸', city: 'New York' },
      { id: 'uk', country: 'UK', format: 'CHAPS', icon: '🇬🇧', city: 'London' },
      { id: 'france', country: 'France', format: 'TARGET2', icon: '🇫🇷', city: 'Paris' },
      { id: 'germany', country: 'Germany', format: 'pacs.008', icon: '🇩🇪', city: 'Frankfurt' },
      { id: 'switzerland', country: 'Switzerland', format: 'MT103', icon: '🇨🇭', city: 'Zurich' },
      { id: 'japan', country: 'Japan', format: 'MT202', icon: '🇯🇵', city: 'Tokyo' },
      { id: 'singapore', country: 'Singapore', format: 'Universal', icon: '🇸🇬', city: 'Singapore' }
    ],
    conversions: [
      { from: 'MT103', to: 'JSON', location: 'USA', time: 45, description: 'Exit USA format' },
      { from: 'JSON', to: 'CHAPS', location: 'UK', time: 30, description: 'Enter UK system' },
      { from: 'CHAPS', to: 'JSON', location: 'UK', time: 28, description: 'Exit UK format' },
      { from: 'JSON', to: 'TARGET2', location: 'France', time: 35, description: 'Enter EU system' },
      { from: 'TARGET2', to: 'JSON', location: 'France', time: 32, description: 'Bridge to Germany' },
      { from: 'JSON', to: 'pacs.008', location: 'Germany', time: 25, description: 'German domestic' },
      { from: 'pacs.008', to: 'JSON', location: 'Germany', time: 30, description: 'Exit Europe' },
      { from: 'JSON', to: 'MT103', location: 'Switzerland', time: 40, description: 'Swiss banking' },
      { from: 'MT103', to: 'JSON', location: 'Switzerland', time: 35, description: 'Bridge to Asia' },
      { from: 'JSON', to: 'MT202', location: 'Japan', time: 42, description: 'Japanese system' },
      { from: 'MT202', to: 'JSON', location: 'Japan', time: 38, description: 'Final bridge' },
      { from: 'JSON', to: 'Universal', location: 'Singapore', time: 20, description: 'Universal hub' }
    ],
    totalTime: 400,
    complexity: 'extreme'
  },

  impossibleChain: {
    id: 'impossible-chain',
    name: '⚡ The Impossible Chain',
    description: 'Formats with ZERO direct converters - only possible via JSON',
    hops: [
      { id: 'fx', country: 'FX Trading', format: 'MT205', icon: '💱', city: 'Global' },
      { id: 'us-domestic', country: 'US Domestic', format: 'ACH', icon: '🏛️', city: 'New York' },
      { id: 'card', country: 'Card Network', format: 'ISO8583', icon: '💳', city: 'Global' },
      { id: 'uk-clear', country: 'UK Clearing', format: 'CHAPS', icon: '🇬🇧', city: 'London' },
      { id: 'eu-settle', country: 'EU Settlement', format: 'TARGET2', icon: '🇪🇺', city: 'Frankfurt' }
    ],
    conversions: [
      { from: 'MT205', to: 'JSON', location: 'FX Trading', time: 55, description: 'FX to universal' },
      { from: 'JSON', to: 'ACH', location: 'US Domestic', time: 48, description: 'No direct MT205→ACH' },
      { from: 'ACH', to: 'JSON', location: 'US Domestic', time: 42, description: 'Domestic to universal' },
      { from: 'JSON', to: 'ISO8583', location: 'Card Network', time: 65, description: 'No direct ACH→ISO8583' },
      { from: 'ISO8583', to: 'JSON', location: 'Card Network', time: 58, description: 'Card to universal' },
      { from: 'JSON', to: 'CHAPS', location: 'UK Clearing', time: 38, description: 'No direct ISO8583→CHAPS' },
      { from: 'CHAPS', to: 'JSON', location: 'UK Clearing', time: 35, description: 'UK to universal' },
      { from: 'JSON', to: 'TARGET2', location: 'EU Settlement', time: 40, description: 'No direct CHAPS→TARGET2' }
    ],
    totalTime: 381,
    complexity: 'impossible without JSON'
  },

  spiderWeb: {
    id: 'spider-web',
    name: '🕸️ The Spider Web',
    description: 'Singapore JSON hub routing multiple simultaneous conversions',
    hops: [
      { id: 'india', country: 'India', format: 'ACH', icon: '🇮🇳', city: 'Mumbai' },
      { id: 'uae', country: 'UAE', format: 'MT103', icon: '🇦🇪', city: 'Dubai' },
      { id: 'singapore-hub', country: 'Singapore Hub', format: 'JSON', icon: '🇸🇬', city: 'Singapore', isHub: true },
      { id: 'brazil', country: 'Brazil', format: 'pacs.008', icon: '🇧🇷', city: 'São Paulo' },
      { id: 'germany-out', country: 'Germany', format: 'TARGET2', icon: '🇩🇪', city: 'Frankfurt' }
    ],
    conversions: [
      // Incoming to hub
      { from: 'ACH', to: 'JSON', location: 'India→Singapore', time: 45, description: 'India to hub' },
      { from: 'MT103', to: 'JSON', location: 'UAE→Singapore', time: 40, description: 'UAE to hub' },
      // Hub processing
      { from: 'JSON', to: 'JSON', location: 'Singapore Hub', time: 10, description: 'Hub processing' },
      // Outgoing from hub
      { from: 'JSON', to: 'pacs.008', location: 'Singapore→Brazil', time: 55, description: 'Hub to Brazil' },
      { from: 'JSON', to: 'TARGET2', location: 'Singapore→Germany', time: 42, description: 'Hub to Germany' }
    ],
    totalTime: 192,
    complexity: 'hub-and-spoke',
    parallel: true
  },

  timeMachine: {
    id: 'time-machine',
    name: '🚀 The Time Machine',
    description: '50 years of payment evolution bridged by JSON',
    hops: [
      { id: 'legacy', country: '1973 Legacy', format: 'MT103', icon: '📼', city: 'Telex Era' },
      { id: 'classic', country: '1990s Classic', format: 'MT202', icon: '💾', city: 'SWIFT Era' },
      { id: 'modern', country: '2000s Modern', format: 'SWIFT gpi', icon: '💿', city: 'Internet Era' },
      { id: 'current', country: '2020s Current', format: 'ISO20022', icon: '☁️', city: 'Cloud Era' },
      { id: 'future', country: 'Future', format: 'Blockchain', icon: '⛓️', city: 'DLT Era' }
    ],
    conversions: [
      { from: 'MT103', to: 'JSON', location: '1973→Bridge', time: 50, description: 'Legacy extraction' },
      { from: 'JSON', to: 'MT202', location: 'Bridge→1990s', time: 45, description: 'Classic banking' },
      { from: 'MT202', to: 'JSON', location: '1990s→Bridge', time: 40, description: 'Y2K compatible' },
      { from: 'JSON', to: 'SWIFT gpi', location: 'Bridge→2000s', time: 35, description: 'Tracking added' },
      { from: 'SWIFT gpi', to: 'JSON', location: '2000s→Bridge', time: 30, description: 'API ready' },
      { from: 'JSON', to: 'ISO20022', location: 'Bridge→2020s', time: 25, description: 'Rich data' },
      { from: 'ISO20022', to: 'JSON', location: '2020s→Bridge', time: 20, description: 'Future ready' },
      { from: 'JSON', to: 'Blockchain', location: 'Bridge→Future', time: 15, description: 'DLT settlement' }
    ],
    totalTime: 260,
    complexity: 'evolutionary'
  },

  complianceGauntlet: {
    id: 'compliance-gauntlet',
    name: '🛡️ The Compliance Gauntlet',
    description: 'Payment through 5 regulatory zones with field transformations',
    hops: [
      { id: 'usa-fatca', country: 'USA', format: 'MT103', icon: '🇺🇸', city: 'New York', compliance: 'FATCA' },
      { id: 'eu-mifid', country: 'EU', format: 'TARGET2', icon: '🇪🇺', city: 'Brussels', compliance: 'MiFID II' },
      { id: 'swiss-bank', country: 'Switzerland', format: 'MT103', icon: '🇨🇭', city: 'Zurich', compliance: 'Banking Secrecy' },
      { id: 'singapore-mas', country: 'Singapore', format: 'pacs.008', icon: '🇸🇬', city: 'Singapore', compliance: 'MAS Rules' },
      { id: 'dubai', country: 'Dubai', format: 'MT202', icon: '🇦🇪', city: 'Dubai', compliance: 'Dubai Banking' }
    ],
    conversions: [
      { from: 'MT103', to: 'JSON', location: 'USA', time: 50, description: 'Add FATCA fields' },
      { from: 'JSON', to: 'TARGET2', location: 'EU', time: 45, description: 'Add MiFID II data' },
      { from: 'TARGET2', to: 'JSON', location: 'EU', time: 40, description: 'Preserve compliance' },
      { from: 'JSON', to: 'MT103', location: 'Switzerland', time: 55, description: 'Add secrecy wrapper' },
      { from: 'MT103', to: 'JSON', location: 'Switzerland', time: 35, description: 'Maintain privacy' },
      { from: 'JSON', to: 'pacs.008', location: 'Singapore', time: 38, description: 'MAS compliance' },
      { from: 'pacs.008', to: 'JSON', location: 'Singapore', time: 32, description: 'Asia gateway' },
      { from: 'JSON', to: 'MT202', location: 'Dubai', time: 48, description: 'Sharia compliant' }
    ],
    totalTime: 343,
    complexity: 'regulatory'
  },

  lightningNetwork: {
    id: 'lightning-network',
    name: '⚡ The Lightning Network',
    description: 'Parallel processing through multiple routes converging at hub',
    hops: [
      { id: 'source', country: 'USA', format: 'MT103', icon: '🇺🇸', city: 'New York' },
      // Parallel paths
      { id: 'uk-path', country: 'UK Route', format: 'CHAPS', icon: '🇬🇧', city: 'London', parallel: 1 },
      { id: 'eu-path', country: 'EU Route', format: 'TARGET2', icon: '🇪🇺', city: 'Frankfurt', parallel: 2 },
      { id: 'jp-path', country: 'Japan Route', format: 'MT202', icon: '🇯🇵', city: 'Tokyo', parallel: 3 },
      // Convergence
      { id: 'singapore-conv', country: 'Singapore', format: 'JSON Hub', icon: '🇸🇬', city: 'Singapore', isHub: true }
    ],
    conversions: [
      // Split from source
      { from: 'MT103', to: 'JSON', location: 'USA', time: 40, description: 'Initial conversion' },
      // Parallel conversions
      { from: 'JSON', to: 'CHAPS', location: 'UK Route', time: 30, description: 'UK path', parallel: 1 },
      { from: 'JSON', to: 'TARGET2', location: 'EU Route', time: 35, description: 'EU path', parallel: 2 },
      { from: 'JSON', to: 'MT202', location: 'Japan Route', time: 42, description: 'Asia path', parallel: 3 },
      // Converge back to JSON
      { from: 'CHAPS', to: 'JSON', location: 'UK→Singapore', time: 28, description: 'UK merge', parallel: 1 },
      { from: 'TARGET2', to: 'JSON', location: 'EU→Singapore', time: 32, description: 'EU merge', parallel: 2 },
      { from: 'MT202', to: 'JSON', location: 'Japan→Singapore', time: 38, description: 'Asia merge', parallel: 3 },
      // Final hub processing
      { from: 'JSON', to: 'Universal', location: 'Singapore Hub', time: 15, description: 'Hub consolidation' }
    ],
    totalTime: 125, // Parallel execution reduces total time
    complexity: 'parallel',
    parallel: true
  }
};

export const getScenarioById = (id) => {
  return Object.values(WILD_SCENARIOS).find(scenario => scenario.id === id);
};

export const getAllScenarios = () => {
  return Object.values(WILD_SCENARIOS);
};