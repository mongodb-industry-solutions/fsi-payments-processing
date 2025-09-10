import { NextResponse } from 'next/server';
import backendClient from '@/lib/api/backendClient';

export async function POST(request) {
  try {
    const { sourceFormat, targetFormat, sampleMessage } = await request.json();
    
    if (!sourceFormat || !targetFormat) {
      return NextResponse.json(
        { error: 'Source and target formats are required' },
        { status: 400 }
      );
    }

    // Call backend auto-configuration service
    const result = await backendClient.autoConfigureFormat({
      sourceFormat,
      targetFormat,
      sampleMessage
    });

    return NextResponse.json({
      success: true,
      configuration: result.configuration,
      confidence: result.confidence,
      uncertainFields: result.uncertainFields,
      processingTime: result.processingTime
    });

  } catch (error) {
    console.error('Auto-configuration error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Auto-configuration failed',
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
    // Check if configuration already exists
    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:8001';
    const response = await fetch(`${backendUrl}/api/v1/converter/config/${formatPair}`);
    
    if (response.ok) {
      const config = await response.json();
      return NextResponse.json({
        success: true,
        exists: true,
        configuration: config
      });
    } else {
      return NextResponse.json({
        success: true,
        exists: false,
        configuration: null
      });
    }
  } catch (error) {
    console.error('Error checking configuration:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to check configuration',
        details: error.toString()
      },
      { status: 500 }
    );
  }
}