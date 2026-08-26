// ─── Aruk Tauri Startup Wrapper ────────────────────────
// This file is called by the Tauri desktop app to boot the server.
// It ensures the data directory exists, then hands off to the
// Next.js standalone server.

import { existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ensure SQLite data directory exists
const dbUrl = process.env.DATABASE_URL || '';
if (dbUrl.startsWith('file:')) {
  const dbPath = dbUrl.replace('file:', '').replace('/aruk.db', '').replace(/\/g, '/');
  if (dbPath && !existsSync(dbPath)) {
    mkdirSync(dbPath, { recursive: true });
    console.log('[aruk] Created data directory: ' + dbPath);
  }
}

console.log('[aruk] Starting on port ' + (process.env.PORT || 3000) + '...');
console.log('[aruk] Database: ' + (process.env.DATABASE_URL || '(default)'));

// Boot the Next.js standalone server
import('./server.js');
