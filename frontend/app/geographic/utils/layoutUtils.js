import dagre from 'dagre';

// Layout configurations for different scenario types
const LAYOUT_CONFIGS = {
  linear: {
    rankdir: 'LR', // Left to Right for payment flows
    align: 'UL',
    nodesep: 180,  // Much more horizontal spacing between nodes
    ranksep: 250,  // Increased spacing between ranks
    marginx: 80,
    marginy: 60,
  },
  crypto: {
    rankdir: 'LR', // Left to Right for payment flows
    align: 'UL',
    nodesep: 100,  // Increased horizontal spacing - controls edge length between nodes
    ranksep: 160,  // More rank separation - controls distance between columns
    marginx: 50,
    marginy: 50,
  },
  hub: {
    rankdir: 'TB', // Top to Bottom for hub layouts
    align: 'DL',
    nodesep: 120,
    ranksep: 150,
    marginx: 60,
    marginy: 60,
  },
  complex: {
    rankdir: 'LR',
    align: 'DL',
    nodesep: 200,
    ranksep: 280,
    marginx: 80,
    marginy: 80,
  }
};

// Calculate layout using Dagre
export const getLayoutedElements = (nodes, edges, layoutType = 'linear') => {
  const dagreGraph = new dagre.graphlib.Graph();
  const config = LAYOUT_CONFIGS[layoutType] || LAYOUT_CONFIGS.linear;

  // Debug logging to verify crypto layout is being used
  if (layoutType === 'crypto') {
    console.log('Using crypto layout with config:', config);
  }

  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph(config);

  // Add nodes to dagre graph with dimensions
  nodes.forEach((node) => {
    // Set dimensions based on node type
    let width = 200;
    let height = 150;

    // For crypto layout, use standard dimensions with increased spacing
    if (layoutType === 'crypto') {
      width = 180;
      height = 140;

      if (node.type === 'jsonBridge') {
        width = 140;
        height = 80;
      }
    } else {
      if (node.type === 'jsonBridge') {
        width = 150;
        height = 80;
      } else if (node.type === 'crypto') {
        width = 200;
        height = 150;
      } else if (node.data?.isHub) {
        width = 150;
        height = 120;
      }
    }

    dagreGraph.setNode(node.id, { width, height });
  });

  // Add edges to dagre graph
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Calculate the layout
  dagre.layout(dagreGraph);

  // Different base offsets for different layouts
  let baseOffsetX = 300;
  let baseOffsetY = 200;

  // Crypto layout needs balanced offset for moderate spacing
  if (layoutType === 'crypto') {
    baseOffsetX = 150;  // Balanced offset for better spacing
    baseOffsetY = 150;  // Reduced from 200
  }

  // Apply the calculated positions back to nodes
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);

    // Calculate centering offset based on node type
    let offsetX = 100;
    let offsetY = 75;

    // For crypto layout, use offsets matching the standard dimensions
    if (layoutType === 'crypto') {
      offsetX = 90;
      offsetY = 70;

      if (node.type === 'jsonBridge') {
        offsetX = 70;
        offsetY = 40;
      }
    } else {
      if (node.type === 'jsonBridge') {
        offsetX = 75;
        offsetY = 40;
      } else if (node.type === 'crypto') {
        offsetX = 100;
        offsetY = 75;
      } else if (node.data?.isHub) {
        offsetX = 75;
        offsetY = 60;
      }
    }

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - offsetX + baseOffsetX, // Use layout-specific offset
        y: nodeWithPosition.y - offsetY + baseOffsetY, // Use layout-specific offset
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

// Create a radial/circular layout for hub scenarios
export const getRadialLayout = (nodes, edges, hubId) => {
  const hubNode = nodes.find(n => n.id === hubId);
  if (!hubNode) return { nodes, edges };

  const centerX = 1000; // Center in expanded canvas
  const centerY = 400; // Center vertically in expanded canvas
  const radius = 400; // Larger radius for better spacing

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

  // Positioning constants - EXPANDED LAYOUT FOR ROUTING
  const canvasWidth = 2000; // Increased canvas width for more space
  const canvasHeight = 800; // Increased height for better vertical distribution
  const nodeWidth = 180;
  const nodeHeight = 90; // Node height
  const startX = 300; // Source node position
  const endX = canvasWidth - 300; // Destination node position
  const verticalPadding = 50; // Top and bottom padding
  const minLaneSpacing = 150; // Spacing between path lanes

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
      // Four paths (remote island scenario): evenly distributed
      const laneSpacing = 140; // Good spacing for 4 paths
      const startY = verticalPadding + 50; // Start with padding
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
        // Better horizontal distribution with proper offsets
        const nodeX = startX + nodeWidth + pathHopSpacing * (hopIndex + 1);
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

  // Crypto scenarios need extra spacing
  if (scenario.complexity === 'hybrid-crypto' ||
      (scenario.hops && scenario.hops.some(h => h.isCrypto))) {
    return 'crypto';
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