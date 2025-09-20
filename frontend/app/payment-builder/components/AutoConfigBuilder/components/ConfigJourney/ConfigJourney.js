'use client';

import { useState } from 'react';
import styles from './ConfigJourney.module.css';

export default function ConfigJourney({
  activeTab,
  generation,
  mappings,
  validation,
  output,
  onTabChange,
  onMappingUpdate,
  onValidate
}) {
  const tabs = [
    { id: 'flow', label: 'Flow', icon: '⚡', count: generation?.steps?.length || 0 },
    { id: 'mappings', label: 'Mappings', icon: '🔗', count: mappings?.length || 0 },
    { id: 'validation', label: 'Validation', icon: '✓', count: validation?.checks?.length || 0 },
    { id: 'output', label: 'Output', icon: '📄', count: null }
  ];

  const renderEmptyState = () => (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>⚙️</div>
      <div className={styles.emptyTitle}>No Configuration Generated</div>
      <div className={styles.emptyDescription}>
        Enter your configuration requirements in the input panel and click Generate to begin
      </div>
    </div>
  );

  const renderLoadingState = () => (
    <div className={styles.loadingState}>
      <div className={styles.spinner} />
      <div className={styles.loadingText}>Generating Configuration</div>
      <div className={styles.loadingDescription}>
        {generation?.currentStep || 'Analyzing message structure...'}
      </div>
    </div>
  );

  const renderFlowTab = () => {
    if (!generation || !generation.steps) return renderEmptyState();

    return (
      <div className={styles.flowContainer}>
        {generation.steps.map((step, idx) => (
          <div key={idx} className={styles.flowStage}>
            <div className={styles.flowStageHeader}>
              <div className={styles.flowStageIcon}>{step.icon}</div>
              <div className={styles.flowStageTitle}>{step.title}</div>
              <div className={styles.flowStageTime}>{step.duration}</div>
            </div>
            <div className={styles.flowStageContent}>
              {step.description}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderMappingsTab = () => {
    if (!mappings || mappings.length === 0) return renderEmptyState();

    const groupedMappings = {
      rules: mappings.filter(m => m.lane === 'RULES'),
      ai: mappings.filter(m => m.lane === 'AI'),
      human: mappings.filter(m => m.lane === 'HUMAN')
    };

    return (
      <div className={styles.mappingsContainer}>
        {Object.entries(groupedMappings).map(([lane, items]) => (
          items.length > 0 && (
            <div key={lane} className={styles.mappingSection}>
              <div className={styles.mappingSectionHeader}>
                <div className={styles.mappingSectionTitle}>
                  {lane === 'rules' ? 'Rules-Based Mappings' :
                   lane === 'ai' ? 'AI-Processed Fields' :
                   'Human Review Required'}
                </div>
                <div className={styles.mappingSectionCount}>{items.length}</div>
              </div>
              <div className={styles.mappingsList}>
                {items.map((mapping, idx) => (
                  <div key={idx} className={styles.mappingItem}>
                    <div className={styles.mappingSource}>{mapping.source}</div>
                    <div className={styles.mappingArrow}>→</div>
                    <div className={styles.mappingTarget}>{mapping.target}</div>
                    <div className={`${styles.mappingLane} ${styles[lane.toLowerCase()]}`}>
                      {lane}
                    </div>
                    {mapping.confidence && (
                      <div className={styles.mappingConfidence}>
                        {mapping.confidence}%
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        ))}
      </div>
    );
  };

  const renderValidationTab = () => {
    if (!validation) {
      return (
        <div className={styles.validationContainer}>
          <div className={styles.validationHeader}>
            <div className={styles.validationScore}>
              <span className={styles.scoreLabel}>Ready for validation</span>
            </div>
            <button className={styles.validateButton} onClick={onValidate}>
              Run Validation
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.validationContainer}>
        <div className={styles.validationHeader}>
          <div className={styles.validationScore}>
            <span className={styles.scoreLabel}>Validation Score</span>
            <span className={styles.scoreValue}>{validation.score}%</span>
          </div>
          <button className={styles.validateButton} onClick={onValidate}>
            Re-validate
          </button>
        </div>

        <div className={styles.validationResults}>
          {validation.checks?.map((check, idx) => (
            <div key={idx} className={styles.validationCategory}>
              <div className={styles.categoryHeader}>
                <span className={styles.categoryIcon}>{check.icon}</span>
                <span className={styles.categoryTitle}>{check.name}</span>
                <span className={`${styles.categoryStatus} ${styles[check.status]}`}>
                  {check.status}
                </span>
              </div>
              {check.details && (
                <div className={styles.categoryContent}>
                  {check.details}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderOutputTab = () => {
    if (!output) return renderEmptyState();

    return (
      <div className={styles.outputContainer}>
        <div className={styles.outputHeader}>
          <div className={styles.outputTitle}>Generated Configuration</div>
          <div className={styles.outputActions}>
            <button className={styles.outputButton}>Copy</button>
            <button className={styles.outputButton}>Download</button>
          </div>
        </div>
        <div className={styles.outputContent}>
          <pre className={styles.codeBlock}>
            {JSON.stringify(output, null, 2)}
          </pre>
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    if (generation?.status === 'generating') {
      return renderLoadingState();
    }

    switch (activeTab) {
      case 'flow':
        return renderFlowTab();
      case 'mappings':
        return renderMappingsTab();
      case 'validation':
        return renderValidationTab();
      case 'output':
        return renderOutputTab();
      default:
        return renderEmptyState();
    }
  };

  return (
    <div className={styles.container}>
      {/* Tabs Header */}
      <div className={styles.tabsHeader}>
        <div className={styles.tabsList}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              <span className={styles.tabIcon}>{tab.icon}</span>
              {tab.label}
              {tab.count !== null && tab.count > 0 && (
                <span className={styles.tabBadge}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {renderTabContent()}
      </div>
    </div>
  );
}