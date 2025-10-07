'use client';

import { useState } from 'react';
import Icon from '@leafygreen-ui/icon';
import { Tab, Tabs } from '@leafygreen-ui/tabs';
import Badge from '@leafygreen-ui/badge';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ConfigurationEditor from '../ConfigurationEditor/ConfigurationEditor';
import RegistryConsole from '../RegistryConsole/RegistryConsole';
import styles from './ConfigJourney.module.css';

// Custom LeafyGreen-inspired syntax highlighting theme
const leafyGreenTheme = {
  'code[class*="language-"]': {
    color: '#1C2D38', // gray-dark3
    background: '#F9FBFA', // gray-light3
    fontFamily: '"Monaco", "Menlo", "Ubuntu Mono", monospace',
    fontSize: '13px',
    textAlign: 'left',
    whiteSpace: 'pre',
    wordSpacing: 'normal',
    wordBreak: 'normal',
    wordWrap: 'normal',
    lineHeight: '1.5',
    tabSize: '2',
    hyphens: 'none'
  },
  'pre[class*="language-"]': {
    color: '#1C2D38',
    background: '#F9FBFA',
    fontFamily: '"Monaco", "Menlo", "Ubuntu Mono", monospace',
    fontSize: '13px',
    textAlign: 'left',
    whiteSpace: 'pre',
    wordSpacing: 'normal',
    wordBreak: 'normal',
    wordWrap: 'normal',
    lineHeight: '1.5',
    tabSize: '2',
    hyphens: 'none',
    padding: '1em',
    margin: '0',
    overflow: 'auto'
  },
  'comment': {
    color: '#89979B' // gray-base
  },
  'prolog': {
    color: '#89979B'
  },
  'doctype': {
    color: '#89979B'
  },
  'cdata': {
    color: '#89979B'
  },
  'punctuation': {
    color: '#5C3C92' // purple-dark2
  },
  'property': {
    color: '#1254B7' // blue-dark1
  },
  'tag': {
    color: '#00593F' // green-dark2
  },
  'boolean': {
    color: '#CD5B45' // red-base
  },
  'number': {
    color: '#AD5E00' // yellow-dark2 (orange)
  },
  'constant': {
    color: '#1254B7'
  },
  'symbol': {
    color: '#1254B7'
  },
  'selector': {
    color: '#00593F'
  },
  'attr-name': {
    color: '#1254B7'
  },
  'string': {
    color: '#00A35C' // green-dark1
  },
  'char': {
    color: '#00A35C'
  },
  'builtin': {
    color: '#00A35C'
  },
  'operator': {
    color: '#5C3C92'
  },
  'entity': {
    color: '#AD5E00'
  },
  'url': {
    color: '#1254B7'
  },
  'variable': {
    color: '#1C2D38'
  },
  'atrule': {
    color: '#AD5E00'
  },
  'attr-value': {
    color: '#00A35C'
  },
  'keyword': {
    color: '#5C3C92'
  },
  'regex': {
    color: '#00A35C'
  },
  'important': {
    color: '#CD5B45',
    fontWeight: 'bold'
  }
};

