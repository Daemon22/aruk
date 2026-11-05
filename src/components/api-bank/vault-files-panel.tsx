"use client";

import { useCallback, useEffect, useState } from "react";
import { Archive, Download, File, Lock, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type VaultFile = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  encrypted: boolean;
  compressed: boolean;
  sha256: string;
  createdAt: string;
};

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return (bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1) + " " + units[index];
}

function errorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") return payload.error;
  return "Aruk request failed (" + status + ").";
}

export function VaultFilesPanel({ refreshKey }: { refreshKey: number }) {
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [encrypt, setEncrypt] = useState(true);
  const [compress, setCompress] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/files", { cache: "no-store" });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorMessage(payload, response.status));
      const data = payload && typeof payload === "object" && "data" in payload ? payload.data : null;
      if (!Array.isArray(data)) throw new Error("Aruk returned an invalid file list.");
      setFiles(data as VaultFile[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load vault files.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const upload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("file") as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      setError("Choose a file first.");
      return;
    }
    const body = new FormData();
    body.set("file", file);
    body.set("encrypt", String(encrypt));
    body.set("compress", String(compress));
    setUploading(true);
    setError(null);
    try {
      const response = await fetch("/api/files", { method: "POST", body });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorMessage(payload, response.status));
      form.reset();
      setEncrypt(true);
      setCompress(false);
      toast({ title: "File safely stored in Aruk" });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to store file.");
    } finally {
      setUploading(false);
    }
  };

  const download = async (file: VaultFile) => {
    try {
      const response = await fetch("/api/files?id=" + encodeURIComponent(file.id), { cache: "no-store" });
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        throw new Error(errorMessage(payload, response.status));
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.name;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to download file.");
    }
  };

  const remove = async (file: VaultFile) => {
    if (!window.confirm("Permanently delete " + file.name + " from this Aruk account?")) return;
    try {
      const response = await fetch("/api/files?id=" + encodeURIComponent(file.id), { method: "DELETE" });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorMessage(payload, response.status));
      toast({ title: "File deleted" });
      setFiles(current => current.filter(item => item.id !== file.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete file.");
    }
  };

  return (
    <Card className="rounded-xl border-border/40">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm"><File className="h-4 w-4 text-brand" /> Private files</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">File contents are stored in Aruk’s database. Encryption is on by default and gzip compression is optional. Names and file details remain visible.</p>
          </div>
          <Badge variant="outline" className="text-[10px]">8 MB per file</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={upload} className="space-y-3 rounded-lg border border-border/35 bg-muted/15 p-3">
          <input name="file" type="file" required className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-xs file:text-foreground" />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={encrypt} onChange={event => setEncrypt(event.target.checked)} />
              <Lock className="h-3.5 w-3.5 text-emerald-400" /> Encrypt before storing
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={compress} onChange={event => setCompress(event.target.checked)} />
              <Archive className="h-3.5 w-3.5 text-blue-400" /> Compress before storing
            </label>
            <Button type="submit" size="sm" disabled={uploading} className="ml-auto gap-1.5 rounded-lg">
              <Upload className="h-3.5 w-3.5" /> {uploading ? "Storing…" : "Store file"}
            </Button>
          </div>
          {!encrypt && <p className="text-[11px] text-amber-300">This file will be stored without encryption. Use this only when you have a reason to do so.</p>}
        </form>

        {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
        {loading ? <p className="text-xs text-muted-foreground">Loading stored files…</p> : files.length === 0 ? (
          <p className="py-5 text-center text-xs text-muted-foreground">No files stored yet. Add a file above to keep it in your Aruk vault.</p>
        ) : (
          <ul className="divide-y divide-border/30">
            {files.map(file => (
              <li key={file.id} className="flex flex-wrap items-center gap-3 py-3">
                <File className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{file.name}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{formatBytes(file.sizeBytes)} · {new Date(file.createdAt).toLocaleString()}</p>
                </div>
                {file.encrypted && <Badge variant="outline" className="text-[9px] text-emerald-300"><Lock className="mr-1 h-2.5 w-2.5" />Encrypted</Badge>}
                {file.compressed && <Badge variant="outline" className="text-[9px] text-blue-300"><Archive className="mr-1 h-2.5 w-2.5" />Compressed</Badge>}
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => void download(file)} aria-label={"Download " + file.name}><Download className="h-3.5 w-3.5" /></Button>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={() => void remove(file)} aria-label={"Delete " + file.name}><Trash2 className="h-3.5 w-3.5" /></Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
