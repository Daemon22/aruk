import { keeper } from '@/lib/keeper';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') as any || undefined;
  const daemonId = searchParams.get('daemonId') || undefined;
  const resourceType = searchParams.get('resourceType') || undefined;
  const passes = await keeper.listPasses(
    user.id,
    status || daemonId || resourceType ? { status, daemonId, resourceType } : undefined
  );
  return NextResponse.json(passes);
}

export async function POST(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const body = await req.json();
  const pass = await keeper.issuePass(user.id, body);
  return NextResponse.json(pass, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();

  if (body.action === 'use') {
    // Pass tokens are bearer capability tokens by design — presenting the
    // token is the authorization, so this intentionally isn't gated behind
    // getSession()/userId (that would defeat the point of an issuable,
    // portable pass an agent can carry independently of a login session).
    if (!body.token) return NextResponse.json({ error: 'token required' }, { status: 400 });
    const decision = await keeper.usePass(body.token);
    return NextResponse.json(decision);
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await keeper.revokePass(user.id, id);
  return NextResponse.json({ ok: true });
}