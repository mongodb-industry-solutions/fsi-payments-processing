'use client';

import { useState, useEffect } from 'react';
import Icon from '@leafygreen-ui/icon';
import Badge from '@leafygreen-ui/badge';
import styles from './RegistryViewer.module.css';

export default function RegistryViewer({ isOpen, onClose }) {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [viewMode, setViewMode] = useState('structured'); // 'structured' or 'raw'

  useEffect(() => {
    if (isOpen) {
      fetchConfigs();
    }
  }, [isOpen]);

  const fetchConfigs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:8001/api/v1/converter/formats');
      if (!response.ok) throw new Error('Failed to fetch configs');
      const data = await response.json();
      // API returns conversion_pairs array, map to expected format
      const configList = (data.conversion_pairs || []).map(pair => ({
        conversion_id: pair.id,
        source_format: pair.source,
        target_format: pair.target,
        description: pair.description || `Convert ${pair.source} to ${pair.target}`
      }));
      setConfigs(configList);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const viewConfigDetails = async (conversionId) => {
    try {
      const response = await fetch(`http://localhost:8001/api/v1/converter/config/${conversionId}`);
      if (!response.ok) throw new Error('Failed to fetch config details');
      const data = await response.json();
      setSelectedConfig(data);
    } catch (err) {
      setError(err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <h2>Conversion Registry</h2>
            <p>Available configurations in MongoDB</p>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            <Icon glyph="X" />
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {loading && (
            <div className={styles.loading}>
              <div className={styles.spinner} />
              <p>Loading configurations...</p>
            </div>
          )}

          {error && (
            <div className={styles.error}>
              <Icon glyph="Warning" />
              <p>{error}</p>
              <button onClick={fetchConfigs} className={styles.retryButton}>
                Retry
              </button>
            </div>
          )}

          {!loading && !error && !selectedConfig && (
            <div className={styles.configList}>
              <div className={styles.listHeader}>
                <span className={styles.count}>{configs.length} configurations</span>
                <button onClick={fetchConfigs} className={styles.refreshButton}>
                  <Icon glyph="Refresh" />
                  Refresh
                </button>
              </div>

              {configs.map((config) => (
                <div key={config.conversion_id} className={styles.configCard}>
                  <div className={styles.configHeader}>
                    <div className={styles.formatFlow}>
                      <span className={styles.sourceFormat}>{config.source_format}</span>
                      <Icon glyph="ArrowRight" />
                      <span className={styles.targetFormat}>{config.target_format}</span>
                    </div>
                    <button
                      onClick={() => viewConfigDetails(config.conversion_id)}
                      className={styles.viewButton}
                    >
                      View Details
                    </button>
                  </div>
                  <div className={styles.configMeta}>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Config ID:</span>
                      <code className={styles.metaValue}>{config.conversion_id}</code>
                    </div>
                    {config.description && (
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Description:</span>
                        <span className={styles.metaValue}>{config.description}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {configs.length === 0 && (
                <div className={styles.emptyState}>
                  <Icon glyph="InfoWithCircle" size="large" />
                  <p>No configurations found</p>
                </div>
              )}
            </div>
          )}

          {selectedConfig && (
            <div className={styles.configDetails}>
              <button onClick={() => setSelectedConfig(null)} className={styles.backButton}>
                <Icon glyph="ChevronLeft" />
                Back to list
              </button>

              <div className={styles.detailsHeader}>
                <div>
                  <h3>{selectedConfig._id || selectedConfig.conversion_id}</h3>
                  <div className={styles.badges}>
                    <Badge variant="blue">{selectedConfig.source_format}</Badge>
                    <Icon glyph="ArrowRight" />
                    <Badge variant="green">{selectedConfig.target_format}</Badge>
                  </div>
                </div>
                <div className={styles.viewToggle}>
                  <button
                    className={`${styles.toggleBtn} ${viewMode === 'structured' ? styles.active : ''}`}
                    onClick={() => setViewMode('structured')}
                  >
                    <Icon glyph="Diagram3" />
                    Structured
                  </button>
                  <button
                    className={`${styles.toggleBtn} ${viewMode === 'raw' ? styles.active : ''}`}
                    onClick={() => setViewMode('raw')}
                  >
                    <Icon glyph="Code" />
                    Raw JSON
                  </button>
                </div>
              </div>

              {viewMode === 'raw' ? (
                <div className={styles.rawView}>
                  <div className={styles.jsonBlock}>
                    <pre>{JSON.stringify(selectedConfig, null, 2)}</pre>
                  </div>
                </div>
              ) : (
                <div className={styles.detailsSections}>
                {/* Parser Section */}
                <div className={styles.detailSection}>
                  <h4>
                    <Icon glyph="Edit" />
                    Parser Configuration
                  </h4>
                  <div className={styles.jsonBlock}>
                    <pre>{JSON.stringify(selectedConfig.parser, null, 2)}</pre>
                  </div>
                </div>

                {/* Mappings Section */}
                <div className={styles.detailSection}>
                  <h4>
                    <Icon glyph="Diagram3" />
                    Field Mappings ({selectedConfig.mappings?.length || 0})
                  </h4>
                  <div className={styles.mappingsList}>
                    {selectedConfig.mappings?.map((mapping, idx) => (
                      <div key={idx} className={styles.mappingItem}>
                        <div className={styles.mappingFlow}>
                          <code className={styles.sourceField}>{mapping.source}</code>
                          <Icon glyph="ArrowRight" size="small" />
                          <code className={styles.targetField}>
                            {Array.isArray(mapping.targets)
                              ? mapping.targets.join(', ')
                              : mapping.targets}
                          </code>
                        </div>
                        <div className={styles.mappingMeta}>
                          <Badge
                            variant={
                              mapping.processing_lane === 'RULES' ? 'purple' :
                              mapping.processing_lane === 'AI' ? 'blue' : 'green'
                            }
                          >
                            {mapping.processing_lane || 'RULES'}
                          </Badge>
                          {mapping.transform && (
                            <span className={styles.transform}>{mapping.transform}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Builder Section */}
                <div className={styles.detailSection}>
                  <h4>
                    <Icon glyph="Building" />
                    Builder Configuration
                  </h4>
                  <div className={styles.jsonBlock}>
                    <pre>{JSON.stringify(selectedConfig.builder, null, 2)}</pre>
                  </div>
                </div>
              </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
