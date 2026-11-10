type AuthEmail = { to: string; subject: string; message: string; url: string };
export type AuthEmailProvider = "resend" | "postmark";
export type AuthEmailConfig = {
  provider: AuthEmailProvider | null;
  configured: boolean;
  developmentEmailLog: boolean;
  missing: string[];
  error: string | null;
};

const resendFrom = "Aruk <onboarding@resend.dev>";

function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function selectedProvider(): AuthEmailProvider | null {
  const explicit = env("EMAIL_PROVIDER")?.toLowerCase();
  if (explicit === "resend" || explicit === "postmark") return explicit;
  if (explicit) return null;
  return env("POSTMARK_SERVER_TOKEN") && !env("RESEND_API_KEY") ? "postmark" : "resend";
}

export function getAuthEmailConfig(): AuthEmailConfig {
  const provider = selectedProvider();
  if (!provider) {
    return {
      provider: null,
      configured: false,
      developmentEmailLog: false,
      missing: ["EMAIL_PROVIDER"],
      error: "EMAIL_PROVIDER must be resend or postmark.",
    };
  }

  const required = provider === "resend"
    ? ["RESEND_API_KEY", ...(process.env.NODE_ENV === "production" ? ["EMAIL_FROM"] : [])]
    : ["POSTMARK_SERVER_TOKEN", "EMAIL_FROM"];
  const missing = required.filter((name) => !env(name));
  const credentialConfigured = provider === "resend"
    ? Boolean(env("RESEND_API_KEY"))
    : Boolean(env("POSTMARK_SERVER_TOKEN"));

  return {
    provider,
    configured: missing.length === 0,
    developmentEmailLog: process.env.NODE_ENV !== "production" && !credentialConfigured,
    missing,
    error: null,
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] || character);
}

function renderHtml(subject: string, message: string, url: string): string {
  return `<!doctype html><html><body style="margin:0;background:#0b0f14;color:#e5e7eb;font-family:Arial,sans-serif"><div style="max-width:560px;margin:32px auto;padding:32px;border:1px solid #263241;border-radius:16px;background:#111827"><h1 style="font-size:22px;margin:0 0 16px">${escapeHtml(subject)}</h1><p style="line-height:1.6;margin:0 0 24px">${escapeHtml(message)}</p><p style="margin:0 0 24px"><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#f59e0b;color:#111827;font-weight:700;text-decoration:none">Continue to Aruk</a></p><p style="font-size:12px;line-height:1.5;color:#9ca3af;word-break:break-all">${escapeHtml(url)}</p></div></body></html>`;
}

async function sendResend({ to, subject, message, url, from }: AuthEmail & { from: string }): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text: `${message}\n\n${url}`,
      html: renderHtml(subject, message, url),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Account email delivery failed via Resend (HTTP ${response.status}).`);
  }
}

async function sendPostmark({ to, subject, message, url, from }: AuthEmail & { from: string }): Promise<void> {
  const response = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": env("POSTMARK_SERVER_TOKEN") || "",
    },
    body: JSON.stringify({
      From: from,
      To: to,
      Subject: subject,
      TextBody: `${message}\n\n${url}`,
      HtmlBody: renderHtml(subject, message, url),
      MessageStream: env("POSTMARK_MESSAGE_STREAM") || "outbound",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Account email delivery failed via Postmark (HTTP ${response.status}).`);
  }
}

export async function sendAuthEmail(email: AuthEmail): Promise<void> {
  const config = getAuthEmailConfig();
  if (!config.provider) throw new Error(config.error || "Account email delivery is not configured.");
  if (!config.configured) {
    if (process.env.NODE_ENV !== "production" && config.developmentEmailLog) {
      console.info(`[aruk auth email: development] ${email.subject}: ${email.url}`);
      return;
    }
    throw new Error(`Account email delivery is not configured. Missing: ${config.missing.join(", ")}.`);
  }

  const message = { ...email, from: env("EMAIL_FROM") || resendFrom };
  if (config.provider === "postmark") await sendPostmark(message);
  else await sendResend(message);
}
