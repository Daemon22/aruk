import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const emailDelivery = Boolean(process.env.RESEND_API_KEY)
    && (process.env.NODE_ENV !== "production" || Boolean(process.env.EMAIL_FROM?.trim()));
  return NextResponse.json({
    emailDelivery,
    developmentEmailLog: process.env.NODE_ENV !== "production" && !process.env.RESEND_API_KEY,
  }, { headers: { "Cache-Control": "no-store" } });
}
