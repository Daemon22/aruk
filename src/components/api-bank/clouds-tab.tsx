"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Cloud, Plus, Unplug } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CloudAccount {
  id: string;
  name: string;
  provider: string;
  projectId: string | null;
  bucketName: string;
  region: string | null;
  credentialsMasked: string | null;
  status: string;
  storageUsedBytes: number;
  storageQuotaBytes: number | null;
  offloadCount: number;
  notes: string | null;
  connectedAt: string;
  lastCheckedAt: string | null;
}

const PROVIDER_ICONS: Record<string, string> = {
  google_cloud: 'G',
  aws_s3: 'S3',
  azure_blob: 'AZ',
  dropbox: 'DB',
};

const PROVIDER_COLORS: Record<string, string> = {
  google_cloud: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  aws_s3: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  azure_blob: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  dropbox: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
};

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  disconnected: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  error: 'bg-red-500/10 text-red-400 border-red-500/20',
  revoked: 'bg-muted/50 text-muted-foreground border-border/50',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function CloudsTab({ refreshKey }: { refreshKey: number }) {
  const [accounts, setAccounts] = useState<CloudAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [credentialsJson, setCredentialsJson] = useState('');
  const [credError, setCredError] = useState('');
  const { toast } = useToast();

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cloud-accounts');
      const json = await res.json();
      setAccounts(json.data || []);
    } catch {
      toast({ title: "Failed to load cloud accounts", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAccounts(); }, [refreshKey, fetchAccounts]);

  const handleConnect = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    let creds: Record<string, any>;
    try {
      creds = JSON.parse(credentialsJson);
    } catch {
      setCredError('Invalid JSON');
      return;
    }
    setCredError('');

    const provider = fd.get('provider') as string;
    const masked = creds.client_email || creds.accessKeyId || creds.accountName || null;

    try {
      await fetch('/api/cloud-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fd.get('name'),
          provider,
          projectId: fd.get('projectId') || undefined,
          bucketName: fd.get('bucketName'),
          region: fd.get('region') || undefined,
          credentials: creds,
          credentialsMasked: masked,
          notes: fd.get('notes') || undefined,
        }),
      });

      setOpen(false);
      setCredentialsJson('');
      fetchAccounts();
    } catch {
      toast({ title: "Failed to connect cloud account", variant: "destructive" });
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      await fetch(`/api/cloud-accounts?id=${id}`, { method: 'DELETE' });
      setAccounts(accounts.map(a => a.id === id ? { ...a, status: 'revoked' } : a));
    } catch {
      toast({ title: "Failed to disconnect cloud account", variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Cloud className="h-4 w-4 text-brand" /> Cloud Accounts
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Connect your cloud storage backends. Agents offload data here when local storage is constrained.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 text-xs rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground"><Plus className="h-3 w-3" /> Connect Cloud</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Connect Cloud Storage</DialogTitle></DialogHeader>
            <form onSubmit={handleConnect} className="space-y-3">
              <div>
                <Label className="text-xs">Account Name</Label>
                <Input name="name" required placeholder='e.g. "My GCS Production"' className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Provider</Label>
                <Select name="provider" defaultValue="google_cloud">
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google_cloud">Google Cloud Storage</SelectItem>
                    <SelectItem value="aws_s3">AWS S3</SelectItem>
                    <SelectItem value="azure_blob">Azure Blob Storage</SelectItem>
                    <SelectItem value="dropbox">Dropbox</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Project ID (GCP)</Label>
                  <Input name="projectId" placeholder="my-project-123" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Region</Label>
                  <Input name="region" placeholder="us-central1" className="mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Bucket / Container Name</Label>
                <Input name="bucketName" required placeholder="my-aruk-vault" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Credentials (JSON)</Label>
                <p className="text-[10px] text-muted-foreground mt-0.5 mb-1">
                  Paste your service account key JSON, access keys, or OAuth credentials.
                  Aruk encrypts these at rest and never exposes them.
                </p>
                <textarea
                  value={credentialsJson}
                  onChange={(e) => { setCredentialsJson(e.target.value); setCredError(''); }}
                  placeholder='{"client_email": "...", "private_key": "..."}'
                  className="w-full mt-1 min-h-[100px] rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-brand/50 resize-y"
                />
                {credError && <p className="text-[10px] text-red-400 mt-1">{credError}</p>}
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <Input name="notes" placeholder="Optional notes..." className="mt-1" />
              </div>
              <Button type="submit" className="w-full rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground">Connect</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {accounts.length === 0 ? (
        <Card className="rounded-xl border-dashed border-border/60">
          <CardContent className="py-16 text-center">
            <Cloud className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No cloud accounts connected.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Connect a Google Cloud, AWS, Azure, or Dropbox account to let agents offload data.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2 stagger-children">
          {accounts.map(a => (
              <Card key={a.id} className={`rounded-xl border-border/50 overflow-hidden card-hover ${a.status !== 'active' ? 'opacity-60' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg border flex items-center justify-center text-xs font-bold ${PROVIDER_COLORS[a.provider] || 'bg-muted text-muted-foreground border-border'}`}>
                        {PROVIDER_ICONS[a.provider] || '?'}
                      </div>
                      <div>
                        <div className="font-medium text-sm flex items-center gap-2">
                          {a.name}
                          <Badge variant="outline" className={`text-[9px] border ${PROVIDER_COLORS[a.provider] || ''}`}>{a.provider.replace('_', ' ')}</Badge>
                          <Badge variant="outline" className={`text-[10px] border ${STATUS_STYLE[a.status] || ''}`}>{a.status}</Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {a.bucketName}{a.region ? ` / ${a.region}` : ''}
                          {a.projectId ? ` / ${a.projectId}` : ''}
                          <span className="ml-2">Connected {timeAgo(a.connectedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {a.credentialsMasked && (
                    <div className="text-[10px] text-muted-foreground mb-3 bg-muted/20 rounded-md px-2.5 py-1.5 font-mono truncate">
                      {a.credentialsMasked}
                    </div>
                  )}

                  {a.notes && (
                    <p className="text-[10px] text-muted-foreground/70 mb-3 italic">{a.notes}</p>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground/50">
                      {a.lastCheckedAt ? `Last checked ${timeAgo(a.lastCheckedAt)}` : 'Not yet checked'}
                    </span>
                    {a.status === 'active' && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => handleDisconnect(a.id)}>
                        <Unplug className="h-3 w-3 mr-1" /> Disconnect
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
