// ============================================================
// Aruk — Secret Bootstrapping
// ============================================================
// Used for values like the session-signing secret and the
// encryption key that must exist before the app can safely run,
// but that a self-hosted/desktop install may not have a way to
// set via environment variables (e.g. the Tauri desktop build
// has no .env file and no shell to export into).
//
// Resolution order:
//   1. The named environment variable, if set — always preferred,
//      since it's explicit, rotatable, and shareable across
//      horizontally-scaled instances.
//   2. A previously generated secret persisted on disk next to
//      the SQLite database.
//   3. A freshly generated secret, written to disk for next time.
//
// This only runs when the env var is absent — it never silently
// overrides an explicitly configured secret.
// ============================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { randomBytes } from 'crypto';

function dataDir(): string {
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.startsWith('file:')) {
    const dbPath = dbUrl.replace(/^file:/, '');
    const dir = dirname(dbPath);
    if (dir && dir !== '.') return resolve(dir);
  }
  // Fallback: a local ./data directory next to wherever the process runs.
  return resolve(process.cwd(), 'data');
}

export function resolveOrPersistSecret(envVarName: string, fileName: string): { value: string; source: 'env' | 'generated' } {
  const fromEnv = process.env[envVarName];
  if (fromEnv) return { value: fromEnv, source: 'env' };

  const dir = dataDir();
  const filePath = resolve(dir, fileName);

  try {
    if (existsSync(filePath)) {
      const existing = readFileSync(filePath, 'utf8').trim();
      if (existing) return { value: existing, source: 'generated' };
    }
  } catch {
    // Fall through to generating a fresh one for this process.
  }

  const generated = randomBytes(32).toString('hex');
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, generated, { mode: 0o600 });
  } catch (err) {
    // Couldn't persist (read-only filesystem, etc). The generated value
    // still works for this process — it just won't survive a restart,
    // which will invalidate sessions / prevent decrypting prior secrets.
    console.warn(`[aruk] Could not persist ${fileName} to ${dir}: ${(err as Error).message}`);
  }

  return { value: generated, source: 'generated' };
}
