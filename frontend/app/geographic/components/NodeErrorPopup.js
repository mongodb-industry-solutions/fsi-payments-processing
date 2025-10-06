'use client';

import React from 'react';
import Icon from '@leafygreen-ui/icon';
import { palette } from '@leafygreen-ui/palette';
import { H3, Body } from '@leafygreen-ui/typography';
import styles from './NodeErrorPopup.module.css';

const NodeErrorPopup = ({ isOpen, position, onFix, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className={styles.errorPopup}>
      <div className={styles.popupHeader}>
        <Icon glyph="Warning" size="small" fill={palette.red.base} />
        <span className={styles.errorTitle}>Parsing Error Detected</span>
        <button className={styles.closeButton} onClick={onClose}>
          <Icon glyph="X" size="xsmall" fill={palette.gray.dark1} />
        </button>
      </div>

      <div className={styles.popupContent}>
        <div className={styles.errorDetails}>
          <Body className={styles.errorMessage}>
            <strong>Field 59 Parse Failed</strong>
          </Body>
          <Body className={styles.errorDescription}>
            Correspondent bank CORRBANKXXX is using non-standard delimiter (///)
            instead of line breaks in beneficiary field.
          </Body>
        </div>

        <div className={styles.errorSample}>
          <div className={styles.sampleLabel}>Problematic Data:</div>
          <pre className={styles.sampleCode}>
            :59:/ZA123456789///SOUTH AFRICAN HEALTH///SANDTON
          </pre>
        </div>

        <div className={styles.fixOptions}>
          <button className={styles.fixButton} onClick={onFix}>
            <Icon glyph="Sparkle" size="small" fill={palette.white} />
            <span>Fix with Self-Healing LLM Agent</span>
          </button>
          <Body className={styles.fixHint}>
            The LLM agent will analyze the pattern and create a BIC-specific parsing rule in MongoDB
          </Body>
        </div>
      </div>
    </div>
  );
};

export default NodeErrorPopup;