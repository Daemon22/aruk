"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, Github, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type ArukUser = { id: string; email: string; name: string };

type Mode = "login" | "register" | "recovery" | "mfa";

export function AuthPanel({ onAuthenticated }: { onAuthenticated: (user: ArukUser) => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [mfaFactors, setMfaFactors] = useState<Array<{ id: string; friendly_name?: string | null }>>([]);
  const [supabase] = useState(() => createSupabaseBrowserClient());

  const continueSupabaseSession = useCallback(async () => {
    if (!supabase) return;
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return;

    const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError) throw assuranceError;
    if (assurance.nextLevel === "aal2" && assurance.currentLevel !== "aal2") {
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      const verifiedFactors = factors.totp.filter((item) => item.status === "verified");
      const factor = verifiedFactors[0];
      if (!factor) throw new Error("Your second factor is not available. Contact the Aruk administrator.");
      setMfaFactors(verifiedFactors.map((item) => ({ id: item.id, friendly_name: item.friendly_name })));
      setFactorId(factor.id);
      setMode("mfa");
      setNotice("Enter the current code from your authenticator app.");
      return;
    }

    const response = await fetch("/api/auth/session", { cache: "no-store" });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok || !payload || typeof payload !== "object" || !("user" in payload)) {
      throw new Error("Aruk could not verify your session. Please sign in again.");
    }
    onAuthenticated((payload as { user: ArukUser }).user);
  }, [onAuthenticated, supabase]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getUser().then(async ({ data, error: authError }) => {
      if (!active || authError || !data.user) return;
      try {
        await continueSupabaseSession();
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to verify your session.");
      }
    });
    const authError = new URLSearchParams(window.location.search).get("auth_error");
    if (authError === "oauth") setError("The identity provider sign-in could not be completed.");
    return () => { active = false; };
  }, [continueSupabaseSession, supabase]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "mfa") {
        if (!supabase || !factorId) throw new Error("The authenticator challenge is unavailable.");
        const code = String(values.get("code") || "").replace(/\s/g, "");
        if (!/^\d{6,8}$/.test(code)) throw new Error("Enter the current 6–8 digit authenticator code.");
        const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
        if (challengeError) throw challengeError;
        const { error: verifyError } = await supabase.auth.mfa.verify({
          factorId,
          challengeId: challenge.id,
          code,
        });
        if (verifyError) throw verifyError;
        await continueSupabaseSession();
        return;
      }

      const email = String(values.get("email") || "").trim().toLowerCase();
      if (mode === "recovery") {
        if (!supabase) throw new Error("Password recovery needs the hosted email service. Configure Supabase for this instance.");
        const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/auth/callback?next=/reset-password",
        });
        if (recoveryError) throw recoveryError;
        setNotice("If an account uses that address, password recovery instructions have been sent.");
        return;
      }

      if (supabase) {
        const password = String(values.get("password") || "");
        if (mode === "register") {
          const name = String(values.get("name") || "").trim();
          const { data, error: registerError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { name },
              emailRedirectTo: window.location.origin + "/auth/callback?next=/",
            },
          });
          if (registerError) throw registerError;
          if (!data.session) {
            setNotice("Check your email to verify the address and finish creating your Aruk account.");
            return;
          }
        } else {
          const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
          if (signInError) throw signInError;
        }
        await continueSupabaseSession();
        return;
      }

      const response = await fetch("/api/auth/" + (mode === "register" ? "register" : "login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: values.get("password"),
          ...(mode === "register" ? { name: values.get("name") } : {}),
        }),
        cache: "no-store",
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "Aruk could not complete this request.";
        throw new Error(message);
      }
      if (!payload || typeof payload !== "object" || !("user" in payload)) throw new Error("Aruk returned an invalid sign-in response.");
      onAuthenticated((payload as { user: ArukUser }).user);
      form.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to complete the account request.");
    } finally {
      setBusy(false);
    }
  };

  const oauth = async (provider: "google" | "github") => {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + "/auth/callback?next=/" },
    });
    if (oauthError) {
      setError(oauthError.message);
      setBusy(false);
    }
  };

  const passkey = async () => {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    try {
      const { error: passkeyError } = await supabase.auth.signInWithPasskey();
      if (passkeyError) throw passkeyError;
      await continueSupabaseSession();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Passkey sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  const title = mode === "register" ? "Create an Aruk account"
    : mode === "recovery" ? "Recover your account"
    : mode === "mfa" ? "Verify your identity"
    : "Enter Aruk";

  return (
    <main className="grid min-h-[calc(100vh-120px)] place-items-center px-4 py-10">
      <Card className="w-full max-w-md rounded-2xl border-border/50 bg-background/90 shadow-2xl">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl border border-amber-200/25 bg-amber-200/5 text-amber-200"><LockKeyhole className="h-5 w-5" /></div>
          <CardTitle className="font-serif text-2xl">{title}</CardTitle>
          <p className="text-xs leading-5 text-muted-foreground">
            Your account scopes your keys, files, permissions, and audit history.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && <div className="space-y-2"><Label htmlFor="name">Name</Label><Input id="name" name="name" autoComplete="name" maxLength={100} required /></div>}
            {(mode === "login" || mode === "register" || mode === "recovery") && (
              <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" autoComplete="email" maxLength={254} required /></div>
            )}
            {(mode === "login" || mode === "register") && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "register" ? 12 : undefined} maxLength={256} required />
                {mode === "register" && <p className="text-[11px] text-muted-foreground">Use at least 12 characters.</p>}
              </div>
            )}
            {mode === "mfa" && (
              <div className="space-y-2">
                {mfaFactors.length > 1 && <div className="space-y-2"><Label htmlFor="mfa-factor">Authenticator</Label><select id="mfa-factor" value={factorId || ""} onChange={(event) => setFactorId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{mfaFactors.map((factor) => <option key={factor.id} value={factor.id}>{factor.friendly_name || "Authenticator app"}</option>)}</select></div>}
                <Label htmlFor="code">Authenticator code</Label><Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} required />
                {mfaFactors.length > 1 && <p className="text-[10px] text-muted-foreground">Choose another registered authenticator if your first device is unavailable.</p>}
              </div>
            )}
            {error && <p role="alert" className="rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2 text-xs text-red-300">{error}</p>}
            {notice && <p role="status" className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300">{notice}</p>}
            <Button type="submit" disabled={busy} className="w-full gap-2 rounded-lg">
              <ShieldCheck className="h-4 w-4" />
              {busy ? "Please wait…" : mode === "login" ? "Sign in securely" : mode === "register" ? "Create account" : mode === "recovery" ? "Send recovery email" : "Verify code"}
            </Button>
          </form>

          {supabase && (mode === "login" || mode === "register") && (
            <div className="mt-4 space-y-2 border-t border-border/30 pt-4">
              <Button type="button" variant="outline" disabled={busy} className="w-full gap-2" onClick={() => void oauth("google")}>
                <span className="font-bold text-base">G</span> Continue with Google
              </Button>
              <Button type="button" variant="outline" disabled={busy} className="w-full gap-2" onClick={() => void oauth("github")}>
                <Github className="h-4 w-4" /> Continue with GitHub
              </Button>
              {mode === "login" && (
                <Button type="button" variant="outline" disabled={busy} className="w-full gap-2" onClick={() => void passkey()}>
                  <Fingerprint className="h-4 w-4" /> Sign in with a passkey
                </Button>
              )}
              <p className="text-center text-[10px] leading-4 text-muted-foreground">Passkeys use experimental Supabase support and must be enabled in the project’s Auth settings.</p>
            </div>
          )}

          {supabase && mode === "login" && (
            <div className="mt-3 text-center">
              <button type="button" onClick={() => { setMode("recovery"); setError(null); setNotice(null); }} className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                Forgot your password?
              </button>
            </div>
          )}

          {mode !== "mfa" && (
            <div className="mt-4 border-t border-border/30 pt-4 text-center">
              <button type="button" onClick={() => { setError(null); setNotice(null); setMode(mode === "login" ? "register" : "login"); }} className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                {mode === "login" ? "Need an account? Create one" : mode === "register" ? "Already have an account? Sign in" : "Back to sign in"}
              </button>
            </div>
          )}
          {!supabase && (
            <div className="mt-4 rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
              Email sign-in uses this instance’s local database. Connect Supabase to enable Google, GitHub, passkeys, verified email recovery, and multi-factor authentication.
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
