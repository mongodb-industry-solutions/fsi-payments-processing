'use client';

import React from 'react';
import { H2, Body } from '@leafygreen-ui/typography';
import Card from '@leafygreen-ui/card';
import Badge from '@leafygreen-ui/badge';
import Icon from '@leafygreen-ui/icon';
import EventItem from './EventItem';
import OutputCard from './OutputCard';

/**
 * Get agent status based on events and streaming state
 */
function getAgentStatus(isStreaming, events, output) {
  if (output) return { label: 'Complete', variant: 'green' };
  if (isStreaming) return { label: 'Processing', variant: 'blue' };
  return { label: 'Ready', variant: 'lightgray' };
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
  const status = getAgentStatus(isStreaming, events, output);
  const hasActivity = events.length > 0 || output;

  // Notify parent when output card has rendered (for journey animation sync)
  // Use a small delay to ensure the DOM has updated and the output card is visible
  React.useEffect(() => {
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
      <div style={{
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
            {events.map((event) => (
              <EventItem
                key={event.id}
                event={event}
                isExpanded={expandedEvents.has(event.id)}
                onToggleExpand={() => onToggleEvent(event.id)}
              />
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
