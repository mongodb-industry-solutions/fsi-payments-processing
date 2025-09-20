'use client';

import { useState, useEffect } from 'react';
import styles from './JourneyVisualizer.module.css';

export default function MongoDBOperations({ executionResult, isProcessing, paymentType }) {
  const [operations, setOperations] = useState([]);
  const [animatedOps, setAnimatedOps] = useState([]);
  const [showIndexComparison, setShowIndexComparison] = useState(false);

  useEffect(() => {
    if (executionResult && executionResult.conversion_metadata) {
      const ops = generateMongoOperations(executionResult.conversion_metadata);
      setOperations(ops);

      // Animate operations appearing one by one
      setAnimatedOps([]);
      ops.forEach((op, index) => {
        setTimeout(() => {
          setAnimatedOps(prev => [...prev, op]);
        }, index * 300);
      });
    } else {
      setOperations([]);
      setAnimatedOps([]);
    }
  }, [executionResult]);

  const generateMongoOperations = (metadata) => {
    const ops = [];
    // Generate unique timestamp-based ID prefix to avoid duplicate keys
    const uniquePrefix = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 1. Load conversion configuration
    ops.push({
      id: `${uniquePrefix}_op_1`,
      type: 'FIND',
      collection: 'conversion_registry',
      query: `{ "_id": "${metadata.conversion_id}" }`,
      indexUsed: '_id_',
      docsExamined: 1,
      docsReturned: 1,
      executionTime: 3,
      description: 'Load conversion configuration',
      color: 'var(--blue-base)'
    });

    // 2. Query semantic patterns for AI fields
    if (metadata.processing_stats?.ai_lane?.count > 0) {
      ops.push({
        id: `${uniquePrefix}_op_2`,
        type: 'FIND',
        collection: 'semantic_patterns',
        query: `{ "field_type": { "$in": ${JSON.stringify(metadata.processing_stats.ai_lane.fields)} } }`,
        indexUsed: 'field_type_1',
        docsExamined: metadata.processing_stats.ai_lane.count,
        docsReturned: metadata.processing_stats.ai_lane.count,
        executionTime: 8,
        description: 'Query AI field patterns',
        color: 'var(--purple-dark1)'
      });
    }

    // 3. Insert conversion result
    ops.push({
      id: `${uniquePrefix}_op_3`,
      type: 'INSERT',
      collection: 'conversion_results',
      document: `{
  "conversion_id": "${metadata.conversion_id}",
  "source_format": "${metadata.source_format}",
  "target_format": "${metadata.target_format}",
  "confidence": ${((metadata.confidence_scores?.overall || 0.92) * 100).toFixed(0)}%,
  "timestamp": "${new Date().toISOString()}"
}`,
      executionTime: 12,
      description: 'Store conversion result',
      color: 'var(--green-dark1)'
    });

    // 4. Update statistics
    ops.push({
      id: `${uniquePrefix}_op_4`,
      type: 'UPDATE',
      collection: 'conversion_stats',
      query: `{ "format_pair": "${metadata.source_format}_to_${metadata.target_format}" }`,
      update: '{ "$inc": { "count": 1 }, "$push": { "recent_times": ' + metadata.processing_time_seconds + ' } }',
      executionTime: 5,
      description: 'Update conversion statistics',
      color: 'var(--orange-base)'
    });

    return ops;
  };

  const getOperationIcon = (type) => {
    switch (type) {
      case 'FIND':
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="2"/>
            <path d="M13 13L17 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        );
      case 'INSERT':
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        );
      case 'UPDATE':
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4 10V16H10M16 10V4H10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="10" cy="10" r="2" fill="currentColor"/>
          </svg>
        );
      default:
        return null;
    }
  };

  if (!executionResult && !isProcessing) {
    return (
      <div className={styles.mongoPlaceholder}>
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <path d="M32 8L16 16V32C16 44 32 56 32 56C32 56 48 44 48 32V16L32 8Z"
            stroke="var(--gray-light1)" strokeWidth="2" strokeLinejoin="round"/>
          <path d="M32 20V44M20 32H44" stroke="var(--gray-light1)" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <h4>MongoDB Operations</h4>
        <p>Execute a conversion to see how MongoDB powers the transformation</p>

        <div className={styles.mongoFeatures}>
          <div className={styles.featureCard}>
            <span className={styles.featureIcon}>⚡</span>
            <div>
              <strong>Lightning Fast Queries</strong>
              <span>Index-optimized lookups in 3ms</span>
            </div>
          </div>
          <div className={styles.featureCard}>
            <span className={styles.featureIcon}>🔄</span>
            <div>
              <strong>Real-time Updates</strong>
              <span>Instant configuration changes</span>
            </div>
          </div>
          <div className={styles.featureCard}>
            <span className={styles.featureIcon}>📊</span>
            <div>
              <strong>Analytics Ready</strong>
              <span>Built-in aggregation pipeline</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.mongoOperations}>
      {/* Live Operations Feed */}
      <div className={styles.operationsList}>
        {animatedOps.map((op, index) => (
          <div
            key={op.id}
            className={`${styles.mongoOperation} ${styles.slideUpIn}`}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className={styles.opHeader}>
              <div className={styles.opType} style={{ color: op.color }}>
                {getOperationIcon(op.type)}
                <span>{op.type}</span>
              </div>
              <span className={styles.opTime}>{op.executionTime}ms</span>
            </div>

            <div className={styles.opDescription}>{op.description}</div>

            <div className={styles.opDetails}>
              <div className={styles.opCollection}>
                <span className={styles.label}>Collection:</span>
                <code>{op.collection}</code>
              </div>

              {op.query && (
                <div className={styles.opQuery}>
                  <span className={styles.label}>Query:</span>
                  <pre>{op.query}</pre>
                </div>
              )}

              {op.document && (
                <div className={styles.opDocument}>
                  <span className={styles.label}>Document:</span>
                  <pre>{op.document}</pre>
                </div>
              )}

              {op.update && (
                <div className={styles.opUpdate}>
                  <span className={styles.label}>Update:</span>
                  <pre>{op.update}</pre>
                </div>
              )}

              {op.indexUsed && (
                <div className={styles.opMetrics}>
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}>Index:</span>
                    <span className={styles.metricValue}>{op.indexUsed}</span>
                  </div>
                  {op.docsExamined !== undefined && (
                    <div className={styles.metric}>
                      <span className={styles.metricLabel}>Docs Examined:</span>
                      <span className={styles.metricValue}>{op.docsExamined}</span>
                    </div>
                  )}
                  {op.docsReturned !== undefined && (
                    <div className={styles.metric}>
                      <span className={styles.metricLabel}>Returned:</span>
                      <span className={styles.metricValue}>{op.docsReturned}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Index Performance Banner */}
      {executionResult && (
        <div className={styles.indexBanner}>
          <div className={styles.indexComparison}>
            <div className={styles.withoutIndex}>
              <h5>Without Indexes</h5>
              <div className={styles.indexMetric}>
                <span>50,000</span>
                <label>Documents Scanned</label>
              </div>
              <div className={styles.indexMetric}>
                <span>2,347ms</span>
                <label>Query Time</label>
              </div>
            </div>

            <div className={styles.vsIndicator}>
              <span>VS</span>
            </div>

            <div className={styles.withIndex}>
              <h5>With MongoDB Indexes</h5>
              <div className={styles.indexMetric}>
                <span className={styles.highlight}>3</span>
                <label>Documents Scanned</label>
              </div>
              <div className={styles.indexMetric}>
                <span className={styles.highlight}>3ms</span>
                <label>Query Time</label>
              </div>
            </div>

            <div className={styles.improvement}>
              <div className={styles.improvementStat}>
                <span>99.99%</span>
                <label>Faster</label>
              </div>
              <div className={styles.improvementStat}>
                <span>16,667x</span>
                <label>Less Scanning</label>
              </div>
            </div>
          </div>

          <div className={styles.mongoTip}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 4V8M8 11H8.01M14 8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8C2 4.68629 4.68629 2 8 2C11.3137 2 14 4.68629 14 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <p>MongoDB's B-tree indexes enable instant field lookups, reducing query time from seconds to milliseconds</p>
          </div>
        </div>
      )}

      {/* Processing Indicator */}
      {isProcessing && (
        <div className={styles.mongoProcessing}>
          <div className={styles.pulsingDot} />
          <span>MongoDB executing operations...</span>
        </div>
      )}
    </div>
  );
}