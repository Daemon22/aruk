import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const user = await getSession(req);

  return NextResponse.json({
    authenticated: Boolean(user),
    user: user
      ? { id: user.id, email: user.email, name: user.name }
      : null,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
