"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollText, ShieldAlert, CheckCircle, XCircle, Activity, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AuditEntry {
  id: string; actorName: string; actorRole: string | null;
  action: string; resourceType: string; resourceId: string | null;
  reason: string | null; outcome: string;
  createdAt: string;
}

interface AuditStats {
  total: number; allowed: number; denied: number;
  byAction: Record<string, number>; byActor: Record<string, number>;
  recentHour: number; recentDay: number;
}

const ACTION_ICONS: Record<string, string> = {
  pass_issued: '🔑', pass_revoked: '🚫', daemon_registered: '✨',
  daemon_revoked: '💀', policy_created: '📜', passage_out: '📤',
  access_denied: '🛡️',
};

const OUTCOME_STYLE: Record<string, string> = {
  allowed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  denied: 'bg-red-500/10 text-red-400 border-red-500/20',
  error: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

export function AuditTab({ refreshKey }: { refreshKey: number }) {
  const [events, setEvents] = useState<AuditEntry[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterOutcome, setFilterOutcome] = useState('');
  const { toast } = useToast();

  const load = async () => {
    try {
      const [statsData, eventsData] = await Promise.all([
        fetch('/api/audit?stats=true').then(r => r.json()),
        fetch(`/api/audit?page=${page}&perPage=30${filterOutcome ? `&outcome=${filterOutcome}` : ''}`).then(r => r.json()),
      ]);
      setStats(statsData);
      setEvents(eventsData.events);
      setTotal(eventsData.total);
    } catch {
      toast({ title: "Failed to load audit events", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [refreshKey, page, filterOutcome]);

  const timeAgo = (date: string) => {
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  if (loading) return <div className="space-y-3">{Array.from({length: 5}).map((_,i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>;

  return (
    <div className="space-y-5">
      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="rounded-xl border-border/50 overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <ScrollText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Total Events</span>
              </div>
              <div className="text-2xl font-bold tabular-nums">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-emerald-500/15 overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-[11px] text-emerald-400 font-medium uppercase tracking-wider">Allowed</span>
              </div>
              <div className="text-2xl font-bold tabular-nums text-emerald-400">{stats.allowed}</div>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-red-500/15 overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-3.5 w-3.5 text-red-400" />
                <span className="text-[11px] text-red-400 font-medium uppercase tracking-wider">Denied</span>
              </div>
              <div className="text-2xl font-bold tabular-nums text-red-400">{stats.denied}</div>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-border/50 overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-[11px] text-amber-400 font-medium uppercase tracking-wider">Last Hour</span>
              </div>
              <div className="text-2xl font-bold tabular-nums">{stats.recentHour}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top actors */}
      {stats && stats.byActor && Object.keys(stats.byActor).length > 0 && (
        <Card className="rounded-xl border-border/50 overflow-hidden">
          <CardHeader className="pb-2 px-5 pt-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-brand" /> Most Active
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byActor).sort(([,a],[,b]) => b-a).slice(0, 8).map(([name, count]) => (
                <Badge key={name} variant="outline" className="text-xs border-border/50 bg-muted/20">
                  {name} <span className="text-muted-foreground ml-1">{count}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Event log */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Audit Trail</h2>
        <div className="flex items-center gap-2">
          <Select value={filterOutcome || 'all'} onValueChange={v => { setFilterOutcome(v === 'all' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="allowed">Allowed</SelectItem>
              <SelectItem value="denied">Denied</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-[11px] text-muted-foreground">{total} events</span>
        </div>
      </div>

      {events.length === 0 ? (
        <Card className="rounded-xl border-dashed border-border/60">
          <CardContent className="py-16 text-center">
            <ScrollText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No audit events recorded yet.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Aruk and Manya-OS record every access event.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5 stagger-children">
          {events.map(e => (
            <Card key={e.id} className="rounded-xl border-border/30 overflow-hidden">
              <CardContent className="p-3 flex items-center gap-3">
                <span className="text-base shrink-0">{ACTION_ICONS[e.action] || '📝'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-xs">{e.actorName}</span>
                    {e.actorRole && <span className="text-[10px] text-muted-foreground">({e.actorRole})</span>}
                    <span className="text-[10px] text-muted-foreground">→</span>
                    <span className="text-xs">{e.action.replace(/_/g, ' ')}</span>
                  </div>
                  {e.reason && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{e.reason}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className={`text-[10px] border ${OUTCOME_STYLE[e.outcome] || ''}`}>{e.outcome}</Badge>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{timeAgo(e.createdAt)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 30 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="text-xs text-muted-foreground">Page {page} of {Math.ceil(total / 30)}</span>
          <Button variant="outline" size="sm" className="h-8 text-xs" disabled={page * 30 >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}