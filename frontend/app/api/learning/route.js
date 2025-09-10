import { NextResponse } from 'next/server';
import backendClient from '@/lib/api/backendClient';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const formatPair = searchParams.get('formatPair');

  try {
    // Get semantic patterns from backend
    const patterns = await backendClient.getSemanticPatterns(formatPair);
    
    return NextResponse.json({
      success: true,
      patterns: patterns.patterns || [],
      totalPatterns: patterns.total || 0,
      lastUpdated: patterns.lastUpdated || new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching semantic patterns:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch semantic patterns',
        patterns: [],
        totalPatterns: 0
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { action, formatPair, pattern } = await request.json();
    
    if (action === 'trigger') {
      // Trigger learning process
      const result = await backendClient.triggerLearning({ formatPair });
      
      return NextResponse.json({
        success: true,
        message: 'Learning process initiated',
        patternsGenerated: result.patternsGenerated || 0,
        processingTime: result.processingTime || 0
      });
      
    } else if (action === 'add') {
      // Add a new semantic pattern
      const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:8001';
      const response = await fetch(`${backendUrl}/api/v1/converter/patterns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          format_pair: formatPair,
          pattern: pattern
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to add pattern');
      }
      
      return NextResponse.json({
        success: true,
        message: 'Pattern added successfully'
      });
      
    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Learning operation error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Learning operation failed',
        details: error.toString()
      },
      { status: 500 }
    );
  }
}

// Get learning statistics
export async function HEAD(request) {
  try {
    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:8001';
    const response = await fetch(`${backendUrl}/api/v1/converter/insights`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch insights');
    }
    
    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      stats: {
        totalPatterns: data.total_patterns || 0,
        totalConfigurations: data.total_configurations || 0,
        aiProcessedFields: data.ai_processed_fields || 0,
        lastLearningRun: data.last_learning_run || null
      }
    });

  } catch (error) {
    console.error('Error fetching learning stats:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch learning statistics'
      },
      { status: 500 }
    );
  }
}