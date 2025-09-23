'use client';

import { useState, memo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position } from 'reactflow';
import styles from './JsonBridgeNode.module.css';

function JsonBridgeNode({ data }) {
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('json'); // 'json' or 'mongodb'
  const [viewMode, setViewMode] = useState('document'); // 'document' or 'schema' for MongoDB tab
  const [expandedSections, setExpandedSections] = useState({
    header: true,
    transaction: true,
    parties: false,
    amounts: true,
    dates: true,
    remittance: true,
    instructions: false,
    references: false,
    charges: false,
    regulatory: false,
    processing_metadata: false,
    original_fields: false
  });

  const beforeConversion = data.beforeJson || null;
  const afterConversion = data.afterJson || null;
  const selectedScenario = data.selectedScenario || null;
  const mongoConfig = selectedScenario?.mongodbConfig || null;

  // Sample Canonical JSON MongoDB Document
  const canonicalJsonDocument = {
    "_id": "conv_20241215_TEST001",
    "_collection": "conversion_results",
    "header": {
      "message_type": "customer_transfer",
      "message_id": "TEST001",
      "creation_datetime": "2024-12-15T10:00:00Z",
      "source_format": "MT103",
      "priority": "normal",
      "network": {
        "network_type": "SWIFT",
        "service_level": "URGP"
      }
    },
    "transaction": {
      "transaction_id": "TXN-2024-123456",
      "end_to_end_id": "E2E-REF-001",
      "transaction_type": { "code": "CRED" },
      "status": "pending"
    },
    "parties": {
      "debtor": {
        "name": "ACME TECHNOLOGIES INC",
        "account": {
          "identification": "US64209876543210987654",
          "type": "BBAN",
          "currency": "USD"
        },
        "address": {
          "lines": [
            "1234 INNOVATION DRIVE",
            "SILICON VALLEY CA 94025"
          ]
        }
      },
      "debtor_agent": {
        "bic": "CHASUS33XXX",
        "name": "CHASE BANK"
      },
      "creditor": {
        "name": "GLOBAL SUPPLIES GMBH",
        "account": {
          "identification": "DE89370400440532013000",
          "type": "IBAN",
          "currency": "EUR"
        }
      },
      "creditor_agent": {
        "bic": "DEUTDEFFXXX",
        "name": "DEUTSCHE BANK"
      }
    },
    "amounts": {
      "instructed": {
        "value": "125750.50",
        "currency": "USD"
      },
      "settlement": {
        "value": "125750.50",
        "currency": "USD"
      },
      "charges": {
        "bearer": "SHAR"
      }
    },
    "dates": {
      "value_date": "2024-12-15",
      "execution_date": "2024-12-15T10:30:00Z"
    },
    "remittance": {
      "unstructured": [
        "INV-2024-11-3847 DATED 15.11.2024",
        "PAYMENT FOR ELECTRONIC COMPONENTS"
      ],
      "structured": {
        "invoice_number": "INV-2024-11-3847",
        "payment_purpose": "Electronic components"
      }
    },
    "instructions": {
      "payment_method": "TRF",
      "for_creditor_agent": [
        "/ACC/URGENT PROCESSING REQUIRED"
      ]
    },
    "references": {
      "message_reference": "TEST001",
      "transaction_reference": "TXN123456"
    },
    "charges": {
      "bearer_code": "SHAR",
      "total_charges": {
        "amount": "25.00",
        "currency": "USD"
      }
    },
    "regulatory": {
      "reporting_required": true,
      "compliance": {
        "aml_checked": true,
        "sanctions_checked": true
      }
    },
    "processing_metadata": {
      "conversion_id": "conv_123456",
      "source_format": "MT103",
      "target_format": "pacs.008",
      "lanes_used": {
        "rules": 18,
        "ai": 3,
        "human_review": 0
      },
      "confidence_scores": {
        "overall": 0.95
      }
    },
    "original_fields": {
      "20": "TEST001",
      "32A": "241215USD125750,50",
      "50K": "/US64209876543210987654\\nACME TECHNOLOGIES INC",
      "59": "/DE89370400440532013000\\nGLOBAL SUPPLIES GMBH",
      "70": "INV-2024-11-3847 DATED 15.11.2024"
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const renderJsonValue = (value, indent = 0) => {
    if (value === null) return <span className={styles.jsonNull}>null</span>;
    if (typeof value === 'boolean') return <span className={styles.jsonBoolean}>{value.toString()}</span>;
    if (typeof value === 'number') return <span className={styles.jsonNumber}>{value}</span>;
    if (typeof value === 'string') return <span className={styles.jsonString}>"{value}"</span>;

    if (Array.isArray(value)) {
      if (value.length === 0) return <span className={styles.jsonBracket}>[]</span>;
      if (value.every(item => typeof item === 'string')) {
        return (
          <span>
            <span className={styles.jsonBracket}>[</span>
            {value.map((item, idx) => (
              <span key={idx}>
                {idx > 0 && ', '}
                <span className={styles.jsonString}>"{item}"</span>
              </span>
            ))}
            <span className={styles.jsonBracket}>]</span>
          </span>
        );
      }
    }

    return null;
  };

  const renderJsonSection = (key, value, level = 0) => {
    const isExpanded = level === 0 ? expandedSections[key] : true;
    const hasChildren = typeof value === 'object' && value !== null && Object.keys(value).length > 0;

    return (
      <div key={key} className={styles.jsonNode} style={{ marginLeft: `${level * 20}px` }}>
        <div className={styles.jsonLine}>
          {level === 0 && hasChildren && (
            <span
              className={styles.jsonToggle}
              onClick={() => toggleSection(key)}
            >
              {isExpanded ? '▼' : '▶'}
            </span>
          )}
          <span className={key === '_id' || key === '_collection' ? styles.mongoSystemField : styles.jsonKey}>
            "{key}"
          </span>
          <span className={styles.jsonColon}>: </span>
          {!hasChildren ? (
            renderJsonValue(value)
          ) : (
            <span className={styles.jsonBracket}>{Array.isArray(value) ? '[' : '{'}</span>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div className={styles.jsonChildren}>
            {Object.entries(value).map(([childKey, childValue]) =>
              renderJsonSection(childKey, childValue, level + 1)
            )}
          </div>
        )}

        {hasChildren && isExpanded && (
          <div className={styles.jsonLine} style={{ marginLeft: `${level * 20}px` }}>
            <span className={styles.jsonBracket}>{Array.isArray(value) ? ']' : '}'}</span>
            {level === 0 && <span className={styles.jsonComma}>,</span>}
          </div>
        )}

        {hasChildren && !isExpanded && (
          <span className={styles.jsonCollapsed}> {'...'} </span>
        )}
      </div>
    );
  };

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleNodeClick = (e) => {
    e.stopPropagation();
    setShowJsonModal(true);
  };

  const closeModal = (e) => {
    e.stopPropagation();
    setShowJsonModal(false);
  };

  const formatJson = (json) => {
    if (!json) return null;
    try {
      const parsed = typeof json === 'string' ? JSON.parse(json) : json;
      return JSON.stringify(parsed, null, 2);
    } catch {
      return typeof json === 'string' ? json : JSON.stringify(json, null, 2);
    }
  };

  const modalContent = showJsonModal && mounted ? (
    <div className={styles.modalOverlay} onClick={closeModal}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>MongoDB Bridge Details</h2>
          <button className={styles.closeButton} onClick={closeModal}>✕</button>
        </div>

        <div className={styles.tabContainer}>
          <button
            className={`${styles.tab} ${activeTab === 'json' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('json')}
          >
            JSON Data
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'mongodb' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('mongodb')}
          >
            MongoDB Config
          </button>
        </div>

        <div className={styles.modalBody}>
          {activeTab === 'json' ? (
            <>
              <div className={styles.jsonSection}>
                <h3>Before Conversion (Input)</h3>
                <div className={styles.jsonContent}>
                  {beforeConversion ? (
                    <pre>{formatJson(beforeConversion)}</pre>
                  ) : (
                    <div className={styles.placeholder}>
                      Canonical JSON will appear here after execution
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.arrowDivider}>
                <span>⬇️</span>
              </div>

              <div className={styles.jsonSection}>
                <h3>After Conversion (Output)</h3>
                <div className={styles.jsonContent}>
                  {afterConversion ? (
                    <pre>{formatJson(afterConversion)}</pre>
                  ) : (
                    <div className={styles.placeholder}>
                      Converted JSON will appear here after execution
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className={styles.mongoConfigContent}>
              {mongoConfig ? (
                <>
                  {/* Canonical JSON Format Section */}
                  <div className={styles.configSection}>
                    <h3>📚 Canonical JSON - The Universal Payment Language</h3>
                    <div className={styles.canonicalExplanation}>
                      <p className={styles.introText}>
                        Canonical JSON is MongoDB's <strong>universal translator</strong> for payments.
                        Instead of building 100+ direct converters (MT103→CHAPS, MT202→TARGET2, etc.),
                        every format just converts to/from this single JSON structure stored in MongoDB.
                      </p>

                      {/* View Mode Toggle */}
                      <div className={styles.viewToggle}>
                        <button
                          className={`${styles.viewButton} ${viewMode === 'document' ? styles.activeView : ''}`}
                          onClick={() => setViewMode('document')}
                        >
                          📄 Document View
                        </button>
                        <button
                          className={`${styles.viewButton} ${viewMode === 'schema' ? styles.activeView : ''}`}
                          onClick={() => setViewMode('schema')}
                        >
                          🗂️ Schema View
                        </button>
                      </div>

                      {viewMode === 'document' ? (
                        <div className={styles.mongoDocument}>
                          <div className={styles.documentHeader}>
                            <span className={styles.collectionName}>conversion_results</span>
                            <button
                              className={styles.expandAllBtn}
                              onClick={() => {
                                const allExpanded = Object.values(expandedSections).every(v => v);
                                const newState = {};
                                Object.keys(expandedSections).forEach(key => {
                                  newState[key] = !allExpanded;
                                });
                                setExpandedSections(newState);
                              }}
                            >
                              {Object.values(expandedSections).every(v => v) ? 'Collapse All' : 'Expand All'}
                            </button>
                          </div>
                          <div className={styles.jsonDocument}>
                            <div className={styles.jsonBracket}>{'{'}</div>
                            {Object.entries(canonicalJsonDocument).map(([key, value]) =>
                              renderJsonSection(key, value)
                            )}
                            <div className={styles.jsonBracket}>{'}'}</div>
                          </div>
                        </div>
                      ) : (
                        <div className={styles.jsonStructure}>
                          <h4>🗂️ The 12 Universal Sections</h4>
                          <div className={styles.sectionsGrid}>
                            <div className={styles.schemaSection}>
                              <span className={styles.sectionIcon}>📋</span>
                              <div>
                                <strong>header</strong>
                                <span>Message type, ID, priority</span>
                              </div>
                            </div>
                            <div className={styles.schemaSection}>
                              <span className={styles.sectionIcon}>💳</span>
                              <div>
                                <strong>transaction</strong>
                                <span>Transaction ID, type, status</span>
                              </div>
                            </div>
                            <div className={styles.schemaSection}>
                              <span className={styles.sectionIcon}>👥</span>
                              <div>
                                <strong>parties</strong>
                                <span>Sender, receiver, banks</span>
                              </div>
                            </div>
                            <div className={styles.schemaSection}>
                              <span className={styles.sectionIcon}>💰</span>
                              <div>
                                <strong>amounts</strong>
                                <span>Payment amount, currency</span>
                              </div>
                            </div>
                            <div className={styles.schemaSection}>
                              <span className={styles.sectionIcon}>📅</span>
                              <div>
                                <strong>dates</strong>
                                <span>Value date, execution date</span>
                              </div>
                            </div>
                            <div className={styles.schemaSection}>
                              <span className={styles.sectionIcon}>📄</span>
                              <div>
                                <strong>remittance</strong>
                                <span>Invoice, payment details</span>
                              </div>
                            </div>
                            <div className={styles.schemaSection}>
                              <span className={styles.sectionIcon}>📝</span>
                              <div>
                                <strong>instructions</strong>
                                <span>Processing instructions</span>
                              </div>
                            </div>
                            <div className={styles.schemaSection}>
                              <span className={styles.sectionIcon}>🔗</span>
                              <div>
                                <strong>references</strong>
                                <span>Reference numbers</span>
                              </div>
                            </div>
                            <div className={styles.schemaSection}>
                              <span className={styles.sectionIcon}>💵</span>
                              <div>
                                <strong>charges</strong>
                                <span>Fees and charges</span>
                              </div>
                            </div>
                            <div className={styles.schemaSection}>
                              <span className={styles.sectionIcon}>⚖️</span>
                              <div>
                                <strong>regulatory</strong>
                                <span>Compliance info</span>
                              </div>
                            </div>
                            <div className={styles.schemaSection}>
                              <span className={styles.sectionIcon}>⚙️</span>
                              <div>
                                <strong>processing_metadata</strong>
                                <span>Conversion details</span>
                              </div>
                            </div>
                            <div className={styles.schemaSection}>
                              <span className={styles.sectionIcon}>📦</span>
                              <div>
                                <strong>original_fields</strong>
                                <span>Preserved source data</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className={styles.whyMatters}>
                        <h4>💡 Key Benefits</h4>
                        <div className={styles.benefitsList}>
                          <div className={styles.benefit}>
                            <span className={styles.benefitIcon}>✅</span>
                            <div>
                              <strong>No Data Loss</strong>
                              <span>Every field preserved in original_fields</span>
                            </div>
                          </div>
                          <div className={styles.benefit}>
                            <span className={styles.benefitIcon}>🚀</span>
                            <div>
                              <strong>Instant New Formats</strong>
                              <span>Just map to same JSON structure</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Scenario-Specific Configuration */}
                  {mongoConfig.bridge && (
                    <div className={styles.configSection}>
                      <h3>🌉 {mongoConfig.bridge.title}</h3>
                      <div className={styles.bridgeFlow}>
                        <div className={styles.bridgeItem}>
                          <strong>{mongoConfig.bridge.from}</strong>
                        </div>
                        <span className={styles.arrow}>→</span>
                        <div className={styles.bridgeItem}>
                          <strong>{mongoConfig.bridge.through}</strong>
                        </div>
                        <span className={styles.arrow}>→</span>
                        <div className={styles.bridgeItem}>
                          <strong>{mongoConfig.bridge.to}</strong>
                        </div>
                      </div>
                      <p className={styles.bridgeDesc}>{mongoConfig.bridge.description}</p>
                    </div>
                  )}

                  {/* Field Processing Details */}
                  {mongoConfig.mapping && (
                    <div className={styles.configSection}>
                      <h3>🔄 How This Scenario Works</h3>

                      {/* Processing Stats */}
                      <div className={styles.mappingStats}>
                        <span>Total Fields: {mongoConfig.mapping.totalFields}</span>
                        <span>Rules Lane: {mongoConfig.mapping.rulesLane}</span>
                        <span>AI Lane: {mongoConfig.mapping.aiLane}</span>
                        {mongoConfig.mapping.humanLane > 0 && (
                          <span>Human Review: {mongoConfig.mapping.humanLane}</span>
                        )}
                      </div>

                      {/* Example Mappings */}
                      {mongoConfig.mapping.examples && (
                        <>
                          <h4 style={{fontSize: '14px', marginTop: '16px', marginBottom: '12px'}}>Example Field Mappings:</h4>
                          <div className={styles.mappingExamples}>
                            {mongoConfig.mapping.examples.map((example, idx) => (
                              <div key={idx} className={styles.mappingRow}>
                                <span className={example.type === 'ai' ? styles.aiLabel : styles.rulesLabel}>
                                  {example.type === 'ai' ? '🤖' : '📋'}
                                </span>
                                <code>{example.source}</code>
                                <span className={styles.mappingArrow}>→</span>
                                <code>{example.target}</code>
                                <span style={{fontSize: '11px', color: '#6b7280', marginLeft: '8px'}}>
                                  {example.description}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Metrics */}
                  {mongoConfig.metrics && (
                    <div className={styles.configSection}>
                      <h3>📊 Performance Metrics</h3>
                      <div className={styles.metricsGrid}>
                        <div className={styles.metric}>
                          <span className={styles.metricValue}>{mongoConfig.metrics.accuracy}</span>
                          <span className={styles.metricLabel}>Accuracy</span>
                        </div>
                        <div className={styles.metric}>
                          <span className={styles.metricValue}>{mongoConfig.metrics.straightThrough}</span>
                          <span className={styles.metricLabel}>Straight-Through</span>
                        </div>
                        <div className={styles.metric}>
                          <span className={styles.metricValue}>{mongoConfig.metrics.costSaving}</span>
                          <span className={styles.metricLabel}>Cost Savings</span>
                        </div>
                        <div className={styles.metric}>
                          <span className={styles.metricValue}>{mongoConfig.metrics.setupTime}</span>
                          <span className={styles.metricLabel}>Setup Time</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Insights */}
                  {mongoConfig.insights && (
                    <div className={styles.insightBox}>
                      <h4>🚀 {mongoConfig.insights.key}</h4>
                      <p>{mongoConfig.insights.value}</p>
                      <p className={styles.impact}>
                        <strong>Impact:</strong> {mongoConfig.insights.impact}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.placeholder}>
                  Select a scenario to view MongoDB configuration details
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <div className={styles.info}>
            <span className={styles.infoIcon}>ℹ️</span>
            <span>
              {activeTab === 'json'
                ? 'The MongoDB Bridge uses a universal Canonical JSON format to enable seamless multi-hop conversions between any payment formats.'
                : 'MongoDB stores all conversion logic, enabling zero-code payment format transformations.'
              }
            </span>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div
        className={`${styles.jsonBridge} ${data.status === 'processing' ? styles.processing : ''} ${data.status === 'completed' ? styles.completed : ''}`}
        onClick={handleNodeClick}
        style={{ width: '150px', height: '80px' }}
      >
        <Handle
          type="target"
          position={Position.Left}
          className={styles.handle}
          style={{ background: '#059669' }}
        />

        <div className={styles.content}>
          <div className={styles.iconContainer}>
            <span className={styles.icon}>🔄</span>
          </div>

          <div className={styles.label}>
            <div className={styles.title}>MongoDB Bridge</div>
            <div className={styles.subtitle}>Canonical JSON</div>
          </div>
        </div>

        <Handle
          type="source"
          position={Position.Right}
          className={styles.handle}
          style={{ background: '#059669' }}
        />

        {data.status === 'processing' && (
          <div className={styles.processingIndicator}>
            <div className={styles.spinner}></div>
          </div>
        )}
      </div>

      {mounted && modalContent && createPortal(
        modalContent,
        document.body
      )}
    </>
  );
}

export default memo(JsonBridgeNode);