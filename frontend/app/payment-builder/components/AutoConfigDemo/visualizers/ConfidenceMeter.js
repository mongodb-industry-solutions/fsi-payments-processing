'use client';

import { useEffect, useState } from 'react';
import styles from './ConfidenceMeter.module.css';

export default function ConfidenceMeter({ scores = {}, animated = true }) {
  const [animatedScores, setAnimatedScores] = useState({
    fieldDetection: 0,
    patternMatching: 0,
    aiAnalysis: 0,
    overall: 0
  });

  useEffect(() => {
    if (animated) {
      // Animate scores progressively
      const timers = [];

      timers.push(setTimeout(() => {
        setAnimatedScores(prev => ({ ...prev, fieldDetection: scores.fieldDetection || 0 }));
      }, 500));

      timers.push(setTimeout(() => {
        setAnimatedScores(prev => ({ ...prev, patternMatching: scores.patternMatching || 0 }));
      }, 1000));

      timers.push(setTimeout(() => {
        setAnimatedScores(prev => ({ ...prev, aiAnalysis: scores.aiAnalysis || 0 }));
      }, 1500));

      timers.push(setTimeout(() => {
        setAnimatedScores(prev => ({ ...prev, overall: scores.overall || 0 }));
      }, 2000));

      return () => timers.forEach(clearTimeout);
    } else {
      setAnimatedScores({
        fieldDetection: scores.fieldDetection || 0,
        patternMatching: scores.patternMatching || 0,
        aiAnalysis: scores.aiAnalysis || 0,
        overall: scores.overall || 0
      });
    }
  }, [scores, animated]);

  const getConfidenceColor = (value) => {
    if (value >= 90) return 'var(--green-base)';
    if (value >= 70) return 'var(--blue-base)';
    if (value >= 50) return 'var(--orange-base)';
    return 'var(--red-base)';
  };

  const getConfidenceLabel = (value) => {
    if (value >= 90) return 'High';
    if (value >= 70) return 'Good';
    if (value >= 50) return 'Medium';
    return 'Low';
  };

  return (
    <div className={styles.confidenceMeter}>
      <h4 className={styles.title}>Configuration Confidence</h4>

      <div className={styles.metrics}>
        <div className={styles.metric}>
          <div className={styles.metricHeader}>
            <span className={styles.metricLabel}>Field Detection</span>
            <span className={styles.metricValue}>{animatedScores.fieldDetection}%</span>
          </div>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{
                width: `${animatedScores.fieldDetection}%`,
                backgroundColor: getConfidenceColor(animatedScores.fieldDetection),
                transition: animated ? 'width 1s ease-out' : 'none'
              }}
            />
          </div>
        </div>

        <div className={styles.metric}>
          <div className={styles.metricHeader}>
            <span className={styles.metricLabel}>Pattern Matching</span>
            <span className={styles.metricValue}>{animatedScores.patternMatching}%</span>
          </div>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{
                width: `${animatedScores.patternMatching}%`,
                backgroundColor: getConfidenceColor(animatedScores.patternMatching),
                transition: animated ? 'width 1s ease-out 0.5s' : 'none'
              }}
            />
          </div>
        </div>

        <div className={styles.metric}>
          <div className={styles.metricHeader}>
            <span className={styles.metricLabel}>AI Analysis</span>
            <span className={styles.metricValue}>{animatedScores.aiAnalysis}%</span>
          </div>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{
                width: `${animatedScores.aiAnalysis}%`,
                backgroundColor: getConfidenceColor(animatedScores.aiAnalysis),
                transition: animated ? 'width 1s ease-out 1s' : 'none'
              }}
            />
          </div>
        </div>
      </div>

      <div className={styles.overallSection}>
        <div className={styles.overallHeader}>
          <span className={styles.overallLabel}>Overall Confidence</span>
          <span className={styles.overallBadge} style={{
            backgroundColor: getConfidenceColor(animatedScores.overall) + '20',
            color: getConfidenceColor(animatedScores.overall)
          }}>
            {getConfidenceLabel(animatedScores.overall)}
          </span>
        </div>
        <div className={styles.overallProgressBar}>
          <div
            className={styles.overallProgressFill}
            style={{
              width: `${animatedScores.overall}%`,
              backgroundColor: getConfidenceColor(animatedScores.overall),
              transition: animated ? 'width 1.5s ease-out 1.5s' : 'none'
            }}
          />
        </div>
        <div className={styles.overallValue}>{animatedScores.overall}%</div>
      </div>
    </div>
  );
}