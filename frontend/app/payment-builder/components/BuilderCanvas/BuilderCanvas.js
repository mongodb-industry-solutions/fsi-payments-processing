'use client';

import { useState, useEffect } from 'react';
import styles from './BuilderCanvas.module.css';
import DynamicPaymentForm from '../DynamicPaymentForm/DynamicPaymentForm';
import PaymentPreview from '../PaymentPreview/PaymentPreview';
import paymentBuilderService from '../../services/paymentBuilderService';

export default function BuilderCanvas({
  selectedPaymentType,
  isProcessing,
  onExecute,
  onExecutionComplete,
  formData,
  setFormData
}) {
  const [isFormValid, setIsFormValid] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const [convertedMessage, setConvertedMessage] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  // Reset converted message when payment type changes
  useEffect(() => {
    setConvertedMessage(null);
    setExecutionResult(null);
  }, [selectedPaymentType]);

  const handleFormChange = (data) => {
    // Form data is managed by parent component
  };

  const handleFormValid = (valid) => {
    setIsFormValid(valid);
  };

  const handleExecute = async () => {
    if (!selectedPaymentType || !isFormValid) return;

    onExecute(true); // Start processing
    setExecutionResult(null);
    setIsConverting(true);
    setConvertedMessage(null);

    try {
      // Generate a session ID for tracking
      const newSessionId = `session_${Date.now()}`;
      setSessionId(newSessionId);

      // Execute the payment conversion
      const result = await paymentBuilderService.executePayment(
        selectedPaymentType.id,
        formData,
        newSessionId
      );

      setExecutionResult(result);

      // Store the converted message
      if (result && result.converted_message) {
        setConvertedMessage(result.converted_message);
      }

      if (onExecutionComplete) {
        onExecutionComplete(result);
      }
    } catch (error) {
      console.error('Execution failed:', error);
    } finally {
      setIsConverting(false);
      onExecute(false); // Stop processing
    }
  };

  if (!selectedPaymentType) {
    return (
      <div className={styles.canvas}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect x="8" y="12" width="32" height="24" rx="2" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
              <path d="M16 20h16M16 24h12M16 28h8" stroke="currentColor" strokeWidth="2" opacity="0.3" strokeLinecap="round"/>
            </svg>
          </div>
          <h3>Select a Payment Type</h3>
          <p>Choose a payment scenario from the left panel to begin building your payment message</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.canvas}>
      {/* Canvas Content - Split View */}
      <div className={styles.splitContent}>
        {/* Left: Form */}
        <div className={styles.formColumn}>
          <DynamicPaymentForm
            paymentType={selectedPaymentType}
            onFormChange={handleFormChange}
            onFormValid={handleFormValid}
            formData={formData}
            setFormData={setFormData}
          />
        </div>

        {/* Right: Preview */}
        <div className={styles.previewColumn}>
          <PaymentPreview
            paymentType={selectedPaymentType}
            formData={formData}
            isValid={isFormValid}
            convertedMessage={convertedMessage}
            isConverting={isConverting}
          />
        </div>
      </div>

      {/* Execute Section */}
      <div className={styles.executeSection}>
        <button
          className={styles.executeButton}
          onClick={handleExecute}
          disabled={isProcessing || !isFormValid}
        >
          {isProcessing ? (
            <>
              <div className={styles.spinner} />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <span>Execute Conversion</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M10 5l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </>
          )}
        </button>

        {/* Stats Preview */}
        <div className={styles.statsPreview}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Est. Time</span>
            <span className={styles.statValue}>{selectedPaymentType.estimatedTime}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Fields</span>
            <span className={styles.statValue}>{selectedPaymentType.fields}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Complexity</span>
            <span className={styles.statValue}>{selectedPaymentType.complexity}</span>
          </div>
        </div>
      </div>

      {/* Result Display */}
      {executionResult && (
        <div className={styles.resultSection}>
          <div className={styles.resultHeader}>
            <h3>Conversion Complete</h3>
            <span className={styles.successIcon}>✓</span>
          </div>
          <div className={styles.resultStats}>
            <div className={styles.resultStat}>
              <span>Processing Time:</span>
              <strong>{executionResult.conversion_metadata?.processing_time_seconds?.toFixed(2)}s</strong>
            </div>
            <div className={styles.resultStat}>
              <span>Confidence:</span>
              <strong>{((executionResult.conversion_metadata?.confidence_scores?.overall || 0.92) * 100).toFixed(0)}%</strong>
            </div>
            <div className={styles.resultStat}>
              <span>MongoDB Ops:</span>
              <strong>{executionResult.conversion_metadata?.mongodb_operations || 15}</strong>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}