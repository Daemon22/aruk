import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const emailDelivery = Boolean(process.env.RESEND_API_KEY)
    && (process.env.NODE_ENV !== "production" || Boolean(process.env.EMAIL_FROM?.trim()));
  return NextResponse.json({
    emailDelivery,
    developmentEmailLog: process.env.NODE_ENV !== "production" && !process.env.RESEND_API_KEY,
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
  }, { headers: { "Cache-Control": "no-store" } });
}
