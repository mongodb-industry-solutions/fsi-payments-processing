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
import ProcessingPipelinePanel from './components/ProcessingPipelinePanel';
import { getLayoutedElements, getRadialLayout, getRoutingTreeLayout, determineLayoutStrategy } from './utils/layoutUtils';
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
  const [bfsState, setBfsState] = useState({ queue: [], visited: [], current: null });
  const [selectedPath, setSelectedPath] = useState(null);
  const [selectedDestination, setSelectedDestination] = useState('uk'); // For hub-and-spoke scenarios
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
    if (scenario.isRoutingScenario && scenario.routingNodes) {
      // Tree-based routing visualization for BFS path discovery
      const { source, destination, paths } = scenario.routingNodes;

      // Add source node
      initialNodes.push({
        id: source.id,
        type: 'country',
        position: { x: 0, y: 0 },
        data: {
          ...source,
          mongoConfig: true,
          status: executionProgress[source.id] || 'idle',
          isSource: true
        }
      });

      // Add destination node
      initialNodes.push({
        id: destination.id,
        type: 'country',
        position: { x: 0, y: 0 },
        data: {
          ...destination,
          mongoConfig: true,
          status: executionProgress[destination.id] || 'idle',
          isDestination: true
        }
      });

      // Add all intermediate nodes from all paths
      paths.forEach((path, pathIndex) => {
        path.nodes.forEach(node => {
          const nodeType = node.isCrypto ? 'crypto' : 'country';
          initialNodes.push({
            id: node.id,
            type: nodeType,
            position: { x: 0, y: 0 },
            data: {
              ...node,
              mongoConfig: true,
              status: executionProgress[node.id] || 'idle',
              isIntermediate: true,
              pathId: path.id,
              pathAvailable: path.available,
              pathOptimal: path.optimal
            }
          });
        });
      });

      // Create edges for each path
      paths.forEach((path, pathIndex) => {
        const isOptimal = path.optimal;
        const isAvailable = path.available;

        // Define edge style based on path status
        const pathEdgeStyle = isAvailable ?
          (isOptimal ?
            {
              ...edgeOptions,
              style: {
                stroke: '#00A35C',
                strokeWidth: 3,
                strokeDasharray: '0'
              },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: '#00A35C',
              }
            } : edgeOptions)
          : {
            ...edgeOptions,
            animated: false,
            style: {
              stroke: '#CBD5E1',
              strokeWidth: 2,
              strokeDasharray: '5,5'
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#CBD5E1',
            }
          };

        const pathNodes = path.nodes;

        // Edge from source to first node
        if (pathNodes.length > 0) {
          const firstNodeId = `${pathNodes[0].id}_path${pathIndex}`;
          initialEdges.push({
            id: `${source.id}-${firstNodeId}`,
            source: source.id,
            target: firstNodeId,
            ...pathEdgeStyle,
            label: isOptimal ? '✅' : (isAvailable ? '' : '❌'),
            labelStyle: {
              fontSize: 11,
              fontWeight: 600,
              fill: isAvailable ? '#00A35C' : '#94A3B8'
            }
          });
        }

        // Edges between intermediate nodes in the path
        for (let i = 0; i < pathNodes.length - 1; i++) {
          const currentNodeId = `${pathNodes[i].id}_path${pathIndex}`;
          const nextNodeId = `${pathNodes[i + 1].id}_path${pathIndex}`;
          initialEdges.push({
            id: `${currentNodeId}-${nextNodeId}`,
            source: currentNodeId,
            target: nextNodeId,
            ...pathEdgeStyle,
            labelStyle: { fontSize: 11, fontWeight: 600 }
          });
        }

        // Edge from last node to destination
        if (pathNodes.length > 0) {
          const lastNode = pathNodes[pathNodes.length - 1];
          const lastNodeId = `${lastNode.id}_path${pathIndex}`;
          initialEdges.push({
            id: `${lastNodeId}-${destination.id}`,
            source: lastNodeId,
            target: destination.id,
            ...pathEdgeStyle,
            labelStyle: { fontSize: 11, fontWeight: 600 }
          });
        }
      });

      // Apply routing tree layout with multi-hop support
      const { nodes: layoutedNodes, edges: layoutedEdges } = getRoutingTreeLayout(
        initialNodes,
        initialEdges,
        {
          sourceId: source.id,
          destinationId: destination.id,
          paths: paths
        }
      );

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);

      // Auto-fit view after layout with better padding for complex graph
      setTimeout(() => {
        fitView({
          padding: 0.15,
          duration: 800,
          maxZoom: 0.5,
          minZoom: 0.2
        });
      }, 100);

    } else if (scenario.parallel && scenario.hops.some(h => h.isHub)) {
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

      // Auto-fit view after layout with adjusted zoom for small node counts
      setTimeout(() => {
        const nodeCount = layoutedNodes.length;
        const zoomPadding = nodeCount <= 2 ? 0.5 : nodeCount <= 3 ? 0.35 : 0.2;

        fitView({
          padding: zoomPadding,
          duration: 800,
          maxZoom: nodeCount <= 2 ? 0.5 : nodeCount <= 3 ? 0.65 : 0.8
        });
      }, 100);

    } else if (scenario.hubAndSpoke) {
      // Hub-and-spoke model for cross-border transfers
      // Central JSON hub with multiple destination spokes
      const hubId = 'json-hub';

      // Use selectedDestination from state
      const activeDestination = selectedDestination || 'uk';

      // Add central JSON hub
      initialNodes.push({
        id: hubId,
        type: 'jsonBridge',
        position: { x: 0, y: 0 }, // Will be positioned by layout
        data: {
          country: 'JSON',
          format: 'Canonical',
          icon: '🔄',
          isHub: true,
          city: 'Universal Hub',
          status: executionProgress[hubId] || 'idle',
          beforeJson: jsonBridgeData[hubId]?.beforeJson || null,
          afterJson: jsonBridgeData[hubId]?.afterJson || null,
          selectedScenario: scenario
        }
      });

      // Add source node (USA)
      const sourceNode = scenario.allNodes.usa;
      initialNodes.push({
        id: sourceNode.id,
        type: 'country',
        position: { x: 0, y: 0 },
        data: {
          ...sourceNode,
          mongoConfig: true,
          status: executionProgress[sourceNode.id] || 'idle'
        }
      });

      // Add edge from USA to JSON hub (always active as it's the source)
      initialEdges.push({
        id: `${sourceNode.id}-${hubId}`,
        source: sourceNode.id,
        target: hubId,
        ...edgeOptions,
        label: `MT103 → JSON`,
        labelStyle: { fontSize: 11, fontWeight: 600, color: '#00A35C' }
      });

      // Add destination nodes (UK and France)
      const destinations = [scenario.allNodes.uk, scenario.allNodes.france];
      destinations.forEach(dest => {
        // Check if this destination is selected
        const isDestinationSelected = activeDestination === dest.id;

        // Add destination node
        initialNodes.push({
          id: dest.id,
          type: 'country',
          position: { x: 0, y: 0 },
          data: {
            ...dest,
            mongoConfig: true,
            status: executionProgress[dest.id] || 'idle',
            // Mark selected destination
            isSelected: isDestinationSelected
          }
        });

        // Add edge from JSON hub to destination
        const edgeStyle = isDestinationSelected ?
          { ...edgeOptions, style: { ...edgeOptions.style, strokeWidth: 3, stroke: '#00A35C' } } :
          { ...edgeOptions, style: { ...edgeOptions.style, strokeWidth: 2, stroke: '#cbd5e1', strokeDasharray: '5 5' }, animated: false };

        initialEdges.push({
          id: `${hubId}-${dest.id}`,
          source: hubId,
          target: dest.id,
          ...edgeStyle,
          label: dest.format === 'CHAPS' ? `JSON → CHAPS` : `JSON → ISO 20022`,
          labelStyle: { fontSize: 11, fontWeight: 600, color: isDestinationSelected ? '#00A35C' : '#9ca3af' }
        });
      });

      // Custom layout for hub-and-spoke pattern with more spacing
      // Position nodes in a triangular pattern with JSON at center
      const layoutedNodes = initialNodes.map(node => {
        if (node.id === hubId) {
          // JSON hub at center
          return { ...node, position: { x: 500, y: 300 } };
        } else if (node.id === 'usa') {
          // USA on the left with more distance
          return { ...node, position: { x: 50, y: 300 } };
        } else if (node.id === 'uk') {
          // UK on top-right with more spacing
          return { ...node, position: { x: 950, y: 100 } };
        } else if (node.id === 'france') {
          // France on bottom-right with more spacing
          return { ...node, position: { x: 950, y: 500 } };
        }
        return node;
      });

      setNodes(layoutedNodes);
      setEdges(initialEdges);

      // Auto-fit view
      setTimeout(() => {
        fitView({
          padding: 0.2,
          duration: 800,
          maxZoom: 0.9
        });
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
          const nextHop = scenario.hops[index + 1];

          // For crypto scenarios, we still need JSON bridge for conversion
          if (nextHop.isCrypto) {
            // Add JSON bridge between SPEI and USDC for proper conversion visualization
            const jsonId = `json-crypto-bridge`;
            initialNodes.push({
              id: jsonId,
              type: 'jsonBridge',
              position: { x: 0, y: 0 }, // Will be positioned by layout
              data: {
                country: 'JSON',
                format: 'Bridge',
                icon: '🔄',
                isHub: true,
                city: 'TradFi→DeFi',
                status: executionProgress[jsonId] || 'idle',
                beforeJson: jsonBridgeData[jsonId]?.beforeJson || null,
                afterJson: jsonBridgeData[jsonId]?.afterJson || null,
                selectedScenario: scenario
              }
            });

            // Create edges: SPEI → JSON → USDC
            const edgeStyle = cryptoEdgeOptions;
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
          } else {
            // Add JSON bridge for non-crypto transitions
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

      // Auto-fit view after layout with adjusted zoom for small node counts
      setTimeout(() => {
        const nodeCount = layoutedNodes.length;
        const zoomPadding = nodeCount <= 2 ? 0.5 : nodeCount <= 3 ? 0.35 : 0.2;

        fitView({
          padding: zoomPadding,
          duration: 800,
          maxZoom: nodeCount <= 2 ? 0.5 : nodeCount <= 3 ? 0.65 : 0.8
        });
      }, 100);
    }
  };

  const handleSelectScenario = (scenario) => {
    // Set the default destination for hub-and-spoke scenarios
    if (scenario.hubAndSpoke) {
      const defaultDest = scenario.selectedDestination || 'uk';
      setSelectedDestination(defaultDest);
      // Update scenario with the correct conversion path
      scenario = {
        ...scenario,
        hops: scenario.conversionPaths[defaultDest].hops,
        conversions: scenario.conversionPaths[defaultDest].conversions
      };
    }

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

    // Handle routing scenario with BFS animation
    if (selectedScenario.isRoutingScenario) {
      // BFS algorithm animation
      const bfsSteps = [
        { queue: ['usa'], current: 'usa', visited: [] },
        { queue: ['australia', 'singapore', 'newzealand', 'direct'], current: 'usa', visited: ['usa'] },
        { queue: ['singapore', 'newzealand', 'direct'], current: 'australia', visited: ['usa', 'australia'] },
        { queue: ['newzealand', 'direct'], current: 'singapore', visited: ['usa', 'australia', 'singapore'] },
        { queue: ['direct'], current: 'newzealand', visited: ['usa', 'australia', 'singapore', 'newzealand'] },
        { queue: [], current: 'direct', visited: ['usa', 'australia', 'singapore', 'newzealand', 'direct'] },
        { queue: [], current: null, visited: ['usa', 'australia', 'singapore', 'newzealand', 'direct'], selected: 'australia' }
      ];

      // Animate BFS steps
      for (let step of bfsSteps) {
        setBfsState(step);

        // Update node progress
        const newProgress = {};
        step.visited.forEach(nodeId => {
          newProgress[nodeId] = 'completed';
        });
        if (step.current) {
          newProgress[step.current] = 'processing';
        }
        if (step.selected) {
          newProgress[step.selected] = 'selected';
          setSelectedPath(step.selected);
        }
        setExecutionProgress(newProgress);

        await new Promise(resolve => setTimeout(resolve, 800));
      }

      // After BFS completes, highlight the optimal path
      setExecutionProgress({
        usa: 'completed',
        australia: 'selected',
        fiji: 'completed'
      });

      // Add routing results
      results.push({
        from: 'MT103',
        to: 'NPP',
        via: 'Australia',
        processingTime: 2.5,
        processingStats: { rules_lane: 45, ai_lane: 8 },
        step: 1
      });

      results.push({
        from: 'NPP',
        to: 'FJD',
        via: 'Fiji Banking',
        processingTime: 1.8,
        processingStats: { rules_lane: 38, ai_lane: 5 },
        step: 2
      });

      setConversionResults(results);
      setCurrentStep(null);
      setIsExecuting(false);
      setShowResultsSummary(true);
      return;
    }

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

      {/* Destination Selector for Hub-and-Spoke scenarios */}
      {selectedScenario?.hubAndSpoke && (
        <div className={styles.destinationSelector}>
          <h3>Select Destination</h3>
          <div className={styles.destinationButtons}>
            <button
              className={`${styles.destinationButton} ${selectedDestination === 'uk' ? styles.selected : ''}`}
              onClick={() => {
                setSelectedDestination('uk');
                // Update the scenario with new destination
                if (selectedScenario) {
                  const updatedScenario = {
                    ...selectedScenario,
                    selectedDestination: 'uk',
                    hops: selectedScenario.conversionPaths.uk.hops,
                    conversions: selectedScenario.conversionPaths.uk.conversions
                  };
                  setSelectedScenario(updatedScenario);
                  buildScenarioFlow(updatedScenario);
                }
              }}
            >
              <span className={styles.flag}>🇬🇧</span>
              <span>UK (CHAPS)</span>
            </button>
            <button
              className={`${styles.destinationButton} ${selectedDestination === 'france' ? styles.selected : ''}`}
              onClick={() => {
                setSelectedDestination('france');
                // Update the scenario with new destination
                if (selectedScenario) {
                  const updatedScenario = {
                    ...selectedScenario,
                    selectedDestination: 'france',
                    hops: selectedScenario.conversionPaths.france.hops,
                    conversions: selectedScenario.conversionPaths.france.conversions
                  };
                  setSelectedScenario(updatedScenario);
                  buildScenarioFlow(updatedScenario);
                }
              }}
            >
              <span className={styles.flag}>🇫🇷</span>
              <span>France (ISO 20022)</span>
            </button>
          </div>
          <p className={styles.destinationInfo}>
            The Canonical JSON hub enables any-to-any conversion. Select a destination to see the conversion path.
          </p>
        </div>
      )}

      <div className={styles.mainCanvas}>
        <div className={styles.flowContainer}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
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
                padding: 0.3,
                includeHiddenNodes: false,
                maxZoom: 1.0,
                minZoom: 0.5,
                duration: 800
              }}
              defaultViewport={{ x: 200, y: 50, zoom: 0.65 }}
              minZoom={0.1}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
              translateExtent={[[-500, -500], [4000, 1200]]}
              nodeExtent={[[-200, -200], [3800, 1000]]}
              zoomOnScroll={true}
              panOnDrag={true}
            >
              <Controls position="top-right" />
            </ReactFlow>
          </div>
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