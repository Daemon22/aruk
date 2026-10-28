// ============================================================
// API Bank — Core Engine (Layer 1: Headless)
// ============================================================
// This file is the heart of the system. It contains no GUI and
// no terminal interface — just the logic.
//
// Everything else (Web, CLI, SDK, Agent Plugin) imports this.
// ============================================================

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { encryptJson, decryptJson, encryptSecret, decryptSecret, isEncryptedSecret } from '@/lib/crypto';

// ─── Types ───────────────────────────────────────────────────

export type AccountStatus = 'active' | 'expired' | 'disabled' | 'backup';
export type CreditUnit = 'USD' | 'requests' | 'tokens' | 'unlimited';
export type RoutingStrategy = 'best' | 'fastest' | 'cheapest' | 'highest_quality' | 'round_robin' | 'load_balance';

export interface AccountWithProvider {
  id: string;
  name: string;
  providerId: string;
  providerName: string;
  providerDescription: string;
  apiKey: string;
  status: AccountStatus;
  priority: number;
  totalCredits: number;
  usedCredits: number;
  creditUnit: CreditUnit;
  healthScore: number;
  avgLatencyMs: number;
  successRate: number;
  totalRequests: number;
  todayRequests: number;
  errorCount: number;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  notes: string | null;
  // computed
  remainingCredits: number;
  remainingPercent: number;
}

export interface BankStats {
  totalAccounts: number;
  activeAccounts: number;
  healthyAccounts: number;
  warningAccounts: number;
  offlineAccounts: number;
  totalCreditsRemaining: number;
  avgCreditsRemaining: number;
  todayRequests: number;
  avgCostPerRequest: number;
  currentBestProvider: string | null;
  backupProvider: string | null;
  emergencyProvider: string | null;
}

export interface RoutingDecision {
  accountId: string;
  accountName: string;
  providerName: string;
  apiKey: string;
  strategy: RoutingStrategy;
  reason: string;
  healthScore: number;
  remainingPercent: number;
}

export interface DailyUsage {
  date: string;
  requests: number;
  cost: number;
  avgLatency: number;
  successRate: number;
  errors: number;
}

// ─── Core Engine ─────────────────────────────────────────────

export class ApiBank {
  private roundRobinIndex: Map<string, number> = new Map();

  // ── ACCOUNTS ──────────────────────────────────────────────

  async listAccounts(filter: { userId: string; status?: AccountStatus; provider?: string }): Promise<AccountWithProvider[]> {
    const where: Prisma.ApiAccountWhereInput = { userId: filter.userId };
    if (filter?.status) where.status = filter.status;
    if (filter?.provider) where.provider = { name: filter.provider };

    const accounts = await db.apiAccount.findMany({
      where,
      include: { provider: { select: { name: true, description: true } } },
      orderBy: [{ priority: 'desc' }, { healthScore: 'desc' }],
    });

    return accounts.map(a => this.enrichAccount(a));
  }

  async getAccount(userId: string, id: string): Promise<AccountWithProvider | null> {
    const account = await db.apiAccount.findUnique({
      where: { id, userId },
      include: { provider: { select: { name: true, description: true } } },
    });
    return account ? this.enrichAccount(account) : null;
  }

  async addAccount(data: {
    name: string;
    providerName: string;
    apiKey: string;
    status?: AccountStatus;
    priority?: number;
    totalCredits?: number;
    creditUnit?: CreditUnit;
    notes?: string;
    userId: string;
  }): Promise<AccountWithProvider> {
    let provider = await db.provider.findUnique({ where: { name: data.providerName } });
    if (!provider) {
      provider = await db.provider.create({ data: { name: data.providerName } });
    }

    const id = `${data.providerName.toLowerCase().replace(/\s+/g, '-')}-${data.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString(36)}`;
    const account = await db.apiAccount.create({
      data: {
        id,
        name: data.name,
        providerId: provider.id,
        apiKey: encryptSecret(data.apiKey),
        status: data.status || 'active',
        priority: data.priority ?? 5,
        totalCredits: data.totalCredits ?? 0,
        creditUnit: data.creditUnit ?? 'USD',
        notes: data.notes,
        userId: data.userId,
      },
      include: { provider: { select: { name: true, description: true } } },
    });

    return this.enrichAccount(account);
  }

