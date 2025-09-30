'use client';

import { useState } from 'react';
import styles from './ConfigJourney.module.css';

export default function ConfigJourney({
  activeTab,
  generation,
  mappings,
  validation,
  output,
  onTabChange,
  onMappingUpdate,
  onValidate
}) {
  const [expandedSteps, setExpandedSteps] = useState({});
  const [expandAll, setExpandAll] = useState(false);

  const toggleStep = (idx) => {
    setExpandedSteps(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const toggleAllSteps = () => {
    if (expandAll) {
      setExpandedSteps({});
    } else {
      const allExpanded = {};
      generation?.steps?.forEach((_, idx) => {
        allExpanded[idx] = true;
      });
      setExpandedSteps(allExpanded);
    }
    setExpandAll(!expandAll);
  };
  const tabs = [
    { id: 'flow', label: 'Flow', icon: '⚡', count: generation?.steps?.length || 0 },
    { id: 'validation', label: 'Validation', icon: '✓', count: validation?.checks?.length || 0 },
    { id: 'output', label: 'Output', icon: '📄', count: null }
  ];

  const renderEmptyState = () => (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>⚙️</div>
      <div className={styles.emptyTitle}>No Configuration Generated</div>
      <div className={styles.emptyDescription}>
        Enter your configuration requirements in the input panel and click Generate to begin
      </div>
    </div>
  );

  const renderLoadingState = () => (
    <div className={styles.loadingState}>
      <div className={styles.spinner} />
      <div className={styles.loadingText}>Generating Configuration</div>
      <div className={styles.loadingDescription}>
        {generation?.currentStep || 'Analyzing message structure...'}
      </div>
    </div>
  );

  const renderFlowTab = () => {
    if (!generation || !generation.steps) return renderEmptyState();

    // Get metadata from generation result
    const metadata = generation.result?.generation_metadata || {};
    const aiAnalysisCollection = metadata.ai_analysis_collection || {};

    return (
      <div className={styles.flowContainer}>
        {/* Expand/Collapse All Button */}
        {generation.steps.length > 0 && (
          <div className={styles.flowControls}>
            <button className={styles.expandAllButton} onClick={toggleAllSteps}>
              {expandAll ? '▼ Collapse All' : '▶ Expand All'}
            </button>
          </div>
        )}

        {/* Flow Steps */}
        {generation.steps.map((step, idx) => {
          const isExpanded = expandedSteps[idx];
          const stepResult = step.result || {};

          return (
            <div key={idx} className={styles.flowStage}>
              <div
                className={styles.flowStageHeader}
                onClick={() => toggleStep(idx)}
                style={{ cursor: 'pointer' }}
              >
                <div className={styles.flowStageExpand}>
                  {isExpanded ? '▼' : '▶'}
                </div>
                <div className={styles.flowStageIcon}>{step.icon}</div>
                <div className={styles.flowStageTitle}>{step.title}</div>
                <div className={styles.flowStageTime}>{step.duration}</div>
              </div>

              <div className={styles.flowStageContent}>
                {step.description}
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className={styles.flowStageDetails}>
                  {/* Field Analysis Section */}
                  {stepResult.fields && stepResult.fields.length > 0 && (
                    <div className={styles.detailSection}>
                      <div className={styles.detailSectionTitle}>🔍 Field Analysis</div>
                      <div className={styles.fieldAnalysisTable}>
                        <table>
                          <thead>
                            <tr>
                              <th>Field ID</th>
                              <th>Semantic Concept</th>
                              <th>Confidence</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stepResult.fields.map((field, fidx) => (
                              <tr key={fidx}>
                                <td><code>{field.field_id}</code></td>
                                <td>{field.semantic_concept}</td>
                                <td>
                                  <span className={`${styles.confidenceBadge} ${
                                    field.confidence >= 0.8 ? styles.high :
                                    field.confidence >= 0.6 ? styles.medium :
                                    styles.low
                                  }`}>
                                    {Math.round(field.confidence * 100)}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className={styles.detailStats}>
                        <span><strong>Format Family:</strong> {stepResult.format_family || 'Unknown'}</span>
                        <span><strong>Overall Similarity:</strong> {Math.round((stepResult.overall_similarity || 0) * 100)}%</span>
                        <span><strong>Extraction Method:</strong> {stepResult.extraction_method || 'N/A'}</span>
                      </div>
                    </div>
                  )}

                  {/* AI Analysis Section */}
                  {stepResult.ai_analysis && (
                    <div className={styles.detailSection}>
                      <div className={styles.detailSectionTitle}>🤖 AI Analysis Details</div>

                      <div className={styles.aiDetails}>
                        <div className={styles.aiDetailItem}>
                          <span className={styles.aiDetailLabel}>Model:</span>
                          <span className={styles.aiDetailValue}>{stepResult.ai_analysis.model}</span>
                        </div>
                        <div className={styles.aiDetailItem}>
                          <span className={styles.aiDetailLabel}>Processing Lane:</span>
                          <span className={styles.aiDetailValue}>{stepResult.ai_analysis.processing_lane}</span>
                        </div>
                        <div className={styles.aiDetailItem}>
                          <span className={styles.aiDetailLabel}>Extraction Method:</span>
                          <span className={styles.aiDetailValue}>{stepResult.ai_analysis.extraction_method}</span>
                        </div>
                      </div>

                      {stepResult.ai_analysis.prompt_used && (
                        <div className={styles.promptSection}>
                          <div className={styles.promptTitle}>📝 Prompt Sent to LLM</div>
                          <pre className={styles.codeBlock}>
                            {stepResult.ai_analysis.prompt_used}
                          </pre>
                        </div>
                      )}

                      {stepResult.ai_analysis.raw_response && (
                        <div className={styles.responseSection}>
                          <div className={styles.responseTitle}>💬 LLM Response</div>
                          <pre className={styles.codeBlock}>
                            {stepResult.ai_analysis.raw_response}
                          </pre>
                        </div>
                      )}

                      {stepResult.ai_analysis.fallback_reason && (
                        <div className={styles.fallbackNotice}>
                          ⚠️ {stepResult.ai_analysis.fallback_reason}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Configuration Details */}
                  {(stepResult.base_configuration_id || stepResult.fields_in_base !== undefined) && (
                    <div className={styles.detailSection}>
                      <div className={styles.detailSectionTitle}>⚙️ Configuration Details</div>

                      {stepResult.configs_analyzed && stepResult.configs_analyzed.length > 0 && (
                        <div className={styles.configSubsection}>
                          <div className={styles.configSubsectionTitle}>
                            📚 Configs Analyzed for Pattern Learning ({stepResult.total_configs_analyzed || stepResult.configs_analyzed.length})
                          </div>
                          <div className={styles.configsList}>
                            {stepResult.configs_analyzed.map((config, idx) => (
                              <span key={idx} className={styles.configBadge}>{config}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className={styles.configSubsection}>
                        <div className={styles.configSubsectionTitle}>🎯 Selected Base Template</div>
                        <div className={styles.configDetails}>
                          {stepResult.base_configuration_id && (
                            <div className={styles.configDetailItem}>
                              <span className={styles.configLabel}>Base Config:</span>
                              <span className={styles.configValue}>{stepResult.base_configuration_id}</span>
                            </div>
                          )}
                          {stepResult.fields_in_base !== undefined && (
                            <div className={styles.configDetailItem}>
                              <span className={styles.configLabel}>Fields in Template:</span>
                              <span className={styles.configValue}>{stepResult.fields_in_base}</span>
                            </div>
                          )}
                          {stepResult.mappings_in_base !== undefined && (
                            <div className={styles.configDetailItem}>
                              <span className={styles.configLabel}>Mappings in Template:</span>
                              <span className={styles.configValue}>{stepResult.mappings_in_base}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Parser Generation Details */}
                  {(stepResult.parser_type || stepResult.fields_generated !== undefined) && (
                    <div className={styles.detailSection}>
                      <div className={styles.detailSectionTitle}>📝 Parser Configuration</div>
                      <div className={styles.parserDetails}>
                        {stepResult.parser_type && (
                          <div className={styles.parserDetailItem}>
                            <span className={styles.parserLabel}>Parser Type:</span>
                            <span className={styles.parserValue}>{stepResult.parser_type}</span>
                          </div>
                        )}
                        {stepResult.method && (
                          <div className={styles.parserDetailItem}>
                            <span className={styles.parserLabel}>Generation Method:</span>
                            <span className={styles.parserValue}>{stepResult.method}</span>
                          </div>
                        )}
                        {stepResult.fields_generated !== undefined && (
                          <div className={styles.parserDetailItem}>
                            <span className={styles.parserLabel}>Fields Generated:</span>
                            <span className={styles.parserValue}>{stepResult.fields_generated}</span>
                          </div>
                        )}
                        {stepResult.block_pattern && (
                          <div className={styles.parserDetailItem}>
                            <span className={styles.parserLabel}>Block Pattern:</span>
                            <span className={styles.parserValue}>{stepResult.block_pattern}</span>
                          </div>
                        )}
                        {stepResult.content_block && (
                          <div className={styles.parserDetailItem}>
                            <span className={styles.parserLabel}>Content Block:</span>
                            <span className={styles.parserValue}>{stepResult.content_block}</span>
                          </div>
                        )}
                      </div>

                      {stepResult.fields_list && stepResult.fields_list.length > 0 && (
                        <div className={styles.fieldsListSection}>
                          <div className={styles.fieldsListTitle}>Fields: {stepResult.fields_list.join(', ')}</div>
                        </div>
                      )}

                      {stepResult.sample_patterns && stepResult.sample_patterns.length > 0 && (
                        <div className={styles.patternsSection}>
                          <div className={styles.patternsSectionTitle}>Sample Regex Patterns (first 5):</div>
                          {stepResult.sample_patterns.map((pattern, idx) => (
                            <div key={idx} className={styles.patternItem}>
                              <div className={styles.patternField}>
                                <strong>Field {pattern.field_id}</strong>
                                {pattern.multiline && <span className={styles.multilineBadge}>multiline</span>}
                              </div>
                              <pre className={styles.patternCode}>{pattern.pattern}</pre>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mappings Generation Details */}
                  {(stepResult.mappings_generated !== undefined || stepResult.patterns_matched) && (
                    <div className={styles.detailSection}>
                      <div className={styles.detailSectionTitle}>🔗 Mappings Generation</div>
                      <div className={styles.mappingGenDetails}>
                        {stepResult.mappings_generated !== undefined && (
                          <div className={styles.mappingGenItem}>
                            <span className={styles.mappingGenLabel}>Mappings Generated:</span>
                            <span className={styles.mappingGenValue}>{stepResult.mappings_generated}</span>
                          </div>
                        )}
                        {stepResult.semantic_patterns_used !== undefined && (
                          <div className={styles.mappingGenItem}>
                            <span className={styles.mappingGenLabel}>Total Patterns Referenced:</span>
                            <span className={styles.mappingGenValue}>{stepResult.semantic_patterns_used}</span>
                          </div>
                        )}
                        {stepResult.method && (
                          <div className={styles.mappingGenItem}>
                            <span className={styles.mappingGenLabel}>Method:</span>
                            <span className={styles.mappingGenValue}>{stepResult.method}</span>
                          </div>
                        )}
                      </div>

                      {/* Show matched patterns */}
                      {stepResult.patterns_matched && Array.isArray(stepResult.patterns_matched) && stepResult.patterns_matched.length > 0 && (
                        <div className={styles.patternsMatched}>
                          <div className={styles.patternsMatchedTitle}>
                            Field Mappings ({stepResult.patterns_matched.length} total: {stepResult.patterns_matched.filter(p => p.status === 'unmapped').length} unmapped, {stepResult.patterns_matched.filter(p => p.status !== 'unmapped').length} mapped)
                          </div>
                          {stepResult.patterns_matched.map((pattern, pidx) => (
                            <div
                              key={pidx}
                              className={`${styles.patternCard} ${pattern.status === 'unmapped' ? styles.unmappedPatternCard : ''}`}
                            >
                              <div className={styles.patternHeader}>
                                <div className={styles.patternConcept}>
                                  {pattern.status === 'unmapped' ? '⚠️ ' : ''}
                                  {pattern.concept_name}
                                </div>
                                <div className={styles.patternFieldBadge}>
                                  Field: {pattern.used_for_field}
                                </div>
                              </div>
                              <div className={styles.patternDetails}>
                                {pattern.status === 'unmapped' ? (
                                  <div className={styles.unmappedReason}>
                                    <strong>Reason:</strong> {pattern.reason || 'No matching semantic pattern found'}
                                  </div>
                                ) : (
                                  <>
                                    {pattern.learned_from_formats && pattern.learned_from_formats.length > 0 && (
                                      <div className={styles.learnedFrom}>
                                        <strong>Learned from:</strong>{' '}
                                        {pattern.learned_from_formats.map((fmt, idx) => (
                                          <span key={idx} className={styles.formatBadge}>{fmt}</span>
                                        ))}
                                      </div>
                                    )}
                                    {pattern.confidence !== undefined && (
                                      <div className={styles.confidenceDisplay}>
                                        <strong>Confidence:</strong>{' '}
                                        <span className={`${styles.confidenceBadge} ${
                                          pattern.confidence >= 0.8 ? styles.high :
                                          pattern.confidence >= 0.6 ? styles.medium :
                                          styles.low
                                        }`}>
                                          {Math.round(pattern.confidence * 100)}%
                                        </span>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Confidence Calculation */}
                  {stepResult.overall_confidence !== undefined && !stepResult.configuration_id && (
                    <div className={styles.detailSection}>
                      <div className={styles.detailSectionTitle}>📊 Confidence Calculation</div>
                      <div className={styles.confidenceDetails}>
                        <div className={styles.confidenceScore}>
                          <span className={`${styles.confidenceBadge} ${styles.large} ${
                            stepResult.overall_confidence >= 0.8 ? styles.high :
                            stepResult.overall_confidence >= 0.6 ? styles.medium :
                            styles.low
                          }`}>
                            {Math.round(stepResult.overall_confidence * 100)}%
                          </span>
                        </div>
                        {stepResult.method && (
                          <div className={styles.confidenceMethod}>
                            Method: {stepResult.method}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Configuration Complete Summary */}
                  {stepResult.configuration_id && (
                    <div className={styles.detailSection}>
                      <div className={styles.detailSectionTitle}>✓ Configuration Summary</div>

                      <div className={styles.summaryGrid}>
                        <div className={styles.summaryCard}>
                          <div className={styles.summaryLabel}>Configuration ID</div>
                          <div className={styles.summaryValue}>{stepResult.configuration_id}</div>
                        </div>

                        <div className={styles.summaryCard}>
                          <div className={styles.summaryLabel}>Total Fields</div>
                          <div className={styles.summaryValue}>{stepResult.total_fields || 0}</div>
                        </div>

                        <div className={styles.summaryCard}>
                          <div className={styles.summaryLabel}>Mapped Fields</div>
                          <div className={styles.summaryValue}>{stepResult.mapped_fields || 0}</div>
                        </div>

                        {stepResult.unmapped_fields > 0 && (
                          <div className={`${styles.summaryCard} ${styles.warning}`}>
                            <div className={styles.summaryLabel}>⚠️ Unmapped Fields</div>
                            <div className={styles.summaryValue}>{stepResult.unmapped_fields}</div>
                          </div>
                        )}

                        <div className={styles.summaryCard}>
                          <div className={styles.summaryLabel}>Overall Confidence</div>
                          <div className={styles.summaryValue}>
                            <span className={`${styles.confidenceBadge} ${
                              stepResult.overall_confidence >= 0.8 ? styles.high :
                              stepResult.overall_confidence >= 0.6 ? styles.medium :
                              styles.low
                            }`}>
                              {Math.round(stepResult.overall_confidence * 100)}%
                            </span>
                          </div>
                        </div>

                        <div className={styles.summaryCard}>
                          <div className={styles.summaryLabel}>Generation Time</div>
                          <div className={styles.summaryValue}>{stepResult.generation_time?.toFixed(2)}s</div>
                        </div>

                        <div className={styles.summaryCard}>
                          <div className={styles.summaryLabel}>Semantic Patterns Used</div>
                          <div className={styles.summaryValue}>{stepResult.semantic_patterns_count || 0}</div>
                        </div>

                        <div className={styles.summaryCard}>
                          <div className={styles.summaryLabel}>Status</div>
                          <div className={styles.summaryValue}>
                            <span className={styles.statusBadge}>{stepResult.status || 'completed'}</span>
                          </div>
                        </div>

                        {stepResult.requires_review && (
                          <div className={`${styles.summaryCard} ${styles.warning}`}>
                            <div className={styles.summaryLabel}>⚠️ Requires Review</div>
                            <div className={styles.summaryValue}>
                              {stepResult.uncertain_fields_count} uncertain field{stepResult.uncertain_fields_count !== 1 ? 's' : ''}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderMappingsTab = () => {
    if (!mappings || mappings.length === 0) return renderEmptyState();

    const groupedMappings = {
      rules: mappings.filter(m => m.lane === 'RULES'),
      ai: mappings.filter(m => m.lane === 'AI'),
      human: mappings.filter(m => m.lane === 'HUMAN')
    };

    return (
      <div className={styles.mappingsContainer}>
        {Object.entries(groupedMappings).map(([lane, items]) => (
          items.length > 0 && (
            <div key={lane} className={styles.mappingSection}>
              <div className={styles.mappingSectionHeader}>
                <div className={styles.mappingSectionTitle}>
                  {lane === 'rules' ? 'Rules-Based Mappings' :
                   lane === 'ai' ? 'AI-Processed Fields' :
                   'Human Review Required'}
                </div>
                <div className={styles.mappingSectionCount}>{items.length}</div>
              </div>
              <div className={styles.mappingsList}>
                {items.map((mapping, idx) => (
                  <div key={idx} className={styles.mappingItem}>
                    <div className={styles.mappingHeader}>
                      <div className={styles.mappingSource}>{mapping.source}</div>
                      <div className={styles.mappingArrow}>→</div>
                      <div className={styles.mappingTarget}>{mapping.target}</div>
                      <div className={`${styles.mappingLane} ${styles[lane.toLowerCase()]}`}>
                        {lane}
                      </div>
                      {mapping.confidence && (
                        <div className={styles.mappingConfidence}>
                          {mapping.confidence}%
                        </div>
                      )}
                    </div>
                    {mapping.semanticConcept && (
                      <div className={styles.mappingDetails}>
                        <div className={styles.semanticInfo}>
                          <span className={styles.detailLabel}>Concept:</span>
                          <span className={styles.detailValue}>{mapping.semanticConcept}</span>
                        </div>
                        {mapping.learnedFrom && mapping.learnedFrom.length > 0 && (
                          <div className={styles.learningInfo}>
                            <span className={styles.detailLabel}>Learned from:</span>
                            <span className={styles.detailValue}>
                              {mapping.learnedFrom.join(', ')}
                            </span>
                          </div>
                        )}
                        {mapping.reason && (
                          <div className={styles.reasonInfo}>
                            <span className={styles.detailLabel}>Reasoning:</span>
                            <span className={styles.detailValue}>{mapping.reason}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        ))}
      </div>
    );
  };

  const renderValidationTab = () => {
    if (!validation) {
      return (
        <div className={styles.validationContainer}>
          <div className={styles.validationHeader}>
            <div className={styles.validationScore}>
              <span className={styles.scoreLabel}>Ready for validation</span>
            </div>
            <button className={styles.validateButton} onClick={onValidate}>
              Run Validation
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.validationContainer}>
        <div className={styles.validationHeader}>
          <div className={styles.validationScore}>
            <span className={styles.scoreLabel}>Validation Score</span>
            <span className={styles.scoreValue}>{validation.score}%</span>
          </div>
          <button className={styles.validateButton} onClick={onValidate}>
            Re-validate
          </button>
        </div>

        <div className={styles.validationResults}>
          {validation.checks?.map((check, idx) => (
            <div key={idx} className={styles.validationCategory}>
              <div className={styles.categoryHeader}>
                <span className={styles.categoryIcon}>{check.icon}</span>
                <span className={styles.categoryTitle}>{check.name}</span>
                <span className={`${styles.categoryStatus} ${styles[check.status]}`}>
                  {check.status}
                </span>
              </div>
              {check.details && (
                <div className={styles.categoryContent}>
                  {check.details}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderOutputTab = () => {
    if (!output) return renderEmptyState();

    // Extract base comparison from generation metadata
    const baseComparison = generation?.result?.generation_metadata?.base_comparison;

    // Build list of added/modified fields for highlighting
    const addedFields = new Set(baseComparison?.details?.added_fields?.map(f => f.field_id) || []);
    const addedMappings = new Set(baseComparison?.details?.added_mappings?.map(m => m.source) || []);
    const llmSuggestedMappings = new Set(
      baseComparison?.details?.added_mappings?.filter(m => m.confidence < 0.65).map(m => m.source) || []
    );

    // Debug logging
    console.log('Base Comparison:', baseComparison);
    console.log('Added Fields:', Array.from(addedFields));
    console.log('Added Mappings:', Array.from(addedMappings));
    console.log('LLM Suggested Mappings:', Array.from(llmSuggestedMappings));

    // Syntax highlight JSON with change markers
    const renderHighlightedJson = (obj, indent = 0) => {
      const indentStr = '  '.repeat(indent);
      const lines = [];

      if (obj && typeof obj === 'object') {
        if (Array.isArray(obj)) {
          lines.push('[');
          obj.forEach((item, idx) => {
            const itemStr = JSON.stringify(item, null, 2).split('\n').map((line, i) =>
              i === 0 ? `${indentStr}  ${line}` : `${indentStr}  ${line}`
            ).join('\n');
            lines.push(itemStr + (idx < obj.length - 1 ? ',' : ''));
          });
          lines.push(`${indentStr}]`);
        } else {
          lines.push('{');
          const keys = Object.keys(obj);

          // Special handling for parser.fields
          if (indent === 1 && keys.includes('fields')) {
            const fields = obj.fields;
            Object.keys(fields).forEach((fieldId, idx) => {
              const isNew = addedFields.has(fieldId);
              const marker = isNew ? ' /* ✨ NEW FIELD */' : '';
              const fieldJson = JSON.stringify(fields[fieldId], null, 2)
                .split('\n')
                .map((line, i) => i === 0 ? line : `${indentStr}    ${line}`)
                .join('\n');

              const highlight = isNew ? 'highlight-new' : '';
              lines.push(`${indentStr}  "${fieldId}": ${fieldJson}${idx < Object.keys(fields).length - 1 ? ',' : ''}${marker}`);
            });
          } else if (Array.isArray(obj) && obj.some(m => m.source)) {
            // This is mappings array
            obj.forEach((mapping, idx) => {
              const isNew = addedMappings.has(mapping.source);
              const isLlm = llmSuggestedMappings.has(mapping.source);
              const marker = isLlm ? ' /* 🤖 LLM SUGGESTED */' : isNew ? ' /* 🆕 NEW */' : '';

              const mappingJson = JSON.stringify(mapping, null, 2)
                .split('\n')
                .map((line, i) => i === 0 ? line : `${indentStr}  ${line}`)
                .join('\n');

              lines.push(`${indentStr}${mappingJson}${idx < obj.length - 1 ? ',' : ''}${marker}`);
            });
          } else {
            keys.forEach((key, idx) => {
              const value = obj[key];
              const isLast = idx === keys.length - 1;

              if (typeof value === 'object' && value !== null) {
                lines.push(`${indentStr}  "${key}": ${JSON.stringify(value, null, 2).split('\n').map((line, i) => i === 0 ? line : `${indentStr}  ${line}`).join('\n')}${!isLast ? ',' : ''}`);
              } else {
                lines.push(`${indentStr}  "${key}": ${JSON.stringify(value)}${!isLast ? ',' : ''}`);
              }
            });
          }
          lines.push(`${indentStr}}`);
        }
      } else {
        return JSON.stringify(obj);
      }

      return lines.join('\n');
    };

    return (
      <div className={styles.outputContainer}>
        {/* Compact Summary Panel */}
        {baseComparison && (
          <div className={styles.summaryPanel}>
            <div className={styles.summaryLeft}>
              <div className={styles.summaryTitle}>
                <span className={styles.configBadge}>{baseComparison.new_config_id}</span>
                <span className={styles.summaryArrow}>based on</span>
                <span className={styles.baseBadge}>{baseComparison.base_config_id}</span>
              </div>
            </div>
            <div className={styles.summaryRight}>
              <div className={styles.summaryStats}>
                {baseComparison.summary?.fields_added > 0 && (
                  <span className={styles.statBadge} data-type="new">
                    ✨ {baseComparison.summary.fields_added} New
                  </span>
                )}
                {baseComparison.details?.added_mappings?.filter(m => m.confidence < 0.65).length > 0 && (
                  <span className={styles.statBadge} data-type="llm">
                    🤖 {baseComparison.details.added_mappings.filter(m => m.confidence < 0.65).length} LLM
                  </span>
                )}
                {baseComparison.summary?.mappings_modified > 0 && (
                  <span className={styles.statBadge} data-type="modified">
                    ✏️ {baseComparison.summary.mappings_modified} Modified
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        {baseComparison && (baseComparison.summary?.fields_added > 0 || addedMappings.size > 0) && (
          <div className={styles.legend}>
            <span className={styles.legendTitle}>Legend:</span>
            {baseComparison.summary?.fields_added > 0 && (
              <span className={styles.legendItem}>
                <span className={styles.legendDot} data-color="new"></span>
                <code>/* ✨ NEW FIELD */</code> = New fields not in base config
              </span>
            )}
            {llmSuggestedMappings.size > 0 && (
              <span className={styles.legendItem}>
                <span className={styles.legendDot} data-color="llm"></span>
                <code>/* 🤖 LLM SUGGESTED */</code> = AI-suggested mapping (no pattern match)
              </span>
            )}
            {addedMappings.size > 0 && llmSuggestedMappings.size < addedMappings.size && (
              <span className={styles.legendItem}>
                <span className={styles.legendDot} data-color="added"></span>
                <code>/* 🆕 NEW */</code> = New mapping created
              </span>
            )}
          </div>
        )}

        {/* Configuration Output with Highlights */}
        <div className={styles.outputHeader}>
          <div className={styles.outputTitle}>Generated Configuration</div>
          <div className={styles.outputActions}>
            <button className={styles.outputButton}>Copy</button>
            <button className={styles.outputButton}>Download</button>
          </div>
        </div>
        <div className={styles.outputContent}>
          <pre
            className={styles.codeBlock}
            dangerouslySetInnerHTML={{
              __html: (() => {
                // Generate JSON string with line highlighting
                const lines = JSON.stringify(output, null, 2).split('\n');

                // Track which lines belong to new/modified elements
                const lineHighlights = {}; // line index -> highlight type
                let inMappings = false;
                let inFields = false;
                let currentFieldBlock = null;
                let currentMappingBlock = null;
                let currentMappingStart = null;

                for (let i = 0; i < lines.length; i++) {
                  const line = lines[i];

                  // Detect sections
                  if (line.includes('"fields"')) inFields = true;
                  if (line.includes('"mappings"')) {
                    inFields = false;
                    inMappings = true;
                  }
                  if (line.includes('"builder"') || line.includes('"ai_service"')) {
                    inMappings = false;
                  }

                  // Track new fields in parser - highlight entire field block
                  if (inFields && line.match(/"([^"]+)":\s*\{/)) {
                    const match = line.match(/"([^"]+)":/);
                    if (match) {
                      const fieldId = match[1];
                      if (addedFields.has(fieldId)) {
                        currentFieldBlock = fieldId;
                      }
                    }
                  }

                  // Highlight all lines of new field block
                  if (currentFieldBlock) {
                    lineHighlights[i] = 'newField';
                    // Check if this is the end of the field block
                    if (line.includes('}') && !line.includes('{')) {
                      currentFieldBlock = null;
                    }
                  }

                  // Track mappings - highlight entire mapping block
                  if (inMappings && line.includes('{')) {
                    // Start of a mapping object
                    currentMappingStart = i;
                  }

                  if (inMappings && currentMappingStart !== null) {
                    // Look for source field in this mapping
                    if (line.includes('"source"')) {
                      const match = line.match(/"source":\s*"([^"]+)"/);
                      if (match) {
                        const source = match[1];
                        if (llmSuggestedMappings.has(source)) {
                          currentMappingBlock = 'llmMapping';
                        } else if (addedMappings.has(source)) {
                          currentMappingBlock = 'newMapping';
                        }
                      }
                    }

                    // Apply highlight to current mapping block
                    if (currentMappingBlock) {
                      for (let j = currentMappingStart; j <= i; j++) {
                        lineHighlights[j] = currentMappingBlock;
                      }
                    }

                    // Check if this is the end of the mapping block
                    if (line.trim().match(/^}\s*,?\s*$/)) {
                      // Also highlight remaining lines of this mapping
                      if (currentMappingBlock) {
                        lineHighlights[i] = currentMappingBlock;
                      }
                      currentMappingBlock = null;
                      currentMappingStart = null;
                    }
                  }
                }

                // Generate highlighted HTML
                const highlightedLines = [];
                for (let i = 0; i < lines.length; i++) {
                  let escapedLine = lines[i]
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');

                  const highlightType = lineHighlights[i];

                  if (highlightType === 'newField') {
                    // Highlight new fields with green background - no display property
                    highlightedLines.push(
                      '<span style="background: linear-gradient(90deg, #d1fae5 0%, transparent 80%); box-shadow: -3px 0 0 #10b981; padding-left: 12px;">' +
                      escapedLine +
                      '</span>'
                    );
                  } else if (highlightType === 'llmMapping') {
                    // Highlight LLM-suggested mappings with purple background
                    highlightedLines.push(
                      '<span style="background: linear-gradient(90deg, #f3e8ff 0%, transparent 80%); box-shadow: -3px 0 0 #8b5cf6; padding-left: 12px;">' +
                      escapedLine +
                      '</span>'
                    );
                  } else if (highlightType === 'newMapping') {
                    // Highlight new mappings with blue background
                    highlightedLines.push(
                      '<span style="background: linear-gradient(90deg, #e0f2fe 0%, transparent 80%); box-shadow: -3px 0 0 #0ea5e9; padding-left: 12px;">' +
                      escapedLine +
                      '</span>'
                    );
                  } else {
                    // No highlight
                    highlightedLines.push(escapedLine);
                  }
                }

                console.log('Line highlights applied:', Object.keys(lineHighlights).length);

                return highlightedLines.join('\n');
              })()
            }}
          />
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    if (generation?.status === 'generating') {
      return renderLoadingState();
    }

    switch (activeTab) {
      case 'flow':
        return renderFlowTab();
      case 'validation':
        return renderValidationTab();
      case 'output':
        return renderOutputTab();
      default:
        return renderEmptyState();
    }
  };

  return (
    <div className={styles.container}>
      {/* Tabs Header */}
      <div className={styles.tabsHeader}>
        <div className={styles.tabsList}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              <span className={styles.tabIcon}>{tab.icon}</span>
              {tab.label}
              {tab.count !== null && tab.count > 0 && (
                <span className={styles.tabBadge}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {renderTabContent()}
      </div>
    </div>
  );
}