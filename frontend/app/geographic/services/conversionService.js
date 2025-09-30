/**
 * Conversion Service for Geographic Visualizer
 * Handles real API calls to backend converter service
 */

const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8001';

/**
 * Convert a payment message from one format to another
 * @param {string} sourceFormat - Source format (e.g., 'MT103', 'JSON')
 * @param {string} targetFormat - Target format (e.g., 'JSON', 'CHAPS')
 * @param {string} message - The message to convert
 * @param {boolean} useRouter - Whether to use backend router for multi-hop conversions (default: true)
 * @returns {Promise<Object>} Conversion result with output and statistics
 */
export async function convertPayment(sourceFormat, targetFormat, message, useRouter = true) {
  console.log('convertPayment called:', {
    sourceFormat,
    targetFormat,
    messageLength: message ? message.length : 0,
    messageType: typeof message,
    useRouter,
    messageSample: message ? message.substring(0, 100) : null
  });

  try {
    console.log('Making API request:', {
      url: `${BACKEND_API_URL}/api/v1/converter/convert`,
      sourceFormat,
      targetFormat,
      messageLength: message ? message.length : 0,
      useRouter
    });

    const response = await fetch(`${BACKEND_API_URL}/api/v1/converter/convert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_format: sourceFormat,
        target_format: targetFormat,
        message: message,
        save_result: false,
        use_router: useRouter
      }),
    });

    console.log('Response status:', response.status, response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Conversion failed: ${errorText}`);
    }

    const result = await response.json();

    console.log('API Response:', {
      success: result.success,
      hasConvertedMessage: !!result.converted_message,
      error: result.error,
      sourceFormat,
      targetFormat,
      resultKeys: Object.keys(result)
    });

    // Check if the API returned an error
    if (!result.success) {
      console.error('API returned error:', {
        error: result.error,
        sourceFormat,
        targetFormat
      });

      return {
        success: false,
        error: result.error || 'Conversion failed',
        convertedMessage: null,
        processingStats: {},
        confidenceScores: {},
        processingTime: 0,
        metadata: result.metadata || {},
        humanReviewRequired: false
      };
    }

    // Transform processing_stats to the expected format
    const processingStats = {};
    if (result.processing_stats) {
      processingStats.rules_lane = result.processing_stats.rules_lane?.count || 0;
      processingStats.ai_lane = result.processing_stats.ai_lane?.count || 0;
      processingStats.human_lane = result.processing_stats.human_lane?.count || 0;
    }

    return {
      success: result.success !== false,  // Use API's success value
      convertedMessage: result.converted_message,
      processingStats: processingStats,
      confidenceScores: result.confidence_scores || {},
      processingTime: result.processing_time_seconds || 0,
      metadata: result.metadata || {},
      routing: result.metadata?.routing || null,
      humanReviewRequired: result.human_review_required || false
    };
  } catch (error) {
    console.error('Conversion error details:', {
      message: error.message,
      sourceFormat,
      targetFormat,
      messageLength: message ? message.length : 0,
      error
    });

    // Return a fallback result for demo purposes
    return {
      success: false,
      error: error.message,
      convertedMessage: null,
      processingStats: {},
      confidenceScores: {},
      processingTime: 0,
      metadata: {},
      humanReviewRequired: false
    };
  }
}

/**
 * Perform a two-step conversion (e.g., MT103 → JSON → CHAPS)
 * Uses the backend router to automatically find the conversion path
 * @param {string} sourceFormat - Initial source format
 * @param {string} intermediateFormat - Intermediate format (usually JSON)
 * @param {string} targetFormat - Final target format
 * @param {string} message - The message to convert
 * @returns {Promise<Object>} Results from the conversion with routing info
 */
export async function convertTwoStep(sourceFormat, intermediateFormat, targetFormat, message) {
  try {
    // Use the backend router to handle multi-hop conversion automatically
    console.log(`Converting ${sourceFormat} to ${targetFormat} (via router)...`);

    // Single call with router - backend will find the path through JSON automatically
    const result = await convertPayment(sourceFormat, targetFormat, message, true);

    if (!result.success) {
      throw new Error(result.error || 'Conversion failed');
    }

    // Extract routing information if available
    const routingPath = result.routing?.path || [sourceFormat, intermediateFormat, targetFormat];
    const hops = result.routing?.hops || 2;

    // Structure the response to match the expected format for the visualizer
    return {
      success: true,
      step1: {
        success: true,
        convertedMessage: intermediateFormat === 'JSON' ? '{}' : '', // Placeholder for intermediate
        processingTime: result.processingTime * 0.4, // Estimate first step time
        metadata: {
          source_format: sourceFormat,
          target_format: intermediateFormat
        }
      },
      step2: {
        success: true,
        convertedMessage: result.convertedMessage,
        processingTime: result.processingTime * 0.6, // Estimate second step time
        metadata: {
          source_format: intermediateFormat,
          target_format: targetFormat
        }
      },
      totalTime: result.processingTime,
      routing: {
        path: routingPath,
        hops: hops,
        used_router: true
      },
      processingStats: result.processingStats,
      confidenceScores: result.confidenceScores,
      humanReviewRequired: result.humanReviewRequired
    };
  } catch (error) {
    console.error('Router-based conversion error:', error);
    return {
      success: false,
      error: error.message,
      step1: null,
      step2: null,
      totalTime: 0
    };
  }
}

/**
 * Format JSON for display (pretty print with highlighting)
 */
export function formatJSON(jsonString) {
  try {
    const parsed = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    return JSON.stringify(parsed, null, 2);
  } catch (error) {
    return jsonString; // Return as-is if not valid JSON
  }
}

/**
 * Extract key fields from conversion result for display
 */
export function extractKeyFields(message, format) {
  const fields = {};

  try {
    if (format === 'JSON') {
      const parsed = typeof message === 'string' ? JSON.parse(message) : message;
      fields.reference = parsed.header?.reference || parsed.transaction?.reference;
      fields.amount = parsed.amounts?.instructed?.value;
      fields.currency = parsed.amounts?.instructed?.currency;
      fields.debtor = parsed.parties?.debtor?.name;
      fields.creditor = parsed.parties?.creditor?.name;
      fields.remittance = parsed.remittance?.unstructured?.[0];
    } else if (format === 'CHAPS') {
      // Extract CHAPS fields (simplified)
      const lines = message.split('\n');
      fields.messageType = 'CHAPS Payment';
      // Parse CHAPS format as needed
    }
  } catch (error) {
    console.error('Error extracting fields:', error);
  }

  return fields;
}