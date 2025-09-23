import React from 'react';
import styles from './InfoCallout.module.css';

const InfoCallout = ({ title, children, variant = 'info' }) => {
  return (
    <div className={`${styles.infoCallout} ${styles[variant]}`}>
      {title && (
        <div className={styles.infoCalloutTitle}>
          <span className={styles.icon}>
            {variant === 'info' && '💡'}
            {variant === 'success' && '✓'}
            {variant === 'warning' && '⚠️'}
            {variant === 'processing' && '📊'}
          </span>
          {title}
        </div>
      )}
      <div className={styles.infoCalloutText}>
        {children}
      </div>
    </div>
  );
};

export default InfoCallout;