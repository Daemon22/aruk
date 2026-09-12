const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
};

const apiBank = read('src/lib/api-bank/index.ts');
const exportRoute = read('src/app/api/export/route.ts');
const agent = read('src/app/api/agent/route.ts');
const keeper = read('src/lib/keeper/index.ts');
const secrets = read('src/app/api/secrets/route.ts');
const offload = read('src/app/api/offload/route.ts');
const auth = read('src/lib/auth.ts');
<<<<<<< HEAD
const health = read('src/app/api/health/route.ts');
=======
>>>>>>> 193e563eec90177528092e21ed6ea88aad226193
const nextConfig = read('next.config.ts');

assert(apiBank.includes('apiKey: encryptSecret(data.apiKey)'), 'new API keys are encrypted before database storage');
assert(apiBank.includes('apiKey: encryptSecret(key)'), 'batch API keys are encrypted before database storage');
assert(apiBank.includes('decryptSecret(account.apiKey)'), 'routed API keys are decrypted only inside the bank');
assert(apiBank.includes('private async migrateLegacyApiKey'), 'legacy plaintext API keys have a migration path');
assert(apiBank.includes('async getKeyForAccount'), 'specific API accounts can be released through the bank');
<<<<<<< HEAD
assert(apiBank.includes('if (typeof data.apiKey === \'string\') updateData.apiKey = encryptSecret(data.apiKey)'), 'API key replacements are encrypted before update');
=======
>>>>>>> 193e563eec90177528092e21ed6ea88aad226193
assert(exportRoute.includes('const safeAccounts = accounts.map(({ apiKey:'), 'JSON export explicitly strips API key field');
assert(agent.includes("'get_cloud_credentials'"), 'agents can request non-API-key cloud credentials');
assert(agent.includes("checkGate(req, user.id, 'secret', 'read', body.id"), 'specific secrets can be policy-gated by resource ID');
assert(agent.includes("checkGate(req, user.id, 'api_account', 'read', body.accountId"), 'specific API keys can be policy-gated by account ID');
assert(agent.includes("checkGate(req, user.id, 'cloud_account', 'read', body.cloudAccountId"), 'specific cloud credentials can be policy-gated by cloud account ID');
assert(keeper.includes("where: { id: data.cloudAccountId, userId }"), 'passage logging enforces cloud-account ownership at the keeper boundary');
assert(keeper.includes('async getCloudAccountCredentials'), 'cloud credential retrieval is user-scoped');
assert(secrets.includes('credentials: Object.fromEntries'), 'normal secret listing masks credential values');
assert(secrets.includes("body.action === 'reveal'"), 'human vault reveal is explicit rather than part of list responses');
assert(offload.includes('resourceId: cloudAccountId'), 'direct offload API passes cloud account identity into policy evaluation');
assert(auth.includes("ARUK_BYPASS_AUTH must not be enabled in production"), 'auth bypass fails closed in production');
assert(nextConfig.includes('ARUK_CORS_ORIGIN'), 'CORS is no longer wildcard by default');
<<<<<<< HEAD
assert(nextConfig.includes('X-Aruk-Pass, X-Aruk-Actor, X-Aruk-Role'), 'CORS allows agent gate headers');
assert(auth.includes("req.headers.get('authorization')"), 'API sessions accept the SDK authorization header');
assert(auth.includes("/^Bearer\\s+([^\\s]+)$/i"), 'bearer authentication uses strict token parsing');
assert(auth.includes("aruk_session=([^;]+)"), 'cookie session authentication remains supported');
assert(auth.includes('bearerUserId !== cookieUserId'), 'conflicting bearer and cookie identities are rejected');
assert(apiBank.includes('async listProviders(userId: string)'), 'provider metadata listing requires a user scope');
assert(apiBank.includes('where: { id: data.accountId, userId }'), 'usage writes verify account ownership');
assert(apiBank.includes('async get(id: string, userId: string)'), 'secret retrieval requires a user scope');
assert(keeper.includes("where: { id: reference, userId }"), 'daemon lineage references require same-user ownership');
assert(keeper.includes("where: { id: data.policyId, userId }"), 'pass policy references require same-user ownership');
assert(health.includes("service: 'aruk'"), 'public health is liveness-only and contains no account aggregates');
assert(keeper.includes('expected?: PassConstraint'), 'passes can be constrained to the requested resource and scope');
assert(agent.includes('keeper.usePass(passToken, { resourceType, resourceId, scope })'), 'agent gates bind passes to resource and scope');
assert(offload.includes("keeper.usePass(passToken, { resourceType: 'cloud_account', resourceId: cloudAccountId, scope })"), 'offload gates bind passes to cloud account and scope');
assert(keeper.includes('passToken: null'), 'audit views do not expose bearer pass tokens');
=======
>>>>>>> 193e563eec90177528092e21ed6ea88aad226193

console.log('\nSecurity hardening contract checks passed.');

// Origin identity is explicit and must not be inferred from daemon/provider names.
const originSource = fs.readFileSync(path.join(root, 'src/lib/origin.ts'), 'utf8');
assert(originSource.includes("process.env.ARUK_ORIGIN_NAME || 'Azura Daemon'"), 'Origin defaults to Azura Daemon');
assert(originSource.includes("type: 'origin'"), 'Origin is represented as an origin identity, not a daemon role');
const agentSource = fs.readFileSync(path.join(root, 'src/app/api/agent/route.ts'), 'utf8');
assert(agentSource.includes("origin: ARUK_ORIGIN_NAME"), 'Agent responses carry the Origin marker');
const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
assert(envExample.includes('ARUK_ORIGIN_NAME=Azura Daemon'), 'Environment configuration names Azura Daemon as Origin');
console.log('PASS: Origin is explicitly Azura Daemon and propagated as origin metadata');