// LLMFieldDetail Component
const LLMFieldDetail = ({ llmCall }) => {
  const [expanded, setExpanded] = useState(false);
  const [showFullPrompt, setShowFullPrompt] = useState(false);

  return (
    <div className={styles.llmFieldDetail}>
      <div
        className={styles.llmFieldHeader}
        onClick={() => setExpanded(!expanded)}
      >
        <div className={styles.llmFieldTitle}>
          <span className={styles.fieldId}>Field {llmCall.fieldId}</span>
          <span className={styles.llmBadge}>LLM</span>
        </div>
        <div className={styles.llmFieldMeta}>
          <span className={styles.tokens}>{llmCall.tokens.total} tokens</span>
          <span className={styles.time}>{(llmCall.time / 1000).toFixed(2)}s</span>
          <span className={styles.confidence}>{Math.round(llmCall.confidence * 100)}%</span>
          <span className={styles.expandIcon}>{expanded ? <Icon glyph="ChevronDown" size="small" /> : <Icon glyph="ChevronRight" size="small" />}</span>
        </div>
      </div>

      {expanded && (
        <div className={styles.llmFieldContent}>
          <div className={styles.llmSection}>
            <div className={styles.llmSectionTitle}>Why LLM was used:</div>
            <div className={styles.llmReason}>
              Pattern not found - Field required AI analysis
            </div>
          </div>

          <div className={styles.llmSection}>
            <div className={styles.llmSectionTitle}>
              LLM Prompt {showFullPrompt ? '(full)' : '(preview)'}:
            </div>
            <div className={styles.llmPromptContainer}>
              <pre className={styles.llmPrompt}>
                {showFullPrompt ? llmCall.prompt : llmCall.prompt.substring(0, 200) + '...'}
              </pre>
              <button
                className={styles.showFullButton}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFullPrompt(!showFullPrompt);
                }}
              >
                {showFullPrompt ? 'Show Preview' : 'Show Full Prompt'}
              </button>
            </div>
          </div>

          <div className={styles.llmSection}>
            <div className={styles.llmSectionTitle}>LLM Response:</div>
            <div className={styles.llmResponse}>
              <div className={styles.responseTargets}>
                <strong>Targets:</strong> {llmCall.targets.join(', ')}
              </div>
              <div className={styles.responseReasoning}>
                <strong>Reasoning:</strong> {llmCall.reasoning}
              </div>
              <div className={styles.responseConfidence}>
                <strong>Confidence:</strong> {Math.round(llmCall.confidence * 100)}%
              </div>
            </div>
          </div>

          <div className={styles.llmSection}>
            <div className={styles.llmSectionTitle}>Token Usage:</div>
            <div className={styles.tokenBreakdown}>
              <div>Prompt: {llmCall.tokens.prompt}</div>
              <div>Response: {llmCall.tokens.response}</div>
              <div>Total: {llmCall.tokens.total}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function ConfigJourney({
  activeTab,
  generation,
  mappings,
  validation,
  output,
  onTabChange,
  onMappingUpdate,
  onValidate,
  onSave,
  onFixError
}) {
  const [expandedSteps, setExpandedSteps] = useState({});
  const [expandAll, setExpandAll] = useState(false);
  const [lastSavedConfigId, setLastSavedConfigId] = useState(null);
  const [sessionId, setSessionId] = useState(null);

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

  // State for collapsible field sections
  const [expandedSections, setExpandedSections] = useState({
    patternMatched: true,
    llmSuggested: true,
    howItWorks: false
  });

  // State for collapsible explainer steps
  const [expandedExplainerSteps, setExpandedExplainerSteps] = useState({
    step1: true,
    step2: true,
    step3: true,
    step4: true,
    step5: true
  });

  const toggleSection = (sectionName) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };

  const toggleExplainerStep = (stepName) => {
    setExpandedExplainerSteps(prev => ({
      ...prev,
      [stepName]: !prev[stepName]
    }));
  };

  // State for Output tab field breakdown visibility
  const [showBreakdown, setShowBreakdown] = useState(false);
  const tabs = [
    { id: 'flow', label: 'Flow', icon: '', count: generation?.steps?.length || 0 },
    { id: 'configuration', label: 'Configuration', icon: '', count: null }
  ];

  const renderEmptyState = () => (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>
        <Icon glyph="Settings" size="xlarge" />
      </div>
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

    // Extract data for "How It Works" explainer
    const generationDetails = generation?.result?.generation_details;
    const fieldExtraction = generationDetails?.field_extraction;
    const mappingGeneration = generationDetails?.mapping_generation;
    const statistics = generationDetails?.statistics;
    const baseConfigId = statistics?.base_config_id || 'N/A';
    const confidence = generation?.result?.confidence || 0;
    const uncertainFields = generation?.result?.uncertain_fields || [];

    // Detect format family
    const detectFormatFamily = (formatName) => {
      const upper = formatName.toUpperCase();
      if (upper.startsWith('MT') && /MT\d{3}/.test(upper)) return 'SWIFT MT';
      if (upper.includes('ISO8583') || /^\d{4}$/.test(formatName)) return 'ISO 8583';
      if (/^(pacs|pain|camt|head|reda)/.test(formatName.toLowerCase())) return 'ISO 20022';
      if (upper.includes('FIX')) return 'FIX Protocol';
      if (['CHAPS', 'TARGET2', 'FEDWIRE', 'CHIPS'].includes(upper)) return 'Domestic';
      return 'Custom';
    };

    const sourceFormat = generation?.result?.configuration_id?.split('_to_')[0] || '';
    const formatFamily = detectFormatFamily(sourceFormat);

    // Build enhanced pattern matches including composite fields (using mappingGeneration.details like Output tab)
    const buildEnhancedPatternMatches = () => {
      if (!mappingGeneration?.details) return [];

      const patternMatchedFields = [];

      // First, process pattern-matched fields from mapping_generation.details
      mappingGeneration.details.forEach(detail => {
        if (detail.mapping_method === 'pattern_match') {
          patternMatchedFields.push({
            fieldId: detail.field_id,
            confidence: detail.confidence,
            patternsTried: detail.patterns_tried || [detail.semantic_concept || 'pattern'],
            targets: detail.targets,
            time: detail.processing_time_ms || 0,
            isComposite: false
          });
        }
      });

      // Add composite fields from field_extraction that were split into components
      if (fieldExtraction?.fields && output?.mappings) {
        fieldExtraction.fields.forEach(field => {
          if (field.is_composite && field.components) {
            // Check if this composite field is already listed
            const alreadyListed = mappingGeneration.details.some(d => d.field_id === field.field_id);

            if (!alreadyListed) {
              // Collect all component targets and calculate total processing time
              const componentTargets = [];
              let totalTime = 0;

              field.components.forEach(comp => {
                const componentSource = `${field.field_id}.${comp}`;
                const mapping = output.mappings.find(m => m.source === componentSource);
                if (mapping && mapping.targets) {
                  componentTargets.push(...mapping.targets);
                }

                // Find the processing time for this component from mapping_generation.details
                const componentDetail = mappingGeneration.details.find(d => d.source === componentSource);
                if (componentDetail && componentDetail.processing_time_ms) {
                  totalTime += componentDetail.processing_time_ms;
                }
              });

              // Build pattern string showing source format -> base config format
              const baseFormat = baseConfigId?.split('_to_')[0] || 'base';
              const patternString = `${sourceFormat}.${field.field_id} → ${baseFormat}.${field.field_id}`;

              // Add as a composite pattern match
              patternMatchedFields.push({
                fieldId: field.field_id,
                confidence: 0.9,
                patternsTried: [patternString],
                targets: componentTargets,
                time: totalTime,
                isComposite: true,
                components: field.components
              });
            }
          }
        });
      }

      return patternMatchedFields;
    };

    const enhancedPatternMatches = buildEnhancedPatternMatches();

    return (
      <div className={styles.flowContainer}>
        {/* Task 3.4: How It Works Explainer */}
        {generationDetails && (
          <div className={styles.explainerSection}>
            <button
              className={styles.explainerToggle}
              onClick={() => {
                const newExpanded = {...expandedSections};
                newExpanded.howItWorks = !newExpanded.howItWorks;
                setExpandedSections(newExpanded);
              }}
            >
              <Icon glyph="InfoWithCircle" size="small" />
              <span className={styles.explainerTitle}>How Auto-Configuration Works</span>
              <span className={styles.explainerIcon}>{expandedSections.howItWorks ? <Icon glyph="ChevronDown" size="small" /> : <Icon glyph="ChevronRight" size="small" />}</span>
            </button>

{expandedSections.howItWorks && (
              <div className={styles.explainerContent}>
                {/* Step 1: Format Detection */}
                <div className={styles.explainerStep}>
                  <div
                    className={styles.stepHeader}
                    onClick={() => toggleExplainerStep('step1')}
                  >
                    <div className={styles.stepNumber}>1</div>
                    <div className={styles.stepTitle}>Format Detection & Base Template Selection</div>
                    <div className={styles.stepExpandIcon}>
                      {expandedExplainerSteps.step1 ? <Icon glyph="ChevronDown" size="small" /> : <Icon glyph="ChevronRight" size="small" />}
                    </div>
                  </div>
                  {expandedExplainerSteps.step1 && (
                  <div className={styles.stepContent}>
                    <div className={styles.stepDescription}>
                      The system analyzes your source format (<strong>{sourceFormat}</strong>) to determine its format family: <strong>{formatFamily}</strong>.

                      <div className={styles.stepDetail}>
                        <div className={styles.detailLabel}>MongoDB Query:</div>
                        <pre className={styles.codeSnippet}>
{`db.conversion_registry.find({
  "_id": { $regex: "^${sourceFormat.split(/\d/)[0]}.*_to_" }
}).sort({ "_id": 1 }).limit(5)`}
                        </pre>
                      </div>

                      <div className={styles.stepDetail}>
                        <div className={styles.detailLabel}>Selected Base Template:</div>
                        <div className={styles.highlightBox}>
                          <code>{baseConfigId}</code>
                        </div>
                      </div>

                      <div className={styles.stepDetail}>
                        <div className={styles.detailLabel}>Why this template?</div>
                        <p>This configuration contains the most similar field structure to your source format, providing the best foundation for auto-generation.</p>
                      </div>
                    </div>
                  </div>
                  )}
                </div>

                {/* Step 2: Field Extraction */}
                <div className={styles.explainerStep}>
                  <div
                    className={styles.stepHeader}
                    onClick={() => toggleExplainerStep('step2')}
                  >
                    <div className={styles.stepNumber}>2</div>
                    <div className={styles.stepTitle}>Field Extraction from Sample Message</div>
                    <div className={styles.stepExpandIcon}>
                      {expandedExplainerSteps.step2 ? <Icon glyph="ChevronDown" size="small" /> : <Icon glyph="ChevronRight" size="small" />}
                    </div>
                  </div>
                  {expandedExplainerSteps.step2 && (
                  <div className={styles.stepContent}>
                    <div className={styles.stepDescription}>
                      Parsed your sample message and extracted <strong>{fieldExtraction?.total_fields || 0}</strong> fields using regex patterns from the base template's parser configuration.

                      <div className={styles.stepDetail}>
                        <div className={styles.detailLabel}>Extraction Methods:</div>
                        <div className={styles.methodGrid}>
                          <div className={styles.methodItem}>
                            <span className={styles.methodBadge} style={{background: 'var(--green-light2)', color: 'var(--green-dark1)'}}>Base Template</span>
                            <span className={styles.methodCount}>{fieldExtraction?.fields?.filter(f => f.extraction_method !== 'fallback').length || 0} fields</span>
                          </div>
                          {fieldExtraction?.fields?.filter(f => f.extraction_method === 'fallback').length > 0 && (
                            <div className={styles.methodItem}>
                              <span className={styles.methodBadge} style={{background: 'var(--blue-light2)', color: 'var(--blue-dark1)'}}>Auto-Detected</span>
                              <span className={styles.methodCount}>{fieldExtraction.fields.filter(f => f.extraction_method === 'fallback').length} new fields</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {fieldExtraction?.fields?.filter(f => f.extraction_method === 'fallback').length > 0 && (
                        <div className={styles.stepDetail}>
                          <div className={styles.detailLabel}>Auto-Detected Fields:</div>
                          <div className={styles.fieldTags}>
                            {fieldExtraction.fields
                              .filter(f => f.extraction_method === 'fallback')
                              .map((field, idx) => (
                                <span key={idx} className={styles.fieldTag}>
                                  Field {field.field_id}
                                </span>
                              ))}
                          </div>
                          <p className={styles.helpText}>
                            These fields were found in your message but not in the base template. The system automatically generated regex patterns to extract them.
                          </p>
                        </div>
                      )}

                      <div className={styles.stepDetail}>
                        <div className={styles.detailLabel}>Sample Field Extraction:</div>
                        {fieldExtraction?.fields?.slice(0, 3).map((field, idx) => (
                          <div key={idx} className={styles.fieldExample}>
                            <div className={styles.fieldExampleHeader}>
                              <code className={styles.fieldCode}>Field {field.field_id}</code>
                              <span className={styles.fieldBadge}>{field.is_composite ? 'Composite' : 'Simple'}</span>
                            </div>
                            {field.is_composite && field.components && (
                              <div className={styles.compositeInfo}>
                                Splits into: {field.components.join(', ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  )}
                </div>

                {/* Step 3: Pattern Matching */}
                <div className={styles.explainerStep}>
                  <div
                    className={styles.stepHeader}
                    onClick={() => toggleExplainerStep('step3')}
                  >
                    <div className={styles.stepNumber}>3</div>
                    <div className={styles.stepTitle}>Semantic Pattern Matching</div>
                    <div className={styles.stepExpandIcon}>
                      {expandedExplainerSteps.step3 ? <Icon glyph="ChevronDown" size="small" /> : <Icon glyph="ChevronRight" size="small" />}
                    </div>
                  </div>
                  {expandedExplainerSteps.step3 && (
                  <div className={styles.stepContent}>
                    <div className={styles.stepDescription}>
                      Matched <strong>{mappingGeneration?.pattern_matches || 0}</strong> fields by querying the <code>semantic_patterns</code> collection, which contains {statistics?.patterns_cache_size || 0} learned patterns from existing configurations.

                      <div className={styles.stepDetail}>
                        <div className={styles.detailLabel}>MongoDB Query Pattern:</div>
                        <pre className={styles.codeSnippet}>
{`db.semantic_patterns.find({
  "source_field": { $in: ["20", "32A", "50K", ...] },
  "format_hint": "${formatFamily}"
}).sort({ "confidence": -1 })`}
                        </pre>
                      </div>

                      <div className={styles.stepDetail}>
                        <div className={styles.detailLabel}>Pattern Matching Results:</div>
                        <div className={styles.resultGrid}>
                          <div className={styles.resultCard}>
                            <div className={styles.resultValue}>{mappingGeneration?.pattern_matches || 0}</div>
                            <div className={styles.resultLabel}>Patterns Matched</div>
                          </div>
                          <div className={styles.resultCard}>
                            <div className={styles.resultValue}>~90%</div>
                            <div className={styles.resultLabel}>Avg Confidence</div>
                          </div>
                          <div className={styles.resultCard}>
                            <div className={styles.resultValue}>{statistics?.pattern_lookup_time_ms?.toFixed(0) || 'N/A'}ms</div>
                            <div className={styles.resultLabel}>Lookup Time</div>
                          </div>
                        </div>
                      </div>

                      <div className={styles.stepDetail}>
                        <div className={styles.detailLabel}>Example Pattern Match:</div>
                        <div className={styles.patternExample}>
                          <div className={styles.patternRow}>
                            <span className={styles.patternLabel}>Source Field:</span>
                            <code>20</code>
                          </div>
                          <div className={styles.patternRow}>
                            <span className={styles.patternLabel}>Semantic Concept:</span>
                            <span>transaction_reference</span>
                          </div>
                          <div className={styles.patternRow}>
                            <span className={styles.patternLabel}>Target Mapping:</span>
                            <code>CdtTrfTxInf.PmtId.EndToEndId</code>
                          </div>
                          <div className={styles.patternRow}>
                            <span className={styles.patternLabel}>Learned From:</span>
                            <span className={styles.formatBadge}>MT103</span>
                            <span className={styles.formatBadge}>MT202</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  )}
                </div>

                {/* Step 4: AI Analysis (conditional) */}
                {mappingGeneration?.llm_calls > 0 && (
                  <div className={styles.explainerStep}>
                    <div
                      className={styles.stepHeader}
                      onClick={() => toggleExplainerStep('step4')}
                    >
                      <div className={styles.stepNumber}>4</div>
                      <div className={styles.stepTitle}>AI-Powered Field Analysis</div>
                      <div className={styles.stepExpandIcon}>
                        {expandedExplainerSteps.step4 ? <Icon glyph="ChevronDown" size="small" /> : <Icon glyph="ChevronRight" size="small" />}
                      </div>
                    </div>
                    {expandedExplainerSteps.step4 && (
                    <div className={styles.stepContent}>
                      <div className={styles.stepDescription}>
                        For <strong>{mappingGeneration.llm_calls}</strong> field{mappingGeneration.llm_calls > 1 ? 's' : ''} where no semantic pattern was found, the system invoked AWS Bedrock (Claude) to analyze the field and suggest appropriate target mappings.

                        <div className={styles.stepDetail}>
                          <div className={styles.detailLabel}>LLM Processing Stats:</div>
                          <div className={styles.resultGrid}>
                            <div className={styles.resultCard}>
                              <div className={styles.resultValue}>{mappingGeneration.llm_calls}</div>
                              <div className={styles.resultLabel}>LLM Calls</div>
                            </div>
                            <div className={styles.resultCard}>
                              <div className={styles.resultValue}>{statistics?.llm_total_tokens?.toLocaleString() || 'N/A'}</div>
                              <div className={styles.resultLabel}>Total Tokens</div>
                            </div>
                            <div className={styles.resultCard}>
                              <div className={styles.resultValue}>{statistics?.llm_total_time_ms?.toFixed(0) || 'N/A'}ms</div>
                              <div className={styles.resultLabel}>Processing Time</div>
                            </div>
                          </div>
                        </div>

                        <div className={styles.stepDetail}>
                          <div className={styles.detailLabel}>How AI Analysis Works:</div>
                          <ol className={styles.processList}>
                            <li>Extracts field value from sample message</li>
                            <li>Sends field context + target format schema to Claude</li>
                            <li>Receives suggested target path with reasoning</li>
                            <li>Validates suggestion and assigns confidence score</li>
                            <li>Stores suggestion in generated configuration</li>
                          </ol>
                        </div>

                        <div className={styles.stepDetail}>
                          <div className={styles.detailLabel}>Cost Optimization:</div>
                          <p className={styles.helpText}>
                            Only {Math.round((mappingGeneration.llm_calls / (fieldExtraction?.total_fields || 1)) * 100)}% of fields required AI processing. The majority were handled by fast pattern matching, keeping costs low.
                          </p>
                        </div>
                      </div>
                    </div>
                    )}
                  </div>
                )}

                {/* Step 5: Configuration Built */}
                <div className={styles.explainerStep}>
                  <div
                    className={styles.stepHeader}
                    onClick={() => toggleExplainerStep('step5')}
                  >
                    <div className={styles.stepNumber}>{mappingGeneration?.llm_calls > 0 ? '5' : '4'}</div>
                    <div className={styles.stepTitle}>Configuration Assembly & Validation</div>
                    <div className={styles.stepExpandIcon}>
                      {expandedExplainerSteps.step5 ? <Icon glyph="ChevronDown" size="small" /> : <Icon glyph="ChevronRight" size="small" />}
                    </div>
                  </div>
                  {expandedExplainerSteps.step5 && (
                  <div className={styles.stepContent}>
                    <div className={styles.stepDescription}>
                      Assembled a complete conversion configuration with <strong>{mappingGeneration?.total_mappings || 0}</strong> field mappings, ready to be saved to the <code>conversion_registry</code> collection.

                      <div className={styles.stepDetail}>
                        <div className={styles.detailLabel}>Generated Configuration Structure:</div>
                        <div className={styles.configStructure}>
                          <div className={styles.structureItem}>
                            <Icon glyph="Code" size="small" />
                            <span><strong>Parser:</strong> {fieldExtraction?.total_fields || 0} field patterns</span>
                          </div>
                          <div className={styles.structureItem}>
                            <Icon glyph="Connect" size="small" />
                            <span><strong>Mappings:</strong> {mappingGeneration?.total_mappings || 0} field transformations</span>
                          </div>
                          <div className={styles.structureItem}>
                            <Icon glyph="Settings" size="small" />
                            <span><strong>Builder:</strong> Target format construction rules</span>
                          </div>
                        </div>
                      </div>

                      <div className={styles.stepDetail}>
                        <div className={styles.detailLabel}>Quality Metrics:</div>
                        <div className={styles.qualityGrid}>
                          <div className={styles.qualityCard}>
                            <div className={styles.qualityLabel}>Overall Confidence</div>
                            <div className={styles.qualityValue} style={{
                              color: confidence >= 0.8 ? 'var(--green-dark1)' : confidence >= 0.6 ? 'var(--yellow-dark1)' : 'var(--red-base)'
                            }}>
                              {Math.round(confidence * 100)}%
                            </div>
                          </div>
                          <div className={styles.qualityCard}>
                            <div className={styles.qualityLabel}>Pattern Coverage</div>
                            <div className={styles.qualityValue}>
                              {Math.round((mappingGeneration?.pattern_matches / (fieldExtraction?.total_fields || 1)) * 100)}%
                            </div>
                          </div>
                        </div>
                      </div>

                      {uncertainFields.length > 0 && (
                        <div className={styles.stepDetail}>
                          <div className={styles.detailLabel}>
                            <Icon glyph="Warning" size="small" />
                            <span className={styles.stepWarning}>
                              Review Required: {uncertainFields.length} field{uncertainFields.length > 1 ? 's' : ''}
                            </span>
                          </div>
                          <p className={styles.helpText}>
                            These fields have confidence below 80% and should be manually reviewed in the Configuration Editor before production use.
                          </p>
                        </div>
                      )}

                      <div className={styles.stepDetail}>
                        <div className={styles.detailLabel}>Next Steps:</div>
                        <ol className={styles.processList}>
                          <li>Review uncertain fields in the Configuration tab</li>
                          <li>Run validation to check schema compliance</li>
                          <li>Test with sample messages</li>
                          <li>Save to production when ready</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Expand/Collapse All Button */}
        {generation.steps.length > 0 && (
          <div className={styles.flowControls}>
            <button className={styles.expandAllButton} onClick={toggleAllSteps}>
              {expandAll ? (
                <>
                  <Icon glyph="ChevronDown" size="small" /> Collapse All
                </>
              ) : (
                <>
                  <Icon glyph="ChevronRight" size="small" /> Expand All
                </>
              )}
            </button>
          </div>
        )}

        {/* General Statistics */}
        {generation?.result?.generation_details && generation?.result?.aiInsights && (
          <div className={styles.statsSection}>
            <div className={styles.statsHeader}>
              <Icon glyph="Charts" className={styles.statsIcon} />
              <span className={styles.statsTitle}>General Statistics</span>
            </div>
            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <div className={styles.statLabel}>Field Extraction</div>
                <div className={styles.statValue}>
                  {generation.result.generation_details.field_extraction?.extraction_time_ms?.toFixed(2) || '0'}ms
                  <span className={styles.statDetail}>
                    ({generation.result.generation_details.field_extraction?.total_fields || 0} fields)
                  </span>
                </div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statLabel}>Pattern Lookup</div>
                <div className={styles.statValue}>
                  {generation.result.generation_details.statistics?.pattern_lookup_time_ms?.toFixed(2) || '0'}ms
                  <span className={styles.statDetail}>
                    ({generation.result.aiInsights?.patternMatches?.length || 0} matches)
                  </span>
                </div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statLabel}>LLM Processing</div>
                <div className={styles.statValue}>
                  {generation.result.generation_details.statistics?.llm_total_time_ms?.toFixed(2) || '0'}ms
                  <span className={styles.statDetail}>
                    ({generation.result.aiInsights?.llmCalls?.length || 0} calls)
                  </span>
                </div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statLabel}>Pattern Match Rate</div>
                <div className={styles.statValue}>
                  {Math.round((generation.result.aiInsights.patternMatches?.length || 0) /
                    ((generation.result.aiInsights.patternMatches?.length || 0) +
                     (generation.result.aiInsights.llmCalls?.length || 0) || 1) * 100)}%
                  <span className={styles.statDetail}>
                    ({generation.result.aiInsights.patternMatches?.length || 0}/{(generation.result.aiInsights.patternMatches?.length || 0) + (generation.result.aiInsights.llmCalls?.length || 0)} fields)
                  </span>
                </div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statLabel}>LLM Usage</div>
                <div className={styles.statValue}>
                  {Math.round((generation.result.aiInsights.llmCalls?.length || 0) /
                    ((generation.result.aiInsights.patternMatches?.length || 0) +
                     (generation.result.aiInsights.llmCalls?.length || 0) || 1) * 100)}%
                  <span className={styles.statDetail}>
                    ({generation.result.aiInsights.llmCalls?.length || 0} fields)
                  </span>
                </div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statLabel}>Average Confidence</div>
                <div className={styles.statValue}>
                  {Math.round((generation.result.confidence || 0) * 100)}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Insights Summary Card */}
        {generation?.result?.aiInsights && generation.result.aiInsights.totalCalls > 0 && (
          <div className={styles.aiSummaryCard}>
            <div className={styles.cardHeader}>
              <Icon glyph="Sparkle" className={styles.cardIcon} />
              <span className={styles.cardTitle}>AI Insights Summary</span>
            </div>
            <div className={styles.cardMetrics}>
              <div className={styles.metric}>
                <span className={styles.metricLabel}>LLM Calls</span>
                <span className={styles.metricValue}>{generation.result.aiInsights.totalCalls}</span>
              </div>
              <div className={styles.metric}>
                <span className={styles.metricLabel}>Total Tokens</span>
                <span className={styles.metricValue}>{generation.result.aiInsights.totalTokens}</span>
              </div>
              <div className={styles.metric}>
                <span className={styles.metricLabel}>Estimated Cost</span>
                <span className={styles.metricValue}>${generation.result.aiInsights.estimatedCost}</span>
              </div>
              <div className={styles.metric}>
                <span className={styles.metricLabel}>Processing Time</span>
                <span className={styles.metricValue}>{(generation.result.aiInsights.totalTime / 1000).toFixed(2)}s</span>
              </div>
            </div>
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
                  {isExpanded ? <Icon glyph="ChevronDown" size="small" /> : <Icon glyph="ChevronRight" size="small" />}
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
                      <div className={styles.detailSectionTitle}>
                        <Icon glyph="MagnifyingGlass" size="small" /> Field Analysis
                      </div>
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
                      <div className={styles.detailSectionTitle}>
                        <Icon glyph="Sparkle" size="small" /> AI Analysis Details
                      </div>

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
                          <div className={styles.promptTitle}>
                            <Icon glyph="Edit" size="small" /> Prompt Sent to LLM
                          </div>
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
                          <Icon glyph="Warning" size="small" /> {stepResult.ai_analysis.fallback_reason}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Configuration Details */}
                  {(stepResult.base_configuration_id || stepResult.fields_in_base !== undefined) && (
                    <div className={styles.detailSection}>
                      <div className={styles.detailSectionTitle}>
                        <Icon glyph="Settings" size="small" /> Configuration Details
                      </div>

                      {stepResult.configs_analyzed && stepResult.configs_analyzed.length > 0 && (
                        <div className={styles.configSubsection}>
                          <div className={styles.configSubsectionTitle}>
                            <Icon glyph="Building" size="small" /> Configs Analyzed for Pattern Learning ({stepResult.total_configs_analyzed || stepResult.configs_analyzed.length})
                          </div>
                          <div className={styles.configsList}>
                            {stepResult.configs_analyzed.map((config, idx) => (
                              <span key={idx} className={styles.configBadge}>{config}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className={styles.configSubsection}>
                        <div className={styles.configSubsectionTitle}>
                          <Icon glyph="Favorite" size="small" /> Selected Base Template
                        </div>
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
                      <div className={styles.detailSectionTitle}>
                        <Icon glyph="Code" size="small" /> Parser Configuration
                      </div>
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
                      <div className={styles.detailSectionTitle}>
                        <Icon glyph="Connect" size="small" /> Mappings Generation
                      </div>
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
                                  {pattern.status === 'unmapped' ? <><Icon glyph="Warning" size="small" /> </> : ''}
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
                      <div className={styles.detailSectionTitle}>
                        <Icon glyph="Charts" size="small" /> Confidence Calculation
                      </div>
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
                      <div className={styles.detailSectionTitle}>
                        <Icon glyph="Checkmark" size="small" /> Configuration Summary
                      </div>

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
                            <div className={styles.summaryLabel}>
                              <Icon glyph="Warning" size="small" /> Unmapped Fields
                            </div>
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
                            <div className={styles.summaryLabel}>
                              <Icon glyph="ImportantWithCircle" size="small" /> Requires Review
                            </div>
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

        {/* NEW SECTION: Field Mapping Details */}
        {generation?.result?.aiInsights && (generation?.result?.aiInsights.llmCalls?.length > 0 || generation?.result?.aiInsights.patternMatches?.length > 0) && (
          <>
            <div className={styles.sectionDivider} />

            {/* Pattern Matched Fields */}
            {enhancedPatternMatches && enhancedPatternMatches.length > 0 && (
              <div className={styles.fieldMappingSection}>
                <div
                  className={styles.sectionHeader}
                  onClick={() => toggleSection('patternMatched')}
                >
                  <span className={styles.sectionExpandIcon}>
                    {expandedSections.patternMatched ? <Icon glyph="ChevronDown" size="small" /> : <Icon glyph="ChevronRight" size="small" />}
                  </span>
                  <Icon glyph="Favorite" className={styles.sectionIcon} />
                  <span className={styles.sectionTitle}>
                    Pattern Matched Fields ({enhancedPatternMatches.length})
                  </span>
                </div>
                {expandedSections.patternMatched && enhancedPatternMatches.map((match, idx) => (
                  <div key={idx} className={styles.fieldDetail}>
                    <div className={styles.fieldHeader}>
                      <span className={styles.fieldId}>
                        Field {match.fieldId}
                        {match.isComposite && (
                          <span className={styles.compositeTag}>COMPOSITE</span>
                        )}
                      </span>
                      <span className={styles.confidence}>{Math.round(match.confidence * 100)}%</span>
                    </div>
                    <div className={styles.fieldContent}>
                      <div className={styles.patternTried}>
                        Patterns tried: {match.patternsTried.join(' → ')} <Icon glyph="Checkmark" size="small" />
                      </div>
                      <div className={styles.fieldTargets}>
                        Targets: {match.targets.join(', ')}
                      </div>
                      <div className={styles.fieldTime}>
                        Time: {match.time.toFixed(2)}ms
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* LLM Suggested Fields */}
            {generation.result.aiInsights.llmCalls && generation.result.aiInsights.llmCalls.length > 0 && (
              <div className={styles.fieldMappingSection}>
                <div
                  className={styles.sectionHeader}
                  onClick={() => toggleSection('llmSuggested')}
                >
                  <span className={styles.sectionExpandIcon}>
                    {expandedSections.llmSuggested ? <Icon glyph="ChevronDown" size="small" /> : <Icon glyph="ChevronRight" size="small" />}
                  </span>
                  <Icon glyph="Sparkle" className={styles.sectionIcon} />
                  <span className={styles.sectionTitle}>
                    LLM Suggested Fields ({generation.result.aiInsights.llmCalls.length})
                  </span>
                </div>
                {expandedSections.llmSuggested && generation.result.aiInsights.llmCalls.map((call, idx) => (
                  <LLMFieldDetail key={idx} llmCall={call} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Collapsible Output JSON Panel */}
        {output && (
          <div className={styles.outputJsonPanel}>
            <div
              className={styles.sectionHeader}
              onClick={() => toggleSection('outputJson')}
            >
              <span className={styles.sectionExpandIcon}>
                {expandedSections.outputJson ? <Icon glyph="ChevronDown" size="small" /> : <Icon glyph="ChevronRight" size="small" />}
              </span>
              <Icon glyph="Code" className={styles.sectionIcon} />
              <span className={styles.sectionTitle}>
                Generated Conversion Logic in JSON
              </span>
            </div>

            {expandedSections.outputJson && (() => {
              // Build highlight metadata
              const buildHighlightMetadata = () => {
                const mappingGeneration = generationDetails?.mapping_generation;
                if (!mappingGeneration?.details) return { patternMatched: [], aiSuggested: [] };

                const patternMatched = [];
                const aiSuggested = [];

                mappingGeneration.details.forEach(detail => {
                  const fieldInfo = {
                    field_id: detail.field_id,
                    source: detail.source,
                    targets: detail.targets,
                    confidence: detail.confidence,
                    mapping_method: detail.mapping_method
                  };

                  if (detail.mapping_method === 'pattern_match') {
                    patternMatched.push(fieldInfo);
                  } else if (detail.mapping_method === 'llm_suggestion') {
                    aiSuggested.push(fieldInfo);
                  }
                });

                return { patternMatched, aiSuggested };
              };

              const highlightMetadata = buildHighlightMetadata();

              // Build line highlights
              const buildLineHighlights = () => {
                const jsonString = JSON.stringify(output, null, 2);
                const lines = jsonString.split('\n');
                const lineHighlights = {};

                let inMappingsArray = false;
                let currentMappingStart = null;
                let currentMappingType = null;

                lines.forEach((line, idx) => {
                  if (line.includes('"mappings":')) {
                    inMappingsArray = true;
                  }
                  if (inMappingsArray && line.includes('"builder":')) {
                    inMappingsArray = false;
                  }

                  if (inMappingsArray && line.trim() === '{') {
                    currentMappingStart = idx;
                  }

                  if (inMappingsArray && line.includes('"source":')) {
                    const match = line.match(/"source":\s*"([^"]+)"/);
                    if (match) {
                      const source = match[1];
                      const baseFieldId = source.split('.')[0];

                      const patternMatch = highlightMetadata.patternMatched.find(f => f.field_id === baseFieldId);
                      const aiMatch = highlightMetadata.aiSuggested.find(f => f.field_id === baseFieldId);

                      if (patternMatch) {
                        currentMappingType = 'pattern';
                      } else if (aiMatch) {
                        currentMappingType = 'ai';
                      }
                    }
                  }

                  if (currentMappingStart !== null && currentMappingType) {
                    for (let i = currentMappingStart; i <= idx; i++) {
                      lineHighlights[i] = currentMappingType;
                    }
                  }

                  if (inMappingsArray && line.trim().match(/^}\s*,?\s*$/)) {
                    if (currentMappingType) {
                      lineHighlights[idx] = currentMappingType;
                    }
                    currentMappingStart = null;
                    currentMappingType = null;
                  }
                });

                return lineHighlights;
              };

              const lineHighlights = buildLineHighlights();

              return (
                <div className={styles.outputJsonContent}>
                  {/* Legend */}
                  <div className={styles.legend}>
                    <span className={styles.legendTitle}>Legend:</span>
                    <span className={styles.legendItem}>
                      <span className={styles.legendDot} style={{backgroundColor: 'var(--green-dark1)'}}></span>
                      <span>Pattern Matched Mappings</span>
                    </span>
                    <span className={styles.legendItem}>
                      <span className={styles.legendDot} style={{backgroundColor: 'var(--purple-dark1)'}}></span>
                      <span>AI Suggested Mappings</span>
                    </span>
                  </div>

                  {/* JSON Output */}
                  <div className={styles.outputContent}>
                    <SyntaxHighlighter
                      language="json"
                      style={leafyGreenTheme}
                      showLineNumbers={true}
                      wrapLines={true}
                      lineProps={(lineNumber) => {
                        const highlightType = lineHighlights[lineNumber - 1];

                        if (highlightType === 'pattern') {
                          return {
                            style: {
                              backgroundColor: 'rgba(0, 163, 92, 0.15)',
                              borderLeft: '3px solid #00A35C',
                              display: 'block',
                              paddingLeft: '8px'
                            }
                          };
                        } else if (highlightType === 'ai') {
                          return {
                            style: {
                              backgroundColor: 'rgba(92, 60, 146, 0.15)',
                              borderLeft: '3px solid #5C3C92',
                              display: 'block',
                              paddingLeft: '8px'
                            }
                          };
                        }

                        return { style: { display: 'block' } };
                      }}
                      customStyle={{
                        margin: 0,
                        borderRadius: '8px',
                        fontSize: '13px',
                        lineHeight: '1.5'
                      }}
                    >
                      {JSON.stringify(output, null, 2)}
                    </SyntaxHighlighter>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
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

  // Validation Error Component (inline editing)
  const ValidationError = ({ error, onFix }) => {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState('');

    const handleFix = () => {
      if (value.trim()) {
        onFix(error.field, value);
        setEditing(false);
      }
    };

    return (
      <div className={`${styles.validationError} ${styles[error.severity]}`}>
        <div className={styles.errorHeader}>
          <span className={styles.errorIcon}>
            {error.severity === 'error' ? '🔴' : '🟡'}
          </span>
          <code className={styles.errorField}>{error.field}</code>
        </div>

        <div className={styles.errorMessage}>
          {error.message}
        </div>

        {error.suggestion && (
          <div className={styles.errorSuggestion}>
            <Icon glyph="Bulb" size="small" />
            <span>{error.suggestion}</span>
          </div>
        )}

        {error.severity === 'error' && (
          <div className={styles.errorActions}>
            {!editing ? (
              <button
                className={styles.fixButton}
                onClick={() => setEditing(true)}
              >
                <Icon glyph="Edit" size="small" />
                Fix This Error
              </button>
            ) : (
              <div className={styles.fixEditor}>
                <input
                  type="text"
                  className={styles.fixInput}
                  placeholder="Enter new value..."
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') handleFix();
                  }}
                  autoFocus
                />
                <button
                  className={styles.applyButton}
                  onClick={handleFix}
                  disabled={!value.trim()}
                >
                  Apply
                </button>
                <button
                  className={styles.cancelButton}
                  onClick={() => {
                    setEditing(false);
                    setValue('');
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderValidationTab = () => {
    // Show loading state
    if (validation?.loading) {
      return (
        <div className={styles.validationContainer}>
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <div className={styles.loadingText}>Validating Configuration...</div>
          </div>
        </div>
      );
    }

    // Show initial state (before validation runs)
    if (!validation || !validation.checks) {
      return (
        <div className={styles.validationContainer}>
          <div className={styles.validationEmptyState}>
            <div className={styles.emptyStateIcon}>
              <Icon glyph="Checkmark" size="xlarge" />
            </div>
            <div className={styles.emptyStateTitle}>Ready for Validation</div>
            <div className={styles.emptyStateDescription}>
              Click "Run Validation" to check this configuration against the MongoDB schema
            </div>
            <button className={styles.validateButton} onClick={onValidate}>
              <Icon glyph="Play" size="small" />
              Run Validation
            </button>
          </div>
        </div>
      );
    }

    // Determine score color
    const getScoreColor = (score) => {
      if (score >= 90) return '#00A35C'; // Green
      if (score >= 70) return '#FFB81C'; // Yellow
      return '#CD5B45'; // Red
    };

    const scoreColor = getScoreColor(validation.score);

    return (
      <div className={styles.validationContainer}>
        {/* Validation Header */}
        <div className={styles.validationHeader}>
          <div className={styles.validationScoreCard}>
            <div className={styles.scoreLabel}>Validation Score</div>
            <div
              className={styles.scoreValue}
              style={{ color: scoreColor }}
            >
              {validation.score}%
            </div>
            <div className={styles.scoreStatus}>
              {validation.valid ? (
                <span className={styles.statusValid}>
                  <Icon glyph="Checkmark" size="small" /> Valid
                </span>
              ) : (
                <span className={styles.statusInvalid}>
                  <Icon glyph="X" size="small" /> Invalid
                </span>
              )}
            </div>
          </div>

          <div className={styles.validationActions}>
            <button
              className={styles.revalidateButton}
              onClick={onValidate}
            >
              <Icon glyph="Refresh" size="small" />
              Re-validate
            </button>

            <button
              className={`${styles.saveButton} ${validation.valid ? styles.enabled : styles.disabled}`}
              onClick={() => onSave && onSave(false)}
              disabled={!validation.valid || validation.saving}
            >
              {validation.saving ? (
                <>
                  <div className={styles.buttonSpinner} />
                  Saving...
                </>
              ) : validation.saved ? (
                <>
                  <Icon glyph="Checkmark" size="small" />
                  Saved
                </>
              ) : (
                <>
                  <Icon glyph="Save" size="small" />
                  Save to Production
                </>
              )}
            </button>

            {!validation.valid && (
              <button
                className={styles.forceSaveButton}
                onClick={() => onSave && onSave(true)}
                disabled={validation.saving}
                title="Save anyway (not recommended)"
              >
                <Icon glyph="ImportantWithCircle" size="small" />
                Force Save
              </button>
            )}
          </div>
        </div>

        {/* Save Success Message */}
        {validation.saved && (
          <div className={styles.successBanner}>
            <Icon glyph="Checkmark" size="small" />
            <span>Configuration successfully saved to production registry!</span>
          </div>
        )}

        {/* Save Error Message */}
        {validation.saveError && (
          <div className={styles.errorBanner}>
            <Icon glyph="Warning" size="small" />
            <span>{validation.saveError}</span>
          </div>
        )}

        {/* Summary Stats */}
        <div className={styles.validationSummary}>
          <div className={styles.summaryItem}>
            <Icon glyph="Checkmark" className={styles.summaryIcon} style={{ color: '#00A35C' }} />
            <div className={styles.summaryContent}>
              <div className={styles.summaryLabel}>Passed</div>
              <div className={styles.summaryValue}>
                {validation.checks.filter(c => c.status === 'passed').length}
              </div>
            </div>
          </div>
          <div className={styles.summaryItem}>
            <Icon glyph="ImportantWithCircle" className={styles.summaryIcon} style={{ color: '#FFB81C' }} />
            <div className={styles.summaryContent}>
              <div className={styles.summaryLabel}>Warnings</div>
              <div className={styles.summaryValue}>
                {validation.warnings?.length || 0}
              </div>
            </div>
          </div>
          <div className={styles.summaryItem}>
            <Icon glyph="X" className={styles.summaryIcon} style={{ color: '#CD5B45' }} />
            <div className={styles.summaryContent}>
              <div className={styles.summaryLabel}>Errors</div>
              <div className={styles.summaryValue}>
                {validation.errors?.length || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Validation Checks */}
        <div className={styles.validationResults}>
          {validation.checks?.map((check, idx) => (
            <div key={idx} className={styles.validationCheck}>
              <div
                className={`${styles.checkHeader} ${styles[check.status]}`}
                onClick={() => toggleStep(idx)}
              >
                <div className={styles.checkLeft}>
                  <span className={styles.checkIcon}>{check.icon}</span>
                  <span className={styles.checkName}>{check.name}</span>
                  {check.errors && check.errors.length > 0 && (
                    <span className={styles.errorCount}>
                      {check.errors.length} issue{check.errors.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className={styles.checkRight}>
                  <span className={`${styles.checkStatus} ${styles[check.status]}`}>
                    <Icon glyph={check.status === 'passed' ? 'Checkmark' : check.status === 'warning' ? 'Warning' : 'X'} size="small" />
                    {' '}
                    {check.status}
                  </span>
                  <span className={styles.expandIcon}>
                    {expandedSteps[idx] ? <Icon glyph="ChevronDown" size="small" /> : <Icon glyph="ChevronRight" size="small" />}
                  </span>
                </div>
              </div>

              <div className={styles.checkDetails}>
                {check.details}
              </div>

              {/* Expanded Error Details */}
              {expandedSteps[idx] && check.errors && check.errors.length > 0 && (
                <div className={styles.checkErrors}>
                  {check.errors.map((error, errorIdx) => (
                    <ValidationError
                      key={errorIdx}
                      error={error}
                      onFix={onFixError}
                    />
                  ))}
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

    // Extract generation_details from result (from semantic_learning_service_simplified.py)
    const generationDetails = generation?.result?.generation_details;
    const mappingGeneration = generationDetails?.mapping_generation;
    const fieldExtraction = generationDetails?.field_extraction;
    const statistics = generationDetails?.statistics;

    // Extract base config ID (it's in statistics, not mapping_generation)
    const baseConfigId = statistics?.base_config_id || 'N/A';

    // Build metadata for field categorization
    const buildHighlightMetadata = () => {
      if (!mappingGeneration?.details) return { patternMatched: [], aiSuggested: [], failed: [], composite: [] };

      const patternMatched = [];
      const aiSuggested = [];
      const failed = [];
      const composite = [];

      // First, process non-composite field mappings
      mappingGeneration.details.forEach(detail => {
        const fieldInfo = {
          field_id: detail.field_id,
          source: detail.source,
          targets: detail.targets,
          confidence: detail.confidence,
          mapping_method: detail.mapping_method,
          semantic_concept: detail.semantic_concept
        };

        if (detail.mapping_method === 'pattern_match') {
          patternMatched.push(fieldInfo);
        } else if (detail.mapping_method === 'llm_suggestion') {
          aiSuggested.push(fieldInfo);
        } else if (detail.mapping_method === 'failed') {
          failed.push(fieldInfo);
        }
      });

      // Now, add composite fields from field_extraction that were split into components
      // These won't appear in mapping_generation.details because they're mapped as components
      if (fieldExtraction?.fields) {
        fieldExtraction.fields.forEach(field => {
          if (field.is_composite && field.components) {
            // Check if this composite field is already in the lists
            const alreadyListed = [...patternMatched, ...aiSuggested, ...failed]
              .some(f => f.field_id === field.field_id);

            if (!alreadyListed) {
              // This composite field was split into components - add it separately
              // We need to check the actual mappings in output config to get targets
              const componentTargets = [];
              if (output?.mappings) {
                field.components.forEach(comp => {
                  const componentSource = `${field.field_id}.${comp}`;
                  const mapping = output.mappings.find(m => m.source === componentSource);
                  if (mapping && mapping.targets) {
                    componentTargets.push(...mapping.targets);
                  }
                });
              }

              composite.push({
                field_id: field.field_id,
                source: field.field_id,
                targets: componentTargets,
                confidence: 0.9, // Composite fields use pattern matching, so high confidence
                mapping_method: 'pattern_match',
                semantic_concept: field.field_name,
                is_composite: true,
                components: field.components
              });
            }
          }
        });
      }

      // Add composite fields to patternMatched (they use pattern-based component mappings)
      patternMatched.push(...composite);

      return { patternMatched, aiSuggested, failed, composite };
    };

    const highlightMetadata = buildHighlightMetadata();

    // Build map of which lines to highlight based on field metadata
    const buildLineHighlights = () => {
      if (!output) return {};

      const jsonString = JSON.stringify(output, null, 2);
      const lines = jsonString.split('\n');
      const lineHighlights = {}; // lineNumber -> 'pattern'|'ai'|'newField'

      // Build list of auto-detected fields (extraction_method === 'fallback')
      const autoDetectedFields = new Set();
      if (fieldExtraction?.fields) {
        fieldExtraction.fields.forEach(field => {
          if (field.extraction_method === 'fallback') {
            autoDetectedFields.add(field.field_id);
          }
        });
      }

      // Track which sections we're in
      let inParserFields = false;
      let inMappingsArray = false;
      let currentFieldStart = null;
      let currentFieldId = null;
      let currentMappingStart = null;
      let currentMappingType = null;

      lines.forEach((line, idx) => {
        // Detect parser.fields section
        if (line.includes('"fields":') && !inMappingsArray) {
          inParserFields = true;
        }
        if (inParserFields && line.includes('"mappings":')) {
          inParserFields = false;
        }

        // Track parser field blocks (auto-detected fields should be highlighted)
        if (inParserFields) {
          // Match field ID definitions like "13C": {
          const fieldMatch = line.match(/"([^"]+)":\s*\{/);
          if (fieldMatch && !line.includes('"fields"')) {
            currentFieldId = fieldMatch[1];
            currentFieldStart = idx;

            // Check if this is an auto-detected field
            if (autoDetectedFields.has(currentFieldId)) {
              lineHighlights[idx] = 'newField';
            }
          }

          // If we're tracking an auto-detected field, highlight all its lines
          if (currentFieldStart !== null && autoDetectedFields.has(currentFieldId)) {
            lineHighlights[idx] = 'newField';
          }

          // End of field block
          if (currentFieldStart !== null && line.trim().match(/^}\s*,?\s*$/)) {
            if (autoDetectedFields.has(currentFieldId)) {
              lineHighlights[idx] = 'newField';
            }
            currentFieldStart = null;
            currentFieldId = null;
          }
        }

        // Detect mappings array section
        if (line.includes('"mappings":')) {
          inMappingsArray = true;
          inParserFields = false;
        }
        if (inMappingsArray && line.includes('"builder":')) {
          inMappingsArray = false;
        }

        // Track mapping blocks (each mapping is an object)
        if (inMappingsArray && line.trim() === '{') {
          currentMappingStart = idx;
        }

        // Identify mapping type by source field
        if (inMappingsArray && line.includes('"source":')) {
          const match = line.match(/"source":\s*"([^"]+)"/);
          if (match) {
            const source = match[1];

            // Extract base field_id (e.g., "32A" from "32A.value_date")
            const baseFieldId = source.split('.')[0];

            // Find this source in our metadata by matching field_id
            // The metadata has field_id, not source
            const patternMatch = highlightMetadata.patternMatched.find(f => f.field_id === baseFieldId);
            const aiMatch = highlightMetadata.aiSuggested.find(f => f.field_id === baseFieldId);

            if (patternMatch) {
              currentMappingType = 'pattern';
            } else if (aiMatch) {
              currentMappingType = 'ai';
            }
          }
        }

        // Apply highlight to entire mapping block
        if (currentMappingStart !== null && currentMappingType) {
          // Highlight from start of block to current line
          for (let i = currentMappingStart; i <= idx; i++) {
            lineHighlights[i] = currentMappingType;
          }
        }

        // End of mapping block
        if (inMappingsArray && line.trim().match(/^}\s*,?\s*$/)) {
          // Mark the closing brace too
          if (currentMappingType) {
            lineHighlights[idx] = currentMappingType;
          }
          currentMappingStart = null;
          currentMappingType = null;
        }
      });

      return lineHighlights;
    };

    const lineHighlights = buildLineHighlights();

    // Debug logging
    console.log('=== OUTPUT TAB DEBUG ===');
    console.log('highlightMetadata:', highlightMetadata);
    console.log('lineHighlights:', lineHighlights);
    console.log('Total pattern matched:', highlightMetadata.patternMatched.length);
    console.log('Total AI suggested:', highlightMetadata.aiSuggested.length);
    console.log('Sample pattern matched fields:', highlightMetadata.patternMatched.slice(0, 2));
    console.log('Sample AI suggested fields:', highlightMetadata.aiSuggested.slice(0, 2));

    // Log auto-detected fields
    const autoDetectedFields = fieldExtraction?.fields?.filter(f => f.extraction_method === 'fallback') || [];
    console.log('Auto-detected parser fields:', autoDetectedFields.map(f => f.field_id));
    console.log('Highlight types in lineHighlights:', [...new Set(Object.values(lineHighlights))]);

    // Extract uncertain fields from generation result
    const uncertainFields = generation?.result?.uncertain_fields || [];

    return (
      <div className={styles.outputContainer}>
        {/* Statistics Banner */}
        {generationDetails && (
          <div className={styles.statsBanner}>
            <div className={styles.statsBannerItem}>
              <Icon glyph="Settings" size="small" />
              <div className={styles.statsBannerContent}>
                <span className={styles.statsBannerLabel}>Base Config</span>
                <span className={styles.statsBannerValue}>{baseConfigId}</span>
              </div>
            </div>
            <div className={styles.statsBannerItem}>
              <Icon glyph="Favorite" size="small" />
              <div className={styles.statsBannerContent}>
                <span className={styles.statsBannerLabel}>Pattern Matches</span>
                <span className={styles.statsBannerValue} style={{color: 'var(--green-dark1)'}}>
                  {highlightMetadata.patternMatched.length}
                </span>
              </div>
            </div>
            <div className={styles.statsBannerItem}>
              <Icon glyph="Sparkle" size="small" />
              <div className={styles.statsBannerContent}>
                <span className={styles.statsBannerLabel}>AI Suggestions</span>
                <span className={styles.statsBannerValue} style={{color: 'var(--purple-dark1)'}}>
                  {highlightMetadata.aiSuggested.length}
                </span>
              </div>
            </div>
            {statistics?.llm_total_tokens && (
              <div className={styles.statsBannerItem}>
                <Icon glyph="Code" size="small" />
                <div className={styles.statsBannerContent}>
                  <span className={styles.statsBannerLabel}>Tokens Used</span>
                  <span className={styles.statsBannerValue}>{statistics.llm_total_tokens.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Task 1.1: Uncertain Fields Warning Banner */}
        {uncertainFields.length > 0 && (
          <div className={styles.uncertainFieldsWarning}>
            <Icon glyph="Warning" size="small" />
            <div className={styles.warningContent}>
              <div className={styles.warningTitle}>
                {uncertainFields.length} field{uncertainFields.length > 1 ? 's have' : ' has'} low confidence (&lt;80%)
              </div>
              <div className={styles.warningSubtitle}>
                These fields may need manual review before using this configuration
              </div>
              <div className={styles.uncertainFieldsList}>
                {uncertainFields.map((uf, idx) => (
                  <div key={idx} className={styles.uncertainField}>
                    <code className={styles.uncertainFieldCode}>{uf.field}</code>
                    <span className={styles.uncertainConfidence}>
                      {Math.round(uf.confidence * 100)}%
                    </span>
                    <span className={styles.uncertainTargets}>
                      → {Array.isArray(uf.targets) ? uf.targets.join(', ') : uf.targets}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Field Breakdown Section (Expandable) */}
        {(highlightMetadata.patternMatched.length > 0 || highlightMetadata.aiSuggested.length > 0) && (
          <div className={styles.breakdownSection}>
            <button
              className={styles.breakdownToggle}
              onClick={() => setShowBreakdown(!showBreakdown)}
            >
              <span className={styles.breakdownIcon}>{showBreakdown ? <Icon glyph="ChevronDown" size="small" /> : <Icon glyph="ChevronRight" size="small" />}</span>
              <span className={styles.breakdownTitle}>Field Breakdown</span>
              <span className={styles.breakdownCount}>
                ({highlightMetadata.patternMatched.length + highlightMetadata.aiSuggested.length} fields)
              </span>
            </button>

            {showBreakdown && (
              <div className={styles.breakdownContent}>
                {/* Pattern Matched Fields */}
                {highlightMetadata.patternMatched.length > 0 && (
                  <div className={styles.fieldCategory}>
                    <div className={styles.categoryHeader}>
                      <Icon glyph="Favorite" size="small" />
                      <span className={styles.categoryTitle} style={{color: 'var(--green-dark1)'}}>
                        Pattern Matched ({highlightMetadata.patternMatched.length})
                      </span>
                    </div>
                    <div className={styles.fieldGrid}>
                      {highlightMetadata.patternMatched.map((field, idx) => {
                        // Task 1.3: Check if this field is composite
                        const fieldDetail = fieldExtraction?.fields?.find(f => f.field_id === field.field_id);
                        const isComposite = fieldDetail?.is_composite;
                        const components = fieldDetail?.components;

                        return (
                          <div key={idx} className={styles.fieldCard} style={{borderLeft: '3px solid var(--green-dark1)'}}>
                            <div className={styles.fieldCardHeader}>
                              <code className={styles.fieldId}>
                                {field.field_id}
                                {isComposite && <span className={styles.compositeTag}>composite</span>}
                              </code>
                              <span className={styles.fieldConfidence} style={{color: 'var(--green-dark1)'}}>
                                {Math.round(field.confidence * 100)}%
                              </span>
                            </div>
                            {field.semantic_concept && (
                              <div className={styles.fieldConcept}>{field.semantic_concept}</div>
                            )}
                            {isComposite && components && (
                              <div className={styles.compositeIndicator}>
                                {components.length} components
                              </div>
                            )}
                            {/* For composite fields, show component breakdown instead of combined targets */}
                            {isComposite && components && output?.mappings ? (
                              <div className={styles.compositeComponentList}>
                                {components.map((comp, compIdx) => {
                                  const componentSource = `${field.field_id}.${comp}`;
                                  const mapping = output.mappings.find(m => m.source === componentSource);
                                  return (
                                    <div key={compIdx} className={styles.compositeComponentItem}>
                                      <span className={styles.componentName}>{comp}</span>
                                      <span className={styles.componentArrow}>→</span>
                                      <span className={styles.componentTarget}>
                                        {mapping?.targets?.join(', ') || 'Not mapped'}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className={styles.fieldTargets}>
                                → {Array.isArray(field.targets) ? field.targets.join(', ') : field.targets}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* AI Suggested Fields */}
                {highlightMetadata.aiSuggested.length > 0 && (
                  <div className={styles.fieldCategory}>
                    <div className={styles.categoryHeader}>
                      <Icon glyph="Sparkle" size="small" />
                      <span className={styles.categoryTitle} style={{color: 'var(--purple-dark1)'}}>
                        AI Suggested ({highlightMetadata.aiSuggested.length})
                      </span>
                    </div>
                    <div className={styles.fieldGrid}>
                      {highlightMetadata.aiSuggested.map((field, idx) => {
                        // Task 1.3: Check if this field is composite
                        const fieldDetail = fieldExtraction?.fields?.find(f => f.field_id === field.field_id);
                        const isComposite = fieldDetail?.is_composite;
                        const components = fieldDetail?.components;

                        return (
                          <div key={idx} className={styles.fieldCard} style={{borderLeft: '3px solid var(--purple-dark1)'}}>
                            <div className={styles.fieldCardHeader}>
                              <code className={styles.fieldId}>
                                {field.field_id}
                                {isComposite && <span className={styles.compositeTag}>composite</span>}
                              </code>
                              <span className={styles.fieldConfidence} style={{color: 'var(--purple-dark1)'}}>
                                {Math.round(field.confidence * 100)}%
                              </span>
                            </div>
                            {field.semantic_concept && (
                              <div className={styles.fieldConcept}>{field.semantic_concept}</div>
                            )}
                            {isComposite && components && (
                              <div className={styles.compositeIndicator}>
                                {components.length} components
                              </div>
                            )}
                            <div className={styles.fieldTargets}>
                              → {Array.isArray(field.targets) ? field.targets.join(', ') : field.targets}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className={styles.legend}>
          <span className={styles.legendTitle}>Legend:</span>
          <span className={styles.legendItem}>
            <span className={styles.legendDot} style={{backgroundColor: 'var(--green-dark1)'}}></span>
            <span>Pattern Matched Mappings</span>
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendDot} style={{backgroundColor: 'var(--purple-dark1)'}}></span>
            <span>AI Suggested Mappings</span>
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendDot} style={{backgroundColor: 'var(--blue-dark1)'}}></span>
            <span>Auto-Detected Parser Fields</span>
          </span>
        </div>

        {/* Configuration Output with Syntax Highlighting */}
        <div className={styles.outputHeader}>
          <div className={styles.outputTitle}>Generated Configuration</div>
          <div className={styles.outputActions}>
            <button
              className={styles.outputButton}
              onClick={() => navigator.clipboard.writeText(JSON.stringify(output, null, 2))}
            >
              Copy
            </button>
            <button className={styles.outputButton}>Download</button>
          </div>
        </div>
        <div className={styles.outputContent}>
          <SyntaxHighlighter
            language="json"
            style={leafyGreenTheme}
            showLineNumbers={true}
            wrapLines={true}
            lineProps={(lineNumber) => {
              const highlightType = lineHighlights[lineNumber - 1]; // lineNumber is 1-indexed

              if (highlightType === 'pattern') {
                return {
                  style: {
                    backgroundColor: 'rgba(0, 163, 92, 0.15)',
                    borderLeft: '3px solid #00A35C',
                    display: 'block',
                    paddingLeft: '8px'
                  }
                };
              } else if (highlightType === 'ai') {
                return {
                  style: {
                    backgroundColor: 'rgba(92, 60, 146, 0.15)',
                    borderLeft: '3px solid #5C3C92',
                    display: 'block',
                    paddingLeft: '8px'
                  }
                };
              } else if (highlightType === 'newField') {
                return {
                  style: {
                    backgroundColor: 'rgba(18, 84, 183, 0.15)',
                    borderLeft: '3px solid #1254B7',
                    display: 'block',
                    paddingLeft: '8px'
                  }
                };
              }

              return { style: { display: 'block' } };
            }}
            customStyle={{
              margin: 0,
              borderRadius: '8px',
              fontSize: '13px',
              lineHeight: '1.5'
            }}
          >
            {JSON.stringify(output, null, 2)}
          </SyntaxHighlighter>
        </div>
      </div>
    );
  };

  const renderConfigurationTab = () => {
    // Wrap onSave to track the saved config ID and pass session_id
    const handleSaveWithTracking = async (force) => {
      // Pass session_id to onSave if available
      const result = await onSave(force, sessionId);
      if (result && output?._id) {
        setLastSavedConfigId(output._id);
      }
      return result;
    };

    return (
      <>
        {!output ? (
          renderEmptyState()
        ) : (
          <ConfigurationEditor
            configuration={output}
            validationResult={validation}
            onSave={handleSaveWithTracking}
            onValidate={onValidate}
            onFieldUpdate={onFixError}
            isValidating={validation?.loading || false}
            isSaving={validation?.saving || false}
          />
        )}
        <RegistryConsole
          lastSavedConfig={lastSavedConfigId}
          onRefresh={() => {
            console.log('Registry refreshed');
          }}
          onSessionIdGenerated={(id) => setSessionId(id)}
        />
      </>
    );
  };

  const renderTabContent = () => {
    if (generation?.status === 'generating') {
      return renderLoadingState();
    }

    switch (activeTab) {
      case 'flow':
        return renderFlowTab();
      case 'configuration':
        return renderConfigurationTab();
      default:
        return renderEmptyState();
    }
  };

  return (
    <div className={styles.container}>
      {/* Tabs using LeafyGreen-styled buttons */}
      <div className={styles.tabsWrapper}>
        <button
          className={`${styles.leafyTab} ${activeTab === 'flow' ? styles.leafyTabActive : ''}`}
          onClick={() => onTabChange('flow')}
        >
          Flow
          {generation?.steps?.length > 0 && (
            <Badge variant="lightgray" className={styles.leafyTabBadge}>
              {generation.steps.length}
            </Badge>
          )}
        </button>
        <button
          className={`${styles.leafyTab} ${activeTab === 'configuration' ? styles.leafyTabActive : ''}`}
          onClick={() => onTabChange('configuration')}
        >
          Configuration
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {renderTabContent()}
      </div>
    </div>
  );
}