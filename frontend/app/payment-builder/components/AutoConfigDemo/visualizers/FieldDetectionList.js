'use client';

import { useEffect, useState } from 'react';
import styles from './FieldDetectionList.module.css';

export default function FieldDetectionList({ fields = [], animated = true }) {
  const [detectedFields, setDetectedFields] = useState([]);

  useEffect(() => {
    if (animated && fields.length > 0) {
      // Animate fields being detected one by one
      setDetectedFields([]);
      const timers = [];

      fields.forEach((field, index) => {
        timers.push(setTimeout(() => {
          setDetectedFields(prev => [...prev, field]);
        }, index * 300));
      });

      return () => timers.forEach(clearTimeout);
    } else {
      setDetectedFields(fields);
    }
  }, [fields, animated]);

  const getLaneColor = (lane) => {
    switch (lane) {
      case 'RULES':
        return 'var(--green-base)';
      case 'AI':
        return 'var(--blue-base)';
      case 'HUMAN':
        return 'var(--orange-base)';
      default:
        return 'var(--gray-base)';
    }
  };

  const getLaneIcon = (lane) => {
    switch (lane) {
      case 'RULES':
        return '⚡';
      case 'AI':
        return '🤖';
      case 'HUMAN':
        return '👤';
      default:
        return '📋';
    }
  };

  const getFieldTypeIcon = (type) => {
    switch (type) {
      case 'amount':
        return '💰';
      case 'date':
        return '📅';
      case 'reference':
        return '🔖';
      case 'party':
        return '👥';
      case 'text':
        return '📝';
      default:
        return '📄';
    }
  };

  return (
    <div className={styles.fieldDetectionList}>
      <h4 className={styles.title}>Detecting Fields</h4>

      <div className={styles.summary}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Total Fields</span>
          <span className={styles.summaryValue}>{fields.length}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Detected</span>
          <span className={styles.summaryValue}>{detectedFields.length}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Progress</span>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{
                width: `${(detectedFields.length / Math.max(fields.length, 1)) * 100}%`
              }}
            />
          </div>
        </div>
      </div>

      <div className={styles.fields}>
        {detectedFields.map((field, index) => (
          <div
            key={index}
            className={`${styles.field} ${animated ? styles.animated : ''}`}
            style={{
              animationDelay: `${index * 0.05}s`
            }}
          >
            <div className={styles.fieldHeader}>
              <div className={styles.fieldInfo}>
                <span className={styles.fieldIcon}>{getFieldTypeIcon(field.type)}</span>
                <span className={styles.fieldCode}>{field.code}</span>
                <span className={styles.fieldName}>{field.name}</span>
              </div>
              <div
                className={styles.laneBadge}
                style={{
                  backgroundColor: getLaneColor(field.lane) + '20',
                  color: getLaneColor(field.lane),
                  borderColor: getLaneColor(field.lane)
                }}
              >
                <span className={styles.laneIcon}>{getLaneIcon(field.lane)}</span>
                <span className={styles.laneName}>{field.lane}</span>
              </div>
            </div>

            {field.value && (
              <div className={styles.fieldValue}>
                <span className={styles.valueLabel}>Sample:</span>
                <span className={styles.value}>{field.value}</span>
              </div>
            )}

            {field.mapping && (
              <div className={styles.fieldMapping}>
                <span className={styles.mappingLabel}>Maps to:</span>
                <span className={styles.mappingTarget}>{field.mapping}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {fields.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.scanAnimation}>
            <div className={styles.scanLine} />
          </div>
          <p>Scanning message structure...</p>
        </div>
      )}
    </div>
  );
}