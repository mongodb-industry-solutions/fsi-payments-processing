'use client';

import { useState } from 'react';
import styles from './ScenarioSidebar.module.css';
import { SIMPLIFIED_SCENARIOS } from '../SimplifiedScenarios';

export default function ScenarioSidebar({ onSelectScenario, selectedScenario, onExecuteScenario, isExecuting }) {
  const scenarios = Object.values(SIMPLIFIED_SCENARIOS);

  const handleButtonClick = (event, scenario) => {
    event.stopPropagation();
    if (selectedScenario?.id === scenario.id && onExecuteScenario) {
      onExecuteScenario();
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
            <span className={styles.statLabel}>steps</span>
          </div>
          <div className={styles.stat}>
            <svg className={styles.statIcon} width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 4V8L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span className={styles.statValue}>{(scenario.totalTime/1000).toFixed(0)}s</span>
            <span className={styles.statLabel}>duration</span>
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
        {scenarios.map(renderScenarioCard)}
      </div>
    </div>
  );
}