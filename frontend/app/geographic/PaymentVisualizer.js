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
import { getLayoutedElements, getRadialLayout, determineLayoutStrategy } from './utils/layoutUtils';
import styles from './PaymentVisualizer.module.css';

const nodeTypes = {
  country: EnhancedCountryNode,
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

function PaymentVisualizerFlow() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodePosition, setNodePosition] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentStep, setCurrentStep] = useState(null);
  const [executionProgress, setExecutionProgress] = useState({});
  const { fitView } = useReactFlow();

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const onNodeClick = useCallback((event, node) => {
    if (node.type === 'country') {
      setSelectedNode(node.data);
      // Calculate position in screen coordinates
      const rect = event.currentTarget.getBoundingClientRect();
      setNodePosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        nodeId: node.id
      });
    }
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
        // Add country node
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

        // Add JSON bridge between countries (except after last country)
        if (index < scenario.hops.length - 1) {
          const jsonId = `json-${index}`;
          initialNodes.push({
            id: jsonId,
            type: 'country',
            position: { x: 0, y: 0 }, // Will be positioned by layout
            data: {
              country: 'JSON',
              format: 'Bridge',
              icon: '🔄',
              isHub: true,
              city: 'Universal',
              status: executionProgress[jsonId] || 'idle'
            }
          });

          // Create edges: country → JSON → next country
          initialEdges.push({
            id: `${hop.id}-${jsonId}`,
            source: hop.id,
            target: jsonId,
            ...edgeOptions,
            label: `${hop.format} → JSON`,
            labelStyle: { fontSize: 11, fontWeight: 600 }
          });

          const nextHop = scenario.hops[index + 1];
          initialEdges.push({
            id: `${jsonId}-${nextHop.id}`,
            source: jsonId,
            target: nextHop.id,
            ...edgeOptions,
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
    buildScenarioFlow(scenario);
  };

  const simulateExecution = async () => {
    if (!selectedScenario) return;

    setIsExecuting(true);
    setCurrentStep(0);
    const progress = {};

    // Simulate step-by-step execution
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

      // Wait for the conversion time
      await new Promise(resolve => setTimeout(resolve, conversion.time * 10)); // Speed up for demo

      if (fromNode) {
        progress[fromNode.id] = 'completed';
      }
      if (toNode) {
        progress[toNode.id] = 'processing';
      }
      setExecutionProgress({ ...progress });
    }

    // Mark all as completed
    selectedScenario.hops.forEach(hop => {
      progress[hop.id] = 'completed';
    });
    setExecutionProgress(progress);
    setIsExecuting(false);
    setCurrentStep(null);
  };

  useEffect(() => {
    // Update node statuses when execution progress changes
    if (selectedScenario) {
      buildScenarioFlow(selectedScenario);
    }
  }, [executionProgress]);

  return (
    <div className={styles.visualizerContainer}>
      <ScenarioSidebar
        onSelectScenario={handleSelectScenario}
        selectedScenario={selectedScenario}
      />

      <div className={styles.mainCanvas}>
        {selectedScenario && (
          <button
            className={styles.executeButton}
            onClick={simulateExecution}
            disabled={isExecuting}
          >
            {isExecuting ? 'Executing...' : 'Execute Scenario'}
          </button>
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