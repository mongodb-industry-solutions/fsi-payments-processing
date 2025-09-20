'use client';

import { useEffect, useState } from 'react';
import styles from './ProcessingTimeline.module.css';

export default function ProcessingTimeline({
  currentStep = 0,
  steps = [
    { name: 'Parsing Message', icon: '📄', duration: 1000 },
    { name: 'Detecting Fields', icon: '🔍', duration: 2000 },
    { name: 'Learning Patterns', icon: '🧠', duration: 2000 },
    { name: 'AI Analysis', icon: '🤖', duration: 3000 },
    { name: 'Building Configuration', icon: '🔧', duration: 1000 }
  ],
  onStepComplete
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [stepProgress, setStepProgress] = useState(0);

  useEffect(() => {
    if (activeStep < steps.length) {
      const duration = steps[activeStep].duration;
      const interval = 50; // Update every 50ms
      const increment = (interval / duration) * 100;

      const timer = setInterval(() => {
        setStepProgress(prev => {
          const newProgress = prev + increment;
          if (newProgress >= 100) {
            clearInterval(timer);
            if (onStepComplete) {
              onStepComplete(activeStep);
            }
            // Move to next step after a short delay
            setTimeout(() => {
              if (activeStep < steps.length - 1) {
                setActiveStep(activeStep + 1);
                setStepProgress(0);
              }
            }, 300);
            return 100;
          }
          return newProgress;
        });
      }, interval);

      return () => clearInterval(timer);
    }
  }, [activeStep, steps, onStepComplete]);

  const getStepStatus = (index) => {
    if (index < activeStep) return 'complete';
    if (index === activeStep) return 'active';
    return 'pending';
  };

  return (
    <div className={styles.timeline}>
      <h4 className={styles.title}>Processing Timeline</h4>

      <div className={styles.steps}>
        {steps.map((step, index) => {
          const status = getStepStatus(index);

          return (
            <div
              key={index}
              className={`${styles.step} ${styles[status]}`}
            >
              <div className={styles.stepHeader}>
                <div className={styles.stepIcon}>
                  {status === 'complete' ? '✓' : step.icon}
                </div>
                <div className={styles.stepContent}>
                  <span className={styles.stepName}>{step.name}</span>
                  {status === 'active' && (
                    <span className={styles.stepTime}>
                      {Math.round((step.duration * (100 - stepProgress)) / 1000)}s
                    </span>
                  )}
                  {status === 'complete' && (
                    <span className={styles.stepComplete}>Complete</span>
                  )}
                </div>
              </div>

              {status === 'active' && (
                <div className={styles.stepProgress}>
                  <div
                    className={styles.stepProgressFill}
                    style={{ width: `${stepProgress}%` }}
                  />
                </div>
              )}

              {index < steps.length - 1 && (
                <div className={styles.connector}>
                  <div
                    className={styles.connectorFill}
                    style={{
                      height: status === 'complete' ? '100%' :
                               status === 'active' ? `${stepProgress}%` : '0%'
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.summary}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Progress</span>
          <span className={styles.summaryValue}>
            {activeStep}/{steps.length} steps
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Current</span>
          <span className={styles.summaryValue}>
            {steps[activeStep]?.name || 'Complete'}
          </span>
        </div>
      </div>
    </div>
  );
}