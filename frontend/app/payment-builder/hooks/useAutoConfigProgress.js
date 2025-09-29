'use client';

import { useState, useEffect, useCallback } from 'react';
import backendClient from '@/lib/api/backendClient';

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

  // Process real backend response with generation_metadata
  const processConfigurationResult = useCallback((result) => {
    if (!result) return;

    // Extract real data from backend response
    const fields = result.fields_detected || 0;
    const fieldsMapped = result.fields_mapped || 0;
    const uncertainFields = result.uncertain_fields || [];
    const confidence = result.confidence || 0;
    const processingTime = result.generation_time_seconds || 0;
    const generationMetadata = result.generation_metadata || {};

    // Use REAL field details from backend (new in Phase 1)
    const detectedFields = (result.detected_fields_detail || []).map((field, i) => {
      const isUncertain = uncertainFields.some(uf =>
        uf.field === field.field_id || uf.field === `field_${i}`
      );

      return {
        code: field.field_id,
        name: field.name,
        type: 'auto',
        pattern: field.pattern,
        multiline: field.multiline,
        lane: isUncertain ? 'AI' : 'RULES',
        confidence: isUncertain
          ? (uncertainFields.find(uf => uf.field === field.field_id)?.confidence || 0) * 100
          : 95,
        mapped: i < fieldsMapped
      };
    });

    // If backend didn't provide details (backwards compatibility), fall back to count
    if (detectedFields.length === 0 && fields > 0) {
      for (let i = 0; i < fields; i++) {
        const isUncertain = uncertainFields.some(uf => uf.field === `field_${i}`);
        detectedFields.push({
          code: `Field ${i}`,
          name: `Field ${i}`,
          type: 'auto',
          lane: isUncertain ? 'AI' : 'RULES',
          confidence: isUncertain
            ? (uncertainFields.find(uf => uf.field === `field_${i}`)?.confidence || 0) * 100
            : 95,
          mapped: i < fieldsMapped
        });
      }
    }

    // Create pattern data from REAL semantic patterns used during generation
    const patterns = [];
    if (generationMetadata.semantic_patterns_used) {
      generationMetadata.semantic_patterns_used.forEach(pattern => {
        const fields = pattern.used_for_fields || [];
        fields.forEach(fieldId => {
          patterns.push({
            sourceField: fieldId,
            sourceValue: 'Auto-detected',
            patternName: pattern.concept_name,
            type: 'semantic',
            confidence: 85,
            targetField: pattern.concept_name,
            targetPath: pattern.concept_id,
            reason: `Learned from: ${(pattern.learned_from_formats || []).join(', ')}`,
            learnedFrom: pattern.learned_from_formats || [],
            semanticConcept: pattern.concept_name
          });
        });
      });
    }

    // Add uncertain fields as AI patterns if no semantic patterns
    if (patterns.length === 0 && uncertainFields.length > 0) {
      uncertainFields.forEach(field => {
        patterns.push({
          sourceField: field.field,
          sourceValue: 'Detected Value',
          patternName: field.suggested_mapping || 'unknown',
          type: 'ai_generated',
          confidence: Math.round((field.confidence || 0) * 100),
          targetField: field.suggested_mapping,
          targetPath: field.suggested_mapping,
          reason: field.reason
        });
      });
    }

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

    // MongoDB operations from REAL processing steps
    const mongoOps = [];
    let timeOffset = 0;

    if (generationMetadata.processing_steps) {
      generationMetadata.processing_steps.forEach((step, index) => {
        const stepIcons = {
          field_extraction_and_analysis: '🔍',
          base_configuration_lookup: '📚',
          parser_generation: '⚙️',
          mappings_generation: '🔗',
          confidence_calculation: '📊'
        };

        const stepMessages = {
          field_extraction_and_analysis: `Extracted ${step.result?.fields_found || 0} fields using ${step.result?.extraction_method || 'pattern matching'}`,
          base_configuration_lookup: `Loaded base config: ${step.result?.base_configuration_id || 'Unknown'}`,
          parser_generation: `Generated parser for ${step.result?.fields_generated || 0} fields`,
          mappings_generation: `Created ${step.result?.mappings_generated || 0} mappings using ${step.result?.semantic_patterns_used || 0} semantic patterns`,
          confidence_calculation: `Overall confidence: ${Math.round((step.result?.overall_confidence || 0) * 100)}%`
        };

        mongoOps.push({
          icon: stepIcons[step.step] || '📝',
          message: stepMessages[step.step] || `Completed ${step.step}`,
          timestamp: Date.now() + timeOffset,
          duration: step.duration_ms
        });

        timeOffset += (step.duration_ms || 500);
      });
    }

    // Add final save operation
    if (mongoOps.length > 0) {
      mongoOps.push({
        icon: '💾',
        message: result.ready_to_save ?
          'Configuration saved to pending_auto_configs' :
          'Configuration ready for review',
        timestamp: Date.now() + timeOffset,
        duration: 0
      });
    }

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
      // Call through centralized client instead of direct fetch
      const result = await backendClient.autoConfigureFormat(
        sourceFormat,
        targetFormat,
        sampleMessage,
        similarTo
      );

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