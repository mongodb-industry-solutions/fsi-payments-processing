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
import ConversionDetailsModal from './components/ConversionDetailsModal';
import CanonicalJsonExplainer from './components/CanonicalJsonExplainer';
import AnimatedEdge from './CustomEdges';
import { getLayoutedElements, getRadialLayout, getRoutingTreeLayout, determineLayoutStrategy } from './utils/layoutUtils';
import { convertPayment } from './services/conversionService';
import styles from './PaymentVisualizer.module.css';

const nodeTypes = {
  country: EnhancedCountryNode,
  crypto: CryptoNode,
  jsonBridge: JsonBridgeNode,
};

const edgeTypes = {
  animated: AnimatedEdge,
};

const edgeOptions = {
  type: 'animated',
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
  type: 'animated',
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
  const [selectedDestination, setSelectedDestination] = useState('lloyds'); // For hub-and-spoke scenarios
  const [conversionModalData, setConversionModalData] = useState(null);
  const [isConversionModalOpen, setIsConversionModalOpen] = useState(false);
  const { fitView } = useReactFlow();

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const handleEdgeClick = useCallback(async (edgeId, edgeData) => {
    // Parse the edge label to get source and target formats
    const label = edgeData?.label;
    if (!label || !label.includes('→')) return;

    const [sourceFormat, targetFormat] = label.split('→').map(s => s.trim());

    // Check if any scenario has been executed yet
    if (conversionResults.length === 0) {
      // No scenario has been executed yet, don't show any data
      console.log('No scenario executed yet. Execute a scenario first to see conversion details.');
      return;
    }

    // Check if we have stored results from execution
    const existingResult = conversionResults.find(
      r => r.from === sourceFormat && r.to === targetFormat
    );

    if (existingResult) {
      const conversionData = {
        from: sourceFormat,
        to: targetFormat,
        input: existingResult.input,
        output: existingResult.output,
        processing: {
          processingTime: existingResult.processingTime,
          messageSize: existingResult.messageSize,
          processingLanes: existingResult.processingLanes
        }
      };

      setConversionModalData(conversionData);
      setIsConversionModalOpen(true);
    } else {
      // No data for this specific edge in the executed results
      console.log(`No conversion data available for ${sourceFormat} → ${targetFormat} in this execution.`);
    }
  }, [conversionResults]);

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
            data: {
              label: isOptimal ? '✅' : (isAvailable ? '' : '❌'),
              onEdgeClick: handleEdgeClick
            },
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
            data: {
              onEdgeClick: handleEdgeClick
            },
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
            data: {
              onEdgeClick: handleEdgeClick
            },
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
          data: {
            label: `${hop.format} → JSON`,
            onEdgeClick: handleEdgeClick
          },
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
      // Hub-and-spoke model for cross-border transfers via correspondent bank
      const hubId = 'json-hub';
      const correspondentId = 'correspondent';

      // Use selectedDestination from state
      const activeDestination = selectedDestination || 'lloyds';

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

      // Add correspondent bank node
      const correspondentNode = scenario.allNodes.correspondent;
      initialNodes.push({
        id: correspondentId,
        type: 'country',
        position: { x: 0, y: 0 },
        data: {
          ...correspondentNode,
          mongoConfig: true,
          status: executionProgress[correspondentId] || 'idle',
          isCorrespondent: true
        }
      });

      // Add central JSON hub (at correspondent bank)
      initialNodes.push({
        id: hubId,
        type: 'jsonBridge',
        position: { x: 0, y: 0 },
        data: {
          country: 'JSON',
          format: 'Conversion Hub',
          icon: '🔄',
          isHub: true,
          city: 'At Correspondent',
          status: executionProgress[hubId] || 'idle',
          beforeJson: jsonBridgeData[hubId]?.beforeJson || null,
          afterJson: jsonBridgeData[hubId]?.afterJson || null,
          selectedScenario: scenario
        }
      });

      // Add edge from USA to Correspondent (SWIFT network)
      initialEdges.push({
        id: `${sourceNode.id}-${correspondentId}`,
        source: sourceNode.id,
        target: correspondentId,
        ...edgeOptions,
        data: {
          label: `MT103 (SWIFT)`,
          onEdgeClick: handleEdgeClick
        },
        labelStyle: { fontSize: 11, fontWeight: 600, color: '#00A35C' }
      });

      // Add edge from Correspondent to JSON hub
      initialEdges.push({
        id: `${correspondentId}-${hubId}`,
        source: correspondentId,
        target: hubId,
        ...edgeOptions,
        data: {
          label: `MT103 → JSON`,
          onEdgeClick: handleEdgeClick
        },
        labelStyle: { fontSize: 11, fontWeight: 600, color: '#00A35C' }
      });

      // Add destination nodes (Lloyds and Barclays)
      const destinations = [scenario.allNodes.lloyds, scenario.allNodes.barclays];
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
          data: {
            label: dest.id === 'barclays' ? `JSON → FPS` : `JSON → CHAPS`,
            onEdgeClick: handleEdgeClick
          },
          labelStyle: { fontSize: 11, fontWeight: 600, color: isDestinationSelected ? '#00A35C' : '#9ca3af' }
        });
      });

      // Custom layout for correspondent banking flow with maximum spacing
      const layoutedNodes = initialNodes.map(node => {
        if (node.id === 'usa') {
          // USA on the far left with maximum space
          return { ...node, position: { x: 150, y: 400 } };
        } else if (node.id === correspondentId) {
          // Correspondent bank with large spacing from USA (500px gap)
          return { ...node, position: { x: 650, y: 400 } };
        } else if (node.id === hubId) {
          // JSON hub at center with clear separation (450px gap)
          return { ...node, position: { x: 1100, y: 400 } };
        } else if (node.id === 'lloyds') {
          // Lloyds on top-right with very wide separation (500px gap, 200px up)
          return { ...node, position: { x: 1600, y: 200 } };
        } else if (node.id === 'barclays') {
          // Barclays on bottom-right with very wide separation (500px gap, 200px down)
          return { ...node, position: { x: 1600, y: 600 } };
        }
        return node;
      });

      setNodes(layoutedNodes);
      setEdges(initialEdges);

      // Auto-fit view with perfect framing for maximum spacing
      setTimeout(() => {
        fitView({
          padding: 0.1,
          duration: 800,
          maxZoom: 0.5,
          minZoom: 0.2
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
              data: {
                label: `${hop.format} → JSON`,
                onEdgeClick: handleEdgeClick
              },
              labelStyle: { fontSize: 11, fontWeight: 600 }
            });

            initialEdges.push({
              id: `${jsonId}-${nextHop.id}`,
              source: jsonId,
              target: nextHop.id,
              ...edgeStyle,
              data: {
                label: `JSON → ${nextHop.format}`,
                onEdgeClick: handleEdgeClick
              },
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
              data: {
                label: `${hop.format} → JSON`,
                onEdgeClick: handleEdgeClick
              },
              labelStyle: { fontSize: 11, fontWeight: 600 }
            });

            initialEdges.push({
              id: `${jsonId}-${nextHop.id}`,
              source: jsonId,
              target: nextHop.id,
              ...edgeStyle,
              data: {
                label: `JSON → ${nextHop.format}`,
                onEdgeClick: handleEdgeClick
              },
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
      const defaultDest = scenario.selectedDestination || 'lloyds';
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
      if (useRealAPI && conversion.useRealAPI) {
        // For subsequent steps, use the previous output
        const inputMessage = i === 0 ? currentMessage : previousOutput;

        // Check if we have a valid input message
        if (!inputMessage) {
          console.error(`No input message for conversion ${i}: ${conversion.from} → ${conversion.to}`);
          console.error('Previous output was:', previousOutput);
          // Skip this conversion if no input
          continue;
        }

        try {
          console.log(`Calling real API: ${conversion.from} → ${conversion.to}`);
          console.log('Input message length:', inputMessage.length);

          // For crypto scenario with explicit conversions, don't use router for individual steps
          const useRouterForStep = false; // We're manually controlling the conversion flow

          const result = await convertPayment(
            conversion.from,
            conversion.to,
            inputMessage,
            useRouterForStep
          );

          console.log(`Conversion result for ${conversion.from} → ${conversion.to}:`, {
            success: result.success,
            hasConvertedMessage: !!result.convertedMessage,
            error: result.error,
            resultKeys: Object.keys(result)
          });

          if (result.success && result.convertedMessage) {
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

            // Only capture data for conversions that actually involve JSON
            if (conversion.to === 'JSON' || conversion.from === 'JSON' ||
                conversion.to === 'USDC' || conversion.from === 'USDC') {

              // Determine which JSON bridge this conversion belongs to
              let jsonId;

              // Special case for crypto
              if (conversion.to === 'USDC' || conversion.from === 'USDC') {
                jsonId = 'json-crypto-bridge';
              } else if (selectedScenario.hubAndSpoke) {
                // Hub-and-spoke model uses a single central hub
                jsonId = 'json-hub';
              } else {
                // Find which JSON bridge this belongs to
                // JSON bridges are created between hops, and usually there's one bridge per hop transition

                // For simple scenarios with 2 hops, there's only json-0
                // For multi-hop scenarios, count which transition we're in

                // Count JSON bridge transitions (pairs of to/from JSON)
                let currentBridgeIndex = 0;
                let inJsonBridge = false;

                for (let j = 0; j < i; j++) {
                  const prevConv = selectedScenario.conversions[j];
                  if (prevConv.to === 'JSON' && !inJsonBridge) {
                    inJsonBridge = true;
                  } else if (prevConv.from === 'JSON' && inJsonBridge) {
                    inJsonBridge = false;
                    currentBridgeIndex++; // Move to next bridge after completing a pair
                  }
                }

                // If we're currently entering or in a JSON bridge, use current index
                jsonId = `json-${currentBridgeIndex}`;
              }

              bridgeData[jsonId] = bridgeData[jsonId] || {};

              // Capture data based on conversion type
              if (conversion.to === 'JSON') {
                // Store the JSON output as afterJson
                console.log(`Storing JSON output for bridge ${jsonId} (${conversion.from} → JSON)`);
                bridgeData[jsonId].afterJson = result.convertedMessage;
                // Also store the input as beforeJson
                bridgeData[jsonId].beforeJson = inputMessage;
              } else if (conversion.from === 'JSON') {
                // Store the JSON input as beforeJson and output as afterJson
                console.log(`Storing JSON input/output for bridge ${jsonId} (JSON → ${conversion.to})`);
                bridgeData[jsonId].beforeJson = inputMessage;
                bridgeData[jsonId].afterJson = result.convertedMessage;
              } else if (conversion.to === 'USDC') {
                // For crypto conversion, store the input JSON
                console.log(`Storing crypto conversion for bridge ${jsonId}`);
                bridgeData[jsonId].beforeJson = inputMessage;
                bridgeData[jsonId].afterJson = result.convertedMessage;
              }

              console.log(`Bridge data for ${jsonId}:`, {
                hasBeforeJson: !!bridgeData[jsonId].beforeJson,
                hasAfterJson: !!bridgeData[jsonId].afterJson
              });

              // Update the JSON bridge data state
              setJsonBridgeData({...bridgeData});
            }

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
            if (result.convertedMessage) {
              previousOutput = result.convertedMessage;
              console.log(`Stored output for next step (length: ${previousOutput.length})`);
            } else {
              console.error('No convertedMessage in result:', result);
              previousOutput = null;
            }

            // Update results display
            setConversionResults([...results]);

          } else {
            console.error(`Conversion failed at step ${i}:`, {
              from: conversion.from,
              to: conversion.to,
              error: result.error || 'Unknown error',
              success: result.success
            });
            // Stop the chain if a conversion fails
            setIsExecuting(false);
            setCurrentStep(null);

            // Show error to user
            results.push({
              step: i + 1,
              from: conversion.from,
              to: conversion.to,
              error: result.error || 'Conversion failed',
              processingTime: 0,
              processingStats: {},
              success: false
            });
            setConversionResults([...results]);

            return; // Exit the simulation
          }
        } catch (error) {
          console.error(`API call failed at step ${i}:`, {
            from: conversion.from,
            to: conversion.to,
            error: error.message
          });
          // Stop the chain on error
          setIsExecuting(false);
          setCurrentStep(null);

          results.push({
            step: i + 1,
            from: conversion.from,
            to: conversion.to,
            error: error.message,
            processingTime: 0,
            processingStats: {},
            success: false
          });
          setConversionResults([...results]);

          return; // Exit the simulation
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
          <h3>Select UK Destination Bank</h3>
          <div className={styles.destinationButtons}>
            <button
              className={`${styles.destinationButton} ${selectedDestination === 'lloyds' ? styles.selected : ''}`}
              onClick={() => {
                setSelectedDestination('lloyds');
                // Update the scenario with new destination
                if (selectedScenario) {
                  const updatedScenario = {
                    ...selectedScenario,
                    selectedDestination: 'lloyds',
                    hops: selectedScenario.conversionPaths.lloyds.hops,
                    conversions: selectedScenario.conversionPaths.lloyds.conversions
                  };
                  setSelectedScenario(updatedScenario);
                  buildScenarioFlow(updatedScenario);
                }
              }}
            >
              <span className={styles.flag}>🇬🇧</span>
              <span>Lloyds Bank (CHAPS)</span>
            </button>
            <button
              className={`${styles.destinationButton} ${selectedDestination === 'barclays' ? styles.selected : ''}`}
              onClick={() => {
                setSelectedDestination('barclays');
                // Update the scenario with new destination
                if (selectedScenario) {
                  const updatedScenario = {
                    ...selectedScenario,
                    selectedDestination: 'barclays',
                    hops: selectedScenario.conversionPaths.barclays.hops,
                    conversions: selectedScenario.conversionPaths.barclays.conversions
                  };
                  setSelectedScenario(updatedScenario);
                  buildScenarioFlow(updatedScenario);
                }
              }}
            >
              <span className={styles.flag}>🇬🇧</span>
              <span>Barclays (FPS)</span>
            </button>
          </div>
          <p className={styles.destinationInfo}>
            UK Correspondent Bank (HSBC) receives MT103 via SWIFT and converts to CHAPS or FPS for domestic settlement.
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
              edgeTypes={edgeTypes}
              fitView
              fitViewOptions={{
                padding: 0.2,
                includeHiddenNodes: false,
                maxZoom: 0.8,
                minZoom: 0.3,
                duration: 800
              }}
              defaultViewport={{ x: 0, y: 50, zoom: 0.38 }}
              minZoom={0.1}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
              translateExtent={[[-500, -500], [6000, 1500]]}
              nodeExtent={[[-200, -200], [5800, 1300]]}
              zoomOnScroll={true}
              panOnDrag={true}
            >
              <Controls position="top-right" />
            </ReactFlow>
          </div>
        </div>

        {!selectedScenario && (
          <div className={styles.emptyState}>
            <CanonicalJsonExplainer />
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

      {/* Conversion Details Modal */}
      <ConversionDetailsModal
        isOpen={isConversionModalOpen}
        onClose={() => setIsConversionModalOpen(false)}
        conversionData={conversionModalData}
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