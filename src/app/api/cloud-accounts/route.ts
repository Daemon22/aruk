import { keeper } from '@/lib/keeper';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get('provider') || undefined;
  const status = searchParams.get('status') || undefined;

  try {
    const accounts = await keeper.listCloudAccounts(
      user.id,
      provider ? { provider: provider as any, status: status as any } : undefined
    );
    return NextResponse.json({ ok: true, data: accounts, meta: { timestamp: new Date().toISOString() } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message, data: null, meta: { timestamp: new Date().toISOString() } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  try {
    const body = await req.json();
    if (!body.name || !body.provider || !body.bucketName || !body.credentials) {
      return NextResponse.json({ ok: false, error: 'name, provider, bucketName, and credentials are required', data: null }, { status: 400 });
    }

    const account = await keeper.connectCloudAccount(user.id, {
      name: body.name,
      provider: body.provider,
      projectId: body.projectId,
      bucketName: body.bucketName,
      region: body.region,
      credentials: body.credentials,
      credentialsMasked: body.credentialsMasked,
      notes: body.notes,
    });

    return NextResponse.json({ ok: true, data: account, meta: { timestamp: new Date().toISOString() } }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message, data: null, meta: { timestamp: new Date().toISOString() } }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ ok: false, error: 'id is required' }, { status: 400 });
  }
  try {
    await keeper.disconnectCloudAccount(user.id, id);
    return NextResponse.json({ ok: true, data: { disconnected: true }, meta: { timestamp: new Date().toISOString() } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message, data: null, meta: { timestamp: new Date().toISOString() } }, { status: 500 });
  }
}
