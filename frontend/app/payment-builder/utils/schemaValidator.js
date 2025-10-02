/**
 * Client-side schema validation using AJV
 * Provides instant validation feedback without server round-trip
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import conversionRegistrySchema from '../schemas/conversion_registry_schema.json';

// Create and configure AJV instance
const ajv = new Ajv({
  allErrors: true,
  verbose: true,
  strict: false, // Be less strict for frontend validation
});

// Add format validators (for date-time, etc.)
addFormats(ajv);

// Compile the schema
const validate = ajv.compile(conversionRegistrySchema);

/**
 * Convert datetime objects to strings for validation
 * (Mirrors backend behavior)
 */
function convertDatetimes(obj) {
  if (obj instanceof Date) {
    return obj.toISOString();
  } else if (typeof obj === 'object' && obj !== null) {
    if (Array.isArray(obj)) {
      return obj.map(convertDatetimes);
    } else {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = convertDatetimes(value);
      }
      return result;
    }
  }
  return obj;
}

/**
 * Categorize validation errors by type
 */
function categorizeErrors(errors) {
  const categories = {
    required_fields: [],
    parser: [],
    mappings: [],
    ai_service: [],
    builder: [],
    human_review: [],
    metadata: [],
    other: []
  };

  errors.forEach(error => {
    const path = error.instancePath.split('/').filter(Boolean);

    if (error.keyword === 'required') {
      categories.required_fields.push(error);
    } else if (path.length > 0) {
      const rootField = path[0];
      if (categories[rootField]) {
        categories[rootField].push(error);
      } else {
        categories.other.push(error);
      }
    } else {
      categories.other.push(error);
    }
  });

  return categories;
}

/**
 * Format error for frontend display
 */
function formatError(error) {
  const path = error.instancePath || 'root';
  const severity = error.keyword === 'required' || error.keyword === 'type' ? 'error' : 'warning';

  let message = error.message || 'Validation error';
  let suggestion = null;

  if (error.keyword === 'required') {
    const missingField = error.params?.missingProperty;
    suggestion = missingField ? `Add required field: ${missingField}` : 'Add missing required fields';
  } else if (error.keyword === 'enum') {
    const allowedValues = error.params?.allowedValues;
    suggestion = allowedValues ? `Valid values: ${allowedValues.join(', ')}` : null;
  } else if (error.keyword === 'pattern') {
    suggestion = `Must match pattern: ${error.params?.pattern}`;
  } else if (error.keyword === 'type') {
    suggestion = `Expected type: ${error.params?.type}`;
  }

  return {
    field: path,
    message,
    severity,
    suggestion,
    validator: error.keyword
  };
}

/**
 * Build validation checks for frontend display
 */
