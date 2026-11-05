const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: (id) => id in mocks ? mocks[id] : require(id), Buffer, URL, Request, Response, Headers, FormData, File, Uint8Array, console, process, ...globals }, { filename: file });
  return exports;
}
async function main() {
  let status = 200, body = 'broken';
  const client = load('src/lib/client-api.ts', {}, { fetch: async () => new Response(body, { status }) });
  await assert.rejects(client.requestJson('/'), /invalid JSON/);
  status = 500; await assert.rejects(client.requestJson('/'), /500/);
  status = 200; body = '{"ok":true}'; assert.equal((await client.requestJson('/')).ok, true);
  let sessions = 0, stored;
  const route = load('src/app/api/files/route.ts', {
    '@/lib/auth': { hasTrustedOrigin: (req) => req.headers.get('origin') !== 'https://evil.test', getSession: async () => { sessions++; return { id: 'u' }; } },
    '@/lib/db': { db: { vaultFile: { create: async ({data}) => { stored = data; return data; } } } },
    '@/lib/crypto': { encryptBytes: () => 'encrypted', decryptBytes: () => Buffer.alloc(0) },
    'next/server': { NextResponse: Response },
  });
  const upload = (form) => route.POST(new Request('https://aruk.test', { method: 'POST', body: form }));
  assert.equal((await route.POST(new Request('https://aruk.test', { method: 'POST', headers: { origin: 'https://evil.test' } }))).status, 403);
  assert.equal(sessions, 0);
  for (const flag of [undefined, 'true', 'false', 'invalid']) {
    const form = new FormData(); form.set('file', new File(['hello'], 'hello.txt')); if (flag !== undefined) form.set('encrypt', flag);
    assert.equal((await upload(form)).status, flag === 'invalid' ? 400 : 201);
    if (flag !== 'invalid') { assert.equal(stored.encrypted, flag !== 'false'); assert.equal(stored.payload.startsWith('plainbin:'), flag === 'false'); }
  }
  for (const length of [undefined, '1']) {
    let cancelled = false, reads = 0;
    const req = new Request('https://aruk.test', { method: 'POST', duplex: 'half', headers: length ? { 'content-length': length } : {}, body: new ReadableStream({ pull(controller) { reads++; controller.enqueue(new Uint8Array(1024 * 1024)); }, cancel() { cancelled = true; } }) });
    assert.equal((await route.POST(req)).status, 413); assert.equal(cancelled, true); assert.ok(reads <= 11);
  }
  // Exercise the actual auth module configuration without contacting providers.
  let options, tasks = [], sends = 0;
  const authMocks = {
    'next/server': { after: (task) => tasks.push(task) }, 'better-auth/minimal': { betterAuth: (value) => { options = value; return {}; } },
    'better-auth/next-js': { nextCookies() {} }, 'better-auth/plugins': { bearer() {}, twoFactor() {} }, '@better-auth/passkey': { passkey() {} },
    'better-auth/cookies': {}, '@better-auth/prisma-adapter': { prismaAdapter() {} }, './db': { db: {} },
    './secret-bootstrap': { resolveOrPersistSecret: () => ({ value: 'x'.repeat(32) }) }, './auth-email': { sendAuthEmail: async () => { sends++; } },
  };
  const env = { NODE_ENV: 'production', NEXT_PHASE: 'phase-production-build' };
  load('src/lib/auth.ts', authMocks, { process: { env } });
  assert.equal(options.account.encryptOAuthTokens, true);
  await options.emailAndPassword.sendResetPassword({ user: {email: 'test@example.test'}, url: '/' });
  await options.emailVerification.sendVerificationEmail({ user: {email: 'test@example.test'}, url: '/' });
  assert.equal(sends, 0); await Promise.all(tasks.map((task) => task())); assert.equal(sends, 2);
  delete env.NEXT_PHASE; assert.throws(() => load('src/lib/auth.ts', authMocks, { process: { env } }), /BETTER_AUTH_SECRET/);
  console.log('PASS: JSON errors, upload origin/stream bounds/encryption flags, build/runtime secret enforcement and deferred email delivery');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
