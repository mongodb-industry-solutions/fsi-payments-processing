/**
 * Backend API Client
 * Centralized client for all backend API calls
 */

class BackendClient {
  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001';
  }

  /**
   * Core conversion endpoint
   */
  async convert(sourceFormat, targetFormat, message) {
    const response = await fetch(`${this.baseURL}/api/v1/converter/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_format: sourceFormat,
        target_format: targetFormat,
        message: message,
        save_result: true
      })
    });
    
    const result = await response.json();
    
    // Transform to frontend format
    return {
      success: result.success,
      convertedMessage: result.converted_message,
      conversionId: result.request_id,
      processingStats: this.extractStats(result.metadata),
      humanReviewRequired: result.metadata?.human_review_required,
      reviewFields: result.metadata?.human_review_fields || [],
      confidence: result.metadata?.confidence_scores || {}
    };
  }

  /**
   * Get supported formats
   */
  async getFormats() {
    const response = await fetch(`${this.baseURL}/api/v1/converter/formats`);
    return response.json();
  }

  /**
   * Get format sample
   */
  async getFormatSample(formatCode) {
    const response = await fetch(`${this.baseURL}/api/v1/converter/samples/${formatCode}`);
    return response.json();
  }

  /**
   * Get conversion details
   */
  async getConversionDetails(conversionId) {
    const response = await fetch(`${this.baseURL}/api/v1/converter/convert/${conversionId}/details`);
    return response.json();
  }

  /**
   * Get insights
   */
  async getInsights() {
    const response = await fetch(`${this.baseURL}/api/v1/converter/insights`);
    return response.json();
  }

  /**
   * Auto-configuration for new formats
   */
  async autoConfigureFormat(sourceFormat, targetFormat, sampleMessage, similarTo) {
    const response = await fetch(`${this.baseURL}/api/v1/converter/auto-configure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_format: sourceFormat,
        target_format: targetFormat,
        sample_message: sampleMessage,
        similar_to: similarTo
      })
    });
    
    return response.json();
  }

  /**
   * Get semantic patterns
   */
  async getSemanticPatterns() {
    const response = await fetch(`${this.baseURL}/api/v1/converter/semantic-patterns`);
    return response.json();
  }

  /**
   * Trigger learning
   */
  async triggerLearning() {
    const response = await fetch(`${this.baseURL}/api/v1/converter/learn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force_refresh: false })
    });
    return response.json();
  }

  /**
   * Validate configuration
   */
  async validateConfig(configId, corrections, approved) {
    const response = await fetch(`${this.baseURL}/api/v1/converter/validate-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        configuration_id: configId,
        corrections: corrections,
        approved: approved
      })
    });
    return response.json();
  }

  /**
   * Get configuration status
   */
  async getConfigStatus(configId) {
    const response = await fetch(`${this.baseURL}/api/v1/converter/auto-config/status/${configId}`);
    return response.json();
  }

  /**
   * Delete auto-generated configuration
   */
  async deleteAutoConfig(configId) {
    const response = await fetch(`${this.baseURL}/api/v1/converter/auto-config/${configId}`, {
      method: 'DELETE'
    });
    return response.json();
  }

  /**
   * Health check
   */
  async healthCheck() {
    const response = await fetch(`${this.baseURL}/api/v1/converter/health`);
    return response.json();
  }

  /**
   * Extract statistics from metadata
   */
  extractStats(metadata) {
    const stats = metadata?.processing_stats;
    if (!stats) return { rules: 0, ai: 0, human: 0 };
    
    return {
      rules: stats.rules_lane?.count || 0,
      ai: stats.ai_lane?.count || 0,
      human: stats.human_lane?.count || 0,
      totalTime: metadata.processing_time_seconds,
      totalFields: metadata.parsed_fields_count
    };
  }
}

// Export singleton instance
export default new BackendClient();