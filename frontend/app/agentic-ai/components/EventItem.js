'use client';

import React, { useState } from 'react';
import { Body } from '@leafygreen-ui/typography';
import Icon from '@leafygreen-ui/icon';
import Badge from '@leafygreen-ui/badge';
import JSONDiffModal from './JSONDiffModal';

// Use Next.js API routes to proxy to converter sidecar

/**
 * Get icon for event type
 */
function getEventIcon(type) {
  const iconMap = {
    'start': 'Sparkle',
    'hop1_start': 'Refresh',
    'hop2_start': 'Refresh',
    'hop1_complete': 'CheckmarkWithCircle',
    'hop2_complete': 'CheckmarkWithCircle',
    'validation_failed': 'Warning',
    'agent_start': 'Person',
    'agent_supervisor': 'Connect',
    'tool_call': 'Wrench',
    'tool_result': 'CheckmarkWithCircle',
    'agent_resolution': 'Bulb',
    'review_approved': 'CheckmarkWithCircle',
    'review_rejected': 'X',
    'agent_execution': 'Edit',
    'agent_complete': 'CheckmarkWithCircle',
    'complete': 'CheckmarkWithCircle',
    'error': 'X',
    // Crypto/blockchain events
    'crypto_start': 'Cloud',
    'crypto_wallet_extract': 'Folder',
    'crypto_balance_check': 'Charts',
    'crypto_tx_build': 'Code',
    'crypto_tx_sign': 'Key',
    'crypto_tx_submit': 'Upload',
    'crypto_tx_confirm': 'CheckmarkWithCircle',
    'crypto_complete': 'Favorite'
  };
  return iconMap[type] || 'InfoWithCircle';
}

/**
 * Get color for event type
 */
function getEventColor(type) {
  if (type.includes('complete') || type === 'review_approved') return '#00A35C';
  if (type.includes('error') || type.includes('failed') || type === 'review_rejected') return '#CD4246';
  if (type === 'agent_start') return '#7C3AED';  // Purple for agent activation
  if (type.includes('agent')) return '#0B61A4';
  if (type.includes('crypto')) return '#7C3AED';  // Purple for blockchain events
  return '#5C6C75';
}

/**
 * Check if event type needs special banner styling
 */
function getEventBannerStyle(type) {
  if (type === 'agent_start') {
    return {
      background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)',
      border: '1px solid #C4B5FD',
      borderRadius: '8px',
      margin: '8px 12px',
      padding: '12px 16px'
    };
  }
  return null;
}

/**
 * Format event message
 */
