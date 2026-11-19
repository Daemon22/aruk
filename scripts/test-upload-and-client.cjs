const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Load the real handlers with isolated authentication, crypto, and storage.
function load(file, mocks = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports, require: name => mocks[name] || require(name),
    Buffer, File, FormData, Response, Request,
    fetch: (...args) => globalThis.fetch(...args),
  }, { filename: file });
  return exports;
}

async function main() {
  let sessions = 0;
  let user = { id: 'test-user' };
  let stored;
  const { POST } = load('src/app/api/files/route.ts', {
    '@/lib/auth': {
      hasTrustedOrigin: req => req.headers.get('origin') !== 'https://untrusted.test',
      getSession: async () => { sessions++; return user; },
    },
    '@/lib/crypto': { encryptBytes: bytes => 'encrypted:' + bytes.toString('base64') },
    '@/lib/db': { db: { vaultFile: { create: async ({ data }) => { stored = data; return data; } } } },
    'next/server': { NextResponse: Response },
  });
  const upload = (encrypt, headers = {}) => {
    const body = new FormData();
    body.set('file', new File(['private contents'], 'private.txt'));
    if (encrypt !== undefined) body.set('encrypt', encrypt);
    return new Request('https://aruk.test/api/files', { method: 'POST', headers, body });
  };
  assert.equal((await POST(upload(undefined, { origin: 'https://untrusted.test' }))).status, 403);
  assert.equal(sessions, 0, 'origin is checked before session lookup');
  user = null;
  assert.equal((await POST(upload())).status, 401);
  user = { id: 'test-user' };
  for (const flag of [undefined, 'true', 'false']) {
    assert.equal((await POST(upload(flag))).status, 201);
    assert.equal(stored.encrypted, flag !== 'false');
    assert.equal(stored.payload.startsWith('encrypted:'), stored.encrypted);
  }
  for (const flag of ['', 'TRUE', '0', new File(['false'], 'flag')]) {
    stored = undefined;
    assert.equal((await POST(upload(flag))).status, 400);
    assert.equal(stored, undefined);
  }
  const limit = 8 * 1024 * 1024 + 64 * 1024;
  for (const length of [undefined, '1']) {
    let cancelled = false;
    let reads = 0;
    const headers = new Headers({ 'content-type': 'multipart/form-data; boundary=test' });
    if (length) headers.set('content-length', length);
    const body = new ReadableStream({
      pull(controller) { reads++; controller.enqueue(new Uint8Array(64 * 1024)); },
      cancel() { cancelled = true; },
    });
    const req = new Request('https://aruk.test/api/files', { method: 'POST', headers, body, duplex: 'half' });
    assert.equal((await POST(req)).status, 413);
    assert.equal(cancelled, true);
    assert.ok(reads <= limit / (64 * 1024) + 2, 'stops consuming oversized streams');
  }
  const oversized = new FormData();
  oversized.set('file', new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'large'));
  assert.equal((await POST(new Request('https://aruk.test', { method: 'POST', body: oversized }))).status, 413);
  assert.equal((await POST(new Request('https://aruk.test', { method: 'POST', body: 'invalid' }))).status, 400);

  const { requestJson, requestArray } = load('src/lib/client-api.ts');
  const originalFetch = globalThis.fetch;
  try {
    for (const body of ['{', '<html>error</html>', '']) {
      globalThis.fetch = async () => new Response(body);
      await assert.rejects(requestJson('/test'));
    }
    globalThis.fetch = async () => new Response('{"ok":true}');
    assert.equal((await requestJson('/test')).ok, true);
    globalThis.fetch = async () => new Response('null');
    assert.equal(await requestJson('/test'), null);
    await assert.rejects(requestArray('/test'), /invalid list/);
    for (const [status, body, message] of [
      [401, '<html>unauthorized</html>', 'Sign in to Aruk'],
      [500, '{', 'Aruk request failed (500)'],
      [403, '{"error":"Denied"}', 'Denied'],
    ]) {
      globalThis.fetch = async () => new Response(body, { status });
      await assert.rejects(requestJson('/test'), error => error.message.includes(message));
    }
  } finally { globalThis.fetch = originalFetch; }
  console.log('PASS: upload security boundaries and client JSON response handling');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
