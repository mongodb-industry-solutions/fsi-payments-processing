"use client";

import { useState } from "react";
import Card from "@leafygreen-ui/card";
import Button from "@leafygreen-ui/button";
import TextArea from "@leafygreen-ui/text-area";
import TextInput from "@leafygreen-ui/text-input";
import { Select, Option } from "@leafygreen-ui/select";
import Badge from "@leafygreen-ui/badge";
import Banner from "@leafygreen-ui/banner";
import { H3, Body, Overline } from "@leafygreen-ui/typography";
import styles from "./AutoConfigPanel.module.css";

export default function AutoConfigPanel({ sourceFormat: propSourceFormat, targetFormat: propTargetFormat }) {
  const [sourceFormat, setSourceFormat] = useState(propSourceFormat || "");
  const [targetFormat, setTargetFormat] = useState(propTargetFormat || "");
  const [sampleMessage, setSampleMessage] = useState("");
  const [similarTo, setSimilarTo] = useState("MT103");
  const [configResult, setConfigResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAutoConfig = async () => {
    setLoading(true);
    setError(null);
    setConfigResult(null);

    try {
      const response = await fetch("/api/auto-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceFormat,
          targetFormat,
          sampleMessage,
          similarTo
        })
      });

      if (!response.ok) {
        throw new Error(`Configuration failed: ${response.status}`);
      }

      const result = await response.json();
      setConfigResult(result);
    } catch (error) {
      console.error("Auto-config failed:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async (approved) => {
    if (!configResult) return;
    
    try {
      const response = await fetch("/api/validate-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configurationId: configResult.configuration_id,
          corrections: {},
          approved: approved
        })
      });

      if (response.ok) {
        const result = await response.json();
        setError(null);
        setConfigResult({
          ...configResult,
          validated: true,
          validationResult: result
        });
      }
    } catch (error) {
      console.error("Validation failed:", error);
      setError("Failed to validate configuration");
    }
  };

  return (
    <div className={styles.container}>
      <Card className={styles.configCard}>
        <div className={styles.cardContent}>
          <H3>Auto-Configure New Format</H3>
          <Body>
            Automatically generate conversion configuration for new payment formats using AI
          </Body>
          
          {error && (
            <Banner variant="danger" className={styles.banner}>
              {error}
            </Banner>
          )}

          <div className={styles.formSection}>
            <TextInput
              label="Source Format"
              placeholder="e.g., MT192, MT205, MT940"
              value={sourceFormat}
              onChange={(e) => setSourceFormat(e.target.value)}
              description="Enter the new source format code"
            />

            <Select
              label="Target Format"
              value={targetFormat}
              onChange={(value) => setTargetFormat(value)}
              placeholder="Select target format"
              description="Choose the target format for conversion"
            >
              <Option value="pacs.008">pacs.008 - Credit Transfer</Option>
              <Option value="pacs.009">pacs.009 - FI Credit Transfer</Option>
              <Option value="pacs.004">pacs.004 - Payment Return</Option>
            </Select>

            <Select
              label="Similar To"
              value={similarTo}
              onChange={(value) => setSimilarTo(value)}
              placeholder="Select similar format"
              description="Choose a similar format to base the configuration on"
            >
              <Option value="MT103">MT103 - Wire Transfer</Option>
              <Option value="MT202">MT202 - Bank to Bank</Option>
            </Select>

            <TextArea
              label="Sample Message"
              placeholder="Paste a sample message in the source format..."
              value={sampleMessage}
              onChange={(e) => setSampleMessage(e.target.value)}
              rows={10}
              description="Provide a sample message for the AI to analyze"
            />

            <Button
              variant="primary"
              onClick={handleAutoConfig}
              disabled={loading || !sourceFormat || !targetFormat || !sampleMessage}
              className={styles.configButton}
            >
              {loading ? "Analyzing..." : "Generate Configuration"}
            </Button>
          </div>
        </div>
      </Card>

      {configResult && (
        <Card className={styles.resultCard}>
          <div className={styles.cardContent}>
            <H3>Configuration Result</H3>
            
            <div className={styles.resultHeader}>
              <Badge 
                variant={configResult.confidence > 0.7 ? "green" : "yellow"}
                className={styles.confidenceBadge}
              >
                Confidence: {(configResult.confidence * 100).toFixed(0)}%
              </Badge>
              
              {configResult.validated && (
                <Badge variant="blue">Validated</Badge>
              )}
              
              <span className={styles.timeInfo}>
                Generated in {configResult.generation_time_seconds?.toFixed(2)}s
              </span>
            </div>

            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <Overline>Fields Detected</Overline>
                <div className={styles.statValue}>{configResult.fields_detected}</div>
              </div>
              <div className={styles.statItem}>
                <Overline>Fields Mapped</Overline>
                <div className={styles.statValue}>{configResult.fields_mapped}</div>
              </div>
              <div className={styles.statItem}>
                <Overline>Success Rate</Overline>
                <div className={styles.statValue}>
                  {((configResult.fields_mapped / configResult.fields_detected) * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            {configResult.uncertain_fields?.length > 0 && (
              <div className={styles.uncertainSection}>
                <h4>Uncertain Fields</h4>
                <div className={styles.uncertainFields}>
                  {configResult.uncertain_fields.map((field, idx) => (
                    <div key={idx} className={styles.uncertainField}>
                      <Badge variant="yellow">Field {field.field}</Badge>
                      <span className={styles.reason}>{field.reason}</span>
                      <span className={styles.confidence}>
                        ({(field.confidence * 100).toFixed(0)}% confidence)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!configResult.validated && (
              <div className={styles.actionButtons}>
                <Button
                  variant="primary"
                  onClick={() => handleValidate(true)}
                  disabled={!configResult.ready_to_save}
                >
                  Approve & Save
                </Button>
                <Button
                  variant="danger"
                  onClick={() => handleValidate(false)}
                >
                  Reject
                </Button>
              </div>
            )}

            {configResult.validated && configResult.validationResult && (
              <Banner variant="success" className={styles.banner}>
                Configuration has been {configResult.validationResult.approved ? "approved and saved" : "rejected"}
              </Banner>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}