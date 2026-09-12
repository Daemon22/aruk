<<<<<<< HEAD
=======
import { apiBank } from '@/lib/api-bank';
>>>>>>> 193e563eec90177528092e21ed6ea88aad226193
import { NextResponse } from 'next/server';

// ── GET /api/health ───────────────────────────────────────────
// Lightweight heartbeat for agents and monitoring
export async function GET() {
  try {
<<<<<<< HEAD
    return NextResponse.json({
      status: 'healthy',
      uptime: process.uptime(),
      service: 'aruk',
    }, {
      status: 200,
=======
    const stats = await apiBank.getStats();
    const healthy = stats.healthyAccounts > 0;
    return NextResponse.json({
      status: healthy ? 'healthy' : 'degraded',
      uptime: process.uptime(),
      accounts: {
        total: stats.totalAccounts,
        active: stats.activeAccounts,
        healthy: stats.healthyAccounts,
      },
      credits: {
        remainingPercent: stats.avgCreditsRemaining,
      },
      bestProvider: stats.currentBestProvider,
    }, {
      status: healthy ? 200 : 503,
>>>>>>> 193e563eec90177528092e21ed6ea88aad226193
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ status: 'unhealthy' }, { status: 503 });
  }
}