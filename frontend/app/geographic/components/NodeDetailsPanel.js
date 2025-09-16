'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './NodeDetailsPanel.module.css';

const FORMAT_INFO = {
  MT103: {
    name: 'SWIFT MT103',
    description: 'Single Customer Credit Transfer',
    fields: ['20: Transaction Reference', '32A: Value Date/Currency/Amount', '50K: Ordering Customer', '59: Beneficiary'],
    mongoConfig: 'MT103_to_pacs.008',  // Use actual config ID from MongoDB
    usedBy: 'International wire transfers',
    processingLanes: { rules: 85, ai: 10, human: 5 }
  },
  CHAPS: {
    name: 'UK CHAPS',
    description: 'UK High-Value Payment System',
    fields: ['MsgId', 'CreDtTm', 'InstdAmt', 'DbtrNm', 'CdtrNm'],
    mongoConfig: 'JSON_to_CHAPS',  // Use actual config ID from MongoDB
    usedBy: 'UK domestic high-value payments',
    processingLanes: { rules: 90, ai: 8, human: 2 }
  },
  TARGET2: {
    name: 'TARGET2',
    description: 'Trans-European Real-time Gross Settlement',
    fields: ['GrpHdr.MsgId', 'CdtTrfTxInf.PmtId', 'InstdAmt', 'DbtrAgt', 'CdtrAgt'],
    mongoConfig: 'JSON_to_TARGET2',  // Use actual config ID from MongoDB
    usedBy: 'Euro zone inter-bank transfers',
    processingLanes: { rules: 88, ai: 10, human: 2 }
  },
  'pacs.008': {
    name: 'ISO 20022 pacs.008',
    description: 'Customer Credit Transfer Initiation',
    fields: ['GrpHdr', 'CdtTrfTxInf', 'DbtrAcct', 'CdtrAcct', 'RmtInf'],
    mongoConfig: 'MT103_to_pacs.008',  // Use actual config ID from MongoDB
    usedBy: 'Modern payment systems globally',
    processingLanes: { rules: 92, ai: 6, human: 2 }
  },
  MT202: {
    name: 'SWIFT MT202',
    description: 'General Financial Institution Transfer',
    fields: ['20: Transaction Reference', '21: Related Reference', '32A: Value Date/Currency/Amount', '58: Beneficiary Institution'],
    mongoConfig: 'MT202_to_pacs.009',  // Use actual config ID from MongoDB
    usedBy: 'Bank-to-bank transfers',
    processingLanes: { rules: 87, ai: 10, human: 3 }
  },
  JSON: {
    name: 'Canonical JSON',
    description: 'Universal Bridge Format',
    fields: ['header', 'transaction', 'parties', 'amounts', 'remittance'],
    mongoConfig: 'MT103_to_JSON',  // Use actual config ID from MongoDB
    usedBy: 'Multi-hop routing bridge',
    processingLanes: { rules: 100, ai: 0, human: 0 }
  }
};

