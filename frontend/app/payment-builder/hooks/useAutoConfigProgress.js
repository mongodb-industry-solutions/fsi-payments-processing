'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to manage auto-configuration progress with real backend data
 */
export function useAutoConfigProgress() {
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [configResult, setConfigResult] = useState(null);
  const [progress, setProgress] = useState({
    stage: 'idle', // idle, parsing, detecting, matching, analyzing, building, complete
    fieldsDetected: [],
    patterns: [],
    confidence: {},
    mongoOperations: [],
    elapsedTime: 0,
    error: null
  });

  // Simulate progressive updates based on backend response
  const processConfigurationResult = useCallback((result) => {
    if (!result) return;

    // Extract real data from backend response
    const fields = result.fields_detected || 0;
    const fieldsMapped = result.fields_mapped || 0;
    const uncertainFields = result.uncertain_fields || [];
    const confidence = result.confidence || 0;
    const processingTime = result.generation_time_seconds || 0;

    // Create field detection data from result
    const detectedFields = [];
    for (let i = 0; i < fields; i++) {
      const isUncertain = uncertainFields.some(uf => uf.field === `field_${i}`);
      detectedFields.push({
        code: `Field ${i}`,
        name: `Field ${i}`,
        type: 'auto',
        lane: isUncertain ? 'AI' : 'RULES',
        confidence: isUncertain ?
          uncertainFields.find(uf => uf.field === `field_${i}`)?.confidence || 0 :
          95,
        mapped: i < fieldsMapped
      });
    }

    // Create pattern data from uncertain fields
    const patterns = uncertainFields.map(field => ({
      sourceField: field.field,
      sourceValue: 'Detected Value',
      patternName: field.suggested_mapping || 'unknown',
      type: field.confidence > 0.8 ? 'semantic' : 'ai_generated',
      confidence: Math.round((field.confidence || 0) * 100),
      targetField: field.suggested_mapping,
      targetPath: field.suggested_mapping,
      reason: field.reason
    }));

    // Calculate confidence scores
    const confidenceScores = {
      fieldDetection: Math.round((fields / Math.max(fields, 1)) * 100),
      patternMatching: Math.round((fieldsMapped / Math.max(fields, 1)) * 100),
      aiAnalysis: Math.round(
        uncertainFields.reduce((acc, f) => acc + (f.confidence || 0), 0) /
        Math.max(uncertainFields.length, 1) * 100
      ),
      overall: Math.round(confidence * 100)
    };

    // MongoDB operations based on processing
    const mongoOps = [
      {
        icon: '📝',
        message: `Loaded semantic patterns from ${result.configuration_id?.split('_')[0] || 'MT103'}`,
        timestamp: Date.now()
      },
      {
        icon: '🔍',
        message: `Queried conversion_registry for ${result.configuration_id}`,
        timestamp: Date.now() + 1000
      },
      {
        icon: '🧠',
        message: `Applied ${patterns.length} AI-generated mappings`,
        timestamp: Date.now() + 2000
      },
      {
        icon: '💾',
        message: result.ready_to_save ?
          'Configuration saved to MongoDB' :
          'Configuration pending review',
        timestamp: Date.now() + 3000
      }
    ];

    return {
      detectedFields,
      patterns,
      confidenceScores,
      mongoOperations: mongoOps,
      processingTime
    };
  }, []);

  // Simulate progressive stages
  const simulateProgress = useCallback((result) => {
    const processedData = processConfigurationResult(result);
    if (!processedData) return;

    const stages = [
      { stage: 'parsing', delay: 500, data: { fieldsDetected: [] } },
      {
        stage: 'detecting',
        delay: 1000,
        data: {
          fieldsDetected: processedData.detectedFields.slice(0, Math.ceil(processedData.detectedFields.length / 2))
        }
      },
      {
        stage: 'detecting',
        delay: 1500,
        data: {
          fieldsDetected: processedData.detectedFields
        }
      },
      {
        stage: 'matching',
        delay: 2000,
        data: {
          patterns: processedData.patterns.slice(0, Math.ceil(processedData.patterns.length / 2))
        }
      },
      {
        stage: 'matching',
        delay: 2500,
        data: {
          patterns: processedData.patterns
        }
      },
      {
        stage: 'analyzing',
        delay: 3000,
        data: {
          confidence: processedData.confidenceScores,
          mongoOperations: processedData.mongoOperations.slice(0, 2)
        }
      },
      {
        stage: 'building',
        delay: 3500,
        data: {
          mongoOperations: processedData.mongoOperations
        }
      },
      {
        stage: 'complete',
        delay: 4000,
        data: {}
      }
    ];

    // Clear any existing timers
    const timers = [];

    stages.forEach(({ stage, delay, data }) => {
      const timer = setTimeout(() => {
        setProgress(prev => ({
          ...prev,
          stage,
          ...data,
          elapsedTime: delay / 1000
        }));
      }, delay);
      timers.push(timer);
    });

    // Cleanup function
    return () => timers.forEach(clearTimeout);
  }, [processConfigurationResult]);

  // Start configuration with real backend call
  const startConfiguration = useCallback(async (sourceFormat, targetFormat, sampleMessage, similarTo) => {
    setIsConfiguring(true);
    setProgress({
      stage: 'parsing',
      fieldsDetected: [],
      patterns: [],
      confidence: {},
      mongoOperations: [],
      elapsedTime: 0,
      error: null
    });

    try {
      // Call real backend
      const response = await fetch('http://localhost:8001/api/v1/converter/auto-configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_format: sourceFormat,
          target_format: targetFormat,
          sample_message: sampleMessage,
          similar_to: similarTo
        })
      });

      if (!response.ok) {
        let errorMessage = `Auto-configuration failed: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch (e) {
          // If response isn't JSON, keep the default message
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      setConfigResult(result);

      // Simulate progressive updates with real data
      const cleanup = simulateProgress(result);

      // Mark complete after animations
      setTimeout(() => {
        setIsConfiguring(false);
      }, 4500);

      return { result, cleanup };
    } catch (error) {
      console.error('Auto-configuration error:', error);
      setProgress(prev => ({ ...prev, error: error.message, stage: 'error' }));
      setIsConfiguring(false);
      throw error;
    }
  }, [simulateProgress]);

  // Reset state
  const reset = useCallback(() => {
    setIsConfiguring(false);
    setConfigResult(null);
    setProgress({
      stage: 'idle',
      fieldsDetected: [],
      patterns: [],
      confidence: {},
      mongoOperations: [],
      elapsedTime: 0,
      error: null
    });
  }, []);

  return {
    isConfiguring,
    configResult,
    progress,
    startConfiguration,
    reset
  };
}