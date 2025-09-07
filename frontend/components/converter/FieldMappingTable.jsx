"use client";

import React, { useState, useEffect } from "react";
import Badge from "@leafygreen-ui/badge";
import Icon from "@leafygreen-ui/icon";
import IconButton from "@leafygreen-ui/icon-button";
import { Body, Overline } from "@leafygreen-ui/typography";
import styles from "./FieldMappingTable.module.css";

export default function FieldMappingTable({ conversionId, sourceFormat, targetFormat }) {
  const [fieldMappings, setFieldMappings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [copiedField, setCopiedField] = useState(null);

  useEffect(() => {
    if (conversionId) {
      fetchFieldMappings();
    }
  }, [conversionId]);

  const fetchFieldMappings = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/convert/details?id=${conversionId}`);
      const data = await response.json();
      
      if (data.success) {
        setFieldMappings(data.fieldMappings || []);
      } else {
        setError(data.error || "Failed to load field mappings");
      }
    } catch (err) {
      setError("Failed to fetch field mapping details");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getLaneColor = (lane) => {
    switch (lane?.toUpperCase()) {
      case 'RULES': return 'darkgreen';
      case 'AI': return 'purple';
      case 'HUMAN_REVIEW': 
      case 'HUMAN': return 'yellow';
      default: return 'lightgray';
    }
  };

  const getLaneIcon = (lane) => {
    switch (lane?.toUpperCase()) {
      case 'RULES': return 'Settings';
      case 'AI': return 'Sparkle';
      case 'HUMAN_REVIEW':
      case 'HUMAN': return 'Person';
      default: return 'QuestionMarkCircle';
    }
  };

  const formatFieldValue = (value) => {
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value, null, 2);
    }
    return String(value || '-');
  };

  const handleCopyValue = (value, fieldId) => {
    navigator.clipboard.writeText(formatFieldValue(value));
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const toggleRowExpansion = (fieldId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(fieldId)) {
      newExpanded.delete(fieldId);
    } else {
      newExpanded.add(fieldId);
    }
    setExpandedRows(newExpanded);
  };

  const formatConfidence = (confidence) => {
    if (confidence === undefined || confidence === null) return '-';
    const percentage = Math.round(confidence * 100);
    return `${percentage}%`;
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <Icon glyph="Refresh" className={styles.spinner} />
          <Body>Loading field mappings...</Body>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <Icon glyph="Warning" />
          <Body>{error}</Body>
        </div>
      </div>
    );
  }

  if (fieldMappings.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <Icon glyph="Folder" />
          <Body>No field mappings available</Body>
        </div>
      </div>
    );
  }


  return (
    <div className={styles.container}>
      <table className={styles.mappingTable}>
        <thead>
          <tr>
            <th>Source Field</th>
            <th>Source Value</th>
            <th className={styles.arrowColumn}>→</th>
            <th>Target Field</th>
            <th>Target Value</th>
            <th>Processing Lane</th>
            <th>Confidence</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {fieldMappings.map((mapping) => (
            <React.Fragment key={mapping.id}>
              <tr className={styles.mappingRow}>
                <td className={styles.fieldCell}>
                  <code>{mapping.sourceField}</code>
                </td>
                <td className={styles.valueCell}>
                  <div className={styles.valueCellContent}>
                    <span className={styles.value}>
                      {formatFieldValue(mapping.sourceValue).substring(0, 50)}
                      {formatFieldValue(mapping.sourceValue).length > 50 && '...'}
                    </span>
                    <IconButton
                      size="xsmall"
                      onClick={() => handleCopyValue(mapping.sourceValue, `${mapping.id}-source`)}
                      aria-label="Copy source value"
                    >
                      <Icon glyph={copiedField === `${mapping.id}-source` ? "Checkmark" : "Copy"} />
                    </IconButton>
                  </div>
                </td>
                <td className={styles.arrowColumn}>
                  <Icon glyph="ArrowRight" />
                </td>
                <td className={styles.fieldCell}>
                  <code>{mapping.targetField}</code>
                </td>
                <td className={styles.valueCell}>
                  <div className={styles.valueCellContent}>
                    <span className={styles.value}>
                      {formatFieldValue(mapping.targetValue).substring(0, 50)}
                      {formatFieldValue(mapping.targetValue).length > 50 && '...'}
                    </span>
                    <IconButton
                      size="xsmall"
                      onClick={() => handleCopyValue(mapping.targetValue, `${mapping.id}-target`)}
                      aria-label="Copy target value"
                    >
                      <Icon glyph={copiedField === `${mapping.id}-target` ? "Checkmark" : "Copy"} />
                    </IconButton>
                  </div>
                </td>
                <td className={styles.laneCell}>
                  <Badge variant={getLaneColor(mapping.processingLane)}>
                    <Icon glyph={getLaneIcon(mapping.processingLane)} />
                    {mapping.processingLane}
                  </Badge>
                </td>
                <td className={styles.confidenceCell}>
                  <span className={`${styles.confidence} ${
                    mapping.confidence >= 0.9 ? styles.highConfidence : 
                    mapping.confidence >= 0.7 ? styles.mediumConfidence : 
                    styles.lowConfidence
                  }`}>
                    {formatConfidence(mapping.confidence)}
                  </span>
                </td>
                <td className={styles.actionsCell}>
                  <IconButton
                    size="xsmall"
                    onClick={() => toggleRowExpansion(mapping.id)}
                    aria-label={expandedRows.has(mapping.id) ? "Collapse" : "Expand"}
                  >
                    <Icon glyph={expandedRows.has(mapping.id) ? "ChevronUp" : "ChevronDown"} />
                  </IconButton>
                </td>
              </tr>
              {expandedRows.has(mapping.id) && (
                <tr className={styles.expandedRow}>
                  <td colSpan="8">
                    <div className={styles.expandedContent}>
                      <div className={styles.ruleDetails}>
                        <div className={styles.detailSection}>
                          <Overline className={styles.label}>MongoDB Rule:</Overline>
                          <code className={styles.mongoRule}>{mapping.mongoRule}</code>
                        </div>
                        {mapping.modelUsed && (
                          <div className={styles.detailSection}>
                            <Overline className={styles.label}>AI Model:</Overline>
                            <span>{mapping.modelUsed}</span>
                          </div>
                        )}
                        <div className={styles.detailSection}>
                          <Overline className={styles.label}>Full Source Value:</Overline>
                          <pre className={styles.fullValue}>{formatFieldValue(mapping.sourceValue)}</pre>
                        </div>
                        <div className={styles.detailSection}>
                          <Overline className={styles.label}>Full Target Value:</Overline>
                          <pre className={styles.fullValue}>{formatFieldValue(mapping.targetValue)}</pre>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      
      <div className={styles.summary}>
        <Overline>
          Total fields mapped: {fieldMappings.length} | 
          Rules: {fieldMappings.filter(m => m.processingLane === 'RULES').length} | 
          AI: {fieldMappings.filter(m => m.processingLane === 'AI').length} | 
          Human Review: {fieldMappings.filter(m => m.processingLane === 'HUMAN_REVIEW').length}
        </Overline>
      </div>
    </div>
  );
}