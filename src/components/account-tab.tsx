"use client";

import { useCallback, useEffect, useState } from "react";
import { Fingerprint, Github, KeyRound, Link2, LockKeyhole, ShieldCheck, Trash2, UserRound } from "lucide-react";
import type { ArukUser } from "@/components/auth-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Identity = {
  id: string;
  provider: string;
  email?: string | null;
  identity_data?: { email?: string | null; name?: string | null };
};
type Passkey = { id: string; friendly_name?: string | null; created_at?: string | null };

export function AccountTab({ user, onDeleted }: { user: ArukUser; onDeleted: () => void }) {
  const supabase = createSupabaseBrowserClient();
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [totpFactors, setTotpFactors] = useState<Array<{ id: string; friendly_name?: string; status: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingFactor, setPendingFactor] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [authenticatorCode, setAuthenticatorCode] = useState("");
  const [password, setPassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [renamingPasskey, setRenamingPasskey] = useState<string | null>(null);
  const [passkeyName, setPasskeyName] = useState("");

  const refreshSecurity = useCallback(async () => {
    if (!supabase) return;
    setError(null);
    const { data: identityData, error: identityError } = await supabase.auth.getUserIdentities();
    if (identityError) throw identityError;
    setIdentities((identityData.identities || []) as Identity[]);

    const { data: passkeyData, error: passkeyError } = await supabase.auth.passkey.list();
    if (passkeyError) {
      setPasskeys([]);
    } else {
      const raw = passkeyData as unknown;
      const keys = Array.isArray(raw) ? raw
        : raw && typeof raw === "object" && "passkeys" in raw && Array.isArray(raw.passkeys) ? raw.passkeys
        : [];
      setPasskeys(keys as Passkey[]);
    }

    const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
    if (factorError) throw factorError;
    setTotpFactors(factors.totp);
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void refreshSecurity().catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load account security.");
    });
    return () => { active = false; };
  }, [refreshSecurity, supabase]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Aruk could not complete that security change.");
    } finally {
      setBusy(false);
    }
  };

  const linkProvider = (provider: "google" | "github") => run(async () => {
    if (!supabase) return;
    const { error: linkError } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo: window.location.origin + "/auth/callback?next=/?tab=account" },
    });
    if (linkError) throw linkError;
  });

  const unlinkIdentity = (identity: Identity) => run(async () => {
    if (!supabase) return;
    if (identities.length < 2) throw new Error("Keep at least one sign-in method connected.");
    if (!window.confirm("Remove " + identity.provider + " from this Aruk account? Your other sign-in methods and stored data will remain.")) return;
    const { error: unlinkError } = await supabase.auth.unlinkIdentity(identity as never);
    if (unlinkError) throw unlinkError;
    setNotice(identity.provider + " was disconnected. Your Aruk account and data remain.");
    await refreshSecurity();
  });

  const addPasskey = () => run(async () => {
    if (!supabase) return;
    const { error: registrationError } = await supabase.auth.registerPasskey();
    if (registrationError) throw registrationError;
    setNotice("Passkey added to this Aruk account.");
    await refreshSecurity();
  });

  const renamePasskey = (id: string) => run(async () => {
    if (!supabase) return;
    const name = passkeyName.trim();
    if (!name || name.length > 120) throw new Error("Use a passkey name between 1 and 120 characters.");
    const { error: renameError } = await supabase.auth.passkey.update({ passkeyId: id, friendlyName: name });
    if (renameError) throw renameError;
    setRenamingPasskey(null);
    setPasskeyName("");
    setNotice("Passkey name updated.");
    await refreshSecurity();
  });

  const deletePasskey = (key: Passkey) => run(async () => {
    if (!supabase) return;
    if (!window.confirm("Remove this passkey from your Aruk account?")) return;
    const { error: removeError } = await supabase.auth.passkey.delete({ passkeyId: key.id });
    if (removeError) throw removeError;
    setNotice("Passkey removed.");
    await refreshSecurity();
  });

  const enrollAuthenticator = () => run(async () => {
    if (!supabase) return;
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Aruk authenticator " + (totpFactors.length + 1),
    });
    if (enrollError) throw enrollError;
    setPendingFactor(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setNotice("Scan the QR code with your authenticator app, then enter its current code.");
  });

  const verifyAuthenticator = () => run(async () => {
    if (!supabase || !pendingFactor) return;
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: pendingFactor });
    if (challengeError) throw challengeError;
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: pendingFactor,
      challengeId: challenge.id,
      code: authenticatorCode.replace(/\s/g, ""),
    });
    if (verifyError) throw verifyError;
    await supabase.auth.refreshSession();
    setPendingFactor(null);
    setQrCode(null);
    setSecret(null);
    setAuthenticatorCode("");
    setNotice("Authenticator verification is enabled for this account.");
    await refreshSecurity();
  });

  const removeAuthenticator = (factorId: string) => run(async () => {
    if (!supabase) return;
    if (!window.confirm("Turn off this authenticator factor?")) return;
    const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId });
    if (removeError) throw removeError;
    await supabase.auth.refreshSession();
    setNotice("Authenticator factor removed.");
    await refreshSecurity();
  });

  const savePassword = () => run(async () => {
    if (!supabase) return;
    if (password.length < 12) throw new Error("Use at least 12 characters for the account password.");
    const { error: passwordError } = await supabase.auth.updateUser({ password });
    if (passwordError) throw passwordError;
    setPassword("");
    setNotice("Account password updated.");
    await refreshSecurity();
  });

  const deleteAccount = () => run(async () => {
    if (deleteConfirmation !== "DELETE") throw new Error("Type DELETE to confirm permanent account removal.");
    const response = await fetch("/api/auth/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: deleteConfirmation }),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload && typeof payload.error === "string" ? payload.error : "Account deletion failed.");
    if (supabase) await supabase.auth.signOut({ scope: "local" });
    onDeleted();
  });

  const providerName = (provider: string) => provider === "github" ? "GitHub"
    : provider === "google" ? "Google"
    : provider === "email" ? "Email"
    : provider.charAt(0).toUpperCase() + provider.slice(1);

  return (
    <div className="space-y-4">
      <Card className="rounded-xl border-border/50 card-hover">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><UserRound className="h-4 w-4 text-brand" /> Aruk account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="font-medium">{user.name}</p>
          <p className="text-muted-foreground">{user.email}</p>
          <p className="pt-2 text-xs text-muted-foreground">All connected sign-in methods open this one Aruk account and its data.</p>
        </CardContent>
      </Card>

      {supabase ? (
        <>
          <Card className="rounded-xl border-border/50 card-hover">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-4 w-4 text-brand" /> Sign-in methods</CardTitle>
              <p className="text-xs text-muted-foreground">Connect Google or GitHub, then remove one method without deleting the Aruk account.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                {identities.map((identity) => (
                  <div key={identity.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/40 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{providerName(identity.provider)}</p>
                      <p className="text-xs text-muted-foreground">{identity.email || identity.identity_data?.email || "Connected identity"}</p>
                    </div>
                    <Button size="sm" variant="outline" disabled={busy || identities.length < 2} onClick={() => void unlinkIdentity(identity)}>
                      Remove method
                    </Button>
                  </div>
                ))}
                {identities.length === 0 && <p className="text-xs text-muted-foreground">No linked provider identities are available.</p>}
              </div>
              <div className="flex flex-wrap gap-2 border-t border-border/30 pt-3">
                <Button variant="outline" size="sm" disabled={busy} onClick={() => void linkProvider("google")}><span className="mr-2 font-bold">G</span>Connect Google</Button>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => void linkProvider("github")}><Github className="mr-2 h-4 w-4" />Connect GitHub</Button>
              </div>
              <p className="text-[10px] leading-4 text-muted-foreground">Removing a method leaves the other methods and all Aruk data in place. Keep at least one method connected.</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/50 card-hover">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Fingerprint className="h-4 w-4 text-brand" /> Passkeys</CardTitle>
              <p className="text-xs text-muted-foreground">Use a device biometric, PIN, or security key. Supabase passkey support is experimental and must be enabled in project settings.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void addPasskey()}><Fingerprint className="mr-2 h-4 w-4" />Add a passkey</Button>
              {passkeys.map((key) => (
                <div key={key.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/40 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{key.friendly_name || "Passkey"}</p>
                    {key.created_at && <p className="text-xs text-muted-foreground">Added {new Date(key.created_at).toLocaleDateString()}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => { setRenamingPasskey(key.id); setPasskeyName(key.friendly_name || ""); }}>Rename</Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void deletePasskey(key)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                  {renamingPasskey === key.id && (
                    <form className="flex w-full gap-2" onSubmit={(event) => { event.preventDefault(); void renamePasskey(key.id); }}>
                      <Input aria-label="New passkey name" value={passkeyName} maxLength={120} onChange={(event) => setPasskeyName(event.target.value)} />
                      <Button size="sm" type="submit" disabled={busy}>Save</Button>
                      <Button size="sm" type="button" variant="ghost" onClick={() => setRenamingPasskey(null)}>Cancel</Button>
                    </form>
                  )}
                </div>
              ))}
              {passkeys.length === 0 && <p className="text-xs text-muted-foreground">No passkeys are registered for this account.</p>}
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/50 card-hover">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-brand" /> Multi-factor authentication</CardTitle>
              <p className="text-xs text-muted-foreground">Add a TOTP authenticator app as a second sign-in step.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {totpFactors.filter((factor) => factor.status === "verified").map((factor) => (
                <div key={factor.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/40 px-3 py-2">
                  <div><p className="text-sm font-medium">{factor.friendly_name || "Authenticator app"}</p><p className="text-xs text-emerald-400">Verified</p></div>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => void removeAuthenticator(factor.id)}>Turn off</Button>
                </div>
              ))}
              {!pendingFactor && (
                <Button variant="outline" size="sm" disabled={busy} onClick={() => void enrollAuthenticator()}><ShieldCheck className="mr-2 h-4 w-4" />{totpFactors.some((factor) => factor.status === "verified") ? "Add another authenticator" : "Set up authenticator"}</Button>
              )}
              <p className="text-[10px] leading-4 text-muted-foreground">Supabase does not issue recovery codes. Add a second authenticator on another device so you have a backup.</p>
              {pendingFactor && (
                <div className="space-y-3 rounded-lg border border-border/40 p-3">
                  {qrCode && <img src={qrCode} alt="Authenticator setup QR code" className="mx-auto h-44 w-44 rounded bg-white p-2" />}
                  {secret && <p className="break-all text-center font-mono text-xs text-muted-foreground">Setup key: {secret}</p>}
                  <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); void verifyAuthenticator(); }}>
                    <Label htmlFor="authenticator-code">Current authenticator code</Label>
                    <Input id="authenticator-code" inputMode="numeric" autoComplete="one-time-code" value={authenticatorCode} onChange={(event) => setAuthenticatorCode(event.target.value)} maxLength={8} required />
                    <Button type="submit" disabled={busy} className="w-full">Verify and enable</Button>
                  </form>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="rounded-xl border-border/50">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4 text-brand" /> Local sign-in</CardTitle></CardHeader>
          <CardContent className="text-xs leading-5 text-muted-foreground">
            This instance currently uses its local account database. Google, GitHub, password recovery, passkeys, and multi-factor sign-in become available after the operator connects the hosted Supabase project and configures its auth providers.
          </CardContent>
        </Card>
      )}

      {supabase && (
        <Card className="rounded-xl border-border/50 card-hover">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><LockKeyhole className="h-4 w-4 text-brand" /> Account password</CardTitle>
            <p className="text-xs text-muted-foreground">Set or update the email-and-password sign-in for this account.</p>
          </CardHeader>
          <CardContent>
            <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); void savePassword(); }}>
              <Input type="password" autoComplete="new-password" minLength={12} maxLength={256} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="New password (12+ characters)" required className="min-w-[230px] flex-1" />
              <Button type="submit" disabled={busy}>Save password</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {(error || notice) && (
        <p role={error ? "alert" : "status"} className={error ? "rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2 text-xs text-red-300" : "rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300"}>
          {error || notice}
        </p>
      )}

      <Card className="rounded-xl border-red-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-red-300"><Trash2 className="h-4 w-4" /> Delete Aruk account</CardTitle>
          <p className="text-xs text-muted-foreground">Permanently delete this account and all data that belongs to it. Removing a linked sign-in method above does not delete this account.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="delete-confirmation">Type DELETE to continue</Label>
            <Input id="delete-confirmation" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" />
          </div>
          <Button variant="destructive" disabled={busy || deleteConfirmation !== "DELETE"} onClick={() => void deleteAccount()}>
            Permanently delete account and data
          </Button>
          {supabase && <p className="text-[10px] leading-4 text-muted-foreground">Hosted account deletion requires a recent sign-in and the server-only Supabase secret key.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
