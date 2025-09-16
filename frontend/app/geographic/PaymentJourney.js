'use client';

import React, { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import CustomCountryNode from './CustomNodes';
import AnimatedEdge from './CustomEdges';
import styles from './paymentJourney.module.css';

const nodeTypes = {
  country: CustomCountryNode,
};

const edgeTypes = {
  animated: AnimatedEdge,
};

export default function PaymentJourney({
  sourceCountry,
  targetCountry,
  scenario,
  onExecute,
  executionResult,
  isExecuting
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [currentStep, setCurrentStep] = useState(-1);

  // Generate nodes and edges based on scenario or simple source/target
  useEffect(() => {
    if (scenario && scenario.hops) {
      // Complex multi-hop scenario
      generateScenarioNodes(scenario);
    } else if (sourceCountry && targetCountry) {
      // Simple source → JSON → target
      generateSimpleNodes();
    } else {
      setNodes([]);
      setEdges([]);
    }
  }, [scenario, sourceCountry, targetCountry, currentStep, isExecuting]);

  const generateScenarioNodes = (scenario) => {
    const newNodes = [];
    const newEdges = [];
    const nodeSpacing = 200;
    const verticalSpacing = 120;
    let nodeIndex = 0;

    // Check if it's a parallel scenario
    const isParallel = scenario.parallel === true;

    if (isParallel && scenario.id === 'lightning-network') {
      // Special layout for Lightning Network (parallel paths)
      // Source node
      newNodes.push({
        id: 'source',
        type: 'country',
        position: { x: 100, y: 200 },
        data: {
          country: 'USA',
          format: 'MT103',
          icon: '🇺🇸',
          isSource: true,
          isActive: currentStep >= 0,
        },
      });

      // JSON bridge after source
      newNodes.push({
        id: 'json-source',
        type: 'country',
        position: { x: 300, y: 200 },
        data: {
          country: 'JSON',
          format: 'Bridge',
          icon: '🔄',
          isHub: true,
          isActive: currentStep >= 1,
        },
      });

      // Parallel paths
      const parallelPaths = [
        { id: 'uk-path', country: 'UK', format: 'CHAPS', icon: '🇬🇧', y: 50 },
        { id: 'eu-path', country: 'EU', format: 'TARGET2', icon: '🇪🇺', y: 200 },
        { id: 'jp-path', country: 'Japan', format: 'MT202', icon: '🇯🇵', y: 350 },
      ];

      parallelPaths.forEach((path, idx) => {
        // Country node
        newNodes.push({
          id: path.id,
          type: 'country',
          position: { x: 500, y: path.y },
          data: {
            country: path.country,
            format: path.format,
            icon: path.icon,
            isActive: currentStep >= 2 + idx,
          },
        });

        // JSON bridge after country
        newNodes.push({
          id: `json-${path.id}`,
          type: 'country',
          position: { x: 700, y: path.y },
          data: {
            country: 'JSON',
            format: 'Bridge',
            icon: '🔄',
            isHub: true,
            isActive: currentStep >= 5 + idx,
          },
        });
      });

      // Singapore hub
      newNodes.push({
        id: 'singapore-hub',
        type: 'country',
        position: { x: 900, y: 200 },
        data: {
          country: 'Singapore',
          format: 'Universal Hub',
          icon: '🇸🇬',
          isHub: true,
          isTarget: true,
          isActive: currentStep >= 8,
        },
      });

      // Create edges
      newEdges.push({
        id: 'source-to-json',
        source: 'source',
        target: 'json-source',
        type: 'animated',
        animated: isExecuting && currentStep === 0,
        style: { stroke: currentStep > 0 ? '#10b981' : '#94a3b8', strokeWidth: 3 },
        markerEnd: { type: MarkerType.ArrowClosed, color: currentStep > 0 ? '#10b981' : '#94a3b8' },
      });

      // From JSON to parallel paths
      parallelPaths.forEach((path, idx) => {
        newEdges.push({
          id: `json-to-${path.id}`,
          source: 'json-source',
          target: path.id,
          type: 'animated',
          animated: isExecuting && currentStep === 1 + idx,
          style: { stroke: currentStep > 1 + idx ? '#10b981' : '#94a3b8', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: currentStep > 1 + idx ? '#10b981' : '#94a3b8' },
        });

        newEdges.push({
          id: `${path.id}-to-json`,
          source: path.id,
          target: `json-${path.id}`,
          type: 'animated',
          animated: isExecuting && currentStep === 4 + idx,
          style: { stroke: currentStep > 4 + idx ? '#10b981' : '#94a3b8', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: currentStep > 4 + idx ? '#10b981' : '#94a3b8' },
        });

        newEdges.push({
          id: `json-${path.id}-to-hub`,
          source: `json-${path.id}`,
          target: 'singapore-hub',
          type: 'animated',
          animated: isExecuting && currentStep === 7 + idx,
          style: { stroke: currentStep > 7 + idx ? '#10b981' : '#94a3b8', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: currentStep > 7 + idx ? '#10b981' : '#94a3b8' },
        });
      });
    } else if (scenario.id === 'spider-web') {
      // Spider Web layout (hub and spoke)
      const hubX = 500;
      const hubY = 200;

      // Hub in center
      newNodes.push({
        id: 'singapore-hub',
        type: 'country',
        position: { x: hubX, y: hubY },
        data: {
          country: 'Singapore Hub',
          format: 'JSON',
          icon: '🇸🇬',
          isHub: true,
          isActive: currentStep >= 2,
        },
      });

      // Input countries
      const inputs = [
        { id: 'india', country: 'India', format: 'ACH', icon: '🇮🇳', x: 200, y: 100 },
        { id: 'uae', country: 'UAE', format: 'MT103', icon: '🇦🇪', x: 200, y: 300 },
      ];

      inputs.forEach((input, idx) => {
        newNodes.push({
          id: input.id,
          type: 'country',
          position: { x: input.x, y: input.y },
          data: {
            country: input.country,
            format: input.format,
            icon: input.icon,
            isSource: true,
            isActive: currentStep >= idx,
          },
        });

        newEdges.push({
          id: `${input.id}-to-hub`,
          source: input.id,
          target: 'singapore-hub',
          type: 'animated',
          animated: isExecuting && currentStep === idx,
          style: { stroke: currentStep > idx ? '#10b981' : '#94a3b8', strokeWidth: 3 },
          markerEnd: { type: MarkerType.ArrowClosed, color: currentStep > idx ? '#10b981' : '#94a3b8' },
          data: { label: `${input.format} → JSON` },
        });
      });

      // Output countries
      const outputs = [
        { id: 'brazil', country: 'Brazil', format: 'pacs.008', icon: '🇧🇷', x: 800, y: 100 },
        { id: 'germany', country: 'Germany', format: 'TARGET2', icon: '🇩🇪', x: 800, y: 300 },
      ];

      outputs.forEach((output, idx) => {
        newNodes.push({
          id: output.id,
          type: 'country',
          position: { x: output.x, y: output.y },
          data: {
            country: output.country,
            format: output.format,
            icon: output.icon,
            isTarget: true,
            isActive: currentStep >= 3 + idx,
          },
        });

        newEdges.push({
          id: `hub-to-${output.id}`,
          source: 'singapore-hub',
          target: output.id,
          type: 'animated',
          animated: isExecuting && currentStep === 3 + idx,
          style: { stroke: currentStep > 3 + idx ? '#10b981' : '#94a3b8', strokeWidth: 3 },
          markerEnd: { type: MarkerType.ArrowClosed, color: currentStep > 3 + idx ? '#10b981' : '#94a3b8' },
          data: { label: `JSON → ${output.format}` },
        });
      });
    } else {
      // Linear scenarios (Grand Tour, Impossible Chain, etc.)
      let xPos = 100;
      const yPos = 100;

      scenario.hops.forEach((hop, index) => {
        // Add country/system node
        newNodes.push({
          id: hop.id,
          type: 'country',
          position: { x: xPos, y: yPos + (hop.parallel ? hop.parallel * 100 : 0) },
          data: {
            country: hop.country,
            format: hop.format,
            icon: hop.icon || '🏦',
            city: hop.city,
            compliance: hop.compliance,
            isHub: hop.isHub,
            isActive: currentStep >= nodeIndex,
            isSource: index === 0,
            isTarget: index === scenario.hops.length - 1,
          },
        });

        // Add JSON bridge between countries (except after last node)
        if (index < scenario.hops.length - 1) {
          xPos += nodeSpacing;
          newNodes.push({
            id: `json-${index}`,
            type: 'country',
            position: { x: xPos, y: yPos },
            data: {
              country: 'JSON',
              format: 'Bridge',
              icon: '🔄',
              isHub: true,
              isActive: currentStep >= nodeIndex + 1,
            },
          });
          xPos += nodeSpacing;
        }

        nodeIndex += 2;
      });

      // Create edges for linear flow
      let edgeIndex = 0;
      for (let i = 0; i < scenario.hops.length - 1; i++) {
        // Edge from country to JSON
        newEdges.push({
          id: `${scenario.hops[i].id}-to-json-${i}`,
          source: scenario.hops[i].id,
          target: `json-${i}`,
          type: 'animated',
          animated: isExecuting && currentStep === edgeIndex,
          style: {
            stroke: currentStep > edgeIndex ? '#10b981' : '#94a3b8',
            strokeWidth: 3,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: currentStep > edgeIndex ? '#10b981' : '#94a3b8',
          },
          data: {
            label: `${scenario.hops[i].format} → JSON`,
            isActive: currentStep === edgeIndex,
          },
        });
        edgeIndex++;

        // Edge from JSON to next country
        newEdges.push({
          id: `json-${i}-to-${scenario.hops[i + 1].id}`,
          source: `json-${i}`,
          target: scenario.hops[i + 1].id,
          type: 'animated',
          animated: isExecuting && currentStep === edgeIndex,
          style: {
            stroke: currentStep > edgeIndex ? '#10b981' : '#94a3b8',
            strokeWidth: 3,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: currentStep > edgeIndex ? '#10b981' : '#94a3b8',
          },
          data: {
            label: `JSON → ${scenario.hops[i + 1].format}`,
            isActive: currentStep === edgeIndex,
          },
        });
        edgeIndex++;
      }
    }

    setNodes(newNodes);
    setEdges(newEdges);
  };

  const generateSimpleNodes = () => {
    // Original simple 3-node layout for basic scenarios
    const newNodes = [
      {
        id: 'source',
        type: 'country',
        position: { x: 100, y: 100 },
        data: {
          country: sourceCountry.name,
          format: sourceCountry.format,
          isSource: true,
          isActive: currentStep === 0,
          icon: sourceCountry.icon || '🏦',
        },
      },
      {
        id: 'json-hub',
        type: 'country',
        position: { x: 400, y: 100 },
        data: {
          country: 'JSON',
          format: 'Universal Bridge',
          isHub: true,
          isActive: currentStep === 1,
          icon: '🔄',
        },
      },
      {
        id: 'target',
        type: 'country',
        position: { x: 700, y: 100 },
        data: {
          country: targetCountry.name,
          format: targetCountry.format,
          isTarget: true,
          isActive: currentStep === 2,
          icon: targetCountry.icon || '🏦',
        },
      },
    ];

    const newEdges = [
      {
        id: 'e1-2',
        source: 'source',
        target: 'json-hub',
        type: 'animated',
        animated: isExecuting && currentStep === 0,
        style: {
          stroke: currentStep > 0 ? '#10b981' : '#94a3b8',
          strokeWidth: 3,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: currentStep > 0 ? '#10b981' : '#94a3b8',
        },
        data: {
          label: `${sourceCountry.format} → JSON`,
          isActive: currentStep === 0,
        },
      },
      {
        id: 'e2-3',
        source: 'json-hub',
        target: 'target',
        type: 'animated',
        animated: isExecuting && currentStep === 1,
        style: {
          stroke: currentStep > 1 ? '#10b981' : '#94a3b8',
          strokeWidth: 3,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: currentStep > 1 ? '#10b981' : '#94a3b8',
        },
        data: {
          label: `JSON → ${targetCountry.format}`,
          isActive: currentStep === 1,
        },
      },
    ];

    setNodes(newNodes);
    setEdges(newEdges);
  };

  // Handle execution animation
  useEffect(() => {
    if (isExecuting) {
      let step = 0;
      const totalSteps = scenario?.conversions?.length || 2;

      const animateSteps = () => {
        if (step < totalSteps) {
          setCurrentStep(step);
          step++;
          setTimeout(animateSteps, 600); // Faster animation for multi-hop
        } else {
          setCurrentStep(totalSteps);
          setTimeout(() => setCurrentStep(-1), 2000); // Reset after completion
        }
      };
      animateSteps();
    } else {
      setCurrentStep(-1);
    }
  }, [isExecuting, scenario]);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  return (
    <div className={styles.flowContainer}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.1 }}
        attributionPosition="top-right"
      >
        <Controls />
        <MiniMap
          style={{
            height: 100,
          }}
          zoomable
          pannable
        />
        <Background color="#e2e8f0" gap={16} />
      </ReactFlow>

      {/* Conversion Progress Panel */}
      {scenario?.conversions && (
        <div className={styles.progressPanel}>
          <h3>{scenario.name}</h3>
          <div className={styles.progressScroll}>
            {scenario.conversions.map((conversion, idx) => (
              <div
                key={idx}
                className={`${styles.conversionStep} ${
                  idx <= currentStep ? styles.completed : ''
                }`}
              >
                <div className={styles.stepNumber}>
                  {idx <= currentStep ? '✅' : `${idx + 1}`}
                </div>
                <div className={styles.stepDetails}>
                  <strong>{conversion.from} → {conversion.to}</strong>
                  <span className={styles.location}>📍 {conversion.location}</span>
                  <span className={styles.description}>{conversion.description}</span>
                  {idx <= currentStep && (
                    <span className={styles.time}>⏱️ {conversion.time}ms</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className={styles.totalTime}>
            <strong>Total Time:</strong> {scenario.totalTime}ms
            <br />
            <strong>Complexity:</strong> {scenario.complexity}
          </div>
        </div>
      )}

      {/* Simple execution result (for non-scenario mode) */}
      {!scenario && executionResult && (
        <div className={styles.progressPanel}>
          <h3>Conversion Progress</h3>
          {executionResult.conversions?.map((conversion, idx) => (
            <div
              key={idx}
              className={`${styles.conversionStep} ${
                idx <= currentStep ? styles.completed : ''
              }`}
            >
              <div className={styles.stepNumber}>
                {idx <= currentStep ? '✅' : `${idx + 1}`}
              </div>
              <div className={styles.stepDetails}>
                <strong>{conversion.from} → {conversion.to}</strong>
                <span className={styles.location}>📍 {conversion.location}</span>
                {idx <= currentStep && (
                  <span className={styles.time}>⏱️ {conversion.time_ms.toFixed(2)}ms</span>
                )}
              </div>
            </div>
          ))}
          <div className={styles.totalTime}>
            <strong>Total Time:</strong> {executionResult.execution_time_ms?.toFixed(2)}ms
          </div>
        </div>
      )}
    </div>
  );
}