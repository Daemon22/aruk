import { apiBank } from '@/lib/api-bank';
import { NextResponse } from 'next/server';

export async function GET() {
  const [stats, credits, failover] = await Promise.all([
    apiBank.getStats(),
    apiBank.getCreditsByProvider(),
    apiBank.getFailoverChain(),
  ]);
  return NextResponse.json({ stats, credits, failover });
}