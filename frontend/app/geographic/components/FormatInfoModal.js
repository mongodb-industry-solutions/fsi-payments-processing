'use client';

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { getFormatInfo } from '../data/formatInfo';
import styles from './FormatInfoModal.module.css';

const FormatInfoModal = ({ isOpen, onClose, format, country, city }) => {
  const [activeTab, setActiveTab] = useState('about');
  const [mongoConfig, setMongoConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const formatInfo = getFormatInfo(format);

  // Ensure we're mounted before using document (for SSR safety)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch MongoDB configuration when MongoDB tab is selected
  useEffect(() => {
    if (activeTab === 'mongodb' && format) {
      fetchMongoConfig();
    }
  }, [activeTab, format]);

  const fetchMongoConfig = async () => {
    setLoading(true);
    try {
      // Map format to conversion_id
      // Note: Some formats convert TO JSON (for outbound), others FROM JSON (for inbound)
      const conversionMap = {
        'MT103': 'MT103_to_pacs.008',
        'MT202': 'MT202_to_pacs.009',
        'CHAPS': 'JSON_to_CHAPS',
        'pacs.008': 'pacs.008_to_JSON',
        'TARGET2': 'JSON_to_TARGET2',
        'SPEI': 'SPEI_to_JSON',  // SPEI converts TO JSON in crypto scenario
        'USDC': 'JSON_to_USDC'
      };

      const conversionId = conversionMap[format];
      if (!conversionId) {
        setMongoConfig(null);
        setLoading(false);
        return;
      }

      const response = await fetch(`http://localhost:8001/api/v1/converter/config/${conversionId}`);
      if (response.ok) {
        const data = await response.json();
        setMongoConfig(data);
      } else {
        console.error('Failed to fetch config:', response.status);
        setMongoConfig(null);
      }
    } catch (error) {
      console.error('Error fetching MongoDB config:', error);
      setMongoConfig(null);
    } finally {
      setLoading(false);
    }
  };

  // Handle ESC key press
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !formatInfo || !mounted) return null;

  // Use React Portal to render modal outside of React Flow's DOM tree
  return ReactDOM.createPortal(
    <>
      {/* Backdrop */}
      <div className={styles.backdrop} onClick={onClose} />

      {/* Modal */}
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div className={styles.headerContent}>
            <h2>{country} {city && `- ${city}`}</h2>
            <p className={styles.formatName}>{formatInfo.name}</p>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className={styles.tabNav}>
          <button
            className={`${styles.tab} ${activeTab === 'about' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('about')}
          >
            📖 About
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'format' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('format')}
          >
            📝 Sample Format
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'mongodb' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('mongodb')}
          >
            🍃 MongoDB Config
          </button>
        </div>

        {/* Tab Content */}
        <div className={styles.modalBody}>
          {activeTab === 'about' && (
            <div className={styles.aboutContent}>
              <div className={styles.section}>
                <h3>Description</h3>
                <p>{formatInfo.description}</p>
              </div>

              <div className={styles.section}>
                <h3>Common Usage</h3>
                <ul className={styles.usageList}>
                  {formatInfo.usage.map((use, idx) => (
                    <li key={idx}>
                      <span className={styles.bullet}>▸</span>
                      {use}
                    </li>
                  ))}
                </ul>
              </div>

              <div className={styles.infoBox}>
                <div className={styles.infoIcon}>💡</div>
                <p>
                  This format is configured in MongoDB's <strong>conversion_registry</strong> collection,
                  enabling zero-code conversion to any other format through the universal JSON bridge.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'format' && (
            <div className={styles.formatContent}>
              <div className={styles.section}>
                <h3>Message Structure</h3>
                <div className={styles.codeBlock}>
                  <pre>{formatInfo.structure}</pre>
                </div>
              </div>

              <div className={styles.note}>
                <span className={styles.noteIcon}>📌</span>
                <span>
                  This is a simplified example. Actual messages may contain additional fields
                  and comply with specific network requirements.
                </span>
              </div>
            </div>
          )}

          {activeTab === 'mongodb' && (
            <div className={styles.mongoContent}>
              <div className={styles.section}>
                <h3>🍃 MongoDB conversion_registry Collection</h3>
                <p className={styles.pipelineDesc}>
                  Actual document from MongoDB that enables {format} conversion
                </p>
              </div>

              {loading ? (
                <div className={styles.loading}>Loading MongoDB configuration...</div>
              ) : mongoConfig ? (
                <div className={styles.mongoDocument}>
                  <pre className={styles.jsonContent}>
                    {JSON.stringify(mongoConfig, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className={styles.noConfig}>
                  <p>No MongoDB configuration found for {format}</p>
                  <p className={styles.hint}>
                    Configuration may not exist yet or format uses multi-hop routing through JSON
                  </p>
                </div>
              )}

              <div className={styles.mongoNote}>
                <span className={styles.mongoIcon}>✨</span>
                <p>
                  This configuration in <strong>conversion_registry</strong> enables zero-code conversion.
                  Just add a document like this to support any new format!
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body // Render directly to body, outside of React Flow
  );
};

export default FormatInfoModal;