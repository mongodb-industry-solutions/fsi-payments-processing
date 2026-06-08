// BIAN URL — replaces /api/v1/canonical-json/{conversionRunId}.
// Body must carry { "conversionRunId": "<uuid>" }.
// Browser → Next.js API → Converter sidecar (127.0.0.1:8001)
// Backend is BQ-level: PaymentRail/{sessionId}/OutboundTransaction/{id}/Retrieve
// (both BQ Retrieve routes return the same doc; OutboundTransaction is primary).

const CONVERTER_URL = 'http://127.0.0.1:8001';
const SESSION_ID = 'PRAIL-SESSION-DEFAULT';

export async function POST(request) {
  try {
    const body = await request.json();
    const conversionRunId = body.conversionRunId;
    if (!conversionRunId) {
      return new Response(JSON.stringify({ error: 'conversionRunId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // conversion_run_id is a path param on the backend now (not a body field).
    const BIAN_URL = `/PaymentRail/${SESSION_ID}/OutboundTransaction/${encodeURIComponent(conversionRunId)}/Retrieve`;

    const response = await fetch(`${CONVERTER_URL}${BIAN_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('PaymentRail/Retrieve proxy error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
