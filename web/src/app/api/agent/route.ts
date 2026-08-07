import { apiBank, secretVault, RoutingStrategy, SecretType, SecretPurpose } from '@/lib/api-bank';
import { NextRequest, NextResponse } from 'next/server';

// ============================================================
// Agent API — for AI intelligences to consume Aruk
// ============================================================
// All responses use a consistent envelope: { ok, data, error, meta }
// Agents can call this with ?provider=openai or POST { action: "..." }
// ============================================================

const STRATEGIES: RoutingStrategy[] = [
  'best', 'fastest', 'cheapest', 'highest_quality', 'round_robin', 'load_balance',
];

function envelope(data: unknown, meta?: Record<string, unknown>) {
  return { ok: true, data, meta: { timestamp: new Date().toISOString(), ...meta } };
}

function errorEnvelope(msg: string, status: number) {
  return NextResponse.json({ ok: false, error: msg, data: null, meta: { timestamp: new Date().toISOString() } }, { status });
}

// ── GET /api/agent ────────────────────────────────────────────
// Quick one-shot: get the best key for a provider
// ?provider=OpenAI&strategy=fastest
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const provider = searchParams.get('provider') || undefined;
  const strategy = (searchParams.get('strategy') || 'best') as RoutingStrategy;
  const hideKey = searchParams.get('hideKey') === 'true';

  if (!STRATEGIES.includes(strategy)) {
    return errorEnvelope(`Invalid strategy. Use: ${STRATEGIES.join(', ')}`, 400);
  }

  try {
    const decision = provider
      ? await apiBank.routeForProvider(provider, strategy)
      : await apiBank.route(strategy);

    const payload = {
      ...decision,
      apiKey: hideKey ? '••••••' : decision.apiKey,
    };

    return NextResponse.json(envelope(payload, { provider, strategy }));
  } catch (e: any) {
    return errorEnvelope(e.message, 503);
  }
}

