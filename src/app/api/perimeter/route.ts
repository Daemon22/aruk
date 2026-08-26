import { keeper } from '@/lib/keeper';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const direction = searchParams.get('direction') as any || undefined;
  const status = searchParams.get('status') || undefined;
  const rules = await keeper.listPassageRules(
    user.id,
    direction || status ? { direction, status } : undefined
  );
  return NextResponse.json(rules);
}

export async function POST(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const body = await req.json();
  const rule = await keeper.createPassageRule(user.id, body);
  return NextResponse.json(rule, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { id, ...data } = body;
  const rule = await keeper.updatePassageRule(user.id, id, data);
  return NextResponse.json(rule);
}

export async function DELETE(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await keeper.deletePassageRule(user.id, id);
  return NextResponse.json({ ok: true });
}