'use client';

import { useState, useEffect } from 'react';
import Icon from '@leafygreen-ui/icon';
import styles from './GenerationProgress.module.css';

const GENERATION_STEPS = [
  {
    id: 'parsing',
    icon: 'MagnifyingGlass',
    title: 'Parsing Message',
    progressThreshold: 20
  },
  {
    id: 'pattern-matching',
    icon: 'Checkmark',
    title: 'Pattern Matching',
    progressThreshold: 45
  },
  {
    id: 'ai-analysis',
    icon: 'Sparkle',
    title: 'AI Analysis',
    progressThreshold: 65
  },
  {
    id: 'building-mappings',
    icon: 'Relationship',
    title: 'Building Mappings',
    progressThreshold: 85
  },
  {
    id: 'finalizing',
    icon: 'CheckmarkWithCircle',
    title: 'Finalizing',
    progressThreshold: 100
  }
];

export default function GenerationProgress({
  progress = 0,
  currentStep = 'Initializing...',
  startTime = null
}) {
  const [elapsedTime, setElapsedTime] = useState(0);

  // Calculate elapsed time
  useEffect(() => {
    if (!startTime) return;

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      setElapsedTime(elapsed);
    }, 100);

    return () => clearInterval(interval);
  }, [startTime]);

  // Determine current active step
  const getCurrentStepIndex = () => {
    for (let i = GENERATION_STEPS.length - 1; i >= 0; i--) {
      if (progress >= GENERATION_STEPS[i].progressThreshold - 20) {
        return i;
      }
    }
    return 0;
  };

  const activeStepIndex = getCurrentStepIndex();

  // Get step status
  const getStepStatus = (index) => {
    if (index < activeStepIndex) return 'completed';
    if (index === activeStepIndex) return 'active';
    return 'pending';
  };

  // Format time
  const formatTime = (seconds) => {
    if (seconds < 1) return '<1s';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  // Extract metadata from current step message
  const extractMetadata = (message) => {
    const metadata = {};

    // Look for patterns like "8 fields", "3 LLM calls", etc.
    const fieldMatch = message.match(/(\d+)\s+fields?/i);
    if (fieldMatch) metadata.fieldCount = fieldMatch[1];

    const llmMatch = message.match(/(\d+)\s+LLM/i);
    if (llmMatch) metadata.llmCalls = llmMatch[1];

    const patternMatch = message.match(/(\d+)\s+patterns?/i);
    if (patternMatch) metadata.patternCount = patternMatch[1];

    return metadata;
  };

  return (
    <div className={styles.container}>
      {/* Header with icon */}
      <div className={styles.header}>
        <div className={styles.iconWrapper}>
          <Icon glyph="Refresh" size="xlarge" />
        </div>
        <h3 className={styles.title}>Generating Configuration</h3>
        <p className={styles.subtitle}>Intelligent auto-configuration in progress</p>
      </div>

      {/* Progress Bar */}
      <div className={styles.progressSection}>
        <div className={styles.progressBarTrack}>
          <div
            className={styles.progressBarFill}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className={styles.progressInfo}>
          <span className={styles.progressPercent}>{Math.round(progress)}%</span>
          <span className={styles.progressTime}>{formatTime(elapsedTime)}</span>
        </div>
      </div>

      {/* Step-by-Step Progress */}
      <div className={styles.stepsContainer}>
        {GENERATION_STEPS.map((step, index) => {
          const status = getStepStatus(index);
          const isActive = status === 'active';
          const isCompleted = status === 'completed';

          return (
            <div
              key={step.id}
              className={`${styles.step} ${styles[`step-${status}`]}`}
            >
              <div className={styles.stepIcon}>
                {isCompleted ? (
                  <Icon glyph="CheckmarkWithCircle" size="default" />
                ) : isActive ? (
                  <Icon glyph={step.icon} size="default" />
                ) : (
                  <div className={styles.stepDot} />
                )}
              </div>
              <div className={styles.stepContent}>
                <div className={styles.stepTitle}>{step.title}</div>
                {isActive && (
                  <div className={styles.stepStatus}>{currentStep}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Current Activity */}
      <div className={styles.currentActivity}>
        <div className={styles.activityDots}>
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
        </div>
        <span className={styles.activityText}>{currentStep}</span>
      </div>
    </div>
  );
}
