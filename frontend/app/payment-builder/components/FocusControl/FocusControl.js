'use client';

import styles from './FocusControl.module.css';

export default function FocusControl({
  focusedPanel,
  onFocusChange,
  hasExecutionResult,
  selectedPaymentType
}) {
  if (!selectedPaymentType) return null;

  return (
    <div className={styles.controlBar}>
      <div className={styles.segmentedControl}>
        <button
          className={`${styles.segment} ${focusedPanel === 'payment-details' || focusedPanel === 'none' ? styles.active : ''}`}
          onClick={() => onFocusChange('payment-details')}
          title="Focus on Payment Details"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 3L2 7L6 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>{hasExecutionResult ? 'Preview' : 'Convert'}</span>
        </button>

        <button
          className={`${styles.segment} ${focusedPanel === 'journey' ? styles.active : ''}`}
          onClick={() => onFocusChange('journey')}
          title="Focus on Conversion Journey"
        >
          <span>Details</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L14 7L10 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}