import { encryptJson, decryptJson } from '../src/lib/crypto';

let failures = 0;
function check(name: string, cond: boolean) {
  if (!cond) { failures++; console.error(`FAIL: ${name}`); }
  else console.log(`ok:   ${name}`);
}

// 1. Basic round-trip
const original = { apiKey: 'sk-test-1234', region: 'us-east-1' };
const enc = encryptJson(original);
check('encrypted value has enc:v1: prefix', enc.startsWith('enc:v1:'));
check('encrypted value does not contain plaintext secret', !enc.includes('sk-test-1234'));
const dec = decryptJson<typeof original>(enc);
check('round-trip preserves value', JSON.stringify(dec) === JSON.stringify(original));

// 2. Legacy plaintext row (pre-encryption data) still reads correctly
const legacyRow = JSON.stringify({ apiKey: 'legacy-key', old: true });
const decLegacy = decryptJson(legacyRow);
check('legacy plaintext JSON still decrypts via fallback', decLegacy.apiKey === 'legacy-key');

// 3. Empty / garbage input doesn't throw
check('empty string does not throw', (() => { try { decryptJson(''); return true; } catch { return false; } })());
check('garbage string does not throw', (() => { try { decryptJson('not json and not enc'); return true; } catch { return false; } })());
check('corrupted enc:v1 payload does not throw', (() => { try { decryptJson('enc:v1:aa:bb:cc'); return true; } catch { return false; } })());

// 4. Different plaintexts produce different ciphertexts (nonce is actually random)
const encA = encryptJson({ x: 1 });
const encB = encryptJson({ x: 1 });
check('same plaintext encrypts to different ciphertext each time (random IV)', encA !== encB);
check('but both still decrypt to the same value', JSON.stringify(decryptJson(encA)) === JSON.stringify(decryptJson(encB)));

// 5. Tampered ciphertext fails closed (returns empty object, doesn't throw, doesn't return garbage-but-plausible data)
const tampered = enc.slice(0, -4) + 'ffff';
const decTampered = decryptJson(tampered);
check('tampered ciphertext does not silently return the original secret', JSON.stringify(decTampered) !== JSON.stringify(original));

console.log(failures === 0 ? '\nAll crypto tests passed.' : `\n${failures} crypto test(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
