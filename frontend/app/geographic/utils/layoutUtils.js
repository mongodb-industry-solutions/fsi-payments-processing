import dagre from 'dagre';

// Layout configurations for different scenario types
const LAYOUT_CONFIGS = {
  linear: {
    rankdir: 'LR', // Left to Right for payment flows
    align: 'UL',
    nodesep: 100,  // Horizontal spacing between nodes
    ranksep: 150,  // Spacing between ranks
    marginx: 50,
    marginy: 50,
  },
  hub: {
    rankdir: 'TB', // Top to Bottom for hub layouts
    align: 'DL',
    nodesep: 80,
    ranksep: 100,
    marginx: 50,
    marginy: 50,
  },
  complex: {
    rankdir: 'LR',
    align: 'DL',
    nodesep: 120,
    ranksep: 180,
    marginx: 60,
    marginy: 60,
  }
};

// Calculate layout using Dagre
export const getLayoutedElements = (nodes, edges, layoutType = 'linear') => {
  const dagreGraph = new dagre.graphlib.Graph();
  const config = LAYOUT_CONFIGS[layoutType] || LAYOUT_CONFIGS.linear;

  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph(config);

  // Add nodes to dagre graph with dimensions
  nodes.forEach((node) => {
    // Set dimensions based on node type
    let width = 200;
    let height = 150;

    if (node.type === 'jsonBridge') {
      width = 150;
      height = 80;
    } else if (node.data?.isHub) {
      width = 150;
      height = 120;
    }

    dagreGraph.setNode(node.id, { width, height });
  });

  // Add edges to dagre graph
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Calculate the layout
  dagre.layout(dagreGraph);

  // Apply the calculated positions back to nodes
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);

    // Calculate centering offset based on node type
    let offsetX = 100;
    let offsetY = 75;

    if (node.type === 'jsonBridge') {
      offsetX = 75;
      offsetY = 40;
    } else if (node.data?.isHub) {
      offsetX = 75;
      offsetY = 60;
    }

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - offsetX + 500, // Add 500px offset to move right
        y: nodeWithPosition.y - offsetY + 150, // Add 150px offset to move down
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

// Create a radial/circular layout for hub scenarios
export const getRadialLayout = (nodes, edges, hubId) => {
  const hubNode = nodes.find(n => n.id === hubId);
  if (!hubNode) return { nodes, edges };

  const centerX = 800; // Move center to the right
  const centerY = 300; // Center vertically
  const radius = 300; // Slightly smaller radius

  const layoutedNodes = nodes.map((node) => {
    if (node.id === hubId) {
      // Place hub at center
      return {
        ...node,
        position: { x: centerX - 75, y: centerY - 60 }
      };
    }

    // Place other nodes in a circle around hub
    const nonHubNodes = nodes.filter(n => n.id !== hubId);
    const nodeIndex = nonHubNodes.findIndex(n => n.id === node.id);
    const angleStep = (2 * Math.PI) / nonHubNodes.length;
    const angle = nodeIndex * angleStep - Math.PI / 2;

    return {
      ...node,
      position: {
        x: centerX + radius * Math.cos(angle) - 100,
        y: centerY + radius * Math.sin(angle) - 75
      }
    };
  });

  return { nodes: layoutedNodes, edges };
};

