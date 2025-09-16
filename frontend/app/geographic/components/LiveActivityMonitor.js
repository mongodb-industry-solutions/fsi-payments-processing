'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './LiveActivityMonitor.module.css';

export default function LiveActivityMonitor({ selectedScenario }) {
  const [activities, setActivities] = useState([]);
  const [filter, setFilter] = useState('all'); // all, success, warning, error
  const [metrics, setMetrics] = useState({
    totalScenarios: 9,
    avgHops: 3.2,
    avgLatency: 127,
    totalFormats: 8,
    routesAvailable: 24,
    mongoConfigs: 12
  });
  const scrollRef = useRef(null);

  // Generate activity when scenario changes or is executed
  useEffect(() => {
    if (!selectedScenario) return;

    // Generate activity entries for the selected scenario
    const scenarioActivities = [];
    selectedScenario.conversions?.forEach((conversion, index) => {
      scenarioActivities.push({
        id: Date.now() + index,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        source: conversion.from,
        target: conversion.to,
        latency: conversion.time,
        status: 'success',
        lane: conversion.from === 'JSON' || conversion.to === 'JSON' ? 'BRIDGE' : 'RULES',
        confidence: 95 + Math.floor(Math.random() * 5),
        node: conversion.location,
        description: conversion.description
      });
    });

    setActivities(prev => [...scenarioActivities, ...prev].slice(0, 50));
  }, [selectedScenario]);

  // Auto-scroll to top when new activities arrive
  useEffect(() => {
    if (scrollRef.current && activities.length > 0) {
      scrollRef.current.scrollTop = 0;
    }
  }, [activities]);

  const filteredActivities = activities.filter(activity => {
    if (filter === 'all') return true;
    return activity.status === filter;
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return '✓';
      case 'warning': return '⚠';
      case 'error': return '✗';
      default: return '•';
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'success': return styles.success;
      case 'warning': return styles.warning;
      case 'error': return styles.error;
      default: return '';
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h3 className={styles.title}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="4" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="2" y="10" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="2" y="16" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M11 6H18M11 12H18M11 18H18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Route Execution Log
          </h3>
          <div className={styles.connectionStatus}>
            <svg className={styles.connectionIcon} width="12" height="12" viewBox="0 0 12 12">
              <circle cx="6" cy="6" r="6" fill="currentColor"/>
            </svg>
            <span>MongoDB Atlas Connected</span>
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.filterGroup}>
            <button
              className={`${styles.filterBtn} ${filter === 'all' ? styles.active : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({activities.length})
            </button>
            <button
              className={`${styles.filterBtn} ${filter === 'success' ? styles.active : ''}`}
              onClick={() => setFilter('success')}
            >
              Success
            </button>
            <button
              className={`${styles.filterBtn} ${filter === 'warning' ? styles.active : ''}`}
              onClick={() => setFilter('warning')}
            >
              Warnings
            </button>
            <button
              className={`${styles.filterBtn} ${filter === 'error' ? styles.active : ''}`}
              onClick={() => setFilter('error')}
            >
              Errors
            </button>
          </div>

          <button
            className={styles.clearBtn}
            onClick={() => setActivities([])}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Clear Log
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className={styles.metricsRow}>
        <div className={styles.metricCard}>
          <div className={styles.metricValue}>{metrics.totalScenarios}</div>
          <div className={styles.metricLabel}>Total Scenarios</div>
          <div className={styles.metricTrend}>Available</div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricValue}>{metrics.avgHops}</div>
          <div className={styles.metricLabel}>Avg Hops</div>
          <div className={styles.metricTrend}>Per Route</div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricValue}>{metrics.avgLatency}ms</div>
          <div className={styles.metricLabel}>Avg Latency</div>
          <div className={styles.metricTrend}>Per Hop</div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricValue}>{metrics.totalFormats}</div>
          <div className={styles.metricLabel}>Formats</div>
          <div className={styles.metricTrend}>Supported</div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricValue}>{metrics.routesAvailable}</div>
          <div className={styles.metricLabel}>Routes</div>
          <div className={styles.metricTrend}>Configured</div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricValue}>{metrics.mongoConfigs}</div>
          <div className={styles.metricLabel}>MongoDB Configs</div>
          <div className={styles.metricTrend}>Active</div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className={styles.activityFeed} ref={scrollRef}>
        {filteredActivities.length === 0 ? (
          <div className={styles.noActivity}>
            Select and execute a scenario to see the conversion steps
          </div>
        ) : (
          filteredActivities.map((activity, index) => (
            <div
              key={activity.id}
              className={`${styles.activityRow} ${index === 0 ? styles.newest : ''}`}
            >
              <div className={styles.activityTime}>
                {activity.timestamp}
              </div>

              <div className={`${styles.activityStatus} ${getStatusClass(activity.status)}`}>
                <span className={styles.statusIcon}>{getStatusIcon(activity.status)}</span>
              </div>

              <div className={styles.activityConversion}>
                <span className={styles.format}>{activity.source}</span>
                <span className={styles.arrow}>→</span>
                <span className={styles.format}>{activity.target}</span>
              </div>

              <div className={styles.activityMetrics}>
                <span className={styles.latency}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1"/>
                    <path d="M6 3V6L8 8" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                  </svg>
                  {activity.latency}ms
                </span>

                <span className={`${styles.lane} ${activity.lane === 'AI' ? styles.aiLane : styles.rulesLane}`}>
                  {activity.lane}
                </span>

                <span className={styles.confidence}>
                  {activity.confidence}%
                </span>

                <span className={styles.node}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="6" r="2" fill="currentColor"/>
                    <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1" opacity="0.3"/>
                  </svg>
                  {activity.node}
                </span>
              </div>

              {activity.status === 'error' && (
                <div className={styles.errorDetails}>
                  Field mapping failed: Confidence below threshold
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* MongoDB Operations Bar */}
      <div className={styles.mongoBar}>
        <div className={styles.mongoOps}>
          <span className={styles.opsLabel}>MongoDB Ops/sec:</span>
          <span className={styles.opsValue}>247</span>
        </div>
        <div className={styles.mongoQuery}>
          <code>{`db.conversion_registry.find({"_id": "MT103_to_pacs.008"})`}</code>
          <span className={styles.queryTime}>2ms</span>
        </div>
      </div>
    </div>
  );
}