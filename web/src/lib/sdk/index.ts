// ============================================================
// Aruk SDK — Layer 3: Programmatic Interface
// ============================================================
// Import this into any TypeScript/JavaScript application.
// The app never needs to know which provider it's using.
//
// Usage:
//   import { ArukClient } from '@/lib/sdk';
//   const aruk = new ArukClient({ baseUrl: 'http://localhost:3000' });
//   const { apiKey, provider } = await aruk.getKey('fastest');
// ============================================================

export type RoutingStrategy =
  | 'best' | 'fastest' | 'cheapest' | 'highest_quality'
  | 'round_robin' | 'load_balance';

export type AccountStatus = 'active' | 'expired' | 'disabled' | 'backup';
export type CreditUnit = 'USD' | 'requests' | 'tokens' | 'unlimited';
export type SecretType =
  | 'api_key' | 'password' | 'oauth' | 'service_account'
  | 'token' | 'certificate' | 'ssh_key' | 'other';
export type SecretPurpose =
  | 'cloud_storage' | 'email' | 'database' | 'ai_api'
  | 'deployment' | 'identity' | 'other';

export interface ArukConfig {
  baseUrl?: string;
  authToken?: string;
  retries?: number;
  retryDelayMs?: number;
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

export interface AccountInfo {
  id: string;
  name: string;
  providerName: string;
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

export interface SecretEntry {
  id: string;
  name: string;
  type: SecretType;
  provider: string;
  purpose: SecretPurpose | null;
  credentials: Record<string, string>;
  status: string;
  notes: string | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface AgentResponse<T = unknown> {
  ok: boolean;
  data: T;
  error: string | null;
  meta: { timestamp: string; action?: string; [key: string]: unknown };
}

export interface HealthResponse {
  status: string;
  accounts: { total: number; active: number; healthy: number };
  credits: Record<string, unknown>;
  bestProvider: string | null;
}

// ─── Error ───────────────────────────────────────────────────

export class ArukError extends Error {
  status: number;
  constructor(message: string, status: number = 500) {
    super(message);
    this.name = 'ArukError';
    this.status = status;
  }
}

// ─── Client ──────────────────────────────────────────────────

export class ArukClient {
  private baseUrl: string;
  private authToken?: string;
  private retries: number;
  private retryDelayMs: number;

  constructor(config: ArukConfig = {}) {
    this.baseUrl = (config.baseUrl || process.env.APIBANK_URL || 'http://localhost:3000').replace(/\/$/, '');
    this.authToken = config.authToken;
    this.retries = config.retries ?? 2;
    this.retryDelayMs = config.retryDelayMs ?? 500;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.authToken) h['Authorization'] = `Bearer ${this.authToken}`;
    return h;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: { ...this.headers(), ...options?.headers },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new ArukError(body.error || `HTTP ${res.status}`, res.status);
    }
    return res.json();
  }

  private async agentRequest<T>(action: string, body?: Record<string, unknown>): Promise<AgentResponse<T>> {
    return this.request<AgentResponse<T>>('/api/agent', {
      method: 'POST',
      body: JSON.stringify({ action, ...body }),
    });
  }

  private async withRetries<T>(fn: () => Promise<T>): Promise<T> {
    let lastErr: Error | undefined;
    for (let i = 0; i <= this.retries; i++) {
      try {
        return await fn();
      } catch (e) {
        lastErr = e as Error;
        if (i < this.retries && (lastErr as ArukError).status === 503) {
          await new Promise(r => setTimeout(r, this.retryDelayMs * (i + 1)));
          continue;
        }
        throw lastErr;
      }
    }
    throw lastErr!;
  }

  // ── Health ───────────────────────────────────────────────

  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/api/health');
  }

  async ping(): Promise<boolean> {
    try { const h = await this.health(); return h.status === 'healthy'; } catch { return false; }
  }

  // ── API Key Routing ──────────────────────────────────────

  async getKey(strategy: RoutingStrategy = 'best', provider?: string): Promise<RoutingDecision> {
    return this.withRetries(async () => {
      const resp = await this.agentRequest<RoutingDecision>('get_key', { strategy, provider });
      if (!resp.ok) throw new ArukError(resp.error || 'Routing failed', 503);
      return resp.data;
    });
  }

  async getKeySimple(params?: { provider?: string; strategy?: RoutingStrategy; hideKey?: boolean }): Promise<RoutingDecision> {
    const sp = new URLSearchParams();
    if (params?.provider) sp.set('provider', params.provider);
    if (params?.strategy) sp.set('strategy', params.strategy);
    if (params?.hideKey) sp.set('hideKey', 'true');
    return this.request<RoutingDecision>(`/api/agent?${sp}`);
  }