// Create a tree layout for complex hierarchical scenarios
export const getTreeLayout = (nodes, edges) => {
  const dagreGraph = new dagre.graphlib.Graph();

  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: 'TB',
    align: 'UL',
    nodesep: 100,
    ranksep: 100,
    ranker: 'tight-tree'
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 200, height: 150 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 100,
        y: nodeWithPosition.y - 75,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

// Create a routing tree layout for BFS path discovery scenarios with multi-hop paths
export const getRoutingTreeLayout = (nodes, edges, routingConfig) => {
  const { sourceId, destinationId, paths } = routingConfig;
  const layoutedNodes = [];
  const processedNodes = new Set(); // Track which nodes have been added

  // Positioning constants - CENTERED LAYOUT
  const canvasWidth = 1400; // Canvas width
  const canvasHeight = 550; // Height for vertical spacing
  const nodeWidth = 180;
  const nodeHeight = 90; // Node height
  const startX = 600; // Move much further right to center
  const endX = canvasWidth - 200; // Adjust end position
  const verticalPadding = 30; // Top and bottom padding
  const minLaneSpacing = 180; // Minimum spacing between path lanes

  // Calculate vertical positions using swim lanes
  const numPaths = paths ? paths.length : 0;
  const usableHeight = canvasHeight - (verticalPadding * 2);
  const centerY = canvasHeight / 2; // Center vertically

  // Position source node on the left (centered)
  const sourceNode = nodes.find(n => n.id === sourceId);
  if (sourceNode && !processedNodes.has(sourceId)) {
    layoutedNodes.push({
      ...sourceNode,
      position: { x: startX, y: centerY - nodeHeight/2 }
    });
    processedNodes.add(sourceId);
  }

  // Position destination node on the right (centered)
  const destNode = nodes.find(n => n.id === destinationId);
  if (destNode && !processedNodes.has(destinationId)) {
    layoutedNodes.push({
      ...destNode,
      position: { x: endX, y: centerY - nodeHeight/2 }
    });
    processedNodes.add(destinationId);
  }

  // Process paths using swim lanes - each path gets its own horizontal lane
  if (paths && paths.length > 0) {
    // Find the maximum hop count across all paths
    const maxHops = Math.max(...paths.map(p => (p.nodes || []).length));

    // Calculate horizontal positions for each hop
    const availableWidth = endX - startX - nodeWidth;
    const hopSpacing = availableWidth / (maxHops + 1);

    // Calculate Y positions for swim lanes with proper spacing
    let laneYPositions = [];

    if (numPaths === 1) {
      // Single path: centered at new higher position
      laneYPositions = [centerY - nodeHeight / 2];
    } else if (numPaths === 2) {
      // Two paths: position with excellent separation around new center
      const spacing = 120; // Good spacing for 2 paths
      laneYPositions = [
        centerY - spacing / 2 - nodeHeight / 2,
        centerY + spacing / 2 - nodeHeight / 2
      ];
    } else if (numPaths === 3) {
      // Three paths: even distribution from top
      laneYPositions = [
        30, // Top path (moved up from 80)
        centerY - nodeHeight / 2, // Middle path at new center
        centerY + 100 // Bottom path
      ];
    } else if (numPaths === 4) {
      // Four paths (remote island scenario): start from very top
      const laneSpacing = 90; // Tighter spacing for better fit
      const startY = 0; // Start from absolute top
      laneYPositions = [
        startY,
        startY + laneSpacing,
        startY + laneSpacing * 2,
        startY + laneSpacing * 3
      ];
    } else {
      // Multiple paths: distribute from top with tighter spacing
      const startY = 20; // Start from very top (was 50)
      const actualSpacing = Math.min(minLaneSpacing, (canvasHeight - 100) / numPaths);

      for (let i = 0; i < numPaths; i++) {
        laneYPositions.push(startY + i * actualSpacing);
      }
    }

    // Assign each path to a swim lane (Y position)
    paths.forEach((path, pathIndex) => {
      const pathNodes = path.nodes || [];
      const laneY = laneYPositions[pathIndex] || centerY;

      // Calculate path-specific horizontal spacing for better distribution
      const pathHopCount = pathNodes.length;
      const pathHopSpacing = pathHopCount > 0 ?
        (endX - startX - nodeWidth) / (pathHopCount + 1) : hopSpacing;

      // Position each node in the path horizontally along its lane
      pathNodes.forEach((nodeData, hopIndex) => {
        const nodeX = startX + pathHopSpacing * (hopIndex + 1) + nodeWidth / 2;
        const uniqueKey = `${nodeData.id}_path${pathIndex}`;
        const baseNode = nodes.find(n => n.id === nodeData.id);

        if (baseNode && !processedNodes.has(uniqueKey)) {
          layoutedNodes.push({
            ...baseNode,
            id: uniqueKey,
            position: {
              x: nodeX,
              y: laneY
            },
            data: {
              ...baseNode.data,
              originalId: nodeData.id,
              pathId: path.id,
              pathName: path.name || `Path ${pathIndex + 1}`,
              hopIndex: hopIndex + 1,
              totalHops: pathNodes.length,
              pathAvailable: path.available,
              pathOptimal: path.optimal,
              laneIndex: pathIndex
            }
          });
          processedNodes.add(uniqueKey);
        }
      });
    });
  }

  return { nodes: layoutedNodes, edges };
};

// Determine best layout based on scenario characteristics
export const determineLayoutStrategy = (scenario) => {
  if (!scenario) return 'linear';

  // Routing tree pattern for BFS scenarios
  if (scenario.isRoutingScenario) {
    return 'routing';
  }

  // Hub and spoke patterns
  if (scenario.parallel || scenario.hops.some(h => h.isHub)) {
    return 'hub';
  }

  // Complex scenarios with many hops
  if (scenario.hops.length > 5) {
    return 'complex';
  }

  // Default linear layout
  return 'linear';
};