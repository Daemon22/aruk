import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// The health endpoint checks persistent storage as well as the web process.
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      uptime: process.uptime(),
      service: 'aruk',
    }, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({
      status: 'unhealthy',
      database: 'unavailable',
      service: 'aruk',
    }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
