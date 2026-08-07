import { apiBank } from '@/lib/api-bank';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const account = await apiBank.toggleAccountStatus(id);
  return NextResponse.json(account);
}