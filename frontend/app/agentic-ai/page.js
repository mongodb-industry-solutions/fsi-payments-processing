'use client';

import { useState, useEffect, useRef } from 'react';
import Banner from '@leafygreen-ui/banner';
import CollapsibleScenariosPanel from './components/CollapsibleScenariosPanel';
import GeographicMapPanel from './components/GeographicMapPanel';
import TransactionAgentPanel from './components/TransactionAgentPanel';
import HumanReviewModal from './components/HumanReviewModal';
import { getAllScenarios, getScenario } from './scenarios';

// Use Next.js API routes to proxy to converter sidecar
// Browser → /api/... → Next.js server → 127.0.0.1:8001 (converter)

/**
 * Filter events to show only agent-related activities
 * Conversion hop events (MT103→JSON, JSON→pacs.008) are handled by the converter service,
 * not by the Transaction Agent, so we exclude them from the agent panel.
 */
function isAgentRelatedEvent(event) {
  const agentEventTypes = [
    'validation_failed',  // Triggers agent intervention
    'agent_start',        // Agent begins processing
    'agent_supervisor',   // Supervisor routing decision
    'tool_call',          // Tool invocation (IFSC lookup, transliteration)
    'tool_result',        // Tool results
    'agent_resolution',   // Proposed solution
    'review_approved',    // Human approved change
    'review_rejected',    // Human rejected change
    'agent_execution_start', // Execution agent starting
    'agent_execution',    // Field update
    'agent_complete',     // Agent finished
    'error'               // Errors
  ];

  return agentEventTypes.includes(event.type);
}

/**
 * Filter events to show only conversion hop activities
 * For non-agentic scenarios (like card payments), show the conversion flow instead.
 * Also includes crypto settlement events for blockchain scenarios.
 */
function isConversionHopEvent(event) {
  const hopEventTypes = [
    'start',           // Conversion started
    'hop1_start',      // First hop begins
    'hop1_complete',   // First hop completes
    'hop2_start',      // Second hop begins
    'hop2_complete',   // Second hop completes
    'complete',        // Conversion finished
    'error',           // Errors
    // Crypto/blockchain settlement events
    'crypto_start',           // Blockchain settlement starting
    'crypto_wallet_extract',  // Extracting wallet addresses
    'crypto_balance_check',   // Verifying sender balance
    'crypto_tx_build',        // Building transaction
    'crypto_tx_sign',         // Signing transaction
    'crypto_tx_submit',       // Submitting to network
    'crypto_tx_confirm',      // Transaction confirmed
    'crypto_complete'         // Blockchain settlement complete
  ];

  return hopEventTypes.includes(event.type);
}

/**
 * Check if an event is crypto/blockchain related
 * These events need longer delays for better demo pacing
 */
function isCryptoEvent(event) {
  const cryptoEventTypes = [
    'crypto_start',
    'crypto_wallet_extract',
    'crypto_balance_check',
    'crypto_tx_build',
    'crypto_tx_sign',
    'crypto_tx_submit',
    'crypto_tx_confirm',
    'crypto_complete'
  ];
  return cryptoEventTypes.includes(event.type);
}