  async addAccounts(data: {
    providerName: string;
    namePrefix: string;
    apiKeys: string[];
    status?: AccountStatus;
    priority?: number;
    totalCredits?: number;
    creditUnit?: CreditUnit;
    userId: string;
  }): Promise<AccountWithProvider[]> {
    let provider = await db.provider.findUnique({ where: { name: data.providerName } });
    if (!provider) {
      provider = await db.provider.create({ data: { name: data.providerName } });
    }

    const results: AccountWithProvider[] = [];
    for (let i = 0; i < data.apiKeys.length; i++) {
      const key = data.apiKeys[i].trim();
      if (!key) continue;
      const name = data.apiKeys.length === 1
        ? data.namePrefix
        : `${data.namePrefix} #${i + 1}`;
      const id = `${data.providerName.toLowerCase().replace(/\s+/g, '-')}-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString(36)}-${i}`;

      const account = await db.apiAccount.create({
        data: {
          id,
          name,
          providerId: provider.id,
          apiKey: encryptSecret(key),
          status: data.status || 'active',
          priority: data.priority ?? 5,
          totalCredits: data.totalCredits ?? 0,
          creditUnit: data.creditUnit ?? 'USD',
          userId: data.userId,
        },
        include: { provider: { select: { name: true, description: true } } },
      });

      results.push(this.enrichAccount(account));
    }

    return results;
  }

  async updateAccount(userId: string, id: string, data: Partial<{
    name: string;
    apiKey: string;
    status: AccountStatus;
    priority: number;
    totalCredits: number;
    usedCredits: number;
    healthScore: number;
    notes: string;
  }>): Promise<AccountWithProvider> {
    const updateData: Record<string, unknown> = { ...data };
    if (typeof data.apiKey === 'string') updateData.apiKey = encryptSecret(data.apiKey);
    const account = await db.apiAccount.update({
      where: { id, userId },
      data: updateData,
      include: { provider: { select: { name: true, description: true } } },
    });
    return this.enrichAccount(account);
  }

  async deleteAccount(userId: string, id: string): Promise<void> {
    await db.apiAccount.delete({ where: { id, userId } });
  }

  async toggleAccountStatus(userId: string, id: string): Promise<AccountWithProvider> {
    const account = await db.apiAccount.findUnique({ where: { id, userId } });
    if (!account) throw new Error('Account not found');
    const newStatus: AccountStatus = account.status === 'active' ? 'disabled' : 'active';
    return this.updateAccount(userId, id, { status: newStatus });
  }

  // ── CREDIT MONITOR ────────────────────────────────────────

  async getCreditMonitor(userId: string): Promise<AccountWithProvider[]> {
    const accounts = await db.apiAccount.findMany({
      where: { userId, status: { in: ['active', 'backup'] } },
      include: { provider: { select: { name: true, description: true } } },
      orderBy: { healthScore: 'desc' },
    });
    return accounts.map(a => this.enrichAccount(a));
  }

