// Lightweight seed - fewer logs for speed
import { db } from '@/lib/db';

const PROVIDERS = [
  { name: 'OpenAI', description: 'GPT-4o, GPT-4, GPT-3.5 Turbo' },
  { name: 'Anthropic', description: 'Claude 4 Opus, Claude 3.5 Sonnet' },
  { name: 'Google', description: 'Gemini 2.5 Pro, Gemini 2.0 Flash' },
  { name: 'Groq', description: 'Llama 3.1, Mixtral, Gemma' },
  { name: 'OpenRouter', description: 'Multi-provider routing' },
  { name: 'DeepSeek', description: 'DeepSeek V3, DeepSeek Coder' },
  { name: 'Mistral', description: 'Mistral Large, Codestral' },
  { name: 'Together', description: 'Open-source models, fine-tuning' },
  { name: 'Local Models', description: 'Self-hosted via Ollama/vLLM' },
];

const ACCOUNTS = [
  { providerName: 'OpenAI', name: 'OpenAI Primary', apiKey: 'sk-proj-xxxx-A', status: 'active', priority: 9, totalCredits: 24.0, usedCredits: 6.17, creditUnit: 'USD', healthScore: 98, avgLatencyMs: 920, successRate: 99.8, totalRequests: 145230, todayRequests: 2913, errorCount: 290 },
  { providerName: 'OpenAI', name: 'OpenAI Backup', apiKey: 'sk-proj-xxxx-B', status: 'active', priority: 7, totalCredits: 50.0, usedCredits: 12.50, creditUnit: 'USD', healthScore: 95, avgLatencyMs: 1050, successRate: 99.5, totalRequests: 89400, todayRequests: 1200, errorCount: 447 },
  { providerName: 'OpenAI', name: 'OpenAI Dev', apiKey: 'sk-proj-xxxx-C', status: 'backup', priority: 3, totalCredits: 5.0, usedCredits: 2.60, creditUnit: 'USD', healthScore: 88, avgLatencyMs: 1300, successRate: 97.2, totalRequests: 12500, todayRequests: 0, errorCount: 350 },
  { providerName: 'OpenAI', name: 'OpenAI Old', apiKey: 'sk-proj-xxxx-D', status: 'expired', priority: 0, totalCredits: 10.0, usedCredits: 10.0, creditUnit: 'USD', healthScore: 0, avgLatencyMs: 0, successRate: 0, totalRequests: 52300, todayRequests: 0, errorCount: 5230 },
  { providerName: 'Anthropic', name: 'Anthropic Primary', apiKey: 'sk-ant-xxxx', status: 'active', priority: 8, totalCredits: 25.0, usedCredits: 20.83, creditUnit: 'USD', healthScore: 96, avgLatencyMs: 1100, successRate: 99.6, totalRequests: 67800, todayRequests: 1840, errorCount: 271 },
  { providerName: 'Anthropic', name: 'Anthropic Backup', apiKey: 'sk-ant-xxxx-2', status: 'active', priority: 5, totalCredits: 100.0, usedCredits: 15.0, creditUnit: 'USD', healthScore: 94, avgLatencyMs: 1250, successRate: 99.3, totalRequests: 34200, todayRequests: 420, errorCount: 240 },
  { providerName: 'Google', name: 'Gemini Pro', apiKey: 'AIza-xxxx', status: 'active', priority: 6, totalCredits: 0, usedCredits: 0, creditUnit: 'unlimited', healthScore: 100, avgLatencyMs: 800, successRate: 99.9, totalRequests: 45600, todayRequests: 2310, errorCount: 46 },
  { providerName: 'Google', name: 'Gemini Flash', apiKey: 'AIza-xxxx-2', status: 'active', priority: 7, totalCredits: 0, usedCredits: 0, creditUnit: 'unlimited', healthScore: 99, avgLatencyMs: 450, successRate: 99.7, totalRequests: 89200, todayRequests: 4560, errorCount: 268 },
  { providerName: 'Groq', name: 'Groq Primary', apiKey: 'gsk-xxxx', status: 'active', priority: 9, totalCredits: 0, usedCredits: 0, creditUnit: 'unlimited', healthScore: 99, avgLatencyMs: 180, successRate: 99.9, totalRequests: 234500, todayRequests: 5120, errorCount: 235 },
  { providerName: 'Groq', name: 'Groq Backup', apiKey: 'gsk-xxxx-2', status: 'active', priority: 6, totalCredits: 0, usedCredits: 0, creditUnit: 'unlimited', healthScore: 97, avgLatencyMs: 200, successRate: 99.8, totalRequests: 98700, todayRequests: 2100, errorCount: 197 },
  { providerName: 'OpenRouter', name: 'OpenRouter Main', apiKey: 'sk-or-xxxx', status: 'active', priority: 5, totalCredits: 20.0, usedCredits: 18.90, creditUnit: 'USD', healthScore: 82, avgLatencyMs: 1400, successRate: 96.5, totalRequests: 34500, todayRequests: 890, errorCount: 1208 },
  { providerName: 'OpenRouter', name: 'OpenRouter Reserve', apiKey: 'sk-or-xxxx-2', status: 'backup', priority: 2, totalCredits: 10.0, usedCredits: 1.20, creditUnit: 'USD', healthScore: 90, avgLatencyMs: 1350, successRate: 98.0, totalRequests: 8900, todayRequests: 0, errorCount: 178 },
  { providerName: 'DeepSeek', name: 'DeepSeek Primary', apiKey: 'sk-ds-xxxx', status: 'active', priority: 7, totalCredits: 30.0, usedCredits: 14.70, creditUnit: 'USD', healthScore: 91, avgLatencyMs: 2200, successRate: 98.1, totalRequests: 56700, todayRequests: 1340, errorCount: 1078 },
  { providerName: 'DeepSeek', name: 'DeepSeek Coder', apiKey: 'sk-ds-xxxx-2', status: 'active', priority: 4, totalCredits: 15.0, usedCredits: 3.00, creditUnit: 'USD', healthScore: 88, avgLatencyMs: 2500, successRate: 97.5, totalRequests: 12300, todayRequests: 560, errorCount: 308 },
  { providerName: 'Mistral', name: 'Mistral Large', apiKey: 'mist-xxxx', status: 'active', priority: 6, totalCredits: 40.0, usedCredits: 18.40, creditUnit: 'USD', healthScore: 93, avgLatencyMs: 950, successRate: 99.1, totalRequests: 42100, todayRequests: 1100, errorCount: 379 },
  { providerName: 'Together', name: 'Together Primary', apiKey: 'tog-xxxx', status: 'active', priority: 4, totalCredits: 25.0, usedCredits: 22.00, creditUnit: 'USD', healthScore: 65, avgLatencyMs: 1600, successRate: 94.3, totalRequests: 28900, todayRequests: 780, errorCount: 1647 },
  { providerName: 'Together', name: 'Together Reserve', apiKey: 'tog-xxxx-2', status: 'disabled', priority: 0, totalCredits: 10.0, usedCredits: 10.0, creditUnit: 'USD', healthScore: 0, avgLatencyMs: 0, successRate: 0, totalRequests: 19800, todayRequests: 0, errorCount: 1980 },
  { providerName: 'Local Models', name: 'Ollama Llama 3', apiKey: 'local', status: 'active', priority: 2, totalCredits: 0, usedCredits: 0, creditUnit: 'unlimited', healthScore: 85, avgLatencyMs: 3500, successRate: 99.0, totalRequests: 12300, todayRequests: 340, errorCount: 123 },
  { providerName: 'Local Models', name: 'vLLM Mixtral', apiKey: 'local', status: 'active', priority: 1, totalCredits: 0, usedCredits: 0, creditUnit: 'unlimited', healthScore: 80, avgLatencyMs: 4200, successRate: 98.5, totalRequests: 6700, todayRequests: 120, errorCount: 101 },
];

