import { apiBank, secretVault, RoutingStrategy, SecretType, SecretPurpose } from '@/lib/api-bank';
import { keeper } from '@/lib/keeper';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { ARUK_ORIGIN_NAME } from '@/lib/origin';

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
  return { ok: true, data, meta: { timestamp: new Date().toISOString(), origin: ARUK_ORIGIN_NAME, ...meta } };
}

function errorEnvelope(msg: string, status: number) {
  return NextResponse.json({ ok: false, error: msg, data: null, meta: { timestamp: new Date().toISOString(), origin: ARUK_ORIGIN_NAME } }, { status });
}

// ── Gate Check Helper ──────────────────────────────────
// Every key/secret request passes through Aruk's gate.
// The gate holds — no matter what, and no matter against whom.

async function checkGate(req: NextRequest, userId: string, resourceType: string, scope: string = 'read', resourceId?: string): Promise<{ allowed: boolean; reason: string; actorName: string }> {
  const passToken = req.headers.get('x-aruk-pass');
  const actorName = req.headers.get('x-aruk-actor') || 'unidentified';
  const actorRole = req.headers.get('x-aruk-role') || undefined;
  let daemonId: string | undefined;

  // If a pass token is provided, validate it first
  if (passToken) {
    const passDecision = await keeper.usePass(passToken);
    if (!passDecision.allowed) {
      return { allowed: false, reason: passDecision.reason, actorName };
    }
    daemonId = passDecision.daemonId || undefined;
  }

  // Then evaluate access policies. With no pass token and no matching
  // policy, this now denies by default — see evaluateAccess().
  const decision = await keeper.evaluateAccess(userId, {
    actorName,
    actorRole,
    daemonId,
    resourceType,
    resourceId,
    scope,
    reason: `Agent requesting ${scope} access to ${resourceType}`,
  });

  return { ...decision, actorName };
}

// ── GET /api/agent ────────────────────────────────────────────
// Quick one-shot: get the best key for a provider
// ?provider=OpenAI&strategy=fastest
export async function GET(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get('provider') || undefined;
  const strategy = (searchParams.get('strategy') || 'best') as RoutingStrategy;
  const hideKey = searchParams.get('hideKey') === 'true';
  const accountId = searchParams.get('accountId') || undefined;

  if (!STRATEGIES.includes(strategy)) {
    return errorEnvelope(`Invalid strategy. Use: ${STRATEGIES.join(', ')}`, 400);
  }

  try {
    // Gate check for GET requests too
    const gate = await checkGate(req, user.id, 'api_account', 'read', accountId);
    if (!gate.allowed) {
      return NextResponse.json({
        ok: false, error: `Gate denied: ${gate.reason}`, data: null,
        meta: { timestamp: new Date().toISOString(), origin: ARUK_ORIGIN_NAME, actor: gate.actorName, gate: 'denied' },
      }, { status: 403 });
    }

    const decision = accountId
      ? await apiBank.getKeyForAccount(user.id, accountId, strategy)
      : provider
        ? await apiBank.routeForProvider(provider, strategy, user.id)
        : await apiBank.route(strategy, user.id);

    const payload = {
      ...decision,
      apiKey: hideKey ? '••••••' : decision.apiKey,
      gate: 'allowed',
    };

    return NextResponse.json(envelope(payload, { provider, strategy, actor: gate.actorName }));
  } catch (e: any) {
    return errorEnvelope(e.message, 503);
  }
}

