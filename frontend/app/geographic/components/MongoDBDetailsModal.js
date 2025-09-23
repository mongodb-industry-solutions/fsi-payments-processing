'use client';

import React, { useEffect } from 'react';
import styles from './MongoDBDetailsModal.module.css';

const MongoDBDetailsModal = ({ isOpen, onClose, conversionResults, selectedScenario }) => {
  // Handle ESC key press
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden'; // Prevent background scroll
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Use scenario-specific data or calculate from conversion results
  const scenarioConfig = selectedScenario?.mongodbConfig;
  const totalFields = scenarioConfig?.mapping?.totalFields ||
    conversionResults?.reduce((sum, r) =>
      (r.processingStats?.rules_lane || 0) + (r.processingStats?.ai_lane || 0), 0) || 21;
  const rulesFields = scenarioConfig?.mapping?.rulesLane ||
    conversionResults?.reduce((sum, r) =>
      r.processingStats?.rules_lane || 0, 0) || 18;
  const aiFields = scenarioConfig?.mapping?.aiLane ||
    conversionResults?.reduce((sum, r) =>
      r.processingStats?.ai_lane || 0, 0) || 3;
  const humanFields = scenarioConfig?.mapping?.humanLane || 0;

  return (
    <>
      {/* Backdrop */}
      <div className={styles.backdrop} onClick={onClose} />

      {/* Modal */}
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>🍃 {selectedScenario?.name || 'How MongoDB Powers'} - MongoDB Configuration</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.modalContent}>
          {/* Introduction */}
          <div className={styles.section}>
            <h3>📦 The Magic of MongoDB's conversion_registry</h3>
            <p className={styles.intro}>
              This entire payment conversion happened <strong>without writing a single line of code</strong>.
              MongoDB's <code>conversion_registry</code> collection acts as a recipe book, storing everything
              needed to transform payments between any formats.
            </p>
          </div>

          {/* Three-Step Process */}
          <div className={styles.processFlow}>
            <div className={styles.processStep}>
              <div className={styles.stepIcon}>📖</div>
              <h4>Step 1: Parse</h4>
              <p>Extract fields using regex patterns</p>
            </div>
            <div className={styles.processArrow}>→</div>
            <div className={styles.processStep}>
              <div className={styles.stepIcon}>🔄</div>
              <h4>Step 2: Transform</h4>
              <p>Apply mappings via 3 lanes</p>
            </div>
            <div className={styles.processArrow}>→</div>
            <div className={styles.processStep}>
              <div className={styles.stepIcon}>🏗️</div>
              <h4>Step 3: Build</h4>
              <p>Construct target format</p>
            </div>
          </div>

          {/* Parser Section */}
          <div className={styles.section}>
            <h3>1️⃣ The Parser - Reading Instructions from MongoDB</h3>
            <div className={styles.detailBox}>
              <p>
                MongoDB stores <strong>{totalFields} regex patterns</strong> that act like reading instructions.
                When an MT103 message arrives, the parser configuration knows exactly how to:
              </p>
              <ul className={styles.featureList}>
                <li>
                  <code>:20:(.+)</code>
                  <span>Extract Transaction Reference from field 20</span>
                </li>
                <li>
                  <code>:32A:(\d{6})([A-Z]{3})([\d,]+)</code>
                  <span>Parse Value Date, Currency, and Amount from field 32A</span>
                </li>
                <li>
                  <code>:50K:(.+?)(?=:5\d|:7\d|$)</code>
                  <span>Capture multi-line Ordering Customer details</span>
                </li>
                <li>
                  <code>:70:(.+?)(?=:7\d|$)</code>
                  <span>Extract Remittance Information for AI processing</span>
                </li>
              </ul>
              <div className={styles.insight}>
                💡 <strong>Business Impact:</strong> To support MT192 or any new format,
                just add regex patterns to MongoDB. No developers, no deployments, no downtime.
              </div>
            </div>
          </div>

          {/* Transformer Section */}
          <div className={styles.section}>
            <h3>2️⃣ The Transformer - 3-Lane Intelligence Highway</h3>
            <div className={styles.laneContainer}>
              {/* Rules Lane */}
              <div className={styles.laneCard}>
                <div className={styles.laneHeader}>
                  <span className={styles.laneEmoji}>📋</span>
                  <h4>Rules Lane</h4>
                  <span className={styles.laneCount}>{rulesFields} fields</span>
                </div>
                <p>Instant, deterministic transformations:</p>
                <ul>
                  <li>Field 20 → MsgId (simple copy)</li>
                  <li>Field 32A → InstdAmt (extract amount)</li>
                  <li>Field 50K → Debtor (parse name & account)</li>
                </ul>
                <div className={styles.performance}>⚡ ~50ms processing</div>
              </div>

              {/* AI Lane */}
              <div className={styles.laneCard}>
                <div className={styles.laneHeader}>
                  <span className={styles.laneEmoji}>🤖</span>
                  <h4>AI Lane</h4>
                  <span className={styles.laneCount}>{aiFields} fields</span>
                </div>
                <p>Complex extraction with AWS Bedrock:</p>
                <ul>
                  <li>Field 70 → Invoice details extraction</li>
                  <li>Field 72 → Sender instructions parsing</li>
                  <li>Unstructured text → Structured data</li>
                </ul>
                <div className={styles.performance}>🧠 1-2s processing</div>
              </div>

              {/* Human Lane */}
              <div className={styles.laneCard}>
                <div className={styles.laneHeader}>
                  <span className={styles.laneEmoji}>👤</span>
                  <h4>Human Lane</h4>
                  <span className={styles.laneCount}>Low confidence</span>
                </div>
                <p>Review queue for uncertain fields:</p>
                <ul>
                  <li>AI confidence &lt; 80%</li>
                  <li>Critical compliance fields</li>
                  <li>Anomaly detection triggers</li>
                </ul>
                <div className={styles.performance}>📝 Manual review</div>
              </div>
            </div>
          </div>

          {/* Builder Section */}
          <div className={styles.section}>
            <h3>3️⃣ The Builder - Output Blueprint from MongoDB</h3>
            <div className={styles.codeBlock}>
              <pre>{`<!-- MongoDB stores this XML template -->
<Document>
  <CdtTrfTxInf>
    <PmtId>
      <MsgId>{{transaction_reference}}</MsgId>
      <EndToEndId>{{end_to_end_id}}</EndToEndId>
    </PmtId>
    <Amt>
      <InstdAmt Ccy="{{currency}}">{{amount}}</InstdAmt>
    </Amt>
    <Dbtr>
      <Nm>{{debtor_name}}</Nm>
      <PstlAdr>{{debtor_address}}</PstlAdr>
    </Dbtr>
  </CdtTrfTxInf>
</Document>`}</pre>
            </div>
            <p className={styles.explanation}>
              The builder reads this template from MongoDB and replaces <code>{`{{placeholders}}`}</code>
              with actual transformed values. No code needed - just template + data = output.
            </p>
          </div>

          {/* Scenario-Specific Bridge */}
          {scenarioConfig?.bridge && (
            <div className={styles.section}>
              <h3>🌉 {scenarioConfig.bridge.title}</h3>
              <div className={styles.bridgeFlow}>
                <div className={styles.bridgeNode}>
                  <strong>{scenarioConfig.bridge.from.split(' ')[0]}</strong>
                  <span>{scenarioConfig.bridge.from}</span>
                </div>
                <div className={styles.bridgeArrow}>→</div>
                <div className={styles.bridgeCenter}>
                  <strong>{scenarioConfig.bridge.through.includes('JSON') ? 'JSON Bridge' : 'Multi-Hop'}</strong>
                  <span>{scenarioConfig.bridge.through}</span>
                </div>
                <div className={styles.bridgeArrow}>→</div>
                <div className={styles.bridgeNode}>
                  <strong>{scenarioConfig.bridge.to.split(' ')[0]}</strong>
                  <span>{scenarioConfig.bridge.to}</span>
                </div>
              </div>
              <div className={styles.insight}>
                💡 <strong>Scenario Impact:</strong> {scenarioConfig.bridge.description}
              </div>
            </div>
          )}

          {/* Scenario-Specific Mappings */}
          {scenarioConfig?.mapping?.examples && (
            <div className={styles.section}>
              <h3>📋 Field Mapping Examples</h3>
              <div className={styles.mappingGrid}>
                {scenarioConfig.mapping.examples.map((example, idx) => (
                  <div key={idx} className={styles.mappingCard}>
                    <div className={styles.mappingHeader}>
                      <span className={example.type === 'ai' ? styles.aiLabel : styles.rulesLabel}>
                        {example.type === 'ai' ? '🤖 AI' : '📋 Rules'}
                      </span>
                      <span className={styles.mappingDesc}>{example.description}</span>
                    </div>
                    <div className={styles.mappingFlow}>
                      <code>{example.source}</code>
                      <span className={styles.mappingArrow}>→</span>
                      <code>{example.target}</code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scenario-Specific Metrics */}
          {scenarioConfig?.metrics && (
            <div className={styles.section}>
              <h3>📊 Conversion Metrics</h3>
              <div className={styles.metricsGrid}>
                <div className={styles.metricCard}>
                  <span className={styles.metricValue}>{scenarioConfig.metrics.accuracy}</span>
                  <span className={styles.metricLabel}>Accuracy</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricValue}>{scenarioConfig.metrics.straightThrough}</span>
                  <span className={styles.metricLabel}>Straight-Through</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricValue}>{scenarioConfig.metrics.costSaving}</span>
                  <span className={styles.metricLabel}>Cost Savings</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricValue}>{scenarioConfig.metrics.setupTime}</span>
                  <span className={styles.metricLabel}>Setup Time</span>
                </div>
              </div>
            </div>
          )}

          {/* Scenario Insights */}
          {scenarioConfig?.insights && (
            <div className={styles.highlightBox}>
              <h4>🚀 {scenarioConfig.insights.key}</h4>
              <p>{scenarioConfig.insights.value}</p>
              <p className={styles.impactText}>
                <strong>Business Impact:</strong> {scenarioConfig.insights.impact}
              </p>
            </div>
          )}

          {/* Generic Canonical JSON Bridge (fallback) */}
          {!scenarioConfig?.bridge && (
            <div className={styles.section}>
              <h3>🌉 The Canonical JSON Bridge</h3>
              <div className={styles.bridgeFlow}>
                <div className={styles.bridgeNode}>
                  <strong>MT103</strong>
                  <span>SWIFT Format</span>
                </div>
                <div className={styles.bridgeArrow}>→</div>
                <div className={styles.bridgeCenter}>
                  <strong>Canonical JSON</strong>
                  <span>Universal Language</span>
                </div>
                <div className={styles.bridgeArrow}>→</div>
                <div className={styles.bridgeNode}>
                  <strong>pacs.008</strong>
                  <span>ISO 20022</span>
                </div>
              </div>
              <div className={styles.insight}>
                💡 <strong>Why This Matters:</strong> Without JSON as a universal bridge,
                you'd need N×N converters (MT103→pacs.008, MT103→CHAPS, MT202→pacs.009, etc.).
                With MongoDB's approach, you only need 2N converters (each format to/from JSON).
              </div>
            </div>
          )}

          {/* Bottom Line */}
          <div className={styles.bottomLine}>
            <h3>🚀 The Revolutionary Impact</h3>
            <div className={styles.comparisonGrid}>
              <div className={styles.comparisonCard}>
                <h4>Traditional Approach</h4>
                <ul>
                  <li>3-6 months to add new format</li>
                  <li>Requires developer team</li>
                  <li>Code deployment needed</li>
                  <li>Risk of breaking existing code</li>
                  <li>Maintenance nightmare</li>
                </ul>
              </div>
              <div className={styles.comparisonCard}>
                <h4>MongoDB Approach</h4>
                <ul>
                  <li>2-8 seconds with auto-config</li>
                  <li>Business users can configure</li>
                  <li>Just update MongoDB docs</li>
                  <li>Zero code = zero bugs</li>
                  <li>Self-documenting configs</li>
                </ul>
              </div>
            </div>
            <div className={styles.statHighlight}>
              <span className={styles.statNumber}>95%</span>
              <span className={styles.statLabel}>Reduction in Development Time</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MongoDBDetailsModal;