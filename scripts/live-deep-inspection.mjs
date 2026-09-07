const base = process.env.ARUK_LIVE_URL || 'http://127.0.0.1:3017';

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (process.env.ARUK_LIVE_TOKEN && !options.skipAuth) headers.authorization = `Bearer ${process.env.ARUK_LIVE_TOKEN}`;
  const response = await fetch(`${base}${path}`, { ...options, headers });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, headers: Object.fromEntries(response.headers), body };
}

function json(options = {}, body) {
  return { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) }, body: JSON.stringify(body) };
}

const result = {};
result.discovery = await request('/api');
result.health = await request('/api/health');
result.unauthenticated = await request('/api/accounts', { skipAuth: true });
result.options = await request('/api/agent', { method: 'OPTIONS', headers: { origin: 'http://localhost:3000', 'access-control-request-headers': 'authorization,x-aruk-pass,x-aruk-actor,x-aruk-role' } });

const account = await request('/api/accounts', json({ method: 'POST' }, {
  name: 'Synthetic Live Account', providerName: 'SyntheticProvider', apiKey: 'synthetic-key-never-real', priority: 10, totalCredits: 100, creditUnit: 'USD',
}));
result.account = account;
const accountId = account.body.id;
result.accountUpdate = await request('/api/accounts', json({ method: 'PUT' }, { id: accountId, apiKey: 'synthetic-key-updated-never-real' }));
result.accounts = await request('/api/accounts');
result.routing = await request('/api/routing?strategy=best');
result.stats = await request('/api/stats');
result.credits = await request('/api/credits');
result.providers = await request('/api/providers');
result.exportJson = await request('/api/export?format=json');
result.exportCsv = await request('/api/export?format=csv');

const secret = await request('/api/secrets', json({ method: 'POST' }, {
  name: 'Synthetic Provider Secret', type: 'service_account', provider: 'SyntheticProvider', purpose: 'ai_api', credentials: { client_id: 'synthetic-id', client_secret: 'synthetic-secret', private_key: 'synthetic-private-key' },
}));
result.secret = secret;
result.secretList = await request('/api/secrets');
result.secretReveal = await request('/api/secrets', json({ method: 'POST' }, { action: 'reveal', id: secret.body.id }));

const cloud = await request('/api/cloud-accounts', json({ method: 'POST' }, {
  name: 'Synthetic Cloud', provider: 'aws_s3', bucketName: 'synthetic-bucket', region: 'test-region', credentials: { accessKeyId: 'synthetic-access', secretAccessKey: 'synthetic-secret' }, credentialsMasked: 'synthetic-****',
}));
result.cloud = cloud;
result.cloudList = await request('/api/cloud-accounts');
result.cloudDelete = await request(`/api/cloud-accounts?id=${encodeURIComponent(cloud.body.data.id)}`, { method: 'DELETE' });

const policy = await request('/api/policies', json({ method: 'POST' }, { name: 'Synthetic allow all', effect: 'allow', resourceType: 'api_account', scope: 'read', priority: 100 }));
result.policy = policy;
const daemon = await request('/api/daemons', json({ method: 'POST' }, { name: 'Synthetic Agent', designation: 'test', role: 'agent', purpose: 'live inspection', capabilities: ['read'] }));
result.daemon = daemon;
const pass = await request('/api/passes', json({ method: 'POST' }, { daemonId: daemon.body.id, requesterName: 'Synthetic Agent', policyId: policy.body.id, resourceType: 'api_account', scope: 'read', maxUses: 1 }));
result.pass = pass;
result.passUse = await request('/api/passes', json({ method: 'PUT' }, { action: 'use', token: pass.body.token }));
result.badJson = await request('/api/agent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
result.notFound = await request('/api/not-found');

console.log(JSON.stringify({
  discovery: result.discovery.status,
  health: result.health.status + ':' + result.health.body.status,
  unauthenticated: result.unauthenticated.status,
  options: result.options.status + ':' + result.options.headers['access-control-allow-headers'],
  account: result.account.status,
  accountUpdate: result.accountUpdate.status,
  accounts: result.accounts.status + ':' + result.accounts.body.length,
  routing: result.routing.status + ':' + (result.routing.body.providerName || result.routing.body.error),
  stats: result.stats.status,
  credits: result.credits.status,
  providers: result.providers.status + ':' + result.providers.body.length,
  exportJson: result.exportJson.status + ':secretInBody=' + JSON.stringify(result.exportJson.body).includes('synthetic-key'),
  exportCsv: result.exportCsv.status + ':secretInBody=' + String(result.exportCsv.body).includes('synthetic-key'),
  secret: result.secret.status,
  secretList: result.secretList.status + ':plaintext=' + JSON.stringify(result.secretList.body).includes('synthetic-secret'),
  secretReveal: result.secretReveal.status + ':secretPresent=' + (result.secretReveal.body?.credentials?.client_secret === 'synthetic-secret'),
  cloud: result.cloud.status,
  cloudList: result.cloudList.status + ':plaintext=' + JSON.stringify(result.cloudList.body).includes('synthetic-secret'),
  cloudDelete: result.cloudDelete.status,
  policy: result.policy.status,
  daemon: result.daemon.status,
  pass: result.pass.status,
  passUse: result.passUse.status + ':' + result.passUse.body.allowed,
  badJson: result.badJson.status + ':' + result.badJson.body.error,
  notFound: result.notFound.status,
}, null, 2));