// ── POST /api/agent ───────────────────────────────────────────
// Structured actions for agents
export async function POST(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

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
        // Gate check: every key request passes through Aruk
        const gate = await checkGate(req, user.id, 'api_account', 'read', body.accountId as string | undefined);
        if (!gate.allowed) {
          return NextResponse.json({
            ok: false, error: `Gate denied: ${gate.reason}`, data: null,
            meta: { timestamp: new Date().toISOString(), origin: ARUK_ORIGIN_NAME, actor: gate.actorName, gate: 'denied' },
          }, { status: 403 });
        }

        const strategy = STRATEGIES.includes(body.strategy as RoutingStrategy)
          ? (body.strategy as RoutingStrategy) : 'best';
        let decision;
        if (body.accountId) {
          const account = await apiBank.getAccount(user.id, body.accountId as string);
          if (!account || account.status !== 'active') return errorEnvelope('API account not found or inactive', 404);
          // The normal account view is masked, so fetch the actual credential only
          // through the gated account-specific routing path.
          decision = await apiBank.getKeyForAccount(user.id, body.accountId as string, strategy);
        } else {
          decision = body.provider
            ? await apiBank.routeForProvider(body.provider as string, strategy, user.id)
            : await apiBank.route(strategy, user.id);
        }

        return NextResponse.json(envelope({
          apiKey: body.hideKey ? '••••••' : decision.apiKey,
          provider: decision.providerName,
          account: decision.accountName,
          accountId: decision.accountId,
          strategy: decision.strategy,
          healthScore: decision.healthScore,
          remainingCredits: decision.remainingPercent + '%',
          reason: decision.reason,
          gate: 'allowed',
        }, { action: 'get_key', actor: gate.actorName }));
      }

      // ── status: Quick health check of the bank ────────
      case 'status': {
        const [stats, credits] = await Promise.all([
          apiBank.getStats(user.id),
          apiBank.getCreditsByProvider(user.id),
        ]);
        return NextResponse.json(envelope({ stats, creditsByProvider: credits }, { action: 'status' }));
      }

      // ── list: List accounts with optional filter ──────
      case 'list': {
        const accounts = await apiBank.listAccounts(
          { userId: user.id, ...(body.provider ? { provider: body.provider as string } : {}) }
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
          userId: user.id,
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
          userId: user.id,
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
          endpoint: '/v1/chat/completions',
          status: 'success',
        });
        return NextResponse.json(envelope({ logged: true, accountId: body.id as string }, { action: 'report_usage' }));
      }

      // ── failover: Get the full failover chain ─────────
      case 'failover': {
        const chain = await apiBank.getFailoverChain(user.id);
        const safe = chain.map(({ apiKey, ...rest }: any) => ({
          ...rest,
          credits: rest.creditUnit === 'unlimited' ? 'Unlimited' : `${rest.remainingPercent}% remaining`,
        }));
        return NextResponse.json(envelope(safe, { action: 'failover', length: safe.length }));
      }

      // ── get_secret: Agent asks for any kind of stored secret ────────
      // Secrets are not required to be API keys. A credential bundle may be
      // a password, token, OAuth pair, service-account JSON fields, certificate,
      // SSH material, or arbitrary named fields. Access is policy-gated.
      case 'get_secret': {
        if (!body.id && !body.name && !body.purpose) {
          return errorEnvelope('Provide id, name, or purpose to identify the secret', 400);
        }
        const secretGate = await checkGate(req, user.id, 'secret', 'read', body.id as string | undefined);
        if (!secretGate.allowed) {
          return NextResponse.json({
            ok: false, error: `Gate denied: ${secretGate.reason}`, data: null,
            meta: { timestamp: new Date().toISOString(), origin: ARUK_ORIGIN_NAME, actor: secretGate.actorName, gate: 'denied' },
          }, { status: 403 });
        }

        let secret = body.id
          ? await secretVault.get(body.id as string, user.id)
          : body.name
            ? await secretVault.getByName(body.name as string, body.provider as string | undefined, user.id)
            : await secretVault.getByPurpose(body.purpose as SecretPurpose, body.provider as string | undefined, user.id);
        if (!secret || secret.status !== 'active' || (secret.expiresAt && secret.expiresAt.getTime() <= Date.now())) {
          return errorEnvelope('No active matching secret found', 404);
        }
        await secretVault.touch(secret.id, user.id);
        const showCreds = body.hideCredentials !== true;
        const field = typeof body.field === 'string' ? body.field : undefined;
        const credentials = field
          ? (field in secret.credentials ? { [field]: secret.credentials[field] } : {})
          : secret.credentials;
        if (field && Object.keys(credentials).length === 0) return errorEnvelope(`Credential field not found: ${field}`, 404);
        return NextResponse.json(envelope({
          id: secret.id,
          name: secret.name,
          type: secret.type,
          provider: secret.provider,
          purpose: secret.purpose,
          credentials: showCreds ? credentials : { _masked: true },
          gate: 'allowed',
        }, { action: 'get_secret', actor: secretGate.actorName }));
      }

      // ── list_secrets: Agent lists vault entries ─────────
      case 'list_secrets': {
        const secrets = await secretVault.list({
          userId: user.id,
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
          userId: user.id,
        });
        return NextResponse.json(envelope({
          id: secret.id,
          name: secret.name,
          type: secret.type,
          provider: secret.provider,
          purpose: secret.purpose,
        }, { action: 'add_secret' }), { status: 201 });
      }

      // ── get_cloud_credentials: release connected cloud credentials ───
      // This is deliberately separate from get_secret because CloudAccount is
      // a first-class connection. It lets a cloud agent use AWS/GCP/Azure/etc.
      // credentials without pretending they are API keys.
      case 'get_cloud_credentials': {
        if (!body.cloudAccountId) return errorEnvelope('cloudAccountId is required', 400);
        const cloudGate = await checkGate(req, user.id, 'cloud_account', 'read', body.cloudAccountId as string | undefined);
        if (!cloudGate.allowed) {
          return NextResponse.json({ ok: false, error: `Gate denied: ${cloudGate.reason}`, data: null, meta: { timestamp: new Date().toISOString(), origin: ARUK_ORIGIN_NAME, actor: cloudGate.actorName, gate: 'denied' } }, { status: 403 });
        }
        const cloud = await keeper.getCloudAccountCredentials(user.id, body.cloudAccountId as string);
        if (!cloud) return errorEnvelope('Cloud account not found or inactive', 404);
        return NextResponse.json(envelope({ ...cloud, gate: 'allowed' }, { action: 'get_cloud_credentials', actor: cloudGate.actorName }));
      }

      // ── offload: Agent sends data to connected cloud storage ───
      case 'offload': {
        const cloudGate = await checkGate(req, user.id, 'cloud_account', 'write');
        if (!cloudGate.allowed) {
          return NextResponse.json({
            ok: false, error: `Gate denied: ${cloudGate.reason}`, data: null,
            meta: { timestamp: new Date().toISOString(), origin: ARUK_ORIGIN_NAME, actor: cloudGate.actorName, gate: 'denied' },
          }, { status: 403 });
        }
        if (!body.cloudAccountId || !body.agentName || !body.direction || !body.remotePath) {
          return errorEnvelope('cloudAccountId, agentName, direction, and remotePath are required', 400);
        }
        const offload = await keeper.logPassage(user.id, {
          cloudAccountId: body.cloudAccountId as string,
          agentName: body.agentName as string,
          direction: body.direction as 'outbound' | 'inbound',
          remotePath: body.remotePath as string,
          sizeBytes: body.sizeBytes as number | undefined,
        });
        return NextResponse.json(envelope(offload, { action: 'offload', actor: cloudGate.actorName }));
      }

      default:
        return errorEnvelope(
          `Unknown action: "${action}". Use: get_key, status, list, add_key, add_keys, report_usage, failover, get_secret, list_secrets, add_secret, get_cloud_credentials, offload`,
          400
        );
    }
  } catch (e: any) {
    return errorEnvelope(e.message, 500);
  }
}