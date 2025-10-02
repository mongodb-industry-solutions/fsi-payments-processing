'use client';

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import Icon from '@leafygreen-ui/icon';
import Button from '@leafygreen-ui/button';
import { palette } from '@leafygreen-ui/palette';
import { Body, H2, H3, Overline } from '@leafygreen-ui/typography';
import { getFormatInfo } from '../data/formatInfo';
import styles from './FormatInfoModal.module.css';

const FormatInfoModal = ({ isOpen, onClose, format, country, city }) => {
  const [activeTab, setActiveTab] = useState('about');
  const [mongoConfig, setMongoConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState('document'); // 'document' or 'schema' for MongoDB tab
  const [expandedSections, setExpandedSections] = useState({
    parser: true,
    transformer: true,
    builder: false,
    ai_config: false,
    metadata: false
  });
  const formatInfo = getFormatInfo(format);

  // Ensure we're mounted before using document (for SSR safety)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch MongoDB configuration when MongoDB tab is selected
  useEffect(() => {
    if (activeTab === 'mongodb' && format) {
      fetchMongoConfig();
    }
  }, [activeTab, format]);

  const fetchMongoConfig = async () => {
    setLoading(true);
    try {
      // Map format to conversion_id
      // Note: Some formats convert TO JSON (for outbound), others FROM JSON (for inbound)
      const conversionMap = {
        'MT103': 'MT103_to_pacs.008',
        'MT202': 'MT202_to_pacs.009',
        'CHAPS': 'JSON_to_CHAPS',
        'pacs.008': 'pacs.008_to_JSON',
        'TARGET2': 'JSON_to_TARGET2',
        'SPEI': 'SPEI_to_JSON',  // SPEI converts TO JSON in crypto scenario
        'USDC': 'JSON_to_USDC'
      };

      const conversionId = conversionMap[format];
      if (!conversionId) {
        setMongoConfig(null);
        setLoading(false);
        return;
      }

      const response = await fetch(`http://localhost:8001/api/v1/converter/config/${conversionId}`);
      if (response.ok) {
        const data = await response.json();
        setMongoConfig(data);
      } else {
        console.error('Failed to fetch config:', response.status);
        setMongoConfig(null);
      }
    } catch (error) {
      console.error('Error fetching MongoDB config:', error);
      setMongoConfig(null);
    } finally {
      setLoading(false);
    }
  };

  // Handle ESC key press
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const renderJsonValue = (value) => {
    if (value === null) return <span className={styles.jsonNull}>null</span>;
    if (typeof value === 'boolean') return <span className={styles.jsonBoolean}>{value.toString()}</span>;
    if (typeof value === 'number') return <span className={styles.jsonNumber}>{value}</span>;
    if (typeof value === 'string') {
      // Truncate very long strings in document view
      const displayStr = value.length > 100 ? value.substring(0, 100) + '...' : value;
      return <span className={styles.jsonString}>"{displayStr}"</span>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return <span className={styles.jsonBracket}>[]</span>;
      if (value.every(item => typeof item === 'string' || typeof item === 'number')) {
        return (
          <span>
            <span className={styles.jsonBracket}>[</span>
            {value.slice(0, 3).map((item, idx) => (
              <span key={idx}>
                {idx > 0 && ', '}
                {typeof item === 'string' ?
                  <span className={styles.jsonString}>"{item}"</span> :
                  <span className={styles.jsonNumber}>{item}</span>
                }
              </span>
            ))}
            {value.length > 3 && <span>, ...</span>}
            <span className={styles.jsonBracket}>]</span>
          </span>
        );
      }
    }

    return null;
  };

  const renderJsonSection = (key, value, level = 0) => {
    const isExpanded = level === 0 ? expandedSections[key] : true;
    const hasChildren = typeof value === 'object' && value !== null &&
                       (Array.isArray(value) ? value.length > 0 : Object.keys(value).length > 0);

    return (
      <div key={key} className={styles.jsonNode} style={{ marginLeft: `${level * 20}px` }}>
        <div className={styles.jsonLine}>
          {level === 0 && hasChildren && (
            <span
              className={styles.jsonToggle}
              onClick={() => toggleSection(key)}
            >
              {isExpanded ? '▼' : '▶'}
            </span>
          )}
          <span className={key === '_id' ? styles.mongoSystemField : styles.jsonKey}>
            "{key}"
          </span>
          <span className={styles.jsonColon}>: </span>
          {!hasChildren ? (
            renderJsonValue(value)
          ) : (
            <span className={styles.jsonBracket}>{Array.isArray(value) ? '[' : '{'}</span>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div className={styles.jsonChildren}>
            {Array.isArray(value) ?
              value.map((item, idx) => renderJsonSection(idx.toString(), item, level + 1)) :
              Object.entries(value).map(([childKey, childValue]) =>
                renderJsonSection(childKey, childValue, level + 1)
              )
            }
          </div>
        )}

        {hasChildren && isExpanded && (
          <div className={styles.jsonLine} style={{ marginLeft: `${level * 20}px` }}>
            <span className={styles.jsonBracket}>{Array.isArray(value) ? ']' : '}'}</span>
            {level === 0 && <span className={styles.jsonComma}>,</span>}
          </div>
        )}

        {hasChildren && !isExpanded && (
          <span className={styles.jsonCollapsed}> {'...'} </span>
        )}
      </div>
    );
  };

  if (!isOpen || !formatInfo || !mounted) return null;

  // Use React Portal to render modal outside of React Flow's DOM tree
  return ReactDOM.createPortal(
    <>
      {/* Backdrop */}
      <div className={styles.backdrop} onClick={onClose} />

      {/* Modal */}
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div className={styles.headerContent}>
            <h2>{country} {city && `- ${city}`}</h2>
            <p className={styles.formatName}>{formatInfo.name}</p>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className={styles.tabNav}>
          <button
            className={`${styles.tab} ${activeTab === 'about' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('about')}
          >
            <Icon glyph="InfoWithCircle" size="small" className={styles.tabIcon} />
            About
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'format' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('format')}
          >
            <Icon glyph="Code" size="small" className={styles.tabIcon} />
            Sample Format
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'mongodb' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('mongodb')}
          >
            <Icon glyph="Database" size="small" className={styles.tabIcon} />
            MongoDB Config
          </button>
        </div>

        {/* Tab Content */}
        <div className={styles.modalBody}>
          {activeTab === 'about' && (
            <div className={styles.aboutContent}>
              <div className={styles.section}>
                <h3>Description</h3>
                <p>{formatInfo.description}</p>
              </div>

              <div className={styles.section}>
                <h3>Common Usage</h3>
                <ul className={styles.usageList}>
                  {formatInfo.usage.map((use, idx) => (
                    <li key={idx}>
                      <span className={styles.bullet}>▸</span>
                      {use}
                    </li>
                  ))}
                </ul>
              </div>

              <div className={styles.infoBox}>
                <Icon glyph="Bulb" className={styles.infoIcon} />
                <p>
                  This format is configured in MongoDB's <strong>conversion_registry</strong> collection,
                  enabling zero-code conversion to any other format through the universal JSON bridge.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'format' && (
            <div className={styles.formatContent}>
              <div className={styles.section}>
                <h3>Message Structure</h3>
                <div className={styles.codeBlock}>
                  <pre>{formatInfo.structure}</pre>
                </div>
              </div>

              <div className={styles.note}>
                <Icon glyph="ImportantWithCircle" className={styles.noteIcon} />
                <span>
                  This is a simplified example. Actual messages may contain additional fields
                  and comply with specific network requirements.
                </span>
              </div>
            </div>
          )}

          {activeTab === 'mongodb' && (
            <div className={styles.mongoContent}>
              <div className={styles.section}>
                <h3>
                  <Icon glyph="Database" className={styles.sectionIcon} />
                  MongoDB conversion_registry Collection
                </h3>
                <p className={styles.pipelineDesc}>
                  Configuration document that enables {format} conversion
                </p>
              </div>

              {/* View Mode Toggle */}
              <div className={styles.viewToggle}>
                <button
                  className={`${styles.viewButton} ${viewMode === 'document' ? styles.activeView : ''}`}
                  onClick={() => setViewMode('document')}
                >
                  Document View
                </button>
                <button
                  className={`${styles.viewButton} ${viewMode === 'schema' ? styles.activeView : ''}`}
                  onClick={() => setViewMode('schema')}
                >
                  Schema View
                </button>
              </div>

              {loading ? (
                <div className={styles.loading}>Loading MongoDB configuration...</div>
              ) : mongoConfig ? (
                <>
                  {viewMode === 'document' ? (
                    <div className={styles.mongoDocument}>
                      <div className={styles.documentHeader}>
                        <span className={styles.collectionName}>conversion_registry</span>
                        <button
                          className={styles.expandAllBtn}
                          onClick={() => {
                            const allExpanded = Object.values(expandedSections).every(v => v);
                            const newState = {};
                            Object.keys(expandedSections).forEach(key => {
                              newState[key] = !allExpanded;
                            });
                            setExpandedSections(newState);
                          }}
                        >
                          {Object.values(expandedSections).every(v => v) ? 'Collapse All' : 'Expand All'}
                        </button>
                      </div>
                      <div className={styles.jsonDocument}>
                        <div className={styles.jsonBracket}>{'{'}</div>
                        {mongoConfig && Object.entries(mongoConfig).map(([key, value]) =>
                          renderJsonSection(key, value)
                        )}
                        <div className={styles.jsonBracket}>{'}'}</div>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.schemaView}>
                      <h4>Configuration Structure</h4>
                      <div className={styles.schemaGrid}>
                        <div className={styles.schemaSection}>
                          <Icon glyph="Code" className={styles.schemaIcon} />
                          <div>
                            <strong>parser</strong>
                            <span>Regex patterns to extract fields from source format</span>
                          </div>
                        </div>
                        <div className={styles.schemaSection}>
                          <Icon glyph="Refresh" className={styles.schemaIcon} />
                          <div>
                            <strong>transformer.mappings</strong>
                            <span>Field transformation rules with processing lanes</span>
                          </div>
                        </div>
                        <div className={styles.schemaSection}>
                          <Icon glyph="Building" className={styles.schemaIcon} />
                          <div>
                            <strong>builder</strong>
                            <span>Output template with placeholders for target format</span>
                          </div>
                        </div>
                        <div className={styles.schemaSection}>
                          <Icon glyph="Sparkle" className={styles.schemaIcon} />
                          <div>
                            <strong>ai_config</strong>
                            <span>AI prompts for complex field extraction</span>
                          </div>
                        </div>
                        <div className={styles.schemaSection}>
                          <Icon glyph="Menu" className={styles.schemaIcon} />
                          <div>
                            <strong>metadata</strong>
                            <span>Version, description, and compatibility info</span>
                          </div>
                        </div>
                      </div>

                      {/* Processing Stats */}
                      {mongoConfig.transformer?.mappings && (
                        <div className={styles.processingBreakdown}>
                          <h4>Field Processing Distribution</h4>
                          <div className={styles.laneStats}>
                            <div className={styles.laneStat}>
                              <div className={styles.laneBar} style={{
                                width: `${(mongoConfig.transformer.mappings.filter(m => !m.processing_lane || m.processing_lane === 'RULES').length / mongoConfig.transformer.mappings.length) * 100}%`,
                                background: '#10b981'
                              }}></div>
                              <span>Rules: {mongoConfig.transformer.mappings.filter(m => !m.processing_lane || m.processing_lane === 'RULES').length} fields</span>
                            </div>
                            <div className={styles.laneStat}>
                              <div className={styles.laneBar} style={{
                                width: `${(mongoConfig.transformer.mappings.filter(m => m.processing_lane === 'AI').length / mongoConfig.transformer.mappings.length) * 100}%`,
                                background: '#3b82f6'
                              }}></div>
                              <span>AI: {mongoConfig.transformer.mappings.filter(m => m.processing_lane === 'AI').length} fields</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.noConfig}>
                  <p>No MongoDB configuration found for {format}</p>
                  <p className={styles.hint}>
                    Configuration may not exist yet or format uses multi-hop routing through JSON
                  </p>
                </div>
              )}

              <div className={styles.mongoNote}>
                <Icon glyph="Sparkle" className={styles.mongoIcon} />
                <p>
                  This configuration in <strong>conversion_registry</strong> enables zero-code conversion.
                  Just add a document like this to support any new format!
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body // Render directly to body, outside of React Flow
  );
};

export default FormatInfoModal;