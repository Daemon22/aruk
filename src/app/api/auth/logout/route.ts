import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clearSessionCookie, getSessionContext, hasTrustedOrigin } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  if (!hasTrustedOrigin(req)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });

  if (hasSupabaseConfig()) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return NextResponse.json({ error: "Aruk could not sign you out." }, { status: 400 });
    return NextResponse.json({ signedOut: true }, { headers: { "Cache-Control": "no-store" } });
  }

  const session = await getSessionContext(req);
  if (session && session.sessionId !== "dev") {
    await db.authSession.updateMany({
      where: { id: session.sessionId, userId: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  const response = NextResponse.json({ signedOut: true });
  response.headers.set("Set-Cookie", clearSessionCookie());
  response.headers.set("Cache-Control", "no-store");
  return response;
}
