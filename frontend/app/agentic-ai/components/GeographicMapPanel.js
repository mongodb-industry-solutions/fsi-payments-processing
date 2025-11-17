'use client';

import React, { useState } from 'react';
import { H2, Body } from '@leafygreen-ui/typography';
import Card from '@leafygreen-ui/card';
import Icon from '@leafygreen-ui/icon';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  useMapContext
} from 'react-simple-maps';

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
 * EventBadge Component
 * Displays event details on the map
 */
function EventBadge({ event, x, y, isActive, showHealingButton, onHealingStart }) {
  if (!event) return null;

  // Get badge configuration based on event type
  const getBadgeConfig = () => {
    switch (event.type) {
      case 'hop1_start':
      case 'hop2_start':
        return {
          title: 'CONVERTING',
          color: '#0B61A4',
          details: [`${event.source || ''} → ${event.target || ''}`]
        };
      case 'validation_failed':
        return {
          title: 'VALIDATION ERROR',
          color: '#CD4246',
          details: [
            event.field ? `Field: ${event.field}` : null,
            event.country ? `Country: ${event.country}` : null,
            event.message || event.error || 'Validation failed'
          ].filter(Boolean)
        };
      case 'agent_start':
        return {
          title: 'AGENT RESOLVING',
          color: '#FFC010',
          details: [event.task_type || 'Processing issue']
        };
      case 'agent_supervisor':
        return {
          title: 'AGENT ROUTING',
          color: '#FFC010',
          details: [
            event.next_agent ? `Next: ${event.next_agent}` : null,
            event.reasoning || null
          ].filter(Boolean)
        };
      case 'tool_call':
        return {
          title: 'TOOL EXECUTING',
          color: '#7C4DFF',
          details: [event.tool || 'Tool call']
        };
      case 'agent_complete':
        return {
          title: 'RESOLVED',
          color: '#00A35C',
          details: [
            event.field ? `Field: ${event.field}` : null,
            'Issue resolved successfully'
          ].filter(Boolean)
        };
      case 'complete':
        return {
          title: 'SUCCESS',
          color: '#00A35C',
          details: ['Conversion completed']
        };
      default:
        return {
          title: event.type.toUpperCase().replace(/_/g, ' '),
          color: '#5C6C75',
          details: []
        };
    }
  };

  const config = getBadgeConfig();
  const maxWidth = 280;  // Increased from 180 for better readability
  const lineHeight = 16;  // Increased from 14 for larger text
  const padding = 10;  // Increased from 8 for more breathing room
  const titleHeight = 18;  // Increased from 16 for larger title
  const detailsHeight = config.details.length * lineHeight;
  const buttonHeight = showHealingButton ? 50 : 0;  // Add space for button if needed
  const totalHeight = titleHeight + detailsHeight + buttonHeight + (padding * 2);

  return (
    <g style={{
      opacity: isActive ? 1 : 0,
      transition: 'opacity 0.5s ease-in-out',
      pointerEvents: isActive ? 'auto' : 'none'
    }}>
      {/* Badge background */}
      <rect
        x={x - maxWidth / 2}
        y={y - totalHeight - 50}
        width={maxWidth}
        height={totalHeight}
        rx={4}
        fill="white"
        fillOpacity={0.98}
        stroke="#E7EAEE"
        strokeWidth={1}
        filter="url(#badge-shadow)"
        style={{ transition: 'all 0.3s ease' }}
      />

      {/* Color indicator bar */}
      <rect
        x={x - maxWidth / 2}
        y={y - totalHeight - 50}
        width={4}
        height={totalHeight}
        rx={4}
        fill={config.color}
      />

      {/* Title */}
      <text
        x={x - maxWidth / 2 + padding + 4}
        y={y - totalHeight - 50 + padding + 13}
        fontSize={13}
        fontWeight="700"
        fill={config.color}
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {config.title}
      </text>

      {/* Details */}
      {config.details.map((detail, i) => (
        <text
          key={i}
          x={x - maxWidth / 2 + padding + 4}
          y={y - totalHeight - 50 + padding + titleHeight + 6 + (i * lineHeight) + 11}
          fontSize={11}
          fill="#5C6C75"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {detail.length > 50 ? detail.substring(0, 47) + '...' : detail}
        </text>
      ))}

      {/* Self-Healing Agent Button */}
      {showHealingButton && onHealingStart && (
        <g
          onClick={(e) => {
            e.stopPropagation();
            onHealingStart();
          }}
          style={{ cursor: 'pointer' }}
        >
          {console.log('🎨 RENDERING BUTTON at:', x, y, 'showHealingButton:', showHealingButton)}
          {/* Button background */}
          <rect
            x={x - 120}  // 240px wide button centered
            y={y - totalHeight - 50 + padding + titleHeight + detailsHeight + 16}
            width={240}
            height={40}
            rx={6}
            fill="#00A35C"
            style={{ cursor: 'pointer', pointerEvents: 'auto' }}
            onMouseEnter={(e) => e.currentTarget.setAttribute('fill', '#008F4D')}
            onMouseLeave={(e) => e.currentTarget.setAttribute('fill', '#00A35C')}
          />
          {/* Button text */}
          <text
            x={x}
            y={y - totalHeight - 50 + padding + titleHeight + detailsHeight + 36}
            fontSize={14}
            fontWeight="700"
            fill="white"
            textAnchor="middle"
            fontFamily="system-ui, -apple-system, sans-serif"
            style={{ pointerEvents: 'none' }}
          >
            🤖 Self-Healing Agent
          </text>
        </g>
      )}
      {showHealingButton && !onHealingStart && console.log('⚠️ Button requested but no handler provided')}

      {/* Drop shadow filter definition */}
      <defs>
        <filter id="badge-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15"/>
        </filter>
      </defs>
    </g>
  );
}

