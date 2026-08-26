import { resolveOrPersistSecret } from '../src/lib/secret-bootstrap';
import { existsSync, rmSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

let failures = 0;
function check(name: string, cond: boolean) {
  if (!cond) { failures++; console.error(`FAIL: ${name}`); }
  else console.log(`ok:   ${name}`);
}

// Point DATABASE_URL at a scratch dir so we don't touch the real db/ folder
const scratch = mkdtempSync(join(tmpdir(), 'aruk-secret-test-'));
process.env.DATABASE_URL = `file:${scratch}/test.db`;
delete process.env.ARUK_TEST_SECRET;

// 1. First call with no env var: generates and persists
const first = resolveOrPersistSecret('ARUK_TEST_SECRET', '.test-secret');
check('first call generates a secret', first.source === 'generated');
check('generated secret is non-trivial length', first.value.length >= 32);
check('secret file was actually written to disk', existsSync(join(scratch, '.test-secret')));

// 2. Second call (simulating a restart, still no env var): reuses the persisted one
const second = resolveOrPersistSecret('ARUK_TEST_SECRET', '.test-secret');
check('second call (restart) returns the SAME secret, not a new one', second.value === first.value);
check('second call reports source=generated (read from disk)', second.source === 'generated');

// 3. Explicit env var always wins, even if a persisted file exists
process.env.ARUK_TEST_SECRET = 'explicit-value-from-env';
const third = resolveOrPersistSecret('ARUK_TEST_SECRET', '.test-secret');
check('env var takes precedence over persisted file', third.value === 'explicit-value-from-env');
check('env var source is reported correctly', third.source === 'env');
delete process.env.ARUK_TEST_SECRET;

// 4. Two different secret names don't collide
const other = resolveOrPersistSecret('ARUK_TEST_SECRET_2', '.test-secret-2');
check('different secret name gets a different value', other.value !== first.value);

rmSync(scratch, { recursive: true, force: true });

console.log(failures === 0 ? '\nAll secret-bootstrap tests passed.' : `\n${failures} secret-bootstrap test(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
