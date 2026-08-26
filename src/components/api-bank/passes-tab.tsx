"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Ticket, Plus, Ban, Clock, Copy, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Pass {
  id: string; token: string; daemonName: string | null;
  requesterName: string; policyName: string | null;
  resourceType: string; resourceId: string | null;
  scope: string; maxUses: number | null; usedCount: number;
  issuedAt: string; expiresAt: string; lastUsedAt: string | null;
  status: string; reason: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  revoked: 'bg-red-500/10 text-red-400 border-red-500/20',
  expired: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  consumed: 'bg-muted/50 text-muted-foreground border-border/50',
};

export function PassesTab({ refreshKey }: { refreshKey: number }) {
  const [passes, setPasses] = useState<Pass[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    fetch('/api/passes')
      .then(r => r.json())
      .then(data => { if (!cancelled) { setPasses(data); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  const issuePass = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await fetch('/api/passes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterName: fd.get('requesterName'),
          resourceType: fd.get('resourceType'),
          resourceId: fd.get('resourceId') || undefined,
          scope: fd.get('scope') || 'read',
          maxUses: fd.get('maxUses') ? parseInt(fd.get('maxUses') as string) : undefined,
          ttlMinutes: parseInt(fd.get('ttlMinutes') as string) || 60,
          reason: fd.get('reason') || undefined,
        }),
      });
      setOpen(false);
      const data = await fetch('/api/passes').then(r => r.json());
      setPasses(data);
    } catch (err) {
      toast({ title: 'Failed to issue pass', description: String(err), variant: 'destructive' });
    }
  };

  const revokePass = async (id: string) => {
    try {
      await fetch(`/api/passes?id=${id}`, { method: 'DELETE' });
      setPasses(passes.map(p => p.id === id ? { ...p, status: 'revoked' as const } : p));
    } catch (err) {
      toast({ title: 'Failed to revoke pass', description: String(err), variant: 'destructive' });
    }
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();
  const timeLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    return hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
  };

  if (loading) return <div className="space-y-3">{Array.from({length: 3}).map((_,i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Ticket className="h-4 w-4 text-brand" /> Access Passes
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Temporary, scoped, revocable permission tokens. No raw credentials exposed.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-1.5 text-xs rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground"><Plus className="h-3 w-3" /> Issue Pass</Button></DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Issue Access Pass</DialogTitle></DialogHeader>
            <form onSubmit={issuePass} className="space-y-3">
              <div><Label className="text-xs">Requester Name</Label><Input name="requesterName" required placeholder="Who is requesting access?" className="mt-1" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Resource Type</Label>
                  <Select name="resourceType" defaultValue="api_account">
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="api_account">API Account</SelectItem>
                      <SelectItem value="secret">Secret</SelectItem>
                      <SelectItem value="daemon">Daemon</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                      <SelectItem value="passage_out">Passage Out</SelectItem>
                      <SelectItem value="passage_in">Passage In</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Scope</Label>
                  <Select name="scope" defaultValue="read">
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="read">Read</SelectItem>
                      <SelectItem value="write">Write</SelectItem>
                      <SelectItem value="execute">Execute</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Max Uses (empty = unlimited)</Label><Input name="maxUses" type="number" placeholder="e.g. 10" className="mt-1" /></div>
                <div><Label className="text-xs">TTL (minutes)</Label><Input name="ttlMinutes" type="number" defaultValue="60" className="mt-1" /></div>
              </div>
              <div><Label className="text-xs">Reason</Label><Input name="reason" placeholder="Why is this pass needed?" className="mt-1" /></div>
              <Button type="submit" className="w-full rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground">Issue Pass</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {passes.length === 0 ? (
        <Card className="rounded-xl border-dashed border-border/60">
          <CardContent className="py-16 text-center">
            <Ticket className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No access passes issued.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Aruk issues passes instead of exposing raw credentials.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2 stagger-children">
          {passes.map(p => (
            <Card key={p.id} className={`rounded-xl border-border/50 overflow-hidden card-hover ${p.status !== 'active' ? 'opacity-60' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center">
                      <Ticket className="h-3.5 w-3.5 text-brand" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{p.daemonName || p.requesterName}</div>
                      <div className="text-[11px] text-muted-foreground">{p.resourceType}{p.resourceId ? ':' + p.resourceId : ''} / {p.scope}</div>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] border ${STATUS_STYLE[p.status] || ''}`}>{p.status}</Badge>
                </div>
                <div className="flex items-center gap-1 mb-3 bg-muted/30 rounded-lg p-2 font-mono text-[10px] text-muted-foreground overflow-hidden">
                  <code className="truncate flex-1">{p.token}</code>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={() => copyToken(p.token)}>
                    {copied === p.token ? <CheckCircle className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeLeft(p.expiresAt)}</span>
                    {p.maxUses && <span>Uses: {p.usedCount}/{p.maxUses}</span>}
                    {p.policyName && <span>Policy: {p.policyName}</span>}
                  </div>
                  {p.status === 'active' && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => revokePass(p.id)}>
                      <Ban className="h-3 w-3 mr-1" /> Revoke
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