function formatEventMessage(event) {
  const { type } = event;

  switch (type) {
    case 'start':
      return `Conversion started (ID: ${event.conversion_run_id?.slice(0, 8) || 'N/A'})`;
    case 'hop1_start':
      return `Hop 1: ${event.source || 'Source'} → ${event.target || 'Target'}`;
    case 'hop1_complete':
      return `Hop 1 complete (${event.time?.toFixed(2) || '0'}s) - ${event.detailed_processing?.extraction?.total_fields || 0} fields extracted`;
    case 'hop2_start':
      return `Hop 2: ${event.source || 'Source'} → ${event.target || 'Target'}`;
    case 'hop2_complete':
      return `Hop 2 complete (${event.time?.toFixed(2) || '0'}s) - ${event.detailed_processing?.extraction?.total_fields || 0} fields mapped`;
    case 'validation_failed':
      // Show a brief but informative summary
      const fieldLabel = event.field === 'creditor_name' ? 'beneficiary name' :
                         event.field === 'creditor_agent_bic' ? 'bank code' : event.field || 'field';
      const countryName = event.country === 'JP' ? 'Japan' :
                          event.country === 'IN' ? 'India' : event.country || 'Country';
      return `${countryName} validation failed: ${fieldLabel} requires conversion`;
    case 'agent_start':
      // Derive task description from problem
      const taskDesc = event.problem ?
        (event.problem.toLowerCase().includes('katakana') ? 'transliteration' :
         event.problem.toLowerCase().includes('ifsc') ? 'IFSC lookup' : 'field correction')
        : 'task';
      return `Agent started: ${taskDesc}`;
    case 'agent_supervisor':
      // Extract just the decision part for the summary
      if (event.reasoning) {
        const decisionMatch = event.reasoning.match(/DECISION:\s*(\S+)/i);
        if (decisionMatch) {
          const decision = decisionMatch[1].replace('ROUTE_TO_', '').toLowerCase();
          return `Supervisor routed to ${decision} agent`;
        }
      }
      return `Supervisor routing: ${event.next_agent || 'evaluating'}`;
    case 'tool_call':
      return `Calling tool: ${event.tool || 'unknown'}`;
    case 'tool_result':
      return `Tool completed: ${event.tool || 'unknown'}`;
    case 'agent_resolution':
      // Try to extract field name from reasoning
      let fieldName = 'field';
      if (event.reasoning) {
        const fieldMatch = event.reasoning.match(/FIELD TO UPDATE:\s*(\w+)/);
        if (fieldMatch) {
          fieldName = fieldMatch[1];
        }
      }
      return `Solution proposed for ${fieldName}`;
    case 'review_approved':
      return event.message || 'Human approved proposed change';
    case 'review_rejected':
      return event.message || 'Human rejected proposed change';
    case 'agent_execution':
      // Show "Added" for new fields, "Updated" for existing fields
      const isNewField = !event.old_value || event.old_value === '';
      return isNewField
        ? `Added new field: ${event.field || 'field'}`
        : `Updated field: ${event.field || 'field'}`;
    case 'agent_complete':
      return `Agent completed: ${event.field || 'field'}`;
    case 'complete':
      return 'Conversion completed successfully';
    case 'error':
      return `Error: ${event.message || 'Unknown error'}`;
    // Crypto/blockchain events - showing canonical JSON integration with Solana
    case 'crypto_start':
      return event.detail || 'Initiating Solana blockchain settlement using canonical JSON fields';
    case 'crypto_wallet_extract':
      return `${event.detail || 'Extracted wallet addresses from canonical JSON'} (${event.sender?.slice(0, 8)}... → ${event.receiver?.slice(0, 8)}...)`;
    case 'crypto_tx_build':
      return event.detail || 'Building Solana transfer instruction with sender, receiver, and amount from canonical JSON';
    case 'crypto_tx_sign':
      return event.detail || 'Signing transaction with sender private key via Solana SDK';
    case 'crypto_tx_submit':
      return event.detail || 'Broadcasting signed transaction to Solana devnet RPC endpoint';
    case 'crypto_tx_confirm':
      return `Transaction confirmed on Solana blockchain (${event.confirmation_time_ms || '?'}ms finality)`;
    case 'crypto_complete':
      return `Blockchain settlement complete: ${event.display_amount || '50000.00'} ${event.display_currency || 'USD'} settled on Solana`;
    default:
      return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
}

/**
 * Format supervisor reasoning text with proper structure
 */
function formatReasoning(reasoning) {
  if (!reasoning) return null;

  // Split into sections (DECISION, REASONING)
  const sections = reasoning.split(/(?=DECISION:|REASONING:)/i);
  
  return sections.map((section, idx) => {
    const trimmed = section.trim();
    if (!trimmed) return null;

    // Check if it's a DECISION section
    if (trimmed.startsWith('DECISION:')) {
      const decision = trimmed.replace(/^DECISION:\s*/i, '').trim();
      return (
        <div key={idx} style={{ marginBottom: '12px' }}>
          <Body weight="bold" style={{ fontSize: '12px', color: '#0B61A4', marginBottom: '4px' }}>
            DECISION
          </Body>
          <Body style={{ fontSize: '12px', color: '#5C6C75', fontWeight: '600' }}>
            {decision}
          </Body>
        </div>
      );
    }
    
    // Check if it's a REASONING section
    if (trimmed.startsWith('REASONING:')) {
      const content = trimmed.replace(/^REASONING:\s*/i, '').trim();
      // Split by numbered points (1., 2., etc.)
      const points = content.split(/(?=\d+\.\s)/).filter(p => p.trim());
      
      return (
        <div key={idx}>
          <Body weight="bold" style={{ fontSize: '12px', color: '#0B61A4', marginBottom: '8px' }}>
            REASONING
          </Body>
          <div style={{ paddingLeft: '8px' }}>
            {points.map((point, pidx) => {
              const trimmedPoint = point.trim();
              if (!trimmedPoint) return null;
              
              // Extract number and text
              const match = trimmedPoint.match(/^(\d+)\.\s*(.*)/s);
              if (match) {
                const [, num, text] = match;
                return (
                  <div key={pidx} style={{ 
                    marginBottom: '10px',
                    display: 'flex',
                    gap: '8px'
                  }}>
                    <Body weight="bold" style={{ 
                      fontSize: '12px', 
                      color: '#00A35C',
                      minWidth: '16px'
                    }}>
                      {num}.
                    </Body>
                    <Body style={{ 
                      fontSize: '12px', 
                      color: '#5C6C75',
                      lineHeight: '1.5'
                    }}>
                      {text.trim()}
                    </Body>
                  </div>
                );
              }
              return (
                <Body key={pidx} style={{ 
                  fontSize: '12px', 
                  color: '#5C6C75', 
                  marginBottom: '8px',
                  lineHeight: '1.5'
                }}>
                  {trimmedPoint}
                </Body>
              );
            })}
          </div>
        </div>
      );
    }
    
    // Default: just display the text
    return (
      <Body key={idx} style={{ 
        fontSize: '12px', 
        color: '#5C6C75',
        marginBottom: '8px',
        lineHeight: '1.5'
      }}>
        {trimmed}
      </Body>
    );
  });
}

/**
 * Render event details (expanded view)
 */
function renderEventDetails(event) {
  const { type } = event;

  switch (type) {
    case 'validation_failed':
      return (
        <div style={{
          marginTop: '8px',
          padding: '12px',
          background: '#FFF8E6',
          borderRadius: '6px',
          fontSize: '12px',
          border: '1px solid #FFC107'
        }}>
          {/* Problem explanation */}
          <div style={{ marginBottom: '12px' }}>
            <Body weight="bold" style={{ fontSize: '12px', color: '#B7791F', marginBottom: '6px' }}>
              PROBLEM DETECTED
            </Body>
            <Body style={{ fontSize: '12px', color: '#5C6C75', lineHeight: '1.5' }}>
              {event.reason || 'Country-specific validation rule violated'}
            </Body>
          </div>

          {/* Original value that failed */}
          {event.original_value && (
            <div style={{ marginBottom: '12px' }}>
              <Body weight="bold" style={{ fontSize: '12px', color: '#B7791F', marginBottom: '6px' }}>
                CURRENT VALUE
              </Body>
              <div style={{
                padding: '8px 12px',
                background: 'white',
                borderRadius: '4px',
                border: '1px solid #E7EAEE'
              }}>
                <Body style={{ fontSize: '12px', color: '#CD4246', fontFamily: 'monospace' }}>
                  {event.original_value}
                </Body>
              </div>
            </div>
          )}

          {/* What will happen next */}
          <div>
            <Body weight="bold" style={{ fontSize: '12px', color: '#B7791F', marginBottom: '6px' }}>
              NEXT STEP
            </Body>
            <Body style={{ fontSize: '12px', color: '#5C6C75', lineHeight: '1.5' }}>
              {event.problem?.toLowerCase().includes('katakana') || event.problem?.toLowerCase().includes('japanese')
                ? 'Transaction Agent will transliterate the name to Japanese Katakana script using official transliteration rules.'
                : event.problem?.toLowerCase().includes('ifsc') || event.problem?.toLowerCase().includes('india')
                ? 'Transaction Agent will look up the correct IFSC code from India\'s banking database using the bank name and branch information.'
                : 'Transaction Agent will resolve this validation issue automatically.'}
            </Body>
          </div>
        </div>
      );

    case 'agent_supervisor':
      return (
        <div style={{
          marginTop: '8px',
          padding: '12px',
          background: '#F9FBFA',
          borderRadius: '6px',
          fontSize: '12px'
        }}>
          {event.reasoning && (
            <div style={{ marginBottom: event.next_agent ? '12px' : '0' }}>
              {formatReasoning(event.reasoning)}
            </div>
          )}
          {event.next_agent && (
            <div>
              <Body weight="medium" style={{ fontSize: '12px', marginBottom: '4px' }}>Next Agent:</Body>
              <Badge variant="blue">{event.next_agent}</Badge>
            </div>
          )}
        </div>
      );

    case 'tool_call':
      return (
        <div style={{
          marginTop: '8px',
          padding: '12px',
          background: '#F9FBFA',
          borderRadius: '6px',
          fontSize: '12px'
        }}>
          {event.reasoning && (
            <div style={{ marginBottom: '12px' }}>
              <Body weight="bold" style={{ fontSize: '12px', color: '#0B61A4', marginBottom: '6px' }}>
                AGENT REASONING
              </Body>
              <Body style={{ fontSize: '12px', color: '#5C6C75', lineHeight: '1.5' }}>
                {event.reasoning}
              </Body>
            </div>
          )}
          <Body weight="medium" style={{ fontSize: '12px' }}>Arguments:</Body>
          <pre style={{
            marginTop: '4px',
            padding: '8px',
            background: 'white',
            borderRadius: '4px',
            fontSize: '11px',
            overflow: 'auto',
            maxHeight: '200px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {JSON.stringify(event.args || {}, null, 2)}
          </pre>
        </div>
      );

    case 'tool_result':
      return (
        <div style={{
          marginTop: '8px',
          padding: '12px',
          background: '#F9FBFA',
          borderRadius: '6px',
          fontSize: '12px'
        }}>
          <Body weight="medium" style={{ fontSize: '12px' }}>Result:</Body>
          <pre style={{
            marginTop: '4px',
            padding: '8px',
            background: 'white',
            borderRadius: '4px',
            fontSize: '11px',
            overflow: 'auto',
            maxHeight: '200px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {JSON.stringify(event.result || {}, null, 2)}
          </pre>
        </div>
      );

    case 'agent_resolution':
      return (
        <div style={{
          marginTop: '8px',
          padding: '12px',
          background: '#F9FBFA',
          borderRadius: '6px',
          fontSize: '12px'
        }}>
          {event.proposed_value && (
            <div style={{ marginBottom: '12px' }}>
              <Body weight="bold" style={{ fontSize: '12px', color: '#0B61A4', marginBottom: '4px' }}>
                PROPOSED VALUE
              </Body>
              <Body style={{ fontSize: '12px', color: '#00A35C', fontWeight: '600' }}>{event.proposed_value}</Body>
            </div>
          )}
          {event.confidence && (
            <div style={{ marginBottom: '12px' }}>
              <Body weight="bold" style={{ fontSize: '12px', color: '#0B61A4', marginBottom: '4px' }}>
                CONFIDENCE
              </Body>
              <Body style={{ fontSize: '12px', color: '#5C6C75', fontWeight: '600' }}>{(event.confidence * 100).toFixed(0)}%</Body>
            </div>
          )}
          {event.reasoning && (
            <div>
              <Body weight="bold" style={{ fontSize: '12px', color: '#0B61A4', marginBottom: '8px' }}>
                REASONING
              </Body>
              <div style={{ paddingLeft: '8px' }}>
                {/* Parse and format reasoning text */}
                {(() => {
                  const lines = event.reasoning.split('\n');
                  return lines.map((line, idx) => {
                    const trimmed = line.trim();
                    if (!trimmed) return null;
                    
                    // Handle bullet points
                    if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
                      const text = trimmed.replace(/^[-•]\s*/, '');
                      return (
                        <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                          <Body style={{ fontSize: '12px', color: '#00A35C', minWidth: '8px' }}>•</Body>
                          <Body style={{ fontSize: '12px', color: '#5C6C75', lineHeight: '1.5' }}>{text}</Body>
                        </div>
                      );
                    }
                    
                    // Regular text
                    return (
                      <Body key={idx} style={{ fontSize: '12px', color: '#5C6C75', marginBottom: '8px', lineHeight: '1.5' }}>
                        {trimmed}
                      </Body>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>
      );

    case 'agent_execution':
      return (
        <div style={{
          marginTop: '8px',
          padding: '12px',
          background: '#F9FBFA',
          borderRadius: '6px',
          fontSize: '12px'
        }}>
          <div style={{ marginBottom: '8px' }}>
            <Body weight="medium" style={{ fontSize: '12px' }}>Field:</Body>
            <Body style={{ fontSize: '12px', color: '#5C6C75' }}>{event.field || 'unknown'}</Body>
          </div>
          {event.old_value && (
            <div style={{ marginBottom: '8px' }}>
              <Body weight="medium" style={{ fontSize: '12px' }}>Old Value:</Body>
              <Body style={{ fontSize: '12px', color: '#CD4246' }}>{event.old_value}</Body>
            </div>
          )}
          {event.new_value && (
            <div>
              <Body weight="medium" style={{ fontSize: '12px' }}>New Value:</Body>
              <Body style={{ fontSize: '12px', color: '#00A35C' }}>{event.new_value}</Body>
            </div>
          )}
        </div>
      );

    case 'hop1_complete':
    case 'hop2_complete':
      const dp = event.detailed_processing || {};
      const rulesLane = dp.rules_lane || {};
      const aiLane = dp.ai_lane || {};

      // Extract crypto fields if present
      const allFields = rulesLane.fields || [];
      const cryptoFields = allFields.filter(f =>
        f.source_field?.includes('crypto') ||
        f.target_field?.includes('crypto') ||
        f.source_field?.includes('wallet')
      );
      const hasCryptoFields = cryptoFields.length > 0;
      const hasRulesFields = rulesLane.total_fields > 0;
      const hasAiFields = aiLane.total_fields > 0 && aiLane.fields;
      const hasAnyContent = hasCryptoFields || hasRulesFields || hasAiFields;

      return (
        <div style={{
          marginTop: '8px',
          padding: '12px',
          background: '#F9FBFA',
          borderRadius: '6px',
          fontSize: '12px'
        }}>
          {/* Rules Lane Summary */}
          {hasRulesFields && !hasCryptoFields && (
            <div style={{ marginBottom: hasAiFields ? '12px' : '0' }}>
              <Body weight="bold" style={{ fontSize: '12px', color: '#00A35C', marginBottom: '8px' }}>
                RULES LANE
              </Body>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                gap: '4px 12px',
                background: 'white',
                padding: '10px',
                borderRadius: '4px'
              }}>
                <Body style={{ fontSize: '11px', color: '#889397' }}>Fields mapped:</Body>
                <Body style={{ fontSize: '11px', color: '#1F2937' }}>{rulesLane.total_fields}</Body>
                <Body style={{ fontSize: '11px', color: '#889397' }}>Processing:</Body>
                <Body style={{ fontSize: '11px', color: '#1F2937' }}>Deterministic regex extraction</Body>
              </div>
            </div>
          )}

          {/* Crypto Fields Section - Show first if present */}
          {hasCryptoFields && (
            <div style={{
              marginBottom: '16px',
              padding: '12px',
              background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)',
              borderRadius: '6px',
              border: '1px solid #C4B5FD'
            }}>
              <Body weight="bold" style={{ fontSize: '12px', color: '#7C3AED', marginBottom: '10px' }}>
                🔗 BLOCKCHAIN SETTLEMENT FIELDS EXTRACTED
              </Body>
              <div style={{ background: 'white', borderRadius: '4px', padding: '10px' }}>
                {cryptoFields.map((field, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '8px 0',
                    borderBottom: idx < cryptoFields.length - 1 ? '1px solid #E7EAEE' : 'none'
                  }}>
                    <Body weight="medium" style={{ fontSize: '11px', color: '#7C3AED', marginBottom: '4px' }}>
                      {field.source_field}
                    </Body>
                    <Body style={{ fontSize: '12px', color: '#1F2937', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                      {field.input_value?.toString() || 'N/A'}
                    </Body>
                  </div>
                ))}
              </div>
              <Body style={{ fontSize: '10px', color: '#7C3AED', marginTop: '8px', fontStyle: 'italic' }}>
                These fields enable Solana blockchain settlement
              </Body>
            </div>
          )}

          {/* AI Lane Details (if any) */}
          {hasAiFields && (
            <div style={{ marginBottom: '12px' }}>
              <Body weight="bold" style={{ fontSize: '12px', color: '#0B61A4', marginBottom: '8px' }}>
                AI EXTRACTION
              </Body>
              {aiLane.fields.map((field, idx) => (
                <div key={idx} style={{
                  padding: '8px',
                  background: 'white',
                  borderRadius: '4px',
                  marginBottom: '8px'
                }}>
                  <Body weight="medium" style={{ fontSize: '11px', color: '#5C6C75' }}>
                    {field.source_field} → {field.field_type}
                  </Body>
                  {field.ai_response && (
                    <pre style={{
                      marginTop: '4px',
                      fontSize: '10px',
                      color: '#00A35C',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      overflow: 'hidden'
                    }}>
                      {JSON.stringify(field.ai_response, null, 2)}
                    </pre>
                  )}
                  <Body style={{ fontSize: '10px', color: '#889397', marginTop: '4px' }}>
                    Confidence: {((field.confidence || 0) * 100).toFixed(0)}%
                  </Body>
                </div>
              ))}
            </div>
          )}

          {/* Fallback when no detailed content */}
          {!hasAnyContent && (
            <Body style={{ fontSize: '11px', color: '#889397', fontStyle: 'italic' }}>
              All fields processed via rules lane (deterministic mapping)
            </Body>
          )}

        </div>
      );

    // Crypto/blockchain events with dropdown details
    case 'crypto_start':
    case 'crypto_wallet_extract':
    case 'crypto_tx_build':
    case 'crypto_tx_sign':
    case 'crypto_tx_submit':
    case 'crypto_tx_confirm':
    case 'crypto_complete':
      if (event.dropdown) {
        return (
          <div style={{
            marginTop: '8px',
            padding: '12px',
            background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)',
            borderRadius: '6px',
            fontSize: '12px',
            border: '1px solid #C4B5FD'
          }}>
            <Body weight="bold" style={{ fontSize: '12px', color: '#7C3AED', marginBottom: '10px' }}>
              {event.dropdown.title}
            </Body>
            <div style={{ paddingLeft: '8px' }}>
              {event.dropdown.items?.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                  <Body style={{ fontSize: '11px', color: '#7C3AED', minWidth: '8px' }}>•</Body>
                  <Body style={{ fontSize: '11px', color: '#5C6C75', lineHeight: '1.4', fontFamily: item.includes(':') ? 'monospace' : 'inherit' }}>
                    {item}
                  </Body>
                </div>
              ))}
            </div>
            {event.explorer_url && (
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #C4B5FD' }}>
                <a
                  href={event.explorer_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '11px', color: '#7C3AED', textDecoration: 'underline' }}
                >
                  View on Solana Explorer →
                </a>
              </div>
            )}
          </div>
        );
      }
      return null;

    default:
      // Generic dropdown rendering for any event with dropdown data
      if (event.dropdown) {
        return (
          <div style={{
            marginTop: '8px',
            padding: '12px',
            background: '#F9FBFA',
            borderRadius: '6px',
            fontSize: '12px'
          }}>
            <Body weight="bold" style={{ fontSize: '12px', color: '#5C6C75', marginBottom: '8px' }}>
              {event.dropdown.title}
            </Body>
            <div style={{ paddingLeft: '8px' }}>
              {event.dropdown.items?.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                  <Body style={{ fontSize: '11px', color: '#00A35C', minWidth: '8px' }}>•</Body>
                  <Body style={{ fontSize: '11px', color: '#5C6C75', lineHeight: '1.4' }}>{item}</Body>
                </div>
              ))}
            </div>
          </div>
        );
      }
      return null;
  }
}

/**
 * Check if event can be expanded
 */
function isExpandable(event) {
  const expandableTypes = [
    'validation_failed',
    'agent_supervisor',
    'tool_call',
    'tool_result',
    'agent_resolution',
    'agent_execution',
    'hop1_complete',
    'hop2_complete',
    // Crypto events with dropdown details
    'crypto_start',
    'crypto_wallet_extract',
    'crypto_tx_build',
    'crypto_tx_sign',
    'crypto_tx_submit',
    'crypto_tx_confirm',
    'crypto_complete'
  ];
  // Also check if event has dropdown data
  return expandableTypes.includes(event.type) || event.dropdown;
}

/**
 * EventItem Component
 * Displays a single streaming event with optional expand/collapse
 *
 * @param {Object} props
 * @param {Object} props.event - Event object with type, data, timestamp, id
 * @param {boolean} props.isExpanded - Whether event is expanded
 * @param {Function} props.onToggleExpand - Callback to toggle expansion
 */
export default function EventItem({ event, isExpanded, onToggleExpand }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [jsonDiffData, setJsonDiffData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const icon = getEventIcon(event.type);
  const color = getEventColor(event.type);
  const message = formatEventMessage(event);
  const details = renderEventDetails(event);
  const canExpand = isExpandable(event);
  const bannerStyle = getEventBannerStyle(event.type);
  const isAgentStart = event.type === 'agent_start';
  
  // Show code button only for agent_execution events with conversion_run_id
  const showCodeButton = event.type === 'agent_execution' && event.conversion_run_id;
  
  // Fetch JSON diff from API
  const handleFetchJSONDiff = async (e) => {
    e.stopPropagation();
    
    if (!event.conversion_run_id) {
      setError('No conversion run ID available');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/canonical-json/${event.conversion_run_id}/diff`
      );
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Canonical JSON document not found or no changes recorded');
        }
        throw new Error(`Failed to fetch JSON diff: ${response.statusText}`);
      }
      
      const data = await response.json();
      setJsonDiffData(data);
      setIsModalOpen(true);
      
    } catch (err) {
      console.error('Error fetching JSON diff:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={bannerStyle ? {
        ...bannerStyle,
        cursor: canExpand ? 'pointer' : 'default',
        transition: 'all 0.15s ease',
        overflow: 'hidden'
      } : {
        padding: '12px 16px',
        borderBottom: '1px solid #E7EAEE',
        cursor: canExpand ? 'pointer' : 'default',
        transition: 'background 0.15s ease',
        background: isExpanded ? '#F9FBFA' : 'transparent',
        overflow: 'hidden'
      }}
      onClick={canExpand ? onToggleExpand : undefined}
      onMouseEnter={(e) => {
        if (canExpand && !bannerStyle) e.currentTarget.style.background = '#F9FBFA';
      }}
      onMouseLeave={(e) => {
        if (canExpand && !isExpanded && !bannerStyle) e.currentTarget.style.background = 'transparent';
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px'
      }}>
        {/* Icon */}
        <div style={{
          marginTop: '2px',
          ...(isAgentStart && {
            background: '#7C3AED',
            borderRadius: '50%',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          })
        }}>
          <Icon glyph={icon} fill={isAgentStart ? 'white' : color} size="small" />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '4px',
            gap: '8px'
          }}>
            <div style={{ flex: 1 }}>
              {isAgentStart && (
                <Body style={{ fontSize: '10px', color: '#7C3AED', fontWeight: '600', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Agent Activated
                </Body>
              )}
              <Body weight="medium" style={{ fontSize: '13px', color: isAgentStart ? '#5B21B6' : 'inherit' }}>
                {message}
              </Body>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {showCodeButton && (
                <button
                  onClick={handleFetchJSONDiff}
                  disabled={isLoading}
                  style={{
                    border: '1px solid #E7EAEE',
                    background: 'white',
                    borderRadius: '4px',
                    padding: '4px 6px',
                    cursor: isLoading ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'all 0.15s ease',
                    opacity: isLoading ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoading) {
                      e.currentTarget.style.background = '#F9FBFA';
                      e.currentTarget.style.borderColor = '#0B61A4';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isLoading) {
                      e.currentTarget.style.background = 'white';
                      e.currentTarget.style.borderColor = '#E7EAEE';
                    }
                  }}
                  title="View canonical JSON changes"
                >
                  <Icon glyph="Code" fill={isLoading ? "#889397" : "#0B61A4"} size="small" />
                </button>
              )}
              {canExpand && (
                <Icon
                  glyph={isExpanded ? 'ChevronUp' : 'ChevronDown'}
                  size="small"
                  fill="#889397"
                />
              )}
            </div>
          </div>

          {/* Timestamp */}
          <Body style={{ fontSize: '11px', color: '#889397' }}>
            {new Date(event.timestamp).toLocaleTimeString()}
          </Body>

          {/* Expanded Details */}
          {isExpanded && details}
          
          {/* Error Message */}
          {error && (
            <div style={{
              marginTop: '8px',
              padding: '8px 12px',
              background: '#FFEBEE',
              border: '1px solid #EF5350',
              borderRadius: '4px'
            }}>
              <Body style={{ fontSize: '11px', color: '#C62828' }}>
                {error}
              </Body>
            </div>
          )}
        </div>
      </div>
      
      {/* JSON Diff Modal */}
      {jsonDiffData && (
        <JSONDiffModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          beforeJSON={jsonDiffData.before_json}
          afterJSON={jsonDiffData.after_json}
          changedFields={jsonDiffData.changed_fields}
        />
      )}
    </div>
  );
}
