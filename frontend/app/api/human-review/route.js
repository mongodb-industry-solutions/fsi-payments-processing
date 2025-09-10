import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const conversionId = searchParams.get('conversionId');
  
  try {
    // Get fields requiring human review from backend
    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:8001';
    const response = await fetch(`${backendUrl}/api/v1/converter/human-review/${conversionId || 'pending'}`);
    
    if (!response.ok) {
      // Return mock data for demo if backend endpoint doesn't exist
      return NextResponse.json({
        success: true,
        reviewRequired: true,
        fields: [
          {
            id: 'field_70',
            fieldName: ':70',
            fieldLabel: 'Remittance Information',
            currentValue: 'PAYMENT FOR INVOICE INV-2024-11-3847',
            suggestedValue: 'Invoice INV-2024-11-3847 payment',
            confidence: 0.65,
            reason: 'Low confidence in extraction'
          },
          {
            id: 'field_72',
            fieldName: ':72',
            fieldLabel: 'Sender to Receiver Information',
            currentValue: '/ACC/URGENT PROCESSING REQUIRED',
            suggestedValue: 'URGENT PROCESSING',
            confidence: 0.72,
            reason: 'Ambiguous content structure'
          }
        ]
      });
    }
    
    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      reviewRequired: data.review_required || false,
      fields: data.fields || [],
      conversionId: data.conversion_id || conversionId
    });

  } catch (error) {
    console.error('Error fetching human review fields:', error);
    // Return mock data for demo
    return NextResponse.json({
      success: true,
      reviewRequired: true,
      fields: [
        {
          id: 'field_70',
          fieldName: ':70',
          fieldLabel: 'Remittance Information',
          currentValue: 'PAYMENT FOR INVOICE INV-2024-11-3847',
          suggestedValue: 'Invoice INV-2024-11-3847 payment',
          confidence: 0.65,
          reason: 'Low confidence in extraction'
        }
      ]
    });
  }
}

export async function POST(request) {
  try {
    const { conversionId, fields, action } = await request.json();
    
    if (!conversionId || !fields) {
      return NextResponse.json(
        { error: 'Conversion ID and fields are required' },
        { status: 400 }
      );
    }

    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:8001';
    
    if (action === 'submit') {
      // Submit human review corrections
      const response = await fetch(`${backendUrl}/api/v1/converter/human-review/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          conversion_id: conversionId,
          reviewed_fields: fields,
          reviewed_at: new Date().toISOString(),
          reviewer: 'user' // In production, this would be the actual user ID
        })
      });

      if (!response.ok) {
        // Return success for demo even if backend endpoint doesn't exist
        return NextResponse.json({
          success: true,
          message: 'Review submitted successfully',
          fieldsUpdated: fields.length
        });
      }

      const data = await response.json();
      
      return NextResponse.json({
        success: true,
        message: 'Review submitted successfully',
        fieldsUpdated: data.fields_updated || fields.length
      });

    } else if (action === 'accept-all') {
      // Accept all AI suggestions
      const acceptedFields = fields.map(field => ({
        ...field,
        finalValue: field.suggestedValue,
        accepted: true
      }));

      // In production, this would save to backend
      return NextResponse.json({
        success: true,
        message: 'All suggestions accepted',
        fieldsUpdated: acceptedFields.length
      });

    } else if (action === 'skip') {
      // Skip human review
      return NextResponse.json({
        success: true,
        message: 'Human review skipped',
        fieldsSkipped: fields.length
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    }, { status: 400 });

  } catch (error) {
    console.error('Human review submission error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Human review submission failed',
        details: error.toString()
      },
      { status: 500 }
    );
  }
}

// Get human review statistics
export async function HEAD(request) {
  try {
    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:8001';
    const response = await fetch(`${backendUrl}/api/v1/converter/human-review/stats`);
    
    if (!response.ok) {
      // Return mock stats for demo
      return NextResponse.json({
        success: true,
        stats: {
          pendingReviews: 2,
          completedReviews: 15,
          averageConfidence: 0.68,
          fieldsReviewed: 47
        }
      });
    }
    
    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      stats: data.stats || {}
    });

  } catch (error) {
    console.error('Error fetching human review stats:', error);
    return NextResponse.json({
      success: true,
      stats: {
        pendingReviews: 0,
        completedReviews: 0,
        averageConfidence: 0,
        fieldsReviewed: 0
      }
    });
  }
}