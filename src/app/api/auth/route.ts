import { auth, getSession, hasTrustedOrigin } from "@/lib/auth";
import { allowAuthAttempt } from "@/lib/auth-rate-limit";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

type AuthBody = {
  action?: "sign_in" | "register" | "sign_out";
  email?: unknown;
  name?: unknown;
  password?: unknown;
  adminSetupToken?: unknown;
};

class RegistrationError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function readCredentials(body: AuthBody) {
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  return { email, name, password };
}

function matchesSetupToken(provided: unknown, expected: string): boolean {
  if (typeof provided !== "string") return false;
  const providedBytes = Buffer.from(provided, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}

function relayAuthResponse(response: Response) {
  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

async function forwardAuthAction(req: NextRequest, endpoint: "sign-in/email" | "sign-out", body?: unknown) {
  const headers = new Headers(req.headers);
  headers.delete("content-length");
  const response = await auth.handler(new Request(new URL(`/api/auth/${endpoint}`, req.url), {
    method: "POST",
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
  return relayAuthResponse(response);
}

async function createRegisteredUser(email: string, name: string, password: string, setupToken: unknown) {
  const context = await auth.$context;
  const passwordHash = await context.password.hash(password);
  const postgres = /^postgres(?:ql)?:\/\//i.test(process.env.DATABASE_URL || "");
  const transactionOptions = postgres ? { isolationLevel: "Serializable" as const } : undefined;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.$transaction(async (tx) => {
        const isFirstAccount = (await tx.user.count()) === 0;
        let role: "ADMIN" | "USER" = "USER";

        if (isFirstAccount) {
          const expectedToken = process.env.ADMIN_SETUP_TOKEN;
          if (!expectedToken) {
            throw new RegistrationError("Initial admin setup is unavailable. Set ADMIN_SETUP_TOKEN on the server.", 503);
          }
          if (!matchesSetupToken(setupToken, expectedToken)) {
            throw new RegistrationError("The one-time admin setup token is missing or incorrect.", 403);
          }
          role = "ADMIN";
        }

        const user = await tx.user.create({
          data: { email, name, role, emailVerified: false },
          select: { id: true, email: true, name: true, role: true },
        });
        await tx.account.create({
          data: {
            accountId: user.id,
            providerId: "credential",
            userId: user.id,
            password: passwordHash,
          },
        });
        return { user, isFirstAccount };
      }, transactionOptions);
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
      if (code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }

  throw new Error("Account registration could not complete.");
}

export async function GET(req: NextRequest) {
  const user = await getSession(req);
  return NextResponse.json({
    authenticated: Boolean(user),
    user: user ? { id: user.id, email: user.email, name: user.name } : null,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  if (!hasTrustedOrigin(req)) return errorResponse("This request origin is not trusted.", 403);

  let body: AuthBody;
  try {
    body = await req.json() as AuthBody;
  } catch {
    return errorResponse("Invalid JSON body.", 400);
  }

  if (body.action === "sign_out") {
    return forwardAuthAction(req, "sign-out", {});
  }

  const { email, name, password } = readCredentials(body);
  if (!email || !password) return errorResponse("Email and password are required.", 400);
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return errorResponse("Enter a valid email address.", 400);
  }
  if (password.length < 8 || password.length > 128) {
    return errorResponse("Password must be between 8 and 128 characters.", 400);
  }

  if (body.action === "register") {
    if (!allowAuthAttempt(req, "register", email)) {
      return errorResponse("Too many registration attempts. Try again in 15 minutes.", 429);
    }
    if (name.length < 1 || name.length > 100) return errorResponse("Enter a name between 1 and 100 characters.", 400);
    const emailConfigured = Boolean(process.env.RESEND_API_KEY)
      && (process.env.NODE_ENV !== "production" || Boolean(process.env.EMAIL_FROM?.trim()));
    if (!emailConfigured && process.env.NODE_ENV === "production") {
      return errorResponse("Account email delivery is not configured for this deployment.", 503);
    }

    try {
      const { user } = await createRegisteredUser(email, name, password, body.adminSetupToken);
      try {
        const baseURL = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
        await auth.api.sendVerificationEmail({
          body: { email, callbackURL: new URL("/", baseURL).toString() },
          headers: req.headers,
        });
      } catch (error) {
        console.error("[aruk] verification email could not be delivered:", error instanceof Error ? error.message : error);
        // Do not leave an unusable account behind when the required verification
        // email cannot be delivered. Cascades remove its credential and token rows.
        await db.user.delete({ where: { id: user.id } }).catch((cleanupError) => {
          console.error("[aruk] failed to roll back undeliverable account:", cleanupError instanceof Error ? cleanupError.message : cleanupError);
        });
        return errorResponse("We could not deliver the verification email. Please check the email sender configuration and try again.", 503);
      }
      return NextResponse.json({
        ok: true,
        user,
        requiresEmailVerification: true,
      }, { status: 201, headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      if (error instanceof RegistrationError) return errorResponse(error.message, error.status);
      const code = error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
      if (code === "P2002") return errorResponse("An account with that email already exists.", 409);
      console.error("[aruk] registration failed:", error instanceof Error ? error.message : error);
      return errorResponse("Account registration could not be completed.", 500);
    }
  }

  if (body.action !== "sign_in") return errorResponse("Unknown authentication action.", 400);
  if (!allowAuthAttempt(req, "login", email)) {
    return errorResponse("Too many sign-in attempts. Try again in 15 minutes.", 429);
  }
  return forwardAuthAction(req, "sign-in/email", { email, password, rememberMe: true });
}
