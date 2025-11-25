'use client';

import React, { useState, useEffect } from 'react';
import { H3, Body, Label } from '@leafygreen-ui/typography';
import Code from '@leafygreen-ui/code';
import Badge from '@leafygreen-ui/badge';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001';

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
          `${BACKEND_URL}/api/v1/canonical-json/${conversionRunId}/diff`
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

  // Conversion bubbles (A, B)
  if (bubbleType === 'A' || bubbleType === 'B') {
    const hopNumber = data.hop || (bubbleType === 'A' ? 1 : 2);
    const detailed = data.detailed || {};

    // Debug logging
    console.log('🔍 BubbleDetailPanel - Bubble Type:', bubbleType);
    console.log('🔍 BubbleDetailPanel - Data:', data);
    console.log('🔍 BubbleDetailPanel - Detailed:', detailed);

    // Get detailed processing data from backend
    const extraction = detailed.extraction || {};
    const rulesLane = detailed.rules_lane || {};
    const aiLane = detailed.ai_lane || {};
    const configuration = detailed.configuration || {};

    // Calculate lane distribution from detailed data
    const rulesCount = rulesLane.total_fields || 0;
    const aiCount = aiLane.total_fields || 0;
    const humanCount = 0; // Not yet implemented
    const totalFields = rulesCount + aiCount + humanCount;

    const rulesPercent = totalFields > 0 ? ((rulesCount / totalFields) * 100).toFixed(1) : 0;
    const aiPercent = totalFields > 0 ? ((aiCount / totalFields) * 100).toFixed(1) : 0;
    const humanPercent = totalFields > 0 ? ((humanCount / totalFields) * 100).toFixed(1) : 0;

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
          Hop {hopNumber} Conversion Details
        </H3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px',
          marginBottom: '24px'
        }}>
          {/* Conversion ID */}
          <div>
            <Label style={{
              fontSize: '12px',
              color: '#889397',
              display: 'block',
              marginBottom: '8px'
            }}>
              Conversion ID
            </Label>
            <Body weight="medium" style={{ fontSize: '14px' }}>
              {data.conversionId}
            </Body>
          </div>

          {/* Processing Time */}
          <div>
            <Label style={{
              fontSize: '12px',
              color: '#889397',
              display: 'block',
              marginBottom: '8px'
            }}>
              Processing Time
            </Label>
            <Body weight="medium" style={{ fontSize: '14px' }}>
              {data.time ? `${data.time.toFixed(2)}s` : 'N/A'}
            </Body>
          </div>
        </div>

        {/* Lane Distribution */}
        {totalFields > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <Label style={{
              fontSize: '12px',
              color: '#889397',
              display: 'block',
              marginBottom: '12px'
            }}>
              Processing Lane Distribution
            </Label>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <Badge variant="blue">
                RULES: {rulesPercent}%
              </Badge>
              <Badge variant="yellow">
                AI: {aiPercent}%
              </Badge>
              {humanCount > 0 && (
                <Badge variant="red">
                  HUMAN: {humanPercent}%
                </Badge>
              )}
            </div>

            {/* Visual Bar */}
            <div style={{
              width: '100%',
              height: '24px',
              background: '#F9FBFA',
              borderRadius: '4px',
              overflow: 'hidden',
              display: 'flex',
              border: '1px solid #E7EAEE'
            }}>
              {rulesCount > 0 && (
                <div style={{
                  width: `${rulesPercent}%`,
                  background: '#0B61A4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  color: 'white',
                  fontWeight: '600'
                }}>
                  {rulesCount}
                </div>
              )}
              {aiCount > 0 && (
                <div style={{
                  width: `${aiPercent}%`,
                  background: '#FFC010',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  color: '#1C2D38',
                  fontWeight: '600'
                }}>
                  {aiCount}
                </div>
              )}
              {humanCount > 0 && (
                <div style={{
                  width: `${humanPercent}%`,
                  background: '#CD4246',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  color: 'white',
                  fontWeight: '600'
                }}>
                  {humanCount}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Extraction Details */}
        {extraction.fields && extraction.fields.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <H3 style={{ fontSize: '16px', marginBottom: '12px' }}>
              📥 Field Extraction ({extraction.total_fields} fields)
            </H3>
            <div
              className="bubble-detail-scrollable"
              style={{
              background: '#F9FBFA',
              borderRadius: '6px',
              padding: '16px',
              border: '1px solid #E7EAEE',
              maxHeight: '300px',
              overflow: 'auto'
            }}>
              <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #E7EAEE' }}>
                    <th style={{ textAlign: 'left', padding: '8px', fontWeight: '600' }}>Field ID</th>
                    <th style={{ textAlign: 'left', padding: '8px', fontWeight: '600' }}>Value</th>
                    <th style={{ textAlign: 'left', padding: '8px', fontWeight: '600' }}>Pattern</th>
                  </tr>
                </thead>
                <tbody>
                  {extraction.fields.map((field, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #E7EAEE' }}>
                      <td style={{ padding: '8px', fontWeight: '600', color: '#0B61A4' }}>
                        {field.field_id}
                      </td>
                      <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '12px' }}>
                        {field.value || <span style={{ color: '#889397' }}>(empty)</span>}
                      </td>
                      <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '11px', color: '#5C6C75' }}>
                        {field.pattern}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Rules Lane Details */}
        {rulesLane.fields && rulesLane.fields.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <H3 style={{ fontSize: '16px', marginBottom: '12px' }}>
              ⚙️ Rules Lane Processing ({rulesLane.total_fields} fields)
            </H3>
            <div
              className="bubble-detail-scrollable"
              style={{
              background: '#F9FBFA',
              borderRadius: '6px',
              padding: '16px',
              border: '1px solid #E7EAEE',
              maxHeight: '300px',
              overflow: 'auto'
            }}>
              <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #E7EAEE' }}>
                    <th style={{ textAlign: 'left', padding: '8px', fontWeight: '600' }}>Source</th>
                    <th style={{ textAlign: 'left', padding: '8px', fontWeight: '600' }}>Target</th>
                    <th style={{ textAlign: 'left', padding: '8px', fontWeight: '600' }}>Input</th>
                    <th style={{ textAlign: 'left', padding: '8px', fontWeight: '600' }}>Output</th>
                  </tr>
                </thead>
                <tbody>
                  {rulesLane.fields.map((field, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #E7EAEE' }}>
                      <td style={{ padding: '8px', fontWeight: '600', color: '#0B61A4' }}>
                        {field.source_field || <span style={{ color: '#889397' }}>-</span>}
                      </td>
                      <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '11px' }}>
                        {Array.isArray(field.target_field) ? field.target_field.join(', ') : field.target_field}
                      </td>
                      <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '11px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {field.input_value || <span style={{ color: '#889397' }}>-</span>}
                      </td>
                      <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '11px' }}>
                        {field.output_value && Object.keys(field.output_value).length > 0
                          ? Object.entries(field.output_value).map(([k, v]) => `${k}: ${v}`).join(', ')
                          : <span style={{ color: '#889397' }}>-</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AI Lane Details */}
        {aiLane.fields && aiLane.fields.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <H3 style={{ fontSize: '16px', marginBottom: '12px' }}>
              🤖 AI Lane Processing ({aiLane.total_fields} fields)
            </H3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {aiLane.fields.map((field, idx) => (
                <div key={idx} style={{
                  background: '#FFF9E6',
                  borderRadius: '6px',
                  padding: '16px',
                  border: '1px solid #FFC010'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <Label style={{ fontSize: '13px', fontWeight: '600', color: '#1C2D38' }}>
                      Field {field.source_field} → {field.target_field}
                    </Label>
                    <Badge variant={field.confidence >= 0.8 ? 'green' : field.confidence >= 0.6 ? 'yellow' : 'red'}>
                      {(field.confidence * 100).toFixed(0)}% confidence
                    </Badge>
                  </div>

                  <div style={{ marginBottom: '8px' }}>
                    <Label style={{ fontSize: '11px', color: '#5C6C75', display: 'block', marginBottom: '4px' }}>
                      Input Text:
                    </Label>
                    <Body style={{ fontSize: '12px', fontFamily: 'monospace', background: 'white', padding: '8px', borderRadius: '4px' }}>
                      {field.input_text}
                    </Body>
                  </div>

                  <div style={{ marginBottom: '8px' }}>
                    <Label style={{ fontSize: '11px', color: '#5C6C75', display: 'block', marginBottom: '4px' }}>
                      AI Response:
                    </Label>
                    <Body style={{ fontSize: '12px', fontFamily: 'monospace', background: 'white', padding: '8px', borderRadius: '4px' }}>
                      {JSON.stringify(field.ai_response, null, 2)}
                    </Body>
                  </div>

                  {field.confidence_reason && (
                    <Label style={{ fontSize: '11px', color: '#895D1A', fontStyle: 'italic' }}>
                      {field.confidence_reason}
                    </Label>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* View Configuration Button */}
        {configuration && Object.keys(configuration).length > 0 && (
          <div style={{
            background: '#F9FBFA',
            borderRadius: '6px',
            padding: '16px',
            border: '1px solid #E7EAEE'
          }}>
            <Label style={{
              fontSize: '12px',
              color: '#889397',
              display: 'block',
              marginBottom: '8px'
            }}>
              MongoDB Configuration
            </Label>
            <details>
              <summary style={{
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px',
                padding: '8px',
                background: 'white',
                borderRadius: '4px',
                border: '1px solid #E7EAEE'
              }}>
                View Full Configuration (ID: {configuration._id})
              </summary>
              <div
                className="bubble-detail-scrollable"
                style={{
                marginTop: '12px',
                maxHeight: '400px',
                overflow: 'auto'
              }}>
                <Code language="json">
                  {JSON.stringify(configuration, null, 2)}
                </Code>
              </div>
            </details>
          </div>
        )}
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
