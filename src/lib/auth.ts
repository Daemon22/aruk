import { after } from "next/server";
import { betterAuth } from "better-auth/minimal";
import { nextCookies } from "better-auth/next-js";
import { bearer, twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { getSessionCookie } from "better-auth/cookies";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { db } from "./db";
import { resolveOrPersistSecret } from "./secret-bootstrap";
import { sendAuthEmail } from "./auth-email";

const databaseUrl = process.env.DATABASE_URL || "file:./db/custom.db";
const databaseProvider = /^postgres(?:ql)?:\/\//i.test(databaseUrl) ? "postgresql" : "sqlite";
const baseURL = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const baseOrigin = new URL(baseURL).origin;
const trustedOrigins = Array.from(new Set([
  baseOrigin,
  ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS || process.env.ARUK_TRUSTED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
]));

const secret = process.env.BETTER_AUTH_SECRET
  || (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build" ? "" : resolveOrPersistSecret("BETTER_AUTH_SECRET", ".aruk-session-secret").value);
if (!secret || secret.length < 32) {
  throw new Error("Set BETTER_AUTH_SECRET to a random value of at least 32 characters.");
}

export const auth = betterAuth({
  appName: "Aruk",
  baseURL,
  secret,
  database: prismaAdapter(db, { provider: databaseProvider }),
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: false,
    minPasswordLength: 1,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      after(() => sendAuthEmail({
        to: user.email,
        subject: "Reset your Aruk password",
        message: "Use this one-time link to choose a new password.",
        url,
      }).catch((error: unknown) => console.error("[aruk] auth email failed:", error instanceof Error ? error.message : error)));
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      after(() => sendAuthEmail({
        to: user.email,
        subject: "Verify your Aruk email",
        message: "Verify your email address to finish creating your Aruk account.",
        url,
      }).catch((error: unknown) => console.error("[aruk] auth email failed:", error instanceof Error ? error.message : error)));
    },
  },
  plugins: [
    bearer(),
    twoFactor({ issuer: "Aruk", allowPasswordless: true }),
    passkey({
      rpName: "Aruk",
      rpID: new URL(baseURL).hostname,
      origin: trustedOrigins,
    }),
    nextCookies(),
  ],
  advanced: {
    backgroundTasks: { handler: (promise) => { after(() => promise); } },
    useSecureCookies: process.env.NODE_ENV === "production",
  },
});

export type SessionContext = {
  id: string;
  email: string;
  name: string;
  sessionId: string;
};

const DEV_USER = { id: "dev", email: "dev@aruk.local", name: "Dev", sessionId: "dev" };
const BYPASS_AUTH = process.env.ARUK_BYPASS_AUTH === "true";
if (BYPASS_AUTH && process.env.NODE_ENV === "production") {
  throw new Error("ARUK_BYPASS_AUTH must not be enabled in production");
}

export async function getSessionContext(req: Request): Promise<SessionContext | null> {
  if (BYPASS_AUTH) {
    await db.user.upsert({
      where: { id: DEV_USER.id },
      update: {},
      create: { id: DEV_USER.id, email: DEV_USER.email, name: DEV_USER.name },
    });
    return DEV_USER;
  }

  const authorization = req.headers.get("authorization");
  const bearerMatch = authorization?.match(/^Bearer\s+([^\s]+)$/i);
  if (authorization && !bearerMatch) return null;

  const cookieToken = getSessionCookie(req.headers);
  let current: Awaited<ReturnType<typeof auth.api.getSession>>;
  if (bearerMatch) {
    const bearerSession = await auth.api.getSession({
      headers: new Headers({ authorization: `Bearer ${bearerMatch[1]}` }),
    });
    if (!bearerSession) return null;
    if (cookieToken) {
      const cookieSession = await auth.api.getSession({
        headers: new Headers({ cookie: req.headers.get("cookie") || "" }),
      });
      if (!cookieSession || cookieSession.user.id !== bearerSession.user.id) return null;
    }
    current = bearerSession;
  } else {
    current = await auth.api.getSession({ headers: req.headers });
  }
  if (!current) return null;
  return {
    id: current.user.id,
    email: current.user.email,
    name: current.user.name || current.user.email.split("@")[0] || "Aruk user",
    sessionId: current.session.id,
  };
}

export async function getSession(req: Request): Promise<Omit<SessionContext, "sessionId"> | null> {
  const context = await getSessionContext(req);
  if (!context) return null;
  const { sessionId: _sessionId, ...user } = context;
  return user;
}

/** Allow this request's own origin or explicitly configured browser origins. */
export function hasTrustedOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  let originUrl: URL;
  let requestUrl: URL;
  try {
    originUrl = new URL(origin);
    requestUrl = new URL(req.url);
  } catch {
    return false;
  }

  if (trustedOrigins.includes(originUrl.origin)) return true;
  if (originUrl.origin === requestUrl.origin) return true;

  const loopbacks = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  return process.env.NODE_ENV !== "production"
    && originUrl.protocol === requestUrl.protocol
    && originUrl.port === requestUrl.port
    && loopbacks.has(originUrl.hostname)
    && loopbacks.has(requestUrl.hostname);
}
