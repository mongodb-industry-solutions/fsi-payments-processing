// BIAN v14 valid — OrderInitiation.Retrieve replaces /api/v1/configs.
// Browser → Next.js API → Converter sidecar (127.0.0.1:8001)

const CONVERTER_URL = 'http://127.0.0.1:8001';
const BIAN_URL = '/PaymentOrderInitiationTransaction/OrderInitiation/Retrieve';

export async function POST() {
  try {
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
    console.error('OrderInitiation/Retrieve proxy error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
