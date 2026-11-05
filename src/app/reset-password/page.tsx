"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token"));
  }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const confirm = String(form.get("confirm") || "");
    if (!token) {
      setError("This password reset link is missing or expired. Request a new one from the sign-in screen.");
      return;
    }
    if (password.length < 12 || password.length > 128) {
      setError("Use a password between 12 and 128 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) throw new Error(result.error.message);
      setComplete(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Aruk could not update the password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <Card className="w-full max-w-md rounded-2xl border-border/50 bg-background/90 shadow-2xl">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl border border-amber-200/25 bg-amber-200/5 text-amber-200"><LockKeyhole className="h-5 w-5" /></div>
          <CardTitle className="font-serif text-2xl">Set a new password</CardTitle>
          <p className="text-xs leading-5 text-muted-foreground">Choose a new password for your Aruk account.</p>
        </CardHeader>
        <CardContent>
          {complete ? (
            <div className="space-y-4 text-center">
              <p role="status" className="text-sm text-emerald-400">Your password has been changed. Sign in with the new password.</p>
              <Button className="w-full" onClick={() => router.push("/")}>Return to Aruk</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="password">New password</Label><Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></div>
              <div className="space-y-2"><Label htmlFor="confirm">Confirm password</Label><Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></div>
              {error && <p role="alert" className="rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2 text-xs text-red-300">{error}</p>}
              <Button type="submit" disabled={busy || token === null} className="w-full">{busy ? "Please wait…" : "Update password"}</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
