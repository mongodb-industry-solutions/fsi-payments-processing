'use client';

import React from 'react';
import { Body } from '@leafygreen-ui/typography';
import Icon from '@leafygreen-ui/icon';
import Badge from '@leafygreen-ui/badge';

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
      return `Solution proposed for ${event.field || 'field'}`;
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
          {/* Parse structured sections from reasoning */}
          {event.reasoning && (() => {
            const sections = [];
            const lines = event.reasoning.split('\n').filter(line => line.trim());
            
            let currentSection = null;
            let currentContent = [];
            
            lines.forEach((line) => {
              const trimmed = line.trim();
              
              // Check for field/value pairs
              if (trimmed.startsWith('FIELD TO UPDATE:')) {
                if (currentSection) {
                  sections.push({ type: currentSection, content: currentContent.join('\n') });
                }
                const field = trimmed.replace('FIELD TO UPDATE:', '').trim();
                sections.push({ type: 'FIELD', content: field });
                currentSection = null;
                currentContent = [];
              } else if (trimmed.startsWith('NEW VALUE:')) {
                const value = trimmed.replace('NEW VALUE:', '').trim();
                sections.push({ type: 'VALUE', content: value });
              } else if (trimmed.startsWith('REASON:')) {
                currentSection = 'REASON';
                const reasonText = trimmed.replace('REASON:', '').trim();
                if (reasonText) currentContent.push(reasonText);
              } else if (currentSection) {
                currentContent.push(trimmed);
              }
            });
            
            if (currentSection && currentContent.length) {
              sections.push({ type: currentSection, content: currentContent.join('\n') });
            }
            
            return sections.map((section, idx) => {
              if (section.type === 'FIELD') {
                return (
                  <div key={idx} style={{ marginBottom: '12px' }}>
                    <Body weight="bold" style={{ fontSize: '12px', color: '#0B61A4', marginBottom: '4px' }}>
                      FIELD TO UPDATE
                    </Body>
                    <Body style={{ fontSize: '12px', color: '#5C6C75', fontWeight: '600' }}>
                      {section.content}
                    </Body>
                  </div>
                );
              } else if (section.type === 'VALUE') {
                return (
                  <div key={idx} style={{ marginBottom: '12px' }}>
                    <Body weight="bold" style={{ fontSize: '12px', color: '#0B61A4', marginBottom: '4px' }}>
                      NEW VALUE
                    </Body>
                    <Body style={{ fontSize: '12px', color: '#00A35C', fontWeight: '600' }}>
                      {section.content}
                    </Body>
                  </div>
                );
              } else if (section.type === 'REASON') {
                // Split bullet points
                const bullets = section.content.split(/(?=[-•])/);
                return (
                  <div key={idx}>
                    <Body weight="bold" style={{ fontSize: '12px', color: '#0B61A4', marginBottom: '8px' }}>
                      REASON
                    </Body>
                    <div style={{ paddingLeft: '8px' }}>
                      {bullets.map((bullet, bidx) => {
                        const cleaned = bullet.replace(/^[-•]\s*/, '').trim();
                        if (!cleaned) return null;
                        return (
                          <div key={bidx} style={{ 
                            marginBottom: '8px',
                            display: 'flex',
                            gap: '8px'
                          }}>
                            <Body style={{ 
                              fontSize: '12px', 
                              color: '#00A35C',
                              minWidth: '8px'
                            }}>
                              •
                            </Body>
                            <Body style={{ 
                              fontSize: '12px', 
                              color: '#5C6C75',
                              lineHeight: '1.5'
                            }}>
                              {cleaned}
                            </Body>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }
              return null;
            });
          })()}
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
  const icon = getEventIcon(event.type);
  const color = getEventColor(event.type);
  const message = formatEventMessage(event);
  const details = renderEventDetails(event);
  const canExpand = isExpandable(event);

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
            marginBottom: '4px'
          }}>
            <Body weight="medium" style={{ fontSize: '13px' }}>
              {message}
            </Body>
            {canExpand && (
              <Icon
                glyph={isExpanded ? 'ChevronUp' : 'ChevronDown'}
                size="small"
                fill="#889397"
              />
            )}
          </div>

          {/* Timestamp */}
          <Body style={{ fontSize: '11px', color: '#889397' }}>
            {new Date(event.timestamp).toLocaleTimeString()}
          </Body>

          {/* Expanded Details */}
          {isExpanded && details}
        </div>
      </div>
    </div>
  );
}
