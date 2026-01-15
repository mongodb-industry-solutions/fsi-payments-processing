'use client';

import React, { useState } from 'react';
import { H2, Body } from '@leafygreen-ui/typography';
import Card from '@leafygreen-ui/card';
import Icon from '@leafygreen-ui/icon';
import { Tabs, Tab } from '@leafygreen-ui/tabs';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  useMapContext
} from 'react-simple-maps';
import ConversionFlowPipeline from './ConversionFlowPipeline';
import StoryOverlay from './StoryOverlay';

// World map topology URL (low resolution for performance)
const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

/**
 * CustomArcPath Component
 * Renders a curved arc between coordinates, avoiding geodesic shortest path
 * This ensures lines go "the long way" when needed (e.g., USA to India across Pacific)
 * Arc curvature makes routes look more natural and airline-like
 */
function CustomArcPath({ from, to, stroke, strokeWidth, isStreaming }) {
  const { projection } = useMapContext();

  // Adjust coordinates to avoid date line wrapping
  // If longitude difference > 180, add 360 to force the "long way"
  let [fromLng, fromLat] = from;
  let [toLng, toLat] = to;

  const lngDiff = Math.abs(toLng - fromLng);
  if (lngDiff > 180) {
    // Crossing the date line - adjust to go the long way
    if (toLng < fromLng) {
      toLng += 360;
    } else {
      fromLng += 360;
    }
  }

  // Project coordinates to SVG space
  const [x1, y1] = projection([fromLng, fromLat]);
  const [x2, y2] = projection([toLng, toLat]);

  // Calculate arc control point for quadratic Bézier curve
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  // Calculate distance for arc height scaling
  const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

  // Arc height: 12% of distance, with min/max constraints
  const arcHeight = Math.min(Math.max(distance * 0.12, 30), 100);

  // Calculate perpendicular offset for control point
  const dx = x2 - x1;
  const dy = y2 - y1;
  const perpX = -dy / distance;
  const perpY = dx / distance;

  // Control point offset from midpoint (upward arc)
  const controlX = midX + perpX * arcHeight;
  const controlY = midY + perpY * arcHeight;

  // SVG quadratic curve path: M (start) Q (control point) (end)
  const pathD = `M ${x1} ${y1} Q ${controlX} ${controlY} ${x2} ${y2}`;

  return (
    <path
      d={pathD}
      stroke={stroke}
      strokeWidth={strokeWidth}
      fill="none"
      strokeLinecap="round"
      style={{
        animation: isStreaming ? 'pulse 2s infinite' : 'none',
        transition: 'all 0.3s ease'
      }}
    />
  );
}

/**
 * StatusPill Component
 * Minimal, clean status indicator for map events
 */
