'use client';

import { useState, useEffect } from 'react';
import styles from './AutoConfigDemo.module.css';
import ScenarioSelectionStage from './stages/ScenarioSelectionStage';
import SetupStage from './stages/SetupStage';
import GeneratingStage from './stages/GeneratingStage';
import ReviewStage from './stages/ReviewStage';
import EnhancedReviewStage from './stages/EnhancedReviewStage';
import paymentBuilderService from '../../services/paymentBuilderService';
import { useAutoConfigProgress } from '../../hooks/useAutoConfigProgress';

export default function AutoConfigDemo({
  scenario,
  onComplete,
  onCancel,
  isCustom = false,
  embedded = false
}) {
  // Stage management: 'selection' -> 'setup' -> 'generating' -> 'review' -> 'complete'
  const [stage, setStage] = useState(scenario ? 'setup' : 'selection');
  const [selectedScenario, setSelectedScenario] = useState(scenario);
  const [sampleMessage, setSampleMessage] = useState('');
  const [configResult, setConfigResult] = useState(null);
  const [error, setError] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [generationProgress, setGenerationProgress] = useState(null);

  // Use the real progress hook for backend integration
  const {
    isConfiguring,
    configResult: realConfigResult,
    progress,
    startConfiguration,
    reset: resetProgress
  } = useAutoConfigProgress();

  // Custom format state (when isCustom is true)
  const [customConfig, setCustomConfig] = useState({
    sourceFormat: '',
    targetFormat: 'pacs.008',
    similarTo: 'MT103',
    sampleMessage: ''
  });

  // Load scenario data on mount or when selected
  useEffect(() => {
    if ((scenario || selectedScenario) && !isCustom) {
      // For demo scenarios, load the sample message
      loadScenarioData();
    }
  }, [scenario, selectedScenario]);

  // Timer for generation phase
  useEffect(() => {
    let interval;
    if (stage === 'generating' && startTime) {
      interval = setInterval(() => {
        setElapsedTime((Date.now() - startTime) / 1000);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [stage, startTime]);

  const loadScenarioData = async () => {
    try {
      // For now, use hardcoded sample messages based on scenario
      const samples = {
        mt192_to_pacs008: `{1:F01CHASUS33XXXX0000000000}{2:I192DEUTDEFFXXXXN}{3:{108:PRIORITY}}{4:
:20:REF192TEST001
:21:RELATEDREF001
:11S:192
241215
1234
:79:CANCELLATION REQUEST FOR WIRE TRANSFER
ORIGINAL REF: TEST001
REASON: DUPLICATE PAYMENT
REQUESTED BY: JOHN DOE
ACCOUNT: US64209876543210987654
AMOUNT: USD 125,750.50
BENEFICIARY: GLOBAL SUPPLIES GMBH
URGENT PROCESSING REQUIRED
-}`,
        mt205_to_pacs009: `{1:F01CHASUS33AXXX0000000000}{2:I205DEUTDEFFXXXXN}{3:{108:PRIORITY}}{4:
:20:MT205TEST2024
:21:RELREF20241115
:13C:/CLSTIME/0830+0100
:32A:241215EUR500000,00
:52A:UBSWCHZHXXX
:57A:DEUTDEFFXXX
:58A:/DE98765432109876543210
COBADEFFXXX
:72:/BNF/PRIORITY SETTLEMENT
/INS/SAME DAY VALUE
/ACC/COVER FOR FI TRANSFER
-}`,
        mt202cov_to_pacs009: `{1:F01BOFAUS3NXXXX0000000000}{2:I202CHASUS33XXXXN}{3:{119:COV}}{4:
:20:MT202COVTEST
:21:COVER2024001
:13C:/SNDTIME/0915+0500
:32A:241215USD1000000,00
:52A:BOFAUS3NXXX
:53A:/NOSTRO123456
CORRESPONDENT BANK
:57A:CHASUS33XXX
:58A:/US98765432109876543210
JP MORGAN CHASE
NEW YORK
:72:/BNF/COVER PAYMENT
/INS/UNDERLYING CUSTOMER TRANSFER
/REC/CREDIT UPON RECEIPT
:50A:/US11111111111111111111
ORIGINAL ORDERING CUSTOMER
BOSTON MA
:59A:/US22222222222222222222
FINAL BENEFICIARY
SAN FRANCISCO CA
:70:PAYMENT FOR INVOICE INV-2024-9999
COVER FOR CUSTOMER WIRE
:71A:SHA
-}`
      };

      const currentScenario = selectedScenario || scenario;
      setSampleMessage(samples[currentScenario.scenario || currentScenario.id] || '');
    } catch (error) {
      console.error('Error loading scenario data:', error);
      setError('Failed to load scenario data');
    }
  };

  const handleScenarioSelect = (selected) => {
    setSelectedScenario(selected);
    if (selected.isCustom) {
      // Handle custom scenario differently
      setStage('setup');
      // You might want to set isCustom state here
    } else {
      setStage('setup');
      // Load the sample message for the selected scenario
      const samples = {
        mt192_to_pacs008: `{1:F01CHASUS33XXXX0000000000}{2:I192DEUTDEFFXXXXN}{3:{108:PRIORITY}}{4:
:20:REF192TEST001
:21:RELATEDREF001
:11S:192
241215
1234
:79:CANCELLATION REQUEST FOR WIRE TRANSFER
ORIGINAL REF: TEST001
REASON: DUPLICATE PAYMENT
REQUESTED BY: JOHN DOE
ACCOUNT: US64209876543210987654
AMOUNT: USD 125,750.50
BENEFICIARY: GLOBAL SUPPLIES GMBH
URGENT PROCESSING REQUIRED
-}`,
        mt205_to_pacs009: `{1:F01CHASUS33AXXX0000000000}{2:I205DEUTDEFFXXXXN}{3:{108:PRIORITY}}{4:
:20:MT205TEST2024
:21:RELREF20241115
:13C:/CLSTIME/0830+0100
:32A:241215EUR500000,00
:52A:UBSWCHZHXXX
:57A:DEUTDEFFXXX
:58A:/DE98765432109876543210
COBADEFFXXX
:72:/BNF/PRIORITY SETTLEMENT
/INS/SAME DAY VALUE
/ACC/COVER FOR FI TRANSFER
-}`,
        mt202cov_to_pacs009: `{1:F01BOFAUS3NXXXX0000000000}{2:I202CHASUS33XXXXN}{3:{119:COV}}{4:
:20:MT202COVTEST
:21:COVER2024001
:13C:/SNDTIME/0915+0500
:32A:241215USD1000000,00
:52A:BOFAUS3NXXX
:53A:/NOSTRO123456
CORRESPONDENT BANK
:57A:CHASUS33XXX
:58A:/US98765432109876543210
JP MORGAN CHASE
NEW YORK
:72:/BNF/COVER PAYMENT
/INS/UNDERLYING CUSTOMER TRANSFER
/REC/CREDIT UPON RECEIPT
:50A:/US11111111111111111111
ORIGINAL ORDERING CUSTOMER
BOSTON MA
:59A:/US22222222222222222222
FINAL BENEFICIARY
SAN FRANCISCO CA
:70:PAYMENT FOR INVOICE INV-2024-9999
COVER FOR CUSTOMER WIRE
:71A:SHA
-}`
      };
      setSampleMessage(samples[selected.id] || '');
    }
  };

  const handleStartAutoConfig = async () => {
    setStage('generating');
    setStartTime(Date.now());
    setError(null);

    try {
      const currentScenario = selectedScenario || scenario;
      const sourceFormat = currentScenario.sourceFormat || currentScenario.name?.split(' → ')[0];
      const config = (isCustom || currentScenario?.isCustom) ? customConfig : {
        sourceFormat: sourceFormat,
        targetFormat: currentScenario.targetFormat || currentScenario.name?.split(' → ')[1],
        sampleMessage: sampleMessage,
        // Use scenario's similarTo if available, otherwise default based on format family
        similarTo: currentScenario.similarTo || (sourceFormat?.startsWith('MT') ? 'MT' : 'MT103')
      };

      // Use the real backend hook
      const { result } = await startConfiguration(
        config.sourceFormat,
        config.targetFormat,
        config.sampleMessage || sampleMessage,
        config.similarTo
      );

      setConfigResult(result);

      // Wait for animation to complete
      setTimeout(() => {
        // Store the final progress state for review
        setGenerationProgress(progress);
        setStage('review');
      }, 4500);
    } catch (error) {
      console.error('Auto-configuration failed:', error);
      setError(error.message || 'Auto-configuration failed');
      setStage('setup');
    }
  };

  const handleReview = async (corrections) => {
    if (configResult) {
      try {
        // Merge corrections into the configuration
        const updatedConfig = {
          ...configResult.configuration,
          ...corrections
        };

        // Send the full configuration for approval
        await paymentBuilderService.validateAutoConfig(
          configResult.configuration_id,
          updatedConfig,  // Pass full config as corrections
          true  // approved = true
        );
      } catch (error) {
        console.error('Failed to apply corrections:', error);
      }
    }

    setStage('complete');
    if (onComplete) {
      onComplete(configResult);
    }
  };

  const handleCancel = async () => {
    // If we're in the review stage with a config result, send rejection
    if (stage === 'review' && configResult) {
      try {
        await paymentBuilderService.validateAutoConfig(
          configResult.configuration_id,
          null,  // No corrections needed for rejection
          false  // approved = false
        );
      } catch (error) {
        console.error('Failed to reject configuration:', error);
      }
    }

    if (onCancel) {
      onCancel();
    }
  };

  return (
    <div className={embedded ? styles.embeddedContainer : styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h2>
            {stage === 'selection'
              ? 'Auto-Configure Payment Format'
              : isCustom
              ? 'Configure Custom Format'
              : `Auto-Configure ${selectedScenario?.name || scenario?.sourceFormat || ''}`}
          </h2>
          <p className={styles.subtitle}>
            {stage === 'selection'
              ? 'Choose from pre-built scenarios or configure a custom format'
              : isCustom
              ? 'Add your own payment format using AI-powered configuration'
              : `Generate configuration for ${selectedScenario?.name || (scenario?.sourceFormat + ' to ' + scenario?.targetFormat)}`
            }
          </p>
        </div>
        {!embedded && (
          <button className={styles.closeButton} onClick={handleCancel}>
            ✕
          </button>
        )}
      </div>

      {/* Stage Indicator - Only show if past selection stage */}
      {stage !== 'selection' && (
        <div className={styles.stageIndicator}>
          <div className={`${styles.stage} ${stage === 'setup' ? styles.active : stage !== 'setup' && stage !== 'selection' ? styles.complete : ''}`}>
            <span className={styles.stageNumber}>1</span>
            <span className={styles.stageLabel}>Setup</span>
          </div>
          <div className={styles.stageLine} />
          <div className={`${styles.stage} ${stage === 'generating' ? styles.active : stage === 'review' || stage === 'complete' ? styles.complete : ''}`}>
            <span className={styles.stageNumber}>2</span>
            <span className={styles.stageLabel}>Generate</span>
          </div>
          <div className={styles.stageLine} />
          <div className={`${styles.stage} ${stage === 'review' ? styles.active : stage === 'complete' ? styles.complete : ''}`}>
            <span className={styles.stageNumber}>3</span>
            <span className={styles.stageLabel}>Review</span>
          </div>
        </div>
      )}

      {/* Stage Content */}
      <div className={styles.content}>
        {error && (
          <div className={styles.errorMessage}>
            <span className={styles.errorIcon}>⚠️</span>
            {error}
          </div>
        )}

        {stage === 'selection' && (
          <ScenarioSelectionStage onSelectScenario={handleScenarioSelect} />
        )}

        {stage === 'setup' && (
          <SetupStage
            scenario={selectedScenario || scenario}
            sampleMessage={sampleMessage}
            onSampleMessageChange={setSampleMessage}
            onStart={handleStartAutoConfig}
            isCustom={isCustom || selectedScenario?.isCustom}
            customConfig={customConfig}
            onCustomConfigChange={setCustomConfig}
          />
        )}

        {stage === 'generating' && (
          <GeneratingStage
            scenario={selectedScenario || scenario}
            elapsedTime={progress.elapsedTime || elapsedTime}
            isCustom={isCustom || selectedScenario?.isCustom}
            customConfig={customConfig}
            progress={progress}
            useRealData={isConfiguring}
          />
        )}

        {stage === 'review' && configResult && (
          <EnhancedReviewStage
            configResult={realConfigResult || configResult}
            generationProgress={generationProgress}
            onApprove={handleReview}
            onReject={handleCancel}
          />
        )}

        {stage === 'complete' && (
          <div className={styles.completeStage}>
            <div className={styles.successIcon}>✅</div>
            <h3>Configuration Complete!</h3>
            <p>The new format has been successfully configured and is ready to use.</p>
            <div className={styles.completeStats}>
              <div className={styles.stat}>
                <label>Configuration ID:</label>
                <span>{configResult?.configuration_id}</span>
              </div>
              <div className={styles.stat}>
                <label>Overall Confidence:</label>
                <span>{(configResult?.confidence * 100).toFixed(0)}%</span>
              </div>
              <div className={styles.stat}>
                <label>Generation Time:</label>
                <span>{elapsedTime.toFixed(1)}s</span>
              </div>
            </div>
            <button className={styles.useNowButton} onClick={() => onComplete(configResult)}>
              Use This Format Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}