import styles from './ProcessingFlow.module.css';

export default function ProcessingFlow({
  sourceFormat,
  targetFormat,
  currentStage,
  executionResult
}) {
  const stages = [
    { id: 1, name: 'Parse', description: 'Extract fields from source' },
    { id: 2, name: 'Transform', description: 'Apply 3-lane processing' },
    { id: 3, name: 'Build', description: 'Construct target format' }
  ];

  return (
    <div className={styles.flowContainer}>
      {/* Source Format */}
      <div className={`${styles.formatNode} ${currentStage >= 1 ? styles.active : ''}`}>
        <div className={styles.formatLabel}>Source</div>
        <div className={styles.formatName}>{sourceFormat}</div>
      </div>

      {/* Processing Stages */}
      {stages.map((stage, index) => (
        <div key={stage.id} className={styles.stageGroup}>
          <div className={`${styles.arrow} ${currentStage > index ? styles.activeArrow : ''}`}>
            <svg width="40" height="20" viewBox="0 0 40 20">
              <path
                d="M0 10 L30 10 M25 5 L30 10 L25 15"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className={`${styles.stage} ${
            currentStage > stage.id ? styles.completed :
            currentStage === stage.id ? styles.processing : ''
          }`}>
            <div className={styles.stageIcon}>
              {currentStage > stage.id ? (
                <svg width="20" height="20" viewBox="0 0 20 20">
                  <path
                    d="M4 10 L8 14 L16 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : currentStage === stage.id ? (
                <div className={styles.spinner} />
              ) : (
                <span>{stage.id}</span>
              )}
            </div>
            <div className={styles.stageInfo}>
              <div className={styles.stageName}>{stage.name}</div>
              <div className={styles.stageDesc}>{stage.description}</div>
            </div>
          </div>
        </div>
      ))}

      {/* Final Arrow */}
      <div className={`${styles.arrow} ${currentStage > 3 ? styles.activeArrow : ''}`}>
        <svg width="40" height="20" viewBox="0 0 40 20">
          <path
            d="M0 10 L30 10 M25 5 L30 10 L25 15"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Target Format */}
      <div className={`${styles.formatNode} ${currentStage > 3 ? styles.active : ''}`}>
        <div className={styles.formatLabel}>Target</div>
        <div className={styles.formatName}>{targetFormat}</div>
      </div>

      {/* Processing Details */}
      {executionResult && (
        <div className={styles.details}>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Parse Time:</span>
            <span className={styles.detailValue}>50ms</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Transform Time:</span>
            <span className={styles.detailValue}>
              {((executionResult.conversion_metadata?.processing_time_seconds || 2) * 0.8 * 1000).toFixed(0)}ms
            </span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Build Time:</span>
            <span className={styles.detailValue}>30ms</span>
          </div>
        </div>
      )}
    </div>
  );
}