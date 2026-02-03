// Proxy route for collection preview endpoint
// Browser → Next.js API → Agent sidecar (127.0.0.1:8002)

const AGENT_URL = 'http://127.0.0.1:8002';

export async function GET(request, { params }) {
  try {
    const { collectionName } = await params;

    const response = await fetch(
      `${AGENT_URL}/api/v1/payment-agent/collection-preview/${collectionName}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Collection preview proxy error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
