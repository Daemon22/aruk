import { apiBank } from '@/lib/api-bank';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') || 'json';

  const accounts = await apiBank.listAccounts();
  const providers = await apiBank.listProviders();

  if (format === 'csv') {
    const header = 'Provider,Account,Status,Priority,TotalCredits,UsedCredits,Remaining,Unit,Health,LatencyMs,SuccessRate,TodayRequests,TotalRequests,LastUsed';
    const rows = accounts.map(a => [
      a.providerName, a.name, a.status, a.priority,
      a.totalCredits, a.usedCredits, a.remainingCredits, a.creditUnit,
      a.healthScore, a.avgLatencyMs, a.successRate,
      a.todayRequests, a.totalRequests,
      a.lastUsedAt ? new Date(a.lastUsedAt).toISOString() : 'Never',
    ].join(','));
    const csv = [header, ...rows].join('\n');
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename=api-bank-export.csv' },
    });
  }

  return NextResponse.json({ exportedAt: new Date().toISOString(), accounts, providers });
}