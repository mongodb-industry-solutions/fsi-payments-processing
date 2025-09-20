"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Card from "@leafygreen-ui/card";
import Button from "@leafygreen-ui/button";
import { H1, H2, Body } from "@leafygreen-ui/typography";
import Badge from "@leafygreen-ui/badge";
import styles from "./page.module.css";

export default function Home() {
  const router = useRouter();

  const handleGetStarted = () => {
    router.push("/payment-builder");
  };

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <H1 className={styles.title}>
          Generic Payment Format Converter
        </H1>
        <Body className={styles.subtitle}>
          MongoDB-driven payment format conversion with AI-powered field extraction
        </Body>

        <div className={styles.badges}>
          <Badge variant="green">100% Generic</Badge>
          <Badge variant="blue">3-Lane Processing</Badge>
          <Badge variant="purple">AI-Powered</Badge>
        </div>

        <Button
          variant="primary"
          size="large"
          onClick={handleGetStarted}
          className={styles.ctaButton}
        >
          Get Started
        </Button>
      </div>

      <div className={styles.features}>
        <Card className={styles.featureCard}>
          <H2>Rules Lane</H2>
          <Body>
            Fast deterministic field mappings for 80-85% of fields. Direct transformations with 100% confidence.
          </Body>
          <div className={styles.metric}>
            <span className={styles.metricValue}>50-200ms</span>
            <span className={styles.metricLabel}>Processing Time</span>
          </div>
        </Card>

        <Card className={styles.featureCard}>
          <H2>AI Lane</H2>
          <Body>
            Complex extraction from unstructured fields using AWS Bedrock. Handles 10-15% of complex fields.
          </Body>
          <div className={styles.metric}>
            <span className={styles.metricValue}>1-3s</span>
            <span className={styles.metricLabel}>Processing Time</span>
          </div>
        </Card>

        <Card className={styles.featureCard}>
          <H2>Human Review</H2>
          <Body>
            Low-confidence fields flagged for review. Less than 5% of fields require human validation.
          </Body>
          <div className={styles.metric}>
            <span className={styles.metricValue}>0.8</span>
            <span className={styles.metricLabel}>Confidence Threshold</span>
          </div>
        </Card>
      </div>

      <div className={styles.mongoSection}>
        <H2>Powered by MongoDB</H2>
        <Body>
          All conversion logic stored in MongoDB. Add new formats without code changes.
        </Body>
        <div className={styles.mongoFeatures}>
          <div className={styles.mongoFeature}>
            <Badge variant="darkgreen">conversion_registry</Badge>
            <span>Format configurations</span>
          </div>
          <div className={styles.mongoFeature}>
            <Badge variant="darkgreen">semantic_patterns</Badge>
            <span>Learned patterns</span>
          </div>
          <div className={styles.mongoFeature}>
            <Badge variant="darkgreen">Auto-Config</Badge>
            <span>2-8 second setup</span>
          </div>
        </div>
      </div>
    </div>
  );
}