export default function AgenticAIPage() {
  // State Management
  const [isPanelExpanded, setIsPanelExpanded] = useState(true);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [events, setEvents] = useState([]);
  const [output, setOutput] = useState('');
  const [stats, setStats] = useState(null);
  const [totalTime, setTotalTime] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [expandedEvents, setExpandedEvents] = useState(new Set());
  const [hop1Details, setHop1Details] = useState(null);
  const [hop2Details, setHop2Details] = useState(null);
  const [conversionRunId, setConversionRunId] = useState(null);

  // Cache for scenario results - persists results when switching between scenarios
  // Using ref to avoid stale closure issues with async state updates
  const scenarioResultsCache = useRef({});

  // Event display throttling for non-agentic scenarios
  // Queue events and release them at a controlled rate for better UX
  const eventQueueRef = useRef([]);
  const throttleTimerRef = useRef(null);
  const pendingOutputRef = useRef(null); // Store output until queue is empty
  const EVENT_DISPLAY_DELAY = 400; // ms between events for non-agentic scenarios
  const CRYPTO_EVENT_DELAY = 1000; // ms between events for crypto scenarios (~10s total, ensures 1s per card)

  // Human-in-the-loop review state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [reviewThreadId, setReviewThreadId] = useState(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // AI/Rules mode toggle - controls whether to use LLM or regex for unstructured fields
  const [useAI, setUseAI] = useState(true);

  // Animation sync state - signals when transaction logs have finished rendering
  // This ensures the journey animation completes in sync with the logs panel
  const [logsRenderComplete, setLogsRenderComplete] = useState(false);

  const scenarios = getAllScenarios();

  // Filter events based on scenario type:
  // - Agentic scenarios (Japan, India): Show agent events (validation, tool calls, etc.)
  // - Non-agentic scenarios (card payment): Show conversion hop events
  const currentScenario = getScenario(selectedScenario);
  const isAgenticScenario = currentScenario?.isAgentic !== false;
  const displayEvents = isAgenticScenario
    ? events.filter(isAgentRelatedEvent)
    : events.filter(isConversionHopEvent);

  // Debug: Track hop details state changes
  useEffect(() => {
    console.log('🔄 hop1Details state changed:', hop1Details);
  }, [hop1Details]);

  useEffect(() => {
    console.log('🔄 hop2Details state changed:', hop2Details);
  }, [hop2Details]);

  // Cleanup throttle timer on unmount
  useEffect(() => {
    return () => {
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }
    };
  }, []);

  // Helper function to process the event queue with throttling
  const processEventQueue = () => {
    if (eventQueueRef.current.length === 0) {
      throttleTimerRef.current = null;
      // Apply pending output when queue is empty (so output appears after all events)
      if (pendingOutputRef.current) {
        const { output: pendingOutput, stats: pendingStats, totalTime: pendingTotalTime } = pendingOutputRef.current;
        if (pendingOutput) setOutput(pendingOutput);
        if (pendingStats) setStats(pendingStats);
        if (pendingTotalTime) setTotalTime(pendingTotalTime);
        pendingOutputRef.current = null;
      }
      return;
    }

    const nextEvent = eventQueueRef.current.shift();
    setEvents(prev => [...prev, nextEvent]);

    // Schedule next event with appropriate delay
    // Crypto scenarios and crypto events use longer delay for better demo pacing (~15s total)
    if (eventQueueRef.current.length > 0) {
      const scenario = getScenario(selectedScenario);
      const isCryptoScenario = scenario?.isCryptoSettlement === true;
      const upcomingEvent = eventQueueRef.current[0];
      const useCryptoDelay = isCryptoScenario || isCryptoEvent(nextEvent) || isCryptoEvent(upcomingEvent);
      const delay = useCryptoDelay ? CRYPTO_EVENT_DELAY : EVENT_DISPLAY_DELAY;
      throttleTimerRef.current = setTimeout(processEventQueue, delay);
    } else {
      // Queue just became empty - schedule one more call to apply pending output
      throttleTimerRef.current = setTimeout(processEventQueue, 100);
    }
  };

  // Helper Functions
  const addEvent = (eventData) => {
    const timestamp = new Date().toISOString();
    const id = `event-${Date.now()}-${Math.random()}`;
    const enrichedEvent = { ...eventData, timestamp, id };
    console.log('✅ Event Added:', eventData.type, eventData);

    // Check scenario properties for throttling decisions
    const scenario = getScenario(selectedScenario);
    const isNonAgentic = scenario?.isAgentic === false;
    const isCryptoScenario = scenario?.isCryptoSettlement === true;

    // Check if this event or scenario needs crypto-level delays
    const useCryptoDelay = isCryptoScenario || isCryptoEvent(eventData);

    if (isNonAgentic && isConversionHopEvent(eventData)) {
      // Queue the event for throttled display
      eventQueueRef.current.push(enrichedEvent);

      // Start processing if not already running
      if (!throttleTimerRef.current) {
        // Crypto scenarios use longer delays throughout for better demo pacing (~15s total)
        if (useCryptoDelay) {
          throttleTimerRef.current = setTimeout(processEventQueue, CRYPTO_EVENT_DELAY);
        } else {
          processEventQueue();
        }
      }
    } else {
      // Agentic scenarios - add immediately (agent processing provides natural delays)
      setEvents(prev => [...prev, enrichedEvent]);
    }
  };

  const toggleEventExpansion = (eventId) => {
    setExpandedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  const handleReset = () => {
    setSelectedScenario(null);
    setEvents([]);
    setOutput('');
    setStats(null);
    setTotalTime(0);
    setError(null);
    setExpandedEvents(new Set());
    setHop1Details(null);
    setHop2Details(null);
    setConversionRunId(null);
    scenarioResultsCache.current = {}; // Clear all cached results
    setIsPanelExpanded(true); // Re-expand panel on reset
    // Reset review state
    setIsReviewModalOpen(false);
    setReviewData(null);
    setReviewThreadId(null);
    setIsSubmittingReview(false);
    // Reset animation sync state
    setLogsRenderComplete(false);
    // Clear event queue and throttle timer
    eventQueueRef.current = [];
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }
  };

  const handleSelectScenario = (scenarioId) => {
    // Save current scenario results to cache before switching
    if (selectedScenario && (events.length > 0 || output)) {
      scenarioResultsCache.current[selectedScenario] = {
        events,
        output,
        stats,
        totalTime,
        error,
        hop1Details,
        hop2Details,
        conversionRunId,
        expandedEvents: Array.from(expandedEvents)
      };
    }

    // Switch to new scenario
    setSelectedScenario(scenarioId);

    // Auto-collapse panel after selection
    setIsPanelExpanded(false);

    // Restore cached results for new scenario (if any)
    const cached = scenarioResultsCache.current[scenarioId];
    if (cached) {
      setEvents(cached.events || []);
      setOutput(cached.output || '');
      setStats(cached.stats || null);
      setTotalTime(cached.totalTime || 0);
      setError(cached.error || null);
      setHop1Details(cached.hop1Details || null);
      setHop2Details(cached.hop2Details || null);
      setConversionRunId(cached.conversionRunId || null);
      setExpandedEvents(new Set(cached.expandedEvents || []));
    } else {
      // No cached results - start fresh
      setEvents([]);
      setOutput('');
      setStats(null);
      setTotalTime(0);
      setError(null);
      setHop1Details(null);
      setHop2Details(null);
      setConversionRunId(null);
      setExpandedEvents(new Set());
    }
  };

  const handleTogglePanel = () => {
    setIsPanelExpanded(!isPanelExpanded);
  };

  const handleSimulate = async () => {
    if (!selectedScenario) return;

    const scenario = getScenario(selectedScenario);

    setIsStreaming(true);
    setEvents([]);
    setOutput('');
    setStats(null);
    setTotalTime(0);
    setError(null);
    setHop1Details(null);
    setHop2Details(null);
    setConversionRunId(null);
    setLogsRenderComplete(false); // Reset animation sync
    // Clear event queue and pending output for fresh simulation
    eventQueueRef.current = [];
    pendingOutputRef.current = null;
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }

    try {
      const response = await fetch('/api/convert/multi-hop/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_format: scenario.sourceFormat,
          target_format: scenario.targetFormat,
          message: scenario.message,
          use_ai: useAI
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Backend error:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.substring(6));
              addEvent(eventData);

              // Handle start event - capture conversion_run_id
              if (eventData.type === 'start') {
                console.log('🚀 Received start event:', eventData);
                if (eventData.conversion_run_id) {
                  console.log('📦 Captured conversion_run_id:', eventData.conversion_run_id);
                  setConversionRunId(eventData.conversion_run_id);
                  console.log('✅ conversionRunId state updated');
                }
              }

              // Handle hop1_complete event - capture detailed processing
              if (eventData.type === 'hop1_complete') {
                console.log('📨 Received hop1_complete event:', eventData);
                if (eventData.detailed_processing) {
                  console.log('📦 Captured hop1 detailed processing:', eventData.detailed_processing);
                  setHop1Details(eventData.detailed_processing);
                  console.log('✅ hop1Details state updated');
                } else {
                  console.warn('⚠️ hop1_complete event missing detailed_processing field');
                }
              }

              // Handle hop2_complete event - capture detailed processing
              if (eventData.type === 'hop2_complete') {
                console.log('📨 Received hop2_complete event:', eventData);
                if (eventData.detailed_processing) {
                  console.log('📦 Captured hop2 detailed processing:', eventData.detailed_processing);
                  setHop2Details(eventData.detailed_processing);
                  console.log('✅ hop2Details state updated');
                } else {
                  console.warn('⚠️ hop2_complete event missing detailed_processing field');
                }
              }

              // Handle complete event
              if (eventData.type === 'complete') {
                const completeOutput = eventData.data?.output || eventData.output || '';
                const completeStats = eventData.data?.processing_stats || null;
                const completeTotalTime = eventData.data?.total_time || 0;

                // For throttled scenarios, store output until queue empties
                // This ensures the output card appears AFTER all events are displayed
                const completeScenario = getScenario(selectedScenario);
                const isThrottled = completeScenario?.isAgentic === false;

                if (isThrottled && eventQueueRef.current.length > 0) {
                  // Store for later - will be applied when queue empties
                  pendingOutputRef.current = {
                    output: completeOutput,
                    stats: completeStats,
                    totalTime: completeTotalTime
                  };
                } else {
                  // Not throttled or queue already empty - set immediately
                  setOutput(completeOutput);
                  setStats(completeStats);
                  setTotalTime(completeTotalTime);
                }
              }

              // Handle error event
              if (eventData.type === 'error') {
                setError(eventData.data?.message || eventData.message || 'Unknown error');
              }

              // Handle review_required event (human-in-the-loop)
              if (eventData.type === 'review_required') {
                console.log('👤 Human review required:', eventData);
                setReviewThreadId(eventData.thread_id);
                setReviewData(eventData);
                setIsReviewModalOpen(true);
                // Don't set isStreaming to false yet - we're paused, not done
              }
            } catch (e) {
              console.warn('Failed to parse SSE event:', line, e);
            }
          }
        }
      }
    } catch (err) {
      console.error('Streaming error:', err);
      setError(err.message);
    } finally {
      setIsStreaming(false);
    }
  };

  // Human review handlers
  const handleApproveReview = async (options = {}) => {
    if (!reviewThreadId) return;

    setIsSubmittingReview(true);
    setIsReviewModalOpen(false);  // Close modal immediately for snappier UX

    try {
      // Use streaming resume endpoint to get real execution events
      const response = await fetch('/api/agent/resume-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thread_id: reviewThreadId,
          decision: {
            approved: true,
            modified_value: options.modified_value || null
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Resume failed: ${response.status}`);
      }

      // Process SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              console.log('📡 Resume stream event:', event);

              // Add the event to the timeline
              if (event.type) {
                addEvent(event);
              }

              // Handle specific event types for state updates
              if (event.type === 'hop1_complete' && event.detailed_processing) {
                console.log('📦 Captured hop1 detailed processing from stream:', event.detailed_processing);
                setHop1Details(event.detailed_processing);
              }

              if (event.type === 'hop2_complete' && event.detailed_processing) {
                setHop2Details(event.detailed_processing);
              }

              if (event.type === 'complete') {
                if (event.output) {
                  setOutput(event.output);
                }
                if (event.processing_stats) {
                  setStats(event.processing_stats);
                }
                if (event.total_time) {
                  setTotalTime(event.total_time);
                }
              }

              if (event.type === 'error') {
                throw new Error(event.message || 'Unknown error');
              }
            } catch (parseErr) {
              console.warn('Failed to parse SSE event:', line, parseErr);
            }
          }
        }
      }

      console.log('✅ Resume streaming complete');

    } catch (err) {
      console.error('Error resuming workflow:', err);
      setError(`Failed to resume: ${err.message}`);
    } finally {
      setIsSubmittingReview(false);
      setIsStreaming(false);
    }
  };

  const handleRejectReview = async () => {
    if (!reviewThreadId) return;

    setIsSubmittingReview(true);

    try {
      // Use streaming resume endpoint for consistency
      const response = await fetch('/api/agent/resume-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thread_id: reviewThreadId,
          decision: {
            approved: false,
            modified_value: null
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Resume failed: ${response.status}`);
      }

      // Process SSE stream (will get review_rejected event)
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              console.log('📡 Reject stream event:', event);

              // Add the event to the timeline
              if (event.type) {
                addEvent(event);
              }
            } catch (parseErr) {
              console.warn('Failed to parse SSE event:', line, parseErr);
            }
          }
        }
      }

      setIsReviewModalOpen(false);
    } catch (err) {
      console.error('Error rejecting workflow:', err);
      setError(`Failed to reject: ${err.message}`);
    } finally {
      setIsSubmittingReview(false);
      setIsStreaming(false);
    }
  };

  const handleCloseReviewModal = () => {
    // Closing without decision is treated as rejection
    handleRejectReview();
  };

  return (
    <div style={{ padding: 'var(--space-xl, 32px)', maxWidth: 'var(--container-lg, 1920px)', margin: '0 auto' }}>
      {/* Error Banner */}
      {error && (
        <Banner variant="danger" style={{ marginBottom: '24px' }}>
          {error}
        </Banner>
      )}

      {/* Collapsible Scenarios Panel */}
      <CollapsibleScenariosPanel
        isExpanded={isPanelExpanded}
        onToggleExpand={handleTogglePanel}
        scenarios={scenarios}
        selectedScenario={selectedScenario}
        onSelectScenario={handleSelectScenario}
        onSimulate={handleSimulate}
        onReset={handleReset}
        isStreaming={isStreaming}
        useAI={useAI}
        onToggleAI={setUseAI}
      />

      {/* Two-Column Layout: Map + Agent Panel */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(400px, 3fr) minmax(320px, 2fr)',
        gap: 'var(--space-xl, 24px)'
      }}>
        {/* Left: Geographic Map Visualization */}
        <GeographicMapPanel
          isActive={selectedScenario !== null}
          scenario={getScenario(selectedScenario)}
          isStreaming={isStreaming}
          events={events}
          output={output}
          stats={stats}
          totalTime={totalTime}
          hop1Details={hop1Details}
          hop2Details={hop2Details}
          conversionRunId={conversionRunId}
          logsRenderComplete={logsRenderComplete}
        />

        {/* Right: Transaction Agent Panel */}
        <TransactionAgentPanel
          events={displayEvents}
          output={output}
          stats={stats}
          totalTime={totalTime}
          targetFormat={getScenario(selectedScenario)?.targetFormat || 'pacs.008'}
          isStreaming={isStreaming}
          expandedEvents={expandedEvents}
          onToggleEvent={toggleEventExpansion}
          onOutputRendered={() => setLogsRenderComplete(true)}
        />
      </div>

      {/* Human Review Modal */}
      <HumanReviewModal
        isOpen={isReviewModalOpen}
        onClose={handleCloseReviewModal}
        onApprove={handleApproveReview}
        onReject={handleRejectReview}
        reviewData={reviewData}
        isSubmitting={isSubmittingReview}
      />
    </div>
  );
}
