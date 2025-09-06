"use client";

import { useState, useEffect } from "react";
import Card from "@leafygreen-ui/card";
import Badge from "@leafygreen-ui/badge";
import { Body, Subtitle, InlineCode } from "@leafygreen-ui/typography";
import Icon from "@leafygreen-ui/icon";
import styles from "./FormatPreview.module.css";

export default function FormatPreview({ format, type, isExpanded = false }) {
  const [preview, setPreview] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(isExpanded);

  useEffect(() => {
    if (format) {
      fetchPreview();
    } else {
      setPreview(null);
      setMetadata(null);
    }
  }, [format]);

  const fetchPreview = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/formats/preview?format=${format}&type=${type}`);
      const data = await response.json();
      
      if (data.success) {
        setPreview(data.preview);
        setMetadata(data.metadata);
      }
    } catch (error) {
      console.error("Failed to fetch preview:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!format) {
    return (
      <div className={styles.emptyState}>
        <Icon glyph="File" size="large" />
        <Body>Select a format to see preview</Body>
      </div>
    );
  }

  const getLanguageClass = () => {
    if (metadata?.standard === "ISO 20022" || format.includes("pacs")) {
      return styles.xml;
    } else if (format === "ISO8583" || format === "crypto") {
      return styles.json;
    }
    return styles.swift;
  };

  return (
    <Card className={styles.previewCard}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <span className={styles.icon}>{metadata?.icon}</span>
          <div>
            <Subtitle>{metadata?.name || format}</Subtitle>
            <Body className={styles.description}>{metadata?.description}</Body>
          </div>
        </div>
        
        <button 
          className={styles.expandButton}
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? "Collapse preview" : "Expand preview"}
        >
          <Icon glyph={expanded ? "ChevronUp" : "ChevronDown"} />
        </button>
      </div>

      <div className={styles.metadata}>
        <div className={styles.badges}>
          <Badge variant="blue">{metadata?.standard}</Badge>
          <Badge variant="lightgray">{metadata?.fields} fields</Badge>
          {metadata?.characteristics?.map((char, idx) => (
            <Badge key={idx} variant="lightgray">{char}</Badge>
          ))}
        </div>
        
        <div className={styles.mongoInfo}>
          <Icon glyph="Database" size="small" />
          <InlineCode>MongoDB: {metadata?.mongoCollection}</InlineCode>
        </div>
      </div>

      {expanded && (
        <div className={styles.previewContainer}>
          <div className={styles.previewHeader}>
            <Body weight="medium">
              {type === "source" ? "Sample Message" : "Template Structure"}
            </Body>
            <button 
              className={styles.copyButton}
              onClick={() => navigator.clipboard.writeText(preview)}
              title="Copy to clipboard"
            >
              <Icon glyph="Copy" size="small" />
            </button>
          </div>
          
          {loading ? (
            <div className={styles.skeleton}>
              <div className={styles.skeletonLine} />
              <div className={styles.skeletonLine} />
              <div className={styles.skeletonLine} />
            </div>
          ) : (
            <pre className={`${styles.codeBlock} ${getLanguageClass()}`}>
              <code>{preview}</code>
            </pre>
          )}
        </div>
      )}
    </Card>
  );
}