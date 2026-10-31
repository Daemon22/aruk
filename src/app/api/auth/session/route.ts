import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET(req: Request) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json({ user }, { headers: { 'Cache-Control': 'no-store' } });
}
