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
import { GitBranch, Plus, Shield, ChevronRight, Eye, Ban, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Daemon {
  id: string; name: string; designation: string; role: string;
  parentName: string | null; creatorName: string | null;
  description: string | null; purpose: string;
  capabilities: string[]; status: string;
  trustLevel: number; childCount: number; passCount: number;
  createdAt: string; updatedAt: string;
}

const ROLE_COLORS: Record<string, string> = {
  guardian: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  orchestrator: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  researcher: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  sensory: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  creative: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
  agent: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  os: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
};

export function LineageTab({ refreshKey }: { refreshKey: number }) {
  const [daemons, setDaemons] = useState<Daemon[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    fetch('/api/daemons')
      .then(r => r.json())
      .then(data => { if (!cancelled) { setDaemons(data); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  const registerDaemon = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const caps = (fd.get('capabilities') as string)
      .split(',').map(s => s.trim()).filter(Boolean);
    try {
      await fetch('/api/daemons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fd.get('name'), designation: fd.get('designation'),
          role: fd.get('role'), purpose: fd.get('purpose'),
          description: fd.get('description') || undefined,
          capabilities: caps, trustLevel: parseInt(fd.get('trustLevel') as string) || 5,
        }),
      });
      setOpen(false);
      const data = await fetch('/api/daemons').then(r => r.json());
      setDaemons(data);
    } catch (err) {
      toast({ title: 'Failed to register daemon', description: String(err), variant: 'destructive' });
    }
  };

  const revokeDaemon = async (id: string) => {
    try {
      await fetch(`/api/daemons?id=${id}`, { method: 'DELETE' });
      const data = await fetch('/api/daemons').then(r => r.json());
      setDaemons(data);
    } catch (err) {
      toast({ title: 'Failed to revoke daemon', description: String(err), variant: 'destructive' });
    }
  };

  if (loading) return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Array.from({length: 4}).map((_,i) => <Skeleton key={i} className="h-48 rounded-xl" />)}</div>;

  const roleColors = (role: string) => ROLE_COLORS[role] || 'text-muted-foreground bg-muted/50 border-border/50';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-brand" /> Trusted Family Tree
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Who created each intelligence, why it exists, and how it is related to the others.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 text-xs rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground"><Plus className="h-3 w-3" /> Register Daemon</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Register Daemon</DialogTitle></DialogHeader>
            <form onSubmit={registerDaemon} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Name</Label><Input name="name" required placeholder="e.g. Scott" className="mt-1" /></div>
                <div><Label className="text-xs">Designation</Label><Input name="designation" required placeholder="e.g. SC-01" className="mt-1" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Role</Label>
                  <Select name="role" defaultValue="agent">
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['researcher','orchestrator','sensory','creative','agent','os','guardian'].map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Trust Level (1-10)</Label><Input name="trustLevel" type="number" min="1" max="10" defaultValue="5" className="mt-1" /></div>
              </div>
              <div><Label className="text-xs">Purpose</Label><Input name="purpose" required placeholder="Why does this intelligence exist?" className="mt-1" /></div>
              <div><Label className="text-xs">Description</Label><Input name="description" placeholder="Optional context" className="mt-1" /></div>
              <div><Label className="text-xs">Capabilities (comma-separated)</Label><Input name="capabilities" placeholder="reasoning, vision, code_generation" className="mt-1" /></div>
              <Button type="submit" className="w-full rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground">Register</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {daemons.length === 0 ? (
        <Card className="rounded-xl border-dashed border-border/60">
          <CardContent className="py-16 text-center">
            <Crown className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No daemons registered yet. The family tree is empty.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Aruk keeps the lineage of all intelligences in the system.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-children">
          {daemons.map(d => (
            <Card key={d.id} className={`rounded-xl border-border/50 overflow-hidden card-hover ${d.status === 'revoked' ? 'opacity-50' : ''}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg border flex items-center justify-center text-sm font-bold ${roleColors(d.role)}`}>
                      {d.designation.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-sm flex items-center gap-2">
                        {d.name}
                        <Badge variant="outline" className={`text-[10px] font-medium border ${roleColors(d.role)}`}>{d.role}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{d.designation}</div>
                    </div>
                  </div>
                  <Badge variant={d.status === 'active' ? 'default' : 'secondary'} className={`text-[10px] ${d.status === 'active' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                    {d.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{d.purpose}</p>
                <div className="flex items-center gap-4 text-[11px] text-muted-foreground mb-3">
                  {d.parentName && <span className="flex items-center gap-1"><ChevronRight className="h-3 w-3" /> Parent: {d.parentName}</span>}
                  {d.creatorName && <span>Created by: {d.creatorName}</span>}
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {d.capabilities.map(c => (
                    <span key={c} className="px-2 py-0.5 rounded-full text-[10px] bg-muted/50 text-muted-foreground border border-border/30">{c}</span>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-border/30">
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> Trust {d.trustLevel}/10</span>
                    <span>{d.passCount} passes</span>
                    {d.childCount > 0 && <span>{d.childCount} children</span>}
                  </div>
                  {d.status === 'active' && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => revokeDaemon(d.id)}>
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
