"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollText, Plus, Trash2, ShieldCheck, ShieldX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Policy {
  id: string; name: string; description: string | null;
  effect: string; priority: number;
  daemonName: string | null; daemonRole: string | null;
  resourceType: string; resourceId: string | null;
  scope: string; status: string; passCount: number;
  createdAt: string; updatedAt: string;
}

const EFFECT_STYLE: Record<string, { badge: string; icon: any; label: string }> = {
  allow: { badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: ShieldCheck, label: 'Allow' },
  deny: { badge: 'bg-red-500/10 text-red-400 border-red-500/20', icon: ShieldX, label: 'Deny' },
};

const SCOPE_STYLE: Record<string, string> = {
  read: 'text-blue-400 bg-blue-500/10',
  write: 'text-amber-400 bg-amber-500/10',
  execute: 'text-violet-400 bg-violet-500/10',
  admin: 'text-red-400 bg-red-500/10',
};

export function PoliciesTab({ refreshKey }: { refreshKey: number }) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [filterEffect, setFilterEffect] = useState<string>('');
  const { toast } = useToast();

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (filterEffect) params.set('effect', filterEffect);
      const data = await fetch(`/api/policies?${params}`).then(r => r.json());
      setPolicies(data); setLoading(false);
    } catch { setLoading(false); }
  };

  useEffect(() => { load(); }, [refreshKey, filterEffect]);

  const createPolicy = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await fetch('/api/policies', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fd.get('name'), effect: fd.get('effect'),
          resourceType: fd.get('resourceType'),
          resourceId: fd.get('resourceId') || undefined,
          scope: fd.get('scope') || 'read',
          daemonRole: fd.get('daemonRole') || undefined,
          priority: parseInt(fd.get('priority') as string) || 0,
          description: fd.get('description') || undefined,
        }),
      });
      setOpen(false); load();
    } catch (err) {
      toast({ title: 'Failed to create policy', description: String(err), variant: 'destructive' });
    }
  };

  const deletePolicy = async (id: string) => {
    try {
      await fetch(`/api/policies?id=${id}`, { method: 'DELETE' });
      setPolicies(policies.filter(p => p.id !== id));
    } catch (err) {
      toast({ title: 'Failed to delete policy', description: String(err), variant: 'destructive' });
    }
  };

  if (loading) return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Array.from({length: 4}).map((_,i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>;

  const effectCfg = (effect: string) => EFFECT_STYLE[effect] || EFFECT_STYLE.allow;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-brand" /> Access Policies
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Rules governing what may pass. Higher priority policies are evaluated first.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterEffect || 'all'} onValueChange={v => setFilterEffect(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="allow">Allow</SelectItem>
              <SelectItem value="deny">Deny</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm" className="gap-1.5 text-xs rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground"><Plus className="h-3 w-3" /> New Policy</Button></DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Create Access Policy</DialogTitle></DialogHeader>
              <form onSubmit={createPolicy} className="space-y-3">
                <div><Label className="text-xs">Policy Name</Label><Input name="name" required placeholder="e.g. Allow researchers read access" className="mt-1" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Effect</Label>
                    <Select name="effect" defaultValue="allow">
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="allow">Allow</SelectItem>
                        <SelectItem value="deny">Deny</SelectItem>
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
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Resource Type</Label>
                    <Select name="resourceType" defaultValue="api_account">
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="api_account">API Account</SelectItem>
                        <SelectItem value="secret">Secret</SelectItem>
                        <SelectItem value="daemon">Daemon</SelectItem>
                        <SelectItem value="passage_out">Passage Out</SelectItem>
                        <SelectItem value="passage_in">Passage In</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Priority</Label><Input name="priority" type="number" defaultValue="0" className="mt-1" /></div>
                </div>
                <div><Label className="text-xs">Resource ID (optional, * for all)</Label><Input name="resourceId" placeholder="e.g. * or a specific ID" className="mt-1" /></div>
                <div>
                  <Label className="text-xs">Daemon Role (optional, applies to all if empty)</Label>
                  <Select name="daemonRole" defaultValue="">
                    <SelectTrigger className="mt-1"><SelectValue placeholder="All roles" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All roles</SelectItem>
                      <SelectItem value="researcher">Researcher</SelectItem>
                      <SelectItem value="orchestrator">Orchestrator</SelectItem>
                      <SelectItem value="sensory">Sensory</SelectItem>
                      <SelectItem value="creative">Creative</SelectItem>
                      <SelectItem value="agent">Agent</SelectItem>
                      <SelectItem value="os">OS</SelectItem>
                      <SelectItem value="guardian">Guardian</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Description</Label><Input name="description" placeholder="What does this policy control?" className="mt-1" /></div>
                <Button type="submit" className="w-full rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground">Create Policy</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {policies.length === 0 ? (
        <Card className="rounded-xl border-dashed border-border/60">
          <CardContent className="py-16 text-center">
            <ScrollText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No access policies defined.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Without policies, Aruk defaults to allow-all. Define rules to enforce the perimeter.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-children">
          {policies.map(p => {
            const cfg = effectCfg(p.effect);
            const EffectIcon = cfg.icon;
            return (
              <Card key={p.id} className={`rounded-xl border-border/50 overflow-hidden card-hover ${p.status !== 'active' ? 'opacity-50' : ''}`}>
                <CardHeader className="pb-2 px-5 pt-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${cfg.badge}`}>
                        <EffectIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold">{p.name}</CardTitle>
                        {p.description && <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400" onClick={() => deletePolicy(p.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-4">
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <Badge variant="outline" className={`text-[10px] border ${cfg.badge}`}>{cfg.label}</Badge>
                    <Badge variant="outline" className={`text-[10px] border ${SCOPE_STYLE[p.scope] || ''}`}>{p.scope}</Badge>
                    <Badge variant="outline" className="text-[10px] border-border/50 bg-muted/20">{p.resourceType}{p.resourceId ? ':' + p.resourceId : ''}</Badge>
                    {p.daemonRole && <Badge variant="outline" className="text-[10px] border-border/50 bg-muted/20">{p.daemonRole}</Badge>}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/20">
                    <span>Priority {p.priority}</span>
                    <span>{p.passCount} passes</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}