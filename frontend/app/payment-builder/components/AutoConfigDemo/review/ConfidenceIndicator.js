'use client';

import styles from './ConfidenceIndicator.module.css';

export default function ConfidenceIndicator({
  confidence,
  label,
  showPercentage = true,
  size = 'medium',
  animated = true
}) {
  // Calculate the confidence level and color
  const getLevel = () => {
    if (confidence >= 0.9) return 'excellent';
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    if (confidence >= 0.4) return 'low';
    return 'critical';
  };

  const level = getLevel();
  const percentage = Math.round(confidence * 100);

  // Calculate segments for visual indicator
  const segments = 5;
  const activeSegments = Math.ceil((confidence || 0) * segments);

  return (
    <div className={`${styles.container} ${styles[size]}`}>
      {label && <label className={styles.label}>{label}</label>}

      <div className={styles.indicator}>
        {/* Visual segments */}
        <div className={styles.segments}>
          {[...Array(segments)].map((_, i) => (
            <div
              key={i}
              className={`
                ${styles.segment}
                ${i < activeSegments ? styles.active : ''}
                ${styles[level]}
                ${animated ? styles.animated : ''}
              `}
              style={{
                animationDelay: animated ? `${i * 0.1}s` : undefined
              }}
            />
          ))}
        </div>

        {/* Percentage display */}
        {showPercentage && (
          <div className={`${styles.percentage} ${styles[level]}`}>
            {percentage}%
          </div>
        )}
      </div>

      {/* Confidence level label */}
      <div className={`${styles.levelLabel} ${styles[level]}`}>
        {level === 'excellent' && 'Excellent'}
        {level === 'high' && 'High'}
        {level === 'medium' && 'Medium'}
        {level === 'low' && 'Low'}
        {level === 'critical' && 'Needs Review'}
      </div>

      {/* Detailed breakdown (optional) */}
      {size === 'large' && (
        <div className={styles.details}>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>AI Confidence:</span>
            <span className={styles.detailValue}>{percentage}%</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Human Review:</span>
            <span className={styles.detailValue}>
              {confidence < 0.8 ? 'Required' : 'Optional'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}