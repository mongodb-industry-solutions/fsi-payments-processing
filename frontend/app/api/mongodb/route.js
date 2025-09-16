import { NextResponse } from "next/server";

const BACKEND_API_URL = process.env.BACKEND_API_URL || "http://localhost:8001";

export async function GET() {
  try {
    // Fetch insights from backend API with increased timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // Increase to 30 seconds

    const response = await fetch(`${BACKEND_API_URL}/api/v1/converter/insights`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    const insights = await response.json();
    return NextResponse.json(insights);
  } catch (error) {
    console.error("Error fetching insights:", error);

    // Return fallback data if backend is unavailable
    if (error.name === 'AbortError') {
      console.warn("MongoDB insights request timed out, returning fallback data");
    }

    return NextResponse.json({
      error: error.message,
      total_configurations: 8,  // Fallback data
      total_semantic_patterns: 15,
      processing_distribution: {
        rules: 85,
        ai: 10,
        human: 5
      },
      format_pairs: [
        { source: "MT103", target: "pacs.008", id: "MT103_to_pacs.008" },
        { source: "MT202", target: "pacs.009", id: "MT202_to_pacs.009" },
        { source: "MT103", target: "JSON", id: "MT103_to_JSON" },
        { source: "JSON", target: "pacs.008", id: "JSON_to_pacs.008" }
      ],
      patterns_learned: ["transaction_reference", "value_date", "remittance_info"]
    }, { status: 200 }); // Return 200 with fallback data
  }
}
