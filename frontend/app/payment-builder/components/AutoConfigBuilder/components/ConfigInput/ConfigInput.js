'use client';

import { useState, useEffect } from 'react';
import Button from '@leafygreen-ui/button';
import TextInput from '@leafygreen-ui/text-input';
import TextArea from '@leafygreen-ui/text-area';
import { Select, Option } from '@leafygreen-ui/select';
import Banner from '@leafygreen-ui/banner';
import { Body, Label } from '@leafygreen-ui/typography';
import styles from './ConfigInput.module.css';

// Predefined scenarios for quick configuration
const PRESET_SCENARIOS = [
  {
    id: 'mt205_pacs009',
    name: 'MT205 → pacs.009',
    description: 'Financial Institution Transfer with unmapped fields showcase',
    sourceFormat: 'MT205',
    targetFormat: 'pacs.009',
    similarTo: 'MT202',
    sampleMessage: `{1:F01CHASUS33AXXX0000000000}{2:I205DEUTDEFFXXXXN}{3:{108:PRIORITY}}{4:
:20:MT205TEST2024
:21:RELREF20241115
:13C:/CLSTIME/0830+0100
:32A:241215EUR500000,00
:52A:UBSWCHZHXXX
:57A:DEUTDEFFXXX
:58A:/DE98765432109876543210
COBADEFFXXX
:72:/BNF/PRIORITY SETTLEMENT
/INS/SAME DAY VALUE
/ACC/COVER FOR FI TRANSFER
-}`
  },
  {
    id: 'iso8583_0220_cain001',
    name: 'ISO8583_0220 → cain.001',
    description: 'Card Financial Advice Transaction (Offline/Batch)',
    sourceFormat: 'ISO8583_0220',
    targetFormat: 'cain.001',
    similarTo: 'ISO8583_0200',
    sampleMessage: '0220|PAN:4916522800000000|PROC:000000|AMT:12000|CUR:826|DT:1215103045|STAN:123456|REF:BATCH0001234|TERM:TERM0001|MID:MERCHANT123|MERCHANT:STARBUCKS LONDON UK|EXP:2512|ACQ:00000123456|DATA:OFFLINE BATCH SETTLEMENT'
  }
];

