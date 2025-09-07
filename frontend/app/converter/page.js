"use client";

import { useState, useEffect } from "react";
import FormatSelector from "@/components/converter/FormatSelector";
import FormatPreview from "@/components/converter/FormatPreview";
import FieldMappingTable from "@/components/converter/FieldMappingTable";
import ProcessingMetrics from "@/components/converter/ProcessingMetrics";
import MongoDBInsightsPanel from "@/components/converter/MongoDBInsightsPanel";
import Button from "@leafygreen-ui/button";
import Card from "@leafygreen-ui/card";
import { Tabs, Tab } from "@leafygreen-ui/tabs";
import { H1, Body } from "@leafygreen-ui/typography";
import Banner from "@leafygreen-ui/banner";
import LeafyGreenProvider from "@leafygreen-ui/leafygreen-provider";
import styles from "./converter.module.css";

export default function ConverterPage() {
  // Format selection states
  const [sourceFormat, setSourceFormat] = useState("");
  const [targetFormat, setTargetFormat] = useState("");
  
  // Format loading states
  const [sourceFormats, setSourceFormats] = useState([]);
  const [targetFormats, setTargetFormats] = useState([]);
  const [formatsLoading, setFormatsLoading] = useState(true);
  const [formatsError, setFormatsError] = useState(null);
  
  // Format previews cache
  const [formatPreviews, setFormatPreviews] = useState({});
  const [previewsLoaded, setPreviewsLoaded] = useState(false);
  
  // Conversion states
  const [isLoading, setIsLoading] = useState(false);
  const [conversionResult, setConversionResult] = useState(null);
  const [selectedTab, setSelectedTab] = useState(0);

  // Fetch formats on component mount
  useEffect(() => {
    fetchFormatsAndPreviews();
  }, []);

  const fetchFormatsAndPreviews = async () => {
    setFormatsLoading(true);
    setFormatsError(null);
    
    try {
      // Check sessionStorage cache first (5 minute TTL)
      const cacheKey = 'payment_formats_with_previews';
      const cached = sessionStorage.getItem(cacheKey);
      const cacheExpiry = sessionStorage.getItem(`${cacheKey}_expiry`);
      
      if (cached && cacheExpiry && new Date().getTime() < parseInt(cacheExpiry)) {
        const cachedData = JSON.parse(cached);
        setSourceFormats(formatOptionsForDropdown(cachedData.source_formats));
        setTargetFormats(formatOptionsForDropdown(cachedData.target_formats));
        if (cachedData.previews) {
          setFormatPreviews(cachedData.previews);
          setPreviewsLoaded(true);
        }
        setFormatsLoading(false);
        return;
      }
      
      // Fetch formats and previews in parallel
      const [formatsResponse, previewsResponse] = await Promise.all([
        fetch('/api/formats'),
        fetch('/api/formats/preview?preloadAll=true')
      ]);
      
      if (!formatsResponse.ok) {
        throw new Error('Failed to fetch formats');
      }
      
      const formatsData = await formatsResponse.json();
      let previewsData = {};
      
      // Load previews if available
      if (previewsResponse.ok) {
        const previewResult = await previewsResponse.json();
        if (previewResult.success && previewResult.previews) {
          previewsData = previewResult.previews;
          setFormatPreviews(previewsData);
          setPreviewsLoaded(true);
        }
      }
      
      // Transform data for dropdowns
      const sourceOptions = formatOptionsForDropdown(formatsData.source_formats);
      const targetOptions = formatOptionsForDropdown(formatsData.target_formats);
      
      setSourceFormats(sourceOptions);
      setTargetFormats(targetOptions);
      
      // Cache the data with previews
      const cacheData = {
        ...formatsData,
        previews: previewsData
      };
      sessionStorage.setItem(cacheKey, JSON.stringify(cacheData));
      sessionStorage.setItem(`${cacheKey}_expiry`, (new Date().getTime() + 5 * 60 * 1000).toString());
      
    } catch (error) {
      console.error('Error fetching formats:', error);
      setFormatsError('Failed to load payment formats. Using defaults.');
      
      // Use fallback formats
      setSourceFormats([
        { value: "MT103", label: "MT103 - Wire Transfer" },
        { value: "MT202", label: "MT202 - Bank to Bank" },
        { value: "MT900", label: "MT900 - Confirmation of Debit" },
        { value: "ISO8583", label: "ISO 8583 - Card Payments" }
      ]);
      setTargetFormats([
        { value: "pacs.008", label: "pacs.008 - ISO 20022 Credit Transfer" },
        { value: "pacs.004", label: "pacs.004 - Payment Return" },
        { value: "pacs.009", label: "pacs.009 - FI Credit Transfer" },
        { value: "ISO8583", label: "ISO 8583 - Card Payments" }
      ]);
    } finally {
      setFormatsLoading(false);
    }
  };

  const formatOptionsForDropdown = (formats) => {
    if (!formats || !Array.isArray(formats)) return [];
    return formats.map(fmt => ({
      value: fmt.format_code,
      label: `${fmt.format_code} - ${fmt.format_name}`
    }));
  };

  const refreshFormats = () => {
    // Clear cache and re-fetch
    sessionStorage.removeItem('payment_formats_with_previews');
    sessionStorage.removeItem('payment_formats_with_previews_expiry');
    setFormatPreviews({});
    setPreviewsLoaded(false);
    fetchFormatsAndPreviews();
  };

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
          {/* Show error banner if formats failed to load */}
          {formatsError && (
            <Banner variant="warning" dismissible={false}>
              {formatsError}
              <Button size="small" variant="default" onClick={refreshFormats} style={{ marginLeft: '10px' }}>
                Retry
              </Button>
            </Banner>
          )}
          
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
                placeholder={formatsLoading ? "Loading formats..." : "Select source format..."}
                disabled={formatsLoading}
              />
              <FormatSelector
                label="Target Format"
                value={targetFormat}
                onChange={setTargetFormat}
                options={targetFormats}
                placeholder={formatsLoading ? "Loading formats..." : "Select target format..."}
                disabled={formatsLoading}
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
                  previewData={formatPreviews[sourceFormat]}
                  isLoading={sourceFormat && !previewsLoaded && !formatPreviews[sourceFormat]}
                />
              </div>
              <div className={styles.previewColumn}>
                <h3 className={styles.previewTitle}>Target Format Preview</h3>
                <FormatPreview 
                  format={targetFormat} 
                  type="target"
                  isExpanded={targetFormat !== ""}
                  previewData={formatPreviews[targetFormat]}
                  isLoading={targetFormat && !previewsLoaded && !formatPreviews[targetFormat]}
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