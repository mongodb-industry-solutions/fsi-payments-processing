import { NextResponse } from "next/server";

const BACKEND_API_URL = process.env.BACKEND_API_URL || "http://localhost:8000";

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
    const response = await fetch(`${BACKEND_API_URL}/api/v1/convert/`, {
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

    // Return the conversion result
    return NextResponse.json({
      success: true,
      sourceFormat,
      targetFormat,
      inputMessage: sampleData,
      outputMessage: result.converted_message,
      conversionId: result.conversion_id,
      statistics: result.statistics,
      processingLanes: {
        rules: result.statistics?.rules_lane?.count || 0,
        ai: result.statistics?.ai_lane?.count || 0,
        human: result.statistics?.human_lane?.count || 0,
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
    
    MT202: `:20:REF456
:21:RELATED789
:32A:240315USD100000,00
:52A:BANKUSAA
:53A:BANKUSBB
:54A:BANKUSCC
:56A:BANKUSDD
:57A:BANKUSEE
:58A:BANKUSFF
:72:/INS/URGENT PAYMENT`,
    
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