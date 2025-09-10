import { NextResponse } from 'next/server';
import backendClient from '@/lib/api/backendClient';

export async function POST(request) {
  try {
    const { configuration, action, formatPair } = await request.json();
    
    if (!configuration || !action) {
      return NextResponse.json(
        { error: 'Configuration and action are required' },
        { status: 400 }
      );
    }

    // Validate configuration with backend
    const result = await backendClient.validateConfig({
      configuration,
      action,
      formatPair
    });

    if (action === 'approve') {
      // Save approved configuration to MongoDB
      const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:8001';
      const saveResponse = await fetch(`${backendUrl}/api/v1/converter/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          format_pair: formatPair,
          configuration: configuration,
          approved: true,
          approved_at: new Date().toISOString()
        })
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to save configuration');
      }

      return NextResponse.json({
        success: true,
        message: 'Configuration approved and saved',
        configurationId: result.configurationId
      });

    } else if (action === 'reject') {
      return NextResponse.json({
        success: true,
        message: 'Configuration rejected',
        reason: result.reason
      });

    } else if (action === 'validate') {
      // Just validate without saving
      return NextResponse.json({
        success: true,
        valid: result.valid,
        errors: result.errors || [],
        warnings: result.warnings || []
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    }, { status: 400 });

  } catch (error) {
    console.error('Configuration validation error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Configuration validation failed',
        details: error.toString()
      },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const formatPair = searchParams.get('formatPair');
  
  if (!formatPair) {
    return NextResponse.json(
      { error: 'Format pair is required' },
      { status: 400 }
    );
  }

  try {
    // Get pending configurations for review
    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:8001';
    const response = await fetch(`${backendUrl}/api/v1/converter/config/pending?format_pair=${formatPair}`);
    
    if (!response.ok) {
      return NextResponse.json({
        success: true,
        pendingConfigs: []
      });
    }

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      pendingConfigs: data.configurations || [],
      total: data.total || 0
    });

  } catch (error) {
    console.error('Error fetching pending configurations:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch pending configurations',
        pendingConfigs: []
      },
      { status: 500 }
    );
  }
}