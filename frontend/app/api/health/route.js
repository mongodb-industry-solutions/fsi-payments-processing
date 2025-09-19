import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  }, { status: 200 });
}