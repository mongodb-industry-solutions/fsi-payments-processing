"use client";

import { useState, useEffect } from "react";
import Card from "@leafygreen-ui/card";
import Button from "@leafygreen-ui/button";
import Badge from "@leafygreen-ui/badge";
import Banner from "@leafygreen-ui/banner";
import { H3, Body, Overline, Subtitle } from "@leafygreen-ui/typography";
import Icon from "@leafygreen-ui/icon";
import styles from "./LearningDashboard.module.css";

export default function LearningDashboard() {
  const [insights, setInsights] = useState(null);
  const [patterns, setPatterns] = useState(null);
  const [loading, setLoading] = useState(false);
  const [learningStatus, setLearningStatus] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    try {
      const response = await fetch("/api/mongodb");
      if (response.ok) {
        const data = await response.json();
        setInsights(data);
      }
    } catch (error) {
      console.error("Failed to load insights:", error);
      setError("Failed to load insights");
    }
  };

  const loadPatterns = async () => {
    try {
      const response = await fetch("/api/learning");
      if (response.ok) {
        const data = await response.json();
        setPatterns(data);
      }
    } catch (error) {
      console.error("Failed to load patterns:", error);
    }
  };

  const triggerLearning = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/learning", {
        method: "POST"
      });
      
      if (response.ok) {
        const result = await response.json();
        setLearningStatus(result);
        await loadInsights();
        await loadPatterns();
      } else {
        throw new Error("Learning process failed");
      }
    } catch (error) {
      console.error("Learning failed:", error);
      setError("Failed to trigger learning process");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <Card className={styles.dashboardCard}>
        <div className={styles.cardContent}>
          <div className={styles.header}>
            <H3>Semantic Learning Dashboard</H3>
            <Button
              variant="primary"
              onClick={triggerLearning}
              disabled={loading}
              leftGlyph={<Icon glyph="Refresh" />}
            >
              {loading ? "Learning..." : "Trigger Learning"}
            </Button>
          </div>

          {error && (
            <Banner variant="danger" className={styles.banner}>
              {error}
            </Banner>
          )}

          {learningStatus && (
            <Banner variant="success" className={styles.banner}>
              ✓ Learned {learningStatus.patterns_learned} patterns from {learningStatus.formats_analyzed?.join(", ")}
            </Banner>
          )}

          {insights && (
            <>
              <div className={styles.metricsGrid}>
                <Card className={styles.metricCard}>
                  <div className={styles.metricContent}>
                    <Icon glyph="Cloud" className={styles.metricIcon} />
                    <div className={styles.metricInfo}>
                      <div className={styles.metricValue}>
                        {insights.total_configurations || 0}
                      </div>
                      <Overline>Total Configurations</Overline>
                    </div>
                  </div>
                </Card>

                <Card className={styles.metricCard}>
                  <div className={styles.metricContent}>
                    <Icon glyph="Settings" className={styles.metricIcon} />
                    <div className={styles.metricInfo}>
                      <div className={styles.metricValue}>
                        {insights.total_semantic_patterns || 0}
                      </div>
                      <Overline>Semantic Patterns</Overline>
                    </div>
                  </div>
                </Card>

                <Card className={styles.metricCard}>
                  <div className={styles.metricContent}>
                    <Icon glyph="Charts" className={styles.metricIcon} />
                    <div className={styles.metricInfo}>
                      <div className={styles.metricValue}>
                        {insights.total_field_mappings || 0}
                      </div>
                      <Overline>Field Mappings</Overline>
                    </div>
                  </div>
                </Card>
              </div>

              <div className={styles.distributionSection}>
                <Subtitle>Processing Distribution</Subtitle>
                <div className={styles.distributionGrid}>
                  <div className={styles.distributionItem}>
                    <Badge variant="blue" className={styles.distributionBadge}>
                      RULES
                    </Badge>
                    <div className={styles.distributionValue}>
                      {insights.processing_distribution?.rules || 0}
                    </div>
                    <div className={styles.distributionPercent}>
                      {((insights.processing_distribution?.rules || 0) / 
                        (insights.total_field_mappings || 1) * 100).toFixed(0)}%
                    </div>
                  </div>

                  <div className={styles.distributionItem}>
                    <Badge variant="purple" className={styles.distributionBadge}>
                      AI
                    </Badge>
                    <div className={styles.distributionValue}>
                      {insights.processing_distribution?.ai || 0}
                    </div>
                    <div className={styles.distributionPercent}>
                      {((insights.processing_distribution?.ai || 0) / 
                        (insights.total_field_mappings || 1) * 100).toFixed(0)}%
                    </div>
                  </div>

                  <div className={styles.distributionItem}>
                    <Badge variant="yellow" className={styles.distributionBadge}>
                      HUMAN
                    </Badge>
                    <div className={styles.distributionValue}>
                      {insights.processing_distribution?.human || 0}
                    </div>
                    <div className={styles.distributionPercent}>
                      {((insights.processing_distribution?.human || 0) / 
                        (insights.total_field_mappings || 1) * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              </div>

              {insights.patterns_learned && insights.patterns_learned.length > 0 && (
                <div className={styles.patternsSection}>
                  <Subtitle>Learned Patterns</Subtitle>
                  <div className={styles.patternsGrid}>
                    {insights.patterns_learned.slice(0, 10).map((pattern, idx) => (
                      <div key={idx} className={styles.patternItem}>
                        <Badge variant="darkgreen" className={styles.patternBadge}>
                          {pattern}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {insights.format_pairs && insights.format_pairs.length > 0 && (
                <div className={styles.formatsSection}>
                  <Subtitle>Configured Format Pairs</Subtitle>
                  <div className={styles.formatsList}>
                    {insights.format_pairs.map((pair, idx) => (
                      <div key={idx} className={styles.formatPair}>
                        <span className={styles.sourceFormat}>{pair.source}</span>
                        <Icon glyph="ArrowRight" className={styles.arrowIcon} />
                        <span className={styles.targetFormat}>{pair.target}</span>
                        {insights.ai_enabled_formats?.some(
                          f => f.id === pair.id
                        ) && (
                          <Badge variant="purple" className={styles.aiBadge}>
                            AI
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {!insights && !error && (
            <div className={styles.loadingState}>
              <Icon glyph="Refresh" className={styles.loadingIcon} />
              <Body>Loading insights...</Body>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}