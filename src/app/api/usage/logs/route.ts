import { apiBank } from '@/lib/api-bank';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const perPage = parseInt(searchParams.get('perPage') || '20');
  const accountId = searchParams.get('accountId') || undefined;
  const status = searchParams.get('status') || undefined;

  const result = await apiBank.getUsageLogs(user.id, page, perPage, { accountId, status });
  return NextResponse.json(result);
}
