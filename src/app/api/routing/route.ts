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
<<<<<<< HEAD
      const decision = await apiBank.routeForProvider(provider, user.id, strategy);
      return NextResponse.json(decision);
    }
    const decision = await apiBank.route(user.id, strategy);
=======
      const decision = await apiBank.routeForProvider(provider, strategy, user.id);
      return NextResponse.json(decision);
    }
    const decision = await apiBank.route(strategy, user.id);
>>>>>>> 193e563eec90177528092e21ed6ea88aad226193
    return NextResponse.json(decision);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 503 });
  }
}
