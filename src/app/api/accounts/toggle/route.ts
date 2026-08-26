import { apiBank } from '@/lib/api-bank';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // Verify the account belongs to this user
  const account = await db.apiAccount.findUnique({ where: { id } });
  if (!account || account.userId !== user.id) {
    return NextResponse.json({ error: 'account not found' }, { status: 404 });
  }

  const result = await apiBank.toggleAccountStatus(user.id, id);
  return NextResponse.json(result);
}