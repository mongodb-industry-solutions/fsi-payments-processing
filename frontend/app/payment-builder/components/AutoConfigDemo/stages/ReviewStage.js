'use client';

import { useState } from 'react';
import styles from './ReviewStage.module.css';

export default function ReviewStage({
  configResult,
  onApprove,
  onReject
}) {
  const [corrections, setCorrections] = useState({});
  const [showDetails, setShowDetails] = useState(false);

  const handleCorrection = (fieldName, newMapping) => {
    setCorrections({
      ...corrections,
      [fieldName]: newMapping
    });
  };

  const handleApprove = () => {
    onApprove(Object.keys(corrections).length > 0 ? corrections : null);
  };

  // Calculate stats
  const totalFields = configResult?.fields_detected || 0;
  const mappedFields = configResult?.fields_mapped || 0;
  const uncertainFields = configResult?.uncertain_fields || [];
  const confidence = configResult?.confidence || 0;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Configuration Review</h3>
        <div className={styles.configId}>
          ID: {configResult?.configuration_id}
        </div>
      </div>

      {/* Overall Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>📊</div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{(confidence * 100).toFixed(0)}%</div>
            <div className={styles.statLabel}>Overall Confidence</div>
          </div>
        </div>
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
          <div className={styles.statIcon}>⚠️</div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{uncertainFields.length}</div>
            <div className={styles.statLabel}>Need Review</div>
          </div>
        </div>
      </div>

      {/* Uncertain Fields Review */}
      {uncertainFields.length > 0 && (
        <div className={styles.reviewSection}>
          <h4>Fields Requiring Review</h4>
          <p className={styles.reviewDescription}>
            These fields have lower confidence and may benefit from manual correction.
          </p>
          <div className={styles.uncertainFieldsList}>
            {uncertainFields.map((field) => (
              <div key={field.field} className={styles.uncertainField}>
                <div className={styles.fieldHeader}>
                  <span className={styles.fieldName}>{field.field}</span>
                  <span className={styles.fieldConfidence}>
                    Confidence: {(field.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <div className={styles.fieldMapping}>
                  <div className={styles.mappingRow}>
                    <label>AI Suggested:</label>
                    <code className={styles.mappingValue}>
                      {field.suggested_mapping || 'Unknown'}
                    </code>
                  </div>
                  <div className={styles.mappingRow}>
                    <label>Correct To:</label>
                    <input
                      type="text"
                      className={styles.correctionInput}
                      placeholder="Enter correct mapping..."
                      defaultValue={field.suggested_mapping}
                      onChange={(e) => handleCorrection(field.field, e.target.value)}
                    />
                  </div>
                </div>
                {field.reason && (
                  <div className={styles.fieldReason}>
                    <span className={styles.reasonIcon}>ℹ️</span>
                    {field.reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Configuration Details (collapsible) */}
      <div className={styles.detailsSection}>
        <button
          className={styles.toggleDetails}
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? '▼' : '▶'} Configuration Details
        </button>
        {showDetails && (
          <div className={styles.configDetails}>
            <pre>{JSON.stringify(configResult?.configuration, null, 2)}</pre>
          </div>
        )}
      </div>

      {/* Learning Note */}
      <div className={styles.learningNote}>
        <div className={styles.noteIcon}>🧠</div>
        <div className={styles.noteContent}>
          <strong>Machine Learning Active:</strong> Your corrections will improve future
          configurations for similar formats. The system learns from every review.
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <button
          className={styles.rejectButton}
          onClick={onReject}
        >
          Cancel Configuration
        </button>
        <button
          className={styles.approveButton}
          onClick={handleApprove}
        >
          {Object.keys(corrections).length > 0
            ? 'Apply Corrections & Save'
            : 'Approve Configuration'
          }
        </button>
      </div>
    </div>
  );
}