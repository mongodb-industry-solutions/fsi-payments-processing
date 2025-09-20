'use client';

import { useState } from 'react';
import styles from './page.module.css';
import PaymentTypesPanel from './components/PaymentTypesPanel/PaymentTypesPanel';
import BuilderCanvas from './components/BuilderCanvas/BuilderCanvas';
import JourneyVisualizer from './components/JourneyVisualizer/JourneyVisualizer';
import FocusControl from './components/FocusControl/FocusControl';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';

export default function PaymentBuilder() {
  const [selectedPaymentType, setSelectedPaymentType] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const [formData, setFormData] = useState({});
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [isFormCollapsed, setIsFormCollapsed] = useState(false);
  const [convertedMessage, setConvertedMessage] = useState(null);
  const [focusedPanel, setFocusedPanel] = useState('none'); // 'none' | 'payment-details' | 'journey'

  const handlePaymentTypeSelect = (paymentType) => {
    setSelectedPaymentType(paymentType);
    setExecutionResult(null);
    setFormData({});
    // Auto-collapse panel after selection
    setIsPanelCollapsed(true);
    setIsFormCollapsed(false);
    // Reset focus when selecting new payment type
    setFocusedPanel('none');
  };

  const togglePanelCollapse = () => {
    setIsPanelCollapsed(!isPanelCollapsed);
  };

  const toggleFormCollapse = () => {
    setIsFormCollapsed(!isFormCollapsed);
  };

  const handleFocusChange = (newFocus) => {
    setFocusedPanel(focusedPanel === newFocus ? 'none' : newFocus);
  };

  const handleExecute = (processing) => {
    setIsProcessing(processing);
    if (processing) {
      setExecutionResult(null);
      // Don't auto-collapse form - let user control it
    }
  };

  const handleExecutionComplete = (result) => {
    setExecutionResult(result);
    if (result && result.converted_message) {
      setConvertedMessage(result.converted_message);
    }
  };

  return (
    <div className={styles.container}>
      {/* Left Panel - Payment Type Selection */}
      <ErrorBoundary fallbackMessage="Failed to load payment types. Please refresh the page.">
        <PaymentTypesPanel
          selectedType={selectedPaymentType}
          onSelectType={handlePaymentTypeSelect}
          isCollapsed={isPanelCollapsed}
          onToggleCollapse={togglePanelCollapse}
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
          {/* Focus Control - Central control for view modes */}
          <FocusControl
            focusedPanel={focusedPanel}
            onFocusChange={handleFocusChange}
            hasExecutionResult={!!executionResult}
            selectedPaymentType={selectedPaymentType}
          />

          <BuilderCanvas
            selectedPaymentType={selectedPaymentType}
            isProcessing={isProcessing}
            onExecute={handleExecute}
            onExecutionComplete={handleExecutionComplete}
            formData={formData}
            setFormData={setFormData}
            isFormCollapsed={isFormCollapsed}
            onToggleFormCollapse={toggleFormCollapse}
            focusedPanel={focusedPanel}
          />

          {/* Journey Visualizer */}
          {selectedPaymentType && (
            <JourneyVisualizer
              paymentType={selectedPaymentType}
              isProcessing={isProcessing}
              executionResult={executionResult}
              isPanelCollapsed={isPanelCollapsed}
              isFormCollapsed={isFormCollapsed}
              onToggleFormCollapse={toggleFormCollapse}
              formData={formData}
              convertedMessage={convertedMessage}
              focusedPanel={focusedPanel}
            />
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}