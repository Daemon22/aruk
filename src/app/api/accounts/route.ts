import { apiBank } from '@/lib/api-bank';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') as any || undefined;
  const provider = searchParams.get('provider') || undefined;

  const accounts = await apiBank.listAccounts(
    { userId: user.id, ...(status || provider ? { status, provider } : {}) }
  );
  return NextResponse.json(accounts.map(({ apiKey: _maskedKey, ...account }) => account));
}

export async function POST(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const body = await req.json();

  // Batch mode: body.apiKeys is an array of strings
  if (body.apiKeys && Array.isArray(body.apiKeys) && body.apiKeys.length > 0) {
    const results = await apiBank.addAccounts({
      providerName: body.providerName,
      namePrefix: body.namePrefix || body.name || 'Key',
      apiKeys: body.apiKeys.filter((k: string) => k.trim()),
      status: body.status,
      priority: body.priority,
      totalCredits: body.totalCredits,
      creditUnit: body.creditUnit,
      userId: user.id,
    });
    return NextResponse.json({ created: results.length, accounts: results.map(({ apiKey: _maskedKey, ...account }) => account) }, { status: 201 });
  }

  // Single key mode (backward compatible)
  const account = await apiBank.addAccount({ ...body, userId: user.id });
  const { apiKey: _maskedKey, ...safeAccount } = account;
  return NextResponse.json(safeAccount, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const body = await req.json();
  const { id, ...data } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // System-tracked fields — read-only, like a bank balance.
  // These are updated internally by usage reporting and health checks.
  const protectedFields = [
    'totalCredits', 'usedCredits', 'creditUnit',
    'healthScore', 'avgLatencyMs', 'successRate',
    'totalRequests', 'todayRequests', 'errorCount',
    'lastUsedAt', 'remainingCredits', 'remainingPercent',
    'createdAt', 'updatedAt',
  ];
  for (const field of protectedFields) {
    delete (data as Record<string, unknown>)[field];
  }

  const account = await apiBank.updateAccount(user.id, id, data);
  const { apiKey: _maskedKey, ...safeAccount } = account;
  return NextResponse.json(safeAccount);
}

export async function DELETE(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await apiBank.deleteAccount(user.id, id);
  return NextResponse.json({ ok: true });
}