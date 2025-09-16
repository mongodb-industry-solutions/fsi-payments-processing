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
    dagreGraph.setNode(node.id, {
      width: node.data?.isHub ? 150 : 200,
      height: node.data?.isHub ? 120 : 150
    });
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
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - (node.data?.isHub ? 75 : 100),
        y: nodeWithPosition.y - (node.data?.isHub ? 60 : 75),
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

// Create a radial/circular layout for hub scenarios
export const getRadialLayout = (nodes, edges, hubId) => {
  const hubNode = nodes.find(n => n.id === hubId);
  if (!hubNode) return { nodes, edges };

  const centerX = 600;
  const centerY = 400;
  const radius = 350;

  const layoutedNodes = nodes.map((node, index) => {
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

// Determine best layout based on scenario characteristics
export const determineLayoutStrategy = (scenario) => {
  if (!scenario) return 'linear';

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