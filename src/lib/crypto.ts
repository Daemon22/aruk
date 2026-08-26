// ============================================================
// Aruk — Encryption at Rest
// ============================================================
// Secrets and cloud credentials must never be stored as plain
// JSON in the database. This module encrypts/decrypts them
// with AES-256-GCM using a key derived from ARUK_ENCRYPTION_KEY.
//
// Format written to the DB: "enc:v1:<ivHex>:<tagHex>:<ciphertextHex>"
//
// Backward compatibility: rows written before this module existed
// contain raw JSON (no "enc:v1:" prefix). decrypt() detects that
// and falls back to a plain JSON.parse so existing data still
// reads correctly; the next update() call will re-encrypt it.
// ============================================================

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { resolveOrPersistSecret } from '@/lib/secret-bootstrap';

const PREFIX = 'enc:v1:';

let warned = false;

function getKey(): Buffer {
  const { value, source } = resolveOrPersistSecret('ARUK_ENCRYPTION_KEY', '.aruk-encryption-key');
  if (source === 'generated' && !warned) {
    warned = true;
    console.warn(
      '[aruk] ARUK_ENCRYPTION_KEY is not set — generated and persisted a random key. ' +
      'For portability (backups, scaling to multiple instances) set ARUK_ENCRYPTION_KEY explicitly. ' +
      'Losing this key makes existing encrypted secrets unrecoverable.'
    );
  }
  // Derive a stable 32-byte key regardless of input length.
  return scryptSync(value, 'aruk-secret-vault-salt', 32);
}

export function encryptJson(value: unknown): string {
  const key = getKey();
  const iv = randomBytes(12); // GCM standard nonce size
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext.toString('hex')}`;
}

export function decryptJson<T = any>(stored: string): T {
  if (!stored) return {} as T;

  if (!stored.startsWith(PREFIX)) {
    // Legacy plaintext row written before encryption was added.
    try {
      return JSON.parse(stored);
    } catch {
      return {} as T;
    }
  }

  try {
    const [, , ivHex, tagHex, dataHex] = stored.split(':');
    const key = getKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const ciphertext = Buffer.from(dataHex, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString('utf8'));
  } catch {
    // Wrong/rotated key, or corrupted row — fail closed, don't crash the caller.
    return {} as T;
  }
}


/** Encrypt a single secret value using the same authenticated vault format. */
export function encryptSecret(value: string): string {
  return encryptJson({ value });
}

/** Decrypt a single secret value. Legacy plaintext is accepted for migration. */
export function decryptSecret(stored: string): { value: string; legacy: boolean } {
  if (!stored) return { value: '', legacy: false };
  if (!stored.startsWith(PREFIX)) return { value: stored, legacy: true };
  const decoded = decryptJson<{ value?: unknown }>(stored);
  return { value: typeof decoded?.value === 'string' ? decoded.value : '', legacy: false };
}

export function isEncryptedSecret(stored: string): boolean {
  return stored.startsWith(PREFIX);
}
