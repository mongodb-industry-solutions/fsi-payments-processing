'use client';

import React, { useState } from 'react';
import { Body } from '@leafygreen-ui/typography';
import Icon from '@leafygreen-ui/icon';
import Badge from '@leafygreen-ui/badge';
import JSONDiffModal from './JSONDiffModal';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001';

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
    'agent_execution': 'Edit',
    'agent_complete': 'CheckmarkWithCircle',
    'complete': 'CheckmarkWithCircle',
    'error': 'X'
  };
  return iconMap[type] || 'InfoWithCircle';
}

/**
 * Get color for event type
 */
function getEventColor(type) {
  if (type.includes('complete')) return '#00A35C';
  if (type.includes('error') || type.includes('failed')) return '#CD4246';
  if (type.includes('agent')) return '#0B61A4';
  return '#5C6C75';
}

/**
 * Format event message
 */
function formatEventMessage(event) {
  const { type } = event;

  switch (type) {
    case 'start':
      return 'Conversion initiated';
    case 'hop1_start':
      return `Converting ${event.source || 'source'} → ${event.target || 'target'}`;
    case 'hop1_complete':
      return `First conversion completed in ${event.time || '0'}s`;
    case 'hop2_start':
      return `Converting ${event.source || 'source'} → ${event.target || 'target'}`;
    case 'hop2_complete':
      return `Second conversion completed in ${event.time || '0'}s`;
    case 'validation_failed':
      return `Validation failed: ${event.country || 'unknown'} - ${event.field || 'field'}`;
    case 'agent_start':
      return `Agent started: ${event.task_type || 'task'}`;
    case 'agent_supervisor':
      // Extract just the decision part for the summary
      if (event.reasoning) {
        const decisionMatch = event.reasoning.match(/DECISION:\s*(\S+)/i);
        if (decisionMatch) {
          const decision = decisionMatch[1].replace('ROUTE_TO_', '').toLowerCase();
          return `Supervisor routed task '${event.task_type || 'unknown'}' to ${decision} agent`;
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
    case 'agent_execution':
      return `Updated field: ${event.field || 'field'}`;
    case 'agent_complete':
      return `Agent completed: ${event.field || 'field'}`;
    case 'complete':
      return 'Conversion completed successfully';
    case 'error':
      return `Error: ${event.message || 'Unknown error'}`;
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
          <Body weight="medium" style={{ fontSize: '12px' }}>Arguments:</Body>
          <pre style={{
            marginTop: '4px',
            padding: '8px',
            background: 'white',
            borderRadius: '4px',
            fontSize: '11px',
            overflow: 'auto',
            maxHeight: '200px'
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
            maxHeight: '200px'
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

    default:
      return null;
  }
}

/**
 * Check if event can be expanded
 */
function isExpandable(event) {
  const expandableTypes = [
    'agent_supervisor',
    'tool_call',
    'tool_result',
    'agent_resolution',
    'agent_execution'
  ];
  return expandableTypes.includes(event.type);
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
        `${BACKEND_URL}/api/v1/canonical-json/${event.conversion_run_id}/diff`
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
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid #E7EAEE',
        cursor: canExpand ? 'pointer' : 'default',
        transition: 'background 0.15s ease',
        background: isExpanded ? '#F9FBFA' : 'transparent'
      }}
      onClick={canExpand ? onToggleExpand : undefined}
      onMouseEnter={(e) => {
        if (canExpand) e.currentTarget.style.background = '#F9FBFA';
      }}
      onMouseLeave={(e) => {
        if (canExpand && !isExpanded) e.currentTarget.style.background = 'transparent';
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px'
      }}>
        {/* Icon */}
        <div style={{ marginTop: '2px' }}>
          <Icon glyph={icon} fill={color} size="small" />
        </div>

        {/* Content */}
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '4px',
            gap: '8px'
          }}>
            <Body weight="medium" style={{ fontSize: '13px', flex: 1 }}>
              {message}
            </Body>
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
