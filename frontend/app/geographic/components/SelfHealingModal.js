'use client';

import React, { useState, useEffect } from 'react';
import Icon from '@leafygreen-ui/icon';
import { palette } from '@leafygreen-ui/palette';
import { H3, Body } from '@leafygreen-ui/typography';
import styles from './SelfHealingModal.module.css';

const SelfHealingModal = ({ isOpen, onClose, onComplete }) => {
  const [stage, setStage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [analysisLines, setAnalysisLines] = useState([]);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setStage(0);
      setProgress(0);
      setAnalysisLines([]);
      setShowCode(false);
      return;
    }

    // Store all timeout IDs for cleanup
    const timeouts = [];

    // Stage 1: Failure Detection (0-2s)
    timeouts.push(setTimeout(() => {
      setProgress(0);
      setStage(1);
    }, 300));

    timeouts.push(setTimeout(() => {
      setProgress(33);
      setStage(2);
    }, 2000));

    // Stage 2: LLM Analysis (2-6s) - Add text lines progressively
    timeouts.push(setTimeout(() => {
      setAnalysisLines(prev => [...prev, 'Analyzing malformed beneficiary data structure...']);
    }, 2300));

    timeouts.push(setTimeout(() => {
      setAnalysisLines(prev => [...prev, 'Pattern detected: Triple slash delimiter (///)']);
    }, 3000));

    timeouts.push(setTimeout(() => {
      setAnalysisLines(prev => [...prev, 'Querying messaging_patterns collection in MongoDB']);
    }, 3800));

    timeouts.push(setTimeout(() => {
      setAnalysisLines(prev => [...prev, 'Generating BIC-specific parsing rule for CORRBANKXXX']);
    }, 4600));

    timeouts.push(setTimeout(() => {
      setProgress(66);
      setStage(3);
    }, 6000));

    // Stage 3: MongoDB Insertion (6-9s)
    timeouts.push(setTimeout(() => {
      setShowCode(true);
    }, 6300));

    timeouts.push(setTimeout(() => {
      setProgress(100);
      setStage(4);
    }, 8500));

    // Complete and close (9-10s)
    timeouts.push(setTimeout(() => {
      if (onComplete) {
        onComplete();
      } else if (onClose) {
        onClose();
      }
    }, 10000));

    // Cleanup: clear all timeouts if modal closes early or effect re-runs
    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
    };

  }, [isOpen]); // Only depend on isOpen to prevent duplicate timeout chains

  if (!isOpen) return null;

  const mongoDocument = `{
  "collection": "conversion_registry",
  "update": {
    "metadata.bic_overrides.CORRBANKXXX": {
      "field_id": "59",
      "delimiter": "///",
      "pattern": ":59:([^:]+(?:///[^:]+)*)",
      "created_by": "LLM_Resolution_Agent",
      "created_at": "${new Date().toISOString()}",
      "confidence": 0.95
    }
  }
}`;

  return (
    <>
      {/* Backdrop */}
      <div className={styles.backdrop} />

      {/* Modal */}
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <H3>MongoDB Self-Healing Process</H3>
          <button className={styles.closeButton} onClick={onClose}>
            <Icon glyph="X" size="small" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className={styles.progressContainer}>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className={styles.progressText}>{progress}% Complete</span>
        </div>

        <div className={styles.modalContent}>
          {/* Stage 1: Error Detection */}
          <div className={`${styles.stage} ${stage >= 1 ? styles.active : ''} ${stage > 1 ? styles.complete : ''}`}>
            <div className={styles.stageHeader}>
              <div className={styles.stageIcon}>
                {stage < 1 && <Icon glyph="Circle" fill={palette.gray.light1} />}
                {stage === 1 && <Icon glyph="Warning" fill={palette.red.base} />}
                {stage > 1 && <Icon glyph="Checkmark" fill={palette.green.base} />}
              </div>
              <Body weight="medium">Stage 1: Error Detection</Body>
            </div>
            {stage >= 1 && (
              <div className={styles.stageContent}>
                <div className={styles.errorBanner}>
                  <Icon glyph="Warning" size="small" fill={palette.red.base} />
                  <span>Parsing Error: Field 59 - Unrecognized delimiter pattern</span>
                </div>
              </div>
            )}
          </div>

          {/* Stage 2: Pattern Analysis */}
          <div className={`${styles.stage} ${stage >= 2 ? styles.active : ''} ${stage > 2 ? styles.complete : ''}`}>
            <div className={styles.stageHeader}>
              <div className={styles.stageIcon}>
                {stage < 2 && <Icon glyph="Circle" fill={palette.gray.light1} />}
                {stage === 2 && <Icon glyph="Refresh" fill={palette.blue.base} className={styles.spinning} />}
                {stage > 2 && <Icon glyph="Checkmark" fill={palette.green.base} />}
              </div>
              <Body weight="medium">Stage 2: Pattern Analysis</Body>
            </div>
            {stage >= 2 && (
              <div className={styles.stageContent}>
                {analysisLines.map((line, index) => (
                  <div key={index} className={styles.analysisLine}>
                    <Icon glyph="ChevronRight" size="small" fill={palette.blue.base} />
                    <Body className={styles.analysisText}>{line}</Body>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stage 3: Rule Generation & Insertion */}
          <div className={`${styles.stage} ${stage >= 3 ? styles.active : ''} ${stage > 3 ? styles.complete : ''}`}>
            <div className={styles.stageHeader}>
              <div className={styles.stageIcon}>
                {stage < 3 && <Icon glyph="Circle" fill={palette.gray.light1} />}
                {stage === 3 && <Icon glyph="Database" fill={palette.green.dark2} />}
                {stage > 3 && <Icon glyph="Checkmark" fill={palette.green.base} />}
              </div>
              <Body weight="medium">Stage 3: MongoDB Rule Insertion</Body>
            </div>
            {stage >= 3 && showCode && (
              <div className={styles.stageContent}>
                <div className={styles.codeContainer}>
                  <div className={styles.codeHeader}>
                    <Icon glyph="Code" size="small" fill={palette.gray.dark2} />
                    <Body className={styles.codeLabel}>MongoDB Document Update</Body>
                  </div>
                  <pre className={styles.codeBlock}>
                    {mongoDocument}
                  </pre>
                </div>
                {stage === 4 && (
                  <div className={styles.successBanner}>
                    <Icon glyph="Checkmark" size="small" fill={palette.green.base} />
                    <span>Rule created successfully - Payment processing resumed</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default SelfHealingModal;
