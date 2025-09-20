'use client';

import { useState, useEffect } from 'react';
import styles from './MongoDBActivityFeed.module.css';

export default function MongoDBActivityFeed({ operations = [], isLive = false }) {
  const [displayedOps, setDisplayedOps] = useState([]);

  useEffect(() => {
    // Animate operations appearing one by one
    if (operations.length > displayedOps.length) {
      const newOps = operations.slice(displayedOps.length);
      const timers = [];

      newOps.forEach((op, index) => {
        timers.push(setTimeout(() => {
          setDisplayedOps(prev => [...prev, op]);
        }, index * 300));
      });

      return () => timers.forEach(clearTimeout);
    }
  }, [operations, displayedOps.length]);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      millisecond: '3-digit'
    }).replace(',', '.');
  };

  const getOperationType = (message) => {
    if (message.includes('Loaded') || message.includes('Loading')) return 'read';
    if (message.includes('Queried') || message.includes('Query')) return 'query';
    if (message.includes('Applied') || message.includes('Update')) return 'update';
    if (message.includes('saved') || message.includes('Insert')) return 'insert';
    if (message.includes('Delete')) return 'delete';
    return 'info';
  };

  return (
    <div className={styles.activityFeed}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h3>MongoDB Operations</h3>
          {isLive && (
            <div className={styles.liveIndicator}>
              <span className={styles.liveDot} />
              <span className={styles.liveText}>LIVE</span>
            </div>
          )}
        </div>
        <div className={styles.stats}>
          <span className={styles.statItem}>
            <span className={styles.statValue}>{displayedOps.length}</span>
            <span className={styles.statLabel}>ops</span>
          </span>
        </div>
      </div>

      <div className={styles.operations}>
        {displayedOps.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.mongoLogo}>
              <svg viewBox="0 0 24 24" width="40" height="40">
                <path
                  fill="currentColor"
                  d="M17.193 9.555c-1.264-5.58-4.252-7.414-4.573-8.115-.28-.394-.53-.954-.735-1.44-.036.495-.055.685-.523 1.184-.723.566-4.438 3.682-4.74 10.02-.282 5.912 4.27 9.435 4.888 9.884l.07.05A73.49 73.49 0 0111.91 24h.481c.114-1.032.284-2.056.51-3.07.417-.296.604-.463.85-.693a11.342 11.342 0 003.639-8.464c.01-.814-.103-1.662-.197-2.218zm-5.336 8.195s0-8.291.275-8.29c.213 0 .49 10.695.49 10.695-.381-.045-.765-1.76-.765-2.405z"
                />
              </svg>
            </div>
            <p>Waiting for operations...</p>
          </div>
        ) : (
          displayedOps.map((op, index) => {
            const opType = getOperationType(op.message);
            return (
              <div
                key={index}
                className={`${styles.operation} ${styles[opType]} ${styles.animated}`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className={styles.opTime}>
                  {formatTimestamp(op.timestamp)}
                </div>
                <div className={styles.opIcon}>{op.icon}</div>
                <div className={styles.opContent}>
                  <div className={styles.opMessage}>{op.message}</div>
                  {op.collection && (
                    <div className={styles.opCollection}>
                      Collection: <span>{op.collection}</span>
                    </div>
                  )}
                  {op.documents && (
                    <div className={styles.opDocuments}>
                      Documents: <span>{op.documents}</span>
                    </div>
                  )}
                </div>
                {op.duration && (
                  <div className={styles.opDuration}>{op.duration}ms</div>
                )}
              </div>
            );
          })
        )}
      </div>

      {displayedOps.length > 0 && (
        <div className={styles.footer}>
          <div className={styles.summary}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryIcon}>📊</span>
              <span className={styles.summaryLabel}>Total:</span>
              <span className={styles.summaryValue}>{displayedOps.length}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryIcon}>⚡</span>
              <span className={styles.summaryLabel}>Avg:</span>
              <span className={styles.summaryValue}>
                {Math.round(
                  displayedOps.reduce((acc, op) => acc + (op.duration || 0), 0) /
                  Math.max(displayedOps.length, 1)
                )}ms
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}