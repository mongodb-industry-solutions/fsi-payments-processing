'use client';

import { useState } from 'react';
import Icon from '@leafygreen-ui/icon';
import { palette } from '@leafygreen-ui/palette';
import { Body, Label } from '@leafygreen-ui/typography';
import styles from './ScenarioSidebar.module.css';
import { SIMPLIFIED_SCENARIOS } from '../SimplifiedScenarios';

export default function ScenarioSidebar({ onSelectScenario, selectedScenario, onExecuteScenario, isExecuting, onSelectVariation }) {
  const scenarios = Object.values(SIMPLIFIED_SCENARIOS);
  const [selectedVariationId, setSelectedVariationId] = useState(null);

  // Sort scenarios to put remote island routing at the bottom - commented out for now
  const sortedScenarios = scenarios.sort((a, b) => {
    // if (a.id === 'remote-island-routing') return 1;
    // if (b.id === 'remote-island-routing') return -1;
    return 0;
  });

  // Helper function to extract source and target formats
  const getFormatDisplay = (scenario) => {
    // Helper to shorten format names if too long
    const shortenFormat = (format) => {
      const abbreviations = {
        'TARGET2': 'T2',
        'pacs.008': 'pacs008',
        'pacs.009': 'pacs009',
        'MT103 (SWIFT)': 'MT103',
        'ISO 20022 (pacs.008)': 'pacs008',
        'HSBC London': 'Correspondent'
      };
      return abbreviations[format] || format;
    };

    if (scenario.isRoutingScenario && scenario.routingNodes) {
      // For routing scenarios, use source and destination formats
      const sourceFormat = shortenFormat(scenario.routingNodes.source.format);
      const targetFormat = shortenFormat(scenario.routingNodes.destination.format);
      return `${sourceFormat}→${targetFormat}`;
    } else if (scenario.hops && scenario.hops.length > 0) {
      // For regular scenarios, use first and last hop formats
      const sourceFormat = shortenFormat(scenario.hops[0].format);
      const targetFormat = shortenFormat(scenario.hops[scenario.hops.length - 1].format);
      return `${sourceFormat}→${targetFormat}`;
    }
    // Fallback
    return 'N/A';
  };

  const handleButtonClick = (event, scenario) => {
    event.stopPropagation();
    if (selectedScenario?.id === scenario.id && onExecuteScenario) {
      onExecuteScenario();
    }
  };

  const handleVariationChange = (event, scenario) => {
    event.stopPropagation();
    const variationId = event.target.value;
    setSelectedVariationId(variationId);
    if (onSelectVariation) {
      onSelectVariation(scenario, variationId);
    }
  };

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

        {/* Variation Selector */}
        {scenario.hasVariations && scenario.variations && isSelected && (
          <div className={styles.variationSelector} onClick={(e) => e.stopPropagation()}>
            <select
              className={styles.variationDropdown}
              value={selectedVariationId || scenario.selectedVariation || scenario.variations[0]?.id}
              onChange={(e) => handleVariationChange(e, scenario)}
            >
              {scenario.variations.map(variation => (
                <option key={variation.id} value={variation.id}>
                  {variation.name}
                </option>
              ))}
            </select>
            {(selectedVariationId || scenario.selectedVariation) && (
              <div className={styles.variationInfo}>
                <p className={styles.variationDescription}>
                  {scenario.variations.find(v => v.id === (selectedVariationId || scenario.selectedVariation))?.description}
                </p>
                {scenario.variations.find(v => v.id === (selectedVariationId || scenario.selectedVariation))?.id === 'non-standard' && (
                  <div className={styles.variationBadge}>
                    SELF-HEALING DEMO
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Mini visualization preview */}
        <div className={styles.miniFlow}>
          {scenario.hops && scenario.hops.slice(0, 4).map((hop, idx) => (
            <div key={hop.id} className={styles.miniNode}>
              <span className={styles.miniIcon}>{hop.icon}</span>
              {idx < Math.min(3, scenario.hops.length - 1) && (
                <span className={styles.miniArrow}>→</span>
              )}
            </div>
          ))}
          {scenario.hops && scenario.hops.length > 4 && <span className={styles.moreNodes}>+{scenario.hops.length - 4}</span>}
        </div>

        <div className={styles.scenarioStats}>
          <div className={styles.stat}>
            <svg className={styles.statIcon} width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M2 8H14M8 2C8 2 5 5 5 8C5 11 8 14 8 14M8 2C8 2 11 5 11 8C11 11 8 14 8 14" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            <span className={styles.statValue}>{scenario.hops ? scenario.hops.length : 0}</span>
            <span className={styles.statLabel}>nodes</span>
          </div>
          <div className={styles.stat}>
            <svg className={styles.statIcon} width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 8L6 12L14 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14 8V13C14 14 13 15 12 15H4C3 15 2 14 2 13V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span className={styles.statValue}>{scenario.conversions.length}</span>
            <span className={styles.statLabel}>steps</span>
          </div>
          <div className={styles.stat}>
            <svg className={styles.statIcon} width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L2 8L4 12M12 4L14 8L12 12M9 2L7 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className={styles.statValue}>{getFormatDisplay(scenario)}</span>
            <span className={styles.statLabel}>formats</span>
          </div>
        </div>

        <button
          className={`${styles.launchButton} ${isSelected ? styles.active : ''} ${isExecuting && isSelected ? styles.executing : ''}`}
          onClick={(e) => handleButtonClick(e, scenario)}
          disabled={!isSelected || isExecuting}
        >
          {isExecuting && isSelected ? (
            <>
              <div className={styles.spinner}></div>
              <span>Executing...</span>
            </>
          ) : isSelected ? (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 2L12 8L4 14V2Z" fill="currentColor"/>
              </svg>
              <span>Execute Route</span>
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2V14M2 8H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span>Select Route</span>
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
          Payment Scenarios
        </h3>
        <p className={styles.headerDescription}>
          Select a scenario to visualize the payment journey
        </p>
      </div>

      <div className={styles.scenarioList}>
        {sortedScenarios.map(renderScenarioCard)}
      </div>
    </div>
  );
}