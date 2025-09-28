import { NextResponse } from "next/server";

const BACKEND_API_URL = process.env.BACKEND_API_URL || "http://localhost:8001";

export async function POST(request) {
  try {
    const { sourceFormat, targetFormat } = await request.json();

    if (!sourceFormat || !targetFormat) {
      return NextResponse.json(
        { error: "Source and target formats are required" },
        { status: 400 }
      );
    }

    // Get sample data for the source format (try MongoDB first, then fallback)
    const sampleData = await getSampleData(sourceFormat);

    // Call backend conversion API
    const response = await fetch(`${BACKEND_API_URL}/api/v1/converter/convert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_format: sourceFormat,
        target_format: targetFormat,
        message: sampleData,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Backend error: ${error}`);
    }

    const result = await response.json();

    // Fetch conversion details to get processing summary with unique counts
    let processingSummary = null;
    if (result.conversion_id || result.request_id) {
      try {
        const conversionId = result.conversion_id || result.request_id;
        const detailsResponse = await fetch(
          `${BACKEND_API_URL}/api/v1/converter/convert/${conversionId}/details`
        );
        if (detailsResponse.ok) {
          const detailsData = await detailsResponse.json();
          processingSummary = detailsData.processing_summary;
        }
      } catch (error) {
        console.warn("Failed to fetch conversion details:", error);
      }
    }

    // Return the conversion result
    return NextResponse.json({
      success: true,
      sourceFormat,
      targetFormat,
      inputMessage: sampleData,
      outputMessage: result.converted_message,
      conversionId: result.request_id || result.conversion_id,
      statistics: result.metadata || result.statistics,
      processingLanes: {
        rules: processingSummary?.rules_fields || result.metadata?.processing_stats?.rules_lane?.count || 0,
        ai: processingSummary?.ai_fields || result.metadata?.processing_stats?.ai_lane?.count || 0,
        human: processingSummary?.human_review_fields || result.metadata?.processing_stats?.human_lane?.count || 0,
      },
    });

  } catch (error) {
    console.error("Conversion error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || "Conversion failed",
        details: error.toString()
      },
      { status: 500 }
    );
  }
}

// Get sample data for different formats (try MongoDB first, then fallback)
async function getSampleData(format) {
  try {
    // Try to fetch from MongoDB via backend
    const response = await fetch(`${BACKEND_API_URL}/api/v1/samples/preview/${format}`);
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.preview) {
        return data.preview;
      }
    }
  } catch (error) {
    console.warn(`Failed to fetch sample from backend for ${format}:`, error);
  }
  
  // Fallback to hardcoded samples
  const samples = {
    MT103: `{1:F01BANKUSAAAXXX0000000000}{2:I103BANKUSBBXXXXN}{3:{108:1234567890123456}}{4:
:20:CORP-2024-11-3847
:23B:CRED
:32A:241106USD50000,00
:50K:/1234567890
TECH INNOVATIONS INC.
123 SILICON VALLEY WAY
SAN FRANCISCO, CA 94105
:59:/0987654321
GLOBAL SUPPLIERS LTD.
456 COMMERCE STREET
NEW YORK, NY 10013
:70:PAYMENT FOR INVOICE INV-2024-11-3847
:71A:OUR
-}`,
    
    MT202: `{1:F01CHASUS33XXXX0000000000}{2:I202DEUTDEFFXXXXN}{4:
:20:FT24326789012345
:21:REF24326789012345
:32A:241215USD500000,00
:52D:/12345678
ACME BANK NEW YORK
100 WALL STREET
NEW YORK, NY 10005
USA
:56D:/GB98765432
MIDLAND BANK PLC
25 OLD BROAD STREET
LONDON EC2N 1HN
UNITED KINGDOM
:57A:DEUTDEFFXXX
:58D:/DE89370400440532013000
BARCLAYS BANK FRANKFURT
TAUNUSANLAGE 12
60325 FRANKFURT AM MAIN
GERMANY
:70:/INV/2024-11-3847 DATED 15.11.2024
/PO/8934567 QTY 5000 UNITS
/RFB/CONTRACT TRD-2024-ACME-789
/ROC/QUARTERLY SETTLEMENT Q4-2024
:72:/INS/URGENT - SAME DAY VALUE
/BNF/BENEFICIARY REF: ABC-123
/ACC/ACCOUNT VERIFICATION REQUIRED
/REC/NOTIFY: payments@example.com
-}`,
    
    MT900: `:20:DEBIT789
:21:REFERENCE456
:25:1234567890
:32A:240315USD25000,00
:52A:BANKUSAA
:72:CONFIRMATION OF DEBIT`,
    
    SWIFT_MT: `:20:GENERIC001
:23B:CRED
:32A:240315EUR75000,00
:50:ORDERING CUSTOMER
:59:BENEFICIARY CUSTOMER
:70:PAYMENT DETAILS
:71A:SHA`,
    
    ISO8583: `0200B23A800128C180020000000000000000161234567890123456120150120150120111300000001000012345612345606051105511092700`
  };
  
  return samples[format] || samples.MT103;
}