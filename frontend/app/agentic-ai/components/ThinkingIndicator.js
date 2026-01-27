'use client';

import React from 'react';
import { Body } from '@leafygreen-ui/typography';

/**
 * Get thinking message based on current agent phase
 */
function getThinkingMessage(phase) {
  const messages = {
    'analyzing': 'Analyzing validation issue...',
    'routing': 'Determining best resolution approach...',
    'tool_executing': 'Executing tool...',
    'resolving': 'Generating solution...',
    'executing': 'Applying field update...',
    'processing': 'Processing...',
    'default': 'Agent is thinking...'
  };
  return messages[phase] || messages.default;
}

/**
 * ThinkingIndicator Component
 * Displays an animated indicator when the agent is processing
 *
 * @param {Object} props
 * @param {string} props.phase - Current thinking phase (analyzing, routing, resolving, etc.)
 * @param {boolean} props.isVisible - Whether the indicator should be shown
 */
export default function ThinkingIndicator({ phase = 'default', isVisible = false }) {
  if (!isVisible) return null;

  const message = getThinkingMessage(phase);

  return (
    <div style={{
      padding: '14px 20px',
      background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
      borderTop: '1px solid #93C5FD',
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      {/* Animated dots container */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#3B82F6',
          animation: 'thinkingBounce 1.4s ease-in-out infinite'
        }} />
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#3B82F6',
          animation: 'thinkingBounce 1.4s ease-in-out 0.2s infinite'
        }} />
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#3B82F6',
          animation: 'thinkingBounce 1.4s ease-in-out 0.4s infinite'
        }} />
      </div>

      {/* Message */}
      <Body weight="medium" style={{
        fontSize: '13px',
        color: '#1E40AF',
        letterSpacing: '0.01em'
      }}>
        {message}
      </Body>

      {/* Keyframe animations */}
      <style jsx global>{`
        @keyframes thinkingBounce {
          0%, 80%, 100% {
            transform: scale(0.6);
            opacity: 0.4;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}