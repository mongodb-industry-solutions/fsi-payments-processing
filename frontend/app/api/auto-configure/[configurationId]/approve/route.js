// Proxy route for approve-config (finalize a draft conversion config).
// Browser → Next.js API → Converter sidecar (127.0.0.1:8001)

const CONVERTER_URL = 'http://127.0.0.1:8001';

export async function POST(request, { params }) {
  try {
    const { configurationId } = await params;

    const response = await fetch(
      `${CONVERTER_URL}/api/v1/auto-configure/${encodeURIComponent(configurationId)}/approve`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('auto-configure approve proxy error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
