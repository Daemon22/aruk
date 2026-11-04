"use client";

import { useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ArukUser = { id: string; email: string; name: string };

export function AuthPanel({ onAuthenticated }: { onAuthenticated: (user: ArukUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/" + mode, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.get("email"),
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
      onAuthenticated(payload.user as ArukUser);
      form.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-[calc(100vh-120px)] place-items-center px-4 py-10">
      <Card className="w-full max-w-md rounded-2xl border-border/50 bg-background/90 shadow-2xl">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl border border-amber-200/25 bg-amber-200/5 text-amber-200"><LockKeyhole className="h-5 w-5" /></div>
          <CardTitle className="font-serif text-2xl">{mode === "login" ? "Enter Aruk" : "Create an Aruk account"}</CardTitle>
          <p className="text-xs leading-5 text-muted-foreground">
            Your account scopes your keys, files, permissions, and audit history.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && <div className="space-y-2"><Label htmlFor="name">Name</Label><Input id="name" name="name" autoComplete="name" maxLength={100} required /></div>}
            <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" autoComplete="email" maxLength={254} required /></div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "register" ? 12 : undefined} maxLength={256} required />
              {mode === "register" && <p className="text-[11px] text-muted-foreground">Use at least 12 characters.</p>}
            </div>
            {mode === "register" && <p className="text-[11px] leading-5 text-muted-foreground">Account creation may be disabled by the Aruk operator. Public sign-up stays off unless the instance operator enables it.</p>}
            {error && <p role="alert" className="rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2 text-xs text-red-300">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full gap-2 rounded-lg">
              <ShieldCheck className="h-4 w-4" /> {busy ? "Please wait…" : mode === "login" ? "Sign in securely" : "Create account"}
            </Button>
          </form>
          <div className="mt-4 border-t border-border/30 pt-4 text-center">
            <button type="button" onClick={() => { setError(null); setMode(mode === "login" ? "register" : "login"); }} className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              {mode === "login" ? "Need an account? Create one" : "Already have an account? Sign in"}
            </button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