  async getCreditsByProvider(userId: string): Promise<Record<string, { remaining: number; total: number; percent: number; unit: string }>> {
    const whereBase: Prisma.ApiAccountWhereInput = { userId };
    const accounts = await db.apiAccount.findMany({
      where: { ...whereBase, status: { in: ['active', 'backup'] } },
      include: { provider: { select: { name: true, description: true } } },
      orderBy: { healthScore: 'desc' },
    });
    const enrichedAccounts = accounts.map(a => this.enrichAccount(a));
    const byProvider: Record<string, { remaining: number; total: number; percent: number; unit: string }> = {};

    for (const a of enrichedAccounts) {
      if (!byProvider[a.providerName]) {
        byProvider[a.providerName] = { remaining: 0, total: 0, percent: 100, unit: a.creditUnit };
      }
      byProvider[a.providerName].remaining += a.remainingCredits;
      byProvider[a.providerName].total += a.totalCredits;
    }

    for (const p of Object.values(byProvider)) {
      if (p.unit !== 'unlimited' && p.total > 0) {
        p.percent = Math.round((p.remaining / p.total) * 100);
      }
    }

    return byProvider;
  }

  // ── SMART ROUTER ──────────────────────────────────────────

  async route(userId: string, strategy: RoutingStrategy = 'best'): Promise<RoutingDecision> {
    const whereBase: Prisma.ApiAccountWhereInput = { userId };
    const active = await db.apiAccount.findMany({
      where: { ...whereBase, status: 'active' },
      include: { provider: { select: { name: true, description: true } } },
    });

    if (active.length === 0) {
      // Try backup
      const backups = await db.apiAccount.findMany({
        where: { ...whereBase, status: 'backup' },
        include: { provider: { select: { name: true, description: true } } },
      });
      if (backups.length > 0) {
        const best = backups.sort((a, b) => b.healthScore - a.healthScore)[0];
        return this.buildDecision(best, strategy, 'All active keys exhausted, using backup');
      }
      throw new Error('No available API accounts');
    }

    let selected;
    switch (strategy) {
      case 'fastest':
        selected = active.sort((a, b) => a.avgLatencyMs - b.avgLatencyMs)[0];
        break;
      case 'cheapest':
        selected = this.cheapestAccount(active);
        break;
      case 'highest_quality':
        selected = active.sort((a, b) => b.successRate - a.successRate || b.healthScore - a.healthScore)[0];
        break;
      case 'round_robin':
        selected = this.roundRobin(active);
        break;
      case 'load_balance':
        selected = active.sort((a, b) => a.todayRequests - b.todayRequests)[0];
        break;
      case 'best':
      default:
        selected = this.bestAccount(active);
        break;
    }

    await db.apiAccount.update({
      where: { id: selected.id },
      data: { lastUsedAt: new Date() },
    });

    return this.buildDecision(selected, strategy, this.getReason(selected, strategy));
  }

  async getKeyForAccount(userId: string, accountId: string, strategy: RoutingStrategy = 'best'): Promise<RoutingDecision> {
    const account = await db.apiAccount.findUnique({
      where: { id: accountId, userId },
      include: { provider: { select: { name: true, description: true } } },
    });
    if (!account) throw new Error('API account not found');
    if (account.status !== 'active') throw new Error('API account is not active');
    await db.apiAccount.update({ where: { id: account.id }, data: { lastUsedAt: new Date() } });
    return this.buildDecision(account, strategy, 'Explicit account selected by authorized caller');
  }

  async routeForProvider(providerName: string, userId: string, strategy: RoutingStrategy = 'best'): Promise<RoutingDecision> {
    const whereBase: Prisma.ApiAccountWhereInput = { userId };
    const active = await db.apiAccount.findMany({
      where: { ...whereBase, status: 'active', provider: { name: providerName } },
      include: { provider: { select: { name: true, description: true } } },
    });

    if (active.length === 0) throw new Error(`No active accounts for ${providerName}`);

    let selected;
    switch (strategy) {
      case 'fastest':
        selected = active.sort((a, b) => a.avgLatencyMs - b.avgLatencyMs)[0];
        break;
      case 'round_robin':
        selected = this.roundRobin(active, providerName);
        break;
      case 'load_balance':
        selected = active.sort((a, b) => a.todayRequests - b.todayRequests)[0];
        break;
      default:
        selected = this.bestAccount(active);
        break;
    }

    return this.buildDecision(selected, strategy, this.getReason(selected, strategy));
  }

