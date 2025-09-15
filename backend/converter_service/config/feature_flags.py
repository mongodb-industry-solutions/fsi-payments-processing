"""
Feature Flags Configuration
Controls optional features without modifying core logic
"""

import os
from typing import Dict, Any

class FeatureFlags:
    """
    Feature flags for controlling optional functionality.
    All flags default to False for safety.
    """
    
    # Demo and visualization features
    ENABLE_DEMO_MODE = os.getenv('ENABLE_DEMO_MODE', 'false').lower() == 'true'
    ENABLE_PROGRESS_TRACKING = os.getenv('ENABLE_PROGRESS_TRACKING', 'false').lower() == 'true'
    SHOW_AI_REASONING = os.getenv('SHOW_AI_REASONING', 'false').lower() == 'true'
    SHOW_CONFIDENCE_BREAKDOWN = os.getenv('SHOW_CONFIDENCE_BREAKDOWN', 'false').lower() == 'true'
    SHOW_LANE_VISUALIZATION = os.getenv('SHOW_LANE_VISUALIZATION', 'false').lower() == 'true'
    ENABLE_DEMO_FALLBACK = os.getenv('ENABLE_DEMO_FALLBACK', 'false').lower() == 'true'  # Control fallback enhancer
    
    # WebSocket support for real-time updates
    ENABLE_WEBSOCKET = os.getenv('ENABLE_WEBSOCKET', 'false').lower() == 'true'
    
    # Parallel processing (experimental)
    ENABLE_PARALLEL_AI = os.getenv('ENABLE_PARALLEL_AI', 'false').lower() == 'true'
    
    @classmethod
    def get_all_flags(cls) -> Dict[str, bool]:
        """Get all feature flags and their current values"""
        return {
            'demo_mode': cls.ENABLE_DEMO_MODE,
            'progress_tracking': cls.ENABLE_PROGRESS_TRACKING,
            'ai_reasoning': cls.SHOW_AI_REASONING,
            'confidence_breakdown': cls.SHOW_CONFIDENCE_BREAKDOWN,
            'lane_visualization': cls.SHOW_LANE_VISUALIZATION,
            'websocket': cls.ENABLE_WEBSOCKET,
            'parallel_ai': cls.ENABLE_PARALLEL_AI,
        }
    
    @classmethod
    def is_demo_mode(cls) -> bool:
        """Check if any demo features are enabled"""
        return (cls.ENABLE_DEMO_MODE or 
                cls.SHOW_AI_REASONING or 
                cls.SHOW_CONFIDENCE_BREAKDOWN or
                cls.SHOW_LANE_VISUALIZATION)

# Create a singleton instance
feature_flags = FeatureFlags()