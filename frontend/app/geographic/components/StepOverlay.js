'use client';

import { useEffect, useState } from 'react';
import styles from './StepOverlay.module.css';

export default function StepOverlay({
  isExecuting,
  currentStep,
  conversions,
  conversionResults,
  currentConversionData,
  onPause,
  onResume,
  isPaused
}) {
  const [visible, setVisible] = useState(false);
  const [currentConversion, setCurrentConversion] = useState(null);
  const [showOutput, setShowOutput] = useState(false);

  useEffect(() => {
    if (isExecuting && currentStep !== null && conversions && conversions[currentStep]) {
      setCurrentConversion(conversions[currentStep]);
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [isExecuting, currentStep, conversions]);

  if (!visible || !currentConversion) {
    return null;
  }

  const stepNumber = currentStep + 1;
  const totalSteps = conversions.length;
  const progress = (stepNumber / totalSteps) * 100;

  return (
    <div className={styles.overlay}>
      <div className={styles.overlayContent}>
        <div className={styles.stepHeader}>
          <div className={styles.stepNumber}>
            Step {stepNumber} of {totalSteps}
          </div>
          {onPause && onResume && (
            <button
              className={styles.pauseButton}
              onClick={isPaused ? onResume : onPause}
            >
              {isPaused ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 3L12 8L4 13V3Z" fill="currentColor"/>
                  </svg>
                  Resume
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="4" y="3" width="3" height="10" fill="currentColor"/>
                    <rect x="9" y="3" width="3" height="10" fill="currentColor"/>
                  </svg>
                  Pause
                </>
              )}
            </button>
          )}
        </div>

        <div className={styles.conversionFlow}>
          <div className={styles.fromFormat}>
            <span className={styles.formatLabel}>{currentConversion.from}</span>
          </div>
          <div className={styles.arrow}>
            <svg width="48" height="24" viewBox="0 0 48 24" fill="none">
              <path
                d="M0 12H44M44 12L32 4M44 12L32 20"
                stroke="#764ba2"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className={styles.toFormat}>
            <span className={styles.formatLabel}>{currentConversion.to}</span>
          </div>
        </div>

        <div className={styles.stepTitle}>
          {currentConversion.description}
        </div>

        <div className={styles.stepDetails}>
          {currentConversion.details || 'Processing payment format conversion...'}
        </div>

        <div className={styles.progressSection}>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className={styles.progressText}>
            {Math.round(progress)}% Complete
          </div>
        </div>

        <div className={styles.location}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="8" cy="8" r="2" fill="currentColor"/>
          </svg>
          Processing at: {currentConversion.location}
        </div>

        {/* Show conversion results if available */}
        {conversionResults && conversionResults.length > 0 && (
          <div className={styles.resultsSection}>
            {conversionResults[currentStep] && (
              <>
                <div className={styles.resultHeader}>
                  <h4>Conversion Output</h4>
                  <button
                    className={styles.toggleButton}
                    onClick={() => setShowOutput(!showOutput)}
                  >
                    {showOutput ? 'Hide' : 'Show'} Output
                  </button>
                </div>

                {showOutput && (
                  <div className={styles.resultContent}>
                    {/* Show processing stats */}
                    {conversionResults[currentStep].processingStats && (
                      <div className={styles.stats}>
                        <div className={styles.statItem}>
                          <span className={styles.statLabel}>Rules Lane:</span>
                          <span className={styles.statValue}>
                            {conversionResults[currentStep].processingStats.rules_lane || 0} fields
                          </span>
                        </div>
                        <div className={styles.statItem}>
                          <span className={styles.statLabel}>AI Lane:</span>
                          <span className={styles.statValue}>
                            {conversionResults[currentStep].processingStats.ai_lane || 0} fields
                          </span>
                        </div>
                        <div className={styles.statItem}>
                          <span className={styles.statLabel}>Processing Time:</span>
                          <span className={styles.statValue}>
                            {(conversionResults[currentStep].processingTime || 0).toFixed(2)}s
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Show output preview */}
                    <div className={styles.outputPreview}>
                      <pre className={styles.outputCode}>
                        {conversionResults[currentStep].output
                          ? (typeof conversionResults[currentStep].output === 'string'
                              ? conversionResults[currentStep].output.substring(0, 500)
                              : JSON.stringify(conversionResults[currentStep].output, null, 2).substring(0, 500))
                          : 'Processing...'}
                        {conversionResults[currentStep].output?.length > 500 && '...'}
                      </pre>
                    </div>

                    {/* Show human review flag */}
                    {conversionResults[currentStep].humanReviewRequired && (
                      <div className={styles.reviewAlert}>
                        ⚠️ Human review recommended for low-confidence fields
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}