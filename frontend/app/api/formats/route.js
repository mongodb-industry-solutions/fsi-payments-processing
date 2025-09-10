import { NextResponse } from "next/server";

const BACKEND_API_URL = process.env.BACKEND_API_URL || "http://localhost:8001";

// Fallback formats if backend is unavailable
const FALLBACK_FORMATS = {
  source_formats: [
    { format_code: "MT103", format_name: "SWIFT MT103 Wire Transfer", version: "latest", description: "Standard wire transfer format" },
    { format_code: "MT202", format_name: "SWIFT MT202 Bank to Bank", version: "latest", description: "Bank to bank transfer" },
    { format_code: "MT900", format_name: "SWIFT MT900 Confirmation", version: "latest", description: "Confirmation of debit" },
    { format_code: "ISO8583", format_name: "ISO 8583 Card Payments", version: "1987", description: "Card payment transactions" }
  ],
  target_formats: [
    { format_code: "pacs.008", format_name: "ISO 20022 Credit Transfer", version: "001.08", description: "Customer credit transfer" },
    { format_code: "pacs.004", format_name: "ISO 20022 Payment Return", version: "001.08", description: "Payment return message" },
    { format_code: "pacs.009", format_name: "ISO 20022 FI Credit Transfer", version: "001.08", description: "Financial institution credit transfer" },
    { format_code: "ISO8583", format_name: "ISO 8583 Card Payments", version: "1987", description: "Card payment transactions" }
  ]
};

export async function GET(request) {
  try {
    // Try to fetch from backend
    const response = await fetch(`${BACKEND_API_URL}/api/v1/converter/formats`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    const data = await response.json();
    
    // Add cache headers for client-side caching (5 minutes)
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
      }
    });
    
  } catch (error) {
    console.error("Failed to fetch formats from backend:", error.message);
    
    // Return fallback formats if backend is unavailable
    return NextResponse.json(FALLBACK_FORMATS, {
      headers: {
        'X-Fallback': 'true',
        'Cache-Control': 'public, max-age=60', // Cache fallback for 1 minute
      }
    });
  }
}

// Optional: Add POST endpoint to refresh cache
export async function POST(request) {
  try {
    // Force refresh from backend
    const response = await fetch(`${BACKEND_API_URL}/api/v1/converter/formats`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      data: data,
      refreshed_at: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
      fallback: FALLBACK_FORMATS
    }, { status: 503 });
  }
}