const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require: name => mocks[name] || require(name),
    Buffer,
    Request,
    Response,
    Headers,
    Uint8Array,
  }, { filename: file });
  return exports;
}

async function main() {
  let user = { id: 'owner-1' };
  let sessions = 0;
  let calls = { create: 0, restore: 0 };
  let receivedFile;
  let receivedPassphrase;
  let adapterOptions;
  const engine = {
    createCraftHttpAdapter(options) {
      adapterOptions = options;
      return {
        async create(request) {
          calls.create++;
          const form = await request.formData();
          receivedFile = form.get('file');
          receivedPassphrase = form.get('passphrase');
          return new Response('fixture.craft', {
            headers: {
              'Content-Type': 'application/octet-stream',
              'Content-Disposition': 'attachment; filename="fixture.craft"',
              'X-Craft-Artifact-Kind': 'compression-and-encryption',
            },
          });
        },
        async restore(request) {
          calls.restore++;
          const form = await request.formData();
          receivedFile = form.get('file');
          receivedPassphrase = form.get('passphrase');
          return new Response('restored bytes', {
            headers: {
              'Content-Type': 'application/octet-stream',
              'Content-Disposition': 'attachment; filename="restored.txt"',
              'X-Craft-Integrity-Verified': 'true',
            },
          });
        },
      };
    },
  };
  const { handleCraftArchiveRequest } = load('src/lib/craft-archive.ts', {
    './auth': {
      hasTrustedOrigin: request => request.headers.get('origin') !== 'https://untrusted.test',
      getSession: async () => { sessions++; return user; },
    },
    'craft-engine/lib/craft/http-adapter': engine,
  });

  assert.equal(adapterOptions.maxFileSizeBytes, 8 * 1024 * 1024);
  const makeUpload = (url = 'https://aruk.test/api/craft/archive', origin = 'https://aruk.test') => {
    const form = new FormData();
    form.set('file', new File(['sample input'], 'sample.txt', { type: 'text/plain' }));
    form.set('passphrase', 'long-enough-passphrase');
    return new Request(url, { method: 'POST', headers: { origin }, body: form });
  };

  const sessionCountBeforeMethod = sessions;
  assert.equal((await handleCraftArchiveRequest(new Request('https://aruk.test/api/craft/archive'), 'archive')).status, 405);
  assert.equal(sessions, sessionCountBeforeMethod, 'non-POST requests do not query sessions');

  assert.equal((await handleCraftArchiveRequest(makeUpload(undefined, 'https://untrusted.test'), 'archive')).status, 403);
  assert.equal(sessions, sessionCountBeforeMethod, 'untrusted origins are rejected before session lookup');

  user = null;
  assert.equal((await handleCraftArchiveRequest(makeUpload(), 'archive')).status, 401);
  assert.equal(calls.create, 0, 'unauthenticated files are not passed to Craft');
  user = { id: 'owner-1' };

  const created = await handleCraftArchiveRequest(makeUpload(), 'archive');
  assert.equal(created.status, 200);
  assert.equal(await created.text(), 'fixture.craft');
  assert.equal(calls.create, 1);
  assert.equal(receivedFile.name, 'sample.txt');
  assert.equal(receivedPassphrase, 'long-enough-passphrase');
  assert.equal(created.headers.get('cache-control'), 'no-store, private');
  assert.equal(created.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(created.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(created.headers.get('x-craft-artifact-kind'), 'compression-and-encryption');

  const restored = await handleCraftArchiveRequest(makeUpload('https://aruk.test/api/craft/restore'), 'restore');
  assert.equal(restored.status, 200);
  assert.equal(await restored.text(), 'restored bytes');
  assert.equal(calls.restore, 1);
  assert.equal(restored.headers.get('x-craft-integrity-verified'), 'true');
  assert.equal(restored.headers.get('cache-control'), 'no-store, private');

  const tooLong = new Request('https://aruk.test/api/craft/archive', {
    method: 'POST',
    headers: { origin: 'https://aruk.test', 'content-length': String(8 * 1024 * 1024 + 64 * 1024 + 1) },
    body: 'x',
  });
  assert.equal((await handleCraftArchiveRequest(tooLong, 'archive')).status, 413);
  assert.equal(calls.create, 1, 'declared oversized requests are rejected before archive processing');

  let pulls = 0;
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) {
      pulls++;
      controller.enqueue(new Uint8Array(64 * 1024));
    },
    cancel() { cancelled = true; },
  });
  const streamingRequest = new Request('https://aruk.test/api/craft/archive', {
    method: 'POST',
    headers: { origin: 'https://aruk.test', 'content-type': 'multipart/form-data; boundary=test' },
    body: stream,
    duplex: 'half',
  });
  assert.equal((await handleCraftArchiveRequest(streamingRequest, 'archive')).status, 413);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(cancelled, true, 'oversized chunked uploads are cancelled');
  assert.ok(pulls <= 140, 'the route stops reading at its bounded request size');
  assert.equal(calls.create, 1, 'oversized request streams never reach Craft');

  const realHandler = load('src/lib/craft-archive.ts', {
    './auth': {
      hasTrustedOrigin: () => true,
      getSession: async () => ({ id: 'owner-1' }),
    },
    'craft-engine/lib/craft/http-adapter': require('craft-engine/lib/craft/http-adapter'),
  });
  const passphrase = 'unique test passphrase for craft';
  const sourceBytes = Buffer.from('Aruk Craft archive integration round trip.');
  const createForm = new FormData();
  createForm.set('file', new File([sourceBytes], 'roundtrip.txt', { type: 'text/plain' }));
  createForm.set('passphrase', passphrase);
  const crafted = await realHandler.handleCraftArchiveRequest(
    new Request('https://aruk.test/api/craft/archive', { method: 'POST', body: createForm }),
    'archive',
  );
  assert.equal(crafted.status, 200);
  assert.match(crafted.headers.get('content-disposition') || '', /roundtrip\.txt\.craft/);
  assert.equal(crafted.headers.get('x-craft-artifact-kind'), 'compression-and-encryption');
  const craftedBytes = Buffer.from(await crafted.arrayBuffer());
  assert.ok(craftedBytes.length > 0);

  const restoreForm = new FormData();
  restoreForm.set('file', new File([craftedBytes], 'roundtrip.txt.craft'));
  restoreForm.set('passphrase', passphrase);
  const verified = await realHandler.handleCraftArchiveRequest(
    new Request('https://aruk.test/api/craft/restore', { method: 'POST', body: restoreForm }),
    'restore',
  );
  assert.equal(verified.status, 200);
  assert.equal(verified.headers.get('x-craft-integrity-verified'), 'true');
  assert.deepEqual(Buffer.from(await verified.arrayBuffer()), sourceBytes);

  console.log('PASS: Craft archive route auth, origin, size limits, headers, and real verified round trip');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
