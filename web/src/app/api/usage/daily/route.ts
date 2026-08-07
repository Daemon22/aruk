import { apiBank } from '@/lib/api-bank';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get('days') || '30');
  const data = await apiBank.getDailyUsage(days);
  return NextResponse.json(data);
}