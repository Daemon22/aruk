"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      setError("Password recovery needs the hosted email service. Configure Supabase for this instance.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const confirm = String(form.get("confirm") || "");
    if (password.length < 12) {
      setError("Use at least 12 characters for the new password.");
      return;
    }
    if (password !== confirm) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setComplete(true);
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
              <p role="status" className="text-sm text-emerald-300">Your password has been updated.</p>
              <Button className="w-full" onClick={() => router.replace("/")}>Return to Aruk</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="password">New password</Label><Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={256} required /></div>
              <div className="space-y-2"><Label htmlFor="confirm">Confirm password</Label><Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={256} required /></div>
              {error && <p role="alert" className="rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2 text-xs text-red-300">{error}</p>}
              <Button type="submit" disabled={busy} className="w-full">{busy ? "Saving…" : "Update password"}</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
