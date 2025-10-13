'use client';

import { useState, useCallback } from 'react';
import paymentBuilderService from '../../../services/paymentBuilderService';

export function useAutoConfigBuilder() {
  // Core state
  const [state, setState] = useState({
    // Input configuration
    input: {
      sourceFormat: '',
      targetFormat: '',
      sampleMessage: ''
    },

    // Generation state
    generation: {
      status: 'idle', // idle, generating, complete, error
      progress: 0,
      currentStep: '',
      steps: [],
      result: null,
      error: null
    },

    // Journey state
    journey: {
      activeTab: 'input',
      mappings: [],
      validation: null,
      output: null
    }
  });

  // Update input fields
  const updateInput = useCallback((field, value) => {
    setState(prev => ({
      ...prev,
      input: {
        ...prev.input,
        [field]: value
      }
    }));
  }, []);

  // Start configuration generation
  const startGeneration = useCallback(async () => {
    const startTime = Date.now();

    setState(prev => ({
      ...prev,
      generation: {
        ...prev.generation,
        status: 'generating',
        progress: 0,
        currentStep: 'Initializing generation engine...',
        error: null,
        startTime
      }
      // Keep user on current tab - loading shows in right panel
    }));

    try {
      // Simulate progress updates with more detailed steps
      const updateProgress = (progress, step) => {
        setState(prev => ({
          ...prev,
          generation: {
            ...prev.generation,
            progress,
            currentStep: step
          }
        }));
      };

      updateProgress(5, 'Initializing generation engine...');
      await new Promise(resolve => setTimeout(resolve, 300));

      updateProgress(15, 'Parsing sample message structure...');
      await new Promise(resolve => setTimeout(resolve, 400));

      updateProgress(25, 'Extracting field definitions...');
      await new Promise(resolve => setTimeout(resolve, 300));

      updateProgress(35, 'Loading semantic pattern database...');

      // Call the actual auto-configure API (similarTo will be auto-detected by backend)
      const result = await paymentBuilderService.autoConfigureFormat(
        state.input.sourceFormat,
        state.input.targetFormat,
        state.input.sampleMessage
      );

      // Extract pattern and LLM counts from result
      const patternCount = result.generation_metadata?.semantic_patterns_used?.length || 0;
      const llmCount = result.generation_details?.statistics?.llm_calls || 0;

      updateProgress(45, `Matching known patterns (${patternCount} patterns found)...`);
      await new Promise(resolve => setTimeout(resolve, 400));

      updateProgress(60, `Analyzing unknown fields with AI (${llmCount} LLM calls)...`);
      await new Promise(resolve => setTimeout(resolve, 500));

      updateProgress(75, 'Building field-to-field mappings...');
      await new Promise(resolve => setTimeout(resolve, 300));

      updateProgress(85, 'Calculating confidence scores...');
      await new Promise(resolve => setTimeout(resolve, 300));

      updateProgress(95, 'Validating configuration schema...');
      await new Promise(resolve => setTimeout(resolve, 200));

      // Process the result into journey data using REAL generation_metadata
      const metadata = result.generation_metadata || {};

      // Extract generation_details (NEW from include_details=true)
      const generationDetails = result.generation_details || {};

      // Helper function to calculate LLM cost (Note: tokens are estimates, not exact AWS counts)
      const calculateLLMCost = (totalTokens) => {
        if (!totalTokens) return 0;
        // Haiku pricing: $0.00025 per 1k input, $0.00125 per 1k output
        // Using average: $0.000687 per 1k tokens
        return ((totalTokens / 1000) * 0.000687).toFixed(4);
      };

      // Process LLM insights
      const aiInsights = {
        totalCalls: generationDetails.mapping_generation?.llm_calls || 0,
        totalTokens: generationDetails.statistics?.llm_total_tokens || 0,
        totalTime: generationDetails.statistics?.llm_total_time_ms || 0,
        estimatedCost: calculateLLMCost(generationDetails.statistics?.llm_total_tokens || 0),
        llmCalls: [],
        patternMatches: [],
        statistics: generationDetails.statistics || {}
      };

      // Extract LLM call details (with null safety wrapper)
      if (generationDetails?.mapping_generation?.details) {
        generationDetails.mapping_generation.details.forEach(detail => {
          if (detail.mapping_method === 'llm_suggestion' && detail.llm_details) {
            aiInsights.llmCalls.push({
              fieldId: detail.field_id,
              targets: detail.targets,
              confidence: detail.confidence,
              prompt: detail.llm_details.prompt,
              response: detail.llm_details.parsed_response,
              reasoning: detail.llm_details.parsed_response?.reasoning,
              tokens: {
                prompt: detail.llm_details.prompt_tokens || 0,
                response: detail.llm_details.response_tokens || 0,
                total: (detail.llm_details.prompt_tokens || 0) + (detail.llm_details.response_tokens || 0)
              },
              time: detail.llm_details.call_time_ms,
              model: detail.llm_details.model_used
            });
          } else if (detail.mapping_method === 'pattern_match') {
            aiInsights.patternMatches.push({
              fieldId: detail.field_id,
              patternsTried: detail.patterns_tried || [],  // Note: Only pattern matches have this
              targets: detail.targets,
              confidence: detail.confidence,
              time: detail.processing_time_ms
            });
          }
        });
      }

      // Build steps from REAL processing steps
      const steps = [];
      if (metadata.processing_steps && metadata.processing_steps.length > 0) {
        const stepIcons = {
          field_extraction_and_analysis: '🔍',
          base_configuration_lookup: '📚',
          parser_generation: '⚙️',
          mappings_generation: '🔗',
          confidence_calculation: '📊'
        };

        const stepTitles = {
          field_extraction_and_analysis: 'Field Extraction & Analysis',
          base_configuration_lookup: 'Base Configuration Lookup',
          parser_generation: 'Parser Generation',
          mappings_generation: 'Mappings Generation',
          confidence_calculation: 'Confidence Calculation'
        };

        // Check for pattern optimization in first step
        const firstStep = metadata.processing_steps[0];
        const patternOptimization = firstStep?.result?.pattern_optimization;

        // Add pattern optimization step if available
        if (patternOptimization) {
          steps.push({
            icon: '🎯',
            title: 'Pattern Matching Optimization',
            duration: '0.1s',
            description: `Matched ${patternOptimization.fields_from_patterns} of ${patternOptimization.total_fields} fields using patterns`,
            result: {
              ...patternOptimization,
              savings: `${Math.round(patternOptimization.cost_reduction_percent)}% LLM reduction`,
              llm_saved: patternOptimization.llm_calls_saved,
              known_fields: patternOptimization.field_breakdown?.from_patterns || [],
              unknown_fields: patternOptimization.field_breakdown?.need_llm || []
            }
          });
        }

        metadata.processing_steps.forEach(step => {
          const durationSec = ((step.duration_ms || 0) / 1000).toFixed(2);

          // Enhanced description for field extraction step
          let description = 'Processing step completed';
          if (step.step === 'field_extraction_and_analysis' && step.result?.pattern_optimization) {
            const opt = step.result.pattern_optimization;
            description = `Found ${step.result.fields_found} fields (${opt.fields_from_patterns} from patterns, ${opt.fields_from_llm} from LLM)`;
          } else if (step.result?.fields_found !== undefined) {
            description = `Found ${step.result.fields_found} fields using ${step.result.extraction_method}`;
          } else if (step.result?.base_configuration_id) {
            description = `Using ${step.result.base_configuration_id}`;
          } else if (step.result?.mappings_generated !== undefined) {
            description = `Generated ${step.result.mappings_generated} mappings with ${step.result.semantic_patterns_used || 0} patterns`;
          } else if (step.result?.overall_confidence !== undefined) {
            description = `Overall confidence: ${Math.round((step.result.overall_confidence || 0) * 100)}%`;
          }

          steps.push({
            icon: stepIcons[step.step] || '📝',
            title: stepTitles[step.step] || step.step,
            duration: `${durationSec}s`,
            description: description,
            result: step.result || {}
          });
        });

        // Add summary step with detailed results
        const unmappedCount = result.unmapped_fields?.length || 0;
        const mappedCount = (result.fields_detected || 0) - unmappedCount;

        steps.push({
          icon: '✓',
          title: 'Configuration Complete',
          duration: `${((metadata.total_duration_ms || 0) / 1000).toFixed(2)}s total`,
          description: `Generated complete configuration with ${result.fields_detected || 0} fields`,
          result: {
            configuration_id: result.configuration_id,
            total_fields: result.fields_detected || 0,
            mapped_fields: mappedCount,
            unmapped_fields: unmappedCount,
            overall_confidence: result.confidence || 0,
            generation_time: result.generation_time_seconds || 0,
            semantic_patterns_count: metadata.semantic_patterns_used?.length || 0,
            status: result.status || 'completed',
            requires_review: (result.uncertain_fields?.length || 0) > 0,
            uncertain_fields_count: result.uncertain_fields?.length || 0
          }
        });
      }

      // Build mappings from REAL configuration data
      const mappings = [];

      // Get pattern optimization data to identify method
      const patternOpt = metadata.processing_steps?.[0]?.result?.pattern_optimization;
      const patternFields = patternOpt?.field_breakdown?.from_patterns || [];
      const llmFields = patternOpt?.field_breakdown?.need_llm || [];

      if (result.configuration && result.configuration.mappings) {
        result.configuration.mappings.forEach(mapping => {
          const lane = mapping.processing_lane || 'RULES';
          const confidence = mapping.confidence ? Math.round(mapping.confidence * 100) : 95;

          // Determine if field was pattern-matched or LLM-analyzed
          const fieldBase = mapping.source.split('.')[0];
          let matchMethod = 'unknown';
          let methodIcon = '📝';

          if (patternFields.includes(fieldBase)) {
            matchMethod = 'Pattern Match';
            methodIcon = '🎯';
          } else if (llmFields.includes(fieldBase)) {
            matchMethod = 'LLM Analysis';
            methodIcon = '🤖';
          }

          // Find semantic concept from metadata
          let semanticConcept = null;
          let learnedFrom = [];
          if (metadata.semantic_patterns_used) {
            const pattern = metadata.semantic_patterns_used.find(p =>
              p.used_for_fields && p.used_for_fields.includes(fieldBase)
            );
            if (pattern) {
              semanticConcept = pattern.concept_name;
              learnedFrom = pattern.learned_from_formats || [];
            }
          }

          mappings.push({
            source: mapping.source,
            target: (mapping.targets || []).join(', '),
            lane: lane,
            confidence: confidence,
            semanticConcept: semanticConcept,
            learnedFrom: learnedFrom,
            reason: semanticConcept
              ? `Learned from: ${learnedFrom.join(', ')}`
              : 'Direct mapping',
            method: matchMethod,
            icon: methodIcon
          });
        });
      }

      updateProgress(90, 'Finalizing configuration...');

      updateProgress(100, 'Complete!');

      setState(prev => ({
        ...prev,
        generation: {
          ...prev.generation,
          status: 'complete',
          progress: 100,
          currentStep: 'Configuration generated successfully',
          steps,
          result: {
            ...result,
            aiInsights  // Add processed insights for easy access
          }
        },
        journey: {
          ...prev.journey,
          mappings,
          output: result.configuration || result
        }
      }));
    } catch (error) {
      console.error('Generation failed:', error);

      setState(prev => ({
        ...prev,
        generation: {
          ...prev.generation,
          status: 'error',
          progress: 0,
          currentStep: '',
          error: error.message || 'Generation failed'
        }
      }));
    }
  }, [state.input]);

  // Update mapping
  const updateMapping = useCallback((index, field, value) => {
    setState(prev => ({
      ...prev,
      journey: {
        ...prev.journey,
        mappings: prev.journey.mappings.map((m, i) =>
          i === index ? { ...m, [field]: value } : m
        )
      }
    }));
  }, []);

  // Run validation
  const runValidation = useCallback(async () => {
    console.log('useAutoConfigBuilder - runValidation called');

    // Set loading state
    setState(prev => ({
      ...prev,
      journey: {
        ...prev.journey,
        validation: {
          loading: true,
          score: 0,
          checks: []
        }
      }
    }));

    try {
      // Call backend validation endpoint with actual config
      console.log('useAutoConfigBuilder - Calling validateConfigSchema...');
      const validationResult = await paymentBuilderService.validateConfigSchema(
        state.journey.output
      );

      console.log('useAutoConfigBuilder - Backend validation result:', validationResult);
      console.log('useAutoConfigBuilder - Result has valid flag:', validationResult?.valid);

      // Update state with real validation results
      setState(prev => ({
        ...prev,
        journey: {
          ...prev.journey,
          validation: {
            ...validationResult,
            loading: false
          }
        }
      }));

      console.log('useAutoConfigBuilder - State updated with validation result');
    } catch (error) {
      console.error('useAutoConfigBuilder - Validation failed:', error);

      // Show error state
      setState(prev => ({
        ...prev,
        journey: {
          ...prev.journey,
          validation: {
            loading: false,
            valid: false,
            score: 0,
            checks: [{
              name: 'Validation Error',
              status: 'failed',
              details: error.message || 'Failed to validate configuration',
              icon: '❌',
              errors: []
            }],
            errors: [],
            warnings: []
          }
        }
      }));
    }
  }, [state.journey.output]);

  // Save validated configuration
  const saveValidatedConfig = useCallback(async (force = false, sessionId = null) => {
    console.log('useAutoConfigBuilder.saveValidatedConfig called with:', {
      force,
      sessionId,
      sessionIdType: typeof sessionId
    });

    setState(prev => ({
      ...prev,
      journey: {
        ...prev.journey,
        saving: true,
        saveError: null
      }
    }));

    try {
      const result = await paymentBuilderService.saveValidatedConfig(
        state.journey.output,
        force,
        sessionId
      );

      if (result.success) {
        setState(prev => ({
          ...prev,
          journey: {
            ...prev.journey,
            saving: false,
            saved: true,
            saveResult: result
          }
        }));

        console.log('Configuration saved successfully:', result);
        return result;
      } else {
        throw new Error(result.message || 'Save failed');
      }
    } catch (error) {
      console.error('Save failed:', error);

      setState(prev => ({
        ...prev,
        journey: {
          ...prev.journey,
          saving: false,
          saveError: error.message
        }
      }));
      throw error;
    }
  }, [state.journey.output]);

  // Fix validation error by updating field
  const fixValidationError = useCallback(async (fieldPath, newValue) => {
    try {
      const configId = state.journey.output?._id;
      if (!configId) {
        throw new Error('Configuration ID not found');
      }

      // Update field via API
      const result = await paymentBuilderService.updateConfigField(
        configId,
        fieldPath,
        newValue
      );

      // Update local state with new config and validation
      setState(prev => ({
        ...prev,
        journey: {
          ...prev.journey,
          output: result.updated_configuration,
          validation: result.validation
        }
      }));

      console.log('Field updated successfully:', fieldPath);
    } catch (error) {
      console.error('Failed to fix validation error:', error);
    }
  }, [state.journey.output]);

  // Set active tab
  const setActiveTab = useCallback((tab) => {
    setState(prev => ({
      ...prev,
      journey: {
        ...prev.journey,
        activeTab: tab
      }
    }));
  }, []);

  return {
    state,
    updateInput,
    startGeneration,
    updateMapping,
    runValidation,
    saveValidatedConfig,
    fixValidationError,
    setActiveTab
  };
}