'use client';

import { useState, useEffect } from 'react';
import styles from './ConfigInput.module.css';

// Predefined scenarios for quick configuration
const PRESET_SCENARIOS = [
  {
    id: 'mt205_pacs009',
    name: 'MT205 → pacs.009',
    description: 'Foreign Exchange to Financial Institution Transfer',
    sourceFormat: 'MT205',
    targetFormat: 'pacs.009',
    similarTo: 'MT202',
    sampleMessage: `{1:F01CHASUS33AXXX0000000000}{2:I205DEUTDEFFXXXXN}{3:{108:FX}}{4:
:20:FX2024001
:21:FXDEAL001
:32A:241215EUR100000,00
:53A:CHASUS33XXX
:57A:DEUTDEFFXXX
:58A:/DE12345678901234567890
BENEFICIARY BANK
:72:/BNF/FX SETTLEMENT
/INS/EUR/USD EXCHANGE
/RATE/1.0850
-}`
  },
  {
    id: 'mt900_camt054',
    name: 'MT900 → camt.054',
    description: 'Debit Confirmation to Bank-to-Customer Debit/Credit Notification',
    sourceFormat: 'MT900',
    targetFormat: 'camt.054',
    similarTo: 'MT103',
    sampleMessage: `{1:F01CHASUS33AXXX0000000000}{2:I900DEUTDEFFXXXXN}{3:{108:DEBIT}}{4:
:20:DEBIT001
:21:REF001
:25:US64209876543210987654
:32A:241215USD50000,00
:52A:CHASUS33XXX
:72:/RFB/INVOICE PAYMENT
/DTL/SUPPLIER PAYMENT
-}`
  },
  {
    id: 'mt202cov_pacs009',
    name: 'MT202COV → pacs.009',
    description: 'Cover Payment to Financial Institution Credit Transfer',
    sourceFormat: 'MT202COV',
    targetFormat: 'pacs.009',
    similarTo: 'MT202',
    sampleMessage: `{1:F01CHASUS33AXXX0000000000}{2:I202DEUTDEFFXXXXN}{3:{108:COVER}}{4:
:20:COV2024001
:21:PAYMENT001
:32A:241215USD75000,00
:52A:CHASUS33XXX
:56A:INTBANKXXX
:57A:DEUTDEFFXXX
:58A:/DE89370400440532013000
BENEFICIARY BANK
:50K:/US64209876543210987654
ORDERING CUSTOMER
1234 MAIN STREET
NEW YORK NY 10001
:59:/DE12345678901234567890
BENEFICIARY NAME
BENEFICIARY ADDRESS
:70:/INV/INVOICE 2024-001
/RFB/PAYMENT FOR GOODS
:72:/BNF/COVER PAYMENT
-}`
  },
  {
    id: 'mt210_camt057',
    name: 'MT210 → camt.057',
    description: 'Notice to Receive to Account Notification',
    sourceFormat: 'MT210',
    targetFormat: 'camt.057',
    similarTo: 'MT103',
    sampleMessage: `{1:F01CHASUS33AXXX0000000000}{2:I210DEUTDEFFXXXXN}{3:{108:NOTICE}}{4:
:20:NOTICE001
:25:US64209876543210987654
:30:241215
:21:TRANS001
:32B:USD50000,00
:50K:ORDERING CUSTOMER
CUSTOMER ADDRESS
:52A:CHASUS33XXX
:56A:DEUTDEFFXXX
-}`
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