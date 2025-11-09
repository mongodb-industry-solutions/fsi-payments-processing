'use client';

import { useState, useEffect } from 'react';
import Button from '@leafygreen-ui/button';
import TextInput from '@leafygreen-ui/text-input';
import TextArea from '@leafygreen-ui/text-area';
import { Select, Option } from '@leafygreen-ui/select';
import Banner from '@leafygreen-ui/banner';
import Icon from '@leafygreen-ui/icon';
import { Body, Label } from '@leafygreen-ui/typography';
import MessageBrowser from '../MessageBrowser/MessageBrowser';
import { detectFormatFromMessage } from '../../data/messageLibrary';
import styles from './ConfigInput.module.css';

// Predefined scenarios for quick configuration
const PRESET_SCENARIOS = [
  {
    id: 'mt101_pacs008',
    name: 'MT101 → pacs.008',
    description: 'Request for Transfer - Field 70 uses AI for remittance info',
    sourceFormat: 'MT101',
    targetFormat: 'pacs.008',
    sampleMessage: `{1:F01CHASUS33AXXX0000000000}{2:I101DEUTDEFFXXXXN}{4:
:20:BATCH2024120701
:28D:1/1
:50H:/US12345678901234567890
ACME CORPORATION
123 MAIN STREET
NEW YORK NY 10001
:30:241207
:21:TRANS001
:32B:USD50000,00
:50H:/US98765432109876543210
ACME CORPORATION
:59:/DE12345678901234567890
GLOBAL SUPPLIES GMBH
FRANKFURT GERMANY
:70:INVOICE INV-2024-12345
PAYMENT FOR MANUFACTURING SERVICES
CONTRACT NO MFG-2024-789
DELIVERY DATE 2024-12-15
-}`
  },
  {
    id: 'mt204_pacs009',
    name: 'MT204 → pacs.009',
    description: 'Financial Markets Direct Debit - Field 58D uses AI extraction',
    sourceFormat: 'MT204',
    targetFormat: 'pacs.009',
    sampleMessage: `{1:F01CHASUS33AXXX0000000000}{2:I204DEUTDEFFXXXXN}{4:
:19:125000,00
:30:241207
:57A:DEUTDEFFXXX
:58D:/DE98765432109876543210
DEUTSCHE BANK AG
TAUNUSANLAGE 12
60325 FRANKFURT AM MAIN
GERMANY
:72:/BNF/FINANCIAL MARKET SETTLEMENT
/INS/PRIORITY PROCESSING REQUIRED
/ACC/SAME DAY VALUE
-}`
  },
  {
    id: 'mt201_pacs009',
    name: 'MT201 → pacs.009',
    description: 'Multiple FI Transfer - Field 72 uses AI for instructions',
    sourceFormat: 'MT201',
    targetFormat: 'pacs.009',
    sampleMessage: `{1:F01CHASUS33AXXX0000000000}{2:I201DEUTDEFFXXXXN}{4:
:20:MULTI2024120701
:21:RELREF001
:19:250000,00
:30:241207
:57A:DEUTDEFFXXX
:58A:COBADEFFXXX
:72:/BNF/MULTIPLE INSTITUTION TRANSFER
/INS/BATCH PROCESSING REQUESTED
/REC/CONFIRM RECEIPT TO OPS TEAM
-}`
  },
  {
    id: 'mt205_pacs009',
    name: 'MT205 → pacs.009',
    description: 'Financial Institution Transfer with unmapped fields showcase',
    sourceFormat: 'MT205',
    targetFormat: 'pacs.009',
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
  const [isCustomMode, setIsCustomMode] = useState(true); // Default to Custom Format mode
  const [showMessageBrowser, setShowMessageBrowser] = useState(false);
  const [validation, setValidation] = useState({
    isValid: false,
    messages: []
  });

  // Load initial scenario on mount
  useEffect(() => {
    if (!isCustomMode && !config.sourceFormat) {
      const scenario = PRESET_SCENARIOS.find(s => s.id === selectedScenario);
      if (scenario) {
        onChange('sourceFormat', scenario.sourceFormat);
        onChange('targetFormat', scenario.targetFormat);
        onChange('sampleMessage', scenario.sampleMessage);
      }
    }
  }, []);

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

    setValidation({ isValid, messages });
  }, [config]);

  const getStatusIndicator = () => {
    if (status === 'idle') {
      return {
        class: 'idle',
        icon: <Icon glyph="Circle" size="small" />,
        text: 'Ready to configure'
      };
    }
    if (status === 'generating') {
      return {
        class: 'validating',
        icon: <Icon glyph="Refresh" size="small" />,
        text: 'Generating configuration...'
      };
    }
    if (status === 'complete') {
      return {
        class: 'ready',
        icon: <Icon glyph="Checkmark" size="small" />,
        text: 'Configuration generated'
      };
    }
    if (status === 'error') {
      return {
        class: 'error',
        icon: <Icon glyph="X" size="small" />,
        text: 'Generation failed'
      };
    }
    return {
      class: 'idle',
      icon: <Icon glyph="Circle" size="small" />,
      text: 'Ready'
    };
  };

  const handleScenarioChange = (scenarioId) => {
    setSelectedScenario(scenarioId);
    const scenario = PRESET_SCENARIOS.find(s => s.id === scenarioId);
    if (scenario) {
      onChange('sourceFormat', scenario.sourceFormat);
      onChange('targetFormat', scenario.targetFormat);
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
      onChange('sampleMessage', '');
    }
  };

  const handleSelectMessage = (message) => {
    // Auto-fill fields from selected message
    onChange('sourceFormat', message.sourceFormat);
    onChange('sampleMessage', message.sampleMessage);
    // Use first suggested target format if available
    if (message.targetFormats && message.targetFormats.length > 0) {
      onChange('targetFormat', message.targetFormats[0]);
    }
    setShowMessageBrowser(false);
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

        {/* Browse Messages - Only show in custom mode */}
        {isCustomMode && (
          <div className={styles.formGroup}>
            <Button
              variant="default"
              size="default"
              onClick={() => setShowMessageBrowser(true)}
              disabled={status === 'generating'}
              leftGlyph={<Icon glyph="MagnifyingGlass" />}
              className={styles.browseButton}
            >
              Browse Sample Messages
            </Button>
            <p className={styles.browseHint}>
              Browse our collection of sample payment messages to get started quickly
            </p>
          </div>
        )}

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

      {/* Message Browser Modal */}
      <MessageBrowser
        isOpen={showMessageBrowser}
        onClose={() => setShowMessageBrowser(false)}
        onSelectMessage={handleSelectMessage}
      />
    </div>
  );
}