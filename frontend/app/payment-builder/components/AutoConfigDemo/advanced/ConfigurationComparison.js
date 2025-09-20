'use client';

import { useState, useEffect } from 'react';
import styles from './ConfigurationComparison.module.css';

export default function ConfigurationComparison({
  original,
  modified,
  corrections,
  onAccept,
  onReject
}) {
  const [viewMode, setViewMode] = useState('side-by-side'); // side-by-side, unified, original, modified
  const [showOnlyChanges, setShowOnlyChanges] = useState(false);
  const [changes, setChanges] = useState([]);

  useEffect(() => {
    // Calculate changes between original and modified
    if (original && modified) {
      const calculatedChanges = calculateChanges(original, modified, corrections);
      setChanges(calculatedChanges);
    }
  }, [original, modified, corrections]);

  const calculateChanges = (orig, mod, corr) => {
    const changeList = [];

    // Check mappings changes
    if (corr && Object.keys(corr).length > 0) {
      Object.entries(corr).forEach(([fieldCode, newMapping]) => {
        const originalMapping = orig.mappings?.find(m => m.source === fieldCode);

        changeList.push({
          type: 'mapping',
          fieldCode,
          original: originalMapping?.targets?.[0] || originalMapping?.target || 'Not mapped',
          modified: newMapping.target || newMapping,
          confidence: originalMapping?.confidence || 0,
          reason: 'User correction'
        });
      });
    }

    // Check for AI confidence changes
    const origUncertain = orig.uncertain_fields || [];
    const modUncertain = mod.uncertain_fields || [];

    origUncertain.forEach(field => {
      const modField = modUncertain.find(f => f.field === field.field);
      if (modField && modField.confidence !== field.confidence) {
        changeList.push({
          type: 'confidence',
          fieldCode: field.field,
          original: field.confidence,
          modified: modField.confidence,
          reason: 'Confidence updated'
        });
      }
    });

    return changeList;
  };

  const renderChange = (change) => {
    return (
      <div key={change.fieldCode} className={styles.changeItem}>
        <div className={styles.changeHeader}>
          <span className={styles.fieldCode}>{change.fieldCode}</span>
          <span className={`${styles.changeType} ${styles[change.type]}`}>
            {change.type === 'mapping' ? '🔗 Mapping' : '📊 Confidence'}
          </span>
        </div>

        <div className={styles.changeContent}>
          <div className={styles.originalValue}>
            <label>Original:</label>
            <code>{change.original}</code>
          </div>
          <div className={styles.arrow}>→</div>
          <div className={styles.modifiedValue}>
            <label>Modified:</label>
            <code>{change.modified}</code>
          </div>
        </div>

        {change.reason && (
          <div className={styles.changeReason}>
            <span className={styles.reasonIcon}>ℹ️</span>
            {change.reason}
          </div>
        )}
      </div>
    );
  };

  const renderSideBySide = () => {
    return (
      <div className={styles.sideBySide}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h4>Original Configuration</h4>
            <span className={styles.badge}>Auto-generated</span>
          </div>
          <div className={styles.panelContent}>
            <div className={styles.stats}>
              <div className={styles.stat}>
                <label>Confidence:</label>
                <span>{(original?.confidence * 100).toFixed(0)}%</span>
              </div>
              <div className={styles.stat}>
                <label>Fields:</label>
                <span>{original?.fields_detected || 0}</span>
              </div>
              <div className={styles.stat}>
                <label>Mapped:</label>
                <span>{original?.fields_mapped || 0}</span>
              </div>
            </div>

            <div className={styles.mappings}>
              <h5>Field Mappings</h5>
              {original?.mappings?.slice(0, 5).map(mapping => (
                <div key={mapping.source} className={styles.mapping}>
                  <span className={styles.source}>{mapping.source}</span>
                  <span className={styles.separator}>→</span>
                  <span className={styles.target}>
                    {mapping.targets?.[0] || mapping.target || 'Not mapped'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.changeIndicator}>
          <div className={styles.changeArrow}>
            <svg width="40" height="40" viewBox="0 0 40 40">
              <path
                d="M10 20 L25 20 M25 20 L20 15 M25 20 L20 25"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
              />
            </svg>
          </div>
          <div className={styles.changeCount}>
            {changes.length} changes
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h4>Modified Configuration</h4>
            <span className={`${styles.badge} ${styles.modified}`}>With corrections</span>
          </div>
          <div className={styles.panelContent}>
            <div className={styles.stats}>
              <div className={styles.stat}>
                <label>Confidence:</label>
                <span className={styles.improved}>
                  {((modified?.confidence || original?.confidence) * 100).toFixed(0)}%
                </span>
              </div>
              <div className={styles.stat}>
                <label>Fields:</label>
                <span>{modified?.fields_detected || original?.fields_detected || 0}</span>
              </div>
              <div className={styles.stat}>
                <label>Mapped:</label>
                <span className={styles.improved}>
                  {(original?.fields_mapped || 0) + changes.filter(c => c.type === 'mapping').length}
                </span>
              </div>
            </div>

            <div className={styles.mappings}>
              <h5>Updated Mappings</h5>
              {changes.filter(c => c.type === 'mapping').map(change => (
                <div key={change.fieldCode} className={`${styles.mapping} ${styles.changed}`}>
                  <span className={styles.source}>{change.fieldCode}</span>
                  <span className={styles.separator}>→</span>
                  <span className={styles.target}>{change.modified}</span>
                  <span className={styles.changeTag}>Updated</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderUnified = () => {
    return (
      <div className={styles.unified}>
        <div className={styles.unifiedHeader}>
          <h4>Configuration Changes</h4>
          <div className={styles.viewOptions}>
            <label>
              <input
                type="checkbox"
                checked={showOnlyChanges}
                onChange={(e) => setShowOnlyChanges(e.target.checked)}
              />
              Show only changes
            </label>
          </div>
        </div>

        <div className={styles.changesList}>
          {changes.length > 0 ? (
            changes.map(renderChange)
          ) : (
            <div className={styles.noChanges}>
              <span className={styles.noChangesIcon}>✅</span>
              <p>No changes made - configuration is ready as generated</p>
            </div>
          )}
        </div>

        {!showOnlyChanges && original?.mappings && (
          <div className={styles.unchangedSection}>
            <h5>Unchanged Mappings</h5>
            <div className={styles.unchangedList}>
              {original.mappings
                .filter(m => !changes.find(c => c.fieldCode === m.source))
                .map(mapping => (
                  <div key={mapping.source} className={styles.unchangedMapping}>
                    <span className={styles.source}>{mapping.source}</span>
                    <span className={styles.separator}>→</span>
                    <span className={styles.target}>
                      {mapping.targets?.[0] || mapping.target}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Configuration Comparison</h3>
        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewButton} ${viewMode === 'side-by-side' ? styles.active : ''}`}
            onClick={() => setViewMode('side-by-side')}
          >
            <span className={styles.viewIcon}>⬌</span>
            Side by Side
          </button>
          <button
            className={`${styles.viewButton} ${viewMode === 'unified' ? styles.active : ''}`}
            onClick={() => setViewMode('unified')}
          >
            <span className={styles.viewIcon}>≡</span>
            Unified
          </button>
        </div>
      </div>

      <div className={styles.content}>
        {viewMode === 'side-by-side' && renderSideBySide()}
        {viewMode === 'unified' && renderUnified()}
      </div>

      {changes.length > 0 && (
        <div className={styles.summary}>
          <div className={styles.summaryIcon}>📊</div>
          <div className={styles.summaryContent}>
            <strong>Impact Summary:</strong> {changes.length} correction(s) applied.
            {changes.filter(c => c.type === 'mapping').length > 0 && (
              <span> {changes.filter(c => c.type === 'mapping').length} field mappings updated.</span>
            )}
            {changes.filter(c => c.type === 'confidence').length > 0 && (
              <span> {changes.filter(c => c.type === 'confidence').length} confidence scores adjusted.</span>
            )}
          </div>
        </div>
      )}

      <div className={styles.actions}>
        <button className={styles.rejectButton} onClick={onReject}>
          Discard Changes
        </button>
        <button className={styles.acceptButton} onClick={onAccept}>
          Accept Changes ({changes.length})
        </button>
      </div>
    </div>
  );
}