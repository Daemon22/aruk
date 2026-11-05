import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, hasTrustedOrigin } from "@/lib/auth";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  if (!request.headers.get("origin") || !hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  }

  const sessionUser = await getSessionContext(request);
  if (!sessionUser || sessionUser.sessionId === "dev") {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid confirmation." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid confirmation." }, { status: 400 });
  }

  const input = body as { confirmation?: unknown; email?: unknown };
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (input.confirmation !== "DELETE" || email !== sessionUser.email.toLowerCase()) {
    return NextResponse.json({ error: "Confirm with your account email and type DELETE." }, { status: 400 });
  }

  const session = await db.session.findUnique({
    where: { id: sessionUser.sessionId },
    select: { createdAt: true },
  });
  if (!session || Date.now() - session.createdAt.getTime() > 10 * 60 * 1000) {
    return NextResponse.json({
      error: "For your protection, sign in again shortly before deleting your account.",
    }, { status: 428 });
  }

  const deleted = await db.user.deleteMany({ where: { id: sessionUser.id, email } });
  if (deleted.count !== 1) {
    return NextResponse.json({ error: "The account could not be found." }, { status: 404 });
  }

  return NextResponse.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
}
