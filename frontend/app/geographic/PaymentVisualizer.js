'use client';

import { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  useNodesState,
  useEdgesState,
  addEdge,
  Controls,
  Background,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';

import ScenarioSidebar from './components/ScenarioSidebar';
import NodeDetailsPanel from './components/NodeDetailsPanel';
import EnhancedCountryNode from './components/EnhancedCountryNode';
import CryptoNode from './components/CryptoNode';
import JsonBridgeNode from './components/JsonBridgeNode';
import InfoCallout from './components/InfoCallout';
import ProcessingPipelinePanel from './components/ProcessingPipelinePanel';
import { getLayoutedElements, getRadialLayout, determineLayoutStrategy } from './utils/layoutUtils';
import { convertPayment } from './services/conversionService';
import styles from './PaymentVisualizer.module.css';

const nodeTypes = {
  country: EnhancedCountryNode,
  crypto: CryptoNode,
  jsonBridge: JsonBridgeNode,
};

const edgeOptions = {
  animated: true,
  style: {
    stroke: '#13aa52',
    strokeWidth: 2,
  },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: '#13aa52',
  },
};

const cryptoEdgeOptions = {
  animated: true,
  style: {
    stroke: '#764ba2',
    strokeWidth: 3,
    strokeDasharray: '5 5',
  },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: '#764ba2',
  },
};

