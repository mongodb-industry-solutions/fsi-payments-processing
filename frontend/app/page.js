"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Card from "@leafygreen-ui/card";
import Button from "@leafygreen-ui/button";
import Icon from "@leafygreen-ui/icon";
import { H1, H2, Subtitle, Body } from "@leafygreen-ui/typography";
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
            <Icon glyph="Bulb" size="xlarge" />
          </div>
          <H2>Intelligent Auto-Configuration</H2>
          <Body>
            Pattern recognition combined with LLM generates new format configurations automatically. The system learns from every configuration and gets smarter over time.
          </Body>
          <div className={styles.metric}>
            <span className={styles.metricValue}>Automated</span>
            <span className={styles.metricLabel}>Generation</span>
          </div>
          <div className={styles.badgeWrapper}>
            <Badge variant="blue">Self-Improving</Badge>
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

      <div className={styles.howItWorks}>
        <H2 className={styles.sectionTitle}>How It Works Together</H2>
        <Body className={styles.sectionSubtitle}>
          The three core features work seamlessly to create a self-improving, infinitely extensible conversion system
        </Body>
        <div className={styles.flowSteps}>
          <Card className={styles.flowStep}>
            <Icon glyph="ImportantWithCircle" />
            <Subtitle>New Format Needed</Subtitle>
            <Body>MT192 conversion required</Body>
          </Card>

          <div className={styles.flowArrow}>→</div>

          <Card className={styles.flowStep}>
            <Icon glyph="Bulb" />
            <Subtitle>Auto-Configuration</Subtitle>
            <Body>Intelligent pattern analysis</Body>
          </Card>

          <div className={styles.flowArrow}>→</div>

          <Card className={styles.flowStep}>
            <Icon glyph="Database" />
            <Subtitle>MongoDB Storage</Subtitle>
            <Body>Config saved instantly</Body>
          </Card>

          <div className={styles.flowArrow}>→</div>

          <Card className={styles.flowStep}>
            <Icon glyph="Diagram3" />
            <Subtitle>JSON Routing</Subtitle>
            <Body>Multi-hop paths enabled</Body>
          </Card>

          <div className={styles.flowArrow}>→</div>

          <Card className={styles.flowStep}>
            <Icon glyph="CheckmarkWithCircle" />
            <Subtitle>Active Conversion</Subtitle>
            <Body>MT192 ↔ pacs.008 working</Body>
          </Card>
        </div>
      </div>

      <div className={styles.valueProps}>
        <H2 className={styles.sectionTitle}>Why This Matters</H2>
        <div className={styles.valueGrid}>
          <div className={styles.valueProp}>
            <Icon glyph="Clock" size="large" />
            <Subtitle>Accelerate format deployment</Subtitle>
            <Body>Eliminate lengthy development cycles and rapidly bring new payment format support to market through intelligent automation.</Body>
          </div>
          <div className={styles.valueProp}>
            <Icon glyph="University" size="large" />
            <Subtitle>System intelligence improves with every use</Subtitle>
            <Body>Machine learning and pattern recognition continuously enhance configuration accuracy and automation capabilities.</Body>
          </div>
          <div className={styles.valueProp}>
            <Icon glyph="Relationship" size="large" />
            <Subtitle>Connect any payment format to any other format</Subtitle>
            <Body>Universal compatibility through canonical JSON enables unlimited format conversion possibilities.</Body>
          </div>
        </div>
      </div>
    </div>
  );
}
