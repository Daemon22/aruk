import { NextResponse } from 'next/server';

// ── GET /api/health ───────────────────────────────────────────
// Lightweight heartbeat for agents and monitoring
export async function GET() {
  try {
    return NextResponse.json({
      status: 'healthy',
      uptime: process.uptime(),
      service: 'aruk',
    }, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ status: 'unhealthy' }, { status: 503 });
  }
}