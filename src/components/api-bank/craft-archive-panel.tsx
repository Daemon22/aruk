"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { LockKeyhole, PackageCheck, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "archive" | "restore";

function responseFilename(header: string | null, fallback: string): string {
  let candidate = "";
  const extended = header?.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1];
  const plain = header?.match(/filename\s*=\s*"?([^";]+)"?/i)?.[1];
  try {
    candidate = extended ? decodeURIComponent(extended.trim()) : (plain || "");
  } catch {
    candidate = plain || "";
  }
  const leaf = candidate.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f\u007f]/g, "_").trim();
  return leaf || fallback;
}

async function responseError(response: Response): Promise<string> {
  const payload: unknown = await response.json().catch(() => null);
  if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
    return payload.error;
  }
  return `Craft request failed (${response.status}).`;
}

export function CraftArchivePanel() {
  const [mode, setMode] = useState<Mode>("archive");
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("craft-file") as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      setError("Choose a file first.");
      return;
    }
    if (passphrase.length < 12) {
      setError("Use a passphrase with at least 12 characters.");
      return;
    }

    const body = new FormData();
    body.set("file", file);
    body.set("passphrase", passphrase);
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const operation = mode === "archive" ? "archive" : "restore";
      const response = await fetch(`/api/craft/${operation}`, { method: "POST", body, cache: "no-store" });
      if (!response.ok) throw new Error(await responseError(response));
      if (mode === "restore" && response.headers.get("X-Craft-Integrity-Verified") !== "true") {
        throw new Error("Craft did not confirm integrity. The restored file was not downloaded.");
      }

      const fallbackName = mode === "archive"
        ? (file.name.toLowerCase().endsWith(".craft") ? file.name : `${file.name}.craft`)
        : (file.name.toLowerCase().endsWith(".craft") ? file.name.slice(0, -6) || "restored-file" : "restored-file");
      const filename = responseFilename(response.headers.get("content-disposition"), fallbackName);
      const objectUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
      setNotice(mode === "archive"
        ? `Created and downloaded ${filename}. Keep the passphrase somewhere separate from the archive.`
        : `Integrity-verified file ${filename} was downloaded.`);
      form.reset();
      setPassphrase("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to process the Craft file.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="rounded-xl border-border/40">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Image
            src="/craft-icons/compressed-encrypted.webp"
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 rounded-md object-contain"
            unoptimized
          />
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <PackageCheck className="h-4 w-4 text-brand" /> Craft archive tools
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Create or restore authenticated, compressed `.craft` files. Maximum input: 8 MiB.</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Craft archive operation">
          <Button
            type="button"
            size="sm"
            variant={mode === "archive" ? "default" : "outline"}
            className="gap-1.5 rounded-lg"
            onClick={() => { setMode("archive"); setPassphrase(""); setError(null); setNotice(null); }}
            aria-pressed={mode === "archive"}
          >
            <LockKeyhole className="h-3.5 w-3.5" /> Create archive
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "restore" ? "default" : "outline"}
            className="gap-1.5 rounded-lg"
            onClick={() => { setMode("restore"); setPassphrase(""); setError(null); setNotice(null); }}
            aria-pressed={mode === "restore"}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Restore archive
          </Button>
        </div>

        <form onSubmit={submit} className="space-y-3 rounded-lg border border-border/35 bg-muted/15 p-3">
          <div className="space-y-1.5">
            <Label htmlFor="craft-file" className="text-xs">{mode === "archive" ? "File to protect" : "Craft archive to restore"}</Label>
            <Input
              id="craft-file"
              name="craft-file"
              type="file"
              required
              accept={mode === "restore" ? ".craft,application/octet-stream" : undefined}
              className="h-auto cursor-pointer py-2 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-xs file:text-foreground"
              key={mode}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="craft-passphrase" className="text-xs">Archive passphrase</Label>
            <Input
              id="craft-passphrase"
              name="passphrase"
              type="password"
              autoComplete={mode === "archive" ? "new-password" : "current-password"}
              minLength={12}
              maxLength={1024}
              required
              value={passphrase}
              onChange={event => setPassphrase(event.target.value)}
              placeholder="At least 12 characters"
              className="h-9 rounded-lg bg-background/60 text-xs"
            />
          </div>
          <Button type="submit" size="sm" disabled={busy} className="gap-1.5 rounded-lg">
            {busy ? "Processing…" : mode === "archive" ? "Create and download .craft" : "Restore and download file"}
          </Button>
        </form>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Aruk’s server processes the selected file and passphrase in memory to create the download. This tool does not add them to Private files or save them to Aruk’s database. It is server-side processing, not zero-knowledge; use a unique passphrase and keep it separate from the archive.
        </p>
        {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
        {notice && <p role="status" className="text-xs text-emerald-300">{notice}</p>}
      </CardContent>
    </Card>
  );
}
