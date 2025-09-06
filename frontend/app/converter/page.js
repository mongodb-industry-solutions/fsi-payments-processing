"use client";

import { useState } from "react";
import FormatSelector from "@/components/converter/FormatSelector";
import FormatPreview from "@/components/converter/FormatPreview";
import FieldMappingTable from "@/components/converter/FieldMappingTable";
import ProcessingMetrics from "@/components/converter/ProcessingMetrics";
import MongoDBInsightsPanel from "@/components/converter/MongoDBInsightsPanel";
import Button from "@leafygreen-ui/button";
import Card from "@leafygreen-ui/card";
import { Tabs, Tab } from "@leafygreen-ui/tabs";
import { H1, Body } from "@leafygreen-ui/typography";
import LeafyGreenProvider from "@leafygreen-ui/leafygreen-provider";
import styles from "./converter.module.css";

// Available formats - in production these would come from MongoDB
const sourceFormats = [
  { value: "MT103", label: "MT103 - Wire Transfer" },
  { value: "MT202", label: "MT202 - Bank to Bank" },
  { value: "MT900", label: "MT900 - Confirmation of Debit" },
  { value: "SWIFT_MT", label: "Generic SWIFT MT" }
];

const targetFormats = [
  { value: "pacs.008", label: "pacs.008 - ISO 20022 Credit Transfer" },
  { value: "pacs.004", label: "pacs.004 - Payment Return" },
  { value: "ISO8583", label: "ISO 8583 - Card Payments" },
  { value: "crypto", label: "Crypto/Stablecoin API" }
];

export default function ConverterPage() {
  const [sourceFormat, setSourceFormat] = useState("");
  const [targetFormat, setTargetFormat] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversionResult, setConversionResult] = useState(null);
  const [selectedTab, setSelectedTab] = useState(0);

  const handleConvert = async () => {
    if (!sourceFormat || !targetFormat) {
      alert("Please select both source and target formats");
      return;
    }

    setIsLoading(true);
    setConversionResult(null);

    try {
      const response = await fetch("/api/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceFormat,
          targetFormat,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setConversionResult({
          success: true,
          sourceFormat: data.sourceFormat,
          targetFormat: data.targetFormat,
          inputMessage: data.inputMessage,
          outputMessage: data.outputMessage,
          conversionId: data.conversionId,
          processingLanes: data.processingLanes,
          statistics: data.statistics,
        });
      } else {
        setConversionResult({
          success: false,
          error: data.error || "Conversion failed",
          details: data.details,
        });
      }
    } catch (error) {
      setConversionResult({
        success: false,
        error: "Failed to connect to conversion service",
        details: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LeafyGreenProvider>
      <div className={styles.container}>
        <div className={styles.header}>
          <H1>Payment Format Converter</H1>
          <Body className={styles.subtitle}>
            Convert payment messages between formats using MongoDB-driven rules and AI
          </Body>
        </div>

        <div className={styles.content}>
          <Card className={styles.card}>
            <div className={styles.cardContent}>
              <h2>Select Formats</h2>
              <p>Choose source and target payment formats to begin conversion</p>
            
            <div className={styles.formatSelectors}>
              <FormatSelector
                label="Source Format"
                value={sourceFormat}
                onChange={setSourceFormat}
                options={sourceFormats}
                placeholder="Select source format..."
              />
              <FormatSelector
                label="Target Format"
                value={targetFormat}
                onChange={setTargetFormat}
                options={targetFormats}
                placeholder="Select target format..."
              />
            </div>
            
            {/* Format Previews */}
            <div className={styles.previewSection}>
              <div className={styles.previewColumn}>
                <h3 className={styles.previewTitle}>Source Format Preview</h3>
                <FormatPreview 
                  format={sourceFormat} 
                  type="source"
                  isExpanded={sourceFormat !== ""}
                />
              </div>
              <div className={styles.previewColumn}>
                <h3 className={styles.previewTitle}>Target Format Preview</h3>
                <FormatPreview 
                  format={targetFormat} 
                  type="target"
                  isExpanded={targetFormat !== ""}
                />
              </div>
            </div>

            <div className={styles.buttonContainer}>
              <Button
                onClick={handleConvert}
                disabled={!sourceFormat || !targetFormat || isLoading}
                variant="primary"
              >
                {isLoading ? "Converting..." : "Convert"}
              </Button>
            </div>
          </div>
        </Card>

          {/* Enhanced Results section with Field Mapping Visualization */}
          {conversionResult && (
            <Card className={styles.card}>
              <div className={styles.cardContent}>
                <h2>Conversion Result</h2>
                {conversionResult.success ? (
                  <>
                    <div className={styles.success}>
                      ✅ Successfully converted {conversionResult.sourceFormat} to {conversionResult.targetFormat}
                    </div>
                    
                    {/* Processing Metrics Overview */}
                    <ProcessingMetrics
                      processingLanes={conversionResult.processingLanes}
                      processingTime={conversionResult.statistics?.processing_time || 245}
                      confidence={conversionResult.statistics?.average_confidence || 0.92}
                      totalFields={
                        (conversionResult.processingLanes?.rules || 0) +
                        (conversionResult.processingLanes?.ai || 0) +
                        (conversionResult.processingLanes?.human || 0)
                      }
                    />
                    
                    {/* Tabbed Interface for Details */}
                    <div className={styles.tabsContainer}>
                      <Tabs 
                        selected={selectedTab}
                        onChange={setSelectedTab}
                        aria-label="Conversion Details"
                      >
                        <Tab name="Field Mappings">
                          <div className={styles.tabContent}>
                            <FieldMappingTable
                              conversionId={conversionResult.conversionId}
                              sourceFormat={conversionResult.sourceFormat}
                              targetFormat={conversionResult.targetFormat}
                            />
                          </div>
                        </Tab>
                        
                        <Tab name="MongoDB Insights">
                          <div className={styles.tabContent}>
                            <MongoDBInsightsPanel
                              sourceFormat={conversionResult.sourceFormat}
                              targetFormat={conversionResult.targetFormat}
                              processingTime={conversionResult.statistics?.processing_time || 245}
                              conversionId={conversionResult.conversionId}
                            />
                          </div>
                        </Tab>
                        
                        <Tab name="Raw Messages">
                          <div className={styles.tabContent}>
                            <div className={styles.messageContainer}>
                              <h3>Input ({conversionResult.sourceFormat}):</h3>
                              <pre className={styles.codeBlock}>
                                {conversionResult.inputMessage}
                              </pre>
                            </div>
                            
                            <div className={styles.messageContainer}>
                              <h3>Output ({conversionResult.targetFormat}):</h3>
                              <pre className={styles.codeBlock}>
                                {conversionResult.outputMessage}
                              </pre>
                            </div>
                          </div>
                        </Tab>
                      </Tabs>
                    </div>
                    
                    {conversionResult.conversionId && (
                      <div className={styles.metadata}>
                        <small>Conversion ID: {conversionResult.conversionId}</small>
                      </div>
                    )}
                  </>
                ) : (
                  <div className={styles.error}>
                    ❌ {conversionResult.error}
                    {conversionResult.details && (
                      <div className={styles.errorDetails}>
                        <small>{conversionResult.details}</small>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </LeafyGreenProvider>
  );
}