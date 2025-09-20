'use client';

import { useState } from 'react';
import styles from './GenerationDetailsTab.module.css';

export default function GenerationDetailsTab({ progress, configResult }) {
  const [expandedSection, setExpandedSection] = useState('timeline');

  if (!progress) {
    return (
      <div className={styles.container}>
        <div className={styles.noData}>
          <span className={styles.noDataIcon}>📊</span>
          <p>No generation details available</p>
        </div>
      </div>
    );
  }

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className={styles.container}>
      {/* Processing Timeline */}
      <div className={styles.section}>
        <div
          className={styles.sectionHeader}
          onClick={() => toggleSection('timeline')}
        >
          <span className={styles.icon}>⏱️</span>
          <h3>Processing Timeline</h3>
          <span className={styles.toggle}>
            {expandedSection === 'timeline' ? '▼' : '▶'}
          </span>
        </div>
        {expandedSection === 'timeline' && (
          <div className={styles.sectionContent}>
            <div className={styles.timeline}>
              <div className={`${styles.timelineStep} ${styles.complete}`}>
                <div className={styles.stepIcon}>🔍</div>
                <div className={styles.stepContent}>
                  <h4>Message Parsing</h4>
                  <p>Extracted fields from source format</p>
                  <span className={styles.duration}>~0.5s</span>
                </div>
              </div>
              <div className={`${styles.timelineStep} ${styles.complete}`}>
                <div className={styles.stepIcon}>📝</div>
                <div className={styles.stepContent}>
                  <h4>Field Detection</h4>
                  <p>Identified {progress.fieldsDetected?.length || 0} fields</p>
                  <span className={styles.duration}>~1.0s</span>
                </div>
              </div>
              <div className={`${styles.timelineStep} ${styles.complete}`}>
                <div className={styles.stepIcon}>🔗</div>
                <div className={styles.stepContent}>
                  <h4>Pattern Matching</h4>
                  <p>Applied {progress.patterns?.length || 0} semantic patterns</p>
                  <span className={styles.duration}>~1.5s</span>
                </div>
              </div>
              <div className={`${styles.timelineStep} ${styles.complete}`}>
                <div className={styles.stepIcon}>🧠</div>
                <div className={styles.stepContent}>
                  <h4>AI Analysis</h4>
                  <p>Processed complex fields with AI</p>
                  <span className={styles.duration}>~2.0s</span>
                </div>
              </div>
              <div className={`${styles.timelineStep} ${styles.complete}`}>
                <div className={styles.stepIcon}>✅</div>
                <div className={styles.stepContent}>
                  <h4>Configuration Built</h4>
                  <p>Generated complete configuration</p>
                  <span className={styles.duration}>{progress.elapsedTime?.toFixed(1) || '4.5'}s total</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Field Detection Details */}
      <div className={styles.section}>
        <div
          className={styles.sectionHeader}
          onClick={() => toggleSection('fields')}
        >
          <span className={styles.icon}>📋</span>
          <h3>Fields Detected ({progress.fieldsDetected?.length || 0})</h3>
          <span className={styles.toggle}>
            {expandedSection === 'fields' ? '▼' : '▶'}
          </span>
        </div>
        {expandedSection === 'fields' && (
          <div className={styles.sectionContent}>
            <div className={styles.fieldList}>
              {progress.fieldsDetected?.map((field, idx) => (
                <div key={idx} className={styles.fieldItem}>
                  <div className={styles.fieldCode}>{field.code}</div>
                  <div className={styles.fieldDetails}>
                    <div className={styles.fieldName}>{field.name}</div>
                    <div className={styles.fieldMeta}>
                      <span className={`${styles.laneBadge} ${styles[field.lane?.toLowerCase()]}`}>
                        {field.lane}
                      </span>
                      <span className={styles.fieldType}>{field.type}</span>
                      {field.confidence && (
                        <span className={styles.confidence}>
                          {Math.round(field.confidence)}% confidence
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pattern Matching Details */}
      <div className={styles.section}>
        <div
          className={styles.sectionHeader}
          onClick={() => toggleSection('patterns')}
        >
          <span className={styles.icon}>🔗</span>
          <h3>Pattern Matches ({progress.patterns?.length || 0})</h3>
          <span className={styles.toggle}>
            {expandedSection === 'patterns' ? '▼' : '▶'}
          </span>
        </div>
        {expandedSection === 'patterns' && (
          <div className={styles.sectionContent}>
            <div className={styles.patternList}>
              {progress.patterns?.map((pattern, idx) => (
                <div key={idx} className={styles.patternItem}>
                  <div className={styles.patternHeader}>
                    <span className={styles.sourceField}>{pattern.sourceField}</span>
                    <span className={styles.arrow}>→</span>
                    <span className={styles.targetField}>{pattern.targetField}</span>
                  </div>
                  <div className={styles.patternDetails}>
                    <span className={`${styles.patternType} ${styles[pattern.type?.replace('_', '')]}`}>
                      {pattern.type}
                    </span>
                    <span className={styles.patternName}>{pattern.patternName}</span>
                    <span className={styles.confidence}>
                      {pattern.confidence}% match
                    </span>
                  </div>
                  {pattern.reason && (
                    <div className={styles.patternReason}>{pattern.reason}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Confidence Breakdown */}
      <div className={styles.section}>
        <div
          className={styles.sectionHeader}
          onClick={() => toggleSection('confidence')}
        >
          <span className={styles.icon}>📊</span>
          <h3>Confidence Analysis</h3>
          <span className={styles.toggle}>
            {expandedSection === 'confidence' ? '▼' : '▶'}
          </span>
        </div>
        {expandedSection === 'confidence' && (
          <div className={styles.sectionContent}>
            <div className={styles.confidenceGrid}>
              <div className={styles.confidenceItem}>
                <div className={styles.confidenceLabel}>Field Detection</div>
                <div className={styles.confidenceBar}>
                  <div
                    className={styles.confidenceFill}
                    style={{ width: `${progress.confidence?.fieldDetection || 0}%` }}
                  />
                </div>
                <div className={styles.confidenceValue}>
                  {progress.confidence?.fieldDetection || 0}%
                </div>
              </div>
              <div className={styles.confidenceItem}>
                <div className={styles.confidenceLabel}>Pattern Matching</div>
                <div className={styles.confidenceBar}>
                  <div
                    className={styles.confidenceFill}
                    style={{ width: `${progress.confidence?.patternMatching || 0}%` }}
                  />
                </div>
                <div className={styles.confidenceValue}>
                  {progress.confidence?.patternMatching || 0}%
                </div>
              </div>
              <div className={styles.confidenceItem}>
                <div className={styles.confidenceLabel}>AI Analysis</div>
                <div className={styles.confidenceBar}>
                  <div
                    className={styles.confidenceFill}
                    style={{ width: `${progress.confidence?.aiAnalysis || 0}%` }}
                  />
                </div>
                <div className={styles.confidenceValue}>
                  {progress.confidence?.aiAnalysis || 0}%
                </div>
              </div>
              <div className={`${styles.confidenceItem} ${styles.overall}`}>
                <div className={styles.confidenceLabel}>Overall Confidence</div>
                <div className={styles.confidenceBar}>
                  <div
                    className={styles.confidenceFill}
                    style={{ width: `${progress.confidence?.overall || 0}%` }}
                  />
                </div>
                <div className={styles.confidenceValue}>
                  {progress.confidence?.overall || 0}%
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MongoDB Operations */}
      <div className={styles.section}>
        <div
          className={styles.sectionHeader}
          onClick={() => toggleSection('mongodb')}
        >
          <span className={styles.icon}>🗄️</span>
          <h3>Database Operations ({progress.mongoOperations?.length || 0})</h3>
          <span className={styles.toggle}>
            {expandedSection === 'mongodb' ? '▼' : '▶'}
          </span>
        </div>
        {expandedSection === 'mongodb' && (
          <div className={styles.sectionContent}>
            <div className={styles.mongoList}>
              {progress.mongoOperations?.map((op, idx) => (
                <div key={idx} className={styles.mongoItem}>
                  <span className={styles.mongoIcon}>{op.icon}</span>
                  <div className={styles.mongoContent}>
                    <div className={styles.mongoMessage}>{op.message}</div>
                    <div className={styles.mongoTime}>
                      {new Date(op.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}