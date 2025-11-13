'use client';

import React from 'react';
import { H2, Body } from '@leafygreen-ui/typography';
import Card from '@leafygreen-ui/card';
import Badge from '@leafygreen-ui/badge';
import EventItem from './EventItem';
import OutputCard from './OutputCard';

/**
 * Get agent status based on events and streaming state
 */
function getAgentStatus(isStreaming, events, output) {
  if (output) return { label: 'Complete', variant: 'green' };
  if (isStreaming) return { label: 'Processing', variant: 'blue' };
  return { label: 'Idle', variant: 'lightgray' };
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
 */
export default function TransactionAgentPanel({
  events,
  output,
  stats,
  totalTime,
  targetFormat,
  isStreaming,
  expandedEvents,
  onToggleEvent
}) {
  const status = getAgentStatus(isStreaming, events, output);
  const hasActivity = events.length > 0 || output;

  return (
    <Card
      style={{
        padding: '0',
        height: '600px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
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
        <H2>Transaction Agent</H2>
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
        scrollbarColor: 'rgba(0, 0, 0, 0.2) transparent'
      }}
      className="custom-scrollbar"
      >
        {!hasActivity ? (
          // Empty State
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px',
            padding: '40px'
          }}>
            <div style={{
              width: '120px',
              height: '120px',
              marginBottom: '24px',
              opacity: 0.3
            }}>
              <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Simple robot illustration */}
                <circle cx="100" cy="80" r="60" fill="#00A35C" opacity="0.2" />
                <rect x="70" y="50" width="60" height="60" rx="10" fill="#00A35C" opacity="0.3" />
                <circle cx="85" cy="70" r="8" fill="#00A35C" />
                <circle cx="115" cy="70" r="8" fill="#00A35C" />
                <rect x="85" y="90" width="30" height="4" rx="2" fill="#00A35C" />
                <rect x="60" y="120" width="80" height="40" rx="8" fill="#00A35C" opacity="0.2" />
                <circle cx="100" cy="180" r="15" fill="#1C2D38" opacity="0.2" />
              </svg>
            </div>
            <Body weight="medium" style={{ fontSize: '16px', color: '#5C6C75', marginBottom: '8px' }}>
              Agent Ready
            </Body>
            <Body style={{ fontSize: '14px', color: '#889397', textAlign: 'center' }}>
              Select a scenario and click "Simulate Transaction" to begin
            </Body>
          </div>
        ) : (
          // Events Stream
          <div>
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