  // ── FAILOVER CHAIN ────────────────────────────────────────

  async getFailoverChain(userId: string): Promise<AccountWithProvider[]> {
    const whereBase: Prisma.ApiAccountWhereInput = { userId };
    const accounts = await db.apiAccount.findMany({
      where: { ...whereBase, status: { in: ['active', 'backup'] } },
      include: { provider: { select: { name: true, description: true } } },
      orderBy: [{ priority: 'desc' }, { healthScore: 'desc' }],
    });
    return accounts.map(a => this.enrichAccount(a));
  }

  // ── STATS & ANALYTICS ─────────────────────────────────────

  async getStats(userId: string): Promise<BankStats> {
    const all = await db.apiAccount.findMany({
      where: { userId },
      include: { provider: { select: { name: true } } },
    });

    const active = all.filter(a => a.status === 'active');
    const healthy = active.filter(a => a.healthScore >= 80);
    const warning = active.filter(a => a.healthScore >= 50 && a.healthScore < 80);
    const offline = all.filter(a => a.status === 'expired' || a.status === 'disabled' || a.healthScore < 50);

    const totalTodayReqs = all.reduce((s, a) => s + a.todayRequests, 0);
    const paidAccounts = all.filter(a => a.creditUnit !== 'unlimited' && a.totalCredits > 0);
    const totalRemaining = paidAccounts.reduce((s, a) => s + (a.totalCredits - a.usedCredits), 0);
    const totalCredits = paidAccounts.reduce((s, a) => s + a.totalCredits, 0);

    // Best, backup, emergency
    const sorted = [...active].sort((a, b) => b.healthScore - a.healthScore);
    const unlimitedFirst = sorted.sort((a, b) => {
      if (a.creditUnit === 'unlimited' && b.creditUnit !== 'unlimited') return -1;
      if (a.creditUnit !== 'unlimited' && b.creditUnit === 'unlimited') return 1;
      return b.healthScore - a.healthScore;
    });

    return {
      totalAccounts: all.length,
      activeAccounts: active.length,
      healthyAccounts: healthy.length,
      warningAccounts: warning.length,
      offlineAccounts: offline.length,
      totalCreditsRemaining: totalRemaining,
      avgCreditsRemaining: totalCredits > 0 ? Math.round((totalRemaining / totalCredits) * 100) : 100,
      todayRequests: totalTodayReqs,
      avgCostPerRequest: totalTodayReqs > 0 ? Math.round((totalRemaining * 0.001 / totalTodayReqs) * 10000) / 10000 : 0,
      currentBestProvider: unlimitedFirst[0]?.provider.name ?? null,
      backupProvider: unlimitedFirst[1]?.provider.name ?? null,
      emergencyProvider: sorted[sorted.length - 1]?.provider.name ?? null,
    };
  }

  async getDailyUsage(userId: string, days: number = 30): Promise<DailyUsage[]> {
    const since = new Date(Date.now() - days * 86400000);
    const logs = await db.usageLog.findMany({
      where: { createdAt: { gte: since }, account: { userId } },
    });

    const byDay = new Map<string, DailyUsage>();
    for (const log of logs) {
      const day = log.createdAt.toISOString().split('T')[0];
      if (!byDay.has(day)) {
        byDay.set(day, { date: day, requests: 0, cost: 0, avgLatency: 0, successRate: 100, errors: 0 });
      }
      const d = byDay.get(day)!;
      d.requests++;
      d.cost += log.cost;
      d.avgLatency += log.latencyMs;
      if (log.status !== 'success') d.errors++;
    }

    const result: DailyUsage[] = [];
    for (const d of byDay.values()) {
      d.avgLatency = Math.round(d.avgLatency / d.requests);
      d.cost = Math.round(d.cost * 10000) / 10000;
      d.successRate = d.requests > 0 ? Math.round(((d.requests - d.errors) / d.requests) * 1000) / 10 : 100;
      result.push(d);
    }

    return result.sort((a, b) => a.date.localeCompare(b.date));
  }

