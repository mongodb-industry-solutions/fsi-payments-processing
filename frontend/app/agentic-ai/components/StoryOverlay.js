'use client';

import React, { useState, useEffect, useRef } from 'react';

/**
 * StoryCard Component
 * Individual story card with entrance/exit animations
 */
function StoryCard({ step, position, totalSteps, currentIndex, onPrev, onNext, canGoPrev, canGoNext }) {
  if (!step) return null;

  // Position styles with adequate spacing from edges (24px recommended)
  const positionStyles = {
    'top-left': { top: '24px', left: '24px' },
    'top-right': { top: '24px', right: '24px' },
    'bottom-left': { bottom: '24px', left: '24px' },
    'bottom-right': { bottom: '24px', right: '24px' },
    'bottom-center': { bottom: '24px', left: '50%', transform: 'translateX(-50%)' }
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
        // Optimal width: 280-320px for readability without being too wide
        width: '300px',
        maxWidth: 'calc(100% - 48px)',
        // Professional animation: 200ms is snappy yet smooth
        animation: isBottomCenter ? 'storyCardEnterCenter 0.2s ease-out forwards' : 'storyCardEnter 0.2s ease-out forwards'
      }}
    >
      {/* Card container with glassmorphism (frosted glass effect) */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.78)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.4)',
          overflow: 'hidden'
        }}
      >
        {/* Colored accent bar - 4px for visual prominence */}
        <div
          style={{
            height: '4px',
            background: step.color || '#00A35C',
          }}
        />

        {/* Content with adequate padding (16px horizontal, 14px vertical) */}
        <div style={{ padding: '14px 16px' }}>
          {/* Header row with proper alignment */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              marginBottom: '8px'
            }}
          >
            {/* Icon container - 32px with frosted glass look */}
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.6)',
                border: `1px solid ${step.color ? `${step.color}30` : 'rgba(0, 163, 92, 0.2)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                flexShrink: 0
              }}
            >
              {iconMap[step.icon] || step.icon || '📋'}
            </div>

            {/* Title - 14px semibold for hierarchy */}
            <div
              style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#1C2D38',
                lineHeight: '1.35',
                flex: 1,
                paddingTop: '4px'
              }}
            >
              {step.title}
            </div>
          </div>

          {/* Description - 13px for optimal readability */}
          <div
            style={{
              fontSize: '13px',
              color: '#5C6C75',
              lineHeight: '1.5',
              marginLeft: '44px'
            }}
          >
            {step.description}
          </div>

          {/* Optional highlight box with frosted glass styling */}
          {step.highlight && (
            <div
              style={{
                marginTop: '10px',
                marginLeft: '44px',
                padding: '8px 12px',
                background: 'rgba(255, 255, 255, 0.5)',
                borderRadius: '8px',
                borderLeft: `3px solid ${step.color || '#00A35C'}`,
                fontSize: '12px',
                color: '#1C2D38',
                fontWeight: '500',
                lineHeight: '1.4',
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
              marginTop: '14px',
              paddingTop: '12px',
              borderTop: '1px solid rgba(255, 255, 255, 0.5)'
            }}
          >
            {/* Previous button - 32px min touch target */}
            <button
              onClick={onPrev}
              disabled={!canGoPrev}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                border: 'none',
                background: canGoPrev ? 'rgba(255, 255, 255, 0.6)' : 'transparent',
                borderRadius: '8px',
                cursor: canGoPrev ? 'pointer' : 'default',
                color: canGoPrev ? '#1C2D38' : '#C1C7CD',
                fontSize: '14px',
                transition: 'all 0.15s ease',
                pointerEvents: 'auto'
              }}
              aria-label="Previous step"
            >
              ←
            </button>

            {/* Step indicator - pill style for current, dots for others */}
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === currentIndex ? '16px' : '6px',
                    height: '6px',
                    borderRadius: '3px',
                    background: i === currentIndex
                      ? (step.color || '#00A35C')
                      : (i < currentIndex ? `${step.color || '#00A35C'}60` : '#E0E2E5'),
                    transition: 'all 0.2s ease'
                  }}
                />
              ))}
            </div>

            {/* Next button - 32px min touch target */}
            <button
              onClick={onNext}
              disabled={!canGoNext}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                border: 'none',
                background: canGoNext ? 'rgba(255, 255, 255, 0.6)' : 'transparent',
                borderRadius: '8px',
                cursor: canGoNext ? 'pointer' : 'default',
                color: canGoNext ? '#1C2D38' : '#C1C7CD',
                fontSize: '14px',
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
 */
const MIN_DISPLAY_TIME = 1500; // Minimum time (ms) each card stays visible

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
  const lastAdvanceTimeRef = useRef(Date.now()); // When current card was shown
  const pendingAdvanceRef = useRef(null); // Pending advance timer

  // Helper to reset all state
  const resetState = () => {
    setTriggeredSteps([]);
    setCurrentViewIndex(0);
    setAutoAdvance(true);
    triggeredStepsRef.current = new Set();
    lastAdvanceTimeRef.current = Date.now();
    if (pendingAdvanceRef.current) {
      clearTimeout(pendingAdvanceRef.current);
      pendingAdvanceRef.current = null;
    }
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pendingAdvanceRef.current) {
        clearTimeout(pendingAdvanceRef.current);
      }
    };
  }, []);

  // Handle auto-advance with minimum display time
  const scheduleAdvance = (newStepsLength) => {
    if (!autoAdvance) return;

    const timeSinceLastAdvance = Date.now() - lastAdvanceTimeRef.current;
    const targetIndex = newStepsLength - 1;

    // Clear any pending advance
    if (pendingAdvanceRef.current) {
      clearTimeout(pendingAdvanceRef.current);
      pendingAdvanceRef.current = null;
    }

    if (timeSinceLastAdvance >= MIN_DISPLAY_TIME) {
      // Enough time has passed, advance immediately
      setCurrentViewIndex(targetIndex);
      lastAdvanceTimeRef.current = Date.now();
    } else {
      // Schedule advance after remaining time
      const remainingTime = MIN_DISPLAY_TIME - timeSinceLastAdvance;
      pendingAdvanceRef.current = setTimeout(() => {
        setCurrentViewIndex(prev => {
          // Only advance if we're still supposed to auto-advance
          // and there are newer steps to show
          if (autoAdvance) {
            lastAdvanceTimeRef.current = Date.now();
            return targetIndex;
          }
          return prev;
        });
        pendingAdvanceRef.current = null;
      }, remainingTime);
    }
  };

  // Process events and trigger story steps
  useEffect(() => {
    if (!isActive || story.length === 0) return;

    // Allow processing if streaming OR if we have a complete event (streaming just ended)
    const hasCompleteEvent = events.some(e => e.type === 'complete');
    if (!isStreaming && !hasCompleteEvent) return;

    const eventTypes = new Set(events.map(e => e.type));

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
          shouldTrigger = eventTypes.has('agent_complete');
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
        triggeredStepsRef.current.add(triggerId);

        const delay = step.delay || 0;

        setTimeout(() => {
          setTriggeredSteps(prev => {
            const newSteps = [...prev, { ...step, index, triggerId }];
            // Schedule auto-advance with minimum display time
            scheduleAdvance(newSteps.length);
            return newSteps;
          });
        }, delay);
      }
    });
  }, [isActive, isStreaming, story, events, autoAdvance]);

  // Navigation handlers
  const handlePrev = () => {
    setAutoAdvance(false); // User manually navigated, stop auto-advance
    // Clear any pending auto-advance
    if (pendingAdvanceRef.current) {
      clearTimeout(pendingAdvanceRef.current);
      pendingAdvanceRef.current = null;
    }
    setCurrentViewIndex(prev => Math.max(0, prev - 1));
    lastAdvanceTimeRef.current = Date.now();
  };

  const handleNext = () => {
    setCurrentViewIndex(prev => {
      const next = Math.min(triggeredSteps.length - 1, prev + 1);
      // Re-enable auto-advance if we're at the latest step
      if (next === triggeredSteps.length - 1) {
        setAutoAdvance(true);
      }
      lastAdvanceTimeRef.current = Date.now();
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
