'use client';

import { useState, useEffect } from 'react';
import styles from './ConversionProgress.module.css';

export default function ConversionProgress({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [laneProgress, setLaneProgress] = useState({
    rules: { status: 'pending', fields: [], progress: 0 },
    ai: { status: 'pending', fields: [], progress: 0 },
    human: { status: 'pending', fields: [], progress: 0 },
    build: { status: 'pending', progress: 0 }
  });

  const steps = [
    {
      name: 'Parsing Source',
      description: 'Extracting fields from source message',
      duration: 500
    },
    {
      name: 'Rules Lane',
      description: 'Processing deterministic field mappings',
      lane: 'rules',
      duration: 1200,
      fields: [
        { name: 'Transaction Reference', time: 200 },
        { name: 'Value Date', time: 300 },
        { name: 'Currency', time: 200 },
        { name: 'Amount', time: 300 },
        { name: 'Debtor Account', time: 200 }
      ]
    },
    {
      name: 'AI Lane',
      description: 'AI extraction of complex fields',
      lane: 'ai',
      duration: 2000,
      fields: [
        { name: 'Remittance Info (Field 70)', time: 1000, details: 'Extracting invoice details, payment purpose' },
        { name: 'Instructions (Field 72)', time: 1000, details: 'Processing sender-to-receiver info' }
      ]
    },
    {
      name: 'Human Lane',
      description: 'Reviewing low-confidence fields',
      lane: 'human',
      duration: 800,
      status: 'auto_approved',
      message: 'All fields above confidence threshold (>0.8)'
    },
    {
      name: 'Building Output',
      description: 'Constructing target format message',
      lane: 'build',
      duration: 600
    }
  ];

  useEffect(() => {
    runConversionFlow();
  }, []);

  const runConversionFlow = async () => {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      setCurrentStep(i);

      if (step.lane && step.fields) {
        // Process fields in the lane
        await processLaneFields(step.lane, step.fields);
      } else if (step.lane === 'human' && step.status === 'auto_approved') {
        // Auto-approve human lane
        setLaneProgress(prev => ({
          ...prev,
          [step.lane]: { status: 'completed', progress: 100 }
        }));
        await sleep(step.duration);
      } else if (step.lane === 'build') {
        // Building phase
        await processBuildPhase(step.duration);
      } else {
        // General step
        await sleep(step.duration);
      }
    }

    // Mark completion
    setTimeout(() => {
      if (onComplete) onComplete();
    }, 500);
  };

  const processLaneFields = async (lane, fields) => {
    setLaneProgress(prev => ({
      ...prev,
      [lane]: { status: 'processing', fields: [], progress: 0 }
    }));

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];

      // Add field to processing
      setLaneProgress(prev => ({
        ...prev,
        [lane]: {
          status: 'processing',
          fields: [...prev[lane].fields, { ...field, status: 'processing' }],
          progress: ((i) / fields.length) * 100
        }
      }));

      await sleep(field.time);

      // Mark field as completed
      setLaneProgress(prev => ({
        ...prev,
        [lane]: {
          status: 'processing',
          fields: prev[lane].fields.map((f, idx) =>
            idx === i ? { ...f, status: 'completed' } : f
          ),
          progress: ((i + 1) / fields.length) * 100
        }
      }));
    }

    // Mark lane as completed
    setLaneProgress(prev => ({
      ...prev,
      [lane]: { ...prev[lane], status: 'completed', progress: 100 }
    }));
  };

  const processBuildPhase = async (duration) => {
    setLaneProgress(prev => ({
      ...prev,
      build: { status: 'processing', progress: 0 }
    }));

    const steps = 10;
    for (let i = 0; i < steps; i++) {
      await sleep(duration / steps);
      setLaneProgress(prev => ({
        ...prev,
        build: {
          status: 'processing',
          progress: ((i + 1) / steps) * 100
        }
      }));
    }

    setLaneProgress(prev => ({
      ...prev,
      build: { status: 'completed', progress: 100 }
    }));
  };

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const getLaneIcon = (lane) => {
    switch (lane) {
      case 'rules':
        return '⚙️';
      case 'ai':
        return '🤖';
      case 'human':
        return '👤';
      case 'build':
        return '🏗️';
      default:
        return '●';
    }
  };

  const getLaneColor = (lane) => {
    switch (lane) {
      case 'rules':
        return '#7C3AED'; // Purple
      case 'ai':
        return '#1D4ED8'; // Blue
      case 'human':
        return '#059669'; // Green
      case 'build':
        return '#D97706'; // Orange
      default:
        return '#6B7280';
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Conversion In Progress</h3>
        <p className={styles.subtitle}>3-Lane Processing Architecture</p>
      </div>

      <div className={styles.flowDiagram}>
        {steps.map((step, idx) => {
          const isActive = idx === currentStep;
          const isCompleted = idx < currentStep;
          const lane = step.lane;
          const laneData = lane ? laneProgress[lane] : null;

          return (
            <div key={idx} className={styles.stepContainer}>
              <div
                className={`${styles.step} ${isActive ? styles.active : ''} ${isCompleted ? styles.completed : ''}`}
                style={lane ? { borderColor: getLaneColor(lane) } : {}}
              >
                <div className={styles.stepHeader}>
                  <div className={styles.stepIcon}>
                    {lane ? getLaneIcon(lane) : '●'}
                  </div>
                  <div className={styles.stepInfo}>
                    <h4>{step.name}</h4>
                    <p>{step.description}</p>
                  </div>
                  <div className={styles.stepStatus}>
                    {isCompleted && <span className={styles.checkmark}>✓</span>}
                    {isActive && <div className={styles.spinner} />}
                  </div>
                </div>

                {/* Lane-specific content */}
                {isActive && lane && laneData && (
                  <div className={styles.laneContent}>
                    {/* Rules Lane */}
                    {lane === 'rules' && laneData.fields.length > 0 && (
                      <div className={styles.fieldsList}>
                        {laneData.fields.map((field, fieldIdx) => (
                          <div
                            key={fieldIdx}
                            className={`${styles.fieldItem} ${field.status === 'completed' ? styles.fieldCompleted : ''}`}
                          >
                            <span className={styles.fieldDot}>•</span>
                            <span className={styles.fieldName}>{field.name}</span>
                            {field.status === 'completed' && (
                              <span className={styles.fieldCheck}>✓</span>
                            )}
                            {field.status === 'processing' && (
                              <div className={styles.fieldSpinner} />
                            )}
                          </div>
                        ))}
                        <div className={styles.progressBar}>
                          <div
                            className={styles.progressFill}
                            style={{
                              width: `${laneData.progress}%`,
                              backgroundColor: getLaneColor(lane)
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* AI Lane */}
                    {lane === 'ai' && laneData.fields.length > 0 && (
                      <div className={styles.fieldsList}>
                        {laneData.fields.map((field, fieldIdx) => (
                          <div
                            key={fieldIdx}
                            className={`${styles.aiFieldItem} ${field.status === 'completed' ? styles.fieldCompleted : ''}`}
                          >
                            <div className={styles.aiFieldHeader}>
                              <span className={styles.aiFieldName}>{field.name}</span>
                              {field.status === 'completed' && (
                                <span className={styles.fieldCheck}>✓</span>
                              )}
                              {field.status === 'processing' && (
                                <div className={styles.fieldSpinner} />
                              )}
                            </div>
                            {field.details && (
                              <p className={styles.aiFieldDetails}>{field.details}</p>
                            )}
                            {field.status === 'processing' && (
                              <div className={styles.aiThinking}>
                                <span>🧠</span>
                                <span>AI analyzing...</span>
                              </div>
                            )}
                          </div>
                        ))}
                        <div className={styles.progressBar}>
                          <div
                            className={styles.progressFill}
                            style={{
                              width: `${laneData.progress}%`,
                              backgroundColor: getLaneColor(lane)
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Human Lane */}
                    {lane === 'human' && step.status === 'auto_approved' && (
                      <div className={styles.humanApproved}>
                        <span className={styles.approvedIcon}>✓</span>
                        <p>{step.message}</p>
                      </div>
                    )}

                    {/* Build Phase */}
                    {lane === 'build' && laneData.progress > 0 && (
                      <div className={styles.buildProgress}>
                        <div className={styles.buildSteps}>
                          <div className={styles.buildStep}>Mapping fields to target schema</div>
                          <div className={styles.buildStep}>Generating XML structure</div>
                          <div className={styles.buildStep}>Validating output format</div>
                        </div>
                        <div className={styles.progressBar}>
                          <div
                            className={styles.progressFill}
                            style={{
                              width: `${laneData.progress}%`,
                              backgroundColor: getLaneColor(lane)
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Arrow connector */}
              {idx < steps.length - 1 && (
                <div className={styles.arrow}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 5v14m0 0l-4-4m4 4l4-4"
                      stroke={isCompleted ? '#10b981' : '#D1D5DB'}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className={styles.summary}>
        <div className={styles.stat}>
          <div className={styles.statIcon} style={{ background: '#F3E8FF', color: '#7C3AED' }}>
            ⚙️
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>5 fields</span>
            <span className={styles.statLabel}>Rules Lane</span>
          </div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statIcon} style={{ background: '#EBF4FF', color: '#1D4ED8' }}>
            🤖
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>2 fields</span>
            <span className={styles.statLabel}>AI Lane</span>
          </div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statIcon} style={{ background: '#ECFDF5', color: '#059669' }}>
            👤
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>0 fields</span>
            <span className={styles.statLabel}>Human Review</span>
          </div>
        </div>
      </div>
    </div>
  );
}
