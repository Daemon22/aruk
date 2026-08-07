import { apiBank } from '@/lib/api-bank';
import { NextResponse } from 'next/server';

export async function GET() {
  const providers = await apiBank.listProviders();
  return NextResponse.json(providers);
}