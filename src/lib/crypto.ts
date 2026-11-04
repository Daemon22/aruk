// Aruk — authenticated encryption for stored credentials and files.
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { resolveOrPersistSecret } from "@/lib/secret-bootstrap";

const JSON_PREFIX = "enc:v1:";
const BINARY_PREFIX = "encbin:v1:";
let warned = false;

function getKey(): Buffer {
  const { value, source } = resolveOrPersistSecret("ARUK_ENCRYPTION_KEY", ".aruk-encryption-key");
  if (source === "generated" && !warned) {
    warned = true;
    console.warn(
      "[aruk] ARUK_ENCRYPTION_KEY is not set — generated and persisted a random key. " +
      "Set it explicitly for portable backups and multi-instance deployments. " +
      "Losing this key makes encrypted data unrecoverable.",
    );
  }
  return scryptSync(value, "aruk-secret-vault-salt", 32);
}

export function encryptJson(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return JSON_PREFIX + [iv.toString("hex"), cipher.getAuthTag().toString("hex"), ciphertext.toString("hex")].join(":");
}

export function decryptJson<T = any>(stored: string): T {
  if (!stored) return {} as T;
  if (!stored.startsWith(JSON_PREFIX)) {
    try { return JSON.parse(stored); } catch { return {} as T; }
  }
  try {
    const [, , ivHex, tagHex, dataHex] = stored.split(":");
    if (!ivHex || !tagHex || dataHex === undefined) return {} as T;
    const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
    return JSON.parse(plaintext.toString("utf8"));
  } catch {
    return {} as T;
  }
}

export function encryptBytes(value: Uint8Array): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(value)), cipher.final()]);
  return BINARY_PREFIX + [iv.toString("hex"), cipher.getAuthTag().toString("hex"), ciphertext.toString("base64")].join(":");
}

export function decryptBytes(stored: string): Buffer {
  if (!stored.startsWith(BINARY_PREFIX)) throw new Error("Encrypted file data has an unsupported format.");
  const [, , ivHex, tagHex, dataBase64] = stored.split(":");
  if (!ivHex || !tagHex || dataBase64 === undefined) throw new Error("Encrypted file data is incomplete.");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(dataBase64, "base64")), decipher.final()]);
}

export function isEncryptedBytes(stored: string): boolean {
  return stored.startsWith(BINARY_PREFIX);
}

export function encryptSecret(value: string): string {
  return encryptJson({ value });
}

export function decryptSecret(stored: string): { value: string; legacy: boolean } {
  if (!stored) return { value: "", legacy: false };
  if (!stored.startsWith(JSON_PREFIX)) return { value: stored, legacy: true };
  const decoded = decryptJson<{ value?: unknown }>(stored);
  return { value: typeof decoded?.value === "string" ? decoded.value : "", legacy: false };
}

export function isEncryptedSecret(stored: string): boolean {
  return stored.startsWith(JSON_PREFIX);
}
