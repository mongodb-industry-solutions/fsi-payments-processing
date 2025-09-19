import { useEffect, useState } from 'react';
import styles from './ConfidenceTracker.module.css';

export default function ConfidenceTracker({ executionResult, isProcessing }) {
  const [animatedConfidence, setAnimatedConfidence] = useState(0);
  const [fieldScores, setFieldScores] = useState({});

  useEffect(() => {
    if (executionResult || isProcessing) {
      const targetConfidence = executionResult?.conversion_metadata?.confidence_scores?.overall
        ? executionResult.conversion_metadata.confidence_scores.overall * 100
        : 92;

      // Animate confidence value
      let progress = 0;
      const interval = setInterval(() => {
        progress += 0.02;
        if (progress >= 1) {
          setAnimatedConfidence(targetConfidence);
          clearInterval(interval);
        } else {
          setAnimatedConfidence(targetConfidence * progress);
        }
      }, 30);

      // Set field scores
      if (executionResult?.conversion_metadata?.confidence_scores) {
        const scores = { ...executionResult.conversion_metadata.confidence_scores };
        delete scores.overall;
        setFieldScores(scores);
      } else {
        // Default demo scores
        setFieldScores({
          field_70: 0.85,
          field_72: 0.78,
          field_50: 0.95,
          field_59: 0.98
        });
      }

      return () => clearInterval(interval);
    }
  }, [executionResult, isProcessing]);

  const getConfidenceColor = (score) => {
    if (score >= 90) return styles.highConfidence;
    if (score >= 80) return styles.mediumConfidence;
    return styles.lowConfidence;
  };

  const getConfidenceLabel = (score) => {
    if (score >= 90) return 'High';
    if (score >= 80) return 'Medium';
    return 'Low';
  };

  return (
    <div className={styles.confidenceContainer}>
      {/* Overall Confidence Meter */}
      <div className={styles.overallSection}>
        <h4>Overall Confidence</h4>
        <div className={styles.meterContainer}>
          <div className={styles.meter}>
            <div
              className={`${styles.meterFill} ${getConfidenceColor(animatedConfidence)}`}
              style={{ width: `${animatedConfidence}%` }}
            />
            <div className={styles.meterMarkers}>
              <span style={{ left: '80%' }} />
              <span style={{ left: '90%' }} />
            </div>
          </div>
          <div className={styles.meterLabels}>
            <span>0%</span>
            <span>80%</span>
            <span>90%</span>
            <span>100%</span>
          </div>
        </div>

        <div className={styles.scoreDisplay}>
          <span className={styles.scoreValue}>{animatedConfidence.toFixed(1)}%</span>
          <span className={`${styles.scoreLabel} ${getConfidenceColor(animatedConfidence)}`}>
            {getConfidenceLabel(animatedConfidence)}
          </span>
        </div>
      </div>

      {/* Field-level Confidence */}
      <div className={styles.fieldsSection}>
        <h4>Field Confidence Scores</h4>
        <div className={styles.fieldsList}>
          {Object.entries(fieldScores).map(([field, score]) => {
            const percentage = score * 100;
            return (
              <div key={field} className={styles.fieldItem}>
                <div className={styles.fieldHeader}>
                  <span className={styles.fieldName}>{field}</span>
                  <span className={`${styles.fieldScore} ${getConfidenceColor(percentage)}`}>
                    {percentage.toFixed(0)}%
                  </span>
                </div>
                <div className={styles.fieldBar}>
                  <div
                    className={`${styles.fieldBarFill} ${getConfidenceColor(percentage)}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                {percentage < 80 && (
                  <div className={styles.fieldWarning}>
                    ⚠️ Requires human review
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Confidence Factors */}
      <div className={styles.factorsSection}>
        <h4>Confidence Factors</h4>
        <div className={styles.factorsList}>
          <div className={styles.factor}>
            <span className={styles.factorIcon}>✓</span>
            <span>Pattern match quality</span>
          </div>
          <div className={styles.factor}>
            <span className={styles.factorIcon}>✓</span>
            <span>Field completeness</span>
          </div>
          <div className={styles.factor}>
            <span className={styles.factorIcon}>✓</span>
            <span>Format validation</span>
          </div>
          {animatedConfidence < 90 && (
            <div className={`${styles.factor} ${styles.factorWarning}`}>
              <span className={styles.factorIcon}>!</span>
              <span>AI extraction uncertainty</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}