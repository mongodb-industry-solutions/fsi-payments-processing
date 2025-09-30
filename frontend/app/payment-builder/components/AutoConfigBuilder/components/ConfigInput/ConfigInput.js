'use client';

import { useState, useEffect } from 'react';
import styles from './ConfigInput.module.css';

// Predefined scenarios for quick configuration
const PRESET_SCENARIOS = [
  {
    id: 'mt205_pacs009',
    name: 'MT205 → pacs.009',
    description: 'Financial Institution Transfer with unmapped fields showcase',
    sourceFormat: 'MT205',
    targetFormat: 'pacs.009',
    similarTo: 'MT',
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
  },
  {
    id: 'custom',
    name: 'Custom Configuration',
    description: 'Enter your own format details',
    sourceFormat: '',
    targetFormat: '',
    similarTo: '',
    sampleMessage: ''
  }
];

export default function ConfigInput({
  config,
  status,
  onChange,
  onGenerate
}) {
  const [selectedScenario, setSelectedScenario] = useState('custom');
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

  const statusInfo = getStatusIndicator();

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h3 className={styles.headerTitle}>Configuration Input</h3>
        <p className={styles.headerDescription}>
          Select a preset scenario or define custom requirements
        </p>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {/* Status Indicator */}
        <div className={`${styles.statusIndicator} ${styles[statusInfo.class]}`}>
          <span className={styles.statusIcon}>{statusInfo.icon}</span>
          <span>{statusInfo.text}</span>
        </div>

        {/* Scenario Selector */}
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

        {/* Format Selection */}
        <div className={styles.formatRow}>
          <div className={styles.formGroup}>
            <label className={styles.label}>
              Source Format
              <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              className={styles.input}
              value={config.sourceFormat || ''}
              onChange={(e) => onChange('sourceFormat', e.target.value)}
              placeholder="e.g., MT192"
              disabled={status === 'generating'}
              readOnly={selectedScenario !== 'custom'}
            />
            <div className={styles.helperText}>
              Format to convert from
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              Target Format
              <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              className={styles.input}
              value={config.targetFormat || ''}
              onChange={(e) => onChange('targetFormat', e.target.value)}
              placeholder="e.g., pacs.008"
              disabled={status === 'generating'}
              readOnly={selectedScenario !== 'custom'}
            />
            <div className={styles.helperText}>
              Format to convert to
            </div>
          </div>
        </div>

        {/* Similar To */}
        <div className={styles.formGroup}>
          <label className={styles.label}>
            Similar To
            {config.similarTo && (
              <span className={styles.similarBadge}>
                ⟳ {config.similarTo}
              </span>
            )}
          </label>
          <select
            className={styles.select}
            value={config.similarTo || ''}
            onChange={(e) => onChange('similarTo', e.target.value)}
            disabled={status === 'generating' || selectedScenario !== 'custom'}
          >
            <option value="">-- Select a similar format (optional) --</option>
            <option value="MT103">MT103 - Customer Credit Transfer</option>
            <option value="MT202">MT202 - Bank-to-Bank Transfer</option>
            <option value="MT205">MT205 - Foreign Exchange</option>
            <option value="ISO8583_0200">ISO8583_0200 - Card Payment</option>
          </select>
          <div className={styles.helperText}>
            Base configuration on an existing format
          </div>
        </div>

        {/* Sample Message */}
        <div className={styles.formGroup}>
          <label className={styles.label}>
            Sample Message
            <span className={styles.required}>*</span>
          </label>
          <textarea
            className={styles.textarea}
            value={config.sampleMessage || ''}
            onChange={(e) => onChange('sampleMessage', e.target.value)}
            placeholder="Paste a sample message in the source format..."
            disabled={status === 'generating'}
            readOnly={selectedScenario !== 'custom'}
          />
          <div className={styles.helperText}>
            Provide a complete sample message for analysis
          </div>
        </div>

        {/* Validation Messages */}
        {validation.messages.length > 0 && (
          <div>
            {validation.messages.map((msg, idx) => (
              <div key={idx} className={`${styles.validationMessage} ${styles[msg.type]}`}>
                <span className={styles.validationIcon}>
                  {msg.type === 'error' ? '⚠' : msg.type === 'warning' ? '!' : 'ⓘ'}
                </span>
                <span>{msg.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <button
          className={`${styles.generateButton} ${status === 'generating' ? styles.loading : ''}`}
          onClick={onGenerate}
          disabled={!validation.isValid || status === 'generating'}
        >
          {status === 'generating' ? '' : 'Generate Configuration'}
        </button>

        {status === 'generating' && (
          <div>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: '60%' }} />
            </div>
            <div className={styles.progressText}>
              Analyzing message structure...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}