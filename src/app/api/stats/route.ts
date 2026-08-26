import { apiBank } from '@/lib/api-bank';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const [stats, credits, failover] = await Promise.all([
    apiBank.getStats(user.id),
    apiBank.getCreditsByProvider(user.id),
    apiBank.getFailoverChain(user.id),
  ]);
  return NextResponse.json({ stats, credits, failover });
}
