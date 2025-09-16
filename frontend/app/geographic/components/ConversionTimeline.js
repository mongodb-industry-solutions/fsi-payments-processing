'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './ConversionTimeline.module.css';

export default function ConversionTimeline({ conversions, isExecuting, currentStep }) {
  const [expandedStep, setExpandedStep] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const timelineRef = useRef(null);

  useEffect(() => {
    if (isExecuting && currentStep !== null) {
      setExpandedStep(currentStep);
    }
  }, [isExecuting, currentStep]);

  // Handle click outside to collapse timeline
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (timelineRef.current && !timelineRef.current.contains(event.target)) {
        setIsExpanded(false);
        setExpandedStep(null);
      }
    };

    // Use a slight delay to ensure React has processed the click
    const handleDocumentClick = (event) => {
      setTimeout(() => handleClickOutside(event), 0);
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
    };
  }, []);

  if (!conversions || conversions.length === 0) {
    return (
      <div className={styles.timeline}>
        <div className={styles.emptyState}>
          <p>Select a scenario to view the conversion timeline</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={timelineRef} className={`${styles.timeline} ${isExpanded ? styles.expanded : ''}`}>
      <div className={styles.timelineHeader} onClick={(e) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
        if (!isExpanded === false) {
          setExpandedStep(null);
        }
      }}>
        <div className={styles.expandIndicator}>
          <span className={styles.chevron}>{isExpanded ? '▼' : '▲'}</span>
        </div>
        <h4>Conversion Timeline</h4>
        <div className={styles.totalTime}>
          Total: {conversions.reduce((sum, c) => sum + c.time, 0)}ms
        </div>
      </div>

      <div className={styles.timelineContent}>
        {conversions.map((conversion, index) => {
          const isActive = isExecuting && currentStep === index;
          const isCompleted = isExecuting ? currentStep > index : false;
          const isExpanded = expandedStep === index;

          return (
            <div
              key={index}
              className={`${styles.timelineStep} ${isActive ? styles.active : ''} ${isCompleted ? styles.completed : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                const newExpandedStep = expandedStep === index ? null : index;
                setExpandedStep(newExpandedStep);
                setIsExpanded(newExpandedStep !== null);
              }}
            >
              <div className={styles.stepHeader}>
                <div className={styles.stepNumber}>
                  {isCompleted ? '✓' : index + 1}
                </div>
                <div className={styles.stepInfo}>
                  <div className={styles.stepTitle}>
                    <span className={styles.fromFormat}>{conversion.from}</span>
                    <span className={styles.arrow}>→</span>
                    <span className={styles.toFormat}>{conversion.to}</span>
                  </div>
                  <div className={styles.stepMeta}>
                    <span className={styles.location}>{conversion.location}</span>
                    <span className={styles.time}>{conversion.time}ms</span>
                  </div>
                </div>
                {isActive && (
                  <div className={styles.activeIndicator}>
                    <div className={styles.spinner}></div>
                  </div>
                )}
              </div>

              {isExpanded && (
                <div className={styles.stepDetails}>
                  <p className={styles.description}>{conversion.description}</p>

                  <div className={styles.processInfo}>
                    <h5>MongoDB Generic Converter Process:</h5>
                    <ol className={styles.processList}>
                      <li>
                        <strong>PARSE:</strong> Extract {conversion.from} fields using regex patterns from MongoDB config
                      </li>
                      <li>
                        <strong>TRANSFORM:</strong> Apply field mappings to Canonical JSON structure
                      </li>
                      <li>
                        <strong>BUILD:</strong> Construct {conversion.to} format from transformed fields
                      </li>
                    </ol>
                  </div>

                  {conversion.from !== 'JSON' && conversion.to !== 'JSON' && (
                    <div className={styles.jsonBridgeInfo}>
                      <p>💡 This conversion uses JSON as an intermediate bridge format</p>
                    </div>
                  )}

                  {conversion.parallel && (
                    <div className={styles.parallelInfo}>
                      <p>⚡ Running in parallel with other conversions</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}