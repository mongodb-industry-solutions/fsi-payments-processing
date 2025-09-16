'use client';

import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import styles from './paymentJourney.module.css';

const CustomCountryNode = memo(({ data }) => {
  const {
    country,
    format,
    isSource,
    isTarget,
    isHub,
    isActive,
    icon,
  } = data;

  return (
    <div
      className={`${styles.countryNode} ${
        isActive ? styles.activeNode : ''
      } ${isHub ? styles.hubNode : ''} ${
        isSource ? styles.sourceNode : ''
      } ${isTarget ? styles.targetNode : ''}`}
    >
      {!isSource && (
        <Handle
          type="target"
          position={Position.Left}
          style={{
            background: '#64748b',
            width: 10,
            height: 10,
          }}
        />
      )}

      <div className={styles.nodeContent}>
        <div className={styles.nodeIcon}>{icon}</div>
        <div className={styles.nodeTitle}>{country}</div>
        <div className={styles.nodeFormat}>
          <span className={styles.formatBadge}>{format}</span>
        </div>

        {isActive && (
          <div className={styles.processingIndicator}>
            <div className={styles.spinner}></div>
            <span>Processing...</span>
          </div>
        )}
      </div>

      {!isTarget && (
        <Handle
          type="source"
          position={Position.Right}
          style={{
            background: '#64748b',
            width: 10,
            height: 10,
          }}
        />
      )}
    </div>
  );
});

CustomCountryNode.displayName = 'CustomCountryNode';

export default CustomCountryNode;