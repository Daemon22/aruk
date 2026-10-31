import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { allowAuthAttempt } from '@/lib/auth-rate-limit';
import { randomBytes } from 'crypto';
import { createSessionToken, hasTrustedOrigin, hashPassword, sessionCookie, verifyPassword } from '@/lib/auth';

export const runtime = 'nodejs';
const DUMMY_PASSWORD_HASH = hashPassword(randomBytes(32).toString('hex'));

export async function POST(req: Request) {
  if (!hasTrustedOrigin(req)) return NextResponse.json({ error: 'Untrusted request origin.' }, { status: 403 });
  let parsed: unknown;
  try { parsed = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  const body = parsed as { email?: unknown; password?: unknown };
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (email.length > 254 || password.length > 256) return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
  if (!allowAuthAttempt(req, 'login', email || 'missing-email')) {
    return NextResponse.json({ error: 'Too many sign-in attempts. Try again later.' }, { status: 429 });
  }

  const user = email ? await db.user.findUnique({ where: { email } }) : null;
  const passwordMatches = verifyPassword(password, user?.passwordHash || DUMMY_PASSWORD_HASH);
  const retiredDevelopmentAccount = process.env.NODE_ENV === 'production'
    && (user?.id === 'dev' || user?.email === 'dev@aruk.local');
  if (!user || !passwordMatches || retiredDevelopmentAccount) {
    return NextResponse.json({ error: 'Email or password is incorrect.' }, { status: 401 });
  }

  const token = await createSessionToken(user.id);
  const response = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name }, token });
  response.headers.set('Set-Cookie', sessionCookie(token));
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
