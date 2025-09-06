"use client";

import { useEffect, useState } from "react";
import Icon from "@leafygreen-ui/icon";
import { Body, Overline, H3 } from "@leafygreen-ui/typography";
import styles from "./ProcessingMetrics.module.css";

export default function ProcessingMetrics({ 
  processingLanes, 
  processingTime, 
  confidence,
  totalFields 
}) {
  const [animatedValues, setAnimatedValues] = useState({
    rules: 0,
    ai: 0,
    human: 0,
    confidence: 0
  });

  useEffect(() => {
    // Animate the values
    const animationDuration = 1000; // 1 second
    const steps = 20;
    const interval = animationDuration / steps;
    
    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      
      setAnimatedValues({
        rules: Math.round((processingLanes?.rules || 0) * progress),
        ai: Math.round((processingLanes?.ai || 0) * progress),
        human: Math.round((processingLanes?.human || 0) * progress),
        confidence: Math.round((confidence || 0) * progress * 100)
      });
      
      if (currentStep >= steps) {
        clearInterval(timer);
      }
    }, interval);
    
    return () => clearInterval(timer);
  }, [processingLanes, confidence]);

  const calculatePercentage = (value, total) => {
    if (!total || total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  const formatTime = (time) => {
    if (!time) return '-';
    if (typeof time === 'number') {
      return `${time}ms`;
    }
    return time;
  };

  const getConfidenceColor = (conf) => {
    if (conf >= 90) return styles.highConfidence;
    if (conf >= 70) return styles.mediumConfidence;
    return styles.lowConfidence;
  };

  const total = totalFields || 
    (processingLanes?.rules || 0) + 
    (processingLanes?.ai || 0) + 
    (processingLanes?.human || 0);

  return (
    <div className={styles.container}>
      <H3 className={styles.title}>Processing Metrics</H3>
      
      <div className={styles.metricsGrid}>
        {/* Processing Lanes */}
        <div className={styles.laneMetrics}>
          <div className={styles.laneItem}>
            <div className={styles.laneHeader}>
              <div className={styles.laneInfo}>
                <Icon glyph="Settings" className={styles.rulesIcon} />
                <span className={styles.laneName}>Rules Engine</span>
              </div>
              <span className={styles.laneCount}>{animatedValues.rules} fields</span>
            </div>
            <div className={styles.progressBar}>
              <div 
                className={`${styles.progressFill} ${styles.rulesFill}`}
                style={{ width: `${calculatePercentage(animatedValues.rules, total)}%` }}
              />
            </div>
            <Overline className={styles.laneCaption}>
              MongoDB rules-based mapping
            </Overline>
          </div>

          <div className={styles.laneItem}>
            <div className={styles.laneHeader}>
              <div className={styles.laneInfo}>
                <Icon glyph="Sparkle" className={styles.aiIcon} />
                <span className={styles.laneName}>AI Processing</span>
              </div>
              <span className={styles.laneCount}>{animatedValues.ai} fields</span>
            </div>
            <div className={styles.progressBar}>
              <div 
                className={`${styles.progressFill} ${styles.aiFill}`}
                style={{ width: `${calculatePercentage(animatedValues.ai, total)}%` }}
              />
            </div>
            <Overline className={styles.laneCaption}>
              LLM-powered field extraction
            </Overline>
          </div>

          {(processingLanes?.human || 0) > 0 && (
            <div className={styles.laneItem}>
              <div className={styles.laneHeader}>
                <div className={styles.laneInfo}>
                  <Icon glyph="Person" className={styles.humanIcon} />
                  <span className={styles.laneName}>Human Review</span>
                </div>
                <span className={styles.laneCount}>{animatedValues.human} fields</span>
              </div>
              <div className={styles.progressBar}>
                <div 
                  className={`${styles.progressFill} ${styles.humanFill}`}
                  style={{ width: `${calculatePercentage(animatedValues.human, total)}%` }}
                />
              </div>
              <Overline className={styles.laneCaption}>
                Pending manual verification
              </Overline>
            </div>
          )}
        </div>

        {/* Overall Metrics */}
        <div className={styles.overallMetrics}>
          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <Icon glyph="Charts" />
              <Overline>Overall Confidence</Overline>
            </div>
            <div className={`${styles.metricValue} ${getConfidenceColor(animatedValues.confidence)}`}>
              {animatedValues.confidence}%
            </div>
            <div className={styles.confidenceBar}>
              <div 
                className={`${styles.confidenceFill} ${getConfidenceColor(animatedValues.confidence)}`}
                style={{ width: `${animatedValues.confidence}%` }}
              />
            </div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <Icon glyph="Clock" />
              <Overline>Processing Time</Overline>
            </div>
            <div className={styles.metricValue}>
              {formatTime(processingTime)}
            </div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <Icon glyph="Database" />
              <Overline>Total Fields</Overline>
            </div>
            <div className={styles.metricValue}>
              {total}
            </div>
          </div>
        </div>
      </div>

      {/* Distribution Chart */}
      <div className={styles.distribution}>
        <Overline className={styles.distributionTitle}>Field Distribution</Overline>
        <div className={styles.distributionBar}>
          <div 
            className={`${styles.distributionSegment} ${styles.rulesSegment}`}
            style={{ width: `${calculatePercentage(processingLanes?.rules || 0, total)}%` }}
            title={`Rules: ${processingLanes?.rules || 0} fields`}
          >
            {calculatePercentage(processingLanes?.rules || 0, total) > 10 && 
              `${calculatePercentage(processingLanes?.rules || 0, total)}%`
            }
          </div>
          <div 
            className={`${styles.distributionSegment} ${styles.aiSegment}`}
            style={{ width: `${calculatePercentage(processingLanes?.ai || 0, total)}%` }}
            title={`AI: ${processingLanes?.ai || 0} fields`}
          >
            {calculatePercentage(processingLanes?.ai || 0, total) > 10 && 
              `${calculatePercentage(processingLanes?.ai || 0, total)}%`
            }
          </div>
          {(processingLanes?.human || 0) > 0 && (
            <div 
              className={`${styles.distributionSegment} ${styles.humanSegment}`}
              style={{ width: `${calculatePercentage(processingLanes?.human || 0, total)}%` }}
              title={`Human: ${processingLanes?.human || 0} fields`}
            >
              {calculatePercentage(processingLanes?.human || 0, total) > 10 && 
                `${calculatePercentage(processingLanes?.human || 0, total)}%`
              }
            </div>
          )}
        </div>
        <div className={styles.distributionLegend}>
          <div className={styles.legendItem}>
            <div className={`${styles.legendDot} ${styles.rulesColor}`} />
            <Overline>Rules ({calculatePercentage(processingLanes?.rules || 0, total)}%)</Overline>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendDot} ${styles.aiColor}`} />
            <Overline>AI ({calculatePercentage(processingLanes?.ai || 0, total)}%)</Overline>
          </div>
          {(processingLanes?.human || 0) > 0 && (
            <div className={styles.legendItem}>
              <div className={`${styles.legendDot} ${styles.humanColor}`} />
              <Overline>Human ({calculatePercentage(processingLanes?.human || 0, total)}%)</Overline>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}