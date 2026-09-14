import { hashPassword, verifyPassword } from '../src/lib/auth';

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
};

const password = 'correct horse battery staple';
const stored = hashPassword(password);

assert(verifyPassword(password, stored), 'valid password is accepted');
assert(!verifyPassword('wrong password', stored), 'wrong password is rejected');
assert(!verifyPassword(password, 'malformed'), 'malformed password hash is rejected');
assert(!verifyPassword(password, 'salt:short'), 'short password hash is rejected safely');

console.log('\nAuthentication primitive checks passed.');
