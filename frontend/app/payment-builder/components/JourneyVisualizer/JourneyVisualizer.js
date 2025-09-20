'use client';

import { useState, useEffect } from 'react';
import styles from './JourneyVisualizer.module.css';
import ProcessingFlow from './ProcessingFlow';
import LaneDistribution from './LaneDistribution';
import ConfidenceTracker from './ConfidenceTracker';
import MongoDBOperations from './MongoDBOperations.js';
import ConversionMapping from '../ConversionMapping/ConversionMapping';
import paymentBuilderService from '../../services/paymentBuilderService';

export default function JourneyVisualizer({
  paymentType,
  isProcessing,
  executionResult,
  isPanelCollapsed,
  isFormCollapsed,
  onToggleFormCollapse,
  formData,
  convertedMessage,
  focusedPanel
}) {
  const [activeTab, setActiveTab] = useState('flow');
  const [animationStep, setAnimationStep] = useState(0);

  useEffect(() => {
    if (isProcessing) {
      // Animate through stages during processing
      setAnimationStep(1);
      const timer1 = setTimeout(() => setAnimationStep(2), 500);
      const timer2 = setTimeout(() => setAnimationStep(3), 1500);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    } else if (executionResult) {
      setAnimationStep(4); // Complete
    } else {
      setAnimationStep(0); // Reset
    }
  }, [isProcessing, executionResult]);

  if (!paymentType) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
            <circle cx="24" cy="12" r="3" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
            <circle cx="36" cy="12" r="3" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
            <path d="M12 15v10M24 15v10M36 15v10" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
            <rect x="8" y="28" width="32" height="12" rx="2" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
          </svg>
          <h3>Conversion Journey</h3>
          <p>Select a payment type to see the processing journey</p>
        </div>
      </div>
    );
  }

  // Determine panel states
  const isCollapsed = focusedPanel === 'payment-details';
  const isExpanded = focusedPanel === 'journey';

  // Show collapsed bar if Payment Details is focused
  if (isCollapsed) {
    return (
      <div className={styles.collapsedBar}>
        <div className={styles.collapsedContent}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className={styles.collapsedIcon}>
            <circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="10" cy="6" r="2" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="14" cy="6" r="2" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M6 8v4M10 8v4M14 8v4" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="3" y="14" width="14" height="3" rx="1" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          <span className={styles.collapsedTitle}>Conversion Journey</span>
          {executionResult && (
            <span className={styles.collapsedInfo}>
              Completed • {executionResult.conversion_metadata?.processing_time_seconds?.toFixed(2)}s • {(executionResult.conversion_metadata?.confidence_scores?.overall * 100 || 92).toFixed(0)}% confidence
            </span>
          )}
          {isProcessing && (
            <span className={styles.collapsedInfo}>Processing...</span>
          )}
          {!executionResult && !isProcessing && (
            <span className={styles.collapsedInfo}>{activeTab} view</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${isExpanded ? styles.expanded : ''}`}>
      {/* Header with Tabs */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h3>Conversion Journey</h3>
        </div>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'flow' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('flow')}
          >
            Flow
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'mapping' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('mapping')}
          >
            Mapping
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'confidence' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('confidence')}
          >
            Confidence
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'lanes' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('lanes')}
          >
            Lanes
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'mongodb' ? styles.activeTab : ''} ${styles.mongodbTab}`}
            onClick={() => setActiveTab('mongodb')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginRight: '4px' }}>
              <path d="M7 1L3 3.5V8C3 11 7 13 7 13C7 13 11 11 11 8V3.5L7 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M7 5V11M5 7H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            MongoDB
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className={styles.content}>
        {activeTab === 'flow' && (
          <ProcessingFlow
            sourceFormat={paymentType.sourceFormat}
            targetFormat={paymentType.targetFormat}
            currentStage={animationStep}
            executionResult={executionResult}
          />
        )}

        {activeTab === 'mapping' && (
          convertedMessage && formData ? (
            <ConversionMapping
              sourceMessage={paymentBuilderService.constructMessage(
                paymentType,
                formData
              )}
              targetMessage={convertedMessage}
              sourceFormat={paymentType.sourceFormat}
              targetFormat={paymentType.targetFormat}
              mappingData={executionResult?.conversion_metadata?.field_mappings}
            />
          ) : (
            <div className={styles.emptyMapping}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <path d="M12 24h24M30 18l6 6-6 6" stroke="currentColor" strokeWidth="2" opacity="0.3" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="4" y="12" width="14" height="24" rx="2" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
                <rect x="30" y="12" width="14" height="24" rx="2" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
              </svg>
              <h4>Field Mapping</h4>
              <p>Complete a conversion to see field mappings</p>
            </div>
          )
        )}

        {activeTab === 'confidence' && (
          <ConfidenceTracker
            executionResult={executionResult}
            isProcessing={isProcessing}
          />
        )}

        {activeTab === 'lanes' && (
          <LaneDistribution
            executionResult={executionResult}
            isProcessing={isProcessing}
          />
        )}

        {activeTab === 'mongodb' && (
          <MongoDBOperations
            executionResult={executionResult}
            isProcessing={isProcessing}
            paymentType={paymentType}
          />
        )}
      </div>

      {/* Stats Footer */}
      {executionResult && (
        <div className={styles.statsFooter}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Processing Time</span>
            <span className={styles.statValue}>
              {executionResult.conversion_metadata?.processing_time_seconds?.toFixed(2)}s
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>MongoDB Ops</span>
            <span className={styles.statValue}>
              {executionResult.conversion_metadata?.mongodb_operations || 15}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Confidence</span>
            <span className={styles.statValue}>
              {(executionResult.conversion_metadata?.confidence_scores?.overall * 100 || 92).toFixed(0)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}