function PaymentVisualizerFlow() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodePosition, setNodePosition] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentStep, setCurrentStep] = useState(null);
  const [executionProgress, setExecutionProgress] = useState({});
  const [conversionResults, setConversionResults] = useState([]);
  const [showResultsSummary, setShowResultsSummary] = useState(false);
  const [resultsMinimized, setResultsMinimized] = useState(false);
  const [jsonBridgeData, setJsonBridgeData] = useState({});
  const { fitView } = useReactFlow();

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const onNodeClick = useCallback((event, node) => {
    // Don't show NodeDetailsPanel for country nodes as they have their own FormatInfoModal
    if (node.type === 'country') {
      return; // Let the node handle its own click event
    }
    // For other node types, show NodeDetailsPanel if needed
    if (node.type === 'somethingElse') {
      setSelectedNode(node.data);
      // Calculate position in screen coordinates
      const rect = event.currentTarget.getBoundingClientRect();
      setNodePosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        nodeId: node.id
      });
    }
    // JSON bridge nodes handle their own click events internally
  }, []);

  const buildScenarioFlow = (scenario) => {
    if (!scenario) return;

    const initialNodes = [];
    const initialEdges = [];

    // Determine layout strategy based on scenario type
    const layoutStrategy = determineLayoutStrategy(scenario);

    // Build nodes based on scenario type
    if (scenario.parallel && scenario.hops.some(h => h.isHub)) {
      // Hub and spoke pattern - keep hub in center, others around it
      const hubNode = scenario.hops.find(h => h.isHub);
      const spokeNodes = scenario.hops.filter(h => !h.isHub);

      // Add hub node
      initialNodes.push({
        id: hubNode.id,
        type: 'country',
        position: { x: 0, y: 0 }, // Will be positioned by layout
        data: {
          ...hubNode,
          mongoConfig: true,
          status: executionProgress[hubNode.id] || 'idle'
        }
      });

      // Add spoke nodes
      spokeNodes.forEach(hop => {
        initialNodes.push({
          id: hop.id,
          type: 'country',
          position: { x: 0, y: 0 }, // Will be positioned by layout
          data: {
            ...hop,
            mongoConfig: true,
            status: executionProgress[hop.id] || 'idle'
          }
        });

        // Connect to hub
        initialEdges.push({
          id: `${hop.id}-${hubNode.id}`,
          source: hop.id,
          target: hubNode.id,
          ...edgeOptions,
          label: `${hop.format} → JSON`,
          labelStyle: { fontSize: 11, fontWeight: 600 }
        });
      });

      // Use radial layout for hub scenarios
      const { nodes: layoutedNodes, edges: layoutedEdges } = getRadialLayout(
        initialNodes,
        initialEdges,
        hubNode.id
      );

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);

      // Auto-fit view after layout
      setTimeout(() => {
        fitView({ padding: 0.2, duration: 800 });
      }, 100);

    } else {
      // Linear/sequential flow with JSON bridges
      scenario.hops.forEach((hop, index) => {
        // Determine node type based on isCrypto flag
        const nodeType = hop.isCrypto ? 'crypto' : 'country';

        // Add country or crypto node
        initialNodes.push({
          id: hop.id,
          type: nodeType,
          position: { x: 0, y: 0 }, // Will be positioned by layout
          data: {
            ...hop,
            mongoConfig: true,
            status: executionProgress[hop.id] || 'idle',
            // Pass crypto details if available from conversions
            cryptoDetails: scenario.conversions.find(c => c.cryptoDetails)?.cryptoDetails
          }
        });

        // Add JSON bridge between countries (except after last country)
        if (index < scenario.hops.length - 1) {
          const jsonId = `json-${index}`;
          initialNodes.push({
            id: jsonId,
            type: 'jsonBridge',
            position: { x: 0, y: 0 }, // Will be positioned by layout
            data: {
              country: 'JSON',
              format: 'Bridge',
              icon: '🔄',
              isHub: true,
              city: 'Universal',
              status: executionProgress[jsonId] || 'idle',
              beforeJson: jsonBridgeData[jsonId]?.beforeJson || null,
              afterJson: jsonBridgeData[jsonId]?.afterJson || null,
              selectedScenario: scenario
            }
          });

          // Create edges: country → JSON → next country
          const nextHop = scenario.hops[index + 1];
          const isCryptoEdge = hop.isCrypto || nextHop.isCrypto;
          const edgeStyle = isCryptoEdge ? cryptoEdgeOptions : edgeOptions;

          initialEdges.push({
            id: `${hop.id}-${jsonId}`,
            source: hop.id,
            target: jsonId,
            ...edgeStyle,
            label: `${hop.format} → JSON`,
            labelStyle: { fontSize: 11, fontWeight: 600 }
          });

          initialEdges.push({
            id: `${jsonId}-${nextHop.id}`,
            source: jsonId,
            target: nextHop.id,
            ...edgeStyle,
            label: `JSON → ${nextHop.format}`,
            labelStyle: { fontSize: 11, fontWeight: 600 }
          });
        }
      });

      // Apply automatic layout using Dagre
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        initialNodes,
        initialEdges,
        layoutStrategy
      );

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);

      // Auto-fit view after layout
      setTimeout(() => {
        fitView({ padding: 0.2, duration: 800 });
      }, 100);
    }
  };

  const handleSelectScenario = (scenario) => {
    setSelectedScenario(scenario);
    setSelectedNode(null);
    setExecutionProgress({});
    setConversionResults([]); // Clear conversion results when switching scenarios
    setCurrentStep(null); // Reset current step
    setIsExecuting(false); // Ensure execution state is reset
    buildScenarioFlow(scenario);
  };

  const simulateExecution = async () => {
    if (!selectedScenario) return;

    setIsExecuting(true);
    setCurrentStep(0);
    setConversionResults([]);
    setJsonBridgeData({});
    const progress = {};
    const results = [];
    let previousOutput = null;
    const bridgeData = {};

    // Check if this scenario supports real API conversion
    const useRealAPI = selectedScenario.sampleMessage && selectedScenario.conversions[0]?.useRealAPI;

    // Get initial message
    let currentMessage = selectedScenario.sampleMessage;

    // Process each conversion step
    for (let i = 0; i < selectedScenario.conversions.length; i++) {
      setCurrentStep(i);

      const conversion = selectedScenario.conversions[i];

      // Update node status based on conversion
      const fromNode = selectedScenario.hops.find(h => h.format === conversion.from);
      const toNode = selectedScenario.hops.find(h => h.format === conversion.to);

      if (fromNode) {
        progress[fromNode.id] = 'processing';
        setExecutionProgress({ ...progress });
      }


      // Perform real conversion or simulation
      if (useRealAPI && conversion.useRealAPI && currentMessage) {
        try {
          console.log(`Calling real API: ${conversion.from} → ${conversion.to}`);

          // For subsequent steps, use the previous output
          const inputMessage = i === 0 ? currentMessage : previousOutput;

          // For crypto scenario with explicit conversions, don't use router for individual steps
          const useRouterForStep = false; // We're manually controlling the conversion flow

          const result = await convertPayment(
            conversion.from,
            conversion.to,
            inputMessage,
            useRouterForStep
          );

          if (result.success) {
            // Check if we have per-step stats from routing execution log
            let stepStats = result.processingStats;
            let stepConfidence = result.confidenceScores;

            // For multi-hop, extract per-step stats from execution log if available
            if (result.routing && result.routing.execution_log) {
              const stepLog = result.routing.execution_log.find(
                log => log.from === conversion.from && log.to === conversion.to
              );

              if (stepLog && stepLog.processing_stats) {
                // Use the actual per-step stats from the execution log
                stepStats = stepLog.processing_stats;
                stepConfidence = stepLog.confidence_scores || {};
              }
            }

            // Ensure stats are in the correct format (count instead of object)
            if (stepStats) {
              const normalizedStats = {};
              for (const lane of ['rules_lane', 'ai_lane', 'human_lane']) {
                if (stepStats[lane]) {
                  normalizedStats[lane] = typeof stepStats[lane] === 'object'
                    ? stepStats[lane].count || 0
                    : stepStats[lane];
                }
              }
              stepStats = normalizedStats;
            }

            // Capture data for JSON bridges based on conversion steps
            // Map conversions to the correct JSON bridge based on visual layout
            // Bridge 0: India → USA (MT103 → JSON → pacs.008)
            // Bridge 1: USA → Mexico (pacs.008 → SPEI, then SPEI → JSON)
            // Bridge 2: Mexico → Blockchain (JSON → USDC)

            let jsonId;

            // Determine which JSON bridge this conversion belongs to
            if (i <= 1) {
              // Steps 0-1: India to USA bridge (MT103→JSON→pacs.008)
              jsonId = 'json-0';
            } else if (i >= 2 && i <= 3) {
              // Steps 2-3: USA to Mexico bridge (pacs.008→SPEI→JSON)
              jsonId = 'json-1';
            } else {
              // Step 4: Mexico to Blockchain bridge (JSON→USDC)
              jsonId = 'json-2';
            }

            bridgeData[jsonId] = bridgeData[jsonId] || {};

            // Capture data based on conversion type
            if (conversion.to === 'JSON') {
              // Store the JSON output as afterJson
              bridgeData[jsonId].afterJson = result.convertedMessage;
              // Also store the input as beforeJson
              bridgeData[jsonId].beforeJson = inputMessage;
            } else if (conversion.from === 'JSON') {
              // Store the JSON input as beforeJson and output as afterJson
              bridgeData[jsonId].beforeJson = inputMessage;
              bridgeData[jsonId].afterJson = result.convertedMessage;
            } else if (conversion.from === 'pacs.008' && conversion.to === 'SPEI') {
              // Special case: pacs.008→SPEI for USA→Mexico bridge
              // Store pacs.008 as beforeJson and SPEI as intermediate
              bridgeData[jsonId].beforeJson = inputMessage;
              bridgeData[jsonId].intermediateFormat = result.convertedMessage;
            }

            // Update the JSON bridge data state
            setJsonBridgeData({...bridgeData});

            results.push({
              step: i + 1,
              from: conversion.from,
              to: conversion.to,
              input: inputMessage,
              output: result.convertedMessage,
              processingStats: stepStats,
              confidenceScores: stepConfidence,
              processingTime: result.processingTime,
              humanReviewRequired: result.humanReviewRequired
            });

            // Store output for next step
            previousOutput = result.convertedMessage;

            // Update results display
            setConversionResults([...results]);

          } else {
            console.error('Conversion failed:', result.error);
            // Continue with simulation if API fails
          }
        } catch (error) {
          console.error('API call failed:', error);
          // Continue with simulation if API fails
        }
      } else {
        // Simulation mode (original behavior)
        await new Promise(resolve => setTimeout(resolve, conversion.time || 1000));
      }

      if (fromNode) {
        progress[fromNode.id] = 'completed';
        // Clear current conversion and set completed result
        if (!useRealAPI) {
          // For simulation, add mock result data
          const mockResult = {
            step: i + 1,
            from: conversion.from,
            to: conversion.to,
            processingTime: (conversion.time || 1000) / 1000,
            processingStats: {
              rules_lane: Math.floor(Math.random() * 10) + 5,
              ai_lane: Math.floor(Math.random() * 3),
            },
            humanReviewRequired: false,
            confidenceScores: Math.random() > 0.5 ? { 'field_70': 0.85, 'field_72': 0.78 } : {}
          };

          results.push(mockResult);
          setConversionResults([...results]);
        }
      }
      if (toNode) {
        progress[toNode.id] = 'processing';
      }
      setExecutionProgress({ ...progress });

      // Add a pause between steps for clarity
      if (i < selectedScenario.conversions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Mark all as completed
    selectedScenario.hops.forEach(hop => {
      progress[hop.id] = 'completed';
    });

    // Add JSON bridge nodes to completed status
    for (let i = 0; i < selectedScenario.hops.length - 1; i++) {
      const jsonId = `json-${i}`;
      if (progress[jsonId] !== undefined) {
        progress[jsonId] = 'completed';
      }
    }

    setExecutionProgress(progress);
    setIsExecuting(false);
    setCurrentStep(null);

    // Show results summary if we have conversion results
    if (results.length > 0) {
      setShowResultsSummary(true);
      setResultsMinimized(false);
    }
  };

  useEffect(() => {
    // Update node statuses when execution progress or JSON data changes
    if (selectedScenario) {
      buildScenarioFlow(selectedScenario);
    }
  }, [executionProgress]);

  return (
    <div className={styles.visualizerContainer}>
      <ScenarioSidebar
        onSelectScenario={handleSelectScenario}
        selectedScenario={selectedScenario}
        onExecuteScenario={simulateExecution}
        isExecuting={isExecuting}
      />

      <div className={styles.mainCanvas}>
        {selectedScenario && selectedScenario.mongoDbAdvantages && (
          <div className={styles.infoSection}>
            <InfoCallout
              title={selectedScenario.mongoDbAdvantages.title}
              variant="info"
            >
              {selectedScenario.mongoDbAdvantages.message}
            </InfoCallout>
          </div>
        )}

        <div className={styles.flowContainer}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{
              padding: 0.15,
              includeHiddenNodes: false,
              maxZoom: 1.5,
              minZoom: 0.2
            }}
            defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
            minZoom={0.1}
            maxZoom={2}
            attributionPosition="bottom-left"
          >
            <Background variant="dots" gap={12} size={1} />
            <Controls position="top-right" />
          </ReactFlow>
        </div>

        {!selectedScenario && (
          <div className={styles.emptyState}>
            <div className={styles.emptyContent}>
              <span className={styles.emptyIcon}>👈</span>
              <h3>Select a Payment Scenario</h3>
              <p>Choose from wild multi-hop routes or simple transfers to visualize the payment journey</p>
            </div>
          </div>
        )}
      </div>

      <NodeDetailsPanel
        selectedNode={selectedNode}
        nodePosition={nodePosition}
        onClose={() => {
          setSelectedNode(null);
          setNodePosition(null);
        }}
      />

      {/* MongoDB Processing Pipeline Panel */}
      <ProcessingPipelinePanel
        selectedScenario={selectedScenario}
        conversionResults={conversionResults}
        isExecuting={isExecuting}
        currentStep={currentStep}
      />
    </div>
  );
}

export default function PaymentVisualizer() {
  return (
    <ReactFlowProvider>
      <PaymentVisualizerFlow />
    </ReactFlowProvider>
  );
}