async function seed() {
  console.log('Seeding API Bank...');
  for (const p of PROVIDERS) {
    await db.provider.upsert({ where: { name: p.name }, update: p, create: p });
  }
  console.log(`Created ${PROVIDERS.length} providers`);

  for (const a of ACCOUNTS) {
    const provider = await db.provider.findUnique({ where: { name: a.providerName } });
    if (!provider) continue;
    const { providerName, ...data } = a;
    const id = `${a.providerName.toLowerCase().replace(/\s+/g, '-')}-${a.name.toLowerCase().replace(/\s+/g, '-')}`;
    const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000);
    const lastUsedAt = a.status === 'active' ? hoursAgo(Math.floor(Math.random() * 24)) : null;
    await db.apiAccount.upsert({
      where: { id },
      update: { ...data, lastUsedAt },
      create: { id, ...data, providerId: provider.id, lastUsedAt },
    });
  }
  console.log(`Created ${ACCOUNTS.length} accounts`);

  // Light usage logs — 3 days, 50 req/day
  const active = await db.apiAccount.findMany({ where: { status: 'active' } });
  const models = ['gpt-4o','claude-3.5-sonnet','gemini-2.5-pro','llama-3.1-70b','deepseek-v3','mistral-large'];
  const now = Date.now();
  const logs: any[] = [];
  for (let day = 0; day < 3; day++) {
    for (let r = 0; r < 50; r++) {
      const acc = active[Math.floor(Math.random() * active.length)];
      logs.push({
        accountId: acc.id,
        endpoint: '/v1/chat/completions',
        model: models[Math.floor(Math.random() * models.length)],
        inputTokens: 100 + Math.floor(Math.random() * 3000),
        outputTokens: 200 + Math.floor(Math.random() * 1500),
        cost: Math.round((Math.random() * 0.05) * 10000) / 10000,
        latencyMs: 100 + Math.floor(Math.random() * 4000),
        status: Math.random() > 0.1 ? 'success' : 'error',
        createdAt: new Date(now - day * 86400000 - Math.floor(Math.random() * 86400000)),
      });
    }
  }
  await db.usageLog.createMany({ data: logs });
  console.log(`Created ${logs.length} usage logs`);

  const reasons = ['failover','load_balance','credit_low','round_robin','manual'];
  const events: any[] = [];
  for (let i = 0; i < 50; i++) {
    const src = active[Math.floor(Math.random() * active.length)];
    const tgt = active[Math.floor(Math.random() * active.length)];
    events.push({
      sourceAccountId: src.id, targetAccountId: tgt.id,
      reason: reasons[Math.floor(Math.random() * reasons.length)],
      provider: src.providerId,
      details: `${src.name} → ${tgt.name}`,
      createdAt: new Date(now - Math.floor(Math.random() * 7 * 86400000)),
    });
  }
  await db.routingEvent.createMany({ data: events });
  console.log(`Created ${events.length} routing events`);

  // Seed some vault secrets
  const SECRETS = [
    { name: 'GCS Production', type: 'service_account', provider: 'Google', purpose: 'cloud_storage', credentials: { type: 'service_account', project_id: 'my-project-123', client_email: 'aruk@my-project-123.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg...\n-----END PRIVATE KEY-----' }, notes: 'For GCS bucket access' },
    { name: 'AWS S3 Access', type: 'api_key', provider: 'AWS', purpose: 'cloud_storage', credentials: { access_key_id: 'EXAMPLE-ACCESS-KEY-ID', secret_access_key: 'EXAMPLE-secret-access-key', region: 'us-east-1' }, notes: 'S3 bucket for agent outputs' },
    { name: 'Gmail Bot', type: 'password', provider: 'Google', purpose: 'email', credentials: { email: 'aruk.bot@gmail.com', password: 'app-specific-password-xxxx', imap_server: 'imap.gmail.com', smtp_server: 'smtp.gmail.com' }, notes: 'For sending notifications' },
    { name: 'GitHub App Token', type: 'token', provider: 'GitHub', purpose: 'deployment', credentials: { token: 'ghp_xxxxxxxxxxxxxxxxxxxx', scopes: 'repo,workflow' }, notes: 'For CI/CD and repo access' },
    { name: 'Supabase DB', type: 'password', provider: 'Supabase', purpose: 'database', credentials: { host: 'db.xxxxx.supabase.co', port: '5432', database: 'postgres', user: 'postgres', password: 'db-password-xxxx' }, notes: 'Production database' },
  ];

  for (const s of SECRETS) {
    const id = `secret-${s.provider.toLowerCase()}-${s.name.toLowerCase().replace(/\s+/g, '-')}`;
    await db.secret.upsert({
      where: { id },
      update: { ...s, credentials: JSON.stringify(s.credentials) },
      create: { id, ...s, credentials: JSON.stringify(s.credentials), status: 'active' },
    });
  }
  console.log(`Created ${SECRETS.length} vault secrets`);

  console.log('Done!');
}

seed().catch(e => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());