'use client';

import { useState, useEffect } from 'react';
import styles from './RouteDiscovery.module.css';

export default function RouteDiscovery({
  isDiscovering,
  paths,
  selectedPath,
  optimizationMode,
  onSelectPath,
  onChangeOptimization
}) {
  const [discoveryStep, setDiscoveryStep] = useState(0);
  const [queue, setQueue] = useState([]);
  const [visited, setVisited] = useState([]);
  const [currentNode, setCurrentNode] = useState(null);

  // Simulate BFS discovery animation
  useEffect(() => {
    if (!isDiscovering) {
      setDiscoveryStep(0);
      setQueue([]);
      setVisited([]);
      setCurrentNode(null);
      return;
    }

    // BFS animation steps
    const steps = [
      { queue: ['USA'], current: 'USA', visited: [] },
      { queue: ['JSON', 'SWIFT', 'ACH'], current: 'USA', visited: ['USA'] },
      { queue: ['SWIFT', 'ACH', 'NPP', 'CHAPS'], current: 'JSON', visited: ['USA', 'JSON'] },
      { queue: ['ACH', 'NPP', 'CHAPS', 'Singapore'], current: 'SWIFT', visited: ['USA', 'JSON', 'SWIFT'] },
      { queue: ['NPP', 'CHAPS', 'Singapore', 'New Zealand'], current: 'ACH', visited: ['USA', 'JSON', 'SWIFT', 'ACH'] },
      { queue: ['CHAPS', 'Singapore', 'New Zealand', 'Fiji'], current: 'NPP', visited: ['USA', 'JSON', 'SWIFT', 'ACH', 'NPP'] },
      { queue: ['Singapore', 'New Zealand', 'Fiji'], current: 'CHAPS', visited: ['USA', 'JSON', 'SWIFT', 'ACH', 'NPP', 'CHAPS'] },
      { queue: ['New Zealand', 'Fiji'], current: 'Singapore', visited: ['USA', 'JSON', 'SWIFT', 'ACH', 'NPP', 'CHAPS', 'Singapore'] },
      { queue: ['Fiji'], current: 'New Zealand', visited: ['USA', 'JSON', 'SWIFT', 'ACH', 'NPP', 'CHAPS', 'Singapore', 'New Zealand'] },
      { queue: [], current: 'Fiji', visited: ['USA', 'JSON', 'SWIFT', 'ACH', 'NPP', 'CHAPS', 'Singapore', 'New Zealand', 'Fiji'] }
    ];

    const timer = setTimeout(() => {
      if (discoveryStep < steps.length) {
        const step = steps[discoveryStep];
        setQueue(step.queue);
        setCurrentNode(step.current);
        setVisited(step.visited);
        setDiscoveryStep(prev => prev + 1);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [isDiscovering, discoveryStep]);

  const optimizationModes = [
    { id: 'balanced', name: 'Balanced', icon: '⚖️', description: 'Optimize all factors' },
    { id: 'fastest', name: 'Fastest', icon: '⚡', description: 'Minimize latency' },
    { id: 'cheapest', name: 'Cheapest', icon: '💰', description: 'Minimize cost' },
    { id: 'reliable', name: 'Most Reliable', icon: '🛡️', description: 'Maximize success rate' }
  ];

  return (
    <div className={styles.container}>
      {/* Optimization Mode Selector */}
      <div className={styles.optimizationSelector}>
        <h3>Optimization Mode</h3>
        <div className={styles.modes}>
          {optimizationModes.map(mode => (
            <button
              key={mode.id}
              className={`${styles.modeButton} ${optimizationMode === mode.id ? styles.active : ''}`}
              onClick={() => onChangeOptimization(mode.id)}
            >
              <span className={styles.modeIcon}>{mode.icon}</span>
              <div>
                <div className={styles.modeName}>{mode.name}</div>
                <div className={styles.modeDesc}>{mode.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* BFS Visualization */}
      {isDiscovering && (
        <div className={styles.bfsVisualization}>
          <h4>🔍 BFS Path Discovery</h4>

          <div className={styles.algorithmState}>
            <div className={styles.queueDisplay}>
              <div className={styles.label}>Queue:</div>
              <div className={styles.nodes}>
                {queue.length > 0 ? (
                  queue.map((node, idx) => (
                    <span key={idx} className={styles.queueNode}>{node}</span>
                  ))
                ) : (
                  <span className={styles.empty}>Empty</span>
                )}
              </div>
            </div>

            <div className={styles.currentDisplay}>
              <div className={styles.label}>Exploring:</div>
              <div className={styles.currentNode}>
                {currentNode || 'None'}
              </div>
            </div>

            <div className={styles.visitedDisplay}>
              <div className={styles.label}>Visited:</div>
              <div className={styles.visitedNodes}>
                {visited.map((node, idx) => (
                  <span key={idx} className={styles.visitedNode}>{node}</span>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${(discoveryStep / 10) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Path Options */}
      <div className={styles.pathOptions}>
        <h3>Available Routes to Fiji</h3>
        {Object.entries(paths || {}).map(([key, path]) => (
          <div
            key={key}
            className={`${styles.pathCard} ${
              selectedPath === key ? styles.selected : ''
            } ${!path.available ? styles.unavailable : ''}`}
            onClick={() => path.available && onSelectPath(key)}
          >
            <div className={styles.pathHeader}>
              <span className={styles.pathName}>{path.name}</span>
              {key === 'working' && (
                <span className={styles.badge}>✅ Available</span>
              )}
              {key === selectedPath && (
                <span className={styles.selectedBadge}>Selected</span>
              )}
            </div>

            <div className={styles.pathRoute}>
              {path.path.map((node, idx) => (
                <span key={idx}>
                  <span className={styles.routeNode}>{node}</span>
                  {idx < path.path.length - 1 && (
                    <span className={styles.routeArrow}>→</span>
                  )}
                </span>
              ))}
            </div>

            <div className={styles.pathMetrics}>
              <div className={styles.metric}>
                <span className={styles.metricIcon}>💰</span>
                <span className={styles.metricValue}>${path.cost}</span>
              </div>
              <div className={styles.metric}>
                <span className={styles.metricIcon}>⚡</span>
                <span className={styles.metricValue}>{path.time}s</span>
              </div>
              <div className={styles.metric}>
                <span className={styles.metricIcon}>🛡️</span>
                <span className={styles.metricValue}>{path.reliability}%</span>
              </div>
            </div>

            <div className={styles.pathReason}>
              <span className={styles.reasonIcon}>ℹ️</span>
              <span>{path.reason}</span>
            </div>

            {!path.available && (
              <div className={styles.unavailableOverlay}>
                <span>Configuration Not Available</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Route Analysis */}
      {selectedPath && paths[selectedPath] && (
        <div className={styles.routeAnalysis}>
          <h4>📊 Route Analysis</h4>
          <div className={styles.analysisGrid}>
            <div className={styles.analysisItem}>
              <span className={styles.analysisLabel}>Selected Route:</span>
              <span className={styles.analysisValue}>{paths[selectedPath].name}</span>
            </div>
            <div className={styles.analysisItem}>
              <span className={styles.analysisLabel}>Total Cost:</span>
              <span className={styles.analysisValue}>${paths[selectedPath].cost}</span>
            </div>
            <div className={styles.analysisItem}>
              <span className={styles.analysisLabel}>Processing Time:</span>
              <span className={styles.analysisValue}>{paths[selectedPath].time} seconds</span>
            </div>
            <div className={styles.analysisItem}>
              <span className={styles.analysisLabel}>Success Rate:</span>
              <span className={styles.analysisValue}>{paths[selectedPath].reliability}%</span>
            </div>
          </div>

          <div className={styles.routingDecision}>
            <div className={styles.decisionIcon}>🧭</div>
            <div>
              <strong>Routing Decision:</strong> Based on {optimizationMode} optimization,
              the system selected the {paths[selectedPath].name.toLowerCase()} route
              as it provides the best balance for your requirements.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}