'use client';

import { useState, useEffect } from 'react';
import styles from './FieldMappingEditor.module.css';

export default function FieldMappingEditor({
  field,
  mapping,
  confidence,
  onUpdate,
  onValidate
}) {
  const [editMode, setEditMode] = useState(false);
  const [localMapping, setLocalMapping] = useState(mapping);
  const [validationStatus, setValidationStatus] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Common pacs.008 target fields for suggestions
  const targetFieldSuggestions = [
    'GrpHdr.MsgId',
    'GrpHdr.CreDtTm',
    'CdtTrfTxInf.PmtId.InstrId',
    'CdtTrfTxInf.PmtId.EndToEndId',
    'CdtTrfTxInf.PmtId.TxId',
    'CdtTrfTxInf.IntrBkSttlmAmt',
    'CdtTrfTxInf.IntrBkSttlmDt',
    'CdtTrfTxInf.ChrgBr',
    'CdtTrfTxInf.Dbtr.Nm',
    'CdtTrfTxInf.DbtrAcct.Id.Othr.Id',
    'CdtTrfTxInf.DbtrAgt.FinInstnId.BICFI',
    'CdtTrfTxInf.CdtrAgt.FinInstnId.BICFI',
    'CdtTrfTxInf.Cdtr.Nm',
    'CdtTrfTxInf.CdtrAcct.Id.Othr.Id',
    'CdtTrfTxInf.RmtInf.Ustrd',
    'CdtTrfTxInf.InstrForCdtrAgt.InstrInf'
  ];

  // Confidence level styling
  const getConfidenceClass = () => {
    if (confidence >= 0.8) return styles.highConfidence;
    if (confidence >= 0.6) return styles.mediumConfidence;
    return styles.lowConfidence;
  };

  const getConfidenceLabel = () => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  const handleSave = () => {
    // Validate the mapping
    if (onValidate) {
      const isValid = onValidate(field.code, localMapping);
      setValidationStatus(isValid ? 'valid' : 'invalid');

      if (isValid) {
        onUpdate(field.code, localMapping);
        setEditMode(false);
      }
    } else {
      onUpdate(field.code, localMapping);
      setEditMode(false);
    }
  };

  const handleCancel = () => {
    setLocalMapping(mapping);
    setEditMode(false);
    setValidationStatus(null);
  };

  const handleSuggestionClick = (suggestion) => {
    setLocalMapping({
      ...localMapping,
      target: suggestion
    });
    setShowSuggestions(false);
  };

  const filteredSuggestions = targetFieldSuggestions.filter(s =>
    s.toLowerCase().includes(localMapping.target?.toLowerCase() || '')
  );

  return (
    <div className={`${styles.fieldMapping} ${editMode ? styles.editing : ''}`}>
      {/* Field Header */}
      <div className={styles.fieldHeader}>
        <div className={styles.fieldInfo}>
          <span className={styles.fieldCode}>{field.code}</span>
          <span className={styles.fieldName}>{field.name}</span>
        </div>
        <div className={styles.fieldMeta}>
          <span className={`${styles.confidenceBadge} ${getConfidenceClass()}`}>
            {getConfidenceLabel()} ({(confidence * 100).toFixed(0)}%)
          </span>
          <span className={`${styles.laneBadge} ${styles[field.lane?.toLowerCase()]}`}>
            {field.lane}
          </span>
        </div>
      </div>

      {/* Field Value Preview */}
      {field.value && (
        <div className={styles.fieldValue}>
          <label>Sample Value:</label>
          <code>{field.value}</code>
        </div>
      )}

      {/* Mapping Section */}
      <div className={styles.mappingSection}>
        {!editMode ? (
          <div className={styles.mappingDisplay}>
            <div className={styles.mappingFlow}>
              <div className={styles.sourceField}>
                <label>Source</label>
                <div className={styles.fieldBox}>{field.code}</div>
              </div>
              <div className={styles.mappingArrow}>
                <svg width="40" height="20" viewBox="0 0 40 20">
                  <path
                    d="M0 10 L30 10 M30 10 L25 5 M30 10 L25 15"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                  />
                </svg>
              </div>
              <div className={styles.targetField}>
                <label>Target</label>
                <div className={styles.fieldBox}>
                  {localMapping.target || 'Not Mapped'}
                </div>
              </div>
            </div>

            {localMapping.transform && (
              <div className={styles.transform}>
                <label>Transform:</label>
                <code>{localMapping.transform}</code>
                {localMapping.transform_config && (
                  <span className={styles.transformConfig}>
                    {JSON.stringify(localMapping.transform_config)}
                  </span>
                )}
              </div>
            )}

            <button
              className={styles.editButton}
              onClick={() => setEditMode(true)}
            >
              Edit Mapping
            </button>
          </div>
        ) : (
          <div className={styles.mappingEditor}>
            <div className={styles.editorField}>
              <label>Target Field:</label>
              <div className={styles.suggestionWrapper}>
                <input
                  type="text"
                  value={localMapping.target || ''}
                  onChange={(e) => {
                    setLocalMapping({...localMapping, target: e.target.value});
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Enter target field path..."
                  className={styles.targetInput}
                />
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div className={styles.suggestions}>
                    {filteredSuggestions.slice(0, 5).map(suggestion => (
                      <div
                        key={suggestion}
                        className={styles.suggestion}
                        onClick={() => handleSuggestionClick(suggestion)}
                      >
                        {suggestion}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className={styles.editorField}>
              <label>Transform Function:</label>
              <select
                value={localMapping.transform || 'direct'}
                onChange={(e) => setLocalMapping({...localMapping, transform: e.target.value})}
                className={styles.transformSelect}
              >
                <option value="direct">Direct Copy</option>
                <option value="date_format">Date Format</option>
                <option value="amount_format">Amount Format</option>
                <option value="uppercase">Uppercase</option>
                <option value="extract_regex">Extract with Regex</option>
                <option value="ai_extract">AI Extract</option>
              </select>
            </div>

            {localMapping.transform === 'date_format' && (
              <div className={styles.transformOptions}>
                <input
                  type="text"
                  placeholder="Input format (e.g., %y%m%d)"
                  value={localMapping.transform_config?.input_format || ''}
                  onChange={(e) => setLocalMapping({
                    ...localMapping,
                    transform_config: {
                      ...localMapping.transform_config,
                      input_format: e.target.value
                    }
                  })}
                />
                <input
                  type="text"
                  placeholder="Output format (e.g., %Y-%m-%d)"
                  value={localMapping.transform_config?.output_format || ''}
                  onChange={(e) => setLocalMapping({
                    ...localMapping,
                    transform_config: {
                      ...localMapping.transform_config,
                      output_format: e.target.value
                    }
                  })}
                />
              </div>
            )}

            {validationStatus === 'invalid' && (
              <div className={styles.validationError}>
                ⚠️ Invalid mapping. Please check the target field path.
              </div>
            )}

            <div className={styles.editorActions}>
              <button className={styles.cancelButton} onClick={handleCancel}>
                Cancel
              </button>
              <button className={styles.saveButton} onClick={handleSave}>
                Save Mapping
              </button>
            </div>
          </div>
        )}
      </div>

      {/* AI Reasoning (if available) */}
      {field.ai_reasoning && (
        <div className={styles.aiReasoning}>
          <div className={styles.reasoningHeader}>
            <span className={styles.aiIcon}>🤖</span>
            AI Reasoning
          </div>
          <p>{field.ai_reasoning}</p>
        </div>
      )}
    </div>
  );
}