export default function ConfigInput({
  config,
  status,
  onChange,
  onGenerate
}) {
  const [selectedScenario, setSelectedScenario] = useState('mt205_pacs009');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [validation, setValidation] = useState({
    isValid: false,
    messages: []
  });

  // Validate input on change
  useEffect(() => {
    const messages = [];
    let isValid = true;

    // Check required fields
    if (!config.sourceFormat) {
      messages.push({ type: 'error', text: 'Source format is required' });
      isValid = false;
    }
    if (!config.targetFormat) {
      messages.push({ type: 'error', text: 'Target format is required' });
      isValid = false;
    }
    if (!config.sampleMessage || config.sampleMessage.trim().length < 10) {
      messages.push({ type: 'error', text: 'Sample message is required (min 10 characters)' });
      isValid = false;
    }

    // Check for valid SWIFT message structure if MT format
    if (config.sourceFormat && config.sourceFormat.startsWith('MT') && config.sampleMessage) {
      if (!config.sampleMessage.includes('{1:') || !config.sampleMessage.includes('{4:')) {
        messages.push({
          type: 'warning',
          text: 'MT messages should include SWIFT blocks {1:}, {2:}, {3:}, {4:}'
        });
      }
    }

    // Info about similar format
    if (config.similarTo) {
      messages.push({
        type: 'info',
        text: `Configuration will be based on ${config.similarTo} patterns`
      });
    }

    setValidation({ isValid, messages });
  }, [config]);

  const getStatusIndicator = () => {
    if (status === 'idle') {
      return {
        class: 'idle',
        icon: '○',
        text: 'Ready to configure'
      };
    }
    if (status === 'generating') {
      return {
        class: 'validating',
        icon: '◐',
        text: 'Generating configuration...'
      };
    }
    if (status === 'complete') {
      return {
        class: 'ready',
        icon: '✓',
        text: 'Configuration generated'
      };
    }
    if (status === 'error') {
      return {
        class: 'error',
        icon: '✗',
        text: 'Generation failed'
      };
    }
    return {
      class: 'idle',
      icon: '○',
      text: 'Ready'
    };
  };

  const handleScenarioChange = (scenarioId) => {
    setSelectedScenario(scenarioId);
    const scenario = PRESET_SCENARIOS.find(s => s.id === scenarioId);
    if (scenario) {
      onChange('sourceFormat', scenario.sourceFormat);
      onChange('targetFormat', scenario.targetFormat);
      onChange('similarTo', scenario.similarTo);
      onChange('sampleMessage', scenario.sampleMessage);
    }
  };

  const handleModeToggle = (customMode) => {
    setIsCustomMode(customMode);
    if (!customMode) {
      // Switching back to preset mode - load first scenario
      handleScenarioChange('mt205_pacs009');
    } else {
      // Switching to custom mode - clear fields
      onChange('sourceFormat', '');
      onChange('targetFormat', 'pacs.008');
      onChange('similarTo', 'MT103');
      onChange('sampleMessage', '');
    }
  };

  const statusInfo = getStatusIndicator();

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h3 className={styles.headerTitle}>Configuration Input</h3>
        <p className={styles.headerDescription}>
          {isCustomMode ? 'Enter your custom format details' : 'Select a preset scenario to generate configuration'}
        </p>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {/* Status Indicator */}
        <div className={`${styles.statusIndicator} ${styles[statusInfo.class]}`}>
          <span className={styles.statusIcon}>{statusInfo.icon}</span>
          <span>{statusInfo.text}</span>
        </div>

        {/* Mode Toggle */}
        <div className={styles.modeToggle}>
          <Button
            variant={!isCustomMode ? 'primary' : 'default'}
            size="default"
            onClick={() => handleModeToggle(false)}
            disabled={status === 'generating'}
            className={styles.modeButton}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={styles.modeIcon}>
              <rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <path d="M2 6h12" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="4" cy="4.5" r="0.5" fill="currentColor"/>
              <circle cx="6" cy="4.5" r="0.5" fill="currentColor"/>
              <circle cx="8" cy="4.5" r="0.5" fill="currentColor"/>
            </svg>
            <span className={styles.buttonText}>Preset Scenarios</span>
          </Button>
          <Button
            variant={isCustomMode ? 'primary' : 'default'}
            size="default"
            onClick={() => handleModeToggle(true)}
            disabled={status === 'generating'}
            className={styles.modeButton}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={styles.modeIcon}>
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span className={styles.buttonText}>Custom Format</span>
          </Button>
        </div>

        {/* Scenario Selector - Only show in preset mode */}
        {!isCustomMode && (
          <div className={styles.formGroup}>
            <label className={styles.label}>
              Quick Start Scenario
            </label>
            <div
              className={styles.scenarioSelector}
              onClick={() => {
                // Cycle to next scenario
                const currentIndex = PRESET_SCENARIOS.findIndex(s => s.id === selectedScenario);
                const nextIndex = (currentIndex + 1) % PRESET_SCENARIOS.length;
                handleScenarioChange(PRESET_SCENARIOS[nextIndex].id);
              }}
            >
              <div className={styles.scenarioContent}>
                <div className={styles.scenarioHeader}>
                  <span className={styles.scenarioName}>
                    {PRESET_SCENARIOS.find(s => s.id === selectedScenario)?.name || 'Select a scenario'}
                  </span>
                  <span className={styles.scenarioCycle}>⟳</span>
                </div>
                <div className={styles.scenarioDescription}>
                  {PRESET_SCENARIOS.find(s => s.id === selectedScenario)?.description || 'Click to cycle through available scenarios'}
                </div>
              </div>
              <div className={styles.scenarioIndicator}>
                {PRESET_SCENARIOS.map((scenario, index) => (
                  <span
                    key={scenario.id}
                    className={`${styles.indicatorDot} ${selectedScenario === scenario.id ? styles.active : ''}`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Format Selection */}
        <div className={styles.formatRow}>
          <div className={styles.formGroup}>
            <TextInput
              label="Source Format"
              description={isCustomMode ? 'Enter any payment format name' : 'Preset format from selected scenario'}
              value={config.sourceFormat || ''}
              onChange={(e) => onChange('sourceFormat', e.target.value)}
              placeholder={isCustomMode ? "e.g., MT940, pain.001, ISO8583_0220" : "e.g., MT192"}
              disabled={status === 'generating'}
              state={!isCustomMode ? 'none' : 'none'}
              aria-label="Source Format"
            />
          </div>

          <div className={styles.formGroup}>
            {isCustomMode ? (
              <Select
                label="Target Format"
                description="Select target format from dropdown"
                value={config.targetFormat || 'pacs.008'}
                onChange={(value) => onChange('targetFormat', value)}
                disabled={status === 'generating'}
                aria-label="Target Format"
              >
                <Option value="pacs.008">pacs.008 - Credit Transfer</Option>
                <Option value="pacs.009">pacs.009 - FI Credit Transfer</Option>
                <Option value="pacs.004">pacs.004 - Payment Return</Option>
                <Option value="cain.001">cain.001 - Card Acquirer</Option>
                <Option value="JSON">JSON - Canonical Format</Option>
                <Option value="TARGET2">TARGET2 - ECB System</Option>
                <Option value="CHAPS">CHAPS - UK Clearing</Option>
              </Select>
            ) : (
              <TextInput
                label="Target Format"
                description="Preset format from selected scenario"
                value={config.targetFormat || ''}
                onChange={(e) => onChange('targetFormat', e.target.value)}
                placeholder="e.g., pacs.008"
                disabled={status === 'generating'}
                aria-label="Target Format"
              />
            )}
          </div>
        </div>

        {/* Similar To - Only in custom mode */}
        {isCustomMode && (
          <div className={styles.formGroup}>
            <Select
              label="Similar To"
              description="Select a similar format to help with pattern matching"
              value={config.similarTo || 'MT103'}
              onChange={(value) => onChange('similarTo', value)}
              disabled={status === 'generating'}
              aria-label="Similar To Format"
            >
              <Option value="MT103">MT103 - Wire Transfer</Option>
              <Option value="MT202">MT202 - Bank Transfer</Option>
              <Option value="MT205">MT205 - FI Transfer</Option>
              <Option value="MT">MT - Any SWIFT MT Format</Option>
              <Option value="ISO8583_0200">ISO8583_0200 - Card Auth</Option>
            </Select>
          </div>
        )}

        {/* Sample Message */}
        <div className={styles.formGroup}>
          <TextArea
            label="Sample Message"
            description={isCustomMode
              ? 'Paste your actual payment message for analysis'
              : 'Preset sample message from selected scenario'}
            value={config.sampleMessage || ''}
            onChange={(e) => onChange('sampleMessage', e.target.value)}
            placeholder={isCustomMode
              ? "Paste a sample message in your source format..."
              : "Paste a sample message in the source format..."}
            disabled={status === 'generating'}
            aria-label="Sample Message"
          />
        </div>

        {/* Validation Messages */}
        {validation.messages.length > 0 && (
          <div className={styles.validationContainer}>
            {validation.messages.map((msg, idx) => (
              <Banner
                key={idx}
                variant={msg.type === 'error' ? 'danger' : msg.type === 'warning' ? 'warning' : 'info'}
              >
                {msg.text}
              </Banner>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <Button
          variant="primary"
          size="large"
          onClick={onGenerate}
          disabled={!validation.isValid || status === 'generating'}
          className={styles.generateButton}
        >
          {status === 'generating' ? 'Generating...' : 'Generate Configuration'}
        </Button>

        {status === 'generating' && (
          <div className={styles.progressContainer}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: '60%' }} />
            </div>
            <Body className={styles.progressText}>
              Analyzing message structure...
            </Body>
          </div>
        )}
      </div>
    </div>
  );
}