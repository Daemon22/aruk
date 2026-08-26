import { keeper } from '@/lib/keeper';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const effect = searchParams.get('effect') as any || undefined;
  const resourceType = searchParams.get('resourceType') || undefined;
  const status = searchParams.get('status') || undefined;
  const policies = await keeper.listPolicies(
    user.id,
    effect || resourceType || status ? { effect, resourceType, status } : undefined
  );
  return NextResponse.json(policies);
}

export async function POST(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const body = await req.json();
  const policy = await keeper.createPolicy(user.id, body);
  return NextResponse.json(policy, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const body = await req.json();

  if (body.action === 'evaluate') {
    const { action, ...request } = body;
    if (!request.actorName || !request.resourceType) {
      return NextResponse.json({ error: 'actorName and resourceType required' }, { status: 400 });
    }
    const decision = await keeper.evaluateAccess(user.id, request);
    return NextResponse.json(decision);
  }

  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { id, ...data } = body;
  const policy = await keeper.updatePolicy(user.id, id, data);
  return NextResponse.json(policy);
}

export async function DELETE(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await keeper.deletePolicy(user.id, id);
  return NextResponse.json({ ok: true });
}