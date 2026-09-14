"use client";

import { FormEvent, useState } from "react";
import { KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SessionStatus } from "@/lib/ui-contracts";

interface AuthScreenProps {
  onAuthenticated: (session: SessionStatus) => void;
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<"sign_in" | "register">("sign_in");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "requesting" | "failure">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("requesting");
    setError(null);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode, email, name, password }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : `Request failed (${response.status})`);
      }
      onAuthenticated({ authenticated: true, user: payload.user });
    } catch (requestError) {
      setState("failure");
      setError(requestError instanceof Error ? requestError.message : "Authentication failed");
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto flex min-h-[70vh] max-w-md items-center">
        <Card className="w-full rounded-2xl border-border/50">
          <CardHeader className="space-y-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 overflow-hidden rounded-xl ring-1 ring-brand/30">
                <img src="/logo.png" alt="Aruk" className="h-full w-full object-cover" />
              </div>
              <div>
                <CardTitle className="text-lg">Enter Aruk</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">The Keeper of Secrets and Keys</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Your identity is established by Aruk&apos;s server-side authentication boundary.
              Protected state remains unavailable until the core confirms your session.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              {mode === "register" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" autoComplete={mode === "sign_in" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
              </div>

              {error && (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2.5 text-xs text-red-300">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" className="w-full gap-2" disabled={state === "requesting"}>
                {state === "requesting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                {mode === "sign_in" ? "Sign in" : "Create account"}
              </Button>
            </form>

            <div className="mt-5 border-t border-border/40 pt-4 text-center text-xs text-muted-foreground">
              {mode === "sign_in" ? "New to this Aruk instance?" : "Already have an Aruk account?"}{" "}
              <button
                type="button"
                className="font-medium text-brand hover:underline"
                onClick={() => {
                  setMode(mode === "sign_in" ? "register" : "sign_in");
                  setError(null);
                  setState("idle");
                }}
              >
                {mode === "sign_in" ? "Create an account" : "Sign in"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
