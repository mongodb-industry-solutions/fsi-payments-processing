'use client';

import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import styles from './EnhancedCountryNode.module.css';

const EnhancedCountryNode = ({ data, selected }) => {
  const isJsonBridge = data.format === 'Bridge' || data.format === 'JSON' || data.isHub;
  const isProcessing = data.status === 'processing';
  const isCompleted = data.status === 'completed';

  return (
    <div
      className={`${styles.nodeWrapper} ${selected ? styles.selected : ''} ${isProcessing ? styles.processing : ''} ${isCompleted ? styles.completed : ''}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className={styles.handle}
        style={{ background: '#764ba2' }}
      />

      <div className={`${styles.node} ${isJsonBridge ? styles.jsonBridge : ''}`}>
        <div className={styles.nodeHeader}>
          <span className={styles.icon}>{data.icon}</span>
          {isProcessing && (
            <div className={styles.processingIndicator}>
              <div className={styles.spinner}></div>
            </div>
          )}
          {isCompleted && (
            <div className={styles.completedIndicator}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M5 13L9 17L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          )}
        </div>

        <div className={styles.nodeBody}>
          <h4 className={styles.countryName}>{data.country}</h4>
          {data.city && (
            <p className={styles.cityName}>{data.city}</p>
          )}

          <div className={styles.formatBadge} data-format-type={isJsonBridge ? 'json' : 'native'}>
            {data.format}
          </div>

          {data.compliance && (
            <div className={styles.complianceBadge}>
              {data.compliance}
            </div>
          )}
        </div>

        {isJsonBridge && (
          <div className={styles.bridgeInfo}>
            <p className={styles.bridgeText}>Universal Bridge</p>
            <div className={styles.bridgeStats}>
              <span>100% Generic</span>
              <span>Zero Code</span>
            </div>
          </div>
        )}

        {!isJsonBridge && data.mongoConfig && (
          <div className={styles.mongoInfo}>
            <div className={styles.mongoIcon}>🗄️</div>
            <span className={styles.mongoText}>MongoDB Config</span>
          </div>
        )}

        {data.processingTime && (
          <div className={styles.timeInfo}>
            <span className={styles.timeIcon}>⏱️</span>
            <span className={styles.timeText}>{data.processingTime}ms</span>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className={styles.handle}
        style={{ background: '#764ba2' }}
      />
    </div>
  );
};

export default memo(EnhancedCountryNode);