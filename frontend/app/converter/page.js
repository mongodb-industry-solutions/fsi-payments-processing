"use client";

import { useState, useEffect } from "react";
import FormatSelector from "@/components/converter/FormatSelector";
import FormatPreview from "@/components/converter/FormatPreview";
import FieldMappingTable from "@/components/converter/FieldMappingTable";
import ProcessingMetrics from "@/components/converter/ProcessingMetrics";
import MongoDBInsightsPanel from "@/components/converter/MongoDBInsightsPanel";
import AutoConfigPanel from "@/components/converter/AutoConfigPanel";
import HumanReviewPanel from "@/components/converter/HumanReviewPanel";
import LearningDashboard from "@/components/converter/LearningDashboard";
import Button from "@leafygreen-ui/button";
import Card from "@leafygreen-ui/card";
import { Tabs, Tab } from "@leafygreen-ui/tabs";
import { H1, Body } from "@leafygreen-ui/typography";
import Banner from "@leafygreen-ui/banner";
import Icon from "@leafygreen-ui/icon";
import Modal from "@leafygreen-ui/modal";
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
  const [loadingPreviews, setLoadingPreviews] = useState({});
  
  // Conversion states
  const [isLoading, setIsLoading] = useState(false);
  const [conversionResult, setConversionResult] = useState(null);
  const [selectedTab, setSelectedTab] = useState(0);
  
  // Modal state for advanced tools
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);
  
  // Feature flags from environment
  const enableAutoConfig = process.env.NEXT_PUBLIC_ENABLE_AUTO_CONFIG !== 'false';
  const enableHumanReview = process.env.NEXT_PUBLIC_ENABLE_HUMAN_REVIEW !== 'false';
  const enableLearning = process.env.NEXT_PUBLIC_ENABLE_LEARNING_DASHBOARD !== 'false';

  // Fetch formats on component mount
  useEffect(() => {
    fetchFormatsAndPreviews();
  }, []);
  
  // Fetch preview when format is selected
  useEffect(() => {
    if (sourceFormat && !formatPreviews[sourceFormat]) {
      fetchFormatPreview(sourceFormat, 'source');
    }
  }, [sourceFormat]);
  
  useEffect(() => {
    if (targetFormat && !formatPreviews[targetFormat]) {
      fetchFormatPreview(targetFormat, 'target');
    }
  }, [targetFormat]);

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
      
      // Fetch formats only (previews will load on-demand)
      const formatsResponse = await fetch('/api/formats');
      
      if (!formatsResponse.ok) {
        throw new Error('Failed to fetch formats');
      }
      
      const formatsData = await formatsResponse.json();
      
      // Transform data for dropdowns
      const sourceOptions = formatOptionsForDropdown(formatsData.source_formats);
      const targetOptions = formatOptionsForDropdown(formatsData.target_formats);
      
      setSourceFormats(sourceOptions);
      setTargetFormats(targetOptions);
      
      // Cache the data
      sessionStorage.setItem(cacheKey, JSON.stringify(formatsData));
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
    
    // Handle both string array and object array formats
    return formats.map(fmt => {
      if (typeof fmt === 'string') {
        // Backend returns simple strings, create label from format code
        const formatNames = {
          'MT103': 'Wire Transfer',
          'MT202': 'Bank to Bank',
          'MT192': 'Request for Transfer',
          'MT205': 'Financial Institution Transfer',
          'pacs.008': 'ISO 20022 Credit Transfer',
          'pacs.009': 'ISO 20022 FI Credit Transfer',
          'pacs.004': 'ISO 20022 Payment Return'
        };
        return {
          value: fmt,
          label: `${fmt} - ${formatNames[fmt] || fmt}`
        };
      } else {
        // Handle object format (for future compatibility)
        return {
          value: fmt.format_code || fmt,
          label: `${fmt.format_code || fmt} - ${fmt.format_name || ''}`
        };
      }
    });
  };

  const fetchFormatPreview = async (formatCode, formatType) => {
    // Don't fetch if already loading
    if (loadingPreviews[formatCode]) return;
    
    setLoadingPreviews(prev => ({ ...prev, [formatCode]: true }));
    
    try {
      const response = await fetch(`/api/formats/preview?format=${formatCode}&type=${formatType}`);
      if (response.ok) {
        const data = await response.json();
        setFormatPreviews(prev => ({ ...prev, [formatCode]: data }));
      }
    } catch (error) {
      console.error(`Failed to fetch preview for ${formatCode}:`, error);
    } finally {
      setLoadingPreviews(prev => ({ ...prev, [formatCode]: false }));
    }
  };
  
  const refreshFormats = () => {
    // Clear cache and re-fetch
    sessionStorage.removeItem('payment_formats_with_previews');
    sessionStorage.removeItem('payment_formats_with_previews_expiry');
    setFormatPreviews({});
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
        <div className={styles.headerCompact}>
          <h1 className={styles.titleCompact}>Payment Format Converter</h1>
          <p className={styles.subtitleCompact}>
            Convert between payment formats using MongoDB-driven rules
          </p>
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
              <h2>Convert Payment Formats</h2>
            
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
                  isLoading={loadingPreviews[sourceFormat] || false}
                />
              </div>
              <div className={styles.previewColumn}>
                <h3 className={styles.previewTitle}>Target Format Preview</h3>
                <FormatPreview 
                  format={targetFormat} 
                  type="target"
                  isExpanded={targetFormat !== ""}
                  previewData={formatPreviews[targetFormat]}
                  isLoading={loadingPreviews[targetFormat] || false}
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
              
              {(enableAutoConfig || enableLearning) && (
                <Button
                  onClick={() => setShowAdvancedModal(true)}
                  variant="default"
                  className={styles.configButton}
                >
                  <Icon glyph="Settings" size="small" />
                  Configure New Format
                </Button>
              )}
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
                        
                        {enableHumanReview && (
                          <Tab name="Human Review">
                            <div className={styles.tabContent}>
                              <HumanReviewPanel
                                conversionId={conversionResult.conversionId}
                                sourceFormat={conversionResult.sourceFormat}
                                targetFormat={conversionResult.targetFormat}
                              />
                            </div>
                          </Tab>
                        )}
                        
                        
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
                    
                    {/* Quick Actions */}
                    <div className={styles.actionButtons}>
                      <Button
                        onClick={() => setConversionResult(null)}
                        variant="default"
                        size="small"
                      >
                        Convert Another
                      </Button>
                      <Button
                        onClick={() => {
                          setSourceFormat("");
                          setTargetFormat("");
                          setConversionResult(null);
                        }}
                        variant="default"
                        size="small"
                      >
                        New Conversion
                      </Button>
                      {(enableAutoConfig || enableLearning) && (
                        <Button
                          onClick={() => setShowAdvancedModal(true)}
                          variant="default"
                          size="small"
                        >
                          Configure This Format
                        </Button>
                      )}
                    </div>
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
        
        {/* Advanced Tools Modal */}
        <Modal 
          open={showAdvancedModal} 
          setOpen={setShowAdvancedModal}
          className={styles.advancedModal}
        >
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <H1>Configure New Payment Format</H1>
              <Body>
                Use these tools to add support for new payment formats without code changes
              </Body>
            </div>
            
            <Tabs selected={0} aria-label="Configuration Tools">
              {enableAutoConfig && (
                <Tab name="Auto Configuration">
                  <div className={styles.modalTabContent}>
                    <AutoConfigPanel
                      sourceFormat={sourceFormat || ""}
                      targetFormat={targetFormat || ""}
                    />
                  </div>
                </Tab>
              )}
              
              {enableLearning && (
                <Tab name="Semantic Learning">
                  <div className={styles.modalTabContent}>
                    <LearningDashboard
                      sourceFormat={sourceFormat || ""}
                      targetFormat={targetFormat || ""}
                    />
                  </div>
                </Tab>
              )}
            </Tabs>
          </div>
        </Modal>
      </div>
    </LeafyGreenProvider>
  );
}