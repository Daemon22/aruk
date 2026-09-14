import { db } from '@/lib/db';
import {
  clearSessionCookie,
  createSessionToken,
  getSession,
  hashPassword,
  sessionCookie,
  verifyPassword,
} from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

type AuthBody = {
  action?: 'sign_in' | 'register' | 'sign_out';
  email?: unknown;
  name?: unknown;
  password?: unknown;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function credentials(body: AuthBody) {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  return { email, name, password };
}

export async function GET(req: NextRequest) {
  const user = await getSession(req);
  return NextResponse.json({
    authenticated: Boolean(user),
    user: user ? { id: user.id, email: user.email, name: user.name } : null,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  let body: AuthBody;
  try {
    body = await req.json() as AuthBody;
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  if (body.action === 'sign_out') {
    const response = NextResponse.json({ ok: true });
    response.headers.set('Set-Cookie', clearSessionCookie());
    return response;
  }

  const { email, name, password } = credentials(body);
  if (!email || !password) return errorResponse('Email and password are required', 400);
  if (!email.includes('@')) return errorResponse('Enter a valid email address', 400);
  if (password.length < 8) return errorResponse('Password must be at least 8 characters', 400);

  if (body.action === 'register') {
    if (!name) return errorResponse('Name is required', 400);

    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) return errorResponse('An account with that email already exists', 409);

    const user = await db.user.create({
      data: { email, name, passwordHash: hashPassword(password) },
      select: { id: true, email: true, name: true },
    });
    const response = NextResponse.json({ ok: true, user }, { status: 201 });
    response.headers.set('Set-Cookie', sessionCookie(createSessionToken(user.id)));
    return response;
  }

  if (body.action !== 'sign_in') return errorResponse('Unknown authentication action', 400);

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, passwordHash: true },
  });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return errorResponse('Invalid email or password', 401);
  }

  const response = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name },
  });
  response.headers.set('Set-Cookie', sessionCookie(createSessionToken(user.id)));
  return response;
}