export default function NodeDetailsPanel({ selectedNode, nodePosition, onClose }) {
  const [activeTab, setActiveTab] = useState('format');
  const [mongoConfig, setMongoConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (selectedNode?.format && selectedNode.format !== 'Bridge') {
      fetchMongoConfig(selectedNode.format);
    }
  }, [selectedNode]);

  // Handle click outside to close panel
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        // Check if click is not on a React Flow node
        const isNodeClick = event.target.closest('.react-flow__node');
        if (!isNodeClick) {
          onClose();
        }
      }
    };

    if (selectedNode) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedNode, onClose]);

  const fetchMongoConfig = async (format) => {
    setLoading(true);
    try {
      const configId = FORMAT_INFO[format]?.mongoConfig;
      if (configId) {
        const response = await fetch(`http://localhost:8001/api/v1/converter/config/${configId}`);
        const data = await response.json();
        setMongoConfig(data);
      }
    } catch (error) {
      console.error('Error fetching MongoDB config:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!selectedNode) return null;

  const formatInfo = FORMAT_INFO[selectedNode.format] || FORMAT_INFO['JSON'];

  const renderFormatTab = () => (
    <div className={styles.tabContent}>
      <div className={styles.section}>
        <h4>{formatInfo.name}</h4>
        <p className={styles.description}>{formatInfo.description}</p>
        <div className={styles.infoBox}>
          <strong>Used for:</strong>
          <p>{formatInfo.usedBy}</p>
        </div>
      </div>

      <div className={styles.section}>
        <h5>Key Fields</h5>
        <ul className={styles.fieldList}>
          {formatInfo.fields.map((field, idx) => (
            <li key={idx} className={styles.fieldItem}>
              <code className={styles.fieldCode}>{field}</code>
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.section}>
        <h5>Processing Distribution</h5>
        <div className={styles.laneDistribution}>
          <div className={styles.laneBar}>
            <div
              className={`${styles.laneSegment} ${styles.rulesLane}`}
              style={{ width: `${formatInfo.processingLanes.rules}%` }}
            >
              <span className={styles.laneLabel}>Rules {formatInfo.processingLanes.rules}%</span>
            </div>
            <div
              className={`${styles.laneSegment} ${styles.aiLane}`}
              style={{ width: `${formatInfo.processingLanes.ai}%` }}
            >
              <span className={styles.laneLabel}>AI {formatInfo.processingLanes.ai}%</span>
            </div>
            <div
              className={`${styles.laneSegment} ${styles.humanLane}`}
              style={{ width: `${formatInfo.processingLanes.human}%` }}
            >
              <span className={styles.laneLabel}>Human {formatInfo.processingLanes.human}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMongoTab = () => (
    <div className={styles.tabContent}>
      <div className={styles.section}>
        <h4>MongoDB Configuration</h4>
        <p className={styles.description}>
          This format is stored as a configuration document in MongoDB, enabling 100% generic conversion
        </p>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading configuration...</div>
      ) : mongoConfig ? (
        <>
          <div className={styles.section}>
            <h5>Parser Configuration</h5>
            <div className={styles.codeBlock}>
              <pre>{JSON.stringify({
                type: mongoConfig.parser?.type || 'regex',
                fields: Object.keys(mongoConfig.parser?.fields || {}).slice(0, 3).map(key => ({
                  [key]: mongoConfig.parser.fields[key].pattern
                }))
              }, null, 2)}</pre>
            </div>
          </div>

          <div className={styles.section}>
            <h5>Field Mappings ({mongoConfig.mappings?.length || 0} total)</h5>
            <div className={styles.mappingList}>
              {(mongoConfig.mappings || []).slice(0, 5).map((mapping, idx) => (
                <div key={idx} className={styles.mappingItem}>
                  <span className={styles.sourceField}>{mapping.source}</span>
                  <span className={styles.arrow}>→</span>
                  <span className={styles.targetField}>{mapping.targets?.join(', ')}</span>
                  <span className={`${styles.laneBadge} ${styles[`${mapping.processing_lane?.toLowerCase() || 'rules'}Badge`]}`}>
                    {mapping.processing_lane || 'RULES'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <h5>Generic Converter Process</h5>
            <div className={styles.processList}>
              <div className={styles.processStep}>
                <span className={styles.stepNumber}>1</span>
                <div>
                  <strong>PARSE</strong>
                  <p>Extract fields using regex patterns from MongoDB config</p>
                </div>
              </div>
              <div className={styles.processStep}>
                <span className={styles.stepNumber}>2</span>
                <div>
                  <strong>TRANSFORM</strong>
                  <p>Apply field mappings through 3-lane architecture</p>
                </div>
              </div>
              <div className={styles.processStep}>
                <span className={styles.stepNumber}>3</span>
                <div>
                  <strong>BUILD</strong>
                  <p>Construct target format from transformed fields</p>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className={styles.noConfig}>No configuration available</div>
      )}
    </div>
  );

  const renderCanonicalTab = () => (
    <div className={styles.tabContent}>
      <div className={styles.section}>
        <h4>Canonical JSON Bridge</h4>
        <p className={styles.description}>
          Canonical JSON acts as the universal bridge enabling any-to-any format conversion
        </p>
      </div>

      <div className={styles.section}>
        <h5>Transformation Flow</h5>
        <div className={styles.transformFlow}>
          <div className={styles.transformBox}>
            <strong>{selectedNode.format}</strong>
            <p>Source Format</p>
          </div>
          <div className={styles.transformArrow}>→</div>
          <div className={styles.transformBox}>
            <strong>Canonical JSON</strong>
            <p>Universal Structure</p>
          </div>
          <div className={styles.transformArrow}>→</div>
          <div className={styles.transformBox}>
            <strong>Target Format</strong>
            <p>Any Supported Format</p>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h5>Canonical Structure</h5>
        <div className={styles.codeBlock}>
          <pre>{JSON.stringify({
            header: {
              message_id: "Unique identifier",
              creation_date: "ISO timestamp",
              message_type: selectedNode.format
            },
            transaction: {
              reference: "Transaction reference",
              type: "credit_transfer",
              currency: "USD",
              amount: 100000.00
            },
            parties: {
              debtor: { name: "...", account: "..." },
              creditor: { name: "...", account: "..." }
            },
            remittance: {
              unstructured: ["Payment details"]
            }
          }, null, 2)}</pre>
        </div>
      </div>

      <div className={styles.section}>
        <h5>Benefits of Canonical JSON</h5>
        <ul className={styles.benefitsList}>
          <li>✅ Enables multi-hop routing between any formats</li>
          <li>✅ No direct converters needed between all format pairs</li>
          <li>✅ Consistent field mapping across all conversions</li>
          <li>✅ No data loss during transformation</li>
          <li>✅ Extensible for new formats without code changes</li>
        </ul>
      </div>
    </div>
  );

  // Calculate panel position based on node position
  const getPanelStyle = () => {
    if (!nodePosition) return {};

    const panelWidth = 400;
    const panelHeight = 500;
    const padding = 20;

    let left = nodePosition.x + padding;
    let top = nodePosition.y - panelHeight / 2;

    // Adjust if panel would go off screen
    if (left + panelWidth > window.innerWidth) {
      left = nodePosition.x - panelWidth - padding;
    }

    if (top < 80) { // Account for header
      top = 80;
    }

    if (top + panelHeight > window.innerHeight - 260) { // Account for timeline
      top = window.innerHeight - 260 - panelHeight;
    }

    return {
      left: `${left}px`,
      top: `${top}px`,
    };
  };

  return (
    <div
      ref={panelRef}
      className={`${styles.floatingPanel} ${selectedNode ? styles.open : ''}`}
      style={getPanelStyle()}
    >
      <div className={styles.panelHeader}>
        <div className={styles.nodeInfo}>
          <span className={styles.nodeIcon}>{selectedNode.icon}</span>
          <div>
            <h3>{selectedNode.country}</h3>
            <p className={styles.nodeFormat}>{selectedNode.format} Format</p>
          </div>
        </div>
        <button className={styles.closeButton} onClick={onClose}>×</button>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'format' ? styles.active : ''}`}
          onClick={() => setActiveTab('format')}
        >
          Format Details
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'mongo' ? styles.active : ''}`}
          onClick={() => setActiveTab('mongo')}
        >
          MongoDB Config
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'canonical' ? styles.active : ''}`}
          onClick={() => setActiveTab('canonical')}
        >
          Canonical JSON
        </button>
      </div>

      <div className={styles.panelContent}>
        {activeTab === 'format' && renderFormatTab()}
        {activeTab === 'mongo' && renderMongoTab()}
        {activeTab === 'canonical' && renderCanonicalTab()}
      </div>
    </div>
  );
}