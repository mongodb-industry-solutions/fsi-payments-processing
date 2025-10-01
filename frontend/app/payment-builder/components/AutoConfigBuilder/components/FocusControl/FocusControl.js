'use client';

import styles from './FocusControl.module.css';

export default function FocusControl({
  currentMode = 'full',
  onModeChange
}) {
  return (
    <div className={styles.controlBar}>
      <div className={styles.segmentedControl}>
        <button
          className={`${styles.segment} ${currentMode === 'inputFocus' ? styles.active : ''}`}
          onClick={() => onModeChange('inputFocus')}
          title="Focus on Configuration Input"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 3L2 7L6 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Input Focus</span>
        </button>

        <button
          className={`${styles.segment} ${styles.centerSegment} ${currentMode === 'full' ? styles.active : ''}`}
          onClick={() => onModeChange('full')}
          title="Normal View - Show Both Panels"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="3" width="5" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="9" y="3" width="5" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          <span>Normal View</span>
        </button>

        <button
          className={`${styles.segment} ${currentMode === 'journeyFocus' ? styles.active : ''}`}
          onClick={() => onModeChange('journeyFocus')}
          title="Focus on Configuration Journey"
        >
          <span>Journey Focus</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L14 7L10 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}