'use client';

import { useState, useEffect } from 'react';
import Icon from '@leafygreen-ui/icon';
import styles from './AutoConfigBuilder.module.css';
import ConfigInput from './components/ConfigInput/ConfigInput';
import ConfigJourney from './components/ConfigJourney/ConfigJourney';
import FocusControl from './components/FocusControl/FocusControl';
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
    setActiveTab,
    setFocusMode
  } = useAutoConfigBuilder();

  const handleGenerate = async () => {
    await startGeneration();
  };

  const handleInputChange = (field, value) => {
    updateInput(field, value);
  };

  const handleFocusModeChange = (mode) => {
    setFocusMode(mode);
  };

  return (
    <div className={`${styles.container} ${styles[state.focusMode]} ${embedded ? styles.embedded : ''}`}>
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

      {/* Focus Control Bar */}
      <FocusControl
        currentMode={state.focusMode}
        onModeChange={handleFocusModeChange}
      />

      {/* Main Content Area */}
      <div className={styles.mainContent}>
        {/* Configuration Input Panel */}
        <div className={styles.inputPanel}>
          <ConfigInput
            config={state.input}
            status={state.generation.status}
            onChange={handleInputChange}
            onGenerate={handleGenerate}
          />
        </div>

        {/* Configuration Journey Panel */}
        <div className={styles.journeyPanel}>
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
          />
        </div>
      </div>
    </div>
  );
}