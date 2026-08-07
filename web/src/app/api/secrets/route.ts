import { secretVault } from '@/lib/api-bank';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secrets = await secretVault.list({
    type: (searchParams.get('type') as any) || undefined,
    provider: searchParams.get('provider') || undefined,
    purpose: (searchParams.get('purpose') as any) || undefined,
    status: searchParams.get('status') || undefined,
  });
  return NextResponse.json(secrets);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const secret = await secretVault.add(body);
  return NextResponse.json(secret, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, ...data } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const secret = await secretVault.update(id, data);
  return NextResponse.json(secret);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await secretVault.delete(id);
  return NextResponse.json({ ok: true });
}