/**
 * AnimatedPaymentJourney Component
 * Visualizes payment traveling along the route with error handling
 */
function AnimatedPaymentJourney({ from, to, events, isStreaming }) {
  const { projection } = useMapContext();

  // Configuration constants
  const ERROR_PAUSE_DURATION_MS = 3000; // 3 seconds pause on error

  // Self-healing agent state
  const [healingStarted, setHealingStarted] = React.useState(false);

  const [journeyState, setJourneyState] = React.useState({
    progress: 0, // 0-100
    status: 'idle', // idle, traveling, error_awaiting_healing, agent_working, resolved, complete
    errorPosition: null,
    errorPauseEndTime: null, // Timestamp when error pause should end
    resolvedTimestamp: null // When resolution happened (for fade-out timing)
  });

  // Calculate journey state based on events
  React.useEffect(() => {
    console.log('🔄 Journey State Update - Events:', events.length, 'isStreaming:', isStreaming);

    if (!isStreaming && events.length === 0) {
      setJourneyState({ progress: 0, status: 'idle', errorPosition: null });
      return;
    }

    // Determine current state from events
    const lastEvent = events[events.length - 1];
    const hasError = events.some(e => e.type === 'validation_failed');
    const hasAgentStart = events.some(e => e.type === 'agent_start');
    const hasAgentComplete = events.some(e => e.type === 'agent_complete');
    const isComplete = lastEvent?.type === 'complete';

    console.log('📊 Event Analysis:', {
      lastEventType: lastEvent?.type,
      hasError,
      hasAgentStart,
      hasAgentComplete,
      isComplete
    });

    if (isComplete) {
      setJourneyState({ progress: 100, status: 'complete', errorPosition: null, errorPauseEndTime: null, resolvedTimestamp: null });
    } else if (hasAgentComplete && !isComplete) {
      // Agent resolved, continuing journey
      setJourneyState(prev => ({ 
        ...prev, 
        status: 'resolved',
        resolvedTimestamp: prev.resolvedTimestamp || Date.now() // Set timestamp on first resolution
      }));
    } else if (hasError && !healingStarted) {
      // Error occurred, stop and wait for user to trigger healing (CHECK THIS FIRST!)
      console.log('🚨 ERROR DETECTED - Waiting for user to start healing');
      setJourneyState({
        progress: 50,
        status: 'error_awaiting_healing',
        errorPosition: 50,
        errorPauseEndTime: null // No time limit - wait for user interaction
      });
    } else if (hasAgentStart && hasError && healingStarted) {
      // Agent is working on an error (only if user triggered healing)
      console.log('🔧 Agent working on error - Setting errorPosition at 50%');
      setJourneyState(prev => ({
        ...prev,
        status: 'agent_working',
        errorPosition: prev.errorPosition || 50,  // Preserve existing or set to 50
        progress: prev.errorPosition || 50,
        errorPauseEndTime: prev.errorPauseEndTime || (Date.now() + ERROR_PAUSE_DURATION_MS)
      }));
    } else if (hasAgentStart) {
      // Agent is working on non-error issue
      setJourneyState(prev => ({ ...prev, status: 'agent_working' }));
    } else if (isStreaming) {
      // Normal progress
      setJourneyState(prev => ({
        ...prev,
        status: 'traveling',
        progress: Math.min(prev.progress + 2, 95) // Cap at 95% until complete
      }));
    }
  }, [events, isStreaming, healingStarted, ERROR_PAUSE_DURATION_MS]);

  // Animate progress when traveling or resolved
  React.useEffect(() => {
    if (journeyState.status === 'traveling' || journeyState.status === 'resolved') {
      const interval = setInterval(() => {
        setJourneyState(prev => {
          // Check if error pause is still active
          if (prev.errorPauseEndTime && Date.now() < prev.errorPauseEndTime) {
            return prev; // Pause progress during error display
          }

          if (prev.progress >= 95 && journeyState.status === 'traveling') {
            return prev; // Wait for complete event
          }
          if (prev.status === 'resolved' && prev.progress >= 100) {
            return prev; // Wait for complete event
          }
          return {
            ...prev,
            progress: Math.min(prev.progress + 1, journeyState.status === 'resolved' ? 100 : 95)
          };
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [journeyState.status]);

  // Clear error marker after resolution with delay (for smooth fade-out)
  React.useEffect(() => {
    if (journeyState.status === 'resolved' && journeyState.resolvedTimestamp) {
      const RESOLUTION_DISPLAY_TIME = 1500; // Show success for 1.5 seconds
      const timer = setTimeout(() => {
        setJourneyState(prev => ({
          ...prev,
          errorPosition: null, // Clear error marker to hide success indicator
          errorPauseEndTime: null
        }));
      }, RESOLUTION_DISPLAY_TIME);
      return () => clearTimeout(timer);
    }
  }, [journeyState.status, journeyState.resolvedTimestamp]);

  // Handler for starting the self-healing agent
  const handleStartHealing = () => {
    console.log('🤖 User triggered self-healing agent');
    setHealingStarted(true);
  };

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

  // Get current and error events for badge display
  const errorEvent = events.find(e => e.type === 'validation_failed');
  const lastEvent = events.length > 0 ? events[events.length - 1] : null;

  // Get most recent agent event for progress indicator
  const agentEvents = events.filter(e => 
    e.type === 'agent_start' || 
    e.type === 'agent_supervisor' || 
    e.type === 'tool_call' || 
    e.type === 'agent_complete'
  );
  const currentAgentEvent = agentEvents.length > 0 ? agentEvents[agentEvents.length - 1] : null;

  console.log('🏷️ Badge Render Check:', {
    errorEvent: errorEvent?.type || 'none',
    errorField: errorEvent?.field,
    journeyStatus: journeyState.status,
    errorPosition: journeyState.errorPosition,
    currentAgentEvent: currentAgentEvent?.type || 'none',
    shouldRenderBadge: !!(errorEvent && journeyState.errorPosition && journeyState.status !== 'complete')
  });

  // Determine which event to show on marker (non-error travel events)
  const currentEvent = lastEvent?.type !== 'complete' && lastEvent?.type !== 'validation_failed' ? lastEvent : null;

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
          
          {/* Main badge - shows error, agent progress, or success */}
          {journeyState.status === 'resolved' ? (
            // Success badge when resolved
            <EventBadge
              event={{
                type: 'agent_complete',
                field: errorEvent?.field,
                message: 'Issue resolved successfully'
              }}
              x={errorX}
              y={errorY}
              isActive={true}
              showHealingButton={false}
            />
          ) : (
            // Error badge - shows validation error (stable)
            errorEvent && (
              <EventBadge
                event={errorEvent}
                x={errorX}
                y={errorY}
                isActive={true}
                showHealingButton={journeyState.status === 'error_awaiting_healing'}
                onHealingStart={handleStartHealing}
              />
            )
          )}
          
          {/* Agent progress badge - shows above main badge during healing */}
          {journeyState.status === 'agent_working' && currentAgentEvent && (
            <g 
              key={`agent-badge-${currentAgentEvent.type}-${agentEvents.length}`}
              style={{
                opacity: 1,
                animation: 'slideInFromTop 0.4s ease-out',
                transition: 'all 0.4s ease'
              }}>
              <EventBadge
                event={currentAgentEvent}
                x={errorX}
                y={errorY - 120}
                isActive={true}
                showHealingButton={false}
              />
            </g>
          )}
        </g>
      )}

      {/* Traveling payment marker */}
      {journeyState.progress > 0 && journeyState.status !== 'complete' && journeyState.status !== 'error_awaiting_healing' && journeyState.status !== 'agent_working' && (
        <g style={{
          opacity: journeyState.status === 'resolved' ? 1 : 1,
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
              transition: 'stroke 0.5s ease'
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
            style={{ transition: 'fill 0.5s ease' }}
          />
          {/* Current event badge - follows marker */}
          {currentEvent && currentEvent.type !== 'validation_failed' && journeyState.status !== 'resolved' && (
            <EventBadge
              event={currentEvent}
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
 * GeographicMapPanel Component
 * Interactive world map showing payment journey from source to target country
 *
 * @param {Object} props
 * @param {boolean} props.isActive - Whether a scenario is selected/running
 * @param {Object} props.scenario - Current scenario with source/target countries
 * @param {boolean} props.isStreaming - Whether conversion is in progress
 * @param {Array} props.events - Stream events for journey animation
 */
export default function GeographicMapPanel({ isActive, scenario, isStreaming, events = [] }) {
  const [hoveredCountry, setHoveredCountry] = useState(null);

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
        height: '600px',
        display: 'flex',
        flexDirection: 'column',
        background: '#F9FBFA',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid #E7EAEE',
        background: 'white'
      }}>
        <H2>Payment Journey Visualization</H2>
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
        {!isActive ? (
          /* Empty State */
          <div style={{
            textAlign: 'center',
            zIndex: 1
          }}>
            <Icon glyph="Charts" size="xlarge" fill="#C1C7CD" />
            <Body weight="medium" style={{
              fontSize: '16px',
              color: '#5C6C75',
              marginTop: '16px',
              marginBottom: '8px'
            }}>
              Select a scenario to begin
            </Body>
            <Body style={{
              fontSize: '14px',
              color: '#889397'
            }}>
              Geographic visualization will show payment routing
            </Body>
          </div>
        ) : (
          /* Interactive World Map */
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
                          outline: 'none',
                          transition: 'all 0.3s ease'
                        },
                        hover: {
                          fill: isHighlighted ? '#00854A' : '#D9DDE0',
                          stroke: '#FFFFFF',
                          strokeWidth: 0.5,
                          outline: 'none',
                          cursor: isHighlighted ? 'pointer' : 'default'
                        },
                        pressed: {
                          fill: isHighlighted ? '#00703D' : '#D9DDE0',
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
                />
              </>
            )}

            {/* Source Marker */}
            {scenario?.sourceCountry?.coords && (
              <Marker coordinates={scenario.sourceCountry.coords}>
                <g transform="translate(-12, -24)">
                  {/* Pin Shape */}
                  <path
                    d="M12 0C7.03 0 3 4.03 3 9c0 5.25 9 15 9 15s9-9.75 9-15c0-4.97-4.03-9-9-9z"
                    fill="#00A35C"
                    stroke="white"
                    strokeWidth="1.5"
                  />
                  {/* Flag Emoji */}
                  <text
                    textAnchor="middle"
                    x={12}
                    y={11}
                    style={{
                      fontSize: '10px',
                      pointerEvents: 'none'
                    }}
                  >
                    {scenario.sourceCountry.flag}
                  </text>
                </g>
                {/* City Label */}
                <text
                  textAnchor="middle"
                  y={-28}
                  style={{
                    fontSize: '11px',
                    fill: '#1C2D38',
                    fontWeight: '600',
                    pointerEvents: 'none'
                  }}
                >
                  {scenario.sourceCountry.city}
                </text>
              </Marker>
            )}

            {/* Target Marker */}
            {scenario?.targetCountry?.coords && (
              <Marker coordinates={scenario.targetCountry.coords}>
                <g transform="translate(-12, -24)">
                  {/* Pin Shape */}
                  <path
                    d="M12 0C7.03 0 3 4.03 3 9c0 5.25 9 15 9 15s9-9.75 9-15c0-4.97-4.03-9-9-9z"
                    fill="#0B61A4"
                    stroke="white"
                    strokeWidth="1.5"
                  />
                  {/* Flag Emoji */}
                  <text
                    textAnchor="middle"
                    x={12}
                    y={11}
                    style={{
                      fontSize: '10px',
                      pointerEvents: 'none'
                    }}
                  >
                    {scenario.targetCountry.flag}
                  </text>
                </g>
                {/* City Label */}
                <text
                  textAnchor="middle"
                  y={-28}
                  style={{
                    fontSize: '11px',
                    fill: '#1C2D38',
                    fontWeight: '600',
                    pointerEvents: 'none'
                  }}
                >
                  {scenario.targetCountry.city}
                </text>
              </Marker>
            )}
          </ComposableMap>
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
      `}</style>
    </Card>
  );
}
