import { apiBank } from '@/lib/api-bank';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') || 'json';

  const accounts = await apiBank.listAccounts({ userId: user.id });
  const providers = await apiBank.listProviders(user.id);

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

  const safeAccounts = accounts.map(({ apiKey: _maskedKey, ...account }) => account);
  return NextResponse.json({ exportedAt: new Date().toISOString(), accounts: safeAccounts, providers });
}