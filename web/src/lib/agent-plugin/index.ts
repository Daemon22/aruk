// ============================================================
// Aruk Agent Plugin — Layer 4: Agent Integration
// ============================================================
// Pre-built integrations for AI agents and frameworks.
// Agents ask Aruk for keys/secrets — they never manage them.
//
// Includes:
//   - OpenAI-compatible proxy (swap Aruk in place of openai SDK)
//   - Auto-key injection middleware
//   - Credential resolver for cloud/storage/email access
//   - Provider health-aware retry logic
// ============================================================

import { ArukClient, ArukError, type RoutingDecision, type SecretEntry, type RoutingStrategy } from '@/lib/sdk';

// ─── Types ───────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  provider?: string;
  strategy?: RoutingStrategy;
  temperature?: number;
  maxTokens?: number;
  /** Extra headers to merge into the provider request */
  extraHeaders?: Record<string, string>;
}

export interface ChatResult {
  content: string;
  provider: string;
  model: string;
  accountName: string;
  strategy: RoutingStrategy;
  healthScore: number;
  promptTokens?: number;
  completionTokens?: number;
}

export interface ProviderConfig {
  name: string;
  baseUrl: string;
  authHeader: string; // 'Bearer' or 'x-api-key' etc.
  models?: string[];
  defaultModel?: string;
}

// ─── Built-in Provider Registry ──────────────────────────────

const PROVIDERS: Record<string, ProviderConfig> = {
  'OpenAI': {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    authHeader: 'Bearer',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1-mini', 'o3-mini'],
    defaultModel: 'gpt-4o-mini',
  },
  'Anthropic': {
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    authHeader: 'x-api-key',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
    defaultModel: 'claude-sonnet-4-20250514',
  },
  'Google': {
    name: 'Google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    authHeader: 'Bearer',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
    defaultModel: 'gemini-2.5-flash',
  },
  'Groq': {
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    authHeader: 'Bearer',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    defaultModel: 'llama-3.3-70b-versatile',
  },
  'OpenRouter': {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    authHeader: 'Bearer',
    models: [], // OpenRouter supports many models
    defaultModel: 'openai/gpt-4o-mini',
  },
  'DeepSeek': {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    authHeader: 'Bearer',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
  },
};

/** Get provider config, or return a generic one for unknown providers */
function getProviderConfig(name: string): ProviderConfig {
  if (PROVIDERS[name]) return PROVIDERS[name];
  return {
    name,
    baseUrl: `https://api.${name.toLowerCase().replace(/\s+/g, '')}.com/v1`,
    authHeader: 'Bearer',
    defaultModel: 'default',
  };
}

// ─── Agent Plugin ────────────────────────────────────────────

export class ArukAgentPlugin {
  private client: ArukClient;
  private defaultProvider?: string;
  private defaultStrategy: RoutingStrategy;

  constructor(options?: { arukUrl?: string; authToken?: string; defaultProvider?: string; defaultStrategy?: RoutingStrategy }) {
    this.client = new ArukClient({
      baseUrl: options?.arukUrl,
      authToken: options?.authToken,
      retries: 2,
      retryDelayMs: 500,
    });
    this.defaultProvider = options?.defaultProvider;
    this.defaultStrategy = options?.defaultStrategy || 'best';
  }

  // ── Chat Completion (OpenAI-compatible proxy) ───────────

  /**
   * Send a chat completion request. Aruk picks the best provider/key.
   * Compatible with the OpenAI SDK message format.
   */
  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult> {
    const provider = options?.provider || this.defaultProvider;
    const strategy = options?.strategy || this.defaultStrategy;
    const decision = await this.client.getKey(strategy, provider);
    const config = getProviderConfig(decision.providerName);
    const model = options?.model || config.defaultModel || 'default';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Set auth based on provider convention
    if (config.authHeader === 'Bearer') {
      headers['Authorization'] = `Bearer ${decision.apiKey}`;
    } else {
      headers[config.authHeader] = decision.apiKey;
    }

    // Anthropic-specific headers
    if (decision.providerName === 'Anthropic') {
      headers['anthropic-version'] = '2023-06-01';
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
    }

    // Merge extra headers
    if (options?.extraHeaders) {
      Object.assign(headers, options.extraHeaders);
    }

    // Build request body (OpenAI format)
    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
    };
    if (options?.maxTokens) body.max_tokens = options.maxTokens;

