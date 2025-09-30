'use client';

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import styles from './ConversionDetailsModal.module.css';

const ConversionDetailsModal = ({ isOpen, onClose, conversionData }) => {
  const [mounted, setMounted] = useState(false);

  // Ensure we're mounted before using document (for SSR safety)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle ESC key press
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  const formatMessage = (message, format) => {
    if (!message) return 'No data available';

    // For JSON format, pretty print it
    if (format === 'JSON' || format?.includes('JSON')) {
      try {
        const parsed = typeof message === 'string' ? JSON.parse(message) : message;
        return JSON.stringify(parsed, null, 2);
      } catch {
        return message;
      }
    }

    // For XML formats (pacs.008, CHAPS, etc.)
    if (format?.includes('pacs') || format === 'CHAPS' || format === 'TARGET2') {
      // Try to format XML nicely
      try {
        // Basic XML formatting
        return message
          .replace(/></g, '>\n<')
          .replace(/(<[^\/][^>]*>)([^<]+)(<\/[^>]+>)/g, '$1\n  $2\n$3')
          .trim();
      } catch {
        return message;
      }
    }

    // For MT formats, ensure proper line breaks
    if (format?.startsWith('MT')) {
      return message.replace(/(:)/g, '\n:').trim();
    }

    return message;
  };

  const getHighlightLanguage = (format) => {
    if (format === 'JSON') return 'json';
    if (format?.includes('pacs') || format === 'CHAPS' || format === 'TARGET2') return 'xml';
    if (format?.startsWith('MT')) return 'swift';
    return 'text';
  };

  // Portal rendering for the modal
  return ReactDOM.createPortal(
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {conversionData?.from || 'Source'} → {conversionData?.to || 'Target'} Conversion
          </h2>
          <button className={styles.closeButton} onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={styles.contentContainer}>
          <div className={styles.formattedView}>
            <div className={styles.messageSection}>
              <h3 className={styles.sectionTitle}>Input ({conversionData?.from})</h3>
              <pre className={styles.codeBlock}>
                <code className={getHighlightLanguage(conversionData?.from)}>
                  {formatMessage(conversionData?.input, conversionData?.from)}
                </code>
              </pre>
            </div>
            <div className={styles.arrow}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
            <div className={styles.messageSection}>
              <h3 className={styles.sectionTitle}>Output ({conversionData?.to})</h3>
              <pre className={styles.codeBlock}>
                <code className={getHighlightLanguage(conversionData?.to)}>
                  {formatMessage(conversionData?.output, conversionData?.to)}
                </code>
              </pre>
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.closeBtn} onClick={onClose}>
            Close
          </button>
          <button
            className={styles.copyBtn}
            onClick={() => {
              const data = {
                from: conversionData?.from,
                to: conversionData?.to,
                input: conversionData?.input,
                output: conversionData?.output,
                processing: conversionData?.processing
              };
              navigator.clipboard.writeText(JSON.stringify(data, null, 2));
            }}
          >
            Copy to Clipboard
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConversionDetailsModal;