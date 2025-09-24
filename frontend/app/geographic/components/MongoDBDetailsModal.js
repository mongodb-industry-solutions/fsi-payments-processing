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
              This entire payment conversion happens through a <strong>100% generic, configuration-driven engine</strong>.
              MongoDB's <code>conversion_registry</code> collection acts as the brain, storing all format-specific
              knowledge. To add new payment formats, you simply add configuration to MongoDB -
              <strong>no code changes needed</strong>.
            </p>
          </div>

          {/* Canonical JSON - The Universal Bridge */}
          <div className={styles.section}>
            <h3>🌉 The Secret: Canonical JSON Format</h3>
            <div className={styles.canonicalExplanation}>
              <p className={styles.canonicalIntro}>
                The genius behind any-to-any format conversion is our <strong>Canonical JSON Format</strong> -
                a universal intermediate structure that acts as the "Rosetta Stone" for all payment formats.
              </p>

              <div className={styles.canonicalStructure}>
                <h4>📝 Universal Structure (stored in MongoDB)</h4>
                <div className={styles.jsonPreview}>
                  <pre>{`{
  "header": {},        // Message metadata
  "transaction": {},   // Transaction IDs
  "parties": {         // ALL party types
    "debtor": {},
    "creditor": {},
    "agents": {}
  },
  "amounts": {},       // ALL monetary values
  "dates": {},         // ALL timestamps
  "remittance": {},    // Payment details
  "instructions": {},  // Processing rules
  "references": {}     // ALL references
}`}</pre>
                </div>
              </div>

              <div className={styles.conversionFlow}>
                <div className={styles.conversionExample}>
                  <h4>🔄 How Any-to-Any Works</h4>
                  <div className={styles.flowDiagram}>
                    <div className={styles.formatNode}>MT103</div>
                    <span className={styles.arrow}>→</span>
                    <div className={styles.jsonNode}>
                      <div>Canonical JSON</div>
                      <div className={styles.jsonMapping}>
                        <small>Field 50K → parties.debtor</small>
                        <small>Field 32A → amounts.instructed</small>
                        <small>Field 70 → remittance.unstructured</small>
                      </div>
                    </div>
                    <span className={styles.arrow}>→</span>
                    <div className={styles.formatNode}>pacs.008</div>
                  </div>

                  <div className={styles.multiHopExample}>
                    <p><strong>Multi-hop example:</strong> MT103 → JSON → NPP → JSON → FJD</p>
                    <p className={styles.explanation}>
                      Each format knows how to convert TO and FROM the same JSON structure.
                      MongoDB stores these mappings, enabling infinite routing possibilities!
                    </p>
                  </div>
                </div>
              </div>

              <div className={styles.insight}>
                🎯 <strong>Key Innovation:</strong> New formats only need to define mappings to/from
                this JSON structure. The system automatically enables conversion to ALL other formats
                through JSON as the bridge. New formats can be added immediately without development cycles!
              </div>
            </div>
          </div>

          {/* Special Section for Remote Island Routing */}
          {selectedScenario?.id === 'remote-island-routing' && (
            <div className={styles.routingSection}>
              <h3>🧭 BFS Path Discovery - Finding Route to Fiji</h3>

              <div className={styles.bfsVisualization}>
                <h4>Graph-Based Routing Algorithm</h4>
                <div className={styles.algorithmSteps}>
                  <div className={styles.algoStep}>
                    <span className={styles.stepNum}>1</span>
                    <div>
                      <strong>Initialize BFS Queue</strong>
                      <code>Queue: [USA]</code>
                    </div>
                  </div>
                  <div className={styles.algoStep}>
                    <span className={styles.stepNum}>2</span>
                    <div>
                      <strong>Explore USA connections</strong>
                      <code>Found: MT103 → JSON</code>
                    </div>
                  </div>
                  <div className={styles.algoStep}>
                    <span className={styles.stepNum}>3</span>
                    <div>
                      <strong>Explore JSON connections</strong>
                      <code>Found: JSON → NPP (Australia)</code>
                    </div>
                  </div>
                  <div className={styles.algoStep}>
                    <span className={styles.stepNum}>4</span>
                    <div>
                      <strong>Explore NPP connections</strong>
                      <code>Found: NPP → JSON → FJD (Fiji)</code>
                    </div>
                  </div>
                  <div className={styles.algoStep}>
                    <span className={styles.stepNum}>5</span>
                    <div>
                      <strong>Path Found!</strong>
                      <code className={styles.successPath}>USA → JSON → NPP → JSON → Fiji</code>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.pathComparison}>
                <h4>📊 Path Evaluation (4 routes analyzed)</h4>
                <div className={styles.pathGrid}>
                  <div className={`${styles.pathOption} ${styles.selected}`}>
                    <div className={styles.pathHeader}>
                      <span className={styles.pathName}>Via Australia</span>
                      <span className={styles.selectedBadge}>✅ Selected</span>
                    </div>
                    <div className={styles.pathRoute}>USA → Australia → Fiji</div>
                    <div className={styles.pathMetrics}>
                      <span>💰 $5</span>
                      <span>⚡ Fast</span>
                      <span>🛡️ 95%</span>
                    </div>
                    <div className={styles.pathReason}>
                      Commonwealth banking corridor since 1970s
                    </div>
                  </div>

                  <div className={styles.pathOption}>
                    <div className={styles.pathHeader}>
                      <span className={styles.pathName}>Via New Zealand</span>
                      <span className={styles.unavailable}>❌ No Config</span>
                    </div>
                    <div className={styles.pathRoute}>USA → New Zealand → Fiji</div>
                    <div className={styles.pathMetrics}>
                      <span>💰 $8</span>
                      <span>⚡ Faster</span>
                      <span>🛡️ 92%</span>
                    </div>
                  </div>

                  <div className={styles.pathOption}>
                    <div className={styles.pathHeader}>
                      <span className={styles.pathName}>Via Singapore</span>
                      <span className={styles.unavailable}>❌ No Config</span>
                    </div>
                    <div className={styles.pathRoute}>USA → Singapore → Australia → Fiji</div>
                    <div className={styles.pathMetrics}>
                      <span>💰 $12</span>
                      <span>⚡ Moderate</span>
                      <span>🛡️ 98%</span>
                    </div>
                  </div>

                  <div className={styles.pathOption}>
                    <div className={styles.pathHeader}>
                      <span className={styles.pathName}>Via Hong Kong</span>
                      <span className={styles.unavailable}>❌ No Config</span>
                    </div>
                    <div className={styles.pathRoute}>USA → HK → Philippines → Fiji</div>
                    <div className={styles.pathMetrics}>
                      <span>💰 $4</span>
                      <span>⚡ Slower</span>
                      <span>🛡️ 75%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.routingInsight}>
                <div className={styles.insightIcon}>💡</div>
                <div>
                  <strong>MongoDB's Graph Advantage:</strong> The <code>conversion_graph</code> collection stores
                  edges between payment formats with metadata (cost, latency, reliability). BFS algorithm evaluated
                  4 possible paths to find the optimal route through Australia, leveraging historical
                  banking relationships. Without direct USA-Fiji rails, MongoDB's router intelligently discovered
                  the best path through intermediary hubs.
                </div>
              </div>
            </div>
          )}

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
                <div className={styles.performance}>⚡ Instant processing</div>
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
                <div className={styles.performance}>🧠 AI-powered processing</div>
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

          {/* MongoDB Advantages */}
          <div className={styles.bottomLine}>
            <h3>💚 Why MongoDB Makes This Possible</h3>
            <div className={styles.mongoAdvantages}>
              <div className={styles.advantageCard}>
                <div className={styles.advantageIcon}>📄</div>
                <h4>Document Model Perfect Fit</h4>
                <p>
                  Payment messages are naturally nested documents. MongoDB stores complete conversion
                  configs as single documents - parser rules, mappings, AI prompts, builder templates -
                  all together, exactly mirroring how payments experts think about formats.
                </p>
                <div className={styles.codeExample}>
                  <code>{`{
  "parser": { fields: [...] },
  "mappings": { rules: [...] },
  "ai_config": { prompts: {...} },
  "builder": { template: "..." }
}`}</code>
                </div>
              </div>

              <div className={styles.advantageCard}>
                <div className={styles.advantageIcon}>🔍</div>
                <h4>Flexible Schema Evolution</h4>
                <p>
                  Payment standards evolve constantly. MongoDB's schema flexibility lets us add
                  new field types, validation rules, or entire format versions without migrations.
                  MT103 version 2023? Just add new fields to the document.
                </p>
                <div className={styles.evolutionExample}>
                  <span>✅ Add field 119 for sanctions screening</span>
                  <span>✅ Support both old & new formats simultaneously</span>
                  <span>✅ No downtime, no data migration</span>
                </div>
              </div>

              <div className={styles.advantageCard}>
                <div className={styles.advantageIcon}>⚡</div>
                <h4>Aggregation Pipeline Power</h4>
                <p>
                  Complex payment routing decisions happen in-database using aggregation pipelines.
                  Find optimal paths, calculate costs, check compliance - all without moving data.
                </p>
                <div className={styles.pipelineExample}>
                  <code>{`$graphLookup → $match → $sort → $limit`}</code>
                  <span>Find best route to Fiji instantly</span>
                </div>
              </div>

              <div className={styles.advantageCard}>
                <div className={styles.advantageIcon}>🌍</div>
                <h4>Global Distribution</h4>
                <p>
                  MongoDB Atlas enables payment configs to be globally distributed yet centrally
                  managed. Singapore office adds local format? It's instantly available worldwide
                  with geo-distributed replicas ensuring low-latency access.
                </p>
              </div>
            </div>

            <div className={styles.bottomInsight}>
              <div className={styles.insightHeader}>
                <span className={styles.insightIcon}>💡</span>
                <strong>The Perfect Match:</strong>
              </div>
              <p>
                Payment formats are hierarchical documents with nested structures (parties, amounts,
                instructions). MongoDB's document model naturally represents these complex relationships
                without the impedance mismatch of relational databases. One payment config = one document =
                one atomic update. This alignment makes configuration-driven architecture not just possible,
                but elegantly simple.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MongoDBDetailsModal;