  async getFailoverChain(): Promise<Partial<AccountInfo>[]> {
    const resp = await this.agentRequest<Partial<AccountInfo>[]>('failover');
    return resp.data;
  }

  // ── Account Management ───────────────────────────────────

  async listAccounts(provider?: string): Promise<AccountInfo[]> {
    const resp = await this.agentRequest<AccountInfo[]>('list', { provider });
    return resp.data;
  }

  async addKey(data: { providerName: string; apiKey: string; name?: string; priority?: number }): Promise<{ id: string; name: string; provider: string; status: string }> {
    const resp = await this.agentRequest('add_key', data as Record<string, unknown>);
    return resp.data as any;
  }

  async addKeys(data: { providerName: string; apiKeys: string[]; namePrefix?: string }): Promise<{ created: number; accounts: Array<{ id: string; name: string }> }> {
    const resp = await this.agentRequest('add_keys', data as Record<string, unknown>);
    return resp.data as any;
  }

  async reportUsage(accountId: string, data?: { endpoint?: string; model?: string; inputTokens?: number; outputTokens?: number; cost?: number; latencyMs?: number; status?: string; errorMessage?: string }): Promise<void> {
    await this.agentRequest('report_usage', { id: accountId, ...data });
  }

  async getStatus(): Promise<{ stats: BankStats; creditsByProvider: Record<string, { remaining: number; total: number; percent: number; unit: string }> }> {
    const resp = await this.agentRequest('status');
    return resp.data as any;
  }

  // ── Secrets Vault ────────────────────────────────────────

  async getSecret(purpose: SecretPurpose, provider?: string): Promise<SecretEntry> {
    const resp = await this.withRetries(async () => {
      const r = await this.agentRequest<SecretEntry>('get_secret', { purpose, provider });
      if (!r.ok) throw new ArukError(r.error || 'Secret not found', 404);
      return r;
    });
    return resp.data;
  }

  async listSecrets(filter?: { purpose?: SecretPurpose; provider?: string; type?: SecretType }): Promise<Array<Omit<SecretEntry, 'credentials'> & { fields: string[] }>> {
    const resp = await this.agentRequest('list_secrets', filter as Record<string, unknown>);
    return resp.data as any;
  }

  async addSecret(data: { name: string; type: SecretType; provider: string; credentials: Record<string, string>; purpose?: SecretPurpose; notes?: string }): Promise<{ id: string; name: string; type: string; provider: string }> {
    const resp = await this.agentRequest('add_secret', data as Record<string, unknown>);
    return resp.data as any;
  }

  async listSecretsFull(filter?: { type?: SecretType; provider?: string; purpose?: SecretPurpose; status?: string }): Promise<SecretEntry[]> {
    const sp = new URLSearchParams();
    if (filter?.type) sp.set('type', filter.type);
    if (filter?.provider) sp.set('provider', filter.provider);
    if (filter?.purpose) sp.set('purpose', filter.purpose);
    if (filter?.status) sp.set('status', filter.status);
    return this.request<SecretEntry[]>(`/api/secrets?${sp}`);
  }

  async createSecret(data: { name: string; type: SecretType; provider: string; credentials: Record<string, string>; purpose?: SecretPurpose; notes?: string; expiresAt?: Date }): Promise<SecretEntry> {
    return this.request<SecretEntry>('/api/secrets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSecret(id: string, data: Partial<{ name: string; type: SecretType; provider: string; purpose: SecretPurpose; credentials: Record<string, string>; status: string; notes: string }>): Promise<SecretEntry> {
    return this.request<SecretEntry>('/api/secrets', {
      method: 'PUT',
      body: JSON.stringify({ id, ...data }),
    });
  }

  async deleteSecret(id: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/secrets?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
  }

  // ── Convenience ──────────────────────────────────────────

  async authenticatedFetch(provider: string, url: string, init?: RequestInit, strategy: RoutingStrategy = 'best'): Promise<Response> {
    const decision = await this.getKey(strategy, provider);
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${decision.apiKey}`);
    return fetch(url, { ...init, headers });
  }
}

// ─── Singleton ───────────────────────────────────────────────

let _defaultClient: ArukClient | null = null;

export function getAruk(config?: ArukConfig): ArukClient {
  if (!_defaultClient) _defaultClient = new ArukClient(config);
  return _defaultClient;
}
