// BIAN URL — replaces /api/v1/convert/multi-hop/stream.
// Streams SSE events from the converter back to the browser.
// Browser → Next.js API → Converter sidecar (127.0.0.1:8001)

const CONVERTER_URL = 'http://127.0.0.1:8001';
const BIAN_URL = '/PaymentOrderInitiationTransaction/Initiate';

export async function POST(request) {
  try {
    const body = await request.json();

    const response = await fetch(`${CONVERTER_URL}${BIAN_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Converter error: ${response.status}` }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('PaymentOrderInitiationTransaction/Initiate proxy error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
