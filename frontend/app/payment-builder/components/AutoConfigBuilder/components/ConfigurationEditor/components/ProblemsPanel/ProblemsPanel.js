import React, { useMemo } from 'react';
import styles from './ProblemsPanel.module.css';

const ProblemsPanel = ({ validationResult, validationSource, onProblemClick, isVisible, onToggle }) => {
  const problems = useMemo(() => {
    console.log('ProblemsPanel - Received validationResult:', validationResult);

    if (!validationResult?.details) {
      console.log('ProblemsPanel - No details found in validationResult');
      return [];
    }

    console.log(`ProblemsPanel - Found ${validationResult.details.length} validation checks`);

    const invalidChecks = validationResult.details.filter(check => !check.is_valid);
    console.log(`ProblemsPanel - ${invalidChecks.length} checks have errors`);

    return validationResult.details
      .filter(check => !check.is_valid)
      .flatMap(check =>
        check.errors.map(error => ({
          type: 'error',
          check: check.check,
          field: error.field,
          message: error.message,
          line: error.line
        }))
      );
  }, [validationResult]);

  const errorCount = problems.filter(p => p.type === 'error').length;
  const warningCount = problems.filter(p => p.type === 'warning').length;

  return (
    <div className={`${styles.container} ${!isVisible ? styles.collapsed : ''}`}>
      <div className={styles.header} onClick={onToggle}>
        <div className={styles.title}>
          <span className={styles.chevron}>{isVisible ? '▼' : '▲'}</span>
          <h4>Problems</h4>
          {validationSource && validationSource !== 'none' && (
            <span className={styles.validationSource} title={`Validated by ${validationSource}`}>
              {validationSource === 'client' ? '⚡' : '🌐'} {validationSource}
            </span>
          )}
          {errorCount > 0 && (
            <span className={`${styles.badge} ${styles.badgeError}`}>{errorCount} errors</span>
          )}
          {warningCount > 0 && (
            <span className={`${styles.badge} ${styles.badgeWarning}`}>{warningCount} warnings</span>
          )}
          {errorCount === 0 && warningCount === 0 && (
            <span className={`${styles.badge} ${styles.badgeSuccess}`}>No problems</span>
          )}
        </div>
        <div className={styles.actions}>
          <button
            className={styles.clearButton}
            aria-label="Clear problems"
            onClick={(e) => {
              e.stopPropagation();
              // Clear problems action
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {isVisible && (
        <div className={styles.problemsList}>
          {problems.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.successIcon}>✓</span>
              <p>No problems detected. Configuration is valid!</p>
            </div>
          ) : (
            problems.map((problem, index) => (
              <div
                key={index}
                className={styles.problem}
                onClick={() => onProblemClick(problem)}
              >
                <span className={styles.problemIcon}>
                  {problem.type === 'error' ? '✗' : '⚠'}
                </span>
                <div className={styles.problemContent}>
                  <span className={styles.problemLocation}>
                    [{problem.check}] {problem.field && `${problem.field}: `}
                  </span>
                  <span className={styles.problemMessage}>
                    {problem.message}
                  </span>
                </div>
                {problem.line && (
                  <span className={styles.lineNumber}>
                    Line {problem.line}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default ProblemsPanel;
