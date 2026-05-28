// Proxy route for list-configs endpoint.
// Browser → Next.js API → Converter sidecar (127.0.0.1:8001)

const CONVERTER_URL = 'http://127.0.0.1:8001';

export async function GET() {
  try {
    const response = await fetch(`${CONVERTER_URL}/api/v1/configs`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('configs proxy error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