// ── POST /api/agent ───────────────────────────────────────────
// Structured actions for agents
export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};

  try {
    body = await req.json();
  } catch {
    return errorEnvelope('Invalid JSON body', 400);
  }

  const { action } = body;

  try {
    switch (action) {
      // ── get_key: Get the best available key ────────────
      case 'get_key': {
        const strategy = STRATEGIES.includes(body.strategy as RoutingStrategy)
          ? (body.strategy as RoutingStrategy) : 'best';
        const decision = body.provider
          ? await apiBank.routeForProvider(body.provider as string, strategy)
          : await apiBank.route(strategy);

        return NextResponse.json(envelope({
          apiKey: body.hideKey ? '••••••' : decision.apiKey,
          provider: decision.providerName,
          account: decision.accountName,
          accountId: decision.accountId,
          strategy: decision.strategy,
          healthScore: decision.healthScore,
          remainingCredits: decision.remainingPercent + '%',
          reason: decision.reason,
        }, { action: 'get_key' }));
      }

      // ── status: Quick health check of the bank ────────
      case 'status': {
        const [stats, credits] = await Promise.all([
          apiBank.getStats(),
          apiBank.getCreditsByProvider(),
        ]);
        return NextResponse.json(envelope({ stats, creditsByProvider: credits }, { action: 'status' }));
      }

      // ── list: List accounts with optional filter ──────
      case 'list': {
        const accounts = await apiBank.listAccounts(
          body.provider ? { provider: body.provider as string } : undefined
        );
        // Strip apiKey from list unless explicitly wanted
        const safe = accounts.map(({ apiKey, ...rest }: any) => rest);
        return NextResponse.json(envelope(safe, {
          action: 'list',
          count: safe.length,
          provider: body.provider || 'all',
        }));
      }

      // ── add_key: Add a new key ────────────────────────
      case 'add_key': {
        if (!body.providerName || !body.apiKey) {
          return errorEnvelope('providerName and apiKey are required', 400);
        }
        const account = await apiBank.addAccount({
          providerName: body.providerName as string,
          name: (body.name as string) || `Agent-added ${new Date().toISOString().split('T')[0]}`,
          apiKey: body.apiKey as string,
          priority: 5,
        });
        return NextResponse.json(envelope({
          id: account.id,
          name: account.name,
          provider: account.providerName,
          status: account.status,
        }, { action: 'add_key' }), { status: 201 });
      }

      // ── add_keys: Batch add multiple keys ─────────────
      case 'add_keys': {
        if (!body.providerName || !(body.apiKeys as unknown[])?.length) {
          return errorEnvelope('providerName and apiKeys[] are required', 400);
        }
        const accounts = await apiBank.addAccounts({
          providerName: body.providerName as string,
          namePrefix: (body.namePrefix as string) || `Batch ${Date.now().toString(36)}`,
          apiKeys: body.apiKeys as string[],
        });
        return NextResponse.json(envelope({
          created: accounts.length,
          accounts: accounts.map(a => ({ id: a.id, name: a.name, provider: a.providerName })),
        }, { action: 'add_keys' }), { status: 201 });
      }

      // ── report_usage: Log a usage event ───────────────
      case 'report_usage': {
        if (!body.id) {
          return errorEnvelope('id (accountId) is required', 400);
        }
        await apiBank.logUsage({
          accountId: body.id as string,
          endpoint: (body.endpoint as string) || '/v1/chat/completions',
          model: body.model as string | undefined,
          inputTokens: body.inputTokens as number | undefined,
          outputTokens: body.outputTokens as number | undefined,
          cost: body.cost as number | undefined,
          latencyMs: body.latencyMs as number | undefined,
          status: (body.status as string) || 'success',
          errorMessage: body.errorMessage as string | undefined,
        });
        return NextResponse.json(envelope({ logged: true, accountId: body.id as string }, { action: 'report_usage' }));
      }

      // ── failover: Get the full failover chain ─────────
      case 'failover': {
        const chain = await apiBank.getFailoverChain();
        const safe = chain.map(({ apiKey, ...rest }: any) => ({
          ...rest,
          credits: rest.creditUnit === 'unlimited' ? 'Unlimited' : `${rest.remainingPercent}% remaining`,
        }));
        return NextResponse.json(envelope(safe, { action: 'failover', length: safe.length }));
      }

      // ── get_secret: Agent asks for credentials ────────
      case 'get_secret': {
        if (!body.purpose) {
          return errorEnvelope('purpose is required (cloud_storage, email, database, ai_api, deployment, identity, other)', 400);
        }
        const secret = await secretVault.getByPurpose(body.purpose as SecretPurpose, body.provider as string | undefined);
        if (!secret) {
          return errorEnvelope(`No active secret found for purpose: ${body.purpose}${body.provider ? ` (${body.provider})` : ''}`, 404);
        }
        await secretVault.touch(secret.id);
        const showCreds = body.hideCredentials !== true;
        return NextResponse.json(envelope({
          id: secret.id,
          name: secret.name,
          type: secret.type,
          provider: secret.provider,
          purpose: secret.purpose,
          credentials: showCreds ? secret.credentials : { _masked: true },
        }, { action: 'get_secret' }));
      }

      // ── list_secrets: Agent lists vault entries ─────────
      case 'list_secrets': {
        const secrets = await secretVault.list({
          purpose: body.purpose as SecretPurpose | undefined,
          provider: body.provider as string | undefined,
          type: body.type as SecretType | undefined,
        });
        // Never expose credentials in list
        const safe = secrets.map(({ credentials, ...rest }: any) => ({
          ...rest,
          fields: Object.keys(credentials),
        }));
        return NextResponse.json(envelope(safe, {
          action: 'list_secrets',
          count: safe.length,
        }));
      }

      // ── add_secret: Agent stores a secret ───────────────
      case 'add_secret': {
        if (!body.name || !body.type || !body.provider || !body.credentials) {
          return errorEnvelope('name, type, provider, and credentials are required', 400);
        }
        const b = body as Record<string, unknown>;
        const secret = await secretVault.add({
          name: b.name as string,
          type: b.type as SecretType,
          provider: b.provider as string,
          purpose: b.purpose as SecretPurpose | undefined,
          credentials: b.credentials as Record<string, string>,
          notes: b.notes as string | undefined,
        });
        return NextResponse.json(envelope({
          id: secret.id,
          name: secret.name,
          type: secret.type,
          provider: secret.provider,
          purpose: secret.purpose,
        }, { action: 'add_secret' }), { status: 201 });
      }

      default:
        return errorEnvelope(
          `Unknown action: "${action}". Use: get_key, status, list, add_key, add_keys, report_usage, failover, get_secret, list_secrets, add_secret`,
          400
        );
    }
  } catch (e: any) {
    return errorEnvelope(e.message, 500);
  }
}