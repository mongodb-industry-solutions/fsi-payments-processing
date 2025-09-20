'use client';

import { useState, useEffect } from 'react';
import styles from './LearningFeedback.module.css';

export default function LearningFeedback({
  corrections,
  originalConfig,
  onClose
}) {
  const [learningImpact, setLearningImpact] = useState([]);
  const [futureImprovements, setFutureImprovements] = useState([]);
  const [animationPhase, setAnimationPhase] = useState(0);

  useEffect(() => {
    // Simulate learning impact calculation
    if (corrections && Object.keys(corrections).length > 0) {
      calculateLearningImpact();
      simulateFutureImprovements();
    }

    // Animate through phases
    const timer = setInterval(() => {
      setAnimationPhase(prev => (prev < 3 ? prev + 1 : prev));
    }, 1000);

    return () => clearInterval(timer);
  }, [corrections]);

  const calculateLearningImpact = () => {
    const impacts = [];

    Object.entries(corrections || {}).forEach(([fieldCode, mapping]) => {
      // Determine what was learned
      const sourceFormat = originalConfig?.metadata?.source_format || 'MT192';
      const targetFormat = originalConfig?.metadata?.target_format || 'pacs.008';

      impacts.push({
        type: 'pattern',
        field: fieldCode,
        learned: `${fieldCode} → ${mapping.target || mapping}`,
        confidence: 95,
        applicability: [`${sourceFormat}`, 'Similar formats'],
        icon: '🧠'
      });

      // If transform was corrected
      if (mapping.transform) {
        impacts.push({
          type: 'transform',
          field: fieldCode,
          learned: `Apply ${mapping.transform} transform`,
          confidence: 90,
          applicability: ['Date/Amount fields'],
          icon: '🔄'
        });
      }
    });

    setLearningImpact(impacts);
  };

  const simulateFutureImprovements = () => {
    const improvements = [
      {
        format: 'MT192',
        field: '79',
        before: 60,
        after: 85,
        description: 'Better recognition of cancellation details'
      },
      {
        format: 'MT205',
        field: '32A',
        before: 75,
        after: 92,
        description: 'Improved date/amount parsing'
      },
      {
        format: 'MT202COV',
        field: '50K',
        before: 70,
        after: 88,
        description: 'Enhanced party identification'
      }
    ];

    setFutureImprovements(improvements);
  };

  const renderLearningPath = () => {
    return (
      <div className={styles.learningPath}>
        <div className={`${styles.pathNode} ${animationPhase >= 0 ? styles.active : ''}`}>
          <div className={styles.nodeIcon}>📥</div>
          <div className={styles.nodeLabel}>User Correction</div>
        </div>

        <div className={`${styles.pathLine} ${animationPhase >= 1 ? styles.active : ''}`} />

        <div className={`${styles.pathNode} ${animationPhase >= 1 ? styles.active : ''}`}>
          <div className={styles.nodeIcon}>🔍</div>
          <div className={styles.nodeLabel}>Pattern Analysis</div>
        </div>

        <div className={`${styles.pathLine} ${animationPhase >= 2 ? styles.active : ''}`} />

        <div className={`${styles.pathNode} ${animationPhase >= 2 ? styles.active : ''}`}>
          <div className={styles.nodeIcon}>🧠</div>
          <div className={styles.nodeLabel}>Model Update</div>
        </div>

        <div className={`${styles.pathLine} ${animationPhase >= 3 ? styles.active : ''}`} />

        <div className={`${styles.pathNode} ${animationPhase >= 3 ? styles.active : ''}`}>
          <div className={styles.nodeIcon}>🚀</div>
          <div className={styles.nodeLabel}>Future Improvement</div>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Learning Feedback</h3>
        <button className={styles.closeButton} onClick={onClose}>✕</button>
      </div>

      <div className={styles.content}>
        {/* Learning Path Animation */}
        <div className={styles.pathSection}>
          <h4>How Your Corrections Help</h4>
          {renderLearningPath()}
        </div>

        {/* What Was Learned */}
        <div className={styles.learnedSection}>
          <h4>Patterns Learned</h4>
          <div className={styles.learnedList}>
            {learningImpact.map((impact, index) => (
              <div
                key={index}
                className={`${styles.learnedItem} ${styles[impact.type]}`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className={styles.learnedIcon}>{impact.icon}</div>
                <div className={styles.learnedContent}>
                  <div className={styles.learnedMain}>
                    <span className={styles.fieldTag}>{impact.field}</span>
                    <span className={styles.learnedText}>{impact.learned}</span>
                  </div>
                  <div className={styles.learnedMeta}>
                    <span className={styles.confidence}>
                      {impact.confidence}% confidence
                    </span>
                    <span className={styles.applicability}>
                      Applies to: {impact.applicability.join(', ')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Future Impact */}
        <div className={styles.impactSection}>
          <h4>Expected Future Improvements</h4>
          <div className={styles.impactGrid}>
            {futureImprovements.map((improvement, index) => (
              <div key={index} className={styles.impactCard}>
                <div className={styles.impactHeader}>
                  <span className={styles.formatBadge}>{improvement.format}</span>
                  <span className={styles.fieldBadge}>{improvement.field}</span>
                </div>
                <div className={styles.impactChart}>
                  <div className={styles.chartBar}>
                    <div className={styles.beforeBar} style={{ width: `${improvement.before}%` }}>
                      <span className={styles.barLabel}>{improvement.before}%</span>
                    </div>
                  </div>
                  <div className={styles.chartBar}>
                    <div className={styles.afterBar} style={{ width: `${improvement.after}%` }}>
                      <span className={styles.barLabel}>{improvement.after}%</span>
                    </div>
                  </div>
                </div>
                <div className={styles.impactDescription}>
                  {improvement.description}
                </div>
                <div className={styles.impactDelta}>
                  <span className={styles.deltaIcon}>📈</span>
                  +{improvement.after - improvement.before}% improvement
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Statistics */}
        <div className={styles.statistics}>
          <div className={styles.statItem}>
            <div className={styles.statValue}>
              {Object.keys(corrections || {}).length}
            </div>
            <div className={styles.statLabel}>Corrections Applied</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>
              {learningImpact.length}
            </div>
            <div className={styles.statLabel}>Patterns Learned</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>
              +{Math.round(futureImprovements.reduce((acc, imp) =>
                acc + (imp.after - imp.before), 0) / futureImprovements.length)}%
            </div>
            <div className={styles.statLabel}>Avg Improvement</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>∞</div>
            <div className={styles.statLabel}>Future Configs</div>
          </div>
        </div>

        {/* Thank You Message */}
        <div className={styles.thankYou}>
          <div className={styles.thankYouIcon}>🙏</div>
          <div className={styles.thankYouContent}>
            <h5>Thank You for Teaching the System!</h5>
            <p>
              Your corrections directly improve the AI's ability to configure similar formats.
              Every correction makes the system smarter for all users.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}