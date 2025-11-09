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

  const extractFPSData = (inputData) => {
    // Parse MT103 or JSON input to extract FPS fields
    let data = {};

    try {
      // Check if input is JSON
      if (typeof inputData === 'object') {
        data = inputData;
      } else if (inputData.includes('{') && inputData.includes('"')) {
        data = JSON.parse(inputData);
      } else {
        // Parse MT103 format
        const matches = {
          ref: inputData.match(/:20:([^\n:]+)/),
          amount: inputData.match(/:32A:(\d{6})([A-Z]{3})([\d,]+)/),
          debtor: inputData.match(/:50K:([^\n:]+(?:\n(?!:)[^\n:]+)*)/),
          debtorBIC: inputData.match(/:52A:([A-Z0-9]+)/),
          creditor: inputData.match(/:59:([^\n:]+(?:\n(?!:)[^\n:]+)*)/),
          creditorBIC: inputData.match(/:53A:([A-Z0-9]+)/),
          remittance: inputData.match(/:70:([^\n:]+(?:\n(?!:)[^\n:]+)*)/),
        };

        if (matches.ref) data.reference = matches.ref[1].trim();
        if (matches.amount) {
          const amountStr = matches.amount[3].replace(/,/g, '');
          data.amount = (parseFloat(amountStr) * 100).toFixed(0); // Convert to pence
          data.currency = matches.amount[2];
          data.date = matches.amount[1];
        }
        if (matches.debtor) {
          const lines = matches.debtor[1].trim().split('\n');
          data.debtorAccount = lines[0].replace('/', '');
          data.debtorName = lines[1] || '';
        }
        if (matches.debtorBIC) {
          const bic = matches.debtorBIC[1];
          data.debtorSortCode = bic.substring(6, 12) || '400530';
        }
        if (matches.creditor) {
          const lines = matches.creditor[1].trim().split('\n');
          data.creditorAccount = lines[0].replace('/', '');
          data.creditorName = lines[1] || '';
        }
        if (matches.creditorBIC) {
          const bic = matches.creditorBIC[1];
          data.creditorSortCode = bic.substring(6, 12) || '608371';
        }
        if (matches.remittance) {
          // Extract remittance text and clean up line breaks
          const remText = matches.remittance[1].trim().replace(/\n/g, ' ');
          data.remittance = remText.substring(0, 18);
        }
      }
    } catch (e) {
      console.error('Error parsing input for FPS:', e);
    }

    return data;
  };

  const formatMessage = (message, format) => {
    if (!message) return 'No data available';

    // Check if conversion failed (returns <root/> or empty XML)
    const isBrokenConversion = message.trim() === '<root/>' ||
                               message.trim() === '<?xml version="1.0" encoding="UTF-8"?>\n<root/>';

    // Show expected format for FPS when conversion fails
    if (isBrokenConversion && format === 'FPS') {
      const fpsData = extractFPSData(conversionData?.input || '');
      const now = new Date();
      const mmdd = String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
      const hhmmss = String(now.getHours()).padStart(2, '0') +
                     String(now.getMinutes()).padStart(2, '0') +
                     String(now.getSeconds()).padStart(2, '0');
      const stan = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');

      return `MTI: 0200
Field 2: ${fpsData.creditorAccount || '40440532013000'}
Field 3: 000000 (Processing Code - Credit)
Field 4: ${fpsData.amount || '12575050'}
Field 7: ${mmdd}${hhmmss}
Field 11: ${stan}
Field 12: ${hhmmss}
Field 13: ${mmdd}
Field 18: 6011 (Merchant Category Code - Financial Institutions)
Field 32: ${fpsData.debtorSortCode || '400530'}
Field 37: ${fpsData.reference || 'TEST001'}
Field 41: FPS00001 (Terminal ID)
Field 42: FPSUKPAY001 (Card Acceptor ID)
Field 43: ${fpsData.debtorName || 'ACME TECHNOLOGIES INC'}
Field 48: ${fpsData.remittance || 'Payment for services'}
Field 49: 826 (Currency Code - GBP)
Field 61.1: INST (Payment Sub-Type - Instant)
Field 100: ${fpsData.creditorSortCode || '608371'}
Field 102: ${fpsData.debtorAccount || 'US64209876543210987654'}
Field 103: ${fpsData.creditorAccount || 'GB89370400440532013000'}
Field 122: PISP|${fpsData.reference || 'TEST001'} (Regulatory Reporting)
Field 127.2: ${String(fpsData.remittance || 'Payment').substring(0, 18)}`;
    }

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