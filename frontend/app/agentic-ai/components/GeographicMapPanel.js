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
 * CustomStraightLine Component
 * Renders a straight line between coordinates, avoiding geodesic shortest path
 * This ensures lines go "the long way" when needed (e.g., USA to India across Pacific)
 */
function CustomStraightLine({ from, to, stroke, strokeWidth, isStreaming }) {
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

  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={stroke}
      strokeWidth={strokeWidth}
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
function EventBadge({ event, x, y, isActive }) {
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
  const maxWidth = 180;
  const lineHeight = 14;
  const padding = 8;
  const titleHeight = 16;
  const detailsHeight = config.details.length * lineHeight;
  const totalHeight = titleHeight + detailsHeight + (padding * 2);

  return (
    <g style={{
      opacity: isActive ? 1 : 0,
      transition: 'opacity 0.3s ease'
    }}>
      {/* Badge background */}
      <rect
        x={x - maxWidth / 2}
        y={y - totalHeight - 30}
        width={maxWidth}
        height={totalHeight}
        rx={4}
        fill="white"
        fillOpacity={0.95}
        stroke="#E7EAEE"
        strokeWidth={1}
        filter="url(#badge-shadow)"
      />

      {/* Color indicator bar */}
      <rect
        x={x - maxWidth / 2}
        y={y - totalHeight - 30}
        width={4}
        height={totalHeight}
        rx={4}
        fill={config.color}
      />

      {/* Title */}
      <text
        x={x - maxWidth / 2 + padding + 4}
        y={y - totalHeight - 30 + padding + 12}
        fontSize={11}
        fontWeight="600"
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
          y={y - totalHeight - 30 + padding + titleHeight + 4 + (i * lineHeight) + 10}
          fontSize={9}
          fill="#5C6C75"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {detail.length > 28 ? detail.substring(0, 25) + '...' : detail}
        </text>
      ))}

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
  const [journeyState, setJourneyState] = React.useState({
    progress: 0, // 0-100
    status: 'idle', // idle, traveling, error, agent_working, resolved, complete
    errorPosition: null
  });

  // Calculate journey state based on events
  React.useEffect(() => {
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

    if (isComplete) {
      setJourneyState({ progress: 100, status: 'complete', errorPosition: null });
    } else if (hasAgentComplete && !isComplete) {
      // Agent resolved, continuing journey
      setJourneyState(prev => ({ ...prev, status: 'resolved' }));
    } else if (hasAgentStart) {
      // Agent is working on the issue
      setJourneyState(prev => ({ ...prev, status: 'agent_working' }));
    } else if (hasError) {
      // Error occurred, stop at ~50% of journey
      setJourneyState({ progress: 50, status: 'error', errorPosition: 50 });
    } else if (isStreaming) {
      // Normal progress
      setJourneyState(prev => ({
        ...prev,
        status: 'traveling',
        progress: Math.min(prev.progress + 2, 95) // Cap at 95% until complete
      }));
    }
  }, [events, isStreaming]);

  // Animate progress when traveling or resolved
  React.useEffect(() => {
    if (journeyState.status === 'traveling' || journeyState.status === 'resolved') {
      const interval = setInterval(() => {
        setJourneyState(prev => {
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

  // Calculate marker position along the line
  const progress = journeyState.progress / 100;
  const markerX = x1 + (x2 - x1) * progress;
  const markerY = y1 + (y2 - y1) * progress;

  // Calculate error position if exists
  let errorX, errorY;
  if (journeyState.errorPosition) {
    const errorProgress = journeyState.errorPosition / 100;
    errorX = x1 + (x2 - x1) * errorProgress;
    errorY = y1 + (y2 - y1) * errorProgress;
  }

  // Get marker color based on status
  const getMarkerColor = () => {
    switch (journeyState.status) {
      case 'error': return '#CD4246'; // Red
      case 'agent_working': return '#FFC010'; // Yellow
      case 'resolved': return '#0B61A4'; // Blue
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

  // Determine which event to show on marker
  const currentEvent = lastEvent?.type !== 'complete' ? lastEvent : null;

  return (
    <g>
      {/* Error marker if present */}
      {journeyState.errorPosition && journeyState.status !== 'complete' && (
        <g>
          {/* Error pulse ring */}
          <circle
            cx={errorX}
            cy={errorY}
            r={8}
            fill="none"
            stroke="#CD4246"
            strokeWidth={2}
            style={{
              animation: journeyState.status === 'error' || journeyState.status === 'agent_working'
                ? 'errorPulse 1.5s infinite'
                : 'none'
            }}
          />
          {/* Error dot */}
          <circle
            cx={errorX}
            cy={errorY}
            r={4}
            fill="#CD4246"
          />
          {/* Error event badge - stays at error location */}
          {errorEvent && (
            <EventBadge
              event={errorEvent}
              x={errorX}
              y={errorY}
              isActive={journeyState.status === 'error' || journeyState.status === 'agent_working'}
            />
          )}
        </g>
      )}

      {/* Traveling payment marker */}
      {journeyState.progress > 0 && journeyState.status !== 'complete' && (
        <g>
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
              animation: journeyState.status === 'agent_working'
                ? 'agentPulse 1s infinite'
                : 'travelPulse 1s infinite'
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
          />
          {/* Current event badge - follows marker */}
          {currentEvent && currentEvent.type !== 'validation_failed' && (
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
            <Icon glyph="Globe" size="xlarge" fill="#C1C7CD" />
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

            {/* Payment Route Line - Using custom straight line to avoid geodesic wrapping */}
            {scenario?.sourceCountry?.coords && scenario?.targetCountry?.coords && (
              <>
                <CustomStraightLine
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
            r: 8;
            opacity: 1;
          }
          50% {
            r: 14;
            opacity: 0.3;
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
      `}</style>
    </Card>
  );
}
