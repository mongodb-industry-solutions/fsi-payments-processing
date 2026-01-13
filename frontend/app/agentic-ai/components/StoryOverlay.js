'use client';

import React, { useState, useEffect, useRef } from 'react';

/**
 * StoryCard Component
 * Individual story card with entrance/exit animations
 */
function StoryCard({ step, position, totalSteps, currentIndex, onPrev, onNext, canGoPrev, canGoNext }) {
  if (!step) return null;

  const positionStyles = {
    'top-left': { top: '15px', left: '15px' },
    'top-right': { top: '15px', right: '15px' },
    'bottom-left': { bottom: '20px', left: '15px' },
    'bottom-right': { bottom: '20px', right: '15px' },
    'bottom-center': { bottom: '20px', left: '50%', transform: 'translateX(-50%)' }
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
        maxWidth: '280px',
        animation: isBottomCenter ? 'storyCardEnterCenter 0.4s ease-out forwards' : 'storyCardEnter 0.4s ease-out forwards'
      }}
    >
      {/* Card container */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.98)',
          borderRadius: '8px',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          backdropFilter: 'blur(8px)'
        }}
      >
        {/* Colored accent bar at top */}
        <div
          style={{
            height: '3px',
            background: step.color || '#00A35C',
          }}
        />

        {/* Content */}
        <div style={{ padding: '10px 12px' }}>
          {/* Header row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '6px'
            }}
          >
            {/* Icon */}
            <div
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '6px',
                background: step.color ? `${step.color}15` : '#00A35C15',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                flexShrink: 0
              }}
            >
              {iconMap[step.icon] || step.icon || '📋'}
            </div>

            {/* Title */}
            <div
              style={{
                fontSize: '11px',
                fontWeight: '600',
                color: '#1C2D38',
                lineHeight: '1.2',
                flex: 1
              }}
            >
              {step.title}
            </div>
          </div>

          {/* Description */}
          <div
            style={{
              fontSize: '10px',
              color: '#5C6C75',
              lineHeight: '1.4',
              paddingLeft: '30px'
            }}
          >
            {step.description}
          </div>

          {/* Optional highlight box */}
          {step.highlight && (
            <div
              style={{
                marginTop: '6px',
                marginLeft: '30px',
                padding: '5px 8px',
                background: step.color ? `${step.color}08` : '#00A35C08',
                borderRadius: '4px',
                borderLeft: `2px solid ${step.color || '#00A35C'}`,
                fontSize: '10px',
                color: '#1C2D38',
                fontWeight: '500',
                lineHeight: '1.3'
              }}
            >
              {step.highlight}
            </div>
          )}

          {/* Navigation footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '8px',
              paddingTop: '8px',
              borderTop: '1px solid #E7EAEE'
            }}
          >
            {/* Previous button */}
            <button
              onClick={onPrev}
              disabled={!canGoPrev}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                padding: '4px 6px',
                border: 'none',
                background: canGoPrev ? '#F5F6F7' : 'transparent',
                borderRadius: '4px',
                cursor: canGoPrev ? 'pointer' : 'default',
                color: canGoPrev ? '#1C2D38' : '#C1C7CD',
                fontSize: '10px',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                pointerEvents: 'auto'
              }}
            >
              <span style={{ fontSize: '11px' }}>←</span>
            </button>

            {/* Step indicator dots */}
            <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === currentIndex ? '10px' : '4px',
                    height: '4px',
                    borderRadius: '2px',
                    background: i === currentIndex ? (step.color || '#00A35C') : (i < currentIndex ? '#00A35C' : '#E7EAEE'),
                    transition: 'all 0.3s ease'
                  }}
                />
              ))}
            </div>

            {/* Next button */}
            <button
              onClick={onNext}
              disabled={!canGoNext}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                padding: '4px 6px',
                border: 'none',
                background: canGoNext ? '#F5F6F7' : 'transparent',
                borderRadius: '4px',
                cursor: canGoNext ? 'pointer' : 'default',
                color: canGoNext ? '#1C2D38' : '#C1C7CD',
                fontSize: '10px',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                pointerEvents: 'auto'
              }}
            >
              <span style={{ fontSize: '11px' }}>→</span>
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

  // Reset when scenario changes
  useEffect(() => {
    if (!isActive) {
      setTriggeredSteps([]);
      setCurrentViewIndex(0);
      setAutoAdvance(true);
      triggeredStepsRef.current = new Set();
      lastAdvanceTimeRef.current = Date.now();
      if (pendingAdvanceRef.current) {
        clearTimeout(pendingAdvanceRef.current);
        pendingAdvanceRef.current = null;
      }
    }
  }, [isActive]);

  // Reset when streaming starts fresh
  useEffect(() => {
    if (isStreaming && events.length === 0) {
      setTriggeredSteps([]);
      setCurrentViewIndex(0);
      setAutoAdvance(true);
      triggeredStepsRef.current = new Set();
      lastAdvanceTimeRef.current = Date.now();
      if (pendingAdvanceRef.current) {
        clearTimeout(pendingAdvanceRef.current);
        pendingAdvanceRef.current = null;
      }
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
            transform: translateY(-10px) scale(0.95);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes storyCardEnterCenter {
          0% {
            opacity: 0;
            transform: translateX(-50%) translateY(10px) scale(0.95);
          }
          100% {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1);
          }
        }
      `}</style>
    </>
  );
}
