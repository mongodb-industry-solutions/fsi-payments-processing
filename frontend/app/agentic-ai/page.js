'use client';

import { useState, useEffect, useRef } from 'react';
import Banner from '@leafygreen-ui/banner';
import CollapsibleScenariosPanel from './components/CollapsibleScenariosPanel';
import GeographicMapPanel from './components/GeographicMapPanel';
import TransactionAgentPanel from './components/TransactionAgentPanel';
import HumanReviewModal from './components/HumanReviewModal';
import AIReviewModal from './components/AIReviewModal';
import { getAllScenarios, getScenario } from './scenarios';

// Use Next.js API routes to proxy to converter sidecar
// Browser → /api/... → Next.js server → 127.0.0.1:8001 (converter)

/**
 * Filter events for agentic scenarios
 * Includes both conversion flow events (hop1, hop2) and agent intervention events
 * to show the complete picture of how the agent handles country-specific issues
 */
function isAgentRelatedEvent(event) {
  const agentEventTypes = [
    // Conversion flow events (provide context for agent intervention)
    'start',              // Conversion started
    'hop1_start',         // First hop begins
    'hop1_complete',      // First hop completes
    'hop2_start',         // Second hop begins
    'hop2_complete',      // Second hop completes
    'complete',           // Conversion finished
    // AI review events (human-in-the-loop for unstructured fields)
    'ai_review_required',    // AI fields need human review
    'ai_review_approved',    // Human approved AI extractions
    'ai_review_rejected',    // Human rejected AI extractions
    // Agent intervention events
    'validation_failed',  // Triggers agent intervention
    'agent_start',        // Agent begins processing
    'agent_supervisor',   // Supervisor routing decision
    'tool_call',          // Tool invocation (IFSC lookup, transliteration)
    'tool_result',        // Tool results
    'agent_resolution',   // Proposed solution
    'review_required',    // Human review needed for agent proposal
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
    // AI review events (human-in-the-loop for unstructured fields)
    'ai_review_required',    // AI fields need human review
    'ai_review_approved',    // Human approved AI extractions
    'ai_review_rejected',    // Human rejected AI extractions
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
  const pendingReviewRef = useRef(null); // Store review_required data until event is displayed
  const pendingAIReviewRef = useRef(null); // Store ai_review_required data until event is displayed
  const AGENTIC_EVENT_DELAY = 1100; // ms between events for agentic scenarios (if any queued)
  const AGENT_START_DELAY = 1800; // ms delay before agent_start - builds suspense after validation fails
  const NON_AGENTIC_EVENT_DELAY = 900; // ms between events for non-agentic scenarios (card_payment, internal_mx) - ~5.4s for 6 events
  const CRYPTO_EVENT_DELAY = 1000; // ms between events for crypto scenarios (~10s total, ensures 1s per card)

  // Human-in-the-loop review state (for agent corrections like Japan/India)
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [reviewThreadId, setReviewThreadId] = useState(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // AI field review state (for unstructured field extractions like remittance/instructions)
  const [isAIReviewModalOpen, setIsAIReviewModalOpen] = useState(false);
  const [aiReviewData, setAIReviewData] = useState(null);
  const [aiReviewRunId, setAIReviewRunId] = useState(null);
  const [isSubmittingAIReview, setIsSubmittingAIReview] = useState(false);

  // AI/Rules mode toggle - controls whether to use LLM or regex for unstructured fields
  const [useAI, setUseAI] = useState(false);

  // Solana devnet health status: 'checking' | 'healthy' | 'down'
  const [solanaStatus, setSolanaStatus] = useState('checking');

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

  // Poll Solana devnet health every 30 seconds
  useEffect(() => {
    const checkSolanaHealth = async () => {
      try {
        const res = await fetch('/api/solana/health');
        const data = await res.json();
        setSolanaStatus(data.healthy ? 'healthy' : 'down');
      } catch {
        setSolanaStatus('down');
      }
    };

    checkSolanaHealth();
    const interval = setInterval(checkSolanaHealth, 30000);
    return () => clearInterval(interval);
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
    // Auto-expand new events
    setExpandedEvents(prev => new Set([...prev, nextEvent.id]));

    // Open review modals AFTER the event is displayed (not when SSE arrives)
    if (nextEvent.type === 'review_required' && pendingReviewRef.current) {
      const { threadId, data } = pendingReviewRef.current;
      setReviewThreadId(threadId);
      setReviewData(data);
      setIsReviewModalOpen(true);
      pendingReviewRef.current = null;
    }
    if (nextEvent.type === 'ai_review_required' && pendingAIReviewRef.current) {
      const { runId, data } = pendingAIReviewRef.current;
      setAIReviewRunId(runId);
      setAIReviewData(data);
      setIsAIReviewModalOpen(true);
      pendingAIReviewRef.current = null;
    }

    // Schedule next event with appropriate delay
    // Crypto scenarios use longest delay (~10s total)
    // Non-agentic scenarios (card_payment, internal_mx) use medium delay (~5.4s total)
    // Agentic scenarios use shortest delay (agent processing provides natural pacing)
    if (eventQueueRef.current.length > 0) {
      const scenario = getScenario(selectedScenario);
      const isCryptoScenario = scenario?.isCryptoSettlement === true;
      const isNonAgenticScenario = scenario?.isAgentic === false;
      const upcomingEvent = eventQueueRef.current[0];
      const useCryptoDelay = isCryptoScenario || isCryptoEvent(nextEvent) || isCryptoEvent(upcomingEvent);

      // Determine delay: crypto > agent_start (suspense) > non-agentic > agentic
      let delay;
      if (useCryptoDelay) {
        delay = CRYPTO_EVENT_DELAY;
      } else if (upcomingEvent?.type === 'agent_start') {
        // Longer pause before agent kicks in - builds suspense after validation fails
        delay = AGENT_START_DELAY;
      } else if (isNonAgenticScenario) {
        delay = NON_AGENTIC_EVENT_DELAY;
      } else {
        delay = AGENTIC_EVENT_DELAY;
      }
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

    // Queue ALL events for throttled display - provides consistent visual pacing
    // Different delays based on scenario type:
    // - Crypto scenarios: longest delay (1000ms) for dramatic effect
    // - Non-agentic scenarios: medium delay (900ms) for readable pacing
    // - Agentic scenarios: shorter delay (400ms) since agent events provide natural pauses
    eventQueueRef.current.push(enrichedEvent);

    // Start processing if not already running
    if (!throttleTimerRef.current) {
      let initialDelay;
      if (useCryptoDelay) {
        initialDelay = CRYPTO_EVENT_DELAY;
      } else if (isNonAgentic) {
        initialDelay = NON_AGENTIC_EVENT_DELAY;
      } else {
        // Agentic scenarios - still throttle initial events so they don't jump
        initialDelay = AGENTIC_EVENT_DELAY;
      }
      throttleTimerRef.current = setTimeout(processEventQueue, initialDelay);
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

    // Force Rules mode for deterministic scenarios (no LLM processing)
    const newScenario = getScenario(scenarioId);
    if (newScenario?.isDeterministic) {
      setUseAI(false);
    }

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

    // Collapse scenario panel when simulation starts
    setIsPanelExpanded(false);

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
    // Clear event queue and pending data for fresh simulation
    eventQueueRef.current = [];
    pendingOutputRef.current = null;
    pendingReviewRef.current = null;
    pendingAIReviewRef.current = null;
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }

    try {
      const response = await fetch('/PaymentOrderInitiationTransaction/Initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceFormat: scenario.sourceFormat,
          targetFormat: scenario.targetFormat,
          message: scenario.message,
          useAi: useAI
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

                // Store output until queue empties (for all scenarios with queued events)
                // This ensures the output card appears AFTER all events are displayed
                if (eventQueueRef.current.length > 0) {
                  // Store for later - will be applied when queue empties
                  pendingOutputRef.current = {
                    output: completeOutput,
                    stats: completeStats,
                    totalTime: completeTotalTime
                  };
                } else {
                  // Queue already empty - set immediately
                  setOutput(completeOutput);
                  setStats(completeStats);
                  setTotalTime(completeTotalTime);
                }
              }

              // Handle error event
              if (eventData.type === 'error') {
                setError(eventData.data?.message || eventData.message || 'Unknown error');
              }

              // Handle review_required event (human-in-the-loop for agent corrections)
              // Store for later - modal opens when event is displayed from queue
              if (eventData.type === 'review_required') {
                console.log('👤 Human review required (queued):', eventData);
                pendingReviewRef.current = {
                  threadId: eventData.thread_id,
                  data: eventData
                };
                // Don't set isStreaming to false yet - we're paused, not done
              }

              // Handle ai_review_required event (human review of AI-extracted fields)
              // Store for later - modal opens when event is displayed from queue
              if (eventData.type === 'ai_review_required') {
                console.log('🤖 AI field review required (queued):', eventData);
                pendingAIReviewRef.current = {
                  runId: eventData.conversion_run_id,
                  data: eventData
                };
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
    setIsStreaming(true);  // Resume streaming state for thinking indicator
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
                // Store output until queue empties (consistent with main stream handling)
                const completeOutput = event.output || '';
                const completeStats = event.processing_stats || null;
                const completeTotalTime = event.total_time || 0;

                if (eventQueueRef.current.length > 0) {
                  pendingOutputRef.current = {
                    output: completeOutput,
                    stats: completeStats,
                    totalTime: completeTotalTime
                  };
                } else {
                  if (completeOutput) setOutput(completeOutput);
                  if (completeStats) setStats(completeStats);
                  if (completeTotalTime) setTotalTime(completeTotalTime);
                }
                // Extract hop details from complete event (sent by streaming resume)
                if (event.hop1_details) {
                  console.log('📦 Captured hop1_details from complete event:', event.hop1_details);
                  setHop1Details(event.hop1_details);
                }
                if (event.hop2_details) {
                  console.log('📦 Captured hop2_details from complete event:', event.hop2_details);
                  setHop2Details(event.hop2_details);
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

  // AI field review handlers (for unstructured fields like remittance/instructions)
  const handleApproveAIReview = async (corrections = null) => {
    if (!aiReviewRunId) return;

    setIsSubmittingAIReview(true);
    setIsStreaming(true);  // Resume streaming state for thinking indicator
    setIsAIReviewModalOpen(false);  // Close modal immediately for snappier UX

    try {
      // Use streaming resume endpoint
      const response = await fetch('/api/ai-review/resume-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversion_run_id: aiReviewRunId,
          decision: {
            approved: true,
            corrections: corrections  // Optional field corrections
          }
        })
      });

      if (!response.ok) {
        throw new Error(`AI review resume failed: ${response.status}`);
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
              console.log('📡 AI review resume event:', event);

              // Add the event to the timeline
              if (event.type) {
                addEvent(event);
              }

              // Handle specific event types
              if (event.type === 'hop2_complete' && event.detailed_processing) {
                setHop2Details(event.detailed_processing);
              }

              if (event.type === 'complete') {
                // Store output until queue empties (consistent with main stream handling)
                const completeOutput = event.output || '';
                const completeStats = event.processing_stats || null;
                const completeTotalTime = event.total_time || 0;

                if (eventQueueRef.current.length > 0) {
                  pendingOutputRef.current = {
                    output: completeOutput,
                    stats: completeStats,
                    totalTime: completeTotalTime
                  };
                } else {
                  if (completeOutput) setOutput(completeOutput);
                  if (completeStats) setStats(completeStats);
                  if (completeTotalTime) setTotalTime(completeTotalTime);
                }
              }

              if (event.type === 'error') {
                setError(event.message);
              }

              // Handle review_required event (agent needs human review after AI approval)
              // Store for later - modal opens when event is displayed from queue
              if (event.type === 'review_required') {
                console.log('👤 Agent review required after AI approval (queued):', event);
                pendingReviewRef.current = {
                  threadId: event.thread_id,
                  data: event
                };
                // Stream will continue after human reviews agent's proposal
                return;  // Exit the loop - human will resume via agent resume endpoint
              }
            } catch (parseErr) {
              console.warn('Failed to parse SSE event:', line, parseErr);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error resuming AI review:', err);
      setError(`Failed to resume: ${err.message}`);
    } finally {
      setIsSubmittingAIReview(false);
      setIsStreaming(false);
    }
  };

  const handleRejectAIReview = async () => {
    if (!aiReviewRunId) return;

    setIsSubmittingAIReview(true);

    try {
      const response = await fetch('/api/ai-review/resume-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversion_run_id: aiReviewRunId,
          decision: {
            approved: false,
            corrections: null
          }
        })
      });

      if (!response.ok) {
        throw new Error(`AI review reject failed: ${response.status}`);
      }

      // Process SSE stream (will get ai_review_rejected event)
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
              console.log('📡 AI review reject event:', event);

              if (event.type) {
                addEvent(event);
              }
            } catch (parseErr) {
              console.warn('Failed to parse SSE event:', line, parseErr);
            }
          }
        }
      }

      setIsAIReviewModalOpen(false);
    } catch (err) {
      console.error('Error rejecting AI review:', err);
      setError(`Failed to reject: ${err.message}`);
    } finally {
      setIsSubmittingAIReview(false);
      setIsStreaming(false);
    }
  };

  const handleCloseAIReviewModal = () => {
    // Closing without decision is treated as rejection
    handleRejectAIReview();
  };

  return (
    <div style={{ padding: 'var(--space-xl, 32px)', maxWidth: 'var(--container-lg, 1920px)', margin: '0 auto' }}>
      {/* Error Banner */}
      {error && (
        <Banner variant="danger" style={{ marginBottom: '24px' }}>
          {error}
        </Banner>
      )}

      {/* Solana Devnet Warning */}
      {currentScenario?.isCryptoSettlement && solanaStatus === 'down' && (
        <Banner variant="warning" style={{ marginBottom: '16px' }}>
          Solana devnet is currently unavailable. The crypto settlement step will fail.
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
        solanaStatus={solanaStatus}
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
          collectionName={getScenario(selectedScenario)?.agentCollection || null}
        />
      </div>

      {/* Human Review Modal (for agent corrections like Japan/India) */}
      <HumanReviewModal
        isOpen={isReviewModalOpen}
        onClose={handleCloseReviewModal}
        onApprove={handleApproveReview}
        onReject={handleRejectReview}
        reviewData={reviewData}
        isSubmitting={isSubmittingReview}
      />

      {/* AI Review Modal (for unstructured field extractions) */}
      <AIReviewModal
        isOpen={isAIReviewModalOpen}
        onClose={handleCloseAIReviewModal}
        onApprove={handleApproveAIReview}
        onReject={handleRejectAIReview}
        reviewData={aiReviewData}
        isSubmitting={isSubmittingAIReview}
      />
    </div>
  );
}
