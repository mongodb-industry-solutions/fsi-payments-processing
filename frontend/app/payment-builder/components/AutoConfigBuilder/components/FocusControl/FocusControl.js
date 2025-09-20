'use client';

import styles from './FocusControl.module.css';

export default function FocusControl({
  currentMode = 'full',
  onModeChange
}) {
  const modes = [
    {
      id: 'full',
      label: 'Full View',
      icon: '⊞',
      tooltip: 'Show all panels equally',
      panels: [true, true, true]
    },
    {
      id: 'inputFocus',
      label: 'Input Focus',
      icon: '◧',
      tooltip: 'Focus on configuration input',
      panels: [true, false, false]
    },
    {
      id: 'journeyFocus',
      label: 'Journey Focus',
      icon: '▭',
      tooltip: 'Focus on configuration journey',
      panels: [false, true, false]
    },
    {
      id: 'mongoFocus',
      label: 'MongoDB Focus',
      icon: '◨',
      tooltip: 'Focus on database operations',
      panels: [false, false, true]
    },
    {
      id: 'compact',
      label: 'Compact',
      icon: '▣',
      tooltip: 'Minimize all panels',
      panels: [true, true, true]
    }
  ];

  const currentModeData = modes.find(m => m.id === currentMode) || modes[0];

  return (
    <div className={styles.container}>
      <div className={styles.focusControl}>
        <span className={styles.focusLabel}>Focus</span>

        <div className={styles.focusOptions}>
          {modes.map((mode) => (
            <button
              key={mode.id}
              className={`${styles.focusButton} ${currentMode === mode.id ? styles.active : ''}`}
              onClick={() => onModeChange(mode.id)}
              title={mode.tooltip}
            >
              <span className={styles.focusIcon}>{mode.icon}</span>
              <span>{mode.label}</span>
            </button>
          ))}
        </div>

        <div className={styles.focusIndicator}>
          {currentModeData.panels.map((active, idx) => (
            <div
              key={idx}
              className={`${styles.panelIndicator} ${active ? styles.active : ''} ${
                currentMode === 'inputFocus' && idx === 0 ? styles.expanded :
                currentMode === 'journeyFocus' && idx === 1 ? styles.expanded :
                currentMode === 'mongoFocus' && idx === 2 ? styles.expanded : ''
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}