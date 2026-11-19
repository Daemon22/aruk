"use client";

import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Fingerprint, Github, KeyRound, Link2, LockKeyhole, ShieldCheck, Trash2, UserRound } from "lucide-react";
import type { ArukUser } from "@/components/auth-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

type AuthAccount = { id: string; providerId: string; accountId: string; createdAt?: string | Date };
type Passkey = { id: string; name?: string | null; aaguid?: string | null; createdAt?: string | Date | null };
type AuthConfig = { google: boolean; github: boolean };

export function AccountTab({ user, onDeleted }: { user: ArukUser; onDeleted: () => void }) {
  const [accounts, setAccounts] = useState<AuthAccount[]>([]);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [authConfig, setAuthConfig] = useState<AuthConfig>({ google: false, github: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [passkeyName, setPasskeyName] = useState("");
  const [renamingPasskey, setRenamingPasskey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [mfaPassword, setMfaPassword] = useState("");
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [authenticatorCode, setAuthenticatorCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const refreshSecurity = useCallback(async () => {
    const [accountResult, passkeyResult, sessionResult] = await Promise.all([
      authClient.listAccounts(),
      authClient.passkey.listUserPasskeys(),
      authClient.getSession(),
    ]);
    if (accountResult.error) throw new Error(accountResult.error.message);
    if (passkeyResult.error) throw new Error(passkeyResult.error.message);
    if (sessionResult.error) throw new Error(sessionResult.error.message);
    setAccounts((accountResult.data || []) as AuthAccount[]);
    setPasskeys((passkeyResult.data || []) as Passkey[]);
    const currentUser = sessionResult.data?.user as (ArukUser & { twoFactorEnabled?: boolean }) | undefined;
    setTwoFactorEnabled(currentUser?.twoFactorEnabled === true);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([
      refreshSecurity(),
      fetch("/api/auth/config", { cache: "no-store" }).then((response) => response.json()),
    ]).then(([, rawConfig]) => {
      if (!active || !rawConfig || typeof rawConfig !== "object") return;
      const value = rawConfig as Partial<AuthConfig>;
      setAuthConfig({ google: value.google === true, github: value.github === true });
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load account security.");
    });
    return () => { active = false; };
  }, [refreshSecurity]);

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

  const providerName = (provider: string) => provider === "github" ? "GitHub"
    : provider === "google" ? "Google"
    : provider === "credential" ? "Email and password"
    : provider.charAt(0).toUpperCase() + provider.slice(1);

  const linkProvider = (provider: "google" | "github") => run(async () => {
    const result = await authClient.linkSocial({
      errorCallbackURL: window.location.origin + "/?auth_error=oauth",
      provider,
      callbackURL: window.location.origin + "/?tab=account",
    });
    if (result.error) throw new Error(result.error.message);
  });

  const unlinkAccount = (account: AuthAccount) => run(async () => {
    if (accounts.length < 2 && passkeys.length === 0) {
      throw new Error("Add another sign-in method before removing the last one.");
    }
    if (!window.confirm("Disconnect " + providerName(account.providerId) + " from this Aruk account? Your Aruk data will remain.")) return;
    const result = await authClient.unlinkAccount({ accountId: account.id });
    if (result.error) throw new Error(result.error.message);
    setNotice(providerName(account.providerId) + " was disconnected. Your Aruk account and data remain.");
    await refreshSecurity();
  });

  const addPasskey = () => run(async () => {
    const name = passkeyName.trim();
    const result = await authClient.passkey.addPasskey({ name: name || undefined });
    if (result.error) throw new Error(result.error.message);
    setPasskeyName("");
    setNotice("Passkey added to this Aruk account.");
    await refreshSecurity();
  });

  const renamePasskey = (id: string) => run(async () => {
    const name = renameValue.trim();
    if (!name || name.length > 120) throw new Error("Use a passkey name between 1 and 120 characters.");
    const result = await authClient.passkey.updatePasskey({ id, name });
    if (result.error) throw new Error(result.error.message);
    setRenamingPasskey(null);
    setRenameValue("");
    setNotice("Passkey name updated.");
    await refreshSecurity();
  });

  const deletePasskey = (key: Passkey) => run(async () => {
    if (accounts.length < 2 && passkeys.length < 2) {
      throw new Error("Add another sign-in method before removing the last one.");
    }
    if (!window.confirm("Remove this passkey from your Aruk account?")) return;
    const result = await authClient.passkey.deletePasskey({ id: key.id });
    if (result.error) throw new Error(result.error.message);
    setNotice("Passkey removed.");
    await refreshSecurity();
  });

  const enableAuthenticator = () => run(async () => {
    const result = await authClient.twoFactor.enable({
      password: mfaPassword || undefined,
      method: "totp",
      issuer: "Aruk",
    });
    if (result.error) throw new Error(result.error.message);
    const setup = result.data as { totpURI?: string; backupCodes?: string[] } | null;
    if (!setup?.totpURI) throw new Error("Aruk could not create an authenticator setup.");
    setTotpUri(setup.totpURI);
    setBackupCodes(setup.backupCodes || []);
    setAuthenticatorCode("");
    setNotice("Scan this QR code with your authenticator app, then verify its current code. Save the backup codes somewhere safe.");
  });

  const verifyAuthenticator = () => run(async () => {
    const code = authenticatorCode.replace(/\s/g, "");
    if (!/^\d{6,8}$/.test(code)) throw new Error("Enter the current 6–8 digit authenticator code.");
    const result = await authClient.twoFactor.verifyTotp({ code });
    if (result.error) throw new Error(result.error.message);
    setTotpUri(null);
    setAuthenticatorCode("");
    setNotice("Authenticator MFA is enabled for this account. Keep the backup codes in a safe place.");
    await refreshSecurity();
  });

  const disableAuthenticator = () => run(async () => {
    if (!window.confirm("Turn off authenticator MFA for this Aruk account?")) return;
    const result = await authClient.twoFactor.disable({ password: mfaPassword || undefined });
    if (result.error) throw new Error(result.error.message);
    setMfaPassword("");
    setBackupCodes([]);
    setNotice("Authenticator MFA was turned off.");
    await refreshSecurity();
  });

  const renewBackupCodes = () => run(async () => {
    const result = await authClient.twoFactor.generateBackupCodes({ password: mfaPassword || undefined });
    if (result.error) throw new Error(result.error.message);
    setBackupCodes(result.data?.backupCodes || []);
    setNotice("New backup codes are ready. Previous codes no longer work.");
  });

  const updatePassword = () => run(async () => {
    if (newPassword.length < 12 || newPassword.length > 128) {
      throw new Error("Use a password between 12 and 128 characters.");
    }

    const hasCredential = accounts.some((account) => account.providerId === "credential");
    if (hasCredential) {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) throw new Error(result.error.message);
    } else {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
        cache: "no-store",
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "Aruk could not set the password.");
      }
    }
    setCurrentPassword("");
    setNewPassword("");
    setNotice("Account password updated. Other active sessions were signed out.");
    await refreshSecurity();
  });

  const deleteAccount = () => run(async () => {
    if (deleteConfirmation !== "DELETE") throw new Error("Type DELETE to confirm permanent account removal.");
    const response = await fetch("/api/auth/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: deleteConfirmation, email: deleteEmail }),
      cache: "no-store",
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "Account deletion failed.");
    }
    onDeleted();
  });

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

      <Card className="rounded-xl border-border/50 card-hover">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-4 w-4 text-brand" /> Sign-in methods</CardTitle>
          <p className="text-xs text-muted-foreground">Connect Google or GitHub, then remove a method without deleting this Aruk account.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {accounts.map((account) => (
            <div key={account.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/40 px-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                {account.providerId === "github" ? <Github className="h-4 w-4" /> : <KeyRound className="h-4 w-4 text-brand" />}
                <span>{providerName(account.providerId)}</span>
              </div>
              <Button size="sm" variant="outline" disabled={busy || (accounts.length < 2 && passkeys.length === 0)} onClick={() => void unlinkAccount(account)}>
                Disconnect
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy || !authConfig.google} onClick={() => void linkProvider("google")}>Connect Google</Button>
            <Button size="sm" variant="outline" disabled={busy || !authConfig.github} onClick={() => void linkProvider("github")}>Connect GitHub</Button>
          </div>
          {!authConfig.google || !authConfig.github ? (
            <p className="text-[10px] leading-4 text-muted-foreground">Provider linking is enabled when that provider’s OAuth credentials are configured.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/50 card-hover">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Fingerprint className="h-4 w-4 text-brand" /> Passkeys</CardTitle>
          <p className="text-xs text-muted-foreground">Sign in with a device biometric, PIN, or security key.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); void addPasskey(); }}>
            <Input aria-label="Passkey name" placeholder="Passkey name (optional)" value={passkeyName} maxLength={120} onChange={(event) => setPasskeyName(event.target.value)} />
            <Button type="submit" variant="outline" disabled={busy}><Fingerprint className="mr-2 h-4 w-4" />Add a passkey</Button>
          </form>
          {passkeys.map((key) => (
            <div key={key.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/40 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{key.name || "Passkey"}</p>
                {key.createdAt && <p className="text-xs text-muted-foreground">Added {new Date(key.createdAt).toLocaleDateString()}</p>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => { setRenamingPasskey(key.id); setRenameValue(key.name || ""); }}>Rename</Button>
                <Button size="sm" variant="outline" disabled={busy || (accounts.length < 2 && passkeys.length < 2)} onClick={() => void deletePasskey(key)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
              {renamingPasskey === key.id && (
                <form className="flex w-full gap-2" onSubmit={(event) => { event.preventDefault(); void renamePasskey(key.id); }}>
                  <Input aria-label="New passkey name" value={renameValue} maxLength={120} onChange={(event) => setRenameValue(event.target.value)} />
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
          <p className="text-xs text-muted-foreground">Use an authenticator app and one-time backup codes to protect sign-ins.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {twoFactorEnabled ? (
            <>
              <p className="text-sm text-emerald-400">Authenticator MFA is enabled.</p>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void renewBackupCodes()}>Generate new backup codes</Button>
              <div className="space-y-2">
                <Label htmlFor="mfa-password">Password, if this account has one</Label>
                <Input id="mfa-password" type="password" autoComplete="current-password" value={mfaPassword} onChange={(event) => setMfaPassword(event.target.value)} />
                <Button variant="outline" size="sm" disabled={busy} onClick={() => void disableAuthenticator()}>Turn off authenticator MFA</Button>
              </div>
            </>
          ) : !totpUri ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="mfa-enable-password">Current password, if this account has one</Label>
                <Input id="mfa-enable-password" type="password" autoComplete="current-password" value={mfaPassword} onChange={(event) => setMfaPassword(event.target.value)} />
              </div>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void enableAuthenticator()}><ShieldCheck className="mr-2 h-4 w-4" />Set up authenticator</Button>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border border-border/40 p-3">
              <p className="text-xs leading-5 text-muted-foreground">Scan the QR code, enter its current code, and save the backup codes before finishing.</p>
              <div className="mx-auto w-fit rounded bg-white p-3"><QRCodeSVG value={totpUri} size={196} level="M" /></div>
              {backupCodes.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium">One-time backup codes</p>
                  <div className="grid grid-cols-2 gap-2 rounded bg-muted/30 p-3 font-mono text-xs">{backupCodes.map((code) => <span key={code}>{code}</span>)}</div>
                  <p className="text-[10px] leading-4 text-muted-foreground">Each code works once. Store them somewhere safe; Aruk will not show this set again.</p>
                </div>
              )}
              <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); void verifyAuthenticator(); }}>
                <Label htmlFor="authenticator-code">Current authenticator code</Label>
                <Input id="authenticator-code" inputMode="numeric" autoComplete="one-time-code" value={authenticatorCode} onChange={(event) => setAuthenticatorCode(event.target.value)} maxLength={8} required />
                <Button type="submit" disabled={busy} className="w-full">Verify and enable MFA</Button>
              </form>
              <button type="button" className="text-xs text-muted-foreground underline" onClick={() => { setTotpUri(null); setBackupCodes([]); }}>Cancel setup</button>
            </div>
          )}
          {backupCodes.length > 0 && !totpUri && (
            <div className="space-y-2 rounded-lg border border-amber-400/25 bg-amber-400/5 p-3">
              <p className="text-xs font-medium">New backup codes</p>
              <div className="grid grid-cols-2 gap-2 font-mono text-xs">{backupCodes.map((code) => <span key={code}>{code}</span>)}</div>
              <p className="text-[10px] text-muted-foreground">Previous backup codes no longer work. Save this set now.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/50 card-hover">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><LockKeyhole className="h-4 w-4 text-brand" /> Account password</CardTitle>
          <p className="text-xs text-muted-foreground">Use a unique password of at least 12 characters.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {accounts.some((account) => account.providerId === "credential") && (
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="new-password">{accounts.some((account) => account.providerId === "credential") ? "New password" : "Set an Aruk password"}</Label>
            <Input id="new-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </div>
          <Button variant="outline" size="sm" disabled={busy || newPassword.length < 12 || (accounts.some((account) => account.providerId === "credential") && !currentPassword)} onClick={() => void updatePassword()}>
            Save password
          </Button>
        </CardContent>
      </Card>

      {error && <p role="alert" className="rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2 text-xs text-red-300">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300">{notice}</p>}

      <Card className="rounded-xl border-red-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-red-300"><Trash2 className="h-4 w-4" /> Delete account</CardTitle>
          <p className="text-xs text-muted-foreground">Permanently delete this Aruk account, its sign-in methods, and its stored Aruk data. This cannot be undone.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="delete-email">Confirm account email</Label>
            <Input id="delete-email" type="email" autoComplete="email" value={deleteEmail} onChange={(event) => setDeleteEmail(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="delete-confirmation">Type DELETE to confirm</Label>
            <Input id="delete-confirmation" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} />
          </div>
          <p className="text-[10px] leading-4 text-muted-foreground">For your protection, sign in again if your current session is more than 10 minutes old.</p>
          <Button variant="destructive" size="sm" disabled={busy || deleteConfirmation !== "DELETE" || deleteEmail.trim().toLowerCase() !== user.email.toLowerCase()} onClick={() => void deleteAccount()}>
            Delete Aruk account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
