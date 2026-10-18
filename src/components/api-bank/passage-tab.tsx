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
import { ArrowUpFromLine, ArrowDownFromLine, Plus, Search, ArrowRightLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PassageLog {
  id: string;
  cloudAccountId: string;
  cloudAccountName: string;
  agentName: string;
  direction: string;
  remotePath: string;
  sizeBytes: number;
  createdAt: string;
}

interface CloudAccount { id: string; name: string; provider: string; status: string; }

function formatBytes(bytes: number): string {
  if (bytes === 0) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function timeAgo(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

export function PassageTab({ refreshKey, onRefresh }: { refreshKey: number; onRefresh?: () => void }) {
  const [logs, setLogs] = useState<PassageLog[]>([]);
  const [cloudAccounts, setCloudAccounts] = useState<CloudAccount[]>([]);
  const [stats, setStats] = useState<{ total: number; outbound: number; inbound: number; totalBytes: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterDirection, setFilterDirection] = useState('');

  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [logRes, statsRes, cloudRes] = await Promise.all([
        fetch('/api/offload'),
        fetch('/api/offload?stats=true'),
        fetch('/api/cloud-accounts'),
      ]);
      const logJson = await logRes.json();
      const statsJson = await statsRes.json();
      const cloudJson = await cloudRes.json();
      setLogs(logJson.data?.logs || []);
      setStats(statsJson.data || null);
      setCloudAccounts(cloudJson.data || []);
    } catch {
      toast({ title: 'Failed to load passage data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [refreshKey, fetchData]);

  const handleLog = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await fetch('/api/offload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cloudAccountId: fd.get('cloudAccountId'),
          agentName: fd.get('agentName'),
          direction: fd.get('direction'),
          remotePath: fd.get('remotePath'),
          sizeBytes: fd.get('sizeBytes') ? parseInt(fd.get('sizeBytes') as string) : 0,
        }),
      });
      setOpen(false);
      fetchData();
    } catch {
      toast({ title: 'Failed to log passage', variant: 'destructive' });
    }
  };

  const filtered = logs.filter(l => {
    if (filterDirection && l.direction !== filterDirection) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!l.agentName.toLowerCase().includes(q) && !l.remotePath.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (loading) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-brand" /> Passage Log
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            WHO sent data WHERE, and WHEN. Aruk is the intermediary — he does not record what the data is.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-1.5 text-xs rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground"><Plus className="h-3 w-3" /> Log Passage</Button></DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Log Passage</DialogTitle></DialogHeader>
            <form onSubmit={handleLog} className="space-y-3">
              <div>
                <Label className="text-xs">Cloud Account</Label>
                <Select name="cloudAccountId" required>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    {cloudAccounts.filter(a => a.status === 'active').map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.name} ({a.provider.replace('_', ' ')})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Agent Name</Label>
                  <Input name="agentName" required placeholder="e.g. Ria" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Direction</Label>
                  <Select name="direction" defaultValue="outbound">
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="outbound">Outbound (to cloud)</SelectItem>
                      <SelectItem value="inbound">Inbound (from cloud)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Remote Path</Label>
                <Input name="remotePath" required placeholder="data/backup/conversations.jsonl" className="mt-1 font-mono text-xs" />
              </div>
              <div>
                <Label className="text-xs">Size (bytes)</Label>
                <Input name="sizeBytes" type="number" placeholder="0" className="mt-1" />
              </div>
              <Button type="submit" className="w-full rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground">Log Passage</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats bar */}
      {stats && stats.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-muted/20 rounded-lg p-3 text-center">
            <div className="text-[10px] text-muted-foreground">Total Passages</div>
            <div className="text-lg font-bold mt-0.5">{stats.total}</div>
          </div>
          <div className="bg-muted/20 rounded-lg p-3 text-center">
            <div className="text-[10px] text-muted-foreground">Outbound</div>
            <div className="text-lg font-bold mt-0.5 text-blue-400">{stats.outbound}</div>
          </div>
          <div className="bg-muted/20 rounded-lg p-3 text-center">
            <div className="text-[10px] text-muted-foreground">Inbound</div>
            <div className="text-lg font-bold mt-0.5 text-emerald-400">{stats.inbound}</div>
          </div>
          <div className="bg-muted/20 rounded-lg p-3 text-center">
            <div className="text-[10px] text-muted-foreground">Total Data</div>
            <div className="text-lg font-bold mt-0.5">{formatBytes(stats.totalBytes)}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      {logs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents, paths..."
              className="pl-8 h-8 text-xs"
            />
          </div>
          <Select value={filterDirection} onValueChange={setFilterDirection}>
            <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Direction" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="outbound">Outbound</SelectItem>
              <SelectItem value="inbound">Inbound</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Log list */}
      {logs.length === 0 ? (
        <Card className="rounded-xl border-dashed border-border/60">
          <CardContent className="py-16 text-center">
            <ArrowRightLeft className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No passages recorded yet.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              When agents send or receive data through cloud accounts, Aruk logs the passage here.
            </p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="rounded-xl border-dashed border-border/60">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">No passages match your filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2 stagger-children">
          {filtered.map(l => (
            <Card key={l.id} className="rounded-xl border-border/50 overflow-hidden card-hover">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                      l.direction === 'outbound'
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}>
                      {l.direction === 'outbound'
                        ? <ArrowUpFromLine className="h-3.5 w-3.5" />
                        : <ArrowDownFromLine className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm">{l.agentName}</div>
                      <div className="text-[11px] text-muted-foreground">{l.cloudAccountName}</div>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[9px] border ${
                    l.direction === 'outbound'
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }`}>{l.direction}</Badge>
                </div>
                <div className="text-[10px] font-mono text-muted-foreground bg-muted/20 rounded-md px-2.5 py-1.5 mb-2 truncate">
                  {l.remotePath}
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{formatBytes(l.sizeBytes)}</span>
                  <span>{timeAgo(l.createdAt)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
