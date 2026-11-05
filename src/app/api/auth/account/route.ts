import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clearSessionCookie, getSessionContext, hasTrustedOrigin } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  // This destructive browser action must always carry an explicit trusted Origin.
  if (!request.headers.get("origin") || !hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  }
  const user = await getSessionContext(request);
  if (!user || user.sessionId === "dev") return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid confirmation." }, { status: 400 }); }
  if (!body || typeof body !== "object" || !("confirmation" in body) || body.confirmation !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm account removal." }, { status: 400 });
  }

  if (hasSupabaseConfig()) {
    if (!user.authUserId) return NextResponse.json({ error: "The account identity could not be verified." }, { status: 409 });
    const supabase = await createSupabaseServerClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const authTime = Number(claimsData?.claims?.auth_time);
    if (claimsError || !Number.isFinite(authTime) || Date.now() / 1000 - authTime > 10 * 60) {
      return NextResponse.json({ error: "For your protection, sign in again shortly before deleting your account." }, { status: 428 });
    }
    const admin = createSupabaseAdminClient();
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.authUserId);
    if (deleteError) {
      return NextResponse.json({ error: "Aruk could not delete the hosted account. Your data is still intact." }, { status: 502 });
    }
    // In Supabase Postgres the authUserId foreign key cascades. This also clears a local
    // SQLite mirror if the app is being reviewed before the hosted database is connected.
    await db.user.deleteMany({ where: { id: user.id } });
    return NextResponse.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
  }

  await db.user.deleteMany({ where: { id: user.id } });
  const response = NextResponse.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
  response.headers.set("Set-Cookie", clearSessionCookie());
  return response;
}
