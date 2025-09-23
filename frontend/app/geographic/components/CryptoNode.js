'use client';

import { Handle, Position } from 'reactflow';
import styles from './CryptoNode.module.css';

export default function CryptoNode({ data, selected }) {
  const { country, format, icon, city, info, status = 'idle', cryptoDetails } = data;

  // Ensure we're showing the crypto icon
  const displayIcon = icon || '🪙';

  return (
    <div
      className={`${styles.cryptoNode} ${styles[status]} ${selected ? styles.selected : ''}`}
      title={info || `${country} - ${format}`}
    >
      <Handle type="target" position={Position.Left} className={styles.handle} />

      <div className={styles.innerGlow}>
        <div className={styles.blockchainGrid}>
          <div className={styles.blockchainLine}></div>
          <div className={styles.blockchainLine}></div>
          <div className={styles.blockchainLine}></div>
        </div>

        <div className={styles.content}>
          <div className={styles.icon}>{displayIcon}</div>
          <div className={styles.label}>
            <div className={styles.country}>
              {format === 'USDC' ? 'Stablecoin' : country}
            </div>
            <div className={styles.format}>
              {format === 'USDC' ? 'USDC Transfer' : format}
            </div>
            <div className={styles.network}>
              {city === 'Polygon' ? '⛓️ Polygon Network' : city}
            </div>
            {info && (
              <div className={styles.walletInfo}>
                💳 {info}
              </div>
            )}
          </div>
        </div>

        {status === 'processing' && (
          <div className={styles.processingAnimation}>
            <div className={styles.block}></div>
            <div className={styles.block}></div>
            <div className={styles.block}></div>
          </div>
        )}

        {cryptoDetails && status === 'completed' && (
          <div className={styles.cryptoInfo}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Network:</span>
              <span className={styles.statValue}>{cryptoDetails.network}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Gas:</span>
              <span className={styles.statValue}>{cryptoDetails.gasEstimate}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Wallets:</span>
              <span className={styles.statValue}>{cryptoDetails.walletCount}</span>
            </div>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} className={styles.handle} />
    </div>
  );
}