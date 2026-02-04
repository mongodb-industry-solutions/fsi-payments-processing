// Proxy route for Solana devnet health check
// Browser → Next.js API → Converter sidecar (127.0.0.1:8001)

const CONVERTER_URL = 'http://127.0.0.1:8001';

export async function GET() {
  try {
    const response = await fetch(`${CONVERTER_URL}/api/v1/solana/health`, {
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
    return new Response(JSON.stringify({
      healthy: false,
      network: null,
      current_slot: null,
      wallet_balance_sol: null,
      error: `Backend unreachable: ${error.message}`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
