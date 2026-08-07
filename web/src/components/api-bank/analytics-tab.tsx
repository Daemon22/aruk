"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Download,
  Clock,
  Zap,
  DollarSign,
  Activity,
} from "lucide-react";

interface DailyUsage {
  date: string;
  requests: number;
  cost: number;
  avgLatency: number;
  successRate: number;
  errors: number;
}

interface UsageLog {
  id: string;
  model: string;
  latencyMs: number;
  cost: number;
  status: string;
  createdAt: string;
  account: { name: string; provider: { name: string } };
}

interface Prediction {
  id: string;
  name: string;
  providerName: string;
  remainingCredits: number;
  totalCredits: number;
  remainingPercent: number;
  dailyBurnRate: number;
  daysLeft: number;
  estimatedExhaustion: string;
  healthScore: number;
  todayRequests: number;
}

interface ProviderComparison {
  name: string;
  totalRequests: number;
  avgLatency: number;
  errorRate: number;
}

// ── Mini Bar Chart with gradient fills and % change tooltips ─

function MiniBarChart({
  data,
  dataKey,
  color,
  label,
  format,
}: {
  data: DailyUsage[];
  dataKey: keyof DailyUsage;
  color: string;
  label: string;
  format?: (v: number) => string;
}) {
  const max = Math.max(...data.map((d) => Number(d[dataKey]) || 0), 1);
  const fmt = format || ((v: number) => v.toLocaleString());
  return (
    <Card className="rounded-xl border-border/40 overflow-hidden group/card">
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-sm font-semibold">{label}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="flex gap-[3px] h-44 relative">
          {data.map((d, i) => {
            const val = Number(d[dataKey]) || 0;
            const pct = (val / max) * 100;
            // Compute % change from previous day
            let changeStr = "";
            if (i > 0) {
              const prev = Number(data[i - 1][dataKey]) || 0;
              if (prev > 0) {
                const pctChange = ((val - prev) / prev) * 100;
                const sign = pctChange >= 0 ? "+" : "";
                changeStr = `${sign}${pctChange.toFixed(1)}%`;
              }
            }
            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center gap-1 group relative h-full"
              >
                {/* Rich tooltip */}
                <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[10px] px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap font-mono z-10 shadow-lg border border-border/60 space-y-0.5">
                  <div className="font-semibold text-foreground">{fmt(val)}</div>
                  {changeStr && (
                    <div className={Number(changeStr) >= 0 ? "text-emerald-400" : "text-red-400"}>
                      {changeStr} vs prev day
                    </div>
                  )}
                  <div className="text-muted-foreground">
                    {new Date(d.date).toLocaleDateString("en", { month: "short", day: "numeric" })}
                  </div>
                </div>
                <div className="w-full relative flex-1 flex items-end">
                  <div
                    className="w-full rounded-t-[3px] transition-all duration-500 ease-out group-hover:opacity-95 group-hover:brightness-110 group-hover:rounded-t-md min-h-[2px]"
                    style={{
                      height: `${Math.max(pct, 2)}%`,
                      background: `linear-gradient(to top, ${color}, ${color}66)`,
                      opacity: 0.7,
                      transformOrigin: 'bottom',
                      animation: `bar-grow 0.7s ${i * 35}ms cubic-bezier(0.16, 1, 0.3, 1) both`,
                    }}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground/50 truncate w-full text-center">
                  {new Date(d.date).toLocaleDateString("en", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ExportButton() {
  const download = (format: string) => {
    window.open(`/api/export?format=${format}`, "_blank");
  };
  return (
    <div className="flex gap-1.5">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 text-[10px] gap-1 px-2 text-muted-foreground hover:text-foreground"
        onClick={() => download("json")}
      >
        <Download className="h-2.5 w-2.5" /> JSON
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 text-[10px] gap-1 px-2 text-muted-foreground hover:text-foreground"
        onClick={() => download("csv")}
      >
        <Download className="h-2.5 w-2.5" /> CSV
      </Button>
    </div>
  );
}

export function AnalyticsTab({ refreshKey }: { refreshKey: number }) {
  const [daily, setDaily] = useState<DailyUsage[]>([]);
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [providers, setProviders] = useState<ProviderComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "predictions" | "providers">(
    "overview"
  );
  const [days, setDays] = useState(14);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/usage/daily?days=${days}`).then((r) => r.json()),
      fetch("/api/usage/logs?perPage=15").then((r) => r.json()),
      fetch("/api/predictions").then((r) => r.json()),
    ])
      .then(([dailyData, logsData, predData]) => {
        if (!cancelled) {
          setDaily(dailyData);
          setLogs(logsData.logs || []);
          setPredictions(predData.predictions || []);
          setProviders(predData.providerComparison || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, days]);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
    );
  }

  const totalCost = daily.reduce((s, d) => s + d.cost, 0);
  const totalReqs = daily.reduce((s, d) => s + d.requests, 0);
  const avgSuccess =
    daily.length > 0
      ? Math.round(
          (daily.reduce((s, d) => s + d.successRate, 0) / daily.length) * 10
        ) / 10
      : 0;
  const avgLatency =
    daily.length > 0
      ? Math.round(
          daily.reduce((s, d) => s + d.avgLatency, 0) / daily.length
        )
      : 0;

  return (
    <div className="space-y-5">
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Requests", value: totalReqs.toLocaleString(), extra: <ExportButton /> },
          { label: "Total Cost", value: `$${totalCost.toFixed(2)}` },
          { label: "Avg Success Rate", value: `${avgSuccess}%`, color: avgSuccess >= 95 ? "text-emerald-400" : "text-amber-500" },
          { label: "Avg Latency", value: `${avgLatency}ms` },
        ].map(({ label, value, extra, color }, i) => (
          <Card
            key={label}
            className="rounded-xl border-border/40 card-hover overflow-hidden"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <CardContent className="p-4 relative">
              <div className="absolute top-0 right-0 w-12 h-12 bg-gradient-to-bl from-brand/5 to-transparent rounded-bl-2xl pointer-events-none" />
              <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider flex items-center justify-between mb-2 relative">
                {label}
                {extra}
              </div>
              <div className={`text-2xl font-bold tracking-tight tabular-nums animate-fade-in-up relative ${color || ""}`} style={{ animationDelay: `${i * 50 + 80}ms` }}>
                {value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sub-tabs + time range */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-0.5 bg-muted/30 p-1 rounded-xl border border-border/40">
          {(
            [
              { key: "overview", label: "Charts" },
              { key: "predictions", label: "Credit Prediction" },
              { key: "providers", label: "Provider Comparison" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
                tab === t.key
                  ? "bg-background shadow-sm text-foreground"
                  : "hover:bg-muted/50 text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === "overview" && (
          <div className="flex gap-1 ml-auto">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-all ${
                  days === d
                    ? "bg-brand/15 text-brand border border-brand/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === "overview" && (
        <div className="grid md:grid-cols-2 gap-4">
          <MiniBarChart data={daily} dataKey="requests" color="#10b981" label="Daily Requests" />
          <MiniBarChart data={daily} dataKey="cost" color="#f59e0b" label="Daily Cost ($)" format={(v) => `$${v.toFixed(2)}`} />
          <MiniBarChart data={daily} dataKey="avgLatency" color="#8b5cf6" label="Avg Latency (ms)" format={(v) => `${v}ms`} />
          <MiniBarChart data={daily} dataKey="successRate" color="#06b6d4" label="Success Rate (%)" format={(v) => `${v}%`} />
        </div>
      )}

      {tab === "predictions" && (
        <Card className="rounded-xl border-border/50 overflow-hidden">
          <CardHeader className="pb-3 px-5 pt-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-amber-500" />
              When Will Your Credits Run Out?
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {predictions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-12">
                No paid accounts with trackable credits.
              </p>
            ) : (
              <div className="divide-y divide-border/40">
                {predictions.map((p) => {
                  const isUrgent = p.daysLeft <= 7;
                  const isWarning = p.daysLeft <= 30 && !isUrgent;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-4 py-3.5 px-2.5 transition-colors hover:bg-muted/20"
                    >
                      <div className={`p-2 rounded-lg shrink-0 ${isUrgent ? "bg-red-500/10" : isWarning ? "bg-amber-500/10" : "bg-emerald-500/10"}`}>
                        {isUrgent ? (
                          <AlertTriangle className="h-4 w-4 text-red-400" />
                        ) : isWarning ? (
                          <Clock className="h-4 w-4 text-amber-500" />
                        ) : (
                          <TrendingUp className="h-4 w-4 text-emerald-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{p.providerName}</span>
                          <span className="text-muted-foreground/50 text-xs">— {p.name}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          ${p.remainingCredits.toFixed(2)} remaining &middot; ${p.dailyBurnRate}/day burn rate
                        </div>
                        <Progress value={p.remainingPercent} className={`h-1 mt-2 rounded-full ${p.remainingPercent < 20 ? "[&>div]:bg-red-500" : p.remainingPercent < 50 ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-500"}`} />
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-lg font-bold tabular-nums ${isUrgent ? "text-red-400" : isWarning ? "text-amber-500" : ""}`}>
                          {p.daysLeft >= 999 ? "∞" : `${p.daysLeft}d`}
                        </div>
                        <div className="text-[10px] text-muted-foreground/60">
                          {p.daysLeft >= 999 ? "No estimate" : p.estimatedExhaustion}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "providers" && (
        <Card className="rounded-xl border-border/50 overflow-hidden">
          <CardHeader className="pb-3 px-5 pt-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-brand" />
              Provider Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground">
                    <th className="text-left py-2.5 pr-4 font-medium">Provider</th>
                    <th className="text-right py-2.5 pr-4 font-medium">Today Reqs</th>
                    <th className="text-right py-2.5 pr-4 font-medium">Avg Latency</th>
                    <th className="text-right py-2.5 font-medium">Error Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {providers.map((p) => (
                    <tr key={p.name} className="border-b border-border/30 last:border-0 row-hover-glow">
                      <td className="py-2.5 pr-4 font-medium">{p.name}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{p.totalRequests.toLocaleString()}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">
                        <span className={p.avgLatency < 500 ? "text-emerald-400" : p.avgLatency < 1500 ? "" : "text-amber-500"}>
                          {p.avgLatency}ms
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <Badge variant={p.errorRate < 1 ? "secondary" : "destructive"} className="text-[10px] rounded-md">
                          {p.errorRate}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Logs Table */}
      <Card className="rounded-xl border-border/50 overflow-hidden">
        <CardHeader className="pb-3 px-5 pt-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-brand" />
            Recent Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground">
                  <th className="text-left py-2.5 pr-4 font-medium">Status</th>
                  <th className="text-left py-2.5 pr-4 font-medium">Provider</th>
                  <th className="text-left py-2.5 pr-4 font-medium">Model</th>
                  <th className="text-right py-2.5 pr-4 font-medium">Latency</th>
                  <th className="text-right py-2.5 pr-4 font-medium">Cost</th>
                  <th className="text-left py-2.5 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-border/30 last:border-0 row-hover-glow">
                    <td className="py-2.5 pr-4">
                      <span className={`inline-block w-2 h-2 rounded-full ${log.status === "success" ? "bg-emerald-500" : "bg-red-500"}`} />
                    </td>
                    <td className="py-2.5 pr-4 font-medium">{log.account?.provider?.name || "?"}</td>
                    <td className="py-2.5 pr-4 font-mono text-muted-foreground">{log.model}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{log.latencyMs}ms</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">${log.cost.toFixed(4)}</td>
                    <td className="py-2.5 text-muted-foreground tabular-nums">{new Date(log.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
