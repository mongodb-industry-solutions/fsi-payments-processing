'use client';

import { useState, memo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position } from 'reactflow';
import styles from './JsonBridgeNode.module.css';

function JsonBridgeNode({ data }) {
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  const beforeConversion = data.beforeJson || null;
  const afterConversion = data.afterJson || null;

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleNodeClick = (e) => {
    e.stopPropagation();
    setShowJsonModal(true);
  };

  const closeModal = (e) => {
    e.stopPropagation();
    setShowJsonModal(false);
  };

  const formatJson = (json) => {
    if (!json) return null;
    try {
      const parsed = typeof json === 'string' ? JSON.parse(json) : json;
      return JSON.stringify(parsed, null, 2);
    } catch {
      return typeof json === 'string' ? json : JSON.stringify(json, null, 2);
    }
  };

  const modalContent = showJsonModal && mounted ? (
    <div className={styles.modalOverlay} onClick={closeModal}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Canonical JSON Format</h2>
          <button className={styles.closeButton} onClick={closeModal}>✕</button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.jsonSection}>
            <h3>Before Conversion (Input)</h3>
            <div className={styles.jsonContent}>
              {beforeConversion ? (
                <pre>{formatJson(beforeConversion)}</pre>
              ) : (
                <div className={styles.placeholder}>
                  Canonical JSON will appear here after execution
                </div>
              )}
            </div>
          </div>

          <div className={styles.arrowDivider}>
            <span>⬇️</span>
          </div>

          <div className={styles.jsonSection}>
            <h3>After Conversion (Output)</h3>
            <div className={styles.jsonContent}>
              {afterConversion ? (
                <pre>{formatJson(afterConversion)}</pre>
              ) : (
                <div className={styles.placeholder}>
                  Converted JSON will appear here after execution
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <div className={styles.info}>
            <span className={styles.infoIcon}>ℹ️</span>
            <span>The MongoDB Bridge uses a universal Canonical JSON format to enable seamless multi-hop conversions between any payment formats.</span>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div
        className={`${styles.jsonBridge} ${data.status === 'processing' ? styles.processing : ''} ${data.status === 'completed' ? styles.completed : ''}`}
        onClick={handleNodeClick}
        style={{ width: '150px', height: '80px' }}
      >
        <Handle
          type="target"
          position={Position.Left}
          className={styles.handle}
          style={{ background: '#059669' }}
        />

        <div className={styles.content}>
          <div className={styles.iconContainer}>
            <span className={styles.icon}>🔄</span>
          </div>

          <div className={styles.label}>
            <div className={styles.title}>MongoDB Bridge</div>
            <div className={styles.subtitle}>Canonical JSON</div>
          </div>
        </div>

        <Handle
          type="source"
          position={Position.Right}
          className={styles.handle}
          style={{ background: '#059669' }}
        />

        {data.status === 'processing' && (
          <div className={styles.processingIndicator}>
            <div className={styles.spinner}></div>
          </div>
        )}
      </div>

      {mounted && modalContent && createPortal(
        modalContent,
        document.body
      )}
    </>
  );
}

export default memo(JsonBridgeNode);