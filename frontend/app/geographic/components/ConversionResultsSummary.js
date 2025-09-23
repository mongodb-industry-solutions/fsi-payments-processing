'use client';

import { useState } from 'react';
import styles from './ConversionResultsSummary.module.css';

export default function ConversionResultsSummary({ results, onClose }) {
  const [expandedStep, setExpandedStep] = useState(null);

  if (!results || results.length === 0) {
    return null;
  }

  const toggleStep = (stepIndex) => {
    setExpandedStep(expandedStep === stepIndex ? null : stepIndex);
  };

  const formatOutput = (output) => {
    if (!output) return 'No output';

    if (typeof output === 'string') {
      try {
        // Try to parse and format JSON
        const parsed = JSON.parse(output);
        return JSON.stringify(parsed, null, 2);
      } catch {
        // Not JSON, return as is
        return output;
      }
    }

    return JSON.stringify(output, null, 2);
  };

  return (
    <div className={styles.summaryContainer}>
      <div className={styles.header}>
        <h3>Conversion Results Summary</h3>
        <button
          className={styles.closeButton}
          onClick={onClose}
          title="Minimize Results"
        >
          _
        </button>
      </div>

      <div className={styles.stepsContainer}>
        {results.map((result, index) => (
          <div key={index} className={styles.step}>
            <div
              className={styles.stepHeader}
              onClick={() => toggleStep(index)}
            >
              <div className={styles.stepInfo}>
                <span className={styles.stepNumber}>Step {result.step}</span>
                <span className={styles.stepConversion}>
                  {result.from} → {result.to}
                </span>
              </div>

              <div className={styles.stepStats}>
                {result.processingStats && (
                  <>
                    <span className={styles.stat}>
                      Rules: {result.processingStats.rules_lane || 0}
                    </span>
                    <span className={styles.stat}>
                      AI: {result.processingStats.ai_lane || 0}
                    </span>
                  </>
                )}
                <span className={styles.time}>
                  {(result.processingTime || 0).toFixed(2)}s
                </span>
              </div>
            </div>

            {expandedStep === index && (
              <div className={styles.stepContent}>
                {/* Processing Statistics */}
                {result.processingStats && (
                  <div className={styles.statsSection}>
                    <h4>Processing Statistics</h4>
                    <div className={styles.statsGrid}>
                      <div className={styles.statItem}>
                        <span className={styles.label}>Rules Lane:</span>
                        <span className={styles.value}>
                          {result.processingStats.rules_lane || 0} fields
                        </span>
                      </div>
                      <div className={styles.statItem}>
                        <span className={styles.label}>AI Lane:</span>
                        <span className={styles.value}>
                          {result.processingStats.ai_lane || 0} fields
                        </span>
                      </div>
                      <div className={styles.statItem}>
                        <span className={styles.label}>Human Review:</span>
                        <span className={styles.value}>
                          {result.humanReviewRequired ? 'Required' : 'Not Required'}
                        </span>
                      </div>
                      <div className={styles.statItem}>
                        <span className={styles.label}>Processing Time:</span>
                        <span className={styles.value}>
                          {(result.processingTime || 0).toFixed(3)} seconds
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Confidence Scores */}
                {result.confidenceScores && Object.keys(result.confidenceScores).length > 0 && (
                  <div className={styles.confidenceSection}>
                    <h4>AI Field Confidence</h4>
                    <div className={styles.confidenceGrid}>
                      {Object.entries(result.confidenceScores).map(([field, score]) => (
                        <div key={field} className={styles.confidenceItem}>
                          <span className={styles.fieldName}>Field {field}:</span>
                          <div className={styles.confidenceBar}>
                            <div
                              className={styles.confidenceFill}
                              style={{ width: `${score * 100}%` }}
                              data-confidence={score < 0.8 ? 'low' : 'high'}
                            />
                          </div>
                          <span className={styles.confidenceValue}>
                            {(score * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Output */}
                <div className={styles.outputSection}>
                  <h4>Conversion Output</h4>
                  <div className={styles.outputContainer}>
                    <pre className={styles.output}>
                      {formatOutput(result.output)}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className={styles.footer}>
        <div className={styles.totalStats}>
          <span>Total Steps: {results.length}</span>
          <span>
            Total Time: {
              results.reduce((sum, r) => sum + (r.processingTime || 0), 0).toFixed(2)
            }s
          </span>
        </div>
      </div>
    </div>
  );
}