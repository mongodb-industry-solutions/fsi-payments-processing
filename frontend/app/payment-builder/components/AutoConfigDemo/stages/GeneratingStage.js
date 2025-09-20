'use client';

import { useState, useEffect } from 'react';
import styles from './GeneratingStage.module.css';
import ConfidenceMeter from '../visualizers/ConfidenceMeter';
import SemanticPatternMatcher from '../visualizers/SemanticPatternMatcher';
import FieldDetectionList from '../visualizers/FieldDetectionList';
import ProcessingTimeline from '../visualizers/ProcessingTimeline';
import MongoDBActivityFeed from '../panels/MongoDBActivityFeed';

export default function GeneratingStage({
  scenario,
  elapsedTime,
  isCustom,
  customConfig,
  progress = null,  // Real progress data from hook
  useRealData = false  // Toggle between real and simulated data
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [detectedFields, setDetectedFields] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [confidenceScores, setConfidenceScores] = useState({});
  const [mongoOperations, setMongoOperations] = useState([]);

  // Use real data from progress hook or simulate
  useEffect(() => {
    if (useRealData && progress) {
      // Use real data from the hook
      setDetectedFields(progress.fieldsDetected || []);
      setPatterns(progress.patterns || []);
      setConfidenceScores(progress.confidence || {});
      setMongoOperations(progress.mongoOperations || []);

      // Update current step based on stage
      const stageToStep = {
        'idle': 0,
        'parsing': 0,
        'detecting': 1,
        'matching': 2,
        'analyzing': 3,
        'building': 4,
        'complete': 5
      };
      setCurrentStep(stageToStep[progress.stage] || 0);
    } else {
      // Simulated data (existing logic)
      if (elapsedTime > 1 && detectedFields.length === 0) {
        setDetectedFields([
          { code: '20', name: 'Transaction Reference', type: 'reference', lane: 'RULES', value: 'REF192TEST001' },
          { code: '21', name: 'Related Reference', type: 'reference', lane: 'RULES', value: 'RELATEDREF001' },
          { code: '32A', name: 'Value Date/Amount', type: 'amount', lane: 'RULES', value: '241215USD125,750.50' },
          { code: '79', name: 'Cancellation Details', type: 'text', lane: 'AI', value: 'CANCELLATION REQUEST...' }
        ]);
      }

      if (elapsedTime > 2 && patterns.length === 0) {
        setPatterns([
          {
            sourceField: 'Field 20',
            sourceValue: 'REF192TEST001',
            patternName: 'transaction_reference',
            type: 'exact_match',
            confidence: 95,
            targetField: 'MsgId',
            targetPath: 'GrpHdr.MsgId'
          },
          {
            sourceField: 'Field 32A',
            sourceValue: '241215USD125,750.50',
            patternName: 'value_date_amount',
            type: 'semantic',
            confidence: 90,
            targetField: 'IntrBkSttlmAmt',
            targetPath: 'CdtTrfTxInf.IntrBkSttlmAmt'
          },
          {
            sourceField: 'Field 79',
            sourceValue: 'CANCELLATION REQUEST...',
            patternName: 'remittance_info',
            type: 'ai_generated',
            confidence: 75,
            targetField: 'RmtInf',
            targetPath: 'CdtTrfTxInf.RmtInf.Ustrd'
          }
        ]);
      }

      if (elapsedTime > 3 && !confidenceScores.overall) {
        setConfidenceScores({
          fieldDetection: 85,
          patternMatching: 90,
          aiAnalysis: 75,
          overall: 83
        });
      }

      if (elapsedTime > 1.5 && mongoOperations.length === 0) {
        setMongoOperations([
          { icon: '📝', message: 'Loading semantic patterns from database...', timestamp: Date.now() },
          { icon: '🔍', message: 'Querying conversion_registry collection...', timestamp: Date.now() + 1000 },
          { icon: '💾', message: 'Preparing configuration document...', timestamp: Date.now() + 2000 }
        ]);
      }
    }
  }, [elapsedTime, progress, useRealData, detectedFields.length, patterns.length, confidenceScores.overall, mongoOperations.length]);

  const sourceFormat = isCustom ? customConfig?.sourceFormat : scenario?.sourceFormat;
  const targetFormat = isCustom ? customConfig?.targetFormat : scenario?.targetFormat;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Generating Configuration</h3>
        <div className={styles.formats}>
          <span className={styles.format}>{sourceFormat}</span>
          <span className={styles.arrow}>→</span>
          <span className={styles.format}>{targetFormat}</span>
        </div>
      </div>

      {/* Timer */}
      <div className={styles.timer}>
        <span className={styles.timerLabel}>Elapsed Time:</span>
        <span className={styles.timerValue}>{elapsedTime.toFixed(1)}s</span>
      </div>

      {/* Processing Timeline */}
      <ProcessingTimeline
        currentStep={currentStep}
        onStepComplete={(step) => console.log(`Step ${step} complete`)}
      />

      {/* Two-column layout for visualizations */}
      <div className={styles.visualizationGrid}>
        <div className={styles.leftColumn}>
          {/* Field Detection */}
          <FieldDetectionList
            fields={detectedFields}
            animated={true}
          />

          {/* Confidence Meter */}
          <ConfidenceMeter
            scores={confidenceScores}
            animated={true}
          />
        </div>

        <div className={styles.rightColumn}>
          {/* Pattern Matching */}
          <SemanticPatternMatcher
            patterns={patterns}
            animated={true}
          />

          {/* MongoDB Activity Feed */}
          <MongoDBActivityFeed
            operations={mongoOperations}
            isLive={useRealData}
          />
        </div>
      </div>
    </div>
  );
}