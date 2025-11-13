'use client';

import { useState } from 'react';
import { Body, H1, H2, Subtitle } from '@leafygreen-ui/typography';
import Button from '@leafygreen-ui/button';
import { Select, Option } from '@leafygreen-ui/select';
import TextInput from '@leafygreen-ui/text-input';
import TextArea from '@leafygreen-ui/text-area';
import Card from '@leafygreen-ui/card';
import Badge from '@leafygreen-ui/badge';
import Icon from '@leafygreen-ui/icon';
import Banner from '@leafygreen-ui/banner';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001';

export default function AgenticAIPage() {
  const [sourceFormat, setSourceFormat] = useState('MT103');
  const [targetFormat, setTargetFormat] = useState('pacs.008');
  const [message, setMessage] = useState('');
  const [events, setEvents] = useState([]);
  const [output, setOutput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [expandedEvents, setExpandedEvents] = useState(new Set());

  const formatOptions = ['MT103', 'MT202', 'pacs.008', 'pacs.009', 'JSON'];

  const sampleMessages = {
    MT103_Japan: `{1:F01UBSWCHZH80A0000000000}{2:I103CHASUS33XXXXN}{4:
:20:JP-TEST-001
:23B:CRED
:32A:241215JPY500000000
:50K:/CH9300762011623852957
Swiss Tech Solutions AG
Geneva Switzerland
:57A:BOTKJPJT
:59:/JP1234567890
Sony Corporation
Tokyo Japan
:70:Software licensing payment Q4 2024
:71A:SHA
-}`,
    MT103_India: `{1:F01UBSWCHZH80A0000000000}{2:I103HDFCINBBXXX}{4:
:20:IN-TEST-STREAM-001
:23B:CRED
:32A:241215INR5000000
:50K:/CH9300762011623852957
Swiss Pharma International AG
Zurich Switzerland
:57A:HDFCINBB
:59:/IN1234567890
Tata Consultancy Services
Mumbai India
:70:IT consulting services November 2024
:71A:SHA
-}`
  };

  const loadSample = (sampleKey) => {
    setSourceFormat('MT103');
    setMessage(sampleMessages[sampleKey] || '');
  };

  const addEvent = (eventData) => {
    const timestamp = new Date().toLocaleTimeString();
    const id = `event-${Date.now()}-${Math.random()}`;
    setEvents(prev => [...prev, { ...eventData, timestamp, id }]);
  };

  const toggleEventExpansion = (eventId) => {
    setExpandedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  const handleConvert = async () => {
    if (!message.trim()) {
      setError('Please enter a message to convert');
      return;
    }

    setIsStreaming(true);
    setEvents([]);
    setOutput('');
    setError(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/convert/multi-hop/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_format: sourceFormat,
          target_format: targetFormat,
          message: message
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Backend error:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.substring(6));
              addEvent(eventData);

              // Handle complete event
              if (eventData.type === 'complete') {
                setOutput(eventData.output);
              }

              // Handle error event
              if (eventData.type === 'error') {
                setError(eventData.message);
              }
            } catch (e) {
              console.warn('Failed to parse SSE event:', line, e);
            }
          }
        }
      }
    } catch (err) {
      console.error('Streaming error:', err);
      setError(err.message);
    } finally {
      setIsStreaming(false);
    }
  };

  const getEventIcon = (type) => {
    switch(type) {
      case 'start': return 'Sparkle';
      case 'hop1_start': case 'hop2_start': return 'Refresh';
      case 'hop1_complete': case 'hop2_complete': return 'CheckmarkWithCircle';
      case 'validation_failed': return 'Warning';
      case 'agent_start': return 'Person';
      case 'agent_supervisor': return 'Connect';
      case 'agent_resolution': return 'Bulb';
      case 'agent_execution': return 'Edit';
      case 'agent_complete': return 'CheckmarkWithCircle';
      case 'complete': return 'CheckmarkWithCircle';
      case 'error': return 'X';
      default: return 'InfoWithCircle';
    }
  };

  const getEventColor = (type) => {
    if (type.includes('complete')) return 'green';
    if (type.includes('failed') || type === 'error') return 'red';
    if (type.includes('agent')) return 'blue';
    return 'gray';
  };

  const formatEventMessage = (event) => {
    switch(event.type) {
      case 'start':
        return 'Starting conversion...';
      case 'hop1_start':
        return `Hop 1: ${event.source} → ${event.target}`;
      case 'hop1_complete':
        return `✓ Hop 1 complete (${event.time}s)`;
      case 'hop2_start':
        return `Hop 2: ${event.source} → ${event.target}`;
      case 'hop2_complete':
        return `✓ Hop 2 complete (${event.time}s)`;
      case 'validation_failed':
        return `Country validation failed: ${event.country} - ${event.task_type}`;
      case 'agent_start':
        return `Agent starting: ${event.task_type} for field ${event.field}`;
      case 'agent_supervisor':
        return `Supervisor: Routing to ${event.next_agent || 'next agent'}`;
      case 'tool_call':
        return `Tool call: ${event.tool}`;
      case 'tool_result':
        return `Tool result: ${event.tool}`;
      case 'agent_resolution':
        if (event.status === 'complete') {
          return `Resolution: Proposed value (${Math.round((event.confidence || 0) * 100)}% confidence)`;
        }
        return 'Agent: Resolution processing...';
      case 'agent_execution':
        return `Execution: Updated ${event.field}`;
      case 'agent_complete':
        return `✓ Agent complete: ${event.field} → ${event.new_value}`;
      case 'complete':
        return `✓ Conversion complete! (${event.total_time}s)`;
      case 'error':
        return `✗ Error: ${event.message}`;
      default:
        return JSON.stringify(event);
    }
  };

  const renderEventDetails = (event) => {
    const details = event.details || {};

    switch(event.type) {
      case 'agent_supervisor':
        return event.reasoning && (
          <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#f5f5f5', borderRadius: '4px', fontSize: '0.8rem' }}>
            <Body weight="medium" style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>Reasoning:</Body>
            <Body style={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>{event.reasoning}</Body>
            {event.next_agent && (
              <Body style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                <strong>Next Agent:</strong> {event.next_agent}
              </Body>
            )}
          </div>
        );

      case 'tool_call':
        return (
          <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#f5f5f5', borderRadius: '4px', fontSize: '0.8rem' }}>
            <Body weight="medium" style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>Arguments:</Body>
            <pre style={{ fontSize: '0.7rem', margin: 0, whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(event.args || event.details, null, 2)}
            </pre>
          </div>
        );

      case 'tool_result':
        return (
          <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#f5f5f5', borderRadius: '4px', fontSize: '0.8rem' }}>
            <Body weight="medium" style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>Result:</Body>
            <pre style={{ fontSize: '0.7rem', margin: 0, whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(event.result || event.details, null, 2)}
            </pre>
          </div>
        );

      case 'agent_resolution':
        if (event.status === 'complete') {
          return (
            <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#f5f5f5', borderRadius: '4px', fontSize: '0.8rem' }}>
              <Body weight="medium" style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>Solution:</Body>
              <Body style={{ fontSize: '0.75rem' }}>
                <strong>Proposed Value:</strong> {event.proposed_value}
              </Body>
              <Body style={{ fontSize: '0.75rem' }}>
                <strong>Confidence:</strong> {Math.round((event.confidence || 0) * 100)}%
              </Body>
              {event.reasoning && (
                <div style={{ marginTop: '0.5rem' }}>
                  <Body weight="medium" style={{ fontSize: '0.8rem' }}>Reasoning:</Body>
                  <Body style={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>{event.reasoning}</Body>
                </div>
              )}
            </div>
          );
        }
        return null;

      case 'agent_execution':
        return event.details && (
          <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#f5f5f5', borderRadius: '4px', fontSize: '0.8rem' }}>
            <Body style={{ fontSize: '0.75rem' }}>
              <strong>Field:</strong> {details.field_name}
            </Body>
            <Body style={{ fontSize: '0.75rem' }}>
              <strong>Old Value:</strong> {details.old_value || '(empty)'}
            </Body>
            <Body style={{ fontSize: '0.75rem' }}>
              <strong>New Value:</strong> {details.new_value}
            </Body>
            {details.reasoning && (
              <div style={{ marginTop: '0.5rem' }}>
                <Body weight="medium" style={{ fontSize: '0.8rem' }}>Reasoning:</Body>
                <Body style={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>{details.reasoning}</Body>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <H1>Agentic AI Payment Converter</H1>
        <Subtitle>Real-time streaming conversion with agent corrections</Subtitle>
      </div>

      {error && (
        <Banner variant="danger" style={{ marginBottom: '1rem' }}>
          {error}
        </Banner>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Left Column: Input */}
        <Card>
          <H2>Conversion Input</H2>

          <div style={{ marginBottom: '1rem' }}>
            <Select
              label="Source Format"
              value={sourceFormat}
              onChange={setSourceFormat}
              disabled={isStreaming}
            >
              {formatOptions.map(format => (
                <Option key={format} value={format}>{format}</Option>
              ))}
            </Select>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <Select
              label="Target Format"
              value={targetFormat}
              onChange={setTargetFormat}
              disabled={isStreaming}
            >
              {formatOptions.map(format => (
                <Option key={format} value={format}>{format}</Option>
              ))}
            </Select>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <TextArea
              label="Message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter payment message..."
              rows={12}
              disabled={isStreaming}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <Button
              variant="primaryOutline"
              size="small"
              onClick={() => loadSample('MT103_Japan')}
              disabled={isStreaming}
            >
              Load MT103 Sample (Japan)
            </Button>
            <Button
              variant="primaryOutline"
              size="small"
              onClick={() => loadSample('MT103_India')}
              disabled={isStreaming}
            >
              Load MT103 Sample (India)
            </Button>
          </div>

          <Button
            variant="primary"
            onClick={handleConvert}
            disabled={isStreaming || !message.trim()}
            style={{ width: '100%' }}
          >
            {isStreaming ? 'Converting...' : 'Convert with Streaming'}
          </Button>
        </Card>

        {/* Right Column: Events & Output */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Events */}
          <Card style={{ flex: 1 }}>
            <H2>Streaming Events</H2>
            <div style={{
              maxHeight: '400px',
              overflowY: 'auto',
              border: '1px solid #e0e0e0',
              borderRadius: '4px',
              padding: '0.5rem',
              backgroundColor: '#f9f9f9'
            }}>
              {events.length === 0 ? (
                <Body>No events yet. Click "Convert with Streaming" to start.</Body>
              ) : (
                events.map((event, idx) => {
                  const isExpanded = expandedEvents.has(event.id);
                  const hasDetails = renderEventDetails(event) !== null;

                  return (
                    <div key={idx}>
                      <div
                        onClick={() => hasDetails && toggleEventExpansion(event.id)}
                        style={{
                          padding: '0.5rem',
                          marginBottom: '0.25rem',
                          backgroundColor: 'white',
                          borderRadius: '4px',
                          borderLeft: `4px solid ${getEventColor(event.type) === 'green' ? '#13aa52' : getEventColor(event.type) === 'red' ? '#ce0930' : getEventColor(event.type) === 'blue' ? '#016bf8' : '#889397'}`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          cursor: hasDetails ? 'pointer' : 'default',
                          transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => hasDetails && (e.currentTarget.style.backgroundColor = '#f5f5f5')}
                        onMouseLeave={(e) => hasDetails && (e.currentTarget.style.backgroundColor = 'white')}
                      >
                        {hasDetails && (
                          <span style={{ fontSize: '0.75rem', color: '#889397', width: '12px' }}>
                            {isExpanded ? '▼' : '▶'}
                          </span>
                        )}
                        <Icon glyph={getEventIcon(event.type)} size="small" />
                        <div style={{ flex: 1 }}>
                          <Body style={{ fontSize: '0.875rem', margin: 0 }}>
                            {formatEventMessage(event)}
                          </Body>
                          <Body style={{ fontSize: '0.75rem', color: '#889397', margin: 0 }}>
                            {event.timestamp}
                          </Body>
                        </div>
                      </div>
                      {isExpanded && hasDetails && (
                        <div style={{
                          marginLeft: '2rem',
                          marginBottom: '0.5rem',
                          animation: 'fadeIn 0.2s ease-in'
                        }}>
                          {renderEventDetails(event)}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          {/* Output */}
          <Card>
            <H2>Output</H2>
            {output ? (
              <pre style={{
                backgroundColor: '#f9f9f9',
                padding: '1rem',
                borderRadius: '4px',
                overflow: 'auto',
                maxHeight: '400px',
                fontSize: '0.875rem'
              }}>
                {output}
              </pre>
            ) : (
              <Body>Output will appear here after conversion completes.</Body>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
