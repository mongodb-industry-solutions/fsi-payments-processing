'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { H2, Body } from '@leafygreen-ui/typography';
import Card from '@leafygreen-ui/card';
import Badge from '@leafygreen-ui/badge';
import Icon from '@leafygreen-ui/icon';
import EventItem from './EventItem';
import OutputCard from './OutputCard';
import ThinkingIndicator from './ThinkingIndicator';

/**
 * Get agent status based on streaming state and output
 */
function getAgentStatus(isStreaming, output) {
  if (output) return { label: 'Complete', variant: 'green' };
  if (isStreaming) return { label: 'Processing', variant: 'blue' };
  return { label: 'Ready', variant: 'lightgray' };
}

/**
 * Determine if agent is currently "thinking" and what phase
 * Returns { isThinking: boolean, phase: string }
 */
function getAgentThinkingState(events, isStreaming, output) {
  // Not thinking if not streaming or already complete
  if (!isStreaming || output) {
    return { isThinking: false, phase: null };
  }

  // No events yet - not in agent mode
  if (events.length === 0) {
    return { isThinking: false, phase: null };
  }

  const lastEvent = events[events.length - 1];
  const lastEventType = lastEvent?.type;

  // Terminal events - definitely not thinking
  const terminalEvents = [
    'complete',
    'agent_complete',
    'error'
  ];

  if (terminalEvents.includes(lastEventType)) {
    return { isThinking: false, phase: null };
  }

  // Events waiting for human input - not thinking
  const waitingEvents = [
    'review_required',
    'ai_review_required',
    'agent_resolution'
  ];

  if (waitingEvents.includes(lastEventType)) {
    return { isThinking: false, phase: null };
  }

  // Check if we're in an agent flow (any agent_ event has occurred)
  const hasAgentStarted = events.some(e => e.type?.startsWith('agent_'));
  const hasAgentCompleted = events.some(e => e.type === 'agent_complete');

  // If agent started but hasn't completed, show thinking
  if (hasAgentStarted && !hasAgentCompleted) {
    // Determine phase based on last event
    const phaseMap = {
      'validation_failed': 'analyzing',
      'agent_start': 'analyzing',
      'agent_supervisor': 'routing',
      'tool_call': 'tool_executing',
      'tool_result': 'resolving',
      'review_approved': 'executing',
      'agent_execution_start': 'executing',
      'agent_execution': 'executing'
    };

    const phase = phaseMap[lastEventType] || 'processing';
    return { isThinking: true, phase };
  }

  return { isThinking: false, phase: null };
}

/**
 * TransactionAgentPanel Component
 * Displays real-time streaming events and final output in a unified panel
 *
 * @param {Object} props
 * @param {Array} props.events - Array of streaming events
 * @param {string} props.output - Final conversion output (when complete)
 * @param {Object} props.stats - Processing statistics
 * @param {number} props.totalTime - Total processing time
 * @param {string} props.targetFormat - Target format name
 * @param {boolean} props.isStreaming - Whether conversion is in progress
 * @param {Set} props.expandedEvents - Set of expanded event IDs
 * @param {Function} props.onToggleEvent - Callback to toggle event expansion
 * @param {Function} props.onOutputRendered - Callback when output card has rendered (for animation sync)
 */
