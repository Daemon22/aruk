import { keeper } from '@/lib/keeper';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

async function checkOffloadGate(userId: string, req: NextRequest, cloudAccountId: string, scope: 'write' | 'read') {
  const passToken = req.headers.get('x-aruk-pass');
  const actorName = req.headers.get('x-aruk-actor') || 'user';
  const actorRole = req.headers.get('x-aruk-role') || undefined;
  let daemonId: string | undefined;
  if (passToken) {
    const pass = await keeper.usePass(passToken, { resourceType: 'cloud_account', resourceId: cloudAccountId, scope });
    if (!pass.allowed) return { allowed: false, reason: pass.reason };
    daemonId = pass.daemonId || undefined;
  }
  return keeper.evaluateAccess(userId, { actorName, actorRole, daemonId, resourceType: 'cloud_account', resourceId: cloudAccountId, scope, reason: `Offload ${scope} request for cloud account` });
}


// ── Passage Log API ───────────────────────────────────────
// Aruk tracks data passage in and out of connected cloud storage.
// Passage logs are append-only — no modification, no deletion.

export async function GET(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const stats = searchParams.get('stats') === 'true';
  const cloudAccountId = searchParams.get('cloudAccountId') || undefined;
  const agentName = searchParams.get('agentName') || undefined;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const perPage = parseInt(searchParams.get('perPage') || '50', 10);

  try {
    if (stats) {
      const passageStats = await keeper.getPassageStats(user.id);
      return NextResponse.json({ ok: true, data: passageStats, meta: { timestamp: new Date().toISOString() } });
    }

    const result = await keeper.listPassageLogs(
      user.id,
      cloudAccountId || agentName ? { cloudAccountId, agentName } : undefined,
      page,
      perPage,
    );

    return NextResponse.json({ ok: true, data: result, meta: { timestamp: new Date().toISOString() } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message, data: null, meta: { timestamp: new Date().toISOString() } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  try {
    const body = await req.json();

    if (!body.cloudAccountId || !body.agentName || !body.direction || !body.remotePath) {
      return NextResponse.json({
        ok: false,
        error: 'cloudAccountId, agentName, direction, and remotePath are required',
        data: null,
      }, { status: 400 });
    }

    const gate = await checkOffloadGate(user.id, req, body.cloudAccountId as string, 'write');
    if (!gate.allowed) return NextResponse.json({ ok: false, error: `Gate denied: ${gate.reason}`, data: null }, { status: 403 });

    const passage = await keeper.logPassage(user.id, {
      cloudAccountId: body.cloudAccountId,
      agentName: body.agentName,
      direction: body.direction,
      remotePath: body.remotePath,
      sizeBytes: body.sizeBytes,
    });

    return NextResponse.json({ ok: true, data: passage, meta: { timestamp: new Date().toISOString() } }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message, data: null, meta: { timestamp: new Date().toISOString() } }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  try {
    const body = await req.json();

    if (body.action === 'retrieve') {
      if (!body.id) {
        return NextResponse.json({ ok: false, error: 'id required', data: null }, { status: 400 });
      }
      const original = await keeper.getPassageLog(user.id, body.id);
      if (!original) {
        return NextResponse.json({ ok: false, error: 'Offload record not found', data: null }, { status: 404 });
      }
      const gate = await checkOffloadGate(user.id, req, original.cloudAccountId, 'read');
      if (!gate.allowed) return NextResponse.json({ ok: false, error: `Gate denied: ${gate.reason}`, data: null }, { status: 403 });
      // Aruk keeps a ledger of what crossed the perimeter — it doesn't
      // store the bytes themselves. "Retrieving" an offload is recorded
      // as a new inbound passage event for the same remote path, so the
      // log stays a true append-only record of both directions of travel.
      const retrieval = await keeper.logPassage(user.id, {
        cloudAccountId: original.cloudAccountId,
        agentName: original.agentName,
        direction: 'inbound',
        remotePath: original.remotePath,
        sizeBytes: original.sizeBytes,
      });
      return NextResponse.json({ ok: true, data: retrieval, meta: { timestamp: new Date().toISOString() } });
    }

    return NextResponse.json({ ok: false, error: 'unknown action', data: null }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message, data: null, meta: { timestamp: new Date().toISOString() } }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  // Passage logs are append-only by design (see header comment) — this
  // responds clearly rather than letting the framework's default 405
  // through, so SDK callers get an explicit reason instead of silence.
  return NextResponse.json(
    { ok: false, error: 'Passage logs are append-only and cannot be deleted', data: null },
    { status: 405 }
  );
}
