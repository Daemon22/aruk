import { apiBank } from '@/lib/api-bank';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const perPage = parseInt(searchParams.get('perPage') || '20');
  const accountId = searchParams.get('accountId') || undefined;
  const status = searchParams.get('status') || undefined;

  const result = await apiBank.getUsageLogs(page, perPage, { accountId, status });
  return NextResponse.json(result);
}