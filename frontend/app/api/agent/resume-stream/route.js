// Streaming proxy route for agent resume endpoint (human-in-the-loop)
// Browser → Next.js API → Converter sidecar (127.0.0.1:8001)
// This version streams SSE events for execution agent visibility

const CONVERTER_URL = 'http://127.0.0.1:8001';

export async function POST(request) {
  try {
    const body = await request.json();

    // Call the streaming resume endpoint
    const response = await fetch(
      `${CONVERTER_URL}/api/v1/agent/resume-stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: errorText }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Stream the SSE response to the browser
    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Agent resume-stream proxy error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
