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
            <div style={{ marginBottom: '8px' }}>
              <Body weight="medium" style={{ fontSize: '12px' }}>Reasoning:</Body>
              <Body style={{ fontSize: '12px', color: '#5C6C75' }}>{event.reasoning}</Body>
            </div>
          )}
          {event.next_agent && (
            <div>
              <Body weight="medium" style={{ fontSize: '12px' }}>Next Agent:</Body>
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
            <div style={{ marginBottom: '8px' }}>
              <Body weight="medium" style={{ fontSize: '12px' }}>Proposed Value:</Body>
              <Body style={{ fontSize: '12px', color: '#5C6C75' }}>{event.proposed_value}</Body>
            </div>
          )}
          {event.confidence && (
            <div style={{ marginBottom: '8px' }}>
              <Body weight="medium" style={{ fontSize: '12px' }}>Confidence:</Body>
              <Body style={{ fontSize: '12px', color: '#5C6C75' }}>{(event.confidence * 100).toFixed(0)}%</Body>
            </div>
          )}
          {event.reasoning && (
            <div>
              <Body weight="medium" style={{ fontSize: '12px' }}>Reasoning:</Body>
              <Body style={{ fontSize: '12px', color: '#5C6C75' }}>{event.reasoning}</Body>
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
