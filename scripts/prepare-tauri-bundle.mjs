import { cpSync, mkdirSync, existsSync, writeFileSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SERVER_DIR = resolve(ROOT, 'src-tauri', 'server');

console.log('\n  🔧 Aruk — Preparing Tauri server bundle\n');

// ── Clean previous ──────────────────────────────────────────
if (existsSync(SERVER_DIR)) {
  rmSync(SERVER_DIR, { recursive: true });
}
mkdirSync(SERVER_DIR, { recursive: true });

// ── Validate build output ────────────────────────────────────
const standaloneDir = resolve(ROOT, '.next', 'standalone');
if (!existsSync(resolve(standaloneDir, 'server.js'))) {
  console.error('  ❌  Next.js standalone build not found.');
  console.error('      Run:  bun run build');
  process.exit(1);
}

// ── 1. Copy standalone output ────────────────────────────────
console.log('  📦  Copying standalone server...');
cpSync(standaloneDir, SERVER_DIR, { recursive: true });

// ── 2. Ensure .next/static is present ────────────────────────
console.log('  📦  Copying static assets...');
const staticSrc = resolve(ROOT, '.next', 'static');
const staticDst = resolve(SERVER_DIR, '.next', 'static');
if (existsSync(staticSrc)) {
  mkdirSync(staticDst, { recursive: true });
  cpSync(staticSrc, staticDst, { recursive: true });
}

// ── 3. Ensure public/ is present ─────────────────────────────
console.log('  📦  Copying public assets...');
const publicSrc = resolve(ROOT, 'public');
const publicDst = resolve(SERVER_DIR, 'public');
if (existsSync(publicSrc)) {
  cpSync(publicSrc, publicDst, { recursive: true });
}

// ── 4. Copy Prisma schema for runtime migrations ────────────
console.log('  📦  Copying Prisma schema...');
const prismaSrc = resolve(ROOT, 'prisma');
const prismaDst = resolve(SERVER_DIR, 'prisma');
if (existsSync(prismaSrc)) {
  cpSync(prismaSrc, prismaDst, { recursive: true });
}

// ── 5. Write the startup wrapper ──────────────────────────────
// This is what Tauri's Rust side calls: bun start.mjs
// It ensures the DB directory exists, then imports the real server.
console.log('  📦  Writing startup wrapper...');

const startScript = `// ─── Aruk Tauri Startup Wrapper ────────────────────────
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
<<<<<<< HEAD
  const dbPath = dbUrl.replace('file:', '').replace('/aruk.db', '').replace(/\\\\/g, '/');
=======
  const dbPath = dbUrl.replace('file:', '').replace('/aruk.db', '').replace(/\\/g, '/');
>>>>>>> 193e563eec90177528092e21ed6ea88aad226193
  if (dbPath && !existsSync(dbPath)) {
    mkdirSync(dbPath, { recursive: true });
    console.log('[aruk] Created data directory: ' + dbPath);
  }
}

console.log('[aruk] Starting on port ' + (process.env.PORT || 3000) + '...');
console.log('[aruk] Database: ' + (process.env.DATABASE_URL || '(default)'));

// Boot the Next.js standalone server
import('./server.js');
`;

writeFileSync(resolve(SERVER_DIR, 'start.mjs'), startScript);

// ── Done ────────────────────────────────────────────────────
const serverFiles = [];
import('node:fs').then(({ readdirSync, statSync }) => {
  function walk(dir, prefix = '') {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix + entry.name;
      if (entry.isDirectory()) walk(resolve(dir, entry.name), rel + '/');
      else serverFiles.push(rel);
    }
  }
  walk(SERVER_DIR);
  console.log('  ✅  Bundle ready: ' + serverFiles.length + ' files\n');
  console.log('  📋  Next: bun run tauri:build\n');
});