  async getUsageLogs(userId: string, page: number = 1, perPage: number = 20, filters?: { accountId?: string; status?: string }): Promise<{ logs: any[]; total: number }> {
    const where: Prisma.UsageLogWhereInput = { account: { userId } };
    if (filters?.accountId) where.accountId = filters.accountId;
    if (filters?.status) where.status = filters.status;

    const [logs, total] = await Promise.all([
      db.usageLog.findMany({
        where,
        include: { account: { select: { name: true, provider: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      db.usageLog.count({ where }),
    ]);

    return { logs, total };
  }

  async getRoutingEvents(userId: string, page: number = 1, perPage: number = 20): Promise<{ events: any[]; total: number }> {
    // A routing event belongs to the user if either side of the failover
    // pair is one of their accounts.
    const where: Prisma.RoutingEventWhereInput = {
      OR: [
        { sourceAccount: { userId } },
        { targetAccount: { userId } },
      ],
    };
    const [events, total] = await Promise.all([
      db.routingEvent.findMany({
        where,
        include: {
          sourceAccount: { select: { name: true } },
          targetAccount: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      db.routingEvent.count({ where }),
    ]);

    return { events, total };
  }

  async logUsage(userId: string, data: {
    accountId: string;
    endpoint: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    cost?: number;
    latencyMs?: number;
    status?: string;
    errorMessage?: string;
  }): Promise<void> {
    const account = await db.apiAccount.findFirst({ where: { id: data.accountId, userId }, select: { id: true } });
    if (!account) throw new Error('API account not found');
    await db.usageLog.create({ data });
  }

  async logRoutingEvent(data: {
    sourceAccountId?: string;
    targetAccountId: string;
    reason: string;
    details?: string;
  }): Promise<void> {
    await db.routingEvent.create({ data });
  }

  // ── PROVIDERS ─────────────────────────────────────────────

  async listProviders(userId: string) {
    return db.provider.findMany({
      include: {
        accounts: {
          where: { userId },
          select: {
            id: true, name: true, status: true, healthScore: true,
            totalCredits: true, usedCredits: true, creditUnit: true,
          },
          orderBy: { priority: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  private async migrateLegacyApiKey(account: { id: string; apiKey: string }): Promise<string> {
    const decoded = decryptSecret(account.apiKey);
    if (decoded.legacy && decoded.value) {
      const encrypted = encryptSecret(decoded.value);
      await db.apiAccount.update({ where: { id: account.id }, data: { apiKey: encrypted } });
    }
    return decoded.value;
  }

  // ── INTERNAL HELPERS ──────────────────────────────────────

  private enrichAccount(a: any): AccountWithProvider {
    const remainingCredits = Math.max(0, a.totalCredits - a.usedCredits);
    const remainingPercent = a.creditUnit === 'unlimited' || a.totalCredits === 0
      ? 100
      : Math.round((remainingCredits / a.totalCredits) * 100);

    const stored = decryptSecret(a.apiKey);
    return {
      ...a,
      // Never expose the credential through ordinary account/list/export responses.
      // Credential material is only returned by the explicitly gated agent/key paths.
      apiKey: stored.value ? `${stored.value.slice(0, 4)}••••${stored.value.slice(-4)}` : '••••••',
      providerName: a.provider?.name ?? '',
      providerDescription: a.provider?.description ?? '',
      remainingCredits,
      remainingPercent,
    };
  }

  private bestAccount(accounts: any[]): any {
    // Unlimited first, then by health score, then by remaining credits
    return accounts.sort((a, b) => {
      const aUnlimited = a.creditUnit === 'unlimited' || a.totalCredits === 0;
      const bUnlimited = b.creditUnit === 'unlimited' || b.totalCredits === 0;
      if (aUnlimited && !bUnlimited) return -1;
      if (!aUnlimited && bUnlimited) return 1;
      if (a.healthScore !== b.healthScore) return b.healthScore - a.healthScore;
      const aRem = a.totalCredits - a.usedCredits;
      const bRem = b.totalCredits - b.usedCredits;
      return bRem - aRem;
    })[0];
  }

  private cheapestAccount(accounts: any[]): any {
    return accounts.filter(a => a.creditUnit === 'unlimited' || a.totalCredits === 0)
      .sort((a, b) => a.avgLatencyMs - b.avgLatencyMs)[0]
      ?? accounts.sort((a, b) => {
        const aCost = a.totalRequests > 0 ? a.usedCredits / a.totalRequests : 0;
        const bCost = b.totalRequests > 0 ? b.usedCredits / b.totalRequests : 0;
        return aCost - bCost;
      })[0];
  }

  private roundRobin(accounts: any[], key: string = 'default'): any {
    const idx = (this.roundRobinIndex.get(key) ?? 0) % accounts.length;
    this.roundRobinIndex.set(key, idx + 1);
    return accounts[idx];
  }

  private async buildDecision(account: any, strategy: RoutingStrategy, reason: string): Promise<RoutingDecision> {
    const apiKey = await this.migrateLegacyApiKey(account);
    const remaining = account.totalCredits - account.usedCredits;
    const percent = account.creditUnit === 'unlimited' || account.totalCredits === 0
      ? 100
      : Math.round((remaining / account.totalCredits) * 100);

    return {
      accountId: account.id,
      accountName: account.name,
      providerName: account.provider?.name ?? '',
      apiKey,
      strategy,
      reason,
      healthScore: account.healthScore,
      remainingPercent: percent,
    };
  }

  private getReason(account: any, strategy: RoutingStrategy): string {
    switch (strategy) {
      case 'fastest': return `Fastest available — ${account.avgLatencyMs}ms avg latency`;
      case 'cheapest': return `Most cost-effective option`;
      case 'highest_quality': return `Highest success rate — ${account.successRate}%`;
      case 'round_robin': return `Round-robin selection for even distribution`;
      case 'load_balance': return `Least loaded — ${account.todayRequests} requests today`;
      default: return `Best overall — health ${account.healthScore}, ${(account.creditUnit === 'unlimited' ? 'unlimited' : `${Math.round((1 - account.usedCredits / account.totalCredits) * 100)}% remaining`)} credits`;
    }
  }
}

// ─── Singleton ───────────────────────────────────────────────
export const apiBank = new ApiBank();

// ─── Secrets Vault ───────────────────────────────────────────
// She keeps more than just API keys.

export type SecretType = 'api_key' | 'password' | 'oauth' | 'service_account' | 'token' | 'certificate' | 'ssh_key' | 'other';
export type SecretPurpose = 'cloud_storage' | 'email' | 'database' | 'ai_api' | 'deployment' | 'identity' | 'other';

export interface SecretEntry {
  id: string;
  name: string;
  type: SecretType;
  provider: string;
  purpose: SecretPurpose | null;
  credentials: Record<string, string>; // parsed JSON
  status: string;
  notes: string | null;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}

export class SecretVault {
  // ── CRUD ────────────────────────────────────────────────

  async list(filter: { userId: string; type?: SecretType; provider?: string; purpose?: SecretPurpose; status?: string }): Promise<SecretEntry[]> {
    const where: any = { userId: filter.userId };
    if (filter?.type) where.type = filter.type;
    if (filter?.provider) where.provider = filter.provider;
    if (filter?.purpose) where.purpose = filter.purpose;
    if (filter?.status) where.status = filter.status;

    const secrets = await db.secret.findMany({
      where,
      orderBy: [{ provider: 'asc' }, { createdAt: 'desc' }],
    });

    return secrets.map(this.enrich);
  }

  async get(id: string, userId: string): Promise<SecretEntry | null> {
    const secret = await db.secret.findFirst({ where: { id, userId } });
    return secret ? this.enrich(secret) : null;
  }

  async getByName(name: string, provider: string | undefined, userId: string): Promise<SecretEntry | null> {
    const where: any = { name, status: 'active', userId };
    if (provider) where.provider = provider;
    const secret = await db.secret.findFirst({ where, orderBy: { lastUsedAt: 'asc' } });
    return secret ? this.enrich(secret) : null;
  }

  async getByPurpose(purpose: SecretPurpose, provider: string | undefined, userId: string): Promise<SecretEntry | null> {
    const where: any = { purpose, status: 'active', userId };
    if (provider) where.provider = provider;
    const secret = await db.secret.findFirst({ where, orderBy: { lastUsedAt: 'asc' } });
    return secret ? this.enrich(secret) : null;
  }

  async add(data: {
    name: string;
    type: SecretType;
    provider: string;
    purpose?: SecretPurpose;
    credentials: Record<string, string>;
    notes?: string;
    expiresAt?: Date;
    userId?: string;
  }): Promise<SecretEntry> {
    if (!data.userId) {
      // Every secret must be attributed to a real user — 'SYSTEM' meant it
      // silently fell out of that user's own vault listing (list() filters
      // by userId), effectively losing the secret from their perspective.
      throw new Error('userId is required to add a secret');
    }

    const secret = await db.secret.create({
      data: {
        userId: data.userId,
        name: data.name,
        type: data.type,
        provider: data.provider,
        purpose: data.purpose || null,
        credentials: encryptJson(data.credentials),
        status: 'active',
        notes: data.notes,
        expiresAt: data.expiresAt,
      },
    });
    return this.enrich(secret);
  }

  async update(id: string, userId: string, data: Partial<{
    name: string; type: SecretType; provider: string; purpose: SecretPurpose;
    credentials: Record<string, string>; status: string; notes: string; expiresAt: Date;
  }>): Promise<SecretEntry> {
    const updateData: any = { ...data };
    if (data.credentials) updateData.credentials = encryptJson(data.credentials);
    const secret = await db.secret.update({ where: { id, userId }, data: updateData });
    return this.enrich(secret);
  }

  async delete(id: string, userId: string): Promise<void> {
    await db.secret.delete({ where: { id, userId } });
  }

  async touch(id: string, userId: string): Promise<void> {
    await db.secret.update({ where: { id, userId }, data: { lastUsedAt: new Date() } });
  }

  // ── Stats ──────────────────────────────────────────────

  async stats(userId: string): Promise<{ total: number; byType: Record<string, number>; byPurpose: Record<string, number>; byProvider: Record<string, number> }> {
    const all = await db.secret.findMany({ where: { userId } });
    const byType: Record<string, number> = {};
    const byPurpose: Record<string, number> = {};
    const byProvider: Record<string, number> = {};

    for (const s of all) {
      byType[s.type] = (byType[s.type] || 0) + 1;
      if (s.purpose) byPurpose[s.purpose] = (byPurpose[s.purpose] || 0) + 1;
      byProvider[s.provider] = (byProvider[s.provider] || 0) + 1;
    }

    return { total: all.length, byType, byPurpose, byProvider };
  }

  // ── Internal ────────────────────────────────────────────

  private enrich(s: any): SecretEntry {
    const credentials: Record<string, string> = decryptJson(s.credentials);
    return {
      id: s.id,
      name: s.name,
      type: s.type,
      provider: s.provider,
      purpose: s.purpose,
      credentials,
      status: s.status,
      notes: s.notes,
      expiresAt: s.expiresAt,
      lastUsedAt: s.lastUsedAt,
      createdAt: s.createdAt,
    };
  }
}

export const secretVault = new SecretVault();