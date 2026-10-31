import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { allowAuthAttempt } from '@/lib/auth-rate-limit';
import { createSessionToken, hasTrustedOrigin, hashPassword, sessionCookie } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (process.env.ARUK_ALLOW_PUBLIC_SIGNUP !== 'true') {
    return NextResponse.json({ error: 'Account registration is disabled on this Aruk instance.' }, { status: 403 });
  }
  if (!hasTrustedOrigin(req)) return NextResponse.json({ error: 'Untrusted request origin.' }, { status: 403 });

  let parsed: unknown;
  try { parsed = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  const body = parsed as { email?: unknown; name?: unknown; password?: unknown };
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  if (email === 'dev@aruk.local') return NextResponse.json({ error: 'That account address is reserved.' }, { status: 400 });
  if (name.length < 1 || name.length > 100) return NextResponse.json({ error: 'Name must be 1–100 characters.' }, { status: 400 });
  if (password.length < 12 || password.length > 256) {
    return NextResponse.json({ error: 'Password must be 12–256 characters.' }, { status: 400 });
  }
  if (!allowAuthAttempt(req, 'register', email)) {
    return NextResponse.json({ error: 'Too many registration attempts. Try again later.' }, { status: 429 });
  }

  try {
    const user = await db.user.create({ data: { email, name, passwordHash: hashPassword(password) } });
    const token = await createSessionToken(user.id);
    const response = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name }, token }, { status: 201 });
    response.headers.set('Set-Cookie', sessionCookie(token));
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'An account could not be created with those details.' }, { status: 409 });
    }
    throw error;
  }
}
