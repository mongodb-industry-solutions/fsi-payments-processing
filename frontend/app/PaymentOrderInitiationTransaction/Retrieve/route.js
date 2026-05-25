// BIAN URL — replaces /api/v1/canonical-json/{conversionRunId}.
// Body must carry { "conversionRunReference": "<uuid>" }.
// Browser → Next.js API → Converter sidecar (127.0.0.1:8001)

const CONVERTER_URL = 'http://127.0.0.1:8001';
const BIAN_URL = '/PaymentOrderInitiationTransaction/Retrieve';

export async function POST(request) {
  try {
    const body = await request.json();

    const response = await fetch(`${CONVERTER_URL}${BIAN_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('PaymentOrderInitiationTransaction/Retrieve proxy error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
