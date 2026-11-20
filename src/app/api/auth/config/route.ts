import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const emailDelivery = Boolean(process.env.RESEND_API_KEY)
    && (process.env.NODE_ENV !== "production" || Boolean(process.env.EMAIL_FROM?.trim()));
  const developmentEmailLog = process.env.NODE_ENV !== "production" && !process.env.RESEND_API_KEY;
  let adminSetupRequired = false;
  try {
    adminSetupRequired = await db.user.count() === 0;
  } catch (error) {
    console.error("[aruk] auth readiness database check failed:", error instanceof Error ? error.name : "unknown error");
    return NextResponse.json({
      databaseAvailable: false,
      registrationAvailable: false,
      emailDelivery,
      developmentEmailLog,
      adminSetupRequired: false,
      google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const emailAvailable = emailDelivery || developmentEmailLog;
  const bootstrapAvailable = !adminSetupRequired || Boolean(process.env.ADMIN_SETUP_TOKEN);
  return NextResponse.json({
    databaseAvailable: true,
    registrationAvailable: emailAvailable && bootstrapAvailable,
    emailDelivery,
    developmentEmailLog,
    adminSetupRequired,
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
  }, { headers: { "Cache-Control": "no-store" } });
}
