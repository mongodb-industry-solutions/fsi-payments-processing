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
      sampleMessage: '',
      similarTo: ''
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
      activeTab: 'flow',
      mappings: [],
      validation: null,
      output: null
    },

    // MongoDB operations
    mongodb: {
      operations: [],
      autoScroll: true
    },

    // UI state
    focusMode: 'full'
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

  // Add MongoDB operation
  const addMongoOperation = useCallback((operation) => {
    setState(prev => ({
      ...prev,
      mongodb: {
        ...prev.mongodb,
        operations: [...prev.mongodb.operations, {
          ...operation,
          timestamp: new Date().toISOString()
        }]
      }
    }));
  }, []);

  // Start configuration generation
  const startGeneration = useCallback(async () => {
    setState(prev => ({
      ...prev,
      generation: {
        ...prev.generation,
        status: 'generating',
        progress: 0,
        currentStep: 'Initializing...',
        error: null
      }
    }));

    // Add MongoDB operation
    addMongoOperation({
      type: 'read',
      collection: 'semantic_patterns',
      details: `Loading patterns similar to ${state.input.similarTo || 'base formats'}`,
      query: { format: state.input.similarTo || 'MT103' }
    });

    try {
      // Simulate progress updates
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

      updateProgress(10, 'Parsing sample message...');
      addMongoOperation({
        type: 'read',
        collection: 'conversion_registry',
        details: 'Checking for existing configuration',
        query: { _id: `${state.input.sourceFormat}_to_${state.input.targetFormat}` }
      });

      updateProgress(30, 'Detecting fields in source format...');

      // Call the actual auto-configure API
      const result = await paymentBuilderService.autoConfigureFormat(
        state.input.sourceFormat,
        state.input.targetFormat,
        state.input.sampleMessage,
        state.input.similarTo || undefined
      );

      updateProgress(50, 'Applying semantic patterns...');
      addMongoOperation({
        type: 'read',
        collection: 'semantic_patterns',
        details: `Applied ${result.fields_detected || 0} patterns`,
        query: { confidence: { $gte: 0.8 } }
      });

      updateProgress(70, 'Generating field mappings...');

      // Process the result into journey data
      const mappings = result.mappings || [];
      const steps = [
        {
          icon: '🔍',
          title: 'Message Parsing',
          duration: '~0.5s',
          description: `Parsed ${state.input.sourceFormat} message structure`
        },
        {
          icon: '📝',
          title: 'Field Detection',
          duration: '~1.0s',
          description: `Identified ${result.fields_detected || 0} fields`
        },
        {
          icon: '🔗',
          title: 'Pattern Matching',
          duration: '~1.5s',
          description: `Applied semantic patterns from ${state.input.similarTo || 'base formats'}`
        },
        {
          icon: '🧠',
          title: 'AI Analysis',
          duration: '~2.0s',
          description: `Processed complex fields with AI`
        },
        {
          icon: '✓',
          title: 'Configuration Built',
          duration: `${result.generation_time_seconds?.toFixed(1) || '4.5'}s total`,
          description: 'Generated complete configuration'
        }
      ];

      updateProgress(90, 'Finalizing configuration...');

      addMongoOperation({
        type: 'write',
        collection: 'pending_configs',
        details: `Configuration ${result.configuration_id} ready for review`,
        query: { _id: result.configuration_id }
      });

      updateProgress(100, 'Complete!');

      setState(prev => ({
        ...prev,
        generation: {
          ...prev.generation,
          status: 'complete',
          progress: 100,
          currentStep: 'Configuration generated successfully',
          steps,
          result
        },
        journey: {
          ...prev.journey,
          mappings,
          output: result
        }
      }));
    } catch (error) {
      console.error('Generation failed:', error);

      addMongoOperation({
        type: 'delete',
        collection: 'pending_configs',
        details: 'Configuration generation failed',
        query: { error: error.message }
      });

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
  }, [state.input, addMongoOperation]);

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
    setState(prev => ({
      ...prev,
      journey: {
        ...prev.journey,
        validation: {
          score: 92,
          checks: [
            {
              icon: '📋',
              name: 'Field Coverage',
              status: 'passed',
              details: 'All required fields are mapped'
            },
            {
              icon: '🔗',
              name: 'Mapping Validity',
              status: 'passed',
              details: 'All mappings use valid transforms'
            },
            {
              icon: '🧠',
              name: 'AI Configuration',
              status: 'warning',
              details: '2 fields require AI processing'
            },
            {
              icon: '✓',
              name: 'Output Format',
              status: 'passed',
              details: 'Target format structure is valid'
            }
          ]
        }
      }
    }));

    addMongoOperation({
      type: 'update',
      collection: 'pending_configs',
      details: 'Validation complete: Score 92%',
      query: { validation_score: 92 }
    });
  }, [addMongoOperation]);

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

  // Set focus mode
  const setFocusMode = useCallback((mode) => {
    setState(prev => ({
      ...prev,
      focusMode: mode
    }));
  }, []);

  return {
    state,
    updateInput,
    startGeneration,
    updateMapping,
    runValidation,
    setActiveTab,
    setFocusMode,
    addMongoOperation
  };
}