function buildChecks(config, categorizedErrors, errors) {
  const checks = [];

  // Required Fields Check
  const requiredErrors = categorizedErrors.required_fields;
  checks.push({
    check: 'Required Fields',
    status: requiredErrors.length > 0 ? 'failed' : 'passed',
    details: requiredErrors.length > 0
      ? `Missing ${requiredErrors.length} required field(s)`
      : 'All required fields are present',
    icon: '📋',
    errors: requiredErrors.map(formatError),
    is_valid: requiredErrors.length === 0
  });

  // Parser Configuration Check
  const parserErrors = categorizedErrors.parser;
  const parserPresent = config.parser !== undefined;
  checks.push({
    check: 'Parser Configuration',
    status: parserErrors.length > 0 || !parserPresent ? 'failed' : 'passed',
    details: parserErrors.length > 0
      ? `Found ${parserErrors.length} issue(s) in parser`
      : (!parserPresent ? 'Parser is missing' : `Parser is valid with ${Object.keys(config.parser?.fields || {}).length} field(s)`),
    icon: '⚙️',
    errors: parserErrors.map(formatError),
    is_valid: parserErrors.length === 0 && parserPresent
  });

  // Mapping Structure Check
  const mappingErrors = categorizedErrors.mappings;
  const mappingsPresent = config.mappings !== undefined;
  const mappingCount = config.mappings?.length || 0;
  checks.push({
    check: 'Mapping Structure',
    status: mappingErrors.length > 0 || !mappingsPresent ? 'failed' : 'passed',
    details: mappingErrors.length > 0
      ? `Found ${mappingErrors.length} issue(s) in ${mappingCount} mapping(s)`
      : (!mappingsPresent ? 'Mappings are missing' : `All ${mappingCount} mappings are valid`),
    icon: '🔗',
    errors: mappingErrors.map(formatError),
    is_valid: mappingErrors.length === 0 && mappingsPresent
  });

  // AI Configuration Check
  const aiErrors = categorizedErrors.ai_service;
  const aiPresent = config.ai_service !== undefined;
  const hasAiMappings = config.mappings?.some(m => m.processing_lane === 'AI') || false;

  let aiStatus = 'passed';
  let aiDetails = 'AI service is properly configured';

  if (aiErrors.length > 0) {
    aiStatus = 'failed';
    aiDetails = `Found ${aiErrors.length} issue(s) in AI config`;
  } else if (hasAiMappings && !aiPresent) {
    aiStatus = 'warning';
    aiDetails = 'AI service missing but AI mappings present';
  } else if (!aiPresent) {
    aiDetails = 'AI service not configured (not required)';
  }

  checks.push({
    check: 'AI Configuration',
    status: aiStatus,
    details: aiDetails,
    icon: '🧠',
    errors: aiErrors.map(formatError),
    is_valid: aiStatus !== 'failed'
  });

  // Builder Template Check
  const builderErrors = categorizedErrors.builder;
  const builderPresent = config.builder !== undefined;
  checks.push({
    check: 'Builder Template',
    status: builderErrors.length > 0 || !builderPresent ? 'failed' : 'passed',
    details: builderErrors.length > 0
      ? `Found ${builderErrors.length} issue(s) in builder`
      : (!builderPresent ? 'Builder is missing' : 'Builder configuration is valid'),
    icon: '🏗️',
    errors: builderErrors.map(formatError),
    is_valid: builderErrors.length === 0 && builderPresent
  });

  // Human Review Settings Check
  const hrErrors = categorizedErrors.human_review;
  const hrPresent = config.human_review !== undefined;
  checks.push({
    check: 'Human Review Settings',
    status: hrErrors.length > 0 ? 'warning' : (hrPresent ? 'passed' : 'warning'),
    details: hrErrors.length > 0
      ? `Found ${hrErrors.length} issue(s) in human review config`
      : (!hrPresent ? 'Human review not configured' : 'Human review is properly configured'),
    icon: '👤',
    errors: hrErrors.map(formatError),
    is_valid: hrErrors.length === 0
  });

  return checks;
}

/**
 * Calculate validation score
 */
function calculateScore(errors) {
  if (!errors || errors.length === 0) {
    return 100;
  }

  let score = 100;

  errors.forEach(error => {
    if (error.keyword === 'required') {
      score -= 15;
    } else if (error.keyword === 'type') {
      score -= 10;
    } else if (['pattern', 'format', 'enum'].includes(error.keyword)) {
      score -= 5;
    } else {
      score -= 3;
    }
  });

  return Math.max(0, score);
}

/**
 * Validate a configuration against the schema
 * Returns frontend-compatible format
 */
export function validateConfiguration(configuration) {
  // Convert datetime objects to strings
  const configCopy = convertDatetimes(configuration);

  // Validate
  const isValid = validate(configCopy);
  const errors = validate.errors || [];

  // Categorize errors
  const categorizedErrors = categorizeErrors(errors);

  // Build checks
  const checks = buildChecks(configCopy, categorizedErrors, errors);

  // Calculate score
  const score = calculateScore(errors);

  // Build frontend-compatible result
  const result = {
    valid: isValid,
    score,
    details: checks,
    summary: {
      total_checks: checks.length,
      passed: checks.filter(c => c.status === 'passed').length,
      warnings: checks.filter(c => c.status === 'warning').length,
      failed: checks.filter(c => c.status === 'failed').length,
      error_count: errors.length
    }
  };

  // Add raw errors for debugging
  if (process.env.NODE_ENV === 'development') {
    result.raw_errors = errors;
  }

  return result;
}

/**
 * Validate a single field
 */
export function validateField(fieldValue, fieldSchema) {
  const fieldValidate = ajv.compile(fieldSchema);
  const isValid = fieldValidate(fieldValue);

  return {
    valid: isValid,
    errors: fieldValidate.errors ? fieldValidate.errors.map(formatError) : []
  };
}

/**
 * Get suggested fixes for common errors
 */
export function getSuggestedFixes(configuration, errors) {
  const suggestions = [];

  errors.forEach(error => {
    if (error.keyword === 'required') {
      const missingField = error.params?.missingProperty;

      if (missingField === 'ai_service') {
        suggestions.push({
          field: missingField,
          action: 'add',
          value: { field_types: {} },
          description: 'Add AI service configuration'
        });
      } else if (missingField === 'human_review') {
        suggestions.push({
          field: missingField,
          action: 'add',
          value: {
            enabled: true,
            default_threshold: 0.8,
            field_thresholds: {}
          },
          description: 'Add human review configuration'
        });
      }
    }
  });

  return suggestions;
}

// Export for use in components
export default {
  validateConfiguration,
  validateField,
  getSuggestedFixes
};