import { NextResponse } from "next/server";

const BACKEND_API_URL = process.env.BACKEND_API_URL || "http://localhost:8001";

export async function GET() {
  try {
    // Fetch insights from backend API instead of direct MongoDB access
    const response = await fetch(`${BACKEND_API_URL}/api/v1/converter/insights`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    const insights = await response.json();
    return NextResponse.json(insights);
  } catch (error) {
    console.error("Error fetching insights:", error);
    return NextResponse.json({ 
      error: error.message,
      total_configurations: 0,
      processing_distribution: { rules: 0, ai: 0, human: 0 }
    }, { status: 500 });
  }
}
