'use client';

import { useState } from 'react';
import styles from './SetupStage.module.css';

export default function SetupStage({
  scenario,
  sampleMessage,
  onSampleMessageChange,
  onStart,
  isCustom,
  customConfig,
  onCustomConfigChange
}) {
  const [isEditing, setIsEditing] = useState(false);

  // Example messages for quick load (with AI-processable fields)
  const EXAMPLE_MESSAGES = {
    MT192: {
      format: 'MT192',
      target: 'pacs.009',
      similarTo: 'MT202',
      description: 'Request for Cancellation',
      message: `{1:F01CHASUS33AXXX0000000000}{2:I192DEUTDEFFXXXXN}{4:
:20:CANCEL2024120701
:21:ORIG2024120601
:11S:192
241207
:79:URGENT CANCELLATION REQUEST
ORIGINAL PAYMENT REF ORIG2024120601
AMOUNT USD 75000.00
PLEASE CANCEL AND CONFIRM
CONTACT: OPS@USBANK.COM
-}`
    },
    MT900: {
      format: 'MT900',
      target: 'pacs.009',
      similarTo: 'MT202',
      description: 'Confirmation of Debit',
      message: `{1:F01CHASUS33AXXX0000000000}{2:I900DEUTDEFFXXXXN}{4:
:20:DEBIT2024120701
:21:REF2024120601
:25:US123456789012345678
:32A:241207USD50000,00
:52A:CHASUS33XXX
:86:WIRE TRANSFER DEBIT CONFIRMATION
INVOICE INV-2024-12345
BENEFICIARY: GLOBAL SUPPLIES GMBH
REFERENCE: PO-987654
-}`
    },
    MT910: {
      format: 'MT910',
      target: 'pacs.009',
      similarTo: 'MT202',
      description: 'Confirmation of Credit',
      message: `{1:F01CHASUS33AXXX0000000000}{2:I910DEUTDEFFXXXXN}{4:
:20:CREDIT2024120701
:21:REF2024120601
:25:US123456789012345678
:32A:241207USD50000,00
:52A:CHASUS33XXX
:86:WIRE TRANSFER CREDIT RECEIVED
FROM: ACME CORPORATION
PAYMENT FOR SERVICES RENDERED
CONTRACT NO: SVC-2024-001
-}`
    }
  };

  const loadExample = (exampleKey) => {
    const example = EXAMPLE_MESSAGES[exampleKey];
    handleCustomConfigChange('sourceFormat', example.format);
    handleCustomConfigChange('targetFormat', example.target);
    handleCustomConfigChange('similarTo', example.similarTo);
    handleCustomConfigChange('sampleMessage', example.message);
  };

  const handleCustomConfigChange = (field, value) => {
    onCustomConfigChange({
      ...customConfig,
      [field]: value
    });
  };

  const canStart = isCustom
    ? customConfig.sourceFormat && customConfig.targetFormat && customConfig.sampleMessage
    : sampleMessage;

  if (isCustom) {
    return (
      <div className={styles.container}>
        <div className={styles.customForm}>
          <h3>Configure Custom Format</h3>
          <p className={styles.description}>
            Define your payment format and provide a sample message for analysis.
          </p>

          {/* Load Example Buttons */}
          <div className={styles.examplesSection}>
            <label>Load Example Messages:</label>
            <div className={styles.exampleButtons}>
              {Object.keys(EXAMPLE_MESSAGES).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={styles.exampleButton}
                  onClick={() => loadExample(key)}
                  title={EXAMPLE_MESSAGES[key].description}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Source Format</label>
            <input
              type="text"
              placeholder="e.g., MT192"
              value={customConfig.sourceFormat}
              onChange={(e) => handleCustomConfigChange('sourceFormat', e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Target Format</label>
            <select
              value={customConfig.targetFormat}
              onChange={(e) => handleCustomConfigChange('targetFormat', e.target.value)}
              className={styles.select}
            >
              <option value="pacs.008">pacs.008</option>
              <option value="pacs.009">pacs.009</option>
              <option value="cain.001">cain.001</option>
              <option value="JSON">JSON</option>
              <option value="TARGET2">TARGET2</option>
              <option value="CHAPS">CHAPS</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Similar To</label>
            <select
              value={customConfig.similarTo}
              onChange={(e) => handleCustomConfigChange('similarTo', e.target.value)}
              className={styles.select}
            >
              <option value="MT103">MT103 (Wire Transfer)</option>
              <option value="MT202">MT202 (Bank Transfer)</option>
              <option value="MT205">MT205 (Financial Institution Transfer)</option>
            </select>
            <span className={styles.helpText}>
              Select a format that's similar to help with pattern matching
            </span>
          </div>

          <div className={styles.formGroup}>
            <label>Sample Message</label>
            <textarea
              placeholder="Paste a sample message in your source format..."
              value={customConfig.sampleMessage}
              onChange={(e) => handleCustomConfigChange('sampleMessage', e.target.value)}
              className={styles.textarea}
              rows={12}
            />
          </div>

          <div className={styles.actions}>
            <button
              className={styles.startButton}
              onClick={onStart}
              disabled={!canStart}
            >
              Generate Configuration
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.scenarioInfo}>
        <div className={styles.scenarioHeader}>
          <h3>Scenario Details</h3>
          <div className={styles.formats}>
            <span className={styles.format}>{scenario?.sourceFormat}</span>
            <span className={styles.arrow}>→</span>
            <span className={styles.format}>{scenario?.targetFormat}</span>
          </div>
        </div>

        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <label>Expected Confidence</label>
            <span className={styles.confidence}>{scenario?.confidence}%</span>
          </div>
          <div className={styles.infoItem}>
            <label>Estimated Time</label>
            <span>{scenario?.estimatedTime}</span>
          </div>
          <div className={styles.infoItem}>
            <label>Fields</label>
            <span>{scenario?.fields}</span>
          </div>
          <div className={styles.infoItem}>
            <label>Type</label>
            <span className={styles.badge}>{scenario?.badge}</span>
          </div>
        </div>
      </div>

      <div className={styles.sampleSection}>
        <div className={styles.sampleHeader}>
          <h3>Sample Message</h3>
          <button
            className={styles.editButton}
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? 'Lock' : 'Edit'}
          </button>
        </div>

        <div className={styles.messageContainer}>
          {isEditing ? (
            <textarea
              value={sampleMessage}
              onChange={(e) => onSampleMessageChange(e.target.value)}
              className={styles.messageTextarea}
              spellCheck="false"
            />
          ) : (
            <pre className={styles.messagePreview}>{sampleMessage}</pre>
          )}
        </div>

        <div className={styles.features}>
          <h4>Key Features to Demonstrate:</h4>
          <ul className={styles.featureList}>
            <li>Semantic pattern matching from {scenario?.scenario?.includes('mt192') ? 'MT103' : 'MT202'}</li>
            <li>AI-powered field detection and mapping</li>
            <li>Real-time confidence scoring</li>
            <li>MongoDB change streams for instant updates</li>
          </ul>
        </div>
      </div>

      <div className={styles.actions}>
        <button
          className={styles.startButton}
          onClick={onStart}
          disabled={!canStart}
        >
          <span className={styles.startIcon}>🚀</span>
          Start Auto-Configuration
        </button>
      </div>
    </div>
  );
}