import { apiBank } from '@/lib/api-bank';
import { NextResponse } from 'next/server';

export async function GET() {
  const monitor = await apiBank.getCreditMonitor();
  return NextResponse.json(monitor);
}