'use client';

import { useState } from 'react';
import styles from './page.module.css';
import PaymentTypesPanel from './components/PaymentTypesPanel/PaymentTypesPanel';
import BuilderCanvas from './components/BuilderCanvas/BuilderCanvas';
import JourneyVisualizer from './components/JourneyVisualizer/JourneyVisualizer';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';

export default function PaymentBuilder() {
  const [selectedPaymentType, setSelectedPaymentType] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const [formData, setFormData] = useState({});

  const handlePaymentTypeSelect = (paymentType) => {
    setSelectedPaymentType(paymentType);
    setExecutionResult(null);
    setFormData({});
  };

  const handleExecute = (processing) => {
    setIsProcessing(processing);
    if (processing) {
      setExecutionResult(null);
    }
  };

  const handleExecutionComplete = (result) => {
    setExecutionResult(result);
  };

  return (
    <div className={styles.container}>
      {/* Left Panel - Payment Type Selection */}
      <ErrorBoundary fallbackMessage="Failed to load payment types. Please refresh the page.">
        <PaymentTypesPanel
          selectedType={selectedPaymentType}
          onSelectType={handlePaymentTypeSelect}
        />
      </ErrorBoundary>

      {/* Center/Right - Builder Canvas and Visualizations */}
      <div className={styles.mainContent}>
        <ErrorBoundary
          fallbackMessage="An error occurred in the payment builder. Please try again."
          onReset={() => {
            setSelectedPaymentType(null);
            setExecutionResult(null);
            setFormData({});
          }}
        >
          <BuilderCanvas
            selectedPaymentType={selectedPaymentType}
            isProcessing={isProcessing}
            onExecute={handleExecute}
            onExecutionComplete={handleExecutionComplete}
            formData={formData}
            setFormData={setFormData}
          />

          {/* Journey Visualizer */}
          {selectedPaymentType && (
            <JourneyVisualizer
              paymentType={selectedPaymentType}
              isProcessing={isProcessing}
              executionResult={executionResult}
            />
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}