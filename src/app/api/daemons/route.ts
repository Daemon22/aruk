import { keeper } from '@/lib/keeper';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const role = searchParams.get('role') as any || undefined;
  const status = searchParams.get('status') as any || undefined;
  const daemons = await keeper.listDaemons(user.id, role || status ? { role, status } : undefined);
  return NextResponse.json(daemons);
}

export async function POST(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const body = await req.json();
  const daemon = await keeper.registerDaemon(user.id, body);
  return NextResponse.json(daemon, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { id, ...data } = body;
  const daemon = await keeper.updateDaemon(user.id, id, data);
  return NextResponse.json(daemon);
}

export async function DELETE(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await keeper.revokeDaemon(user.id, id);
  return NextResponse.json({ ok: true });
}