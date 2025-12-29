'use client';

import React, { useState, useEffect } from 'react';
import { H3, Body, Label } from '@leafygreen-ui/typography';
import Code from '@leafygreen-ui/code';
import Icon from '@leafygreen-ui/icon';

// Use Next.js API routes to proxy to converter sidecar

/**
 * Get the best example field for the rules column display
 * Priority: 32A (composite), 50K (debtor), 59 (creditor), 20 (reference)
 */
function getFeaturedExample(rulesFields) {
  if (!rulesFields || rulesFields.length === 0) return null;

  const priority = ['32A', '50K', '59', '20'];
  for (const fieldId of priority) {
    const field = rulesFields.find(f => f.source_field === fieldId);
    if (field?.output_value && Object.keys(field.output_value).length > 0) {
      return field;
    }
  }
  return rulesFields.find(f => f.output_value && Object.keys(f.output_value).length > 0);
}

/**
 * BubbleDetailPanel Component
 * Displays detailed information based on bubble type
 *
 * @param {Object} props
 * @param {string} props.bubbleType - '1', 'A', '2', 'B', '3'
 * @param {Object} props.data - Relevant data for the bubble
 * @param {Object} props.stats - Processing statistics (for conversion bubbles)
 */
export default function BubbleDetailPanel({ bubbleType, data, stats }) {
  // State for JSON bubble - must be at top level (React hooks rules)
  const [canonicalJson, setCanonicalJson] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // State for conversion bubble expandable sections
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const [configExpanded, setConfigExpanded] = useState(false);

  // Fetch canonical JSON when bubble type is '2' and conversionRunId is available
  useEffect(() => {
    if (bubbleType !== '2') {
      return;
    }

    const conversionRunId = data?.conversionRunId;
    if (!conversionRunId) {
      return;
    }

    const fetchCanonicalJson = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log('🔍 Fetching canonical JSON for conversion_run_id:', conversionRunId);
        const response = await fetch(
          `/api/canonical-json/${conversionRunId}/diff`
        );
        if (!response.ok) {
          throw new Error(`Failed to fetch canonical JSON: ${response.status}`);
        }
        const result = await response.json();
        console.log('✅ Canonical JSON fetched:', result);
        // Use after_json (canonical JSON after agent corrections)
        setCanonicalJson(result.after_json);
      } catch (err) {
        console.error('❌ Error fetching canonical JSON:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCanonicalJson();
  }, [bubbleType, data?.conversionRunId]);

  if (!bubbleType || !data) {
    return null;
  }

  // Message bubbles (1, 3)
  if (bubbleType === '1' || bubbleType === '3') {
    return (
      <>
        <style jsx global>{`
          .bubble-detail-scrollable::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          .bubble-detail-scrollable::-webkit-scrollbar-track {
            background: transparent;
          }
          .bubble-detail-scrollable::-webkit-scrollbar-thumb {
            background: rgba(136, 147, 151, 0.2);
            border-radius: 4px;
          }
          .bubble-detail-scrollable::-webkit-scrollbar-thumb:hover {
            background: rgba(136, 147, 151, 0.4);
          }
          /* Firefox */
          .bubble-detail-scrollable {
            scrollbar-width: thin;
            scrollbar-color: rgba(136, 147, 151, 0.2) transparent;
          }
        `}</style>
      <div style={{
        background: 'white',
        border: '1px solid #E7EAEE',
        borderRadius: '8px',
        padding: '24px'
      }}>
        <H3 style={{ marginBottom: '16px' }}>
          {bubbleType === '1' ? 'Source Message' : 'Target Message'}
        </H3>

        <Label style={{
          fontSize: '12px',
          color: '#889397',
          display: 'block',
          marginBottom: '12px'
        }}>
          Format: {data.format}
        </Label>

        <div
          className="bubble-detail-scrollable"
          style={{
          background: '#F9FBFA',
          borderRadius: '6px',
          padding: '16px',
          border: '1px solid #E7EAEE',
          maxHeight: '500px',
          overflow: 'auto'
        }}>
          <Code
            language={data.format?.startsWith('MT') ? 'swift' : 'xml'}
          >
            {data.message || 'No message data available'}
          </Code>
        </div>
      </div>
      </>
    );
  }

  // Conversion bubbles (A, B) - Two-Column Layout
  if (bubbleType === 'A' || bubbleType === 'B') {
    const hopNumber = data.hop || (bubbleType === 'A' ? 1 : 2);
    const detailed = data.detailed || {};

    // Get detailed processing data from backend
    const rulesLane = detailed.rules_lane || {};
    const aiLane = detailed.ai_lane || {};
    const configuration = detailed.configuration || {};

    const rulesCount = rulesLane.total_fields || 0;
    const aiCount = aiLane.total_fields || 0;

    // Get featured example for rules column
    const featuredExample = getFeaturedExample(rulesLane.fields || []);

    return (
      <>
        <style jsx global>{`
          .bubble-detail-scrollable::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          .bubble-detail-scrollable::-webkit-scrollbar-track {
            background: transparent;
          }
          .bubble-detail-scrollable::-webkit-scrollbar-thumb {
            background: rgba(136, 147, 151, 0.2);
            border-radius: 4px;
          }
          .bubble-detail-scrollable::-webkit-scrollbar-thumb:hover {
            background: rgba(136, 147, 151, 0.4);
          }
          .bubble-detail-scrollable {
            scrollbar-width: thin;
            scrollbar-color: rgba(136, 147, 151, 0.2) transparent;
          }
        `}</style>

        <div style={{
          background: 'white',
          border: '1px solid #E7EAEE',
          borderRadius: '8px',
          padding: '24px'
        }}>
          {/* Header */}
          <div style={{
            marginBottom: '24px',
            paddingBottom: '16px',
            borderBottom: '1px solid #E7EAEE'
          }}>
            <H3>Hop {hopNumber} Conversion</H3>
            <Label style={{ fontSize: '12px', color: '#889397', marginTop: '8px', display: 'block' }}>
              {data.conversionId}
            </Label>
          </div>

          {/* MongoDB Configuration Panel */}
          {configuration && Object.keys(configuration).length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <button
                onClick={() => setConfigExpanded(!configExpanded)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#F9FBFA',
                  border: '1px solid #E7EAEE',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon glyph="Database" size="small" fill="#0B61A4" />
                  <Body weight="medium" style={{ fontSize: '13px', color: '#1C2D38' }}>
                    MongoDB Configuration
                  </Body>
                </div>
                <span style={{ fontSize: '11px', color: '#889397' }}>
                  {configExpanded ? 'Hide' : 'Show'}
                </span>
              </button>

              {configExpanded && (
                <div className="bubble-detail-scrollable" style={{
                  marginTop: '12px',
                  maxHeight: '300px',
                  overflow: 'auto'
                }}>
                  <Code language="json">
                    {JSON.stringify(configuration, null, 2)}
                  </Code>
                </div>
              )}

              {/* Config Studio Link - Below the config panel */}
              <a
                href="/config-builder"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '12px',
                  padding: '10px 14px',
                  background: '#E3FCF7',
                  border: '1px solid #C0FAE6',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: '#00684A',
                  textDecoration: 'none',
                  fontWeight: '500'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#C0FAE6'}
                onMouseOut={(e) => e.currentTarget.style.background = '#E3FCF7'}
              >
                <span style={{ fontSize: '14px' }}>💡</span>
                Learn how configs work in Config Studio
              </a>
            </div>
          )}

          {/* Two Column Layout */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px',
            marginBottom: '24px'
          }}>
            {/* Left Column: Rules Engine */}
            <div style={{
              padding: '20px',
              background: '#F9FBFA',
              borderRadius: '8px',
              border: '1px solid #E7EAEE'
            }}>
              {/* Column Header */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Icon glyph="Database" size="small" fill="#0B61A4" />
                  <Body weight="medium" style={{ fontSize: '14px', color: '#1C2D38' }}>
                    Rules Engine
                  </Body>
                </div>
                <Label style={{ fontSize: '11px', color: '#889397' }}>
                  Powered by MongoDB
                </Label>
              </div>

              {/* Stat Card */}
              <div style={{
                padding: '16px',
                background: 'rgba(11, 97, 164, 0.1)',
                borderRadius: '8px',
                border: '1px solid rgba(11, 97, 164, 0.3)',
                marginBottom: '16px',
                textAlign: 'center'
              }}>
                <Body weight="medium" style={{ fontSize: '28px', color: '#0B61A4' }}>
                  {rulesCount}
                </Body>
                <Label style={{ fontSize: '12px', color: '#5C6C75' }}>
                  fields processed
                </Label>
              </div>

              {/* Featured Example */}
              {featuredExample && (() => {
                // Find the mapping rule for this field from configuration
                // Handle different schema field names (from/to vs source/targets)
                const mappings = configuration?.map || configuration?.mappings || [];
                const fieldMapping = mappings.find(m => {
                  const sourceField = m.from || m.source || m.source_field || '';
                  return sourceField === featuredExample.source_field;
                });

                // Get extraction pattern for this field
                const extractPatterns = configuration?.extract || {};
                const extractPattern = extractPatterns[featuredExample.source_field];

                // Build a clean MongoDB document representation
                const ruleDoc = fieldMapping ? {
                  // Extraction pattern (how to parse from source)
                  ...(extractPattern && { pattern: extractPattern }),
                  // Mapping configuration
                  source: fieldMapping.from || fieldMapping.source || fieldMapping.source_field,
                  targets: fieldMapping.to || fieldMapping.targets || fieldMapping.target_field,
                  ...(fieldMapping.transform && { transform: fieldMapping.transform }),
                  ...(fieldMapping.transform_config && { transform_config: fieldMapping.transform_config }),
                  processing_lane: fieldMapping.processing_lane || 'RULES'
                } : null;

                return (
                  <div style={{
                    background: 'white',
                    borderRadius: '8px',
                    border: '1px solid #E7EAEE',
                    padding: '16px',
                    marginBottom: '16px'
                  }}>
                    <Label style={{ fontSize: '11px', color: '#889397', marginBottom: '8px', display: 'block' }}>
                      Example: Field {featuredExample.source_field}
                    </Label>

                    {/* Input Value */}
                    <Label style={{ fontSize: '10px', color: '#889397', marginBottom: '4px', display: 'block' }}>
                      INPUT
                    </Label>
                    <div style={{
                      background: '#F9FBFA',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      marginBottom: '12px',
                      wordBreak: 'break-all'
                    }}>
                      {featuredExample.input_value || '(no input)'}
                    </div>

                    {/* MongoDB Rule Document */}
                    {ruleDoc && (
                      <>
                        <Label style={{ fontSize: '10px', color: '#0B61A4', marginBottom: '4px', display: 'block' }}>
                          MONGODB RULE
                        </Label>
                        <div style={{
                          background: 'rgba(11, 97, 164, 0.08)',
                          border: '1px solid rgba(11, 97, 164, 0.2)',
                          borderRadius: '4px',
                          padding: '10px',
                          marginBottom: '12px',
                          fontFamily: 'monospace',
                          fontSize: '11px',
                          lineHeight: '1.5',
                          whiteSpace: 'pre-wrap',
                          color: '#1C2D38'
                        }}>
                          {JSON.stringify(ruleDoc, null, 2)}
                        </div>
                      </>
                    )}

                    {/* Output Value */}
                    <Label style={{ fontSize: '10px', color: '#00A35C', marginBottom: '4px', display: 'block' }}>
                      OUTPUT
                    </Label>
                    <div style={{
                      background: '#E3FCF7',
                      padding: '12px',
                      borderRadius: '4px',
                      border: '1px solid rgba(0, 163, 92, 0.3)'
                    }}>
                      {Object.entries(featuredExample.output_value || {}).map(([key, value]) => (
                        <div key={key} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: '4px',
                          fontSize: '12px'
                        }}>
                          <Body style={{ color: '#5C6C75' }}>{key}:</Body>
                          <Body weight="medium" style={{ color: '#00A35C' }}>{String(value)}</Body>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Expandable Full Table */}
              <button
                onClick={() => setRulesExpanded(!rulesExpanded)}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'white',
                  border: '1px solid #E7EAEE',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#0B61A4'
                }}
              >
                <span>View all {rulesCount} field mappings</span>
                <Icon glyph={rulesExpanded ? 'ChevronUp' : 'ChevronDown'} size="small" fill="#0B61A4" />
              </button>

              {rulesExpanded && rulesLane.fields && (
                <div className="bubble-detail-scrollable" style={{
                  marginTop: '12px',
                  maxHeight: '250px',
                  overflow: 'auto',
                  background: 'white',
                  borderRadius: '6px',
                  border: '1px solid #E7EAEE'
                }}>
                  <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #E7EAEE', background: '#F9FBFA' }}>
                        <th style={{ textAlign: 'left', padding: '8px', fontWeight: '600' }}>Source</th>
                        <th style={{ textAlign: 'left', padding: '8px', fontWeight: '600' }}>Target</th>
                        <th style={{ textAlign: 'left', padding: '8px', fontWeight: '600' }}>Output</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rulesLane.fields.map((field, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #E7EAEE' }}>
                          <td style={{ padding: '8px', fontWeight: '600', color: '#0B61A4' }}>
                            {field.source_field || '-'}
                          </td>
                          <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '11px' }}>
                            {Array.isArray(field.target_field) ? field.target_field.join(', ') : field.target_field}
                          </td>
                          <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '11px' }}>
                            {field.output_value && Object.keys(field.output_value).length > 0
                              ? Object.entries(field.output_value).map(([k, v]) => `${k}: ${v}`).join(', ')
                              : '-'
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Right Column: AI Extraction or Placeholder */}
            {aiCount > 0 ? (
              <div style={{
                padding: '20px',
                background: '#FFF9E6',
                borderRadius: '8px',
                border: '1px solid rgba(255, 192, 16, 0.5)'
              }}>
                {/* Column Header */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <Icon glyph="Sparkle" size="small" fill="#895D1A" />
                    <Body weight="medium" style={{ fontSize: '14px', color: '#1C2D38' }}>
                      AI Extraction
                    </Body>
                  </div>
                  <Label style={{ fontSize: '11px', color: '#889397' }}>
                    Powered by GenAI
                  </Label>
                </div>

                {/* Stat Card */}
                <div style={{
                  padding: '16px',
                  background: 'rgba(255, 192, 16, 0.15)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 192, 16, 0.5)',
                  marginBottom: '16px',
                  textAlign: 'center'
                }}>
                  <Body weight="medium" style={{ fontSize: '28px', color: '#895D1A' }}>
                    {aiCount}
                  </Body>
                  <Label style={{ fontSize: '12px', color: '#5C6C75' }}>
                    {aiCount === 1 ? 'field extracted' : 'fields extracted'}
                  </Label>
                </div>

                {/* Before/After for first AI field */}
                {aiLane.fields && aiLane.fields[0] && (
                  <>
                    <div style={{ marginBottom: '12px' }}>
                      <Label style={{ fontSize: '11px', color: '#889397', marginBottom: '6px', display: 'block' }}>
                        RAW INPUT (Field {aiLane.fields[0].source_field})
                      </Label>
                      <div className="bubble-detail-scrollable" style={{
                        background: 'white',
                        border: '1px solid rgba(255, 192, 16, 0.5)',
                        borderRadius: '6px',
                        padding: '12px',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        lineHeight: '1.6',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        maxHeight: '100px',
                        overflow: 'auto'
                      }}>
                        {aiLane.fields[0].input_text}
                      </div>
                    </div>

                    <div style={{
                      textAlign: 'center',
                      margin: '12px 0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}>
                      <div style={{ flex: 1, height: '1px', background: '#FFC010' }} />
                      <Body weight="medium" style={{ color: '#895D1A', fontSize: '11px' }}>
                        GenAI Processing
                      </Body>
                      <div style={{ flex: 1, height: '1px', background: '#FFC010' }} />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <Label style={{ fontSize: '11px', color: '#889397', marginBottom: '6px', display: 'block' }}>
                        STRUCTURED OUTPUT
                      </Label>
                      <div className="bubble-detail-scrollable" style={{
                        background: '#E3FCF7',
                        border: '1px solid rgba(0, 163, 92, 0.3)',
                        borderRadius: '6px',
                        padding: '12px',
                        maxHeight: '120px',
                        overflow: 'auto'
                      }}>
                        <Code language="json">
                          {JSON.stringify(aiLane.fields[0].ai_response, null, 2)}
                        </Code>
                      </div>
                    </div>

                    {/* Confidence Badge - Commented out per request
                    <div style={{
                      padding: '12px',
                      background: 'white',
                      borderRadius: '6px',
                      border: '1px solid #E7EAEE'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <Label style={{ fontSize: '12px', color: '#5C6C75' }}>Extraction Confidence</Label>
                        <Badge variant={aiLane.fields[0].confidence >= 0.8 ? 'green' : aiLane.fields[0].confidence >= 0.6 ? 'yellow' : 'red'}>
                          {(aiLane.fields[0].confidence * 100).toFixed(0)}%
                        </Badge>
                      </div>
                      {aiLane.fields[0].confidence_reason && (
                        <Body style={{ fontSize: '11px', color: '#889397', fontStyle: 'italic' }}>
                          {aiLane.fields[0].confidence_reason}
                        </Body>
                      )}
                    </div>
                    */}
                  </>
                )}
              </div>
            ) : (
              /* Rules Only Placeholder */
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                background: '#F9FBFA',
                borderRadius: '8px',
                border: '1px dashed #E7EAEE',
                minHeight: '200px'
              }}>
                <Icon glyph="Checkmark" size="xlarge" fill="#00A35C" />
                <Body weight="medium" style={{ color: '#5C6C75', marginTop: '12px' }}>
                  Rules Only
                </Body>
                <Body style={{ fontSize: '12px', color: '#889397', textAlign: 'center', marginTop: '8px' }}>
                  All fields processed deterministically.
                  No AI extraction required.
                </Body>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // JSON bubble (2)
  if (bubbleType === '2') {
    const conversionRunId = data?.conversionRunId;

    return (
      <>
        <style jsx global>{`
          .bubble-detail-scrollable::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          .bubble-detail-scrollable::-webkit-scrollbar-track {
            background: transparent;
          }
          .bubble-detail-scrollable::-webkit-scrollbar-thumb {
            background: rgba(136, 147, 151, 0.2);
            border-radius: 4px;
          }
          .bubble-detail-scrollable::-webkit-scrollbar-thumb:hover {
            background: rgba(136, 147, 151, 0.4);
          }
          /* Firefox */
          .bubble-detail-scrollable {
            scrollbar-width: thin;
            scrollbar-color: rgba(136, 147, 151, 0.2) transparent;
          }
        `}</style>
      <div style={{
        background: 'white',
        border: '1px solid #E7EAEE',
        borderRadius: '8px',
        padding: '24px'
      }}>
        <H3 style={{ marginBottom: '16px' }}>
          Intermediate Canonical JSON
        </H3>

        <div style={{
          background: '#F9FBFA',
          borderRadius: '6px',
          padding: '16px',
          border: '1px solid #E7EAEE',
          marginBottom: '16px'
        }}>
          <Label style={{
            fontSize: '12px',
            color: '#889397',
            display: 'block',
            marginBottom: '8px'
          }}>
            Purpose
          </Label>
          <Body style={{ fontSize: '13px', lineHeight: '1.6' }}>
            The canonical JSON format serves as the universal intermediate format that enables
            multi-hop routing. All payment formats map to and from this standardized JSON structure,
            allowing seamless conversion between any source and target formats.
          </Body>
        </div>

        <div style={{
          background: '#F9FBFA',
          borderRadius: '6px',
          padding: '16px',
          border: '1px solid #E7EAEE',
          marginBottom: '16px'
        }}>
          <Label style={{
            fontSize: '12px',
            color: '#889397',
            display: 'block',
            marginBottom: '8px'
          }}>
            Significance
          </Label>
          <Body style={{ fontSize: '13px', lineHeight: '1.6' }}>
            This standardized format includes all payment details: transaction identifiers,
            parties (debtor/creditor), amounts, dates, remittance information, and instructions.
            The Agent may enrich or correct fields (e.g., name transliteration, IFSC lookup) before
            converting to the final target format.
          </Body>
        </div>

        {/* Show loading state */}
        {loading && (
          <div style={{
            background: '#FFF9E6',
            borderRadius: '6px',
            padding: '16px',
            border: '1px solid #FFC010',
            textAlign: 'center'
          }}>
            <Body style={{ fontSize: '13px', color: '#895D1A' }}>
              Loading canonical JSON...
            </Body>
          </div>
        )}

        {/* Show error state */}
        {error && !loading && (
          <div style={{
            background: '#FFE9E6',
            borderRadius: '6px',
            padding: '16px',
            border: '1px solid #CD4246'
          }}>
            <Label style={{ fontSize: '12px', color: '#CD4246', display: 'block', marginBottom: '8px' }}>
              Error
            </Label>
            <Body style={{ fontSize: '13px', color: '#CD4246' }}>
              {error}
            </Body>
          </div>
        )}

        {/* Show canonical JSON if loaded */}
        {canonicalJson && !loading && !error && (
          <div style={{ marginTop: '16px' }}>
            <Label style={{
              fontSize: '12px',
              color: '#889397',
              display: 'block',
              marginBottom: '8px'
            }}>
              Stored Canonical JSON (after Agent corrections)
            </Label>
            <div className="bubble-detail-scrollable" style={{ maxHeight: '500px', overflow: 'auto' }}>
              <Code language="json">
                {JSON.stringify(canonicalJson, null, 2)}
              </Code>
            </div>
          </div>
        )}

        {/* Show placeholder if no conversionRunId */}
        {!conversionRunId && !loading && (
          <div style={{
            background: '#F9FBFA',
            borderRadius: '6px',
            padding: '16px',
            border: '1px solid #E7EAEE',
            textAlign: 'center'
          }}>
            <Body style={{ fontSize: '13px', color: '#889397' }}>
              Run a conversion to view the canonical JSON
            </Body>
          </div>
        )}
      </div>
      </>
    );
  }

  return null;
}
