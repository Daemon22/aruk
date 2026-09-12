import { apiBank } from '@/lib/api-bank';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

<<<<<<< HEAD
  const providers = await apiBank.listProviders(user.id);
=======
  const providers = await apiBank.listProviders();
>>>>>>> 193e563eec90177528092e21ed6ea88aad226193
  return NextResponse.json(providers);
}
