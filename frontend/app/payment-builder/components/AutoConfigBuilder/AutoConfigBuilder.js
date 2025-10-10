'use client';

import { useState, useEffect } from 'react';
import Icon from '@leafygreen-ui/icon';
import styles from './AutoConfigBuilder.module.css';
import ConfigJourney from './components/ConfigJourney/ConfigJourney';
import { useAutoConfigBuilder } from './hooks/useAutoConfigBuilder';

export default function AutoConfigBuilder({
  onClose,
  embedded = false
}) {
  const {
    state,
    updateInput,
    startGeneration,
    updateMapping,
    runValidation,
    saveValidatedConfig,
    fixValidationError,
    setActiveTab
  } = useAutoConfigBuilder();

  const handleGenerate = async () => {
    await startGeneration();
  };

  const handleInputChange = (field, value) => {
    updateInput(field, value);
  };

  return (
    <div className={`${styles.container} ${embedded ? styles.embedded : ''}`}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h2>Auto-Configuration Builder</h2>
          <p>Generate intelligent payment format configurations</p>
        </div>
        {!embedded && (
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            <Icon glyph="X" size="small" />
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className={styles.mainContent}>
        {/* Configuration Journey Panel */}
        <ConfigJourney
          activeTab={state.journey.activeTab}
          generation={state.generation}
          mappings={state.journey.mappings}
          validation={state.journey.validation}
          output={state.journey.output}
          onTabChange={setActiveTab}
          onMappingUpdate={updateMapping}
          onValidate={runValidation}
          onSave={saveValidatedConfig}
          onFixError={fixValidationError}
          inputConfig={state.input}
          inputStatus={state.generation.status}
          onInputChange={handleInputChange}
          onGenerate={handleGenerate}
        />
      </div>
    </div>
  );
}