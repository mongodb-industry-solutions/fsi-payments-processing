'use client';

import { useState, useEffect } from 'react';
import styles from './demo.module.css';

export default function PaymentRoutingDemo() {
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [executionResult, setExecutionResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('visual'); // visual, technical, comparison
  const [animationStep, setAnimationStep] = useState(0);

  // Load scenarios on mount
  useEffect(() => {
    fetchScenarios();
  }, []);

  const fetchScenarios = async () => {
    try {
      const response = await fetch('http://localhost:8001/api/v1/demo/scenarios/list');
      const data = await response.json();
      setScenarios(data);
    } catch (error) {
      console.error('Failed to load scenarios:', error);
    }
  };

  const executeScenario = async (scenario) => {
    setLoading(true);
    setExecutionResult(null);
    setAnimationStep(0);
    
    try {
      const response = await fetch(`http://localhost:8001/api/v1/demo/scenarios/execute/${scenario.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario_id: scenario.id,
          simulate_delays: true,
          show_intermediate_steps: true
        })
      });
      
      const result = await response.json();
      setExecutionResult(result);
      
      // Animate the route
      if (result.intermediate_messages) {
        for (let i = 0; i < result.intermediate_messages.length; i++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          setAnimationStep(i + 1);
        }
      }
    } catch (error) {
      console.error('Failed to execute scenario:', error);
    } finally {
      setLoading(false);
    }
  };

  const getComplexityColor = (complexity) => {
    switch(complexity) {
      case 'simple': return '#4CAF50';
      case 'medium': return '#FF9800';
      case 'complex': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getLaneIcon = (lane) => {
    switch(lane) {
      case 'rules': return '⚡';
      case 'ai': return '🤖';
      case 'human': return '👤';
      default: return '📊';
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1>🌍 Cross-Border Payment Routing Demo</h1>
        <p>Experience intelligent multi-hop payment routing across 18 real-world scenarios</p>
      </div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Scenario Selector */}
        <div className={styles.scenarioPanel}>
          <h2>Select Payment Scenario</h2>
          <div className={styles.scenarioGrid}>
            {scenarios.map(scenario => (
              <div 
                key={scenario.id}
                className={`${styles.scenarioCard} ${selectedScenario?.id === scenario.id ? styles.selected : ''}`}
                onClick={() => setSelectedScenario(scenario)}
              >
                <div className={styles.scenarioHeader}>
                  <span className={styles.scenarioName}>{scenario.name}</span>
                  <span 
                    className={styles.complexity}
                    style={{ backgroundColor: getComplexityColor(scenario.complexity) }}
                  >
                    {scenario.complexity}
                  </span>
                </div>
                <div className={styles.scenarioDetails}>
                  <div>Amount: {scenario.amount}</div>
                  <div>Hops: {scenario.expected_hops}</div>
                  <div className={styles.purpose}>{scenario.purpose}</div>
                </div>
                {scenario.urgent && <span className={styles.urgent}>⚠️ URGENT</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Visualization Panel */}
        {selectedScenario && (
          <div className={styles.visualizationPanel}>
            <div className={styles.controlBar}>
              <button 
                className={styles.executeBtn}
                onClick={() => executeScenario(selectedScenario)}
                disabled={loading}
              >
                {loading ? 'Processing...' : '▶️ Execute Payment'}
              </button>
              <div className={styles.viewToggle}>
                <button 
                  className={viewMode === 'visual' ? styles.active : ''}
                  onClick={() => setViewMode('visual')}
                >
                  Visual
                </button>
                <button 
                  className={viewMode === 'technical' ? styles.active : ''}
                  onClick={() => setViewMode('technical')}
                >
                  Technical
                </button>
                <button 
                  className={viewMode === 'comparison' ? styles.active : ''}
                  onClick={() => setViewMode('comparison')}
                >
                  Comparison
                </button>
              </div>
            </div>

            {/* Route Visualization */}
            {viewMode === 'visual' && (
              <div className={styles.routeVisualization}>
                <h3>Payment Route</h3>
                <div className={styles.routePath}>
                  {selectedScenario.route.map((format, index) => (
                    <div key={index} className={styles.routeStep}>
                      <div 
                        className={`${styles.formatNode} ${
                          animationStep > index ? styles.completed : ''
                        } ${animationStep === index ? styles.active : ''}`}
                      >
                        {format}
                      </div>
                      {index < selectedScenario.route.length - 1 && (
                        <div className={`${styles.arrow} ${
                          animationStep > index ? styles.animated : ''
                        }`}>→</div>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Processing Stats */}
                {executionResult && (
                  <div className={styles.statsPanel}>
                    <div className={styles.statCard}>
                      <h4>Processing Time</h4>
                      <div className={styles.statValue}>
                        {executionResult.total_time_ms.toFixed(0)}ms
                      </div>
                    </div>
                    <div className={styles.statCard}>
                      <h4>Confidence Score</h4>
                      <div className={styles.statValue}>
                        {executionResult.confidence_score.toFixed(1)}%
                      </div>
                    </div>
                    <div className={styles.statCard}>
                      <h4>Total Hops</h4>
                      <div className={styles.statValue}>
                        {executionResult.processing_stats.total_hops}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Technical View */}
            {viewMode === 'technical' && executionResult && (
              <div className={styles.technicalView}>
                <h3>Lane Distribution</h3>
                <div className={styles.laneDistribution}>
                  <div className={styles.laneColumn}>
                    <h4>{getLaneIcon('rules')} Rules Lane</h4>
                    <div className={styles.percentage}>
                      {executionResult.processing_stats.rules_percentage.toFixed(1)}%
                    </div>
                    <div className={styles.fieldList}>
                      {executionResult.lane_distribution.rules.slice(0, 5).map((field, i) => (
                        <div key={i} className={styles.field}>{field}</div>
                      ))}
                    </div>
                  </div>
                  
                  <div className={styles.laneColumn}>
                    <h4>{getLaneIcon('ai')} AI Lane</h4>
                    <div className={styles.percentage}>
                      {executionResult.processing_stats.ai_percentage.toFixed(1)}%
                    </div>
                    <div className={styles.fieldList}>
                      {executionResult.lane_distribution.ai.slice(0, 5).map((field, i) => (
                        <div key={i} className={styles.field}>{field}</div>
                      ))}
                    </div>
                  </div>
                  
                  <div className={styles.laneColumn}>
                    <h4>{getLaneIcon('human')} Human Review</h4>
                    <div className={styles.percentage}>
                      {executionResult.processing_stats.human_percentage.toFixed(1)}%
                    </div>
                    <div className={styles.fieldList}>
                      {executionResult.lane_distribution.human.slice(0, 5).map((field, i) => (
                        <div key={i} className={styles.field}>{field}</div>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Intermediate Steps */}
                <h3>Processing Steps</h3>
                <div className={styles.steps}>
                  {executionResult.intermediate_messages.map((step, i) => (
                    <div key={i} className={styles.stepCard}>
                      <div className={styles.stepHeader}>
                        Step {step.step}: {step.source_format} → {step.target_format}
                      </div>
                      <div className={styles.stepDetails}>
                        <span>Time: {step.processing_time_ms.toFixed(0)}ms</span>
                        <span>Confidence: {step.confidence}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Message Comparison */}
            {viewMode === 'comparison' && executionResult && (
              <div className={styles.comparisonView}>
                <h3>Message Format Comparison</h3>
                <div className={styles.messageComparison}>
                  <div className={styles.messagePanel}>
                    <h4>Original ({selectedScenario.route[0]})</h4>
                    <pre className={styles.messageContent}>
                      {selectedScenario.sample_message || 'Sample message not available'}
                    </pre>
                  </div>
                  <div className={styles.conversionArrow}>
                    <div className={styles.arrowIcon}>→</div>
                    <div className={styles.conversionStats}>
                      <div>{selectedScenario.expected_hops} hops</div>
                      <div>{executionResult.total_time_ms.toFixed(0)}ms</div>
                    </div>
                  </div>
                  <div className={styles.messagePanel}>
                    <h4>Final ({selectedScenario.route[selectedScenario.route.length - 1]})</h4>
                    <pre className={styles.messageContent}>
                      {executionResult.final_output.substring(0, 500)}...
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Batch Simulation */}
      {selectedScenario && (
        <div className={styles.batchSimulation}>
          <h2>Batch Processing Simulation</h2>
          <button 
            className={styles.batchBtn}
            onClick={async () => {
              const response = await fetch(`http://localhost:8001/api/v1/demo/scenarios/simulate-batch?scenario_id=${selectedScenario.id}&count=1000`, {
                method: 'POST'
              });
              const data = await response.json();
              alert(`Batch of 1000 payments processed:\n
                Success: ${data.processing_summary.successful}\n
                Time: ${data.performance.total_time_seconds}s\n
                Savings: $${data.cost_analysis.savings.toLocaleString()}`);
            }}
          >
            Simulate 1000 Payments
          </button>
        </div>
      )}
    </div>
  );
}