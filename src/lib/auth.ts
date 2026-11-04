// ============================================================
// Aruk — Per-user authentication and revocable sessions
// ============================================================

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';
import { resolveOrPersistSecret } from '@/lib/secret-bootstrap';

function resolveSessionSecret(): string {
  const { value, source } = resolveOrPersistSecret('ARUK_SESSION_SECRET', '.aruk-session-secret');
  if (source === 'generated') {
    console.warn('[aruk] Generated a local session secret. Set ARUK_SESSION_SECRET explicitly for production.');
  }
  return value;
}

const SESSION_SECRET = resolveSessionSecret();
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !/^[a-f0-9]{128}$/i.test(hash || '') || !/^[a-f0-9]{32}$/i.test(salt)) return false;
  const verify = scryptSync(password, salt, 64);
  return timingSafeEqual(Buffer.from(hash, 'hex'), verify);
}

function tokenDigest(token: string): string {
  return createHmac('sha256', SESSION_SECRET).update(token).digest('hex');
}

export async function createSessionToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await db.authSession.create({
    data: {
      userId,
      tokenHash: tokenDigest(token),
      expiresAt: new Date(Date.now() + SESSION_MAX_AGE_MS),
    },
  });
  return token;
}

type SessionContext = {
  id: string;
  email: string;
  name: string;
  sessionId: string;
};

const DEV_USER = { id: 'dev', email: 'dev@aruk.local', name: 'Dev', sessionId: 'dev' };
const BYPASS_AUTH = process.env.ARUK_BYPASS_AUTH === 'true';
if (BYPASS_AUTH && process.env.NODE_ENV === 'production') {
  throw new Error('ARUK_BYPASS_AUTH must not be enabled in production');
}

async function findSession(token: string): Promise<SessionContext | null> {
  if (token.length > 256 || token.length < 32) return null;
  const session = await db.authSession.findUnique({
    where: { tokenHash: tokenDigest(token) },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      revokedAt: true,
      user: { select: { id: true, email: true, name: true } },
    },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;
  return { ...session.user, sessionId: session.id };
}

export async function getSessionContext(req: Request): Promise<SessionContext | null> {
  if (BYPASS_AUTH) {
    await db.user.upsert({
      where: { id: DEV_USER.id },
      update: {},
      create: { id: DEV_USER.id, email: DEV_USER.email, name: DEV_USER.name, passwordHash: 'bypass' },
    });
    return DEV_USER;
  }

  const authorization = req.headers.get('authorization') || '';
  const bearerToken = /^Bearer\s+([^\s]+)$/i.exec(authorization)?.[1];
  const cookieToken = /(?:^|;\s*)aruk_session=([^;]+)/.exec(req.headers.get('cookie') || '')?.[1];
  if (!bearerToken && !cookieToken) return null;

  const [bearerSession, cookieSession] = await Promise.all([
    bearerToken ? findSession(bearerToken) : Promise.resolve(null),
    cookieToken ? findSession(cookieToken) : Promise.resolve(null),
  ]);
  if (bearerToken && cookieToken && (!bearerSession || !cookieSession || bearerSession.id !== cookieSession.id)) return null;
  return bearerSession || cookieSession;
}

export async function getSession(req: Request): Promise<Omit<SessionContext, 'sessionId'> | null> {
  const context = await getSessionContext(req);
  if (!context) return null;
  const { sessionId: _sessionId, ...user } = context;
  return user;
}

export function sessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `aruk_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_MS / 1000}${secure}`;
}

export function clearSessionCookie(): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `aruk_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

/** Reject browser-originated auth mutations from untrusted sites. */
export function hasTrustedOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // Non-browser SDK clients authenticate with bearer tokens.
  const allowed = new Set<string>();
  try { allowed.add(new URL(req.url).origin); } catch { /* invalid request URL */ }
  const configured = process.env.ARUK_CORS_ORIGIN;
  if (configured) {
    try { allowed.add(new URL(configured).origin); } catch { /* invalid deployment config */ }
  }
  return allowed.has(origin);
}