function StatusPill({ status, x, y, isActive }) {
  if (!isActive) return null;

  const getConfig = () => {
    switch (status) {
      case 'processing':
        return { label: 'Processing', color: '#0B61A4', icon: '→' };
      case 'error':
        return { label: 'Validation Error', color: '#CD4246', icon: '!' };
      case 'resolving':
        return { label: 'Resolving', color: '#FFC010', icon: '⚙' };
      case 'resolved':
        return { label: 'Resolved', color: '#00A35C', icon: '✓' };
      case 'complete':
        return { label: 'Complete', color: '#00A35C', icon: '✓' };
      default:
        return { label: status, color: '#5C6C75', icon: '•' };
    }
  };

  const config = getConfig();
  const pillWidth = config.label.length * 7 + 36;
  const pillHeight = 28;

  return (
    <g style={{
      opacity: 1,
      animation: 'pillFadeIn 0.3s ease-out'
    }}>
      {/* Pill background */}
      <rect
        x={x - pillWidth / 2}
        y={y - 45}
        width={pillWidth}
        height={pillHeight}
        rx={pillHeight / 2}
        fill={config.color}
      />
      {/* Icon circle */}
      <circle
        cx={x - pillWidth / 2 + 16}
        cy={y - 45 + pillHeight / 2}
        r={9}
        fill="rgba(255,255,255,0.25)"
      />
      {/* Icon */}
      <text
        x={x - pillWidth / 2 + 16}
        y={y - 45 + pillHeight / 2 + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="11"
        fontWeight="600"
        fill="white"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {config.icon}
      </text>
      {/* Label */}
      <text
        x={x - pillWidth / 2 + 32}
        y={y - 45 + pillHeight / 2 + 1}
        dominantBaseline="central"
        fontSize="12"
        fontWeight="600"
        fill="white"
        fontFamily="system-ui, -apple-system, sans-serif"
        letterSpacing="0.3"
      >
        {config.label}
      </text>
    </g>
  );
}

/**
 * ErrorCard Component
 * Shown only for validation errors - clean and minimal
 */
function ErrorCard({ event, x, y, isActive }) {
  if (!isActive || !event) return null;

  const cardWidth = 200;
  const cardHeight = 52;

  return (
    <g style={{
      opacity: 1,
      animation: 'cardSlideIn 0.3s ease-out'
    }}>
      {/* Card background with subtle shadow effect */}
      <rect
        x={x - cardWidth / 2}
        y={y + 35}
        width={cardWidth}
        height={cardHeight}
        rx={8}
        fill="white"
        stroke="#E7EAEE"
        strokeWidth={1}
      />
      {/* Red accent line at top */}
      <rect
        x={x - cardWidth / 2 + 12}
        y={y + 35}
        width={cardWidth - 24}
        height={3}
        rx={1.5}
        fill="#CD4246"
      />
      {/* Field name */}
      <text
        x={x - cardWidth / 2 + 12}
        y={y + 56}
        fontSize="12"
        fontWeight="600"
        fill="#1C2D38"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {event.field || 'Unknown field'}
      </text>
      {/* Error message */}
      <text
        x={x - cardWidth / 2 + 12}
        y={y + 74}
        fontSize="11"
        fill="#889397"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {(event.message || event.error || 'Validation failed').substring(0, 26)}
        {(event.message || event.error || '').length > 26 ? '...' : ''}
      </text>
    </g>
  );
}

/**
 * EVENT-DRIVEN Progress Map
 * Maps event types to progress percentages - SINGLE SOURCE OF TRUTH for animation sync
 * Progress values are designed to match the event display rate from page.js
 */
const EVENT_PROGRESS_MAP = {
  // Basic flow events
  'start': 8,
  'hop1_start': 25,
  'hop1_complete': 50,
  'hop2_start': 60,
  'hop2_complete': 85,

  // Crypto/blockchain events (spread across the journey)
  'crypto_start': 55,
  'crypto_wallet_extract': 60,
  'crypto_balance_check': 65,
  'crypto_tx_build': 70,
  'crypto_tx_sign': 75,
  'crypto_tx_submit': 82,
  'crypto_tx_confirm': 90,
  'crypto_complete': 95,

  // Agent events (error resolution at midpoint)
  'validation_failed': 50,
  'agent_start': 52,
  'agent_supervisor': 55,
  'tool_call': 60,
  'tool_result': 65,
  'agent_resolution': 70,
  'agent_complete': 80,

  // Completion
  'complete': 100
};

// Sync marker progress with card display - same 3-second delay
const MARKER_PROGRESS_DELAY = 3000;

/**
 * Calculate progress directly from events array
 * Returns the highest progress value among all events
 */
function calculateProgressFromEvents(events) {
  let maxProgress = 0;
  for (const event of events) {
    const progress = EVENT_PROGRESS_MAP[event.type] || 0;
    if (progress > maxProgress) {
      maxProgress = progress;
    }
  }
  return maxProgress;
}

/**
 * AnimatedPaymentJourney Component
 * Visualizes payment traveling along the route with error handling
 *
 * KEY DESIGN: Progress is QUEUED to sync with story cards and transaction logs.
 * Events arrive and get queued, then progress updates every 3 seconds to match
 * the card display and log scroll timing. CSS transitions handle smooth animation.
 *
 * @param {boolean} logsRenderComplete - Signal from transaction logs panel that output has rendered
 */
function AnimatedPaymentJourney({ from, to, events, isStreaming, onFirstLegComplete, logsRenderComplete }) {
  const { projection } = useMapContext();

  const [journeyState, setJourneyState] = React.useState({
    progress: 0, // 0-100 - queued and released with delay
    status: 'idle', // idle, traveling, error_awaiting_healing, agent_working, resolved, complete
    errorPosition: null,
    resolvedTimestamp: null // When resolution happened (for fade-out timing)
  });

  // Queue-based progress system - syncs with card display timing
  const progressQueueRef = React.useRef([]); // Queue of {progress, status, errorPosition} objects
  const isProcessingQueueRef = React.useRef(false);
  const queueTimerRef = React.useRef(null);
  const lastQueuedEventCountRef = React.useRef(0);

  // Track previous status for first leg completion callback
  const prevStatusRef = React.useRef(journeyState.status);

  // Process progress queue - releases progress updates with delay
  const processProgressQueue = React.useCallback(() => {
    if (progressQueueRef.current.length === 0) {
      isProcessingQueueRef.current = false;
      return;
    }

    isProcessingQueueRef.current = true;
    const nextState = progressQueueRef.current.shift();

    // Apply the queued progress update
    setJourneyState(prev => ({
      ...nextState,
      resolvedTimestamp: nextState.status === 'resolved' && !prev.resolvedTimestamp ? Date.now() : prev.resolvedTimestamp
    }));

    // Schedule next progress update after delay
    queueTimerRef.current = setTimeout(() => {
      processProgressQueue();
    }, MARKER_PROGRESS_DELAY);
  }, []);

  // Reset queue when streaming starts fresh
  React.useEffect(() => {
    if (!isStreaming && events.length === 0) {
      progressQueueRef.current = [];
      isProcessingQueueRef.current = false;
      lastQueuedEventCountRef.current = 0;
      if (queueTimerRef.current) {
        clearTimeout(queueTimerRef.current);
        queueTimerRef.current = null;
      }
      setJourneyState({ progress: 0, status: 'idle', errorPosition: null, resolvedTimestamp: null });
    }
  }, [isStreaming, events.length]);

  // Cleanup timer on unmount
  React.useEffect(() => {
    return () => {
      if (queueTimerRef.current) {
        clearTimeout(queueTimerRef.current);
      }
    };
  }, []);

  // Queue progress updates when new events arrive
  // Progress is calculated and queued, then released with delay to match card timing
  React.useEffect(() => {
    if (!isStreaming && events.length === 0) return;
    if (events.length === 0) return;

    // Only process new events
    if (events.length <= lastQueuedEventCountRef.current) return;

    // Calculate progress from ALL events (to get the target state)
    const eventProgress = calculateProgressFromEvents(events);

    // Determine current status from events
    const hasError = events.some(e => e.type === 'validation_failed');
    const hasAgentStart = events.some(e => e.type === 'agent_start');
    const hasAgentComplete = events.some(e => e.type === 'agent_complete');
    const isComplete = events.some(e => e.type === 'complete');

    // Check for crypto scenario
    const hasCryptoEvents = events.some(e => e.type?.startsWith('crypto_'));
    const hasHop1Complete = events.some(e => e.type === 'hop1_complete');

    console.log('📊 Queuing Progress Update:', {
      eventCount: events.length,
      eventProgress,
      hasError,
      hasAgentComplete,
      isComplete,
      logsRenderComplete
    });

    // Determine status and final progress
    let newStatus = 'traveling';
    let finalProgress = eventProgress;

    if (hasHop1Complete && hasCryptoEvents) {
      newStatus = 'complete';
      finalProgress = 100;
    } else if (isComplete && logsRenderComplete) {
      newStatus = 'complete';
      finalProgress = 100;
    } else if (isComplete && !logsRenderComplete) {
      newStatus = 'awaiting_logs';
      finalProgress = Math.max(eventProgress, 95);
    } else if (hasAgentComplete && !isComplete) {
      newStatus = 'resolved';
    } else if (hasAgentStart && hasError) {
      newStatus = 'agent_working';
    } else if (hasError && !hasAgentStart) {
      newStatus = 'error_awaiting_healing';
    } else if (hasAgentStart) {
      newStatus = 'agent_working';
    } else if (isStreaming || events.length > 0) {
      newStatus = 'traveling';
    }

    // Queue the progress update
    // Clear error marker when journey resolves or completes
    const shouldShowError = hasError &&
      newStatus !== 'complete' &&
      newStatus !== 'resolved' &&
      newStatus !== 'awaiting_logs';

    progressQueueRef.current.push({
      progress: finalProgress,
      status: newStatus,
      errorPosition: shouldShowError ? 50 : null
    });

    lastQueuedEventCountRef.current = events.length;

    // Start processing queue if not already running
    if (!isProcessingQueueRef.current) {
      processProgressQueue();
    }

  }, [events, isStreaming, logsRenderComplete, processProgressQueue]);

  // Notify parent when blockchain settlement completes (for crypto scenarios)
  // Second leg only shows after crypto_complete event (blockchain payment settled)
  const prevCryptoCompleteRef = React.useRef(false);
  React.useEffect(() => {
    const hasCryptoComplete = events.some(e => e.type === 'crypto_complete');

    // For crypto scenarios, second leg starts only after blockchain settlement
    if (hasCryptoComplete && !prevCryptoCompleteRef.current && onFirstLegComplete) {
      onFirstLegComplete();
      prevCryptoCompleteRef.current = true;
    }
    prevStatusRef.current = journeyState.status;
  }, [journeyState.status, events, onFirstLegComplete]);

  // Clear error marker after resolution with delay (for smooth fade-out)
  React.useEffect(() => {
    if (journeyState.status === 'resolved' && journeyState.resolvedTimestamp) {
      const RESOLUTION_DISPLAY_TIME = 1500; // Show success for 1.5 seconds
      const timer = setTimeout(() => {
        setJourneyState(prev => ({
          ...prev,
          errorPosition: null // Clear error marker to hide success indicator
        }));
      }, RESOLUTION_DISPLAY_TIME);
      return () => clearTimeout(timer);
    }
  }, [journeyState.status, journeyState.resolvedTimestamp]);

  // Adjust coordinates to avoid date line wrapping
  let [fromLng, fromLat] = from;
  let [toLng, toLat] = to;

  const lngDiff = Math.abs(toLng - fromLng);
  if (lngDiff > 180) {
    if (toLng < fromLng) {
      toLng += 360;
    } else {
      fromLng += 360;
    }
  }

  // Project coordinates to SVG space
  const [x1, y1] = projection([fromLng, fromLat]);
  const [x2, y2] = projection([toLng, toLat]);

  // Calculate arc parameters (same as CustomArcPath)
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const arcHeight = Math.min(Math.max(distance * 0.12, 30), 100);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const perpX = -dy / distance;
  const perpY = dx / distance;
  const controlX = midX + perpX * arcHeight;
  const controlY = midY + perpY * arcHeight;

  // Calculate marker position along the arc using quadratic Bézier formula
  // B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
  const progress = journeyState.progress / 100;
  const t = progress;
  const oneMinusT = 1 - t;
  const markerX = oneMinusT * oneMinusT * x1 + 2 * oneMinusT * t * controlX + t * t * x2;
  const markerY = oneMinusT * oneMinusT * y1 + 2 * oneMinusT * t * controlY + t * t * y2;

  // Calculate error position if exists (using same arc formula)
  let errorX, errorY;
  if (journeyState.errorPosition) {
    const errorT = journeyState.errorPosition / 100;
    const oneMinusErrorT = 1 - errorT;
    errorX = oneMinusErrorT * oneMinusErrorT * x1 + 2 * oneMinusErrorT * errorT * controlX + errorT * errorT * x2;
    errorY = oneMinusErrorT * oneMinusErrorT * y1 + 2 * oneMinusErrorT * errorT * controlY + errorT * errorT * y2;
  }

  // Get marker color based on status
  const getMarkerColor = () => {
    switch (journeyState.status) {
      case 'error': return '#CD4246'; // Red
      case 'agent_working': return '#FFC010'; // Yellow
      case 'resolved': return '#00A35C'; // Green (success!)
      case 'complete': return '#00A35C'; // Green
      case 'traveling': return '#0B61A4'; // Blue
      default: return '#00A35C';
    }
  };

  if (journeyState.status === 'idle' || journeyState.progress === 0) {
    return null;
  }

  // Get error event for error card display
  const errorEvent = events.find(e => e.type === 'validation_failed');

  return (
    <g>
      {/* Error marker if present */}
      {journeyState.errorPosition && journeyState.status !== 'complete' && (
        <g style={{
          opacity: journeyState.status === 'resolved' && journeyState.resolvedTimestamp && Date.now() - journeyState.resolvedTimestamp > 1000 ? 0 : 1,
          transition: 'opacity 0.5s ease-out'
        }}>
          {/* Outer error pulse ring - larger and more visible */}
          <circle
            cx={errorX}
            cy={errorY}
            r={16}
            fill="none"
            stroke={
              journeyState.status === 'resolved' ? '#00A35C' : 
              journeyState.status === 'agent_working' ? '#FFC010' : 
              '#CD4246'
            }
            strokeWidth={3}
            opacity={0.6}
            style={{
              animation: journeyState.status === 'error_awaiting_healing' || journeyState.status === 'agent_working'
                ? 'errorPulse 1.5s infinite'
                : journeyState.status === 'resolved'
                ? 'successPulse 0.6s ease-out'
                : 'none',
              transition: 'stroke 0.5s ease'
            }}
          />
          {/* Middle error pulse ring */}
          <circle
            cx={errorX}
            cy={errorY}
            r={10}
            fill="none"
            stroke={
              journeyState.status === 'resolved' ? '#00A35C' : 
              journeyState.status === 'agent_working' ? '#FFC010' : 
              '#CD4246'
            }
            strokeWidth={2}
            opacity={0.8}
            style={{
              animation: journeyState.status === 'error_awaiting_healing' || journeyState.status === 'agent_working'
                ? 'errorPulse 1.5s infinite 0.2s'
                : journeyState.status === 'resolved'
                ? 'successPulse 0.6s ease-out 0.1s'
                : 'none',
              transition: 'stroke 0.5s ease'
            }}
          />
          {/* Warning/Agent/Success icon inside error marker */}
          <g transform={`translate(${errorX}, ${errorY})`}>
            <circle 
              r={6} 
              fill={
                journeyState.status === 'resolved' ? '#00A35C' : 
                journeyState.status === 'agent_working' ? '#FFC010' : 
                '#CD4246'
              } 
              style={{ transition: 'fill 0.5s ease' }} 
            />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="9"
              fontWeight="bold"
              fill="white"
              style={{ pointerEvents: 'none' }}
            >
              {journeyState.status === 'resolved' ? '✓' : journeyState.status === 'agent_working' ? '⚙' : '!'}
            </text>
          </g>
          
          {/* Status pill - clean minimal indicator */}
          <StatusPill
            status={
              journeyState.status === 'resolved' ? 'resolved' :
              journeyState.status === 'agent_working' ? 'resolving' :
              'error'
            }
            x={errorX}
            y={errorY}
            isActive={true}
          />

          {/* Error card - shown for validation errors and during resolution */}
          {(journeyState.status === 'error_awaiting_healing' || journeyState.status === 'agent_working') && errorEvent && (
            <ErrorCard
              event={errorEvent}
              x={errorX}
              y={errorY}
              isActive={true}
            />
          )}
        </g>
      )}

      {/* Traveling payment marker */}
      {journeyState.progress > 0 && journeyState.status !== 'complete' && journeyState.status !== 'error_awaiting_healing' && journeyState.status !== 'agent_working' && (
        <g style={{
          opacity: 1,
          transition: 'opacity 0.3s ease-in',
          animation: journeyState.status === 'resolved' ? 'fadeIn 0.5s ease-in' : 'none'
        }}>
          {/* Outer glow ring */}
          <circle
            cx={markerX}
            cy={markerY}
            r={12}
            fill="none"
            stroke={getMarkerColor()}
            strokeWidth={2}
            opacity={0.5}
            style={{
              animation: journeyState.status === 'resolved'
                ? 'successTravelPulse 1s infinite'
                : 'travelPulse 1s infinite',
              transition: 'cx 0.4s ease-out, cy 0.4s ease-out, stroke 0.5s ease'
            }}
          />
          {/* Main marker */}
          <circle
            cx={markerX}
            cy={markerY}
            r={6}
            fill={getMarkerColor()}
            stroke="white"
            strokeWidth={2}
            style={{ transition: 'cx 0.4s ease-out, cy 0.4s ease-out, fill 0.5s ease' }}
          />
          {/* Status pill - follows marker during travel */}
          {journeyState.status === 'traveling' && (
            <StatusPill
              status="processing"
              x={markerX}
              y={markerY}
              isActive={true}
            />
          )}
        </g>
      )}

    </g>
  );
}

/**
 * SECOND LEG Progress Map for crypto scenarios
 * Maps crypto events to progress percentages for the second leg (USA -> Mexico)
 * Second leg starts ONLY after crypto_complete (blockchain settlement confirmed)
 */
const SECOND_LEG_PROGRESS_MAP = {
  'crypto_complete': 20,    // Second leg starts after blockchain settlement
  'complete': 100           // Full journey complete
};

/**
 * Calculate second leg progress from events
 */
function calculateSecondLegProgress(events) {
  let maxProgress = 0;
  for (const event of events) {
    const progress = SECOND_LEG_PROGRESS_MAP[event.type] || 0;
    if (progress > maxProgress) {
      maxProgress = progress;
    }
  }
  return maxProgress;
}

/**
 * AnimatedPaymentJourneySecondLeg Component
 * Animates the second leg of multi-hop crypto scenarios (USA -> Mexico)
 *
 * KEY DESIGN: Progress is QUEUED to sync with story cards and transaction logs.
 * Second leg starts ONLY when crypto_complete event is received (blockchain settled).
 */
function AnimatedPaymentJourneySecondLeg({ from, to, events, isStreaming }) {
  const { projection } = useMapContext();

  const [journeyState, setJourneyState] = React.useState({
    progress: 0,
    status: 'idle' // idle, traveling, complete
  });

  // Queue-based progress system
  const progressQueueRef = React.useRef([]);
  const isProcessingQueueRef = React.useRef(false);
  const queueTimerRef = React.useRef(null);
  const lastQueuedEventCountRef = React.useRef(0);

  // Process progress queue
  const processProgressQueue = React.useCallback(() => {
    if (progressQueueRef.current.length === 0) {
      isProcessingQueueRef.current = false;
      return;
    }

    isProcessingQueueRef.current = true;
    const nextState = progressQueueRef.current.shift();
    setJourneyState(nextState);

    queueTimerRef.current = setTimeout(() => {
      processProgressQueue();
    }, MARKER_PROGRESS_DELAY);
  }, []);

  // Reset queue when streaming resets
  React.useEffect(() => {
    if (!isStreaming && events.length === 0) {
      progressQueueRef.current = [];
      isProcessingQueueRef.current = false;
      lastQueuedEventCountRef.current = 0;
      if (queueTimerRef.current) {
        clearTimeout(queueTimerRef.current);
        queueTimerRef.current = null;
      }
      setJourneyState({ progress: 0, status: 'idle' });
    }
  }, [isStreaming, events.length]);

  // Cleanup timer
  React.useEffect(() => {
    return () => {
      if (queueTimerRef.current) {
        clearTimeout(queueTimerRef.current);
      }
    };
  }, []);

  // Queue progress updates when new events arrive
  React.useEffect(() => {
    const hasCryptoComplete = events.some(e => e.type === 'crypto_complete');
    const hasComplete = events.some(e => e.type === 'complete');

    if (!isStreaming && events.length === 0) return;
    if (events.length <= lastQueuedEventCountRef.current) return;

    // Second leg only starts AFTER blockchain settlement
    if (!hasCryptoComplete) {
      lastQueuedEventCountRef.current = events.length;
      return;
    }

    const eventProgress = calculateSecondLegProgress(events);

    let newStatus = 'traveling';
    let finalProgress = eventProgress;

    if (hasComplete) {
      newStatus = 'complete';
      finalProgress = 100;
    } else {
      newStatus = 'traveling';
      finalProgress = Math.max(eventProgress, 20);
    }

    progressQueueRef.current.push({
      progress: finalProgress,
      status: newStatus
    });

    lastQueuedEventCountRef.current = events.length;

    if (!isProcessingQueueRef.current) {
      processProgressQueue();
    }

  }, [events, isStreaming, processProgressQueue]);

  // Adjust coordinates
  let [fromLng, fromLat] = from;
  let [toLng, toLat] = to;

  const lngDiff = Math.abs(toLng - fromLng);
  if (lngDiff > 180) {
    if (toLng < fromLng) {
      toLng += 360;
    } else {
      fromLng += 360;
    }
  }

  // Project coordinates to SVG space
  const [x1, y1] = projection([fromLng, fromLat]);
  const [x2, y2] = projection([toLng, toLat]);

  // Calculate arc parameters
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const arcHeight = Math.min(Math.max(distance * 0.12, 30), 100);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const perpX = -dy / distance;
  const perpY = dx / distance;
  const controlX = midX + perpX * arcHeight;
  const controlY = midY + perpY * arcHeight;

  // Calculate marker position using quadratic Bézier formula
  const progress = journeyState.progress / 100;
  const t = progress;
  const oneMinusT = 1 - t;
  const markerX = oneMinusT * oneMinusT * x1 + 2 * oneMinusT * t * controlX + t * t * x2;
  const markerY = oneMinusT * oneMinusT * y1 + 2 * oneMinusT * t * controlY + t * t * y2;

  if (journeyState.status === 'idle' || journeyState.progress === 0) {
    return null;
  }

  return (
    <g>
      {/* Traveling payment marker - purple for crypto leg */}
      {journeyState.progress > 0 && journeyState.status !== 'complete' && (
        <g>
          {/* Outer glow ring */}
          <circle
            cx={markerX}
            cy={markerY}
            r={12}
            fill="none"
            stroke="#7C3AED"
            strokeWidth={2}
            opacity={0.5}
            style={{
              animation: 'travelPulse 1s infinite',
              transition: 'cx 0.4s ease-out, cy 0.4s ease-out'
            }}
          />
          {/* Main marker */}
          <circle
            cx={markerX}
            cy={markerY}
            r={6}
            fill="#7C3AED"
            stroke="white"
            strokeWidth={2}
            style={{ transition: 'cx 0.4s ease-out, cy 0.4s ease-out' }}
          />
        </g>
      )}
      {/* Success marker at destination */}
      {journeyState.status === 'complete' && (
        <g>
          <circle
            cx={x2}
            cy={y2}
            r={10}
            fill="none"
            stroke="#7C3AED"
            strokeWidth={2}
            opacity={0.6}
            style={{
              animation: 'successPulse 0.6s ease-out'
            }}
          />
          <circle
            cx={x2}
            cy={y2}
            r={6}
            fill="#7C3AED"
            stroke="white"
            strokeWidth={2}
          />
        </g>
      )}
    </g>
  );
}

/**
 * GeographicMapPanel Component
 * Interactive world map showing payment journey from source to target country
 *
 * @param {Object} props
 * @param {boolean} props.isActive - Whether a scenario is selected/running
 * @param {Object} props.scenario - Current scenario with source/target countries
 * @param {boolean} props.isStreaming - Whether conversion is in progress
 * @param {Array} props.events - Stream events for journey animation
 * @param {string} props.output - Final conversion output
 * @param {Object} props.stats - Processing statistics
 * @param {number} props.totalTime - Total processing time
 * @param {Object} props.hop1Details - Detailed processing for Hop 1
 * @param {Object} props.hop2Details - Detailed processing for Hop 2
 * @param {boolean} props.logsRenderComplete - Signal that transaction logs have finished rendering
 */
export default function GeographicMapPanel({
  isActive,
  scenario,
  isStreaming,
  events = [],
  output = '',
  stats = null,
  totalTime = 0,
  hop1Details = null,
  hop2Details = null,
  conversionRunId = null,
  logsRenderComplete = false
}) {
  const [hoveredCountry, setHoveredCountry] = useState(null);
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const [firstLegAnimationComplete, setFirstLegAnimationComplete] = useState(false);
  const [showFinalDestination, setShowFinalDestination] = useState(false); // Shows Mexico dot at hop1_complete
  const [isMounted, setIsMounted] = useState(false);
  const [isJourneyComplete, setIsJourneyComplete] = useState(false);

  // Handle SSR hydration - only render Tabs on client
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Track journey completion based on events AND logs render complete
  // This ensures the checkmark and green color only appear after logs have rendered
  React.useEffect(() => {
    const hasCompleteEvent = events.some(e => e.type === 'complete');
    setIsJourneyComplete(hasCompleteEvent && logsRenderComplete);
  }, [events, logsRenderComplete]);

  // Reset states when scenario changes or streaming starts fresh
  React.useEffect(() => {
    if (!isStreaming && events.length === 0) {
      setFirstLegAnimationComplete(false);
      setShowFinalDestination(false);
      setIsJourneyComplete(false);
    }
  }, [isStreaming, events.length]);

  // Show final destination marker when payment reaches intermediate point (for crypto scenarios)
  React.useEffect(() => {
    const hasCryptoEvents = events.some(e => e.type?.startsWith('crypto_'));
    const hasHop1Complete = events.some(e => e.type === 'hop1_complete');

    if (hasCryptoEvents && hasHop1Complete && !showFinalDestination) {
      setShowFinalDestination(true);
    }
  }, [events, showFinalDestination]);

  // Get country ISO codes for highlighting (simplified mapping)
  const getCountryISO = (countryName) => {
    const isoMap = {
      'Germany': 'DEU',
      'Japan': 'JPN',
      'United States': 'USA',
      'India': 'IND'
    };
    return isoMap[countryName] || null;
  };

  const sourceISO = scenario?.sourceCountry?.name ? getCountryISO(scenario.sourceCountry.name) : null;
  const targetISO = scenario?.targetCountry?.name ? getCountryISO(scenario.targetCountry.name) : null;

  return (
    <Card
      style={{
        padding: '0',
        height: 'calc(100vh - 280px)',
        minHeight: '420px',
        maxHeight: '850px',
        display: 'flex',
        flexDirection: 'column',
        background: '#F9FBFA',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        border: '1px solid #E7EAEE'
      }}
    >
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        background: '#F9FBFA',
        borderBottom: '1px solid #E7EAEE',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <H2>Payment Journey Visualization</H2>
        {isMounted && (
          <Tabs
            value={selectedTabIndex}
            onValueChange={setSelectedTabIndex}
            aria-label="View toggle"
          >
            <Tab name="Map" />
            <Tab name="Backend" />
          </Tabs>
        )}
      </div>

      {/* Map Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {selectedTabIndex === 0 ? (
          <>
            {!isActive ? (
              /* Empty State */
              <div style={{
                textAlign: 'center',
                zIndex: 1,
                padding: '48px 40px',
                background: 'linear-gradient(180deg, #FFFFFF 0%, #F9FBFA 100%)',
                borderRadius: '12px'
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px auto'
                }}>
                  <Icon glyph="Charts" size="xlarge" fill="#0B61A4" />
                </div>
                <Body weight="medium" style={{
                  fontSize: '18px',
                  color: '#1C2D38',
                  marginBottom: '8px'
                }}>
                  Select a scenario to begin
                </Body>
                <Body style={{
                  fontSize: '14px',
                  color: '#5C6C75',
                  maxWidth: '280px',
                  lineHeight: '1.5'
                }}>
                  Geographic visualization will show payment routing across borders
                </Body>
              </div>
            ) : (
          /* Interactive World Map */
          <>
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{
              scale: 140,
              center: [20, 20]
            }}
            style={{
              width: '100%',
              height: '100%'
            }}
          >
            {/* Countries */}
            <Geographies geography={geoUrl}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const isSource = geo.properties.iso_a3 === sourceISO;
                  const isTarget = geo.properties.iso_a3 === targetISO;
                  const isHighlighted = isSource || isTarget;
                  const isHovered = hoveredCountry === geo.properties.iso_a3;

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onMouseEnter={() => {
                        setHoveredCountry(geo.properties.iso_a3);
                      }}
                      onMouseLeave={() => {
                        setHoveredCountry(null);
                      }}
                      style={{
                        default: {
                          fill: isHighlighted ? '#00A35C' : '#E7EAEE',
                          stroke: '#FFFFFF',
                          strokeWidth: 0.5,
                          outline: 'none'
                        },
                        hover: {
                          fill: isHighlighted ? '#00A35C' : '#E7EAEE',
                          stroke: '#FFFFFF',
                          strokeWidth: 0.5,
                          outline: 'none'
                        },
                        pressed: {
                          fill: isHighlighted ? '#00A35C' : '#E7EAEE',
                          stroke: '#FFFFFF',
                          strokeWidth: 0.5,
                          outline: 'none'
                        }
                      }}
                    />
                  );
                })
              }
            </Geographies>

            {/* Payment Route Arc - Using custom arc path to avoid geodesic wrapping */}
            {scenario?.sourceCountry?.coords && scenario?.targetCountry?.coords && (
              <>
                <CustomArcPath
                  from={scenario.sourceCountry.coords}
                  to={scenario.targetCountry.coords}
                  stroke={isStreaming ? '#0B61A4' : '#00A35C'}
                  strokeWidth={2.5}
                  isStreaming={isStreaming}
                />
                {/* Animated payment journey marker */}
                <AnimatedPaymentJourney
                  from={scenario.sourceCountry.coords}
                  to={scenario.targetCountry.coords}
                  events={events}
                  isStreaming={isStreaming}
                  onFirstLegComplete={() => setFirstLegAnimationComplete(true)}
                  logsRenderComplete={logsRenderComplete}
                />
              </>
            )}

            {/* Source Marker */}
            {scenario?.sourceCountry?.coords && (
              <Marker coordinates={scenario.sourceCountry.coords}>
                {/* City Label */}
                <text
                  textAnchor="middle"
                  y={-20}
                  style={{
                    fontSize: '11px',
                    fill: '#1C2D38',
                    fontWeight: '600',
                    pointerEvents: 'none'
                  }}
                >
                  {scenario.sourceCountry.city}
                </text>
                {/* Outer pulse ring */}
                <circle
                  r={12}
                  fill="none"
                  stroke="#00A35C"
                  strokeWidth={2}
                  opacity={0.4}
                  style={{ animation: 'markerPulse 2s ease-out infinite' }}
                />
                {/* Main dot */}
                <circle
                  r={8}
                  fill="#00A35C"
                  stroke="white"
                  strokeWidth={2}
                />
              </Marker>
            )}

            {/* Target Marker */}
            {scenario?.targetCountry?.coords && (
              <Marker coordinates={scenario.targetCountry.coords}>
                {/* City Label */}
                <text
                  textAnchor="middle"
                  y={-20}
                  style={{
                    fontSize: '11px',
                    fill: '#1C2D38',
                    fontWeight: '600',
                    pointerEvents: 'none'
                  }}
                >
                  {scenario.targetCountry.city}
                </text>
                {/* Outer pulse ring */}
                <circle
                  r={12}
                  fill="none"
                  stroke={
                    // For crypto scenarios with finalCountry, target is intermediate - show green when complete but no checkmark
                    // For regular scenarios, target is final destination - show green with checkmark
                    (isJourneyComplete && !scenario?.finalCountry) ? '#00A35C' :
                    (scenario?.finalCountry ? '#FFC010' : '#0B61A4')
                  }
                  strokeWidth={2}
                  opacity={0.4}
                  style={{
                    animation: (isJourneyComplete && !scenario?.finalCountry)
                      ? 'successPulse 0.8s ease-out'
                      : 'markerPulse 2s ease-out infinite 0.5s'
                  }}
                />
                {/* Main dot */}
                <circle
                  r={8}
                  fill={
                    (isJourneyComplete && !scenario?.finalCountry) ? '#00A35C' :
                    (scenario?.finalCountry ? '#FFC010' : '#0B61A4')
                  }
                  stroke="white"
                  strokeWidth={2}
                  style={{ transition: 'fill 0.3s ease' }}
                />
                {/* Checkmark when complete - only for non-crypto scenarios (no finalCountry) */}
                {isJourneyComplete && !scenario?.finalCountry && (
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="10"
                    fontWeight="bold"
                    fill="white"
                    style={{ pointerEvents: 'none' }}
                  >
                    ✓
                  </text>
                )}
              </Marker>
            )}

            {/* Third Hop Arc - appears only after blockchain settlement (crypto_complete) */}
            {/* Rendered BEFORE marker so marker appears on top */}
            {scenario?.finalCountry?.coords && scenario?.targetCountry?.coords &&
             firstLegAnimationComplete && (
              <CustomArcPath
                from={scenario.targetCountry.coords}
                to={scenario.finalCountry.coords}
                stroke="#7C3AED"
                strokeWidth={2.5}
                isStreaming={false}
              />
            )}

            {/* Final Destination Marker - appears when payment reaches intermediate (hop1_complete) */}
            {/* Rendered AFTER arc so it appears on top */}
            {scenario?.finalCountry?.coords && showFinalDestination && (
              <Marker coordinates={scenario.finalCountry.coords}>
                {/* City Label */}
                <text
                  textAnchor="middle"
                  y={-20}
                  style={{
                    fontSize: '11px',
                    fill: '#1C2D38',
                    fontWeight: '600',
                    pointerEvents: 'none',
                    animation: 'fadeIn 0.5s ease-out forwards'
                  }}
                >
                  {scenario.finalCountry.city}
                </text>
                {/* Animated entrance group */}
                <g style={{ animation: 'popIn 0.5s ease-out forwards' }}>
                  {/* Outer pulse ring */}
                  <circle
                    r={12}
                    fill="none"
                    stroke={isJourneyComplete ? '#00A35C' : (firstLegAnimationComplete ? '#7C3AED' : '#FFC010')}
                    strokeWidth={2}
                    opacity={0.4}
                    style={{
                      animation: isJourneyComplete
                        ? 'successPulse 0.8s ease-out'
                        : 'markerPulse 2s ease-out infinite 1s'
                    }}
                  />
                  {/* Main dot - Green when complete, Purple when arc active, Yellow when waiting */}
                  <circle
                    r={8}
                    fill={isJourneyComplete ? '#00A35C' : (firstLegAnimationComplete ? '#7C3AED' : '#FFC010')}
                    stroke="white"
                    strokeWidth={2}
                    style={{ transition: 'fill 0.3s ease' }}
                  />
                  {/* Checkmark when complete */}
                  {isJourneyComplete && (
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="10"
                      fontWeight="bold"
                      fill="white"
                      style={{ pointerEvents: 'none' }}
                    >
                      ✓
                    </text>
                  )}
                </g>
                {/* Crypto Badge - below marker (hide when complete) */}
                {!isJourneyComplete && (
                  <text
                    textAnchor="middle"
                    y={22}
                    style={{
                      fontSize: '8px',
                      fill: firstLegAnimationComplete ? '#7C3AED' : '#FFC010',
                      fontWeight: '700',
                      pointerEvents: 'none',
                      animation: 'fadeIn 0.5s ease-out 0.2s forwards',
                      opacity: 0
                    }}
                  >
                    {firstLegAnimationComplete ? 'SOLANA' : 'AWAITING'}
                  </text>
                )}
              </Marker>
            )}
          </ComposableMap>
          {/* Story overlay - appears over the map */}
          {scenario?.story && (
            <StoryOverlay
              story={scenario.story}
              isActive={isActive}
              isStreaming={isStreaming}
              events={events}
              sourceCoords={scenario.sourceCountry?.coords}
              targetCoords={scenario.targetCountry?.coords}
            />
          )}
          </>
            )}
          </>
        ) : (
          /* Backend Tab - Conversion Flow Pipeline */
          !isActive ? (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
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
                  background: 'linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px auto'
                }}>
                  <Icon glyph="Code" size="xlarge" fill="#E65100" />
                </div>
                <Body weight="medium" style={{
                  fontSize: '18px',
                  color: '#1C2D38',
                  marginBottom: '8px'
                }}>
                  Select a scenario to begin
                </Body>
                <Body style={{
                  fontSize: '14px',
                  color: '#5C6C75',
                  maxWidth: '280px',
                  lineHeight: '1.5'
                }}>
                  Backend processing details and conversion pipeline will appear here
                </Body>
              </div>
            </div>
          ) : (
            <ConversionFlowPipeline
              sourceFormat={scenario?.sourceFormat || 'MT103'}
              targetFormat={scenario?.targetFormat || 'pacs.008'}
              sourceMessage={scenario?.message || ''}
              targetMessage={output}
              events={events}
              stats={stats}
              totalTime={totalTime}
              hop1Details={hop1Details}
              hop2Details={hop2Details}
              conversionRunId={conversionRunId}
            />
          )
        )}
      </div>

      {/* Animations */}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            stroke-width: 2.5;
          }
          50% {
            opacity: 0.6;
            stroke-width: 3.5;
          }
        }

        @keyframes markerPulse {
          0% {
            r: 12;
            opacity: 0.4;
          }
          100% {
            r: 20;
            opacity: 0;
          }
        }

        @keyframes travelPulse {
          0%, 100% {
            r: 12;
            opacity: 0.5;
          }
          50% {
            r: 16;
            opacity: 0.2;
          }
        }

        @keyframes errorPulse {
          0%, 100% {
            r: 16;
            opacity: 0.8;
          }
          50% {
            r: 24;
            opacity: 0.2;
          }
        }

        @keyframes agentPulse {
          0%, 100% {
            r: 12;
            opacity: 0.7;
          }
          50% {
            r: 18;
            opacity: 0.3;
          }
        }

        @keyframes slideInFromTop {
          0% {
            transform: translateY(-20px);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes successPulse {
          0% {
            r: 10;
            opacity: 0.8;
          }
          50% {
            r: 20;
            opacity: 0.4;
          }
          100% {
            r: 16;
            opacity: 0;
          }
        }

        @keyframes successTravelPulse {
          0%, 100% {
            r: 12;
            opacity: 0.6;
          }
          50% {
            r: 18;
            opacity: 0.3;
          }
        }

        @keyframes fadeIn {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }

        @keyframes popIn {
          0% {
            transform: scale(0) translateY(10px);
            opacity: 0;
          }
          50% {
            transform: scale(1.2) translateY(-2px);
          }
          100% {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
        }

        @keyframes pillFadeIn {
          0% {
            opacity: 0;
            transform: translateY(8px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes cardSlideIn {
          0% {
            opacity: 0;
            transform: translateY(-10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </Card>
  );
}
