"use client";

import { useCallback, useEffect, useState } from "react";
import { Fingerprint, Github, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export type ArukUser = { id: string; email: string; name: string };

type Mode = "login" | "register" | "recovery" | "mfa";
type AuthConfig = {
  emailDelivery: boolean;
  developmentEmailLog: boolean;
  google: boolean;
  github: boolean;
};

const defaultAuthConfig: AuthConfig = {
  emailDelivery: false,
  developmentEmailLog: false,
  google: false,
  github: false,
};

export function AuthPanel({ onAuthenticated }: { onAuthenticated: (user: ArukUser) => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [authConfig, setAuthConfig] = useState(defaultAuthConfig);

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/config", { cache: "no-store" })
      .then((response) => response.json())
      .then((value: unknown) => {
        if (!active || !value || typeof value !== "object") return;
        const config = value as Partial<AuthConfig>;
        setAuthConfig({
          emailDelivery: config.emailDelivery === true,
          developmentEmailLog: config.developmentEmailLog === true,
          google: config.google === true,
          github: config.github === true,
        });
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const requestMfa = () => {
      setMode("mfa");
      setUseBackupCode(false);
      setError(null);
      setNotice("Enter your authenticator code or use a one-time backup code.");
    };
    window.addEventListener("aruk:two-factor-required", requestMfa);
    const authError = new URLSearchParams(window.location.search).get("auth_error");
    if (authError === "oauth") setError("Google or GitHub sign-in could not be completed.");
    return () => window.removeEventListener("aruk:two-factor-required", requestMfa);
  }, []);

  const finishSignIn = useCallback(async () => {
    const result = await authClient.getSession();
    if (result.error || !result.data?.user) {
      throw new Error("Aruk could not verify the sign-in. Please try again.");
    }
    onAuthenticated(result.data.user as ArukUser);
  }, [onAuthenticated]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const email = String(values.get("email") || "").trim().toLowerCase();
    const password = String(values.get("password") || "");

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "mfa") {
        const code = String(values.get("code") || "").replace(/\s/g, "");
        if (useBackupCode ? !code : !/^\d{6,8}$/.test(code)) throw new Error("Enter the current authenticator or backup code.");
        const result = useBackupCode
          ? await authClient.twoFactor.verifyBackupCode({ code, trustDevice: true })
          : await authClient.twoFactor.verifyTotp({ code, trustDevice: true });
        if (result.error) throw new Error(result.error.message);
        await finishSignIn();
        return;
      }

      if (mode === "recovery") {
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: window.location.origin + "/reset-password",
        });
        if (result.error) throw new Error(result.error.message);
        setNotice("If an Aruk account uses that address, recovery instructions have been sent.");
        return;
      }

      if (mode === "register") {
        if (!authConfig.emailDelivery && !authConfig.developmentEmailLog) {
          throw new Error("Account email delivery is not configured for this Aruk deployment.");
        }
        const name = String(values.get("name") || "").trim();
        if (name.length < 1 || name.length > 100) throw new Error("Enter a name between 1 and 100 characters.");
        const result = await authClient.signUp.email({
          name,
          email,
          password,
          callbackURL: window.location.origin + "/",
        });
        if (result.error) throw new Error(result.error.message);
        setNotice(authConfig.emailDelivery
          ? "Check your email to verify your address and finish creating your Aruk account."
          : "The verification link is printed in the local terminal running Aruk. Open it there to finish creating your account.");
        setMode("login");
        form.reset();
        return;
      }

      const result = await authClient.signIn.email({
        email,
        password,
        callbackURL: window.location.origin + "/",
        rememberMe: true,
      });
      if (result.error) throw new Error(result.error.message);
      const resultData = result.data as unknown;
      if (resultData && typeof resultData === "object" && "twoFactorRedirect" in resultData) {
        setMode("mfa");
        setNotice("Enter your authenticator code or use a one-time backup code.");
        return;
      }
      await finishSignIn();
      form.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to complete the account request.");
    } finally {
      setBusy(false);
    }
  };

  const oauth = async (provider: "google" | "github") => {
    setBusy(true);
    setError(null);
    try {
      const result = await authClient.signIn.social({
        provider,
        requestSignUp: mode === "register",
        errorCallbackURL: window.location.origin + "/?auth_error=oauth",
        callbackURL: window.location.origin + "/",
        newUserCallbackURL: window.location.origin + "/",
      });
      if (result.error) throw new Error(result.error.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Social sign-in could not be started.");
      setBusy(false);
    }
  };

  const passkey = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await authClient.signIn.passkey({});
      if (result.error) throw new Error(result.error.message);
      const resultData = result.data as unknown;
      if (resultData && typeof resultData === "object" && "twoFactorRedirect" in resultData) {
        setMode("mfa");
        setNotice("Enter your authenticator code or use a one-time backup code.");
        return;
      }
      await finishSignIn();
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
                <Input id="password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "register" ? 12 : undefined} maxLength={128} required />
                {mode === "register" && <p className="text-[11px] text-muted-foreground">Use at least 12 characters.</p>}
              </div>
            )}
            {mode === "mfa" && (
              <div className="space-y-2">
                <Label htmlFor="code">{useBackupCode ? "One-time backup code" : "Authenticator code"}</Label>
                <Input id="code" name="code" inputMode={useBackupCode ? "text" : "numeric"} autoComplete="one-time-code" maxLength={16} required />
                <button type="button" onClick={() => setUseBackupCode((value) => !value)} className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                  {useBackupCode ? "Use an authenticator code" : "Use a backup code"}
                </button>
              </div>
            )}
            {error && <p role="alert" className="rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2 text-xs text-red-300">{error}</p>}
            {notice && <p role="status" className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300">{notice}</p>}
            <Button type="submit" disabled={busy} className="w-full gap-2 rounded-lg">
              <ShieldCheck className="h-4 w-4" />
              {busy ? "Please wait…" : mode === "login" ? "Sign in securely" : mode === "register" ? "Create account" : mode === "recovery" ? "Send recovery email" : "Verify code"}
            </Button>
          </form>

          {(mode === "login" || mode === "register") && (
            <div className="mt-4 space-y-2 border-t border-border/30 pt-4">
              <Button type="button" variant="outline" disabled={busy || !authConfig.google} className="w-full gap-2" onClick={() => void oauth("google")}>
                <span className="font-bold text-base">G</span> {mode === "register" ? "Create account with Google" : "Continue with Google"}
              </Button>
              <Button type="button" variant="outline" disabled={busy || !authConfig.github} className="w-full gap-2" onClick={() => void oauth("github")}>
                <Github className="h-4 w-4" /> {mode === "register" ? "Create account with GitHub" : "Continue with GitHub"}
              </Button>
              {mode === "login" && (
                <Button type="button" variant="outline" disabled={busy} className="w-full gap-2" onClick={() => void passkey()}>
                  <Fingerprint className="h-4 w-4" /> Sign in with a passkey
                </Button>
              )}
              {!authConfig.google && !authConfig.github && (
                <p className="text-center text-[10px] leading-4 text-muted-foreground">
                  {mode === "register"
                    ? "New users can create an Aruk profile with Google or GitHub when OAuth credentials are configured."
                    : "Google and GitHub sign-in become available when their OAuth credentials are configured."}
                </p>
              )}
            </div>
          )}

          {mode === "login" && (
            <div className="mt-3 text-center">
              <button type="button" onClick={() => { setMode("recovery"); setError(null); setNotice(null); }} className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                <Mail className="h-3 w-3" /> Forgot your password?
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

          {mode !== "mfa" && !authConfig.emailDelivery && (
            <div className="mt-4 rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
              {authConfig.developmentEmailLog
                ? "Development verification and recovery links are written to the terminal running Aruk."
                : "Email signup and recovery require a configured mail sender."}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
