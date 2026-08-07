"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  DollarSign,
  Clock,
  ArrowUpDown,
  Shield,
  Server,
  TrendingUp,
} from "lucide-react";

interface Stats {
  totalAccounts: number;
  activeAccounts: number;
  healthyAccounts: number;
  warningAccounts: number;
  offlineAccounts: number;
  totalCreditsRemaining: number;
  avgCreditsRemaining: number;
  todayRequests: number;
  avgCostPerRequest: number;
  currentBestProvider: string | null;
  backupProvider: string | null;
  emergencyProvider: string | null;
}

interface ProviderCredit {
  remaining: number;
  total: number;
  percent: number;
  unit: string;
}

export function OverviewTab({ refreshKey }: { refreshKey: number }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [credits, setCredits] = useState<Record<string, ProviderCredit>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stats")
      .then((r) => r.json())
      .then(({ stats, credits }) => {
        if (!cancelled) {
          setStats(stats);
          setCredits(credits);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] rounded-xl" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    { label: "Total Accounts", value: stats.totalAccounts, icon: Shield, accent: "text-muted-foreground", bg: "", border: "border-border/50" },
    { label: "Healthy", value: stats.healthyAccounts, icon: CheckCircle, accent: "text-emerald-400", bg: "bg-emerald-500/8", border: "border-emerald-500/20" },
    { label: "Warning", value: stats.warningAccounts, icon: AlertTriangle, accent: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/20" },
    { label: "Offline", value: stats.offlineAccounts, icon: XCircle, accent: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20" },
    { label: "Credits Left", value: stats.avgCreditsRemaining + "%", icon: DollarSign, accent: "text-emerald-400", bg: "bg-emerald-500/8", border: "border-emerald-500/15" },
    { label: "Today's Requests", value: stats.todayRequests.toLocaleString(), icon: Activity, accent: "text-blue-400", bg: "bg-blue-500/8", border: "border-blue-500/15" },
    { label: "Avg Cost/Req", value: "$" + stats.avgCostPerRequest, icon: TrendingUp, accent: "text-violet-400", bg: "bg-violet-500/8", border: "border-violet-500/15" },
    { label: "Active APIs", value: stats.activeAccounts, icon: Server, accent: "text-teal-400", bg: "bg-teal-500/8", border: "border-teal-500/15" },
  ];

  return (
    <div className="space-y-5">
      {/* Stat Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map(({ label, value, icon: Icon, accent, bg, border }, i) => (
          <Card
            key={label}
            className={`card-hover rounded-xl ${border} ${bg} overflow-hidden`}
          >
            <CardContent className="p-4 relative">
              {/* Subtle inner glow */}
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-brand/5 to-transparent rounded-bl-3xl pointer-events-none" />
              <div className="flex items-center justify-between mb-2 relative">
                <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                  {label}
                </span>
                <div className={`p-1.5 rounded-lg ${bg} transition-transform duration-300 group-hover:scale-110`}>
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

      {/* Current Routing & Credit Overview */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Active Routing — Visual Pipeline */}
        <Card className="rounded-xl border-border/50 overflow-hidden">
          <CardHeader className="pb-3 px-5 pt-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-brand" />
              Active Routing
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="space-y-0">
              {[
                { label: "Current Best", value: stats.currentBestProvider, tier: "best" },
                { label: "Backup", value: stats.backupProvider, tier: "backup" },
                { label: "Emergency", value: stats.emergencyProvider, tier: "emergency" },
              ].map(({ label, value, tier }, i) => (
                <div key={label}>
                  <div className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        tier === "best" ? "bg-brand text-white glow-brand animate-pulse-glow" :
                        tier === "backup" ? "bg-blue-500/15 text-blue-400 border border-blue-500/30" :
                        "bg-red-500/15 text-red-400 border border-red-500/30"
                      }`}>
                        {i + 1}
                      </div>
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-xs font-semibold ${
                        tier === "best" ? "border-brand/30 text-brand bg-brand-muted" :
                        tier === "backup" ? "border-border/60 bg-muted/40 text-foreground/80" :
                        "border-red-500/30 text-red-500 bg-red-500/10"
                      }`}
                    >
                      {value || "N/A"}
                    </Badge>
                  </div>
                  {i < 2 && (
                    <div className="ml-3 w-px h-3 bg-gradient-to-b from-border/80 to-border/30" />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-border/50 text-[11px] text-muted-foreground/80 leading-relaxed">
              Automatically selects the best provider based on health, credits, and speed.
            </div>
          </CardContent>
        </Card>

        {/* Credits by Provider */}
        <Card className="rounded-xl border-border/50 overflow-hidden">
          <CardHeader className="pb-3 px-5 pt-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-brand" />
              Credits by Provider
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-3.5">
            {Object.entries(credits)
              .sort(([, a], [, b]) => {
                if (a.unit === "unlimited" && b.unit !== "unlimited") return -1;
                if (a.unit !== "unlimited" && b.unit === "unlimited") return 1;
                return b.percent - a.percent;
              })
              .slice(0, 6)
              .map(([name, data]) => (
                <div key={name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{name}</span>
                    <span
                      className={`tabular-nums ${
                        data.unit === "unlimited"
                          ? "text-emerald-400 font-medium"
                          : data.percent < 20
                            ? "text-red-400 font-semibold"
                            : "text-muted-foreground"
                      }`}
                    >
                      {data.unit === "unlimited"
                        ? "Unlimited"
                        : `${data.percent}%`}
                    </span>
                  </div>
                  {data.unit !== "unlimited" && (
                    <Progress
                      value={data.percent}
                      className={`h-1.5 rounded-full progress-animated ${data.percent < 20 ? "[&>div]:bg-red-500" : data.percent < 50 ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-500"}`}
                    />
                  )}
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      {/* How it works — connected steps */}
      <Card className="rounded-xl border-border/50 overflow-hidden">
        <CardHeader className="pb-3 px-5 pt-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-brand" />
            How Aruk Works
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid sm:grid-cols-3 gap-0">
            {[
              { step: "01", title: "Store", desc: "API keys, passwords, OAuth tokens, service accounts, SSH keys, certificates — she keeps them all. Organized by provider, tagged by purpose.", color: "emerald", iconBg: "bg-emerald-500/10 border-emerald-500/20" },
              { step: "02", title: "Monitor", desc: "She watches credit levels, success rates, and latency in real time. She knows when a key is running low or a credential is expiring before you do.", color: "blue", iconBg: "bg-blue-500/10 border-blue-500/20" },
              { step: "03", title: "Route & Serve", desc: "Instead of hardcoding a provider, ask Aruk. She returns the best available key or credential using your chosen strategy. Agents can request secrets by purpose.", color: "violet", iconBg: "bg-violet-500/10 border-violet-500/20" },
            ].map(({ step, title, desc, color, iconBg }, i) => (
              <div key={step} className="relative">
                <div className="p-4 rounded-xl bg-muted/10 border border-border/20 h-full hover:border-border/40 hover:bg-muted/20 transition-all duration-300 group gradient-border">
                  <div className="relative z-10 flex items-center gap-2 mb-2.5">
                    <div className={`w-7 h-7 rounded-lg border ${iconBg} flex items-center justify-center text-[10px] font-bold ${color === "emerald" ? "text-emerald-400" : color === "blue" ? "text-blue-400" : "text-violet-400"} group-hover:scale-110 transition-transform duration-300 shadow-sm`}>
                      {step}
                    </div>
                    <div className={`text-[10px] font-bold tracking-widest ${color === "emerald" ? "text-emerald-400" : color === "blue" ? "text-blue-400" : "text-violet-400"} opacity-70`}>
                      STEP {step}
                    </div>
                  </div>
                  <div className="font-semibold text-sm mb-1.5">{title}</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
                {/* Arrow connector */}
                {i < 2 && (
                  <div className="hidden sm:flex absolute -right-2.5 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-background border border-border/40 items-center justify-center shadow-sm hover:scale-110 transition-transform">
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