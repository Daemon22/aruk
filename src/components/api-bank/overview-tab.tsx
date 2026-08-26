"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Shield,
  GitBranch,
  Lock,
  ScrollText,
  Fingerprint,
  ShieldAlert,
  CheckCircle,
  XCircle,
  Clock,
  Cloud,
  ArrowRightLeft,
} from "lucide-react";

interface AuditStats {
  total: number;
  allowed: number;
  denied: number;
  byAction: Record<string, number>;
  byActor: Record<string, number>;
  recentHour: number;
  recentDay: number;
}

interface PassageStats {
  total: number;
  outbound: number;
  inbound: number;
  totalBytes: number;
}

interface AuditEntry {
  id: string;
  actorName: string;
  action: string;
  outcome: string;
  reason: string | null;
  createdAt: string;
}

export function OverviewTab({ refreshKey }: { refreshKey: number }) {
  const [loading, setLoading] = useState(true);
  const [daemonCount, setDaemonCount] = useState(0);
  const [activePasses, setActivePasses] = useState(0);
  const [policyCount, setPolicyCount] = useState(0);
  const [perimeterRules, setPerimeterRules] = useState(0);
  const [auditStats, setAuditStats] = useState<AuditStats | null>(null);
  const [recentEvents, setRecentEvents] = useState<AuditEntry[]>([]);
  const [cloudAccountCount, setCloudAccountCount] = useState(0);
  const [passageStats, setPassageStats] = useState<PassageStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/daemons').then(r => r.json()).catch(() => []),
      fetch('/api/passes?status=active').then(r => r.json()).catch(() => []),
      fetch('/api/policies').then(r => r.json()).catch(() => []),
      fetch('/api/perimeter').then(r => r.json()).catch(() => []),
      fetch('/api/audit?stats=true').then(r => r.json()).catch(() => null),
      fetch('/api/audit?perPage=8').then(r => r.json()).catch(() => ({ events: [] })),
      fetch('/api/cloud-accounts').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/offload?stats=true').then(r => r.json()).catch(() => null),
    ]).then(([daemons, passes, policies, rules, audit, events, clouds, passage]) => {
      if (!cancelled) {
        setDaemonCount(daemons.filter((d: any) => d.status === 'active').length);
        setActivePasses(passes.length);
        setPolicyCount(policies.length);
        setPerimeterRules(rules.filter((r: any) => r.status === 'active').length);
        if (audit) setAuditStats(audit);
        setRecentEvents(events.events || []);
        setCloudAccountCount((clouds.data || []).filter((c: any) => c.status === 'active').length);
        if (passage?.data) setPassageStats(passage.data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-[100px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[200px] rounded-xl" />
      </div>
    );
  }

  const statCards = [
    { label: "Trusted Daemons", value: daemonCount, icon: GitBranch, accent: "text-violet-400", bg: "bg-violet-500/8", border: "border-violet-500/20" },
    { label: "Active Passes", value: activePasses, icon: Lock, accent: "text-emerald-400", bg: "bg-emerald-500/8", border: "border-emerald-500/20" },
    { label: "Policies", value: policyCount, icon: Fingerprint, accent: "text-blue-400", bg: "bg-blue-500/8", border: "border-blue-500/20" },
    { label: "Perimeter Rules", value: perimeterRules, icon: ShieldAlert, accent: "text-amber-400", bg: "bg-amber-400/8", border: "border-amber-400/20" },
    { label: "Access Events", value: auditStats?.total ?? 0, icon: ScrollText, accent: "text-cyan-400", bg: "bg-cyan-400/8", border: "border-cyan-400/20" },
    { label: "Cloud Accounts", value: cloudAccountCount, icon: Cloud, accent: "text-sky-400", bg: "bg-sky-400/8", border: "border-sky-400/20" },
    { label: "Passages", value: passageStats?.total ?? 0, icon: ArrowRightLeft, accent: "text-orange-400", bg: "bg-orange-400/8", border: "border-orange-400/20" },
  ];

  const actionIcons: Record<string, string> = {
    pass_issued: '🔑', pass_revoked: '🚫', daemon_registered: '✨',
    daemon_revoked: '💀', policy_created: '📜', passage_out: '📤',
    access_denied: '🛡️', cloud_account_connected: '☁️',
    cloud_account_revoked: '🛑', data_offloaded: '⬇️', data_retrieved: '⬆️',
  };

  const timeAgo = (date: string) => {
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const allowedPct = auditStats && auditStats.total > 0
    ? Math.round((auditStats.allowed / auditStats.total) * 100)
    : 100;

  return (
    <div className="space-y-5">
      {/* Gate Status Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {statCards.map(({ label, value, icon: Icon, accent, bg, border }, i) => (
          <Card key={label} className={`card-hover rounded-xl ${border} ${bg} overflow-hidden`}>
            <CardContent className="p-4 relative">
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-brand/5 to-transparent rounded-bl-3xl pointer-events-none" />
              <div className="flex items-center justify-between mb-2 relative">
                <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
                <div className={`p-1.5 rounded-lg ${bg}`}>
                  <Icon className={`h-3.5 w-3.5 ${accent}`} />
                </div>
              </div>
              <div className="text-2xl font-bold tracking-tight tabular-nums animate-fade-in-up relative" style={{ animationDelay: `${i * 60 + 100}ms` }}>
                {value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Gate Integrity */}
        <Card className="rounded-xl border-border/50 overflow-hidden">
          <CardHeader className="pb-3 px-5 pt-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-brand" />
              Gate Integrity
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            {/* Allow/Deny bar */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">Access decisions</span>
                <span className={`font-semibold ${allowedPct >= 90 ? 'text-emerald-400' : allowedPct >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                  {allowedPct}% allowed
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted/50 overflow-hidden flex">
                <div
                  className="bg-emerald-500/70 rounded-l-full transition-all duration-700"
                  style={{ width: `${allowedPct}%` }}
                />
                <div
                  className="bg-red-500/70 rounded-r-full transition-all duration-700"
                  style={{ width: `${100 - allowedPct}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-2.5 rounded-lg bg-emerald-500/8 border border-emerald-500/15">
                <div className="text-lg font-bold text-emerald-400 tabular-nums">{auditStats?.allowed ?? 0}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Allowed</div>
              </div>
              <div className="p-2.5 rounded-lg bg-red-500/8 border border-red-500/15">
                <div className="text-lg font-bold text-red-400 tabular-nums">{auditStats?.denied ?? 0}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Denied</div>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-400/8 border border-amber-400/15">
                <div className="text-lg font-bold text-amber-400 tabular-nums">{auditStats?.recentHour ?? 0}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Last Hour</div>
              </div>
            </div>
            {policyCount === 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-400/8 border border-amber-400/15 text-xs text-amber-400">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                <span>No policies defined — gate is in default-deny mode</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Audit Events */}
        <Card className="rounded-xl border-border/50 overflow-hidden">
          <CardHeader className="pb-3 px-5 pt-4">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ScrollText className="h-4 w-4 text-brand" />
                Recent Events
              </span>
              {recentEvents.length > 0 && (
                <Badge variant="outline" className="text-[10px] border-border/50 bg-muted/20 font-normal">
                  {auditStats?.recentHour ?? 0} in last hour
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {recentEvents.length === 0 ? (
              <div className="py-8 text-center">
                <Clock className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No events recorded yet</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {recentEvents.map((e) => (
                  <div key={e.id} className="flex items-center gap-2.5 py-1.5">
                    <span className="text-sm shrink-0">{actionIcons[e.action] || '📝'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium truncate">{e.actorName}</span>
                        <span className="text-[10px] text-muted-foreground">→</span>
                        <span className="text-xs text-muted-foreground truncate">{e.action.replace(/_/g, ' ')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {e.outcome === 'allowed' ? (
                        <CheckCircle className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-400" />
                      )}
                      <span className="text-[10px] text-muted-foreground tabular-nums">{timeAgo(e.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* The Five Pillars */}
      <Card className="rounded-xl border-border/50 overflow-hidden">
        <CardHeader className="pb-3 px-5 pt-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-brand" />
            The Five Pillars of the Gate
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid sm:grid-cols-3 md:grid-cols-5 gap-0">
            {[
              { step: "01", title: "Secrets", desc: "API keys, credentials, private keys — kept safe. Organized by provider, tagged by purpose.", iconBg: "bg-emerald-500/10 border-emerald-500/20", color: "text-emerald-400" },
              { step: "02", title: "Permissions", desc: "Whether a daemon is authorized. Policies evaluated by priority, default-deny when no policy matches.", iconBg: "bg-blue-500/10 border-blue-500/20", color: "text-blue-400" },
              { step: "03", title: "Lineage", desc: "Who created each intelligence, why it exists, how it relates to the others.", iconBg: "bg-violet-500/10 border-violet-500/20", color: "text-violet-400" },
              { step: "04", title: "Access Passes", desc: "Temporary, scoped, revocable tokens. Raw credentials are never exposed.", iconBg: "bg-amber-500/10 border-amber-500/20", color: "text-amber-400" },
              { step: "05", title: "Auditability", desc: "Who accessed what, for what purpose, under which authorization, when.", iconBg: "bg-cyan-500/10 border-cyan-500/20", color: "text-cyan-400" },
            ].map(({ step, title, desc, iconBg, color }, i) => (
              <div key={step} className="relative">
                <div className="p-4 rounded-xl bg-muted/10 border border-border/20 h-full hover:border-border/40 hover:bg-muted/20 transition-all duration-300 group gradient-border">
                  <div className="relative z-10 flex items-center gap-2 mb-2.5">
                    <div className={`w-7 h-7 rounded-lg border ${iconBg} flex items-center justify-center text-[10px] font-bold ${color} group-hover:scale-110 transition-transform duration-300 shadow-sm`}>
                      {step}
                    </div>
                    <div className={`text-[10px] font-bold tracking-widest ${color} opacity-70`}>PILLAR</div>
                  </div>
                  <div className="font-semibold text-sm mb-1.5">{title}</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
                {i < 4 && (
                  <div className="hidden sm:flex absolute -right-2.5 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-background border border-border/40 items-center justify-center shadow-sm">
                    <span className="text-xs text-brand font-bold">›</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
