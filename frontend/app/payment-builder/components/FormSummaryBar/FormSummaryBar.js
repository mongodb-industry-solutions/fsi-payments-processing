'use client';

import styles from './FormSummaryBar.module.css';

export default function FormSummaryBar({
  sourceFormat,
  targetFormat,
  fieldCount,
  amount,
  currency,
  isExpanded,
  onToggle
}) {
  const formatCurrency = (amt, cur) => {
    if (!amt) return '';
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: cur || 'USD',
      minimumFractionDigits: 2
    });
    return formatter.format(amt);
  };

  return (
    <div className={styles.summaryBar} onClick={onToggle}>
      <div className={styles.summaryContent}>
        <span className={styles.statusIcon}>✓</span>
        <span className={styles.conversionType}>
          {sourceFormat || 'MT103'} → {targetFormat || 'pacs.008'}
        </span>
        <span className={styles.separator}>•</span>
        <span className={styles.fieldCount}>{fieldCount || 0} fields configured</span>
        {amount && (
          <>
            <span className={styles.separator}>•</span>
            <span className={styles.amount}>{formatCurrency(amount, currency)}</span>
          </>
        )}
        <span className={styles.separator}>•</span>
        <span className={styles.status}>Ready to process</span>
      </div>
      <button
        className={styles.expandBtn}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        aria-label={isExpanded ? "Collapse form" : "Expand form"}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d={isExpanded ? "M12 10L8 6L4 10" : "M12 6L8 10L4 6"}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}