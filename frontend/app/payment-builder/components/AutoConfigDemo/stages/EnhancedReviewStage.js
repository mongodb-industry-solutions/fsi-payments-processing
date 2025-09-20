'use client';

import { useState, useEffect } from 'react';
import styles from './EnhancedReviewStage.module.css';
import FieldMappingEditor from '../review/FieldMappingEditor';
import ConfidenceIndicator from '../review/ConfidenceIndicator';
import ConfigurationComparison from '../advanced/ConfigurationComparison';
import LearningFeedback from '../advanced/LearningFeedback';
import ConfigurationExportImport from '../advanced/ConfigurationExportImport';
import GenerationDetailsTab from '../tabs/GenerationDetailsTab';

export default function EnhancedReviewStage({
  configResult,
  generationProgress,
  onApprove,
  onReject
}) {
  const [corrections, setCorrections] = useState({});
  const [showDetails, setShowDetails] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // overview, mappings, validation, generation
  const [validationResults, setValidationResults] = useState({});
  const [isValidating, setIsValidating] = useState(false);

  // Advanced features modals
  const [showComparison, setShowComparison] = useState(false);
  const [showLearningFeedback, setShowLearningFeedback] = useState(false);
  const [showExportImport, setShowExportImport] = useState(false);

  // Parse fields from configuration
  const [detectedFields, setDetectedFields] = useState([]);

  useEffect(() => {
    if (configResult?.configuration) {
      // Extract fields from parser configuration
      const parserFields = configResult.configuration.parser?.fields || {};
      const mappings = configResult.configuration.mappings || [];

      const fields = Object.entries(parserFields).map(([code, fieldConfig]) => {
        const mapping = mappings.find(m => m.source === code) || {};
        const isUncertain = configResult.uncertain_fields?.find(f => f.field === code);

        return {
          code,
          name: fieldConfig.name || code,
          value: fieldConfig.sample || '',
          lane: mapping.processing_lane || 'RULES',
          confidence: isUncertain ? isUncertain.confidence : 0.95,
          mapping: {
            target: mapping.targets?.[0] || mapping.target || '',
            transform: mapping.transform || 'direct',
            transform_config: mapping.transform_config
          },
          ai_reasoning: isUncertain?.reason
        };
      });

      setDetectedFields(fields);
    }
  }, [configResult]);

  const handleFieldUpdate = (fieldCode, newMapping) => {
    setCorrections({
      ...corrections,
      [fieldCode]: newMapping
    });
  };

  const handleFieldValidate = (fieldCode, mapping) => {
    // Simple validation - check if target field looks valid
    const validPaths = [
      'GrpHdr', 'CdtTrfTxInf', 'PmtId', 'IntrBkSttlmAmt',
      'Dbtr', 'Cdtr', 'DbtrAgt', 'CdtrAgt', 'RmtInf'
    ];

    const isValid = validPaths.some(path => mapping.target?.includes(path));

    setValidationResults({
      ...validationResults,
      [fieldCode]: isValid
    });

    return isValid;
  };

  const handleValidateAll = async () => {
    setIsValidating(true);

    // Simulate validation
    setTimeout(() => {
      const results = {};
      detectedFields.forEach(field => {
        results[field.code] = handleFieldValidate(field.code, field.mapping);
      });
      setValidationResults(results);
      setIsValidating(false);
    }, 1500);
  };

  const handleApprove = () => {
    const finalCorrections = Object.keys(corrections).length > 0 ? corrections : null;

    // If there are corrections, show comparison first
    if (finalCorrections) {
      setShowComparison(true);
    } else {
      // No corrections, proceed directly
      onApprove(finalCorrections);
    }
  };

  const handleComparisonAccept = () => {
    setShowComparison(false);
    setShowLearningFeedback(true);
  };

  const handleLearningFeedbackClose = () => {
    setShowLearningFeedback(false);
    const finalCorrections = Object.keys(corrections).length > 0 ? corrections : null;
    onApprove(finalCorrections);
  };

  // Calculate stats
  const totalFields = configResult?.fields_detected || detectedFields.length;
  const mappedFields = configResult?.fields_mapped || detectedFields.filter(f => f.mapping.target).length;
  const uncertainFields = configResult?.uncertain_fields || [];
  const confidence = configResult?.confidence || 0;

  // Group fields by confidence level
  const highConfidenceFields = detectedFields.filter(f => f.confidence >= 0.8);
  const mediumConfidenceFields = detectedFields.filter(f => f.confidence >= 0.6 && f.confidence < 0.8);
  const lowConfidenceFields = detectedFields.filter(f => f.confidence < 0.6);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <h3>Configuration Review & Approval</h3>
          <div className={styles.configId}>
            Configuration: <span>{configResult?.configuration_id}</span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.exportImportButton}
            onClick={() => setShowExportImport(true)}
            title="Export/Import Configuration"
          >
            📤 Export / Import
          </button>
          <ConfidenceIndicator
            confidence={confidence}
            label="Overall Confidence"
            size="large"
            animated
          />
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'overview' ? styles.active : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <span className={styles.tabIcon}>📊</span>
          Overview
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'mappings' ? styles.active : ''}`}
          onClick={() => setActiveTab('mappings')}
        >
          <span className={styles.tabIcon}>🔗</span>
          Field Mappings
          {Object.keys(corrections).length > 0 && (
            <span className={styles.badge}>{Object.keys(corrections).length}</span>
          )}
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'validation' ? styles.active : ''}`}
          onClick={() => setActiveTab('validation')}
        >
          <span className={styles.tabIcon}>✅</span>
          Validation
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'generation' ? styles.active : ''}`}
          onClick={() => setActiveTab('generation')}
        >
          <span className={styles.tabIcon}>📊</span>
          Generation Details
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className={styles.overview}>
            {/* Stats Grid */}
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>🔍</div>
                <div className={styles.statContent}>
                  <div className={styles.statValue}>{totalFields}</div>
                  <div className={styles.statLabel}>Fields Detected</div>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>✅</div>
                <div className={styles.statContent}>
                  <div className={styles.statValue}>{mappedFields}</div>
                  <div className={styles.statLabel}>Fields Mapped</div>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>🤖</div>
                <div className={styles.statContent}>
                  <div className={styles.statValue}>
                    {detectedFields.filter(f => f.lane === 'AI').length}
                  </div>
                  <div className={styles.statLabel}>AI Processed</div>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>⚠️</div>
                <div className={styles.statContent}>
                  <div className={styles.statValue}>{uncertainFields.length}</div>
                  <div className={styles.statLabel}>Need Review</div>
                </div>
              </div>
            </div>

            {/* Confidence Breakdown */}
            <div className={styles.confidenceBreakdown}>
              <h4>Confidence Distribution</h4>
              <div className={styles.confidenceGroups}>
                <div className={styles.confidenceGroup}>
                  <div className={styles.groupHeader}>
                    <span className={`${styles.groupIndicator} ${styles.high}`} />
                    <span className={styles.groupLabel}>High Confidence</span>
                    <span className={styles.groupCount}>{highConfidenceFields.length}</span>
                  </div>
                  <div className={styles.groupFields}>
                    {highConfidenceFields.slice(0, 3).map(field => (
                      <span key={field.code} className={styles.fieldChip}>
                        {field.code}
                      </span>
                    ))}
                    {highConfidenceFields.length > 3 && (
                      <span className={styles.fieldMore}>
                        +{highConfidenceFields.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                <div className={styles.confidenceGroup}>
                  <div className={styles.groupHeader}>
                    <span className={`${styles.groupIndicator} ${styles.medium}`} />
                    <span className={styles.groupLabel}>Medium Confidence</span>
                    <span className={styles.groupCount}>{mediumConfidenceFields.length}</span>
                  </div>
                  <div className={styles.groupFields}>
                    {mediumConfidenceFields.slice(0, 3).map(field => (
                      <span key={field.code} className={styles.fieldChip}>
                        {field.code}
                      </span>
                    ))}
                  </div>
                </div>

                <div className={styles.confidenceGroup}>
                  <div className={styles.groupHeader}>
                    <span className={`${styles.groupIndicator} ${styles.low}`} />
                    <span className={styles.groupLabel}>Low Confidence</span>
                    <span className={styles.groupCount}>{lowConfidenceFields.length}</span>
                  </div>
                  <div className={styles.groupFields}>
                    {lowConfidenceFields.map(field => (
                      <span key={field.code} className={`${styles.fieldChip} ${styles.warning}`}>
                        {field.code}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Preview Changes Button */}
            {Object.keys(corrections).length > 0 && (
              <div className={styles.previewSection}>
                <button
                  className={styles.previewButton}
                  onClick={() => setShowComparison(true)}
                >
                  <span>🔍</span>
                  Preview Changes ({Object.keys(corrections).length} corrections)
                </button>
              </div>
            )}

            {/* Processing Stats */}
            <div className={styles.processingStats}>
              <h4>Processing Statistics</h4>
              <div className={styles.statRows}>
                <div className={styles.statRow}>
                  <span className={styles.statName}>Generation Time</span>
                  <span className={styles.statVal}>
                    {configResult?.generation_time_seconds?.toFixed(2)}s
                  </span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statName}>Based On</span>
                  <span className={styles.statVal}>
                    {configResult?.configuration?.metadata?.based_on || 'N/A'}
                  </span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statName}>Auto-Generated</span>
                  <span className={styles.statVal}>
                    {configResult?.configuration?.metadata?.auto_generated ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mappings Tab */}
        {activeTab === 'mappings' && (
          <div className={styles.mappings}>
            <div className={styles.mappingsHeader}>
              <h4>Field Mappings Review</h4>
              <p>Review and correct field mappings. Focus on low-confidence fields marked for review.</p>
            </div>

            {/* Low confidence fields first */}
            {lowConfidenceFields.length > 0 && (
              <div className={styles.fieldSection}>
                <h5 className={styles.sectionTitle}>
                  <span className={styles.warningIcon}>⚠️</span>
                  Requires Review
                </h5>
                {lowConfidenceFields.map(field => (
                  <FieldMappingEditor
                    key={field.code}
                    field={field}
                    mapping={field.mapping}
                    confidence={field.confidence}
                    onUpdate={handleFieldUpdate}
                    onValidate={handleFieldValidate}
                  />
                ))}
              </div>
            )}

            {/* Medium confidence fields */}
            {mediumConfidenceFields.length > 0 && (
              <div className={styles.fieldSection}>
                <h5 className={styles.sectionTitle}>Optional Review</h5>
                {mediumConfidenceFields.map(field => (
                  <FieldMappingEditor
                    key={field.code}
                    field={field}
                    mapping={field.mapping}
                    confidence={field.confidence}
                    onUpdate={handleFieldUpdate}
                    onValidate={handleFieldValidate}
                  />
                ))}
              </div>
            )}

            {/* High confidence fields */}
            {highConfidenceFields.length > 0 && (
              <div className={styles.fieldSection}>
                <h5 className={styles.sectionTitle}>High Confidence</h5>
                {highConfidenceFields.map(field => (
                  <FieldMappingEditor
                    key={field.code}
                    field={field}
                    mapping={field.mapping}
                    confidence={field.confidence}
                    onUpdate={handleFieldUpdate}
                    onValidate={handleFieldValidate}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Validation Tab */}
        {activeTab === 'validation' && (
          <div className={styles.validation}>
            <div className={styles.validationHeader}>
              <h4>Configuration Validation</h4>
              <button
                className={styles.validateButton}
                onClick={handleValidateAll}
                disabled={isValidating}
              >
                {isValidating ? 'Validating...' : 'Run Validation'}
              </button>
            </div>

            <div className={styles.validationResults}>
              {Object.keys(validationResults).length > 0 ? (
                <>
                  <div className={styles.validationSummary}>
                    <div className={styles.summaryItem}>
                      <span className={styles.passIcon}>✅</span>
                      <span>
                        {Object.values(validationResults).filter(v => v).length} Passed
                      </span>
                    </div>
                    <div className={styles.summaryItem}>
                      <span className={styles.failIcon}>❌</span>
                      <span>
                        {Object.values(validationResults).filter(v => !v).length} Failed
                      </span>
                    </div>
                  </div>

                  <div className={styles.validationList}>
                    {Object.entries(validationResults).map(([fieldCode, isValid]) => (
                      <div
                        key={fieldCode}
                        className={`${styles.validationItem} ${isValid ? styles.pass : styles.fail}`}
                      >
                        <span className={styles.validationIcon}>
                          {isValid ? '✅' : '❌'}
                        </span>
                        <span className={styles.validationField}>{fieldCode}</span>
                        <span className={styles.validationStatus}>
                          {isValid ? 'Valid' : 'Invalid mapping'}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className={styles.validationEmpty}>
                  <p>Click "Run Validation" to check all field mappings</p>
                </div>
              )}
            </div>

            {/* Configuration Details */}
            <div className={styles.detailsSection}>
              <button
                className={styles.toggleDetails}
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? '▼' : '▶'} Raw Configuration
              </button>
              {showDetails && (
                <div className={styles.configDetails}>
                  <pre>{JSON.stringify(configResult?.configuration, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Generation Details Tab */}
        {activeTab === 'generation' && (
          <GenerationDetailsTab
            progress={generationProgress}
            configResult={configResult}
          />
        )}
      </div>

      {/* Learning Note */}
      <div className={styles.learningNote}>
        <div className={styles.noteIcon}>🧠</div>
        <div className={styles.noteContent}>
          <strong>Continuous Learning:</strong> Your corrections improve future configurations.
          The system learns from every review to better handle similar formats.
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <button className={styles.rejectButton} onClick={onReject}>
          Reject Configuration
        </button>
        <div className={styles.primaryActions}>
          {Object.keys(corrections).length > 0 && (
            <div className={styles.correctionCount}>
              {Object.keys(corrections).length} correction(s) pending
            </div>
          )}
          <button className={styles.approveButton} onClick={handleApprove}>
            {Object.keys(corrections).length > 0
              ? `Apply ${Object.keys(corrections).length} Corrections & Save`
              : 'Approve Configuration'
            }
          </button>
        </div>
      </div>

      {/* Advanced Feature Modals */}
      {showComparison && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <ConfigurationComparison
              original={configResult}
              modified={{...configResult, corrections}}
              corrections={corrections}
              onAccept={handleComparisonAccept}
              onReject={() => setShowComparison(false)}
            />
          </div>
        </div>
      )}

      {showLearningFeedback && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <LearningFeedback
              corrections={corrections}
              originalConfig={configResult?.configuration}
              onClose={handleLearningFeedbackClose}
            />
          </div>
        </div>
      )}

      {showExportImport && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <ConfigurationExportImport
              configuration={configResult?.configuration}
              onImport={(imported) => {
                // Handle import - could update the config
                console.log('Imported config:', imported);
                setShowExportImport(false);
              }}
              onClose={() => setShowExportImport(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}