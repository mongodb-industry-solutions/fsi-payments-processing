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

  // Human-in-the-loop review state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [reviewThreadId, setReviewThreadId] = useState(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // AI/Rules mode toggle - controls whether to use LLM or regex for unstructured fields
  const [useAI, setUseAI] = useState(true);

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

  // Helper Functions
  const addEvent = (eventData) => {
    const timestamp = new Date().toISOString();
    const id = `event-${Date.now()}-${Math.random()}`;
    console.log('✅ Event Added:', eventData.type, eventData);
    setEvents(prev => [...prev, { ...eventData, timestamp, id }]);
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
                setOutput(eventData.data?.output || eventData.output || '');
                setStats(eventData.data?.processing_stats || null);
                setTotalTime(eventData.data?.total_time || 0);
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
    addEvent({
      type: 'review_approved',
      message: options.modified_value
        ? `Human approved with modification: ${options.modified_value}`
        : 'Human approved proposed change'
    });

    try {
      const response = await fetch('/api/agent/resume', {
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

      const result = await response.json();
      console.log('✅ Resume result:', result);

      // Add execution result event with conversion_run_id for JSON diff visualization
      if (result.success) {
        addEvent({
          type: 'agent_execution',
          conversion_run_id: result.conversion_run_id,
          field: result.result?.field_name,
          old_value: result.result?.old_value,
          new_value: result.result?.new_value,
          reasoning: 'Executed after human approval'
        });
        addEvent({
          type: 'agent_complete',
          field: result.result?.field_name,
          success: true
        });

        // Update hop1 details from resume response (these were stored when validation failed)
        if (result.hop1_details) {
          console.log('📦 Captured hop1 detailed processing from resume:', result.hop1_details);
          setHop1Details(result.hop1_details);
          // Emit hop1_complete event for visualization
          addEvent({
            type: 'hop1_complete',
            message: 'Stage 1 conversion complete (resumed)',
            detailed_processing: result.hop1_details
          });
        }

        // Add stage 2 events if conversion continued
        if (result.output) {
          addEvent({
            type: 'hop2_start',
            message: 'JSON → Target format conversion'
          });
          addEvent({
            type: 'hop2_complete',
            message: 'Stage 2 conversion complete',
            detailed_processing: result.hop2_details
          });

          // Update hop2 details for visualization
          if (result.hop2_details) {
            setHop2Details(result.hop2_details);
          }

          // Add complete event with final output
          addEvent({
            type: 'complete',
            output: result.output,
            processing_stats: result.processing_stats,
            total_time: result.total_time
          });

          // Update state with final results
          setOutput(result.output);
          setStats(result.processing_stats);
          setTotalTime(result.total_time);
        }
      }

      // Modal already closed at start for snappy UX
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
    addEvent({
      type: 'review_rejected',
      message: 'Human rejected proposed change'
    });

    try {
      const response = await fetch('/api/agent/resume', {
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

      addEvent({
        type: 'agent_complete',
        field: reviewData?.field,
        success: false,
        message: 'Skipped - rejected by human reviewer'
      });

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