    const startedAt = performance.now();

    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }).catch(async (e) => {
      // Network failure — still report so the account's health/error stats reflect it.
      await this.client.reportUsage(decision.accountId, {
        endpoint: `${config.baseUrl}/chat/completions`, model, status: 'error',
      }).catch(() => { /* reporting must never mask the original error */ });
      throw e;
    });

    const latencyMs = Math.round(performance.now() - startedAt);

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown error');
      await this.client.reportUsage(decision.accountId, {
        endpoint: `${config.baseUrl}/chat/completions`, model, status: 'error', latencyMs,
        errorMessage: `${res.status}: ${errText}`.slice(0, 500),
      } as any).catch(() => { /* reporting must never mask the original error */ });
      throw new ArukError(`${decision.providerName} ${res.status}: ${errText}`, res.status);
    }

    const json = await res.json() as any;
    const content = json.choices?.[0]?.message?.content || json.content?.[0]?.text || '';
    const promptTokens = json.usage?.prompt_tokens;
    const completionTokens = json.usage?.completion_tokens;

    // Feed real usage back into Aruk so credit/health tracking reflects actual calls,
    // not just Simulate-tab traffic. Never let a reporting failure break the chat result.
    await this.client.reportUsage(decision.accountId, {
      endpoint: `${config.baseUrl}/chat/completions`,
      model: json.model || model,
      inputTokens: promptTokens,
      outputTokens: completionTokens,
      latencyMs,
      status: 'success',
    }).catch(() => {});

    return {
      content,
      provider: decision.providerName,
      model: json.model || model,
      accountName: decision.accountName,
      strategy: decision.strategy,
      healthScore: decision.healthScore,
      promptTokens,
      completionTokens,
    };
  }

  // ── Simple prompt (convenience) ─────────────────────────

  /** Send a single user prompt and get the response text */
  async prompt(text: string, options?: Omit<ChatOptions, 'model'> & { systemPrompt?: string; model?: string }): Promise<string> {
    const messages: ChatMessage[] = [];
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: text });
    const result = await this.chat(messages, options);
    return result.content;
  }

  // ── Credential Resolution ────────────────────────────────

  /**
   * Ask Aruk for credentials to access a service.
   * E.g., getCredentials('cloud_storage', 'Google') → { email, private_key, ... }
   */
  async getCredentials(purpose: 'cloud_storage' | 'email' | 'database' | 'ai_api' | 'deployment' | 'identity' | 'other', provider?: string): Promise<SecretEntry> {
    return this.client.getSecret(purpose, provider);
  }

  /**
   * Get a raw API key from the bank.
   * Returns the key string directly for quick use.
   */
  async getKey(provider?: string, strategy?: RoutingStrategy): Promise<string> {
    const decision = await this.client.getKey(strategy || this.defaultStrategy, provider);
    return decision.apiKey;
  }

  /**
   * Get a full routing decision with metadata.
   */
  async getRoutingDecision(provider?: string, strategy?: RoutingStrategy): Promise<RoutingDecision> {
    return this.client.getKey(strategy || this.defaultStrategy, provider);
  }

  // ── Provider-Aware Fetch (for agents calling APIs) ───────

  /**
   * Make an authenticated fetch to any URL using Aruk-managed credentials.
   * Example: await plugin.fetchWithAuth('cloud_storage', 'Google', 'https://storage.googleapis.com/bucket/file')
   */
  async fetchWithAuth(purpose: 'cloud_storage' | 'email' | 'database' | 'ai_api' | 'deployment' | 'identity' | 'other', provider: string, url: string, init?: RequestInit): Promise<Response> {
    const secret = await this.getCredentials(purpose, provider);
    const headers = new Headers(init?.headers);

    // Inject auth based on secret type
    if (secret.type === 'oauth' || secret.type === 'token') {
      const token = secret.credentials.access_token || secret.credentials.token || Object.values(secret.credentials)[0];
      headers.set('Authorization', `Bearer ${token}`);
    } else if (secret.type === 'api_key') {
      const key = secret.credentials.api_key || secret.credentials.key || Object.values(secret.credentials)[0];
      headers.set('Authorization', `Bearer ${key}`);
    } else if (secret.type === 'service_account') {
      // For service accounts, provide the credentials as a custom header
      // The caller can use these to construct proper auth
      headers.set('X-Service-Account-Email', secret.credentials.client_email || '');
    }

    return fetch(url, { ...init, headers });
  }

  // ── Status ──────────────────────────────────────────────

  /** Check Aruk health */
  async health() {
    return this.client.health();
  }

  /** Get full bank status */
  async status() {
    return this.client.getStatus();
  }

  /** List all accounts (keys stripped) */
  async listAccounts() {
    return this.client.listAccounts();
  }

  /** Get the failover chain */
  async getFailoverChain() {
    return this.client.getFailoverChain();
  }

  /** Report usage back to Aruk */
  async reportUsage(accountId: string, data?: { endpoint?: string; model?: string; latencyMs?: number; status?: string }) {
    return this.client.reportUsage(accountId, data);
  }

  // ── List available providers ────────────────────────────

  static listProviders(): string[] {
    return Object.keys(PROVIDERS);
  }

  static getProviderInfo(name: string): ProviderConfig | undefined {
    return PROVIDERS[name];
  }
}

// ─── Convenience: Global Plugin Instance ─────────────────────

let _defaultPlugin: ArukAgentPlugin | null = null;

/** Get a shared ArukAgentPlugin instance */
export function getArukPlugin(options?: ConstructorParameters<typeof ArukAgentPlugin>[0]): ArukAgentPlugin {
  if (!_defaultPlugin) _defaultPlugin = new ArukAgentPlugin(options);
  return _defaultPlugin;
}

// ─── Re-export SDK ───────────────────────────────────────────

export { ArukClient, ArukError } from '@/lib/sdk';
export type { RoutingStrategy };
