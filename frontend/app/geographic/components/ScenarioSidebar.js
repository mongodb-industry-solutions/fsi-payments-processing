'use client';

import { useState } from 'react';
import styles from './ScenarioSidebar.module.css';
import { WILD_SCENARIOS } from '../WildScenarios';

const SIMPLE_SCENARIOS = {
  usToUk: {
    id: 'us-uk-simple',
    name: '🇺🇸→🇬🇧 Transatlantic Transfer',
    description: 'Simple US to UK payment via JSON bridge',
    complexity: 'simple',
    hops: [
      { id: 'usa', country: 'USA', format: 'MT103', icon: '🇺🇸', city: 'New York' },
      { id: 'uk', country: 'UK', format: 'CHAPS', icon: '🇬🇧', city: 'London' }
    ],
    conversions: [
      { from: 'MT103', to: 'JSON', location: 'USA', time: 45, description: 'Parse SWIFT fields' },
      { from: 'JSON', to: 'CHAPS', location: 'UK', time: 35, description: 'Build UK format' }
    ],
    totalTime: 80
  },
  euToJp: {
    id: 'eu-jp-simple',
    name: '🇪🇺→🇯🇵 Europe to Asia',
    description: 'EU TARGET2 to Japan MT202 conversion',
    complexity: 'simple',
    hops: [
      { id: 'germany', country: 'Germany', format: 'TARGET2', icon: '🇩🇪', city: 'Frankfurt' },
      { id: 'japan', country: 'Japan', format: 'MT202', icon: '🇯🇵', city: 'Tokyo' }
    ],
    conversions: [
      { from: 'TARGET2', to: 'JSON', location: 'Germany', time: 40, description: 'Extract EU fields' },
      { from: 'JSON', to: 'MT202', location: 'Japan', time: 42, description: 'Build Japanese format' }
    ],
    totalTime: 82
  },
  tripleHop: {
    id: 'triple-hop',
    name: '🌐 Triple Hop Express',
    description: 'US → UK → Germany in 3 hops',
    complexity: 'moderate',
    hops: [
      { id: 'usa', country: 'USA', format: 'MT103', icon: '🇺🇸', city: 'New York' },
      { id: 'uk', country: 'UK', format: 'CHAPS', icon: '🇬🇧', city: 'London' },
      { id: 'germany', country: 'Germany', format: 'TARGET2', icon: '🇩🇪', city: 'Frankfurt' }
    ],
    conversions: [
      { from: 'MT103', to: 'JSON', location: 'USA', time: 45, description: 'US to Universal' },
      { from: 'JSON', to: 'CHAPS', location: 'UK', time: 35, description: 'Universal to UK' },
      { from: 'CHAPS', to: 'JSON', location: 'UK', time: 32, description: 'UK to Universal' },
      { from: 'JSON', to: 'TARGET2', location: 'Germany', time: 38, description: 'Universal to EU' }
    ],
    totalTime: 150
  }
};

export default function ScenarioSidebar({ onSelectScenario, selectedScenario }) {
  const [activeTab, setActiveTab] = useState('wild');

  const wildScenarios = Object.values(WILD_SCENARIOS);
  const simpleScenarios = Object.values(SIMPLE_SCENARIOS);

  const renderScenarioCard = (scenario) => {
    const isSelected = selectedScenario?.id === scenario.id;

    return (
      <div
        key={scenario.id}
        className={`${styles.scenarioCard} ${isSelected ? styles.selected : ''}`}
        onClick={() => onSelectScenario(scenario)}
      >
        <div className={styles.scenarioHeader}>
          <h4>{scenario.name}</h4>
          <span className={styles.complexityBadge} data-complexity={scenario.complexity}>
            {scenario.complexity}
          </span>
        </div>

        <p className={styles.scenarioDescription}>{scenario.description}</p>

        {/* Mini visualization preview */}
        <div className={styles.miniFlow}>
          {scenario.hops.slice(0, 4).map((hop, idx) => (
            <div key={hop.id} className={styles.miniNode}>
              <span className={styles.miniIcon}>{hop.icon}</span>
              {idx < Math.min(3, scenario.hops.length - 1) && (
                <span className={styles.miniArrow}>→</span>
              )}
            </div>
          ))}
          {scenario.hops.length > 4 && <span className={styles.moreNodes}>+{scenario.hops.length - 4}</span>}
        </div>

        <div className={styles.scenarioStats}>
          <div className={styles.stat}>
            <svg className={styles.statIcon} width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M2 8H14M8 2C8 2 5 5 5 8C5 11 8 14 8 14M8 2C8 2 11 5 11 8C11 11 8 14 8 14" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            <span className={styles.statValue}>{scenario.hops.length}</span>
            <span className={styles.statLabel}>nodes</span>
          </div>
          <div className={styles.stat}>
            <svg className={styles.statIcon} width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 8L6 12L14 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14 8V13C14 14 13 15 12 15H4C3 15 2 14 2 13V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span className={styles.statValue}>{scenario.conversions.length}</span>
            <span className={styles.statLabel}>hops</span>
          </div>
          <div className={styles.stat}>
            <svg className={styles.statIcon} width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 4V8L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span className={styles.statValue}>{scenario.totalTime}ms</span>
            <span className={styles.statLabel}>latency</span>
          </div>
        </div>

        <button className={styles.launchButton}>
          {isSelected ? (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M13 4L6 11L3 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Route Active</span>
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8L13 8M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Execute Route</span>
            </>
          )}
        </button>
      </div>
    );
  };

  return (
    <div className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <h3>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="5" cy="5" r="2" fill="currentColor"/>
            <circle cx="15" cy="15" r="2" fill="currentColor"/>
            <path d="M7 5H13C14 5 15 6 15 7V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="10" cy="10" r="1" fill="currentColor" opacity="0.5"/>
          </svg>
          Payment Routes
        </h3>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'wild' ? styles.active : ''}`}
          onClick={() => setActiveTab('wild')}
        >
          Complex Routes ({wildScenarios.length})
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'simple' ? styles.active : ''}`}
          onClick={() => setActiveTab('simple')}
        >
          Simple Routes ({simpleScenarios.length})
        </button>
      </div>

      <div className={styles.scenarioList}>
        {activeTab === 'wild' &&
          wildScenarios.map(renderScenarioCard)
        }
        {activeTab === 'simple' &&
          simpleScenarios.map(renderScenarioCard)
        }
      </div>
    </div>
  );
}