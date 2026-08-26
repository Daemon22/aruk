import { keeper } from '@/lib/keeper';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const stats = searchParams.get('stats') === 'true';

  if (stats) {
    const auditStats = await keeper.getAuditStats(user.id);
    return NextResponse.json(auditStats);
  }

  const page = parseInt(searchParams.get('page') || '1');
  const perPage = parseInt(searchParams.get('perPage') || '50');
  const actorName = searchParams.get('actorName') || undefined;
  const action = searchParams.get('action') || undefined;
  const resourceType = searchParams.get('resourceType') || undefined;
  const outcome = searchParams.get('outcome') || undefined;

  const result = await keeper.getAuditEvents(
    user.id,
    actorName || action || resourceType || outcome
      ? { actorName, action, resourceType, outcome }
      : undefined,
    page,
    perPage
  );
  return NextResponse.json(result);
}
