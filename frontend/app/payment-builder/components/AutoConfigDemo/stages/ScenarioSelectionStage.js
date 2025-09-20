'use client';

import styles from './ScenarioSelectionStage.module.css';

const SCENARIOS = [
  {
    id: 'mt192_to_pacs008',
    name: 'MT192 → pacs.008',
    title: 'Request for Cancellation',
    description: 'Auto-configure MT192 cancellation request to pacs.008 payment format',
    icon: '🔄',
    confidence: '85%',
    time: '2-8s',
    difficulty: 'medium',
    features: ['Pattern Matching', 'Semantic Learning', 'AI Analysis']
  },
  {
    id: 'mt205_to_pacs009',
    name: 'MT205 → pacs.009',
    title: 'Financial Institution Transfer',
    description: 'Auto-configure MT205 financial transfer to pacs.009 format',
    icon: '💱',
    confidence: '88%',
    time: '2-8s',
    difficulty: 'medium',
    features: ['COV Handling', 'Complex Extraction', 'Smart Mapping']
  },
  {
    id: 'mt202cov_to_pacs009',
    name: 'MT202COV → pacs.009',
    title: 'Cover Payment',
    description: 'Auto-configure MT202COV cover payment to pacs.009 format',
    icon: '💳',
    confidence: '90%',
    time: '2-8s',
    difficulty: 'simple',
    features: ['Cover Payment', 'Underlying Transaction', 'Direct Mapping']
  },
  {
    id: 'custom',
    name: 'Custom Format',
    title: 'Configure Your Own',
    description: 'Add any payment format not listed above',
    icon: '⚙️',
    confidence: 'Variable',
    time: 'Depends',
    difficulty: 'complex',
    features: ['Custom Parser', 'Custom Mappings', 'Full Control'],
    isCustom: true
  }
];

export default function ScenarioSelectionStage({ onSelectScenario }) {
  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'simple':
        return styles.simple;
      case 'medium':
        return styles.medium;
      case 'complex':
        return styles.complex;
      default:
        return '';
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Select Configuration Scenario</h3>
        <p>Choose a pre-built scenario or configure a custom format</p>
      </div>

      <div className={styles.scenarioGrid}>
        {SCENARIOS.map(scenario => (
          <div
            key={scenario.id}
            className={`${styles.scenarioCard} ${scenario.isCustom ? styles.customCard : ''}`}
            onClick={() => onSelectScenario(scenario)}
          >
            <div className={styles.cardHeader}>
              <span className={styles.icon}>{scenario.icon}</span>
              <h4>{scenario.name}</h4>
            </div>

            <div className={styles.cardContent}>
              <h5>{scenario.title}</h5>
              <p>{scenario.description}</p>

              <div className={styles.stats}>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Confidence</span>
                  <span className={styles.statValue}>{scenario.confidence}</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Time</span>
                  <span className={styles.statValue}>{scenario.time}</span>
                </div>
              </div>

              <div className={styles.features}>
                {scenario.features.map((feature, idx) => (
                  <span key={idx} className={styles.feature}>{feature}</span>
                ))}
              </div>

              <div className={`${styles.difficulty} ${getDifficultyColor(scenario.difficulty)}`}>
                {scenario.difficulty}
              </div>
            </div>

            <button className={styles.selectButton}>
              {scenario.isCustom ? 'Configure' : 'Select Scenario'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}