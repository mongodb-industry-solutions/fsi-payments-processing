import React, { useState } from 'react';
import styles from './ProcessingPipelinePanel.module.css';
import MongoDBDetailsModal from './MongoDBDetailsModal';

const ProcessingPipelinePanel = ({ selectedScenario, conversionResults, isExecuting, currentStep }) => {
  const [showModal, setShowModal] = useState(false);

  if (!selectedScenario) return null;

  const pipeline = selectedScenario.pipelineStory || {};
  const hasResults = conversionResults && conversionResults.length > 0;

  // Calculate total processing time
  const totalTime = hasResults
    ? conversionResults.reduce((sum, r) => sum + (r.processingTime || 0), 0).toFixed(2)
    : null;

  // Format conversion step for display
  const formatConversionStep = (from, to) => {
    const formatNames = {
      'MT103': 'MT103 SWIFT',
      'MT202': 'MT202 SWIFT',
      'pacs.008': 'ISO 20022',
      'pacs.009': 'ISO 20022',
      'JSON': 'Canonical JSON',
      'CHAPS': 'UK CHAPS',
      'TARGET2': 'TARGET2',
      'SPEI': 'Mexican SPEI',
      'USDC': 'USDC Stablecoin'
    };
    return `${formatNames[from] || from} → ${formatNames[to] || to}`;
  };

  // Dynamic content based on execution state
  if (hasResults && !isExecuting) {
    // Show actual conversion results
    return (
      <div className={styles.pipelinePanel}>
        <div className={styles.pipelineHeader}>
          <span className={styles.mongoIcon}>🍃</span>
          <h3>MongoDB Processing Pipeline - Conversion Complete</h3>
          <span className={styles.totalTime}>Total: {totalTime}s</span>
        </div>

        <div className={styles.pipelineFlow}>
          {conversionResults.map((result, index) => (
            <React.Fragment key={index}>
              {index > 0 && <div className={styles.arrow}>→</div>}

              <div className={`${styles.step} ${styles.completed}`}>
                <div className={styles.stepNumber}>{result.step || index + 1}</div>
                <div className={styles.stepContent}>
                  <h4>{formatConversionStep(result.from, result.to)}</h4>
                  <div className={styles.stepDetails}>
                    <span className={styles.timing}>
                      ⏱ {(result.processingTime || 0).toFixed(2)}s
                    </span>
                    {result.processingStats && (
                      <span className={styles.lanes}>
                        📋 Rules: {result.processingStats.rules_lane || 0} |
                        🤖 AI: {result.processingStats.ai_lane || 0}
                      </span>
                    )}
                    {result.humanReviewRequired && (
                      <span className={styles.review}>👤 Review Required</span>
                    )}
                  </div>
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>

        <div className={`${styles.storyLine} ${styles.success}`}>
          <p>✅ Payment successfully converted through MongoDB's universal JSON format.
             {conversionResults.length} transformation{conversionResults.length > 1 ? 's' : ''} completed in {totalTime} seconds.</p>
        </div>

        {/* MongoDB Details Button */}
        <div className={styles.detailsButtonContainer}>
          <button
            className={styles.detailsButton}
            onClick={() => setShowModal(true)}
          >
            🔍 How MongoDB Makes This Work
          </button>
        </div>

        {/* MongoDB Details Modal */}
        <MongoDBDetailsModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          conversionResults={conversionResults}
          selectedScenario={selectedScenario}
        />
      </div>
    );
  }

  if (isExecuting) {
    // Show processing animation
    return (
      <div className={styles.pipelinePanel}>
        <div className={styles.pipelineHeader}>
          <span className={`${styles.mongoIcon} ${styles.spinning}`}>🍃</span>
          <h3>MongoDB Processing Pipeline - Converting...</h3>
          <div className={styles.progressIndicator}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${((currentStep || 0) + 1) * 33}%` }} />
            </div>
          </div>
        </div>

        <div className={styles.pipelineFlow}>
          <div className={`${styles.step} ${currentStep >= 0 ? styles.processing : ''}`}>
            <div className={styles.stepNumber}>1</div>
            <div className={styles.stepContent}>
              <h4>Reading MT103 Message</h4>
              <p className={styles.processingText}>
                {currentStep === 0
                  ? "Applying 21 regex patterns from MongoDB's conversion_registry..."
                  : "Parsing payment message..."}
              </p>
            </div>
          </div>

          <div className={styles.arrow}>→</div>

          <div className={`${styles.step} ${currentStep >= 1 ? styles.processing : ''}`}>
            <div className={styles.stepNumber}>2</div>
            <div className={styles.stepContent}>
              <h4>Transforming via 3 Lanes</h4>
              <p className={styles.processingText}>
                {currentStep === 1
                  ? "Processing 18 Rules + 3 AI field mappings from MongoDB..."
                  : "Converting to Canonical JSON..."}
              </p>
            </div>
          </div>

          <div className={styles.arrow}>→</div>

          <div className={`${styles.step} ${currentStep >= 2 ? styles.processing : ''}`}>
            <div className={styles.stepNumber}>3</div>
            <div className={styles.stepContent}>
              <h4>Building pacs.008</h4>
              <p className={styles.processingText}>
                {currentStep === 2
                  ? "Filling XML template from MongoDB with transformed data..."
                  : "Creating target format..."}
              </p>
            </div>
          </div>
        </div>

        <div className={styles.storyLine}>
          <p>🔄 Processing payment through MongoDB's intelligent conversion engine...</p>
        </div>
      </div>
    );
  }

  // Default static view
  return (
    <div className={styles.pipelinePanel}>
      <div className={styles.pipelineHeader}>
        <span className={styles.mongoIcon}>🍃</span>
        <h3>MongoDB Processing Pipeline</h3>
      </div>

      <div className={styles.pipelineFlow}>
        <div className={styles.step}>
          <div className={styles.stepNumber}>1</div>
          <div className={styles.stepContent}>
            <h4>Source Input</h4>
            <p>{pipeline.source}</p>
          </div>
        </div>

        <div className={styles.arrow}>→</div>

        <div className={styles.step}>
          <div className={styles.stepNumber}>2</div>
          <div className={styles.stepContent}>
            <h4>MongoDB Storage</h4>
            <p>{pipeline.mongodb}</p>
          </div>
        </div>

        <div className={styles.arrow}>→</div>

        <div className={styles.step}>
          <div className={styles.stepNumber}>3</div>
          <div className={styles.stepContent}>
            <h4>Target Output</h4>
            <p>{pipeline.target}</p>
          </div>
        </div>
      </div>

      <div className={styles.storyLine}>
        <p>{pipeline.story}</p>
      </div>

      {/* Static state hint */}
      <div className={styles.hint}>
        <p>💡 Click <strong>Execute Route</strong> to see MongoDB's zero-code conversion engine in action.
           Every step is powered by configurations stored in MongoDB - no hardcoded logic!</p>
      </div>
    </div>
  );
};

export default ProcessingPipelinePanel;