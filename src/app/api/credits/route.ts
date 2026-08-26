import { apiBank } from '@/lib/api-bank';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const accounts = await apiBank.listAccounts({ userId: user.id, status: 'active' });
  const backups = await apiBank.listAccounts({ userId: user.id, status: 'backup' });
  return NextResponse.json([...accounts, ...backups].sort((a, b) => b.healthScore - a.healthScore));
}
