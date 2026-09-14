// ============================================================
// Aruk — Authentication
// ============================================================
// Simple, self-hosted auth. Each user is private.
// Aruk is not a SaaS — he is a personal intermediary.
// ============================================================

import { db } from '@/lib/db';
import { randomBytes, createHmac, scryptSync, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { resolveOrPersistSecret } from '@/lib/secret-bootstrap';

function resolveSessionSecret(): string {
  const { value, source } = resolveOrPersistSecret('ARUK_SESSION_SECRET', '.aruk-session-secret');
  if (source === 'generated') {
    console.warn(
      '[aruk] ARUK_SESSION_SECRET is not set — generated and persisted a random secret. ' +
      'For portability (backups, scaling to multiple instances) set ARUK_SESSION_SECRET explicitly.'
    );
  }
  return value;
}

const SESSION_SECRET = resolveSessionSecret();
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ── Password hashing (scrypt, zero external deps) ────────────

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const verify = scryptSync(password, salt, 64).toString('hex');
  if (hash.length !== verify.length) return false;
  return timingSafeEqual(Buffer.from(hash), Buffer.from(verify));
}

// ── Session tokens (HMAC-signed, stateless) ──────────────────

export function createSessionToken(userId: string): string {
  const ts = Date.now().toString(36);
  const nonce = randomBytes(16).toString('hex');
  const payload = `${userId}.${ts}.${nonce}`;
  const sig = createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [userId, ts, nonce, sig] = parts;
  const payload = `${userId}.${ts}.${nonce}`;
  const expected = createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  // Check expiry
  const issued = parseInt(ts, 36);
  if (Date.now() - issued > SESSION_MAX_AGE_MS) return null;
  return userId;
}

// ── Session helpers for API routes ───────────────────────────

const DEV_USER = { id: 'dev', email: 'dev@aruk.local', name: 'Dev' };
// Set ARUK_BYPASS_AUTH=true in .env to skip auth (dev/testing only)
const BYPASS_AUTH = process.env.ARUK_BYPASS_AUTH === 'true';
if (BYPASS_AUTH && process.env.NODE_ENV === 'production') {
  throw new Error('ARUK_BYPASS_AUTH must not be enabled in production');
}

export async function getSession(req: Request): Promise<{ id: string; email: string; name: string } | null> {
  // Dev bypass — skip auth entirely when ARUK_BYPASS_AUTH=true
  if (BYPASS_AUTH) {
    // Ensure the dev user exists in DB (auto-create on first call)
    try {
      await db.user.upsert({
        where: { id: DEV_USER.id },
        update: {},
        create: { id: DEV_USER.id, email: DEV_USER.email, name: DEV_USER.name, passwordHash: 'bypass' },
      });
    } catch { /* ignore */ }
    return DEV_USER;
  }
  const authorization = req.headers.get('authorization') || '';
  const bearerToken = /^Bearer\s+([^\s]+)$/i.exec(authorization)?.[1];
  const cookieHeader = req.headers.get('cookie') || '';
  const cookieToken = /(?:^|;\s*)aruk_session=([^;]+)/.exec(cookieHeader)?.[1];
  if (bearerToken && cookieToken) {
    const bearerUserId = verifySessionToken(bearerToken);
    const cookieUserId = verifySessionToken(cookieToken);
    if (!bearerUserId || !cookieUserId || bearerUserId !== cookieUserId) return null;
  }
  const token = bearerToken || cookieToken;
  if (!token) return null;
  const userId = verifySessionToken(token);
  if (!userId) return null;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  return user;
}

export function sessionCookie(token: string): string {
  return `aruk_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_MS / 1000}`;
}

export function clearSessionCookie(): string {
  return 'aruk_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
}
