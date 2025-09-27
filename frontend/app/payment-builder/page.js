'use client';

import { useState } from 'react';
import styles from './page.module.css';
import PaymentTypesPanel from './components/PaymentTypesPanel/PaymentTypesPanel';
import BuilderCanvas from './components/BuilderCanvas/BuilderCanvas';
import JourneyVisualizer from './components/JourneyVisualizer/JourneyVisualizer';
import FocusControl from './components/FocusControl/FocusControl';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import AutoConfigBuilder from './components/AutoConfigBuilder/AutoConfigBuilder';

export default function PaymentBuilder() {
  const [selectedPaymentType, setSelectedPaymentType] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const [formData, setFormData] = useState({});
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [isFormCollapsed, setIsFormCollapsed] = useState(false);
  const [convertedMessage, setConvertedMessage] = useState(null);
  const [focusedPanel, setFocusedPanel] = useState('none'); // 'none' | 'payment-details' | 'journey'
  const [showAutoConfig, setShowAutoConfig] = useState(false);
  const [autoConfigScenario, setAutoConfigScenario] = useState(null);

  const handlePaymentTypeSelect = (paymentType) => {
    // Toggle deselection if clicking the same payment type
    if (selectedPaymentType?.id === paymentType.id) {
      setSelectedPaymentType(null);
      setExecutionResult(null);
      setFormData({});
      setFocusedPanel('none');
      setShowAutoConfig(false);
      // Optionally expand panel when deselecting
      // setIsPanelCollapsed(false);
      return;
    }

    setSelectedPaymentType(paymentType);
    setExecutionResult(null);
    setFormData({});
    // Auto-collapse panel after selection
    setIsPanelCollapsed(true);
    setIsFormCollapsed(false);
    // Reset focus when selecting new payment type
    setFocusedPanel('none');
    // Close auto-config if open
    setShowAutoConfig(false);
  };

  const handleAutoConfigSelect = (scenario) => {
    setAutoConfigScenario(scenario);
    setShowAutoConfig(true);
    setSelectedPaymentType(null);
    setExecutionResult(null);
    setFormData({});
  };

  const handleAutoConfigClick = () => {
    // Treat auto-config as a special payment type selection
    const autoConfigType = {
      id: 'auto_config',
      name: 'Configure New Format',
      type: 'configuration',
      isAutoConfig: true
    };
    setSelectedPaymentType(autoConfigType);
    setExecutionResult(null);
    setFormData({});
    setIsPanelCollapsed(true); // Collapse panel like normal selection
    setIsFormCollapsed(false);
    setFocusedPanel('none');
    setShowAutoConfig(false); // We won't use modal anymore
  };

  const handleAutoConfigComplete = (configResult) => {
    // Add the new format as a payment type
    const newPaymentType = {
      id: configResult.configuration_id,
      name: `${configResult.configuration_id.replace('_to_', ' → ')}`,
      sourceFormat: configResult.configuration_id.split('_to_')[0],
      targetFormat: configResult.configuration_id.split('_to_')[1],
      complexity: 'auto',
      estimatedTime: '1-3s',
      fields: configResult.fields_mapped,
      isAutoConfigured: true
    };

    setSelectedPaymentType(newPaymentType);
    setShowAutoConfig(false);
    setAutoConfigScenario(null);
  };

  const handleAutoConfigCancel = () => {
    setShowAutoConfig(false);
    setAutoConfigScenario(null);
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
          onAddNewFormat={handleAutoConfigClick}
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
          {/* Only show FocusControl for regular payment types */}
          {selectedPaymentType && !selectedPaymentType.isAutoConfig && (
            <FocusControl
              focusedPanel={focusedPanel}
              onFocusChange={handleFocusChange}
              hasExecutionResult={!!executionResult}
              selectedPaymentType={selectedPaymentType}
            />
          )}

          {/* Conditionally show AutoConfigBuilder or BuilderCanvas */}
          {selectedPaymentType?.isAutoConfig ? (
            <AutoConfigBuilder
              embedded={true}
              onClose={() => {
                setSelectedPaymentType(null);
                setAutoConfigScenario(null);
              }}
            />
          ) : (
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
          )}

          {/* Journey Visualizer - or Config Progress for auto-config */}
          {selectedPaymentType && !selectedPaymentType.isAutoConfig && (
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