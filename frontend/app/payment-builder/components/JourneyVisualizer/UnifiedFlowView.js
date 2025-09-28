'use client';

import { useState, useEffect } from 'react';
import styles from './UnifiedFlowView.module.css';

export default function UnifiedFlowView({
  sourceFormat,
  targetFormat,
  currentStage,
  executionResult,
  isProcessing,
  sourceMessage,
  targetMessage
}) {
  const [expandedStages, setExpandedStages] = useState({
    config: false,
    parse: false,
    transform: true,
    build: false
  });

  const [config, setConfig] = useState(null);
  const [expandedConfigSections, setExpandedConfigSections] = useState({
    parser: true,
    mappings: false,
    builder: false,
    ai_config: false
  });

  useEffect(() => {
    const fetchConfig = async () => {
      if (!sourceFormat || !targetFormat) return;

      try {
        const conversionId = `${sourceFormat}_to_${targetFormat}`;
        const response = await fetch(`http://localhost:8001/api/v1/converter/config/${conversionId}`);
        if (response.ok) {
          const data = await response.json();
          setConfig(data);
        }
      } catch (error) {
        console.error('Failed to fetch config:', error);
      }
    };

    fetchConfig();
  }, [sourceFormat, targetFormat]);

  const toggleStage = (stage) => {
    setExpandedStages(prev => ({
      ...prev,
      [stage]: !prev[stage]
    }));
  };

  const getStageStatus = (stageId) => {
    if (executionResult) return 'completed';
    if (isProcessing) {
      if (currentStage > stageId) return 'completed';
      if (currentStage === stageId) return 'processing';
    }
    return 'pending';
  };

  const StatusIcon = ({ status }) => {
    if (status === 'completed') {
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" className={styles.checkIcon}>
          <path
            d="M4 10 L8 14 L16 6"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    }
    if (status === 'processing') {
      return <div className={styles.spinner} />;
    }
    return <span className={styles.stageNumber}>•</span>;
  };

  const parseStats = executionResult?.conversion_metadata?.processing_stats;
  const confidenceScores = executionResult?.conversion_metadata?.confidence_scores || {};

  const totalFields = parseStats
    ? (parseStats.rules_lane?.count || 0) +
      (parseStats.ai_lane?.count || 0) +
      (parseStats.human_lane?.count || 0)
    : 0;

  const overallConfidence = executionResult?.conversion_metadata?.confidence_scores?.overall
    ? (executionResult.conversion_metadata.confidence_scores.overall * 100).toFixed(1)
    : null;

  const processingTime = executionResult?.conversion_metadata?.processing_time_seconds?.toFixed(2);

  const getConfidenceColor = (score) => {
    if (score >= 90) return styles.highConfidence;
    if (score >= 80) return styles.mediumConfidence;
    return styles.lowConfidence;
  };

  const toggleConfigSection = (section) => {
    setExpandedConfigSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const renderJsonValue = (value) => {
    if (value === null) return <span className={styles.jsonNull}>null</span>;
    if (typeof value === 'boolean') return <span className={styles.jsonBoolean}>{value.toString()}</span>;
    if (typeof value === 'number') return <span className={styles.jsonNumber}>{value}</span>;
    if (typeof value === 'string') return <span className={styles.jsonString}>"{value}"</span>;

    if (Array.isArray(value)) {
      if (value.length === 0) return <span className={styles.jsonBracket}>[]</span>;
      return <span className={styles.jsonBracket}>[...]</span>;
    }

    if (typeof value === 'object') {
      return <span className={styles.jsonBracket}>{'{...}'}</span>;
    }

    return null;
  };

  const renderJsonSection = (key, value, level = 0) => {
    const isExpanded = level === 0 ? expandedConfigSections[key] : true;
    const hasChildren = typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length > 0;
    const isArray = Array.isArray(value) && value.length > 0;
    const hasContent = hasChildren || isArray;

    return (
      <div key={key} className={styles.jsonNode} style={{ marginLeft: `${level * 20}px` }}>
        <div className={styles.jsonLine}>
          {level === 0 && hasContent && (
            <span
              className={styles.jsonToggle}
              onClick={() => toggleConfigSection(key)}
            >
              {isExpanded ? '▼' : '▶'}
            </span>
          )}
          <span className={key === '_id' ? styles.mongoSystemField : styles.jsonKey}>
            "{key}"
          </span>
          <span className={styles.jsonColon}>: </span>
          {!hasContent ? (
            renderJsonValue(value)
          ) : (
            <span className={styles.jsonBracket}>{isArray ? '[' : '{'}</span>
          )}
        </div>

        {hasContent && isExpanded && (
          <div className={styles.jsonChildren}>
            {isArray ? (
              value.map((item, idx) => (
                <div key={idx} className={styles.jsonNode} style={{ marginLeft: `${(level + 1) * 20}px` }}>
                  <div className={styles.jsonLine}>
                    <span className={styles.jsonBracket}>[{idx}]</span>
                    <span className={styles.jsonColon}>: </span>
                    {typeof item === 'object' && item !== null ? (
                      <span className={styles.jsonBracket}>{'{'}</span>
                    ) : (
                      renderJsonValue(item)
                    )}
                  </div>
                  {typeof item === 'object' && item !== null && (
                    <div className={styles.jsonChildren}>
                      {Object.entries(item).map(([childKey, childValue]) => (
                        <div key={childKey} className={styles.jsonNode} style={{ marginLeft: `${(level + 2) * 20}px` }}>
                          <div className={styles.jsonLine}>
                            <span className={styles.jsonKey}>"{childKey}"</span>
                            <span className={styles.jsonColon}>: </span>
                            {renderJsonValue(childValue)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              Object.entries(value).map(([childKey, childValue]) =>
                renderJsonSection(childKey, childValue, level + 1)
              )
            )}
          </div>
        )}

        {hasContent && isExpanded && (
          <div className={styles.jsonLine} style={{ marginLeft: `${level * 20}px` }}>
            <span className={styles.jsonBracket}>{isArray ? ']' : '}'}</span>
            {level === 0 && <span className={styles.jsonComma}>,</span>}
          </div>
        )}

        {hasContent && !isExpanded && (
          <span className={styles.jsonCollapsed}> {'...'} </span>
        )}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      {/* MongoDB Config Section */}
      {config && (
        <div className={styles.configSection}>
          <div
            className={styles.configHeader}
            onClick={() => setExpandedStages(prev => ({ ...prev, config: !prev.config }))}
          >
            <div className={styles.configHeaderLeft}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 3h14v14H3V3z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                <path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
              <div className={styles.configInfo}>
                <h4 className={styles.configTitle}>MongoDB Configuration</h4>
                <p className={styles.configDesc}>
                  Collection: conversion_registry | Document: {config._id}
                </p>
              </div>
            </div>
            <button className={styles.expandButton}>
              {expandedStages.config ? '▲' : '▼'}
            </button>
          </div>
          {expandedStages.config && (
            <div className={styles.configContent}>
              <div className={styles.documentHeader}>
                <span className={styles.collectionName}>conversion_registry</span>
                <button
                  className={styles.expandAllBtn}
                  onClick={() => {
                    const allExpanded = Object.values(expandedConfigSections).every(v => v);
                    const newState = {};
                    Object.keys(expandedConfigSections).forEach(key => {
                      newState[key] = !allExpanded;
                    });
                    setExpandedConfigSections(newState);
                  }}
                >
                  {Object.values(expandedConfigSections).every(v => v) ? 'Collapse All' : 'Expand All'}
                </button>
              </div>
              <div className={styles.jsonDocument}>
                <div className={styles.jsonBracket}>{'{'}</div>
                {Object.entries(config).map(([key, value]) =>
                  renderJsonSection(key, value)
                )}
                <div className={styles.jsonBracket}>{'}'}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Overall Status Banner */}
      {(executionResult || isProcessing) && (
        <div className={styles.statusBanner}>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>Status</span>
            <span className={styles.statusValue}>
              {isProcessing ? '⚡ Processing...' : '✓ Completed'}
            </span>
          </div>
          {overallConfidence && (
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>Confidence</span>
              <span className={`${styles.statusValue} ${getConfidenceColor(parseFloat(overallConfidence))}`}>
                {overallConfidence}%
              </span>
            </div>
          )}
          {processingTime && (
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>Time</span>
              <span className={styles.statusValue}>{processingTime}s</span>
            </div>
          )}
          {totalFields > 0 && (
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>Fields</span>
              <span className={styles.statusValue}>{totalFields}</span>
            </div>
          )}
        </div>
      )}

      {/* Stage 1: Parse */}
      <div className={styles.stageContainer}>
        <div
          className={`${styles.stageHeader} ${styles[getStageStatus(1)]}`}
          onClick={() => toggleStage('parse')}
        >
          <div className={styles.stageHeaderLeft}>
            <div className={styles.stageIcon}>
              <StatusIcon status={getStageStatus(1)} />
            </div>
            <div className={styles.stageInfo}>
              <h4 className={styles.stageName}>Parse</h4>
              <p className={styles.stageDesc}>
                {sourceFormat} → {totalFields > 0 ? `Extracted ${totalFields} fields` : 'Extract fields from source'}
              </p>
            </div>
          </div>
          <button className={styles.expandButton}>
            {expandedStages.parse ? '▲' : '▼'}
          </button>
        </div>

        {expandedStages.parse && executionResult && config && (
          <div className={styles.stageContent}>
            <div className={styles.explainSection}>
              <h5 className={styles.explainTitle}>MongoDB Collection: conversion_registry</h5>
              <p className={styles.explainText}>
                Document: <strong>{sourceFormat}_to_{targetFormat}</strong> | Field: <strong>parser.fields</strong>
              </p>
            </div>

            <div className={styles.exampleSection}>
              {config.parser?.fields && Object.entries(config.parser.fields).slice(0, 2).map(([fieldId, fieldConfig]) => (
                <div key={fieldId} className={styles.exampleCard}>
                  <div className={styles.exampleLabel}>
                    Field {fieldId} ({fieldConfig.name})
                  </div>
                  <div className={styles.exampleFlow}>
                    <div className={styles.exampleStep}>
                      <span className={styles.stepLabel}>MongoDB Config</span>
                      <code className={styles.stepValue}>
                        {JSON.stringify({
                          field_id: fieldId,
                          pattern: fieldConfig.pattern,
                          name: fieldConfig.name,
                          ...(fieldConfig.components && { components: fieldConfig.components }),
                          ...(fieldConfig.multiline && { multiline: fieldConfig.multiline })
                        }, null, 2)}
                      </code>
                    </div>
                    <div className={styles.flowArrow}>→</div>
                    <div className={styles.exampleStep}>
                      <span className={styles.stepLabel}>Extracts</span>
                      <code className={styles.stepValue}>
                        {fieldConfig.components
                          ? Object.keys(fieldConfig.components).join(', ')
                          : fieldConfig.name}
                      </code>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.resultBadge}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2" fill="none"/>
              </svg>
              Extracted {totalFields} fields using {Object.keys(config.parser?.fields || {}).length} patterns from MongoDB
            </div>
          </div>
        )}

        <div className={styles.stageArrow}>↓</div>
      </div>

      {/* Stage 2: Transform */}
      <div className={styles.stageContainer}>
        <div
          className={`${styles.stageHeader} ${styles[getStageStatus(2)]}`}
          onClick={() => toggleStage('transform')}
        >
          <div className={styles.stageHeaderLeft}>
            <div className={styles.stageIcon}>
              <StatusIcon status={getStageStatus(2)} />
            </div>
            <div className={styles.stageInfo}>
              <h4 className={styles.stageName}>Transform</h4>
              <p className={styles.stageDesc}>
                {parseStats
                  ? `${parseStats.rules_lane?.count || 0} Rules | ${parseStats.ai_lane?.count || 0} AI | ${parseStats.human_lane?.count || 0} Human`
                  : '3-Lane Processing'
                }
              </p>
            </div>
          </div>
          <button className={styles.expandButton}>
            {expandedStages.transform ? '▲' : '▼'}
          </button>
        </div>

        {expandedStages.transform && executionResult && config && (
          <div className={styles.stageContent}>
            <div className={styles.explainSection}>
              <h5 className={styles.explainTitle}>MongoDB Collection: conversion_registry</h5>
              <p className={styles.explainText}>
                Document: <strong>{sourceFormat}_to_{targetFormat}</strong> | Field: <strong>mappings[]</strong>
              </p>
            </div>

            <div className={styles.exampleSection}>
              {/* Show one RULES lane mapping */}
              {config.mappings?.find(m => m.processing_lane === 'RULES' || !m.processing_lane) && (
                <div className={styles.exampleCard}>
                  <div className={styles.exampleLabel}>Rules Lane Example</div>
                  <div className={styles.exampleFlow}>
                    <div className={styles.exampleStep}>
                      <span className={styles.stepLabel}>MongoDB Config</span>
                      <code className={styles.stepValue}>
                        {JSON.stringify(
                          config.mappings.find(m => m.processing_lane === 'RULES' || !m.processing_lane),
                          null,
                          2
                        )}
                      </code>
                    </div>
                    <div className={styles.flowArrow}>→</div>
                    <div className={styles.exampleStep}>
                      <span className={styles.stepLabel}>Processing</span>
                      <code className={styles.stepValue}>Deterministic<br/>100% confidence</code>
                    </div>
                  </div>
                </div>
              )}

              {/* Show one AI lane mapping */}
              {config.mappings?.find(m => m.processing_lane === 'AI') && (
                <div className={styles.exampleCard}>
                  <div className={styles.exampleLabel}>AI Lane Example</div>
                  <div className={styles.exampleFlow}>
                    <div className={styles.exampleStep}>
                      <span className={styles.stepLabel}>MongoDB Config</span>
                      <code className={styles.stepValue}>
                        {JSON.stringify(
                          config.mappings.find(m => m.processing_lane === 'AI'),
                          null,
                          2
                        )}
                      </code>
                    </div>
                    <div className={styles.flowArrow}>→</div>
                    <div className={styles.exampleStep}>
                      <span className={styles.stepLabel}>Processing</span>
                      <code className={styles.stepValue}>
                        AI extraction<br/>
                        Confidence varies<br/>
                        Review if below threshold
                      </code>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Overall Confidence Meter */}
            {overallConfidence && (
              <div className={styles.confidenceMeter}>
                <div className={styles.confidenceHeader}>
                  <span className={styles.confidenceLabel}>Overall Confidence</span>
                  <span className={`${styles.confidenceValue} ${getConfidenceColor(parseFloat(overallConfidence))}`}>
                    {overallConfidence}%
                  </span>
                </div>
                <div className={styles.progressBar}>
                  <div
                    className={`${styles.progressFill} ${getConfidenceColor(parseFloat(overallConfidence))}`}
                    style={{ width: `${overallConfidence}%` }}
                  />
                </div>
              </div>
            )}

            {/* Lane Distribution */}
            <div className={styles.lanesSection}>
              <h5 className={styles.sectionTitle}>Processing Lanes</h5>

              {/* Rules Lane */}
              {parseStats?.rules_lane && (
                <div className={styles.laneCard}>
                  <div className={styles.laneHeader}>
                    <div className={styles.laneIcon}>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M3 3h14v14H3V3z" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M6 6h8M6 10h8M6 14h4" stroke="currentColor" strokeWidth="1.5"/>
                      </svg>
                    </div>
                    <div className={styles.laneInfo}>
                      <span className={styles.laneName}>Rules Lane</span>
                      <span className={styles.laneCount}>{parseStats.rules_lane.count} fields</span>
                    </div>
                  </div>
                  <div className={styles.laneProgress}>
                    <div className={`${styles.laneProgressBar} ${styles.rulesBar}`}
                         style={{ width: `${(parseStats.rules_lane.count / totalFields * 100).toFixed(1)}%` }} />
                  </div>
                  <div className={styles.fieldTags}>
                    {parseStats.rules_lane.fields?.slice(0, 3).map((field, idx) => (
                      <span key={idx} className={styles.fieldTag}>{field}</span>
                    ))}
                    {parseStats.rules_lane.fields?.length > 3 && (
                      <span className={styles.fieldMore}>+{parseStats.rules_lane.fields.length - 3}</span>
                    )}
                  </div>
                </div>
              )}

              {/* AI Lane */}
              {parseStats?.ai_lane && (
                <div className={styles.laneCard}>
                  <div className={styles.laneHeader}>
                    <div className={`${styles.laneIcon} ${styles.aiIcon}`}>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M10 7v3M10 13h.01" stroke="currentColor" strokeWidth="1.5"/>
                      </svg>
                    </div>
                    <div className={styles.laneInfo}>
                      <span className={styles.laneName}>AI Lane</span>
                      <span className={styles.laneCount}>{parseStats.ai_lane.count} fields</span>
                    </div>
                  </div>
                  <div className={styles.laneProgress}>
                    <div className={`${styles.laneProgressBar} ${styles.aiBar}`}
                         style={{ width: `${(parseStats.ai_lane.count / totalFields * 100).toFixed(1)}%` }} />
                  </div>
                  <div className={styles.fieldTags}>
                    {parseStats.ai_lane.fields?.map((field, idx) => {
                      const confidence = confidenceScores[field];
                      return (
                        <div key={idx} className={styles.fieldWithConfidence}>
                          <span className={styles.fieldTag}>{field}</span>
                          {confidence && (
                            <span className={`${styles.confidenceBadge} ${getConfidenceColor(confidence * 100)}`}>
                              {(confidence * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Human Review Lane */}
              {parseStats?.human_lane !== undefined && (
                <div className={styles.laneCard}>
                  <div className={styles.laneHeader}>
                    <div className={`${styles.laneIcon} ${styles.humanIcon}`}>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M10 10v7M7 17h6" stroke="currentColor" strokeWidth="1.5"/>
                      </svg>
                    </div>
                    <div className={styles.laneInfo}>
                      <span className={styles.laneName}>Human Review</span>
                      <span className={styles.laneCount}>{parseStats.human_lane.count || 0} fields</span>
                    </div>
                  </div>
                  {parseStats.human_lane.count > 0 ? (
                    <>
                      <div className={styles.laneProgress}>
                        <div className={`${styles.laneProgressBar} ${styles.humanBar}`}
                             style={{ width: `${(parseStats.human_lane.count / totalFields * 100).toFixed(1)}%` }} />
                      </div>
                      <div className={styles.fieldTags}>
                        {parseStats.human_lane.fields?.map((field, idx) => (
                          <span key={idx} className={`${styles.fieldTag} ${styles.reviewTag}`}>{field}</span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className={styles.noReview}>✓ No review required</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className={styles.stageArrow}>↓</div>
      </div>

      {/* Stage 3: Build */}
      <div className={styles.stageContainer}>
        <div
          className={`${styles.stageHeader} ${styles[getStageStatus(3)]}`}
          onClick={() => toggleStage('build')}
        >
          <div className={styles.stageHeaderLeft}>
            <div className={styles.stageIcon}>
              <StatusIcon status={getStageStatus(3)} />
            </div>
            <div className={styles.stageInfo}>
              <h4 className={styles.stageName}>Build</h4>
              <p className={styles.stageDesc}>
                {targetFormat} → {executionResult ? 'Generated output' : 'Construct target format'}
              </p>
            </div>
          </div>
          <button className={styles.expandButton}>
            {expandedStages.build ? '▲' : '▼'}
          </button>
        </div>

        {expandedStages.build && executionResult && config && (
          <div className={styles.stageContent}>
            <div className={styles.explainSection}>
              <h5 className={styles.explainTitle}>MongoDB Collection: conversion_registry</h5>
              <p className={styles.explainText}>
                Document: <strong>{sourceFormat}_to_{targetFormat}</strong> | Field: <strong>builder.template</strong>
              </p>
            </div>

            <div className={styles.exampleSection}>
              <div className={styles.exampleCard}>
                <div className={styles.exampleLabel}>Builder Configuration</div>
                <div className={styles.buildFlow}>
                  <div className={styles.buildStep}>
                    <span className={styles.stepLabel}>MongoDB Config</span>
                    <code className={styles.buildTemplate}>
                      {(() => {
                        const templateStr = JSON.stringify(config.builder?.template, null, 2);
                        return templateStr.length > 300
                          ? templateStr.substring(0, 300) + '...'
                          : templateStr;
                      })()}
                    </code>
                  </div>
                  <div className={styles.flowArrow}>+</div>
                  <div className={styles.buildStep}>
                    <span className={styles.stepLabel}>Transformed Fields</span>
                    <code className={styles.buildValues}>
                      All {totalFields} fields<br/>
                      from Transform stage<br/>
                      populate template<br/>
                      (e.g., {'{{MsgId}}'} → value)
                    </code>
                  </div>
                  <div className={styles.flowArrow}>=</div>
                  <div className={styles.buildStep}>
                    <span className={styles.stepLabel}>Generated Output</span>
                    <code className={styles.buildOutput}>
                      {targetFormat}<br/>
                      {config.builder?.type?.toUpperCase() || 'XML'} format<br/>
                      {(targetMessage?.length / 1024 || 0).toFixed(1)} KB
                    </code>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.resultBadge}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2" fill="none"/>
              </svg>
              Generated {targetFormat} using builder.template from MongoDB ({config.builder?.type})
            </div>
          </div>
        )}
      </div>
    </div>
  );
}