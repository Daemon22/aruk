import { apiBank } from '@/lib/api-bank';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const accounts = await apiBank.listAccounts({ userId: user.id, status: 'active' });
  const predictions = accounts
    .filter(a => a.creditUnit !== 'unlimited' && a.totalCredits > 0 && a.remainingCredits > 0)
    .map(a => {
      const remaining = a.remainingCredits;
      const usedPerDay = a.totalRequests > 0
        ? (a.usedCredits / Math.max(a.totalRequests, 1)) * a.todayRequests * 3.5
        : 0.1;
      const daysLeft = usedPerDay > 0 ? Math.round(remaining / usedPerDay) : 999;
      const dateEstimate = new Date(Date.now() + daysLeft * 86400000);
      return {
        id: a.id,
        name: a.name,
        providerName: a.providerName,
        remainingCredits: Math.round(remaining * 100) / 100,
        totalCredits: a.totalCredits,
        remainingPercent: a.remainingPercent,
        dailyBurnRate: Math.round(usedPerDay * 10000) / 10000,
        daysLeft,
        estimatedExhaustion: dateEstimate.toISOString().split('T')[0],
        healthScore: a.healthScore,
        todayRequests: a.todayRequests,
      };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const providers = new Map<string, { totalRequests: number; totalErrors: number; avgLatency: number; count: number }>();
  for (const a of accounts.filter(a => a.status === 'active')) {
    if (!providers.has(a.providerName)) {
      providers.set(a.providerName, { totalRequests: 0, totalErrors: 0, avgLatency: 0, count: 0 });
    }
    const p = providers.get(a.providerName)!;
    p.totalRequests += a.todayRequests;
    p.totalErrors += a.errorCount;
    p.avgLatency += a.avgLatencyMs;
    p.count++;
  }
  const providerComparison = Array.from(providers.entries()).map(([name, data]) => ({
    name,
    totalRequests: data.totalRequests,
    avgLatency: Math.round(data.avgLatency / data.count),
    errorRate: (data.totalRequests + data.totalErrors) > 0
      ? Math.round((data.totalErrors / (data.totalRequests + data.totalErrors)) * 1000) / 10
      : 0,
  })).sort((a, b) => b.totalRequests - a.totalRequests);

  return NextResponse.json({ predictions, providerComparison });
}