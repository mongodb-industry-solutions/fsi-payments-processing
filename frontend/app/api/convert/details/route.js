import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const conversionId = searchParams.get('id');
  
  if (!conversionId) {
    return NextResponse.json({ 
      success: false,
      error: 'Conversion ID is required' 
    }, { status: 400 });
  }

  try {
    // Fetch details from backend
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    const response = await fetch(`${backendUrl}/api/v1/convert/${conversionId}/details`);
    
    if (!response.ok) {
      // Return error if backend call fails
      return NextResponse.json({
        success: false,
        error: `Backend returned ${response.status}`,
        conversionId: conversionId,
        fieldMappings: []
      });
    }

    const data = await response.json();
    
    // Transform backend data to frontend format
    const fieldMappings = data.field_details?.map((field, index) => {
      // Add colon prefix for MT103 fields if not present
      const sourceFieldId = field.field_id.startsWith(':') ? field.field_id : `:${field.field_id}`;
      
      return {
        // Create unique ID by combining field_id with target_field or index
        id: `${field.field_id}_${field.target_field || index}`,
        sourceField: sourceFieldId,
        sourceValue: field.source_value || "",  // Use actual source value from backend
        targetField: field.target_field || mapToTargetField(sourceFieldId),  // Use target_field from backend if available
        targetValue: field.value || "",
        processingLane: field.processing_lane,
        confidence: field.confidence,
        modelUsed: field.model_used,
        mongoRule: getMongoRule(sourceFieldId, field.processing_lane)
      };
    }) || [];

    return NextResponse.json({
      success: true,
      conversionId: data.conversion_id || conversionId,
      fieldMappings: fieldMappings,
      processingStats: data.processing_summary,
      processingTime: data.processing_time,
      overallConfidence: data.overall_confidence
    });

  } catch (error) {
    console.error('Error fetching conversion details:', error);
    
    // Only return mock data if backend is truly unavailable
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch conversion details',
      fieldMappings: [],  // Return empty array instead of mock data
      processingStats: {
        rules_fields: 0,
        ai_fields: 0,
        human_review_fields: 0
      },
      processingTime: 0,
      overallConfidence: 0
    });
  }
}

// Helper function to map source fields to target fields
function mapToTargetField(sourceField) {
  const fieldMapping = {
    ':20': 'MsgId',
    ':32A': 'IntrBkSttlmAmt',
    ':50K': 'Dbtr.Nm',
    ':59': 'Cdtr.Nm',
    ':71A': 'ChrgBr',
    ':23B': 'PmtTpInf.InstrPrty',
    ':70': 'RmtInf.Ustrd',
    ':52A': 'DbtrAgt.FinInstnId.BIC',
    ':57A': 'CdtrAgt.FinInstnId.BIC'
  };
  
  return fieldMapping[sourceField] || sourceField;
}

// Helper function to get MongoDB rule path
function getMongoRule(fieldId, processingLane) {
  if (processingLane === 'RULES') {
    return `conversion_configs.rules.${fieldId.replace(':', '')}`;
  } else if (processingLane === 'AI') {
    return `conversion_configs.ai_fields.${fieldId.replace(':', '')}`;
  }
  return null;
}

// Generate mock field mappings for demo
function generateMockFieldMappings() {
  return [
    {
      id: "1",
      sourceField: ":20",
      sourceValue: "REF123456789",
      targetField: "MsgId",
      targetValue: "MSG123456789",
      processingLane: "RULES",
      confidence: 1.0,
      mongoRule: "conversion_configs.rules.reference_mapping"
    },
    {
      id: "2",
      sourceField: ":32A",
      sourceValue: "241215USD50000,00",
      targetField: "IntrBkSttlmAmt",
      targetValue: "50000.00",
      processingLane: "RULES",
      confidence: 1.0,
      mongoRule: "conversion_configs.rules.amount_mapping"
    },
    {
      id: "3",
      sourceField: ":50K",
      sourceValue: "JOHN DOE\n123 MAIN STREET\nNEW YORK, NY 10001",
      targetField: "Dbtr.Nm",
      targetValue: "John Doe",
      processingLane: "AI",
      confidence: 0.92,
      modelUsed: "Claude 3",
      mongoRule: "conversion_configs.ai_fields.unstructured_name_extraction"
    },
    {
      id: "4",
      sourceField: ":59",
      sourceValue: "JANE SMITH\n456 PARK AVENUE\nLOS ANGELES, CA 90001",
      targetField: "Cdtr.Nm",
      targetValue: "Jane Smith",
      processingLane: "AI",
      confidence: 0.88,
      modelUsed: "Claude 3",
      mongoRule: "conversion_configs.ai_fields.unstructured_name_extraction"
    },
    {
      id: "5",
      sourceField: ":71A",
      sourceValue: "OUR",
      targetField: "ChrgBr",
      targetValue: "DEBT",
      processingLane: "RULES",
      confidence: 1.0,
      mongoRule: "conversion_configs.rules.charge_bearer_mapping"
    },
    {
      id: "6",
      sourceField: ":23B",
      sourceValue: "CRED",
      targetField: "PmtTpInf.InstrPrty",
      targetValue: "NORM",
      processingLane: "RULES",
      confidence: 1.0,
      mongoRule: "conversion_configs.rules.payment_type_mapping"
    },
    {
      id: "7",
      sourceField: ":70",
      sourceValue: "PAYMENT FOR INVOICE INV-2024-11-3847",
      targetField: "RmtInf.Ustrd",
      targetValue: "PAYMENT FOR INVOICE INV-2024-11-3847",
      processingLane: "RULES",
      confidence: 1.0,
      mongoRule: "conversion_configs.rules.remittance_info_mapping"
    },
    {
      id: "8",
      sourceField: ":52A",
      sourceValue: "CHASUS33XXX",
      targetField: "DbtrAgt.FinInstnId.BIC",
      targetValue: "CHASUS33XXX",
      processingLane: "RULES",
      confidence: 1.0,
      mongoRule: "conversion_configs.rules.debtor_agent_mapping"
    },
    {
      id: "9",
      sourceField: ":57A",
      sourceValue: "CITIUS33XXX",
      targetField: "CdtrAgt.FinInstnId.BIC",
      targetValue: "CITIUS33XXX",
      processingLane: "RULES",
      confidence: 1.0,
      mongoRule: "conversion_configs.rules.creditor_agent_mapping"
    },
    {
      id: "10",
      sourceField: ":50K",
      sourceValue: "/12345678901234567890",
      targetField: "Dbtr.Id.OrgId.Othr.Id",
      targetValue: "12345678901234567890",
      processingLane: "AI",
      confidence: 0.95,
      modelUsed: "Claude 3",
      mongoRule: "conversion_configs.ai_fields.account_extraction"
    },
    {
      id: "11",
      sourceField: ":59",
      sourceValue: "/98765432109876543210",
      targetField: "Cdtr.Id.OrgId.Othr.Id",
      targetValue: "98765432109876543210",
      processingLane: "AI",
      confidence: 0.93,
      modelUsed: "Claude 3",
      mongoRule: "conversion_configs.ai_fields.account_extraction"
    },
    {
      id: "12",
      sourceField: ":32A",
      sourceValue: "241215",
      targetField: "IntrBkSttlmDt",
      targetValue: "2024-12-15",
      processingLane: "RULES",
      confidence: 1.0,
      mongoRule: "conversion_configs.rules.date_formatting"
    }
  ];
}