"use client";

import { useRouter } from "next/navigation";
import Card from "@leafygreen-ui/card";
import Button from "@leafygreen-ui/button";
import Icon from "@leafygreen-ui/icon";
import { H1, H2, Subtitle, Body } from "@leafygreen-ui/typography";
import Badge from "@leafygreen-ui/badge";
import styles from "./page.module.css";

export default function Home() {
  const router = useRouter();

  const handleGetStarted = () => {
    router.push("/agentic-ai");
  };

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <H1 className={styles.title}>
          Self-Improving Payment Format Converter
        </H1>
        <Subtitle className={styles.subtitle}>
          Document-driven. Intelligent learning. Universal compatibility.
        </Subtitle>

        <div className={styles.badges}>
          <Badge variant="darkgreen">MongoDB-Powered</Badge>
          <Badge variant="blue">AI-Enhanced</Badge>
          <Badge variant="lightgray">Infinitely Extensible</Badge>
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
          <div className={styles.iconWrapper}>
            <Icon glyph="Database" size="xlarge" />
          </div>
          <H2>Configuration-as-Data</H2>
          <Body>
            All conversion logic lives in MongoDB, not your codebase. Add new payment formats with minimal integration effort through document-based configuration.
          </Body>
          <div className={styles.metric}>
            <span className={styles.metricValue}>Document Driven</span>
            <span className={styles.metricLabel}>Less Code Integration</span>
          </div>
          <div className={styles.badgeWrapper}>
            <Badge variant="green">Generic</Badge>
          </div>
        </Card>

        <Card className={styles.featureCard}>
          <div className={styles.iconWrapper}>
            <Icon glyph="Wizard" size="xlarge" />
          </div>
          <H2>Agentic Error Resolution</H2>
          <Body>
            When payment processing encounters validation errors or missing fields, the AI agent autonomously corrects data, adds required information, and resolves issues in real-time.
          </Body>
          <div className={styles.metric}>
            <span className={styles.metricValue}>Autonomous</span>
            <span className={styles.metricLabel}>Field Correction</span>
          </div>
          <div className={styles.badgeWrapper}>
            <Badge variant="blue">AI-Powered</Badge>
          </div>
        </Card>

        <Card className={styles.featureCard}>
          <div className={styles.iconWrapper}>
            <Icon glyph="Diagram3" size="xlarge" />
          </div>
          <H2>Universal Compatibility</H2>
          <Body>
            Canonical JSON acts as a universal intermediate format. Convert between any payment formats through standardized representation enabling multi-hop routing.
          </Body>
          <div className={styles.metric}>
            <span className={styles.metricValue}>∞</span>
            <span className={styles.metricLabel}>Format Pairs</span>
          </div>
          <div className={styles.badgeWrapper}>
            <Badge variant="purple">Multi-Hop Routing</Badge>
          </div>
        </Card>
      </div>
    </div>
  );
}