export default function TransactionAgentPanel({
  events,
  output,
  stats,
  totalTime,
  targetFormat,
  isStreaming,
  expandedEvents,
  onToggleEvent,
  onOutputRendered
}) {
  const status = getAgentStatus(isStreaming, output);
  const hasActivity = events.length > 0 || output;

  // Calculate thinking state based on events
  const thinkingState = useMemo(
    () => getAgentThinkingState(events, isStreaming, output),
    [events, isStreaming, output]
  );

  // Track visible thinking state with minimum display duration
  const [visibleThinking, setVisibleThinking] = useState({ isThinking: false, phase: null });
  const thinkingTimerRef = useRef(null);
  const MIN_THINKING_DISPLAY_MS = 800; // Minimum time to show thinking indicator

  useEffect(() => {
    if (thinkingState.isThinking) {
      // Show immediately when thinking starts
      setVisibleThinking(thinkingState);
      // Clear any pending hide timer
      if (thinkingTimerRef.current) {
        clearTimeout(thinkingTimerRef.current);
        thinkingTimerRef.current = null;
      }
    } else if (visibleThinking.isThinking) {
      // Delay hiding to ensure minimum display time
      thinkingTimerRef.current = setTimeout(() => {
        setVisibleThinking({ isThinking: false, phase: null });
        thinkingTimerRef.current = null;
      }, MIN_THINKING_DISPLAY_MS);
    }

    return () => {
      if (thinkingTimerRef.current) {
        clearTimeout(thinkingTimerRef.current);
      }
    };
  }, [thinkingState.isThinking, thinkingState.phase, events]);

  // Reset thinking state when streaming stops or output appears
  useEffect(() => {
    if (!isStreaming || output) {
      setVisibleThinking({ isThinking: false, phase: null });
      if (thinkingTimerRef.current) {
        clearTimeout(thinkingTimerRef.current);
        thinkingTimerRef.current = null;
      }
    }
  }, [isStreaming, output]);

  // Auto-scroll refs
  const scrollContainerRef = useRef(null);
  const lastEventRef = useRef(null);

  // Simple auto-scroll: scroll to latest event when events change
  // Skip if output exists - the output scroll effect handles that case
  useEffect(() => {
    if (events.length > 0 && lastEventRef.current && scrollContainerRef.current && !output) {
      // Small delay to ensure DOM has updated
      const timer = setTimeout(() => {
        lastEventRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [events.length, output]);

  // Scroll to output when it appears
  useEffect(() => {
    if (output && scrollContainerRef.current) {
      const timer = setTimeout(() => {
        scrollContainerRef.current.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [output]);

  // Notify parent when output card has rendered (for journey animation sync)
  // Use a small delay to ensure the DOM has updated and the output card is visible
  useEffect(() => {
    if (output && onOutputRendered) {
      // Small delay to ensure the output card has mounted and rendered
      const timer = setTimeout(() => {
        onOutputRendered();
      }, 150); // 150ms allows React to complete rendering
      return () => clearTimeout(timer);
    }
  }, [output, onOutputRendered]);

  return (
    <Card
      style={{
        padding: '0',
        height: 'calc(100vh - 280px)',
        minHeight: '420px',
        maxHeight: '850px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        border: '1px solid #E7EAEE'
      }}
    >
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid #E7EAEE',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#F9FBFA'
      }}>
        <H2>Transaction Logs</H2>
        <Badge variant={status.variant}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            {isStreaming && (
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#0B61A4',
                  animation: 'pulse 2s infinite'
                }}
              />
            )}
            {status.label}
          </div>
        </Badge>
      </div>

      {/* Content */}
      <div
        ref={scrollContainerRef}
        style={{
          flex: 1,
          overflow: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(0, 0, 0, 0.2) transparent',
          display: 'flex',
          alignItems: hasActivity ? 'flex-start' : 'center',
          justifyContent: 'center'
        }}
        className="custom-scrollbar"
      >
        {!hasActivity ? (
          // Empty State
          <div style={{
            textAlign: 'center',
            padding: '48px 40px',
            background: 'linear-gradient(180deg, #FFFFFF 0%, #F9FBFA 100%)',
            borderRadius: '12px'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px auto'
            }}>
              <Icon glyph="ActivityFeed" size="xlarge" fill="#00A35C" />
            </div>
            <Body weight="medium" style={{ fontSize: '18px', color: '#1C2D38', marginBottom: '8px' }}>
              Ready to Process
            </Body>
            <Body style={{ fontSize: '14px', color: '#5C6C75', textAlign: 'center', maxWidth: '280px', lineHeight: '1.5' }}>
              Select a payment scenario and click "Simulate Transaction" to see the processing logs
            </Body>
          </div>
        ) : (
          // Events Stream
          <div style={{ width: '100%' }}>
            {events.map((event, index) => (
              <div
                key={event.id}
                ref={index === events.length - 1 ? lastEventRef : null}
              >
                <EventItem
                  event={event}
                  isExpanded={expandedEvents.has(event.id)}
                  onToggleExpand={() => onToggleEvent(event.id)}
                />
              </div>
            ))}

            {/* Output Card (appears at the end when complete) */}
            {output && (
              <div style={{ padding: '16px' }}>
                <OutputCard
                  output={output}
                  stats={stats}
                  totalTime={totalTime}
                  targetFormat={targetFormat}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Thinking Indicator - Fixed at bottom of panel, outside scroll area */}
      <ThinkingIndicator
        isVisible={visibleThinking.isThinking}
        phase={visibleThinking.phase}
      />

      {/* Animations and Custom Scrollbar Styles */}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }

        /* Custom scrollbar for webkit browsers */
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 4px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.3);
        }
      `}</style>
    </Card>
  );
}
