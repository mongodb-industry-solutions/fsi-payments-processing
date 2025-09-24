import React, { useState, useEffect } from 'react';
import styles from './ProcessingPipelinePanel.module.css';
import MongoDBDetailsModal from './MongoDBDetailsModal';

const ProcessingPipelinePanel = ({ selectedScenario, conversionResults, isExecuting, currentStep }) => {
  const [showModal, setShowModal] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Auto-expand when execution starts
  useEffect(() => {
    if (isExecuting) {
      setIsCollapsed(false);
    }
  }, [isExecuting]);

  if (!selectedScenario) return null;

  const pipeline = selectedScenario.pipelineStory || {};
  const hasResults = conversionResults && conversionResults.length > 0;

  // Calculate conversion statistics
  const totalConversions = hasResults ? conversionResults.length : 0;

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
      'USDC': 'USDC Stablecoin',
      'NPP': 'Australian NPP',
      'FJD': 'Fiji Banking',
      'NZ': 'NZ Banking'
    };
    return `${formatNames[from] || from} → ${formatNames[to] || to}`;
  };

  // Check if this is the remote island routing scenario
  const isRemoteIslandScenario = selectedScenario?.id === 'remote-island-routing';

  // Dynamic content based on execution state
  if (hasResults && !isExecuting) {
    // Show actual conversion results
    return (
      <div className={`${styles.pipelinePanel} ${isCollapsed ? styles.collapsed : ''}`}>
        <div className={styles.panelHandle} onClick={() => setIsCollapsed(!isCollapsed)}>
          <div className={styles.handleBar}></div>
          <span className={styles.panelTitle}>
            MongoDB Processing Pipeline {hasResults && '- Conversion Complete'}
          </span>
          <svg
            className={styles.handleArrow}
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            style={{ transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <div className={styles.collapsibleContent} style={{ display: isCollapsed ? 'none' : 'block' }}>
        {/* MongoDB Advantages Section */}
        {selectedScenario?.mongoDbAdvantages && (
          <div className={styles.mongoAdvantages}>
            <div className={styles.advantagesContent}>
              <div className={styles.advantagesHeader}>
                <h4>{selectedScenario.mongoDbAdvantages.title}</h4>
              </div>
              <p className={styles.advantagesText}>
                {selectedScenario.mongoDbAdvantages.message}
              </p>
            </div>
          </div>
        )}


        <div className={styles.pipelineFlow}>
          {conversionResults.map((result, index) => (
            <React.Fragment key={index}>
              {index > 0 && <div className={styles.arrow}>→</div>}

              <div className={`${styles.step} ${styles.completed}`}>
                <div className={styles.stepNumber}>{result.step || index + 1}</div>
                <div className={styles.stepContent}>
                  <h4>{formatConversionStep(result.from, result.to)}</h4>
                  <div className={styles.stepDetails}>
                    <span className={styles.status}>
                      ✅ Complete
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
          {isRemoteIslandScenario ? (
            <p>✅ Payment successfully routed to Fiji via Australia! MongoDB's BFS algorithm discovered the optimal path through {conversionResults.length} hops.</p>
          ) : (
            <p>✅ Payment successfully converted through MongoDB's universal JSON format.
               {conversionResults.length} transformation{conversionResults.length > 1 ? 's' : ''} completed successfully.</p>
          )}
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
      </div>
    );
  }

  if (isExecuting) {
    // Show processing animation
    return (
      <div className={`${styles.pipelinePanel} ${isCollapsed ? styles.collapsed : ''}`}>
        <div className={styles.panelHandle} onClick={() => setIsCollapsed(!isCollapsed)}>
          <div className={styles.handleBar}></div>
          <span className={styles.panelTitle}>
            MongoDB Processing Pipeline - Executing...
          </span>
          <svg
            className={styles.handleArrow}
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            style={{ transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <div className={styles.collapsibleContent} style={{ display: isCollapsed ? 'none' : 'block' }}>
        {/* MongoDB Advantages Section */}
        {selectedScenario?.mongoDbAdvantages && (
          <div className={styles.mongoAdvantages}>
            <div className={styles.advantagesContent}>
              <div className={styles.advantagesHeader}>
                <h4>{selectedScenario.mongoDbAdvantages.title}</h4>
              </div>
              <p className={styles.advantagesText}>
                {selectedScenario.mongoDbAdvantages.message}
              </p>
            </div>
          </div>
        )}


        <div className={styles.pipelineFlow}>
          {isRemoteIslandScenario ? (
            <>
              <div className={`${styles.step} ${currentStep >= 0 ? styles.processing : ''}`}>
                <div className={styles.stepNumber}>1</div>
                <div className={styles.stepContent}>
                  <h4>BFS Path Discovery</h4>
                  <p className={styles.processingText}>
                    {currentStep === 0
                      ? "Running BFS algorithm to find optimal route to Fiji..."
                      : "Analyzing network graph..."}
                  </p>
                </div>
              </div>

              <div className={styles.arrow}>→</div>

              <div className={`${styles.step} ${currentStep >= 1 ? styles.processing : ''}`}>
                <div className={styles.stepNumber}>2</div>
                <div className={styles.stepContent}>
                  <h4>Route via Australia</h4>
                  <p className={styles.processingText}>
                    {currentStep === 1
                      ? "Converting MT103 → JSON → NPP through 3 lanes..."
                      : "Processing through Sydney hub..."}
                  </p>
                </div>
              </div>

              <div className={styles.arrow}>→</div>

              <div className={`${styles.step} ${currentStep >= 2 ? styles.processing : ''}`}>
                <div className={styles.stepNumber}>3</div>
                <div className={styles.stepContent}>
                  <h4>Final Hop to Fiji</h4>
                  <p className={styles.processingText}>
                    {currentStep === 2
                      ? "Converting NPP → FJD for Fiji banking system..."
                      : "Delivering to Pacific island..."}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>

        <div className={styles.storyLine}>
          {isRemoteIslandScenario ? (
            <p>🔄 Discovering optimal route to Fiji through MongoDB's graph-based routing engine...</p>
          ) : (
            <p>🔄 Processing payment through MongoDB's intelligent conversion engine...</p>
          )}
        </div>
        </div>
      </div>
    );
  }

  // Default static view
  return (
    <div className={`${styles.pipelinePanel} ${isCollapsed ? styles.collapsed : ''}`}>
      <div className={styles.panelHandle} onClick={() => setIsCollapsed(!isCollapsed)}>
        <div className={styles.handleBar}></div>
        <span className={styles.panelTitle}>
          MongoDB Processing Pipeline
        </span>
        <svg
          className={styles.handleArrow}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          style={{ transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      <div className={styles.collapsibleContent} style={{ display: isCollapsed ? 'none' : 'block' }}>
      {/* MongoDB Advantages Section */}
      {selectedScenario?.mongoDbAdvantages && (
        <div className={styles.mongoAdvantages}>
          <div className={styles.advantagesContent}>
            <div className={styles.advantagesHeader}>
              <h4>{selectedScenario.mongoDbAdvantages.title}</h4>
            </div>
            <p className={styles.advantagesText}>
              {selectedScenario.mongoDbAdvantages.message}
            </p>
          </div>
        </div>
      )}


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
    </div>
  );
};

export default ProcessingPipelinePanel;