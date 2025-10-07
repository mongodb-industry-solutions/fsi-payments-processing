'use client';

import { useState, useEffect, useCallback } from 'react';
import Icon from '@leafygreen-ui/icon';
import Badge from '@leafygreen-ui/badge';
import styles from './RegistryConsole.module.css';

// Generate or retrieve session ID from localStorage
const getSessionId = () => {
  if (typeof window === 'undefined') return null;

  let sessionId = localStorage.getItem('demo_session_id');
  if (!sessionId) {
    // Generate new UUID v4
    sessionId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    localStorage.setItem('demo_session_id', sessionId);
  }
  return sessionId;
};

export default function RegistryConsole({ lastSavedConfig, onRefresh, onSessionIdGenerated }) {
  const [configs, setConfigs] = useState([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedId, setHighlightedId] = useState(null);
  const [sessionId, setSessionId] = useState(null);

  // Initialize session ID
  useEffect(() => {
    const id = getSessionId();
    setSessionId(id);
    // Notify parent component of session ID
    if (onSessionIdGenerated) {
      onSessionIdGenerated(id);
    }
  }, [onSessionIdGenerated]);

  const fetchConfigs = useCallback(async () => {
    if (!sessionId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:8001/api/v1/converter/production-registry?limit=20&session_id=${sessionId}`);
      const data = await response.json();

      if (data.success) {
        setConfigs(data.configs);

        // Highlight the last saved config
        if (lastSavedConfig) {
          setHighlightedId(lastSavedConfig);
          // Remove highlight after 3 seconds
          setTimeout(() => setHighlightedId(null), 3000);
        }
      }
    } catch (error) {
      console.error('Failed to fetch production registry:', error);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, lastSavedConfig]);

  // Fetch on mount and when sessionId is ready
  useEffect(() => {
    if (sessionId) {
      fetchConfigs();
    }
  }, [sessionId, fetchConfigs]);

  // Refresh when lastSavedConfig changes
  useEffect(() => {
    if (lastSavedConfig) {
      fetchConfigs();
    }
  }, [lastSavedConfig, fetchConfigs]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const getScoreBadgeVariant = (score) => {
    if (score >= 90) return 'green';
    if (score >= 70) return 'yellow';
    return 'red';
  };

  return (
    <div className={styles.container}>
      <div className={styles.header} onClick={() => setIsCollapsed(!isCollapsed)}>
        <div className={styles.headerLeft}>
          <span className={styles.chevron}>
            <Icon glyph={isCollapsed ? 'ChevronRight' : 'ChevronDown'} size="small" />
          </span>
          <Icon glyph="Cloud" size="small" />
          <h4>Production Registry Console</h4>
          <Badge variant="lightgray">{configs.length} configs</Badge>
        </div>
        <div className={styles.headerRight}>
          <button
            className={styles.refreshButton}
            onClick={(e) => {
              e.stopPropagation();
              fetchConfigs();
              onRefresh?.();
            }}
            disabled={isLoading}
          >
            <Icon glyph="Refresh" size="small" />
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className={styles.console}>
          <div className={styles.consoleHeader}>
            <span className={styles.consolePrompt}>$</span>
            <span className={styles.consoleCommand}>
              mongo [conversion_Registry].find({"{"}session_id: "{sessionId ? sessionId.substring(0, 8) : '...'}..."{"}"}).sort({"{"}validated_at: -1{"}"}).limit(20)
            </span>
          </div>

          {configs.length === 0 ? (
            <div className={styles.emptyState}>
              <Icon glyph="ImportantWithCircle" size="large" />
              <p>No configurations in production registry yet.</p>
              <p className={styles.emptyHint}>Save a validated configuration to see it here.</p>
            </div>
          ) : (
            <div className={styles.configList}>
              {configs.map((config, index) => (
                <div
                  key={config._id}
                  className={`${styles.configEntry} ${highlightedId === config._id ? styles.highlighted : ''}`}
                >
                  <div className={styles.configLine}>
                    <span className={styles.timestamp}>[{formatDate(config.validated_at)}]</span>
                    <Icon glyph="Checkmark" size="small" className={styles.successIcon} />
                    <span className={styles.configId}>{config._id}</span>
                    <span className={styles.arrow}>→</span>
                    <span className={styles.formats}>
                      {config.source_format} → {config.target_format}
                    </span>
                    <Badge variant={getScoreBadgeVariant(config.validation_score)}>
                      {config.validation_score}%
                    </Badge>
                    <Badge variant="blue">{config.status}</Badge>
                  </div>
                  {highlightedId === config._id && (
                    <div className={styles.newBadge}>
                      <Icon glyph="Sparkle" size="small" /> NEW
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
