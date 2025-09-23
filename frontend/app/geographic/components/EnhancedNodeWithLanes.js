import React, { useState, memo } from 'react';
import { Handle, Position } from 'reactflow';
import styles from './EnhancedNodeWithLanes.module.css';

const EnhancedNodeWithLanes = memo(({ data, selected }) => {
  const [expanded, setExpanded] = useState(false);
  const isProcessing = data.processingState === 'processing';
  const isComplete = data.processingState === 'complete';

  // Lane statistics from conversion results
  const laneStats = data.laneStats || {
    rules: data.rulesCount || 0,
    ai: data.aiCount || 0,
    human: data.humanCount || 0
  };

  // Field mappings for expanded view
  const fieldMappings = data.fieldMappings || [];

  // AI fields with confidence
  const aiFields = data.aiFields || [];
  const avgConfidence = data.avgConfidence || 0;

  // Processing metrics
  const processingTime = data.processingTime || '0ms';
  const totalFields = data.totalFields || 0;

  const toggleExpand = (e) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <div
      className={`${styles.enhancedNode} ${isProcessing ? styles.processing : ''} ${expanded ? styles.expanded : ''}`}
    >
      {/* Status Indicator */}
      {isProcessing && <div className={styles.statusIndicator} />}

      {/* Node Header */}
      <div className={styles.nodeHeader}>
        <div className={styles.nodeTitle}>
          <span className={styles.nodeIcon}>{data.icon || '🌐'}</span>
          <div className={styles.nodeInfo}>
            <h3>{data.label}</h3>
            {data.location && <span className={styles.location}>{data.location}</span>}
          </div>
        </div>
        <span className={styles.formatBadge}>{data.format}</span>
      </div>

      {/* Processing Status Bar - Only show for bridge nodes */}
      {data.showLaneIndicators && (
        <div className={styles.processingStatus}>
          <div className={styles.statusLabel}>
            {data.sourceFormat} → {data.targetFormat} Processing
          </div>
          <div className={styles.laneIndicators}>
            <div className={`${styles.laneBadge} ${styles.rules} ${laneStats.rules > 0 ? styles.active : styles.inactive}`}>
              <span className={styles.laneName}>RULES</span>
              <span className={styles.laneCount}>{laneStats.rules}</span>
              <span className={styles.laneLabel}>fields</span>
            </div>
            <div className={`${styles.laneBadge} ${styles.ai} ${laneStats.ai > 0 ? styles.active : styles.inactive}`}>
              <span className={styles.laneName}>AI</span>
              <span className={styles.laneCount}>{laneStats.ai}</span>
              <span className={styles.laneLabel}>fields</span>
            </div>
            <div className={`${styles.laneBadge} ${styles.human} ${laneStats.human > 0 ? styles.active : styles.inactive}`}>
              <span className={styles.laneName}>HUMAN</span>
              <span className={styles.laneCount}>{laneStats.human}</span>
              <span className={styles.laneLabel}>fields</span>
            </div>
          </div>

          {/* Progress Bar */}
          {isProcessing && (
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${data.progress || 0}%` }} />
            </div>
          )}

          {/* Direct mapping message for JSON→CHAPS */}
          {data.format === 'CHAPS' && laneStats.ai === 0 && (
            <div className={styles.directMappingMessage}>
              ✓ All fields mapped directly from structured JSON
            </div>
          )}
        </div>
      )}

      {/* AI Confidence Section - Only show if AI fields exist */}
      {aiFields.length > 0 && (
        <div className={styles.confidenceSection}>
          <div className={styles.confidenceMeter}>
            <span className={styles.metricLabel}>AI Confidence</span>
            <div className={styles.confidenceBar}>
              <div className={styles.confidenceFill} style={{ width: `${avgConfidence}%` }} />
            </div>
            <span className={styles.confidenceValue}>{avgConfidence}%</span>
          </div>
          <div className={styles.aiFields}>
            {aiFields.map((field, idx) => (
              <span key={idx} className={styles.aiFieldChip}>
                {field.name} {field.confidence && `(${field.confidence}%)`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Real-time Metrics */}
      <div className={styles.realtimeMetrics}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Status</span>
          <span className={`${styles.metricValue} ${isComplete ? styles.success : ''}`}>
            {isComplete ? '✓ Complete' : isProcessing ? 'Processing...' : 'Ready'}
          </span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>
            {isProcessing ? 'Elapsed' : 'Time'}
          </span>
          <span className={styles.metricValue}>{processingTime}</span>
        </div>
        {data.format !== 'MT103' && (
          <>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Input</span>
              <span className={styles.metricValue}>{data.inputFields || totalFields} fields</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Output</span>
              <span className={styles.metricValue}>{data.outputFields || totalFields} fields</span>
            </div>
          </>
        )}
      </div>

      {/* Expand Button */}
      {fieldMappings.length > 0 && (
        <>
          <div className={styles.expandButton} onClick={toggleExpand}>
            View {data.format === 'JSON' ? 'Field Mapping' : 'Details'}
            <span className={styles.expandIcon}>{expanded ? '▲' : '▼'}</span>
          </div>

          {/* Field Mapping Details (Expandable) */}
          {expanded && (
            <div className={styles.fieldMappingDetails}>
              <div className={styles.mappingHeader}>
                {data.format === 'JSON'
                  ? `Field Transformation (${fieldMappings.length} mappings)`
                  : data.format === 'CHAPS'
                  ? `JSON → CHAPS Mapping (${fieldMappings.length} fields from ${data.inputFields || 21})`
                  : `Source Fields (${data.format})`}
              </div>
              <div className={styles.fieldFlowGrid}>
                {fieldMappings.slice(0, 6).map((mapping, idx) => (
                  <div
                    key={idx}
                    className={`${styles.fieldFlowItem} ${
                      mapping.status === 'success' ? styles.success :
                      mapping.status === 'dropped' ? styles.dropped :
                      mapping.status === 'warning' ? styles.warning : ''
                    }`}
                  >
                    <span className={styles.fieldSource}>{mapping.source}</span>
                    {mapping.target && (
                      <>
                        <span className={styles.fieldArrow}>{mapping.dropped ? '✗' : '→'}</span>
                        <span className={styles.fieldTarget}>{mapping.target}</span>
                      </>
                    )}
                    {mapping.statusIcon && (
                      <span className={`${styles.fieldStatus} ${styles[mapping.status]}`}>
                        {mapping.statusIcon}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {data.mappingSummary && (
                <div className={styles.mappingSummary}>
                  {data.mappingSummary}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* React Flow Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className={styles.handle}
        style={{ background: '#00A35C' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className={styles.handle}
        style={{ background: '#00A35C' }}
      />
    </div>
  );
});

EnhancedNodeWithLanes.displayName = 'EnhancedNodeWithLanes';

export default EnhancedNodeWithLanes;