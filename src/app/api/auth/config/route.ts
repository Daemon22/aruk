import { NextResponse } from "next/server";
import { getAuthEmailConfig } from "@/lib/auth-email";

export const runtime = "nodejs";

export async function GET() {
  const email = getAuthEmailConfig();
  const socialProviders = [
    ...(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim() ? ["google"] : []),
    ...(process.env.GITHUB_CLIENT_ID?.trim() && process.env.GITHUB_CLIENT_SECRET?.trim() ? ["github"] : []),
  ];
  return NextResponse.json({
    emailDelivery: email.configured,
    emailProvider: email.provider,
    developmentEmailLog: email.developmentEmailLog,
    socialProviders,
  }, { headers: { "Cache-Control": "no-store" } });
}
