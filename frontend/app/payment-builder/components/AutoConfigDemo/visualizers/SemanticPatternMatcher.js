'use client';

import { useEffect, useState } from 'react';
import styles from './SemanticPatternMatcher.module.css';

export default function SemanticPatternMatcher({ patterns = [], animated = true }) {
  const [visiblePatterns, setVisiblePatterns] = useState([]);

  useEffect(() => {
    if (animated && patterns.length > 0) {
      // Animate patterns appearing one by one
      setVisiblePatterns([]);
      const timers = [];

      patterns.forEach((pattern, index) => {
        timers.push(setTimeout(() => {
          setVisiblePatterns(prev => [...prev, pattern]);
        }, index * 500));
      });

      return () => timers.forEach(clearTimeout);
    } else {
      setVisiblePatterns(patterns);
    }
  }, [patterns, animated]);

  const getConfidenceColor = (confidence) => {
    if (confidence >= 90) return 'var(--green-base)';
    if (confidence >= 70) return 'var(--blue-base)';
    if (confidence >= 50) return 'var(--orange-base)';
    return 'var(--red-base)';
  };

  const getPatternIcon = (patternType) => {
    switch (patternType) {
      case 'exact_match':
        return '✓';
      case 'semantic':
        return '🧠';
      case 'ai_generated':
        return '🤖';
      default:
        return '📋';
    }
  };

  return (
    <div className={styles.patternMatcher}>
      <h4 className={styles.title}>Pattern Matching in Progress</h4>

      <div className={styles.patterns}>
        {visiblePatterns.map((pattern, index) => (
          <div
            key={index}
            className={`${styles.pattern} ${animated ? styles.animated : ''}`}
            style={{
              animationDelay: `${index * 0.1}s`
            }}
          >
            <div className={styles.sourceField}>
              <span className={styles.fieldLabel}>Source</span>
              <span className={styles.fieldName}>{pattern.sourceField}</span>
              <span className={styles.fieldValue}>{pattern.sourceValue}</span>
            </div>

            <div className={styles.patternArrow}>
              <div className={styles.patternType}>
                <span className={styles.patternIcon}>{getPatternIcon(pattern.type)}</span>
                <span className={styles.patternName}>{pattern.patternName}</span>
              </div>
              <div className={styles.confidenceBar}>
                <div
                  className={styles.confidenceFill}
                  style={{
                    width: `${pattern.confidence}%`,
                    backgroundColor: getConfidenceColor(pattern.confidence)
                  }}
                />
              </div>
              <span
                className={styles.confidenceValue}
                style={{ color: getConfidenceColor(pattern.confidence) }}
              >
                {pattern.confidence}%
              </span>
            </div>

            <div className={styles.targetField}>
              <span className={styles.fieldLabel}>Target</span>
              <span className={styles.fieldName}>{pattern.targetField}</span>
              <span className={styles.mappedPath}>{pattern.targetPath}</span>
            </div>
          </div>
        ))}
      </div>

      {patterns.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.loadingDots}>
            <span></span>
            <span></span>
            <span></span>
          </div>
          <p>Analyzing patterns from similar formats...</p>
        </div>
      )}
    </div>
  );
}