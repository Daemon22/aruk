import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// ── GET /api/health ───────────────────────────────────────────
// Lightweight heartbeat for agents and monitoring
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: 'healthy',
      database: 'ready',
      service: 'aruk',
      uptime: process.uptime(),
    }, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ status: 'unhealthy', database: 'unavailable' }, { status: 503 });
  }
}