import { apiBank } from '@/lib/api-bank';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get('days') || '30');
  const data = await apiBank.getDailyUsage(user.id, days);
  return NextResponse.json(data);
}
