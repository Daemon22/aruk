import { apiBank, RoutingStrategy } from '@/lib/api-bank';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const strategy = (searchParams.get('strategy') || 'best') as RoutingStrategy;
  const provider = searchParams.get('provider') || undefined;

  try {
    if (provider) {
      const decision = await apiBank.routeForProvider(provider, user.id, strategy);
      return NextResponse.json(decision);
    }
    const decision = await apiBank.route(user.id, strategy);
    return NextResponse.json(decision);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 503 });
  }
}
