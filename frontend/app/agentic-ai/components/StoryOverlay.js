'use client';

import React, { useState, useEffect, useRef } from 'react';

/**
 * StoryCard Component
 * Individual story card with entrance/exit animations
 */
function StoryCard({ step, position, totalSteps, currentIndex, onPrev, onNext, canGoPrev, canGoNext }) {
  if (!step) return null;

  // Position styles with compact spacing from edges
  const positionStyles = {
    'top-left': { top: '16px', left: '16px' },
    'top-right': { top: '16px', right: '16px' },
    'bottom-left': { bottom: '16px', left: '16px' },
    'bottom-right': { bottom: '16px', right: '16px' },
    'bottom-center': { bottom: '16px', left: '50%', transform: 'translateX(-50%)' }
  };

  const iconMap = {
    'start': '🚀',
    'problem': '⚠️',
    'analysis': '🔍',
    'agent': '🤖',
    'solution': '✨',
    'complete': '✅',
    'info': 'ℹ️',
    'bank': '🏦',
    'globe': '🌍',
    'document': '📄',
    'transform': '🔄',
    'check': '✓',
    'error': '❌',
    'money': '💰',
    'japan': '🇯🇵',
    'germany': '🇩🇪',
    'translate': '🔤',
    'katakana': 'カ',
    'india': '🇮🇳',
    'usa': '🇺🇸',
    'search': '🔍',
    'canada': '🇨🇦',
    'singapore': '🇸🇬',
    'brain': '🧠',
    'uk': '🇬🇧',
    'shield': '🛡️',
    'chain': '⛓️',
    'mexico': '🇲🇽',
    'wallet': '👛',
    'sign': '✍️',
    'broadcast': '📡',
    'card': '💳',
    'australia': '🇦🇺'
  };

  const isBottomCenter = position === 'bottom-center';

  return (
    <div
      style={{
        position: 'absolute',
        ...positionStyles[position || 'bottom-center'],
        zIndex: 100,
        // Compact width that scales well at 100% zoom
        width: 'min(260px, 22vw)',
        maxWidth: 'calc(100% - 32px)',
        // Professional animation: 200ms is snappy yet smooth
        animation: isBottomCenter ? 'storyCardEnterCenter 0.2s ease-out forwards' : 'storyCardEnter 0.2s ease-out forwards'
      }}
    >
      {/* Card container with glassmorphism (frosted glass effect) */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.82)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.10), 0 1px 4px rgba(0, 0, 0, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.5)',
          overflow: 'hidden'
        }}
      >
        {/* Colored accent bar - 3px for visual prominence */}
        <div
          style={{
            height: '3px',
            background: step.color || '#00A35C',
          }}
        />

        {/* Content with compact padding */}
        <div style={{ padding: '10px 12px' }}>
          {/* Header row with proper alignment */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              marginBottom: '6px'
            }}
          >
            {/* Icon container - compact 26px */}
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '7px',
                background: 'rgba(255, 255, 255, 0.6)',
                border: `1px solid ${step.color ? `${step.color}30` : 'rgba(0, 163, 92, 0.2)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                flexShrink: 0
              }}
            >
              {iconMap[step.icon] || step.icon || '📋'}
            </div>

            {/* Title - 12px semibold for hierarchy */}
            <div
              style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#1C2D38',
                lineHeight: '1.4',
                flex: 1,
                paddingTop: '3px'
              }}
            >
              {step.title}
            </div>
          </div>

          {/* Description - 11px compact */}
          <div
            style={{
              fontSize: '11px',
              color: '#5C6C75',
              lineHeight: '1.45',
              marginLeft: '34px'
            }}
          >
            {step.description}
          </div>

          {/* Optional highlight box with frosted glass styling */}
          {step.highlight && (
            <div
              style={{
                marginTop: '8px',
                marginLeft: '34px',
                padding: '5px 8px',
                background: 'rgba(255, 255, 255, 0.5)',
                borderRadius: '6px',
                borderLeft: `2px solid ${step.color || '#00A35C'}`,
                fontSize: '10px',
                color: '#1C2D38',
                fontWeight: '500',
                lineHeight: '1.35',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
              }}
            >
              {step.highlight}
            </div>
          )}

          {/* Navigation footer with frosted glass separator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '10px',
              paddingTop: '8px',
              borderTop: '1px solid rgba(255, 255, 255, 0.5)'
            }}
          >
            {/* Previous button - compact 24px */}
            <button
              onClick={onPrev}
              disabled={!canGoPrev}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                border: 'none',
                background: canGoPrev ? 'rgba(255, 255, 255, 0.6)' : 'transparent',
                borderRadius: '6px',
                cursor: canGoPrev ? 'pointer' : 'default',
                color: canGoPrev ? '#1C2D38' : '#C1C7CD',
                fontSize: '11px',
                transition: 'all 0.15s ease',
                pointerEvents: 'auto'
              }}
              aria-label="Previous step"
            >
              ←
            </button>

            {/* Step indicator - pill style for current, dots for others */}
            <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === currentIndex ? '12px' : '4px',
                    height: '4px',
                    borderRadius: '2px',
                    background: i === currentIndex
                      ? (step.color || '#00A35C')
                      : (i < currentIndex ? `${step.color || '#00A35C'}60` : '#E0E2E5'),
                    transition: 'all 0.2s ease'
                  }}
                />
              ))}
            </div>

            {/* Next button - compact 24px */}
            <button
              onClick={onNext}
              disabled={!canGoNext}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                border: 'none',
                background: canGoNext ? 'rgba(255, 255, 255, 0.6)' : 'transparent',
                borderRadius: '6px',
                cursor: canGoNext ? 'pointer' : 'default',
                color: canGoNext ? '#1C2D38' : '#C1C7CD',
                fontSize: '11px',
                transition: 'all 0.15s ease',
                pointerEvents: 'auto'
              }}
              aria-label="Next step"
            >
              →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * StoryOverlay Component
 * Displays sequential story cards synced with transaction events
 * Cards persist and can be navigated with back/forward arrows
 * Position is calculated relative to country locations on the map
 *
 * KEY DESIGN: Story cards advance IMMEDIATELY when events arrive.
 * Event timing is controlled by page.js event queue throttling (400ms/1000ms).
 * No independent timing here - we trust the event queue for pacing.
 */
export default function StoryOverlay({
  story = [],
  isActive = false,
  isStreaming = false,
  events = []
}) {
  const [triggeredSteps, setTriggeredSteps] = useState([]); // Steps that have been triggered (in order)
  const [currentViewIndex, setCurrentViewIndex] = useState(0); // Which step user is viewing
  const [autoAdvance, setAutoAdvance] = useState(true); // Whether to auto-advance to new steps
  const triggeredStepsRef = useRef(new Set()); // Track which triggers have fired

  // Helper to reset all state
  const resetState = () => {
    setTriggeredSteps([]);
    setCurrentViewIndex(0);
    setAutoAdvance(true);
    triggeredStepsRef.current = new Set();
  };

  // Reset when scenario changes (story array reference changes)
  const storyRef = useRef(story);
  useEffect(() => {
    if (story !== storyRef.current) {
      storyRef.current = story;
      resetState();
    }
  }, [story]);

  // Reset when isActive becomes false
  useEffect(() => {
    if (!isActive) {
      resetState();
    }
  }, [isActive]);

  // Reset when streaming starts fresh
  useEffect(() => {
    if (isStreaming && events.length === 0) {
      resetState();
    }
  }, [isStreaming, events.length]);

  // Process events and trigger story steps
  // NOTE: We process based on events array content, NOT isStreaming status.
  // Events are throttled in page.js and continue arriving after SSE stream ends.
  // The triggeredStepsRef prevents duplicates, so it's safe to run on every event change.
  useEffect(() => {
    if (!isActive || story.length === 0) return;
    if (events.length === 0) return; // Nothing to process

    const eventTypes = new Set(events.map(e => e.type));

    // Collect ALL new steps that should be triggered in this render cycle
    // Using a single atomic setState prevents React batching issues
    const newStepsToAdd = [];

    // Check each story step's trigger condition
    story.forEach((step, index) => {
      const triggerId = `${step.trigger}-${index}`;

      // Skip if already triggered
      if (triggeredStepsRef.current.has(triggerId)) return;

      let shouldTrigger = false;

      switch (step.trigger) {
        case 'start':
          shouldTrigger = events.length >= 1;
          break;
        case 'hop1_start':
          shouldTrigger = eventTypes.has('hop1_start');
          break;
        case 'hop1_complete':
          shouldTrigger = eventTypes.has('hop1_complete');
          break;
        case 'hop2_start':
          shouldTrigger = eventTypes.has('hop2_start');
          break;
        case 'hop2_complete':
          shouldTrigger = eventTypes.has('hop2_complete');
          break;
        case 'validation_failed':
          shouldTrigger = eventTypes.has('validation_failed');
          break;
        case 'agent_start':
          shouldTrigger = eventTypes.has('agent_start');
          break;
        case 'agent_supervisor':
          shouldTrigger = eventTypes.has('agent_supervisor');
          break;
        case 'tool_call':
          shouldTrigger = eventTypes.has('tool_call');
          break;
        case 'agent_complete':
          // Backend sends 'agent_complete' for auto-approved resolutions
          // or 'agent_execution' for human-in-the-loop approved resolutions
          shouldTrigger = eventTypes.has('agent_complete') || eventTypes.has('agent_execution');
          break;
        case 'crypto_start':
          shouldTrigger = eventTypes.has('crypto_start');
          break;
        case 'crypto_wallet_extract':
          shouldTrigger = eventTypes.has('crypto_wallet_extract');
          break;
        case 'crypto_tx_build':
          shouldTrigger = eventTypes.has('crypto_tx_build');
          break;
        case 'crypto_tx_sign':
          shouldTrigger = eventTypes.has('crypto_tx_sign');
          break;
        case 'crypto_tx_submit':
          shouldTrigger = eventTypes.has('crypto_tx_submit');
          break;
        case 'crypto_tx_confirm':
          shouldTrigger = eventTypes.has('crypto_tx_confirm');
          break;
        case 'crypto_complete':
          shouldTrigger = eventTypes.has('crypto_complete');
          break;
        case 'complete':
          shouldTrigger = eventTypes.has('complete');
          break;
        default:
          break;
      }

      if (shouldTrigger) {
        // Mark as triggered in ref (synchronous)
        triggeredStepsRef.current.add(triggerId);
        // Collect for batch addition
        newStepsToAdd.push({ ...step, index, triggerId });
      }
    });

    // Single atomic state update with ALL new steps
    // This prevents React batching from dropping steps
    if (newStepsToAdd.length > 0) {
      setTriggeredSteps(prev => [...prev, ...newStepsToAdd]);
    }
  }, [isActive, story, events]);

  // Auto-advance to latest step when new steps are added
  // Separate useEffect avoids React batching issues with nested setState calls
  useEffect(() => {
    if (autoAdvance && triggeredSteps.length > 0) {
      setCurrentViewIndex(triggeredSteps.length - 1);
    }
  }, [triggeredSteps.length, autoAdvance]);

  // Navigation handlers - simplified, no timing logic needed
  const handlePrev = () => {
    setAutoAdvance(false); // User manually navigated, stop auto-advance
    setCurrentViewIndex(prev => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentViewIndex(prev => {
      const next = Math.min(triggeredSteps.length - 1, prev + 1);
      // Re-enable auto-advance if we're at the latest step
      if (next === triggeredSteps.length - 1) {
        setAutoAdvance(true);
      }
      return next;
    });
  };

  if (!isActive || story.length === 0 || triggeredSteps.length === 0) {
    return null;
  }

  const currentStep = triggeredSteps[currentViewIndex];
  if (!currentStep) return null;

  return (
    <>
      <StoryCard
        key={currentStep.triggerId}
        step={currentStep}
        position={currentStep.position || 'top-left'}
        totalSteps={story.length}
        currentIndex={currentStep.index}
        onPrev={handlePrev}
        onNext={handleNext}
        canGoPrev={currentViewIndex > 0}
        canGoNext={currentViewIndex < triggeredSteps.length - 1}
      />

      <style jsx global>{`
        @keyframes storyCardEnter {
          0% {
            opacity: 0;
            transform: translateY(8px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes storyCardEnterCenter {
          0% {
            opacity: 0;
            transform: translateX(-50%) translateY(8px);
          }
          100% {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </>
  );
}
