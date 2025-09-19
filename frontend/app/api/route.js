import { NextResponse } from 'next/server';

// Root health check endpoint for Kanopy liveness probe
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    message: 'Server is running',
    service: 'fsi-payments-processing-frontend',
    timestamp: new Date().toISOString()
  }, { status: 200 });
}