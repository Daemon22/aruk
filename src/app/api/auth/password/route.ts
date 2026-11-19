import { NextResponse } from "next/server";
import { auth, getSessionContext, hasTrustedOrigin } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!request.headers.get("origin") || !hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  }

  const sessionUser = await getSessionContext(request);
  if (!sessionUser || sessionUser.sessionId === "dev") {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid password request." }, { status: 400 });
  }
  const newPassword = body && typeof body === "object" && !Array.isArray(body)
    && "newPassword" in body && typeof body.newPassword === "string"
    ? body.newPassword
    : "";
  if (newPassword.length < 12 || newPassword.length > 128) {
    return NextResponse.json({ error: "Use a password between 12 and 128 characters." }, { status: 400 });
  }

  const session = await db.session.findUnique({
    where: { id: sessionUser.sessionId },
    select: { createdAt: true },
  });
  if (!session || Date.now() - session.createdAt.getTime() > 10 * 60 * 1000) {
    return NextResponse.json({ error: "Sign in again before setting a password." }, { status: 428 });
  }

  try {
    await auth.api.setPassword({
      body: { newPassword },
      headers: request.headers,
    });
    await db.session.deleteMany({
      where: { userId: sessionUser.id, id: { not: sessionUser.sessionId } },
    });
    return NextResponse.json({ passwordSet: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Aruk could not set the password." }, { status: 400 });
  }
}
