'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './MongoDBPanel.module.css';

export default function MongoDBPanel({
  operations = [],
  autoScroll = true
}) {
  const [isAutoScroll, setIsAutoScroll] = useState(autoScroll);
  const listRef = useRef(null);

  // Auto-scroll when new operations are added
  useEffect(() => {
    if (isAutoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [operations, isAutoScroll]);

  const getOperationType = (operation) => {
    if (operation.type) return operation.type.toLowerCase();
    if (operation.method) {
      const method = operation.method.toLowerCase();
      if (method.includes('find') || method.includes('get')) return 'read';
      if (method.includes('insert') || method.includes('create')) return 'write';
      if (method.includes('update')) return 'update';
      if (method.includes('delete') || method.includes('remove')) return 'delete';
    }
    return 'read';
  };

  const getOperationIcon = (type) => {
    switch (type) {
      case 'read': return '👁';
      case 'write': return '✍';
      case 'update': return '🔄';
      case 'delete': return '🗑';
      default: return '📝';
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'now';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  const calculateStats = () => {
    const stats = {
      total: operations.length,
      reads: 0,
      writes: 0,
      updates: 0,
      deletes: 0
    };

    operations.forEach(op => {
      const type = getOperationType(op);
      stats[`${type}s`] = (stats[`${type}s`] || 0) + 1;
    });

    return stats;
  };

  const stats = calculateStats();

  if (operations.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <div className={styles.dbIcon}>🗄</div>
            <h3 className={styles.title}>MongoDB Operations</h3>
          </div>
        </div>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🗄️</div>
          <div className={styles.emptyText}>
            No database operations yet.<br />
            Operations will appear here as they occur.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <div className={styles.dbIcon}>🗄</div>
          <h3 className={styles.title}>MongoDB</h3>
        </div>
        <div className={styles.autoScrollToggle}>
          <span>Auto-scroll</span>
          <div
            className={`${styles.toggleSwitch} ${isAutoScroll ? styles.active : ''}`}
            onClick={() => setIsAutoScroll(!isAutoScroll)}
          >
            <div className={styles.toggleKnob} />
          </div>
        </div>
      </div>

      {/* Operations List */}
      <div className={styles.operationsList} ref={listRef}>
        {operations.map((operation, idx) => {
          const type = getOperationType(operation);
          return (
            <div key={idx} className={`${styles.operation} ${styles[type]}`}>
              <div className={styles.operationHeader}>
                <div className={styles.operationIcon}>
                  {getOperationIcon(type)}
                </div>
                <div className={styles.operationInfo}>
                  <div className={styles.operationType}>{type}</div>
                  <div className={styles.operationCollection}>
                    {operation.collection || 'conversion_registry'}
                  </div>
                </div>
                <div className={styles.operationTime}>
                  {formatTime(operation.timestamp)}
                </div>
              </div>
              {operation.details && (
                <div className={styles.operationDetails}>
                  {operation.details}
                </div>
              )}
              {operation.query && (
                <div className={styles.operationQuery}>
                  {typeof operation.query === 'string'
                    ? operation.query
                    : JSON.stringify(operation.query, null, 2)}
                </div>
              )}
            </div>
          );
        })}

        {/* Loading indicator for ongoing operations */}
        {operations.some(op => op.status === 'pending') && (
          <div className={styles.loadingState}>
            <div className={styles.loadingDots}>
              <div className={styles.dot} />
              <div className={styles.dot} />
              <div className={styles.dot} />
            </div>
          </div>
        )}
      </div>

      {/* Stats Footer */}
      <div className={styles.statsFooter}>
        <div className={styles.statsGrid}>
          <div className={styles.statItem}>
            <div className={styles.statValue}>{stats.total}</div>
            <div className={styles.statLabel}>Total Ops</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>{stats.reads}</div>
            <div className={styles.statLabel}>Reads</div>
          </div>
        </div>
      </div>
    </div>
  );
}