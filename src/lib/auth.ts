import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { resolveOrPersistSecret } from "@/lib/secret-bootstrap";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function resolveSessionSecret(): string {
  const { value, source } = resolveOrPersistSecret("ARUK_SESSION_SECRET", ".aruk-session-secret");
  if (source === "generated") {
    console.warn("[aruk] Generated a local session secret. Set ARUK_SESSION_SECRET explicitly for production.");
  }
  return value;
}

const SESSION_SECRET = resolveSessionSecret();
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return salt + ":" + hash;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !/^[a-f0-9]{128}$/i.test(hash || "") || !/^[a-f0-9]{32}$/i.test(salt)) return false;
  const verify = scryptSync(password, salt, 64);
  return timingSafeEqual(Buffer.from(hash, "hex"), verify);
}

function tokenDigest(token: string): string {
  return createHmac("sha256", SESSION_SECRET).update(token).digest("hex");
}

export async function createSessionToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.authSession.create({
    data: {
      userId,
      tokenHash: tokenDigest(token),
      expiresAt: new Date(Date.now() + SESSION_MAX_AGE_MS),
    },
  });
  return token;
}

export type SessionContext = {
  id: string;
  email: string;
  name: string;
  sessionId: string;
  authUserId?: string;
};

const DEV_USER = { id: "dev", email: "dev@aruk.local", name: "Dev", sessionId: "dev" };
const BYPASS_AUTH = process.env.ARUK_BYPASS_AUTH === "true";
if (BYPASS_AUTH && process.env.NODE_ENV === "production") {
  throw new Error("ARUK_BYPASS_AUTH must not be enabled in production");
}

async function findSession(token: string): Promise<SessionContext | null> {
  if (token.length > 256 || token.length < 32) return null;
  const session = await db.authSession.findUnique({
    where: { tokenHash: tokenDigest(token) },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      revokedAt: true,
      user: { select: { id: true, email: true, name: true } },
    },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;
  return { ...session.user, sessionId: session.id };
}

async function findSupabaseSession(): Promise<SessionContext | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  const authUser = data.user;
  if (error || !authUser?.email || !authUser.email_confirmed_at) return null;

  const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError) return null;
  if (assurance.nextLevel === "aal2" && assurance.currentLevel !== "aal2") return null;

  const email = authUser.email.trim().toLowerCase();
  const metadata = authUser.user_metadata ?? {};
  const nameValue = metadata.full_name ?? metadata.name ?? metadata.preferred_username;
  const name = typeof nameValue === "string" && nameValue.trim()
    ? nameValue.trim().slice(0, 100)
    : email.split("@")[0].slice(0, 100) || "Aruk user";

  let account = await db.user.findUnique({ where: { authUserId: authUser.id } });
  if (!account) {
    const byEmail = await db.user.findUnique({ where: { email } });
    if (byEmail) {
      if (byEmail.authUserId && byEmail.authUserId !== authUser.id) return null;
      account = await db.user.update({
        where: { id: byEmail.id },
        data: { authUserId: authUser.id, email, name },
      });
    } else {
      account = await db.user.create({
        data: { email, name, passwordHash: "", authUserId: authUser.id },
      });
    }
  } else {
    account = await db.user.update({
      where: { id: account.id },
      data: { email, name },
    });
  }

  return { id: account.id, email: account.email, name: account.name, sessionId: authUser.id, authUserId: authUser.id };
}

export async function getSessionContext(req: Request): Promise<SessionContext | null> {
  if (hasSupabaseConfig()) return findSupabaseSession();

  if (BYPASS_AUTH) {
    await db.user.upsert({
      where: { id: DEV_USER.id },
      update: {},
      create: { id: DEV_USER.id, email: DEV_USER.email, name: DEV_USER.name, passwordHash: "bypass" },
    });
    return DEV_USER;
  }

  const authorization = req.headers.get("authorization") || "";
  const bearerToken = /^Bearer\s+([^\s]+)$/i.exec(authorization)?.[1];
  const cookieToken = /(?:^|;\s*)aruk_session=([^;]+)/.exec(req.headers.get("cookie") || "")?.[1];
  if (!bearerToken && !cookieToken) return null;

  const [bearerSession, cookieSession] = await Promise.all([
    bearerToken ? findSession(bearerToken) : Promise.resolve(null),
    cookieToken ? findSession(cookieToken) : Promise.resolve(null),
  ]);
  if (bearerToken && cookieToken && (!bearerSession || !cookieSession || bearerSession.id !== cookieSession.id)) return null;
  return bearerSession || cookieSession;
}

export async function getSession(req: Request): Promise<Omit<SessionContext, "sessionId" | "authUserId"> | null> {
  const context = await getSessionContext(req);
  if (!context) return null;
  const { sessionId: _sessionId, authUserId: _authUserId, ...user } = context;
  return user;
}

export function sessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return "aruk_session=" + token + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" + (SESSION_MAX_AGE_MS / 1000) + secure;
}

export function clearSessionCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return "aruk_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" + secure;
}

/** Allow the request origin or explicitly configured trusted browser origins. */
export function hasTrustedOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // Native and non-browser clients may omit Origin.
  let originUrl: URL;
  let requestUrl: URL;
  try {
    originUrl = new URL(origin);
    requestUrl = new URL(req.url);
  } catch {
    return false;
  }

  const configured = (process.env.ARUK_TRUSTED_ORIGINS || process.env.ARUK_CORS_ORIGIN || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  for (const value of configured) {
    try {
      if (new URL(value).origin === originUrl.origin) return true;
    } catch {
      // Ignore malformed deployment configuration.
    }
  }
  if (originUrl.origin === requestUrl.origin) return true;

  const loopbacks = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  return process.env.NODE_ENV !== "production"
    && originUrl.protocol === requestUrl.protocol
    && originUrl.port === requestUrl.port
    && loopbacks.has(originUrl.hostname)
    && loopbacks.has(requestUrl.hostname);
}
