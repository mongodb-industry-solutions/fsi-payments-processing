import { useEffect, useState } from 'react';
import styles from './LaneDistribution.module.css';

export default function LaneDistribution({ executionResult, isProcessing }) {
  const [animatedValues, setAnimatedValues] = useState({
    rules: 0,
    ai: 0,
    human: 0
  });
  const [overallConfidence, setOverallConfidence] = useState(0);

  const defaultDistribution = {
    rules: { percentage: 85, count: 23, fields: ['sender_name', 'amount', 'currency'] },
    ai: { percentage: 10, count: 3, fields: ['field_70', 'field_72'] },
    human: { percentage: 5, count: 1, fields: ['field_unknown'] }
  };

  useEffect(() => {
    if (executionResult || isProcessing) {
      // Animate the values
      const targetValues = executionResult ? {
        rules: executionResult.conversion_metadata?.processing_stats?.rules_lane?.count || 20,
        ai: executionResult.conversion_metadata?.processing_stats?.ai_lane?.count || 3,
        human: executionResult.conversion_metadata?.processing_stats?.human_lane?.count || 1
      } : {
        rules: 23,
        ai: 3,
        human: 1
      };

      const targetConfidence = executionResult?.conversion_metadata?.confidence_scores?.overall
        ? executionResult.conversion_metadata.confidence_scores.overall * 100
        : 92;

      // Animate to target values
      let progress = 0;
      const interval = setInterval(() => {
        progress += 0.05;
        if (progress >= 1) {
          setAnimatedValues(targetValues);
          setOverallConfidence(targetConfidence);
          clearInterval(interval);
        } else {
          setAnimatedValues({
            rules: Math.floor(targetValues.rules * progress),
            ai: Math.floor(targetValues.ai * progress),
            human: Math.floor(targetValues.human * progress)
          });
          setOverallConfidence(targetConfidence * progress);
        }
      }, 50);

      return () => clearInterval(interval);
    }
  }, [executionResult, isProcessing]);

  // Get confidence scores for fields
  const confidenceScores = executionResult?.conversion_metadata?.confidence_scores || {};

  const getFieldConfidence = (field) => {
    if (confidenceScores[field] !== undefined) {
      return confidenceScores[field] * 100;
    }
    return null;
  };

  const getConfidenceColor = (score) => {
    if (score >= 90) return styles.highConfidence;
    if (score >= 80) return styles.mediumConfidence;
    return styles.lowConfidence;
  };

  const distribution = executionResult?.conversion_metadata?.processing_stats ? {
    rules: {
      percentage: (executionResult.conversion_metadata.processing_stats.rules_lane.count /
        (executionResult.conversion_metadata.processing_stats.rules_lane.count +
         executionResult.conversion_metadata.processing_stats.ai_lane.count +
         executionResult.conversion_metadata.processing_stats.human_lane.count)) * 100,
      count: executionResult.conversion_metadata.processing_stats.rules_lane.count,
      fields: executionResult.conversion_metadata.processing_stats.rules_lane.fields || []
    },
    ai: {
      percentage: (executionResult.conversion_metadata.processing_stats.ai_lane.count /
        (executionResult.conversion_metadata.processing_stats.rules_lane.count +
         executionResult.conversion_metadata.processing_stats.ai_lane.count +
         executionResult.conversion_metadata.processing_stats.human_lane.count)) * 100,
      count: executionResult.conversion_metadata.processing_stats.ai_lane.count,
      fields: executionResult.conversion_metadata.processing_stats.ai_lane.fields || []
    },
    human: {
      percentage: (executionResult.conversion_metadata.processing_stats.human_lane.count /
        (executionResult.conversion_metadata.processing_stats.rules_lane.count +
         executionResult.conversion_metadata.processing_stats.ai_lane.count +
         executionResult.conversion_metadata.processing_stats.human_lane.count)) * 100,
      count: executionResult.conversion_metadata.processing_stats.human_lane.count,
      fields: executionResult.conversion_metadata.processing_stats.human_lane.fields || []
    }
  } : defaultDistribution;

  return (
    <div className={styles.laneContainer}>
      {/* Overall Confidence Header */}
      {(executionResult || isProcessing) && (
        <div className={styles.confidenceHeader}>
          <div className={styles.confidenceBadge}>
            <span className={styles.confidenceLabel}>Overall Confidence</span>
            <span className={`${styles.confidenceValue} ${getConfidenceColor(overallConfidence)}`}>
              {overallConfidence.toFixed(1)}%
            </span>
          </div>
          <div className={styles.confidenceMeter}>
            <div
              className={`${styles.confidenceFill} ${getConfidenceColor(overallConfidence)}`}
              style={{ width: `${overallConfidence}%` }}
            />
          </div>
        </div>
      )}

      {/* Rules Lane */}
      <div className={styles.lane}>
        <div className={styles.laneHeader}>
          <div className={styles.laneIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 3h18v18H3V3z" stroke="currentColor" strokeWidth="2"/>
              <path d="M8 7h8M8 12h8M8 17h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className={styles.laneTitle}>
            <h4>Rules Lane</h4>
            <p>Deterministic mappings</p>
          </div>
        </div>

        <div className={styles.laneStats}>
          <div className={styles.count}>
            <span className={styles.countValue}>{animatedValues.rules}</span>
            <span className={styles.countLabel}>fields</span>
          </div>
          <div className={styles.percentage}>
            {distribution.rules.percentage.toFixed(1)}% of total
          </div>
        </div>

        <div className={styles.progressBar}>
          <div
            className={`${styles.progressFill} ${styles.rulesFill}`}
            style={{ width: `${distribution.rules.percentage}%` }}
          />
        </div>

        <div className={styles.fieldList}>
          {distribution.rules.fields.slice(0, 3).map((field, idx) => (
            <span key={idx} className={styles.fieldChip}>{field}</span>
          ))}
          {distribution.rules.fields.length > 3 && (
            <span className={styles.fieldMore}>+{distribution.rules.fields.length - 3}</span>
          )}
        </div>
      </div>

      {/* AI Lane */}
      <div className={styles.lane}>
        <div className={styles.laneHeader}>
          <div className={`${styles.laneIcon} ${styles.aiIcon}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M8 12a4 4 0 018 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className={styles.laneTitle}>
            <h4>AI Lane</h4>
            <p>Complex extraction</p>
          </div>
        </div>

        <div className={styles.laneStats}>
          <div className={styles.count}>
            <span className={styles.countValue}>{animatedValues.ai}</span>
            <span className={styles.countLabel}>fields</span>
          </div>
          <div className={styles.percentage}>
            {distribution.ai.percentage.toFixed(1)}% of total
          </div>
        </div>

        <div className={styles.progressBar}>
          <div
            className={`${styles.progressFill} ${styles.aiFill}`}
            style={{ width: `${distribution.ai.percentage}%` }}
          />
        </div>

        <div className={styles.fieldList}>
          {distribution.ai.fields.slice(0, 3).map((field, idx) => {
            const confidence = getFieldConfidence(field);
            return (
              <div key={idx} className={styles.fieldItem}>
                <span className={styles.fieldChip}>{field}</span>
                {confidence !== null && (
                  <span className={`${styles.confidenceChip} ${getConfidenceColor(confidence)}`}>
                    {confidence.toFixed(0)}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Human Lane */}
      <div className={styles.lane}>
        <div className={styles.laneHeader}>
          <div className={`${styles.laneIcon} ${styles.humanIcon}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 11v10M8 21h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className={styles.laneTitle}>
            <h4>Human Review</h4>
            <p>Low confidence fields</p>
          </div>
        </div>

        <div className={styles.laneStats}>
          <div className={styles.count}>
            <span className={styles.countValue}>{animatedValues.human}</span>
            <span className={styles.countLabel}>fields</span>
          </div>
          <div className={styles.percentage}>
            {distribution.human.percentage.toFixed(1)}% of total
          </div>
        </div>

        <div className={styles.progressBar}>
          <div
            className={`${styles.progressFill} ${styles.humanFill}`}
            style={{ width: `${distribution.human.percentage}%` }}
          />
        </div>

        <div className={styles.fieldList}>
          {distribution.human.fields.slice(0, 3).map((field, idx) => {
            const confidence = getFieldConfidence(field);
            return (
              <div key={idx} className={styles.fieldItem}>
                <span className={styles.fieldChip}>{field}</span>
                {confidence !== null && (
                  <span className={`${styles.confidenceChip} ${getConfidenceColor(confidence)}`}>
                    {confidence.toFixed(0)}%
                  </span>
                )}
                {confidence !== null && confidence < 80 && (
                  <span className={styles.reviewBadge}>⚠️ Review</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}