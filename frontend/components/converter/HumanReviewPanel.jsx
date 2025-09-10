"use client";

import { useState } from "react";
import Card from "@leafygreen-ui/card";
import Button from "@leafygreen-ui/button";
import Badge from "@leafygreen-ui/badge";
import TextInput from "@leafygreen-ui/text-input";
import { Table, Row, Cell, HeaderRow, TableHead, TableBody } from "@leafygreen-ui/table";
import Banner from "@leafygreen-ui/banner";
import { H3, Body, Overline } from "@leafygreen-ui/typography";
import Icon from "@leafygreen-ui/icon";
import styles from "./HumanReviewPanel.module.css";

export default function HumanReviewPanel({ reviewFields = [], onSubmit }) {
  const [corrections, setCorrections] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const handleCorrectionChange = (fieldName, value) => {
    setCorrections(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const handleSubmit = (action) => {
    if (action === 'accept') {
      onSubmit({});
      setSubmitted(true);
    } else if (action === 'submit') {
      onSubmit(corrections);
      setSubmitted(true);
    }
  };

  const getConfidenceBadgeVariant = (confidence) => {
    if (confidence >= 0.8) return "green";
    if (confidence >= 0.5) return "yellow";
    return "red";
  };

  const getConfidenceIcon = (confidence) => {
    if (confidence >= 0.8) return "CheckmarkWithCircle";
    if (confidence >= 0.5) return "Warning";
    return "X";
  };

  if (!reviewFields || reviewFields.length === 0) {
    return (
      <Card className={styles.emptyCard}>
        <div className={styles.emptyContent}>
          <Icon glyph="CheckmarkWithCircle" size="xlarge" className={styles.emptyIcon} />
          <H3>No Human Review Required</H3>
          <Body>All fields processed with high confidence</Body>
        </div>
      </Card>
    );
  }

  return (
    <div className={styles.container}>
      <Card className={styles.reviewCard}>
        <div className={styles.cardContent}>
          <div className={styles.header}>
            <H3>Human Review Required</H3>
            <Badge variant="yellow">
              {reviewFields.length} field{reviewFields.length !== 1 ? 's' : ''} need review
            </Badge>
          </div>
          
          <Body className={styles.description}>
            The following fields have low confidence scores and require manual validation.
            Review the AI suggestions and provide corrections if needed.
          </Body>

          {submitted && (
            <Banner variant="success" className={styles.banner}>
              Review submitted successfully
            </Banner>
          )}

          <div className={styles.tableContainer}>
            <Table className={styles.reviewTable}>
              <TableHead>
                <HeaderRow>
                  <Cell>Field</Cell>
                  <Cell>Current Value</Cell>
                  <Cell>Confidence</Cell>
                  <Cell>AI Suggestion</Cell>
                  <Cell>Your Correction</Cell>
                </HeaderRow>
              </TableHead>
              <TableBody>
                {reviewFields.map((field, idx) => (
                  <Row key={idx}>
                    <Cell>
                      <div className={styles.fieldName}>
                        <code>{field.field}</code>
                      </div>
                    </Cell>
                    <Cell>
                      <div className={styles.currentValue}>
                        {field.value ? (
                          <pre className={styles.valueText}>{field.value}</pre>
                        ) : (
                          <span className={styles.noValue}>No value</span>
                        )}
                      </div>
                    </Cell>
                    <Cell>
                      <div className={styles.confidenceCell}>
                        <Badge 
                          variant={getConfidenceBadgeVariant(field.confidence)}
                          className={styles.confidenceBadge}
                        >
                          <Icon 
                            glyph={getConfidenceIcon(field.confidence)} 
                            size="small"
                          />
                          {(field.confidence * 100).toFixed(0)}%
                        </Badge>
                        <span className={styles.threshold}>
                          (threshold: {(field.threshold * 100).toFixed(0)}%)
                        </span>
                      </div>
                    </Cell>
                    <Cell>
                      <div className={styles.suggestion}>
                        {field.suggestion || (
                          <span className={styles.noSuggestion}>No suggestion</span>
                        )}
                      </div>
                    </Cell>
                    <Cell>
                      <TextInput
                        size="small"
                        placeholder="Enter correction..."
                        value={corrections[field.field] || ""}
                        onChange={(e) => handleCorrectionChange(field.field, e.target.value)}
                        disabled={submitted}
                        className={styles.correctionInput}
                      />
                    </Cell>
                  </Row>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className={styles.statsSection}>
            <div className={styles.statItem}>
              <Overline>Average Confidence</Overline>
              <div className={styles.statValue}>
                {(reviewFields.reduce((sum, f) => sum + f.confidence, 0) / reviewFields.length * 100).toFixed(0)}%
              </div>
            </div>
            <div className={styles.statItem}>
              <Overline>Below 50%</Overline>
              <div className={styles.statValue}>
                {reviewFields.filter(f => f.confidence < 0.5).length}
              </div>
            </div>
            <div className={styles.statItem}>
              <Overline>Corrections Made</Overline>
              <div className={styles.statValue}>
                {Object.keys(corrections).length}
              </div>
            </div>
          </div>

          {!submitted && (
            <div className={styles.actionButtons}>
              <Button
                variant="default"
                onClick={() => handleSubmit('accept')}
                leftGlyph={<Icon glyph="Checkmark" />}
              >
                Accept All Suggestions
              </Button>
              <Button
                variant="primary"
                onClick={() => handleSubmit('submit')}
                disabled={Object.keys(corrections).length === 0}
                leftGlyph={<Icon glyph="Edit" />}
              >
                Submit Corrections ({Object.keys(corrections).length})
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}