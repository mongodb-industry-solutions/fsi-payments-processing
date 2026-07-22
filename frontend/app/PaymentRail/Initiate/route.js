// BIAN URL — replaces /api/v1/convert/multi-hop/stream.
// Streams SSE events from the converter back to the browser.
// Browser → Next.js API → Converter sidecar (127.0.0.1:8001)
// Backend is BQ-level: PaymentRail/{sessionId}/{Outbound|Inbound}Transaction/Initiate.

const CONVERTER_URL = 'http://127.0.0.1:8001';
const SESSION_ID = 'PRAIL-SESSION-DEFAULT';

export async function POST(request) {
  try {
    const body = await request.json();

    // BIAN BQ chosen by the conversion's deliverable (not the hops):
    //   targetFormat === 'JSON' → InboundTransaction (ingest a received message)
    //   otherwise (wire format) → OutboundTransaction (emit a message to send)
    const bq = String(body.targetFormat || '').toUpperCase() === 'JSON'
      ? 'InboundTransaction'
      : 'OutboundTransaction';
    const BIAN_URL = `/PaymentRail/${SESSION_ID}/${bq}/Initiate`;

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
    console.error('PaymentRail/Initiate proxy error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
