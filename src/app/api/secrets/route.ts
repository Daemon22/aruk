import { secretVault } from '@/lib/api-bank';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

function maskSecretValue(value: string): string {
  if (!value) return '••••••';
  if (value.length <= 8) return '••••••';
  return `${value.slice(0, 3)}••••${value.slice(-3)}`;
}

export async function GET(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const secrets = await secretVault.list({
    userId: user.id,
    type: (searchParams.get('type') as any) || undefined,
    provider: searchParams.get('provider') || undefined,
    purpose: (searchParams.get('purpose') as any) || undefined,
    status: searchParams.get('status') || undefined,
  });
  const safe = secrets.map(({ credentials, ...rest }) => ({
    ...rest,
    fields: Object.keys(credentials),
    credentials: Object.fromEntries(Object.entries(credentials).map(([key, value]) => [key, maskSecretValue(value)])),
  }));
  return NextResponse.json(safe);
}

export async function POST(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const body = await req.json();
  if (body.action === 'reveal') {
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const secret = await secretVault.get(body.id, user.id);
    if (!secret) return NextResponse.json({ error: 'secret not found' }, { status: 404 });
    return NextResponse.json(secret);
  }
  const secret = await secretVault.add({ ...body, userId: user.id });
  return NextResponse.json(secret, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const body = await req.json();
  const { id, ...data } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const secret = await secretVault.update(id, user.id, data);
  return NextResponse.json(secret);
}

export async function DELETE(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await secretVault.delete(id, user.id);
  return NextResponse.json({ ok: true });
}