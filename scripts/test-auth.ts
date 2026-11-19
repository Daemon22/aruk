import { auth } from '../src/lib/auth';

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
};

async function main() {
  const password = 'correct horse battery staple';
  const context = await auth.$context;
  const stored = await context.password.hash(password);

  assert(await context.password.verify({ password, hash: stored }), 'valid password is accepted');
  assert(!await context.password.verify({ password: 'wrong password', hash: stored }), 'wrong password is rejected');
  let malformedRejected = false;
  try {
    malformedRejected = !await context.password.verify({ password, hash: 'malformed' });
  } catch {
    malformedRejected = true;
  }
  assert(malformedRejected, 'malformed password hash is rejected');

  console.log('\nAuthentication primitive checks passed.');
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
