"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowDown,
  Zap,
  DollarSign,
  Gauge,
  Award,
  Shuffle,
  ArrowRight,
  Check,
} from "lucide-react";

type Strategy =
  | "best"
  | "fastest"
  | "cheapest"
  | "highest_quality"
  | "round_robin"
  | "load_balance";

interface Decision {
  accountId: string;
  accountName: string;
  providerName: string;
  apiKey: string;
  strategy: string;
  reason: string;
  healthScore: number;
  remainingPercent: number;
}

interface FailoverAccount {
  id: string;
  name: string;
  providerName: string;
  status: string;
  priority: number;
  healthScore: number;
  avgLatencyMs: number;
  creditUnit: string;
  remainingPercent: number;
}

const STRATEGIES: {
  value: Strategy;
  label: string;
  icon: React.ReactNode;
  desc: string;
}[] = [
  {
    value: "best",
    label: "Best Overall",
    icon: <Zap className="h-4 w-4" />,
    desc: "Balances health, credits, and speed",
  },
  {
    value: "fastest",
    label: "Fastest",
    icon: <Gauge className="h-4 w-4" />,
    desc: "Lowest average latency",
  },
  {
    value: "cheapest",
    label: "Cheapest",
    icon: <DollarSign className="h-4 w-4" />,
    desc: "Lowest cost per request",
  },
  {
    value: "highest_quality",
    label: "Highest Quality",
    icon: <Award className="h-4 w-4" />,
    desc: "Best success rate and reliability",
  },
  {
    value: "round_robin",
    label: "Round Robin",
    icon: <Shuffle className="h-4 w-4" />,
    desc: "Distribute evenly across keys",
  },
  {
    value: "load_balance",
    label: "Load Balance",
    icon: <ArrowDown className="h-4 w-4" />,
    desc: "Use least loaded key",
  },
];

export function RoutingTab({
  refreshKey,
  onRefresh,
}: {
  refreshKey: number;
  onRefresh: () => void;
}) {
  const [strategy, setStrategy] = useState<Strategy>("best");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [failover, setFailover] = useState<FailoverAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [routing, setRouting] = useState(false);

  const loadFailover = useCallback(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(({ failover }) => setFailover(failover))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadFailover();
  }, [loadFailover, refreshKey]);

  const requestRoute = async () => {
    setRouting(true);
    try {
      const res = await fetch(`/api/routing?strategy=${strategy}`);
      const data = await res.json();
      if (data.error) {
        setDecision(null);
      } else {
        setDecision(data);
      }
    } finally {
      setRouting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Strategy Selector + Route Button */}
      <Card className="rounded-xl border-border/50 overflow-hidden">
        <CardHeader className="pb-3 px-5 pt-4">
          <CardTitle className="text-sm font-semibold">Smart Router</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Ask the bank which provider to use. Instead of hardcoding a
            provider, the bank selects the best available key based on your
            strategy.
          </p>

          {/* Strategy Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {STRATEGIES.map((s) => (
              <button
                key={s.value}
                onClick={() => setStrategy(s.value)}
                className={`text-left p-3 rounded-xl border transition-all duration-300 ease-out ${
                  strategy === s.value
                    ? "border-brand/60 bg-brand-muted shadow-sm shadow-brand/15 ring-1 ring-brand/30 glow-brand scale-[1.02]"
                    : "border-border/40 hover:border-border/50 hover:bg-muted/25 hover:scale-[1.01] hover:shadow-sm"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="font-medium text-sm flex items-center gap-2">
                    <span
                      className={
                        strategy === s.value ? "text-brand" : "text-muted-foreground"
                      }
                    >
                      {s.icon}
                    </span>
                    {s.label}
                  </div>
                  {strategy === s.value && (
                    <div className="h-5 w-5 rounded-full bg-brand flex items-center justify-center">
                      <Check className="h-3 w-3 text-brand-foreground" />
                    </div>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground leading-relaxed">
                  {s.desc}
                </div>
              </button>
            ))}
          </div>

          {/* Route Button */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Strategy:</span>
              <Badge
                variant="outline"
                className="font-semibold border-brand/30 text-brand"
              >
                {STRATEGIES.find((s) => s.value === strategy)?.label}
              </Badge>
            </div>
            <Button
              onClick={requestRoute}
              disabled={routing}
              className="gap-2 h-9 rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              {routing ? "Routing..." : "Get Best Provider"}
            </Button>
          </div>

          {/* Decision Result */}
          {decision && (
            <div className="mt-2 p-4 rounded-xl border border-brand/30 bg-brand-muted/30 space-y-3 animate-fade-in-up shadow-[0_0_40px_-10px_var(--glow-strong)] gradient-border">
              <div className="text-[10px] font-bold text-brand uppercase tracking-widest">
                Routing Decision
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  {
                    label: "Provider",
                    value: decision.providerName,
                    accent: true,
                  },
                  { label: "Account", value: decision.accountName },
                  { label: "API Key", value: decision.apiKey.slice(0, 12) + "····", mono: true },
                  { label: "Health", value: `${decision.healthScore}°` },
                  { label: "Credits", value: `${decision.remainingPercent}%` },
                  {
                    label: "Strategy",
                    value: decision.strategy,
                    badge: true,
                  },
                ].map(({ label, value, accent, mono, badge }) => (
                  <div key={label}>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                      {label}
                    </div>
                    {badge ? (
                      <Badge
                        variant="outline"
                        className="text-xs border-brand/30 text-brand"
                      >
                        {value}
                      </Badge>
                    ) : (
                      <div
                        className={`text-sm font-semibold ${accent ? "text-brand" : ""} ${mono ? "font-mono text-xs" : ""}`}
                      >
                        {value}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-muted-foreground pt-2 border-t border-brand/10 leading-relaxed">
                {decision.reason}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Failover Chain */}
      <Card className="rounded-xl border-border/50 overflow-hidden">
        <CardHeader className="pb-3 px-5 pt-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ArrowDown className="h-4 w-4 text-brand" />
            Automatic Failover Chain
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {loading ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : (
            <div className="space-y-0">
              {failover.map((account, i) => (
                <div key={account.id} className="flex gap-3.5 items-start">
                  {/* Step indicator with connecting line */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors ${
                        account.status === "active"
                          ? i === 0
                            ? "bg-brand text-white glow-brand"
                            : "bg-brand/15 text-brand border border-brand/30"
                          : "bg-muted text-muted-foreground border border-border/50"
                      }`}
                    >
                      {i + 1}
                    </div>
                    {i < failover.length - 1 && (
                      <div className="w-px h-10 bg-gradient-to-b from-border/80 via-border/40 to-border/20 my-1" />
                    )}
                  </div>

                  {/* Account info */}
                  <div
                    className={`flex-1 pb-5 ${i === failover.length - 1 ? "pb-0" : ""}`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">
                        {account.providerName}
                      </span>
                      <span className="text-muted-foreground/50 text-xs">
                        —
                      </span>
                      <span className="text-sm">{account.name}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] h-5 rounded-md font-medium ${account.status === "active" ? "border-brand/30 text-brand bg-brand-muted" : "border-border text-muted-foreground bg-muted/30"}`}
                      >
                        {account.status}
                      </Badge>
                    </div>
                    <div className="flex gap-5 text-xs text-muted-foreground mt-1.5">
                      <span>
                        Health:{" "}
                        <span
                          className={
                            account.healthScore >= 80
                              ? "text-emerald-500 font-medium"
                              : account.healthScore >= 50
                                ? "text-amber-500 font-medium"
                                : "text-red-400 font-medium"
                          }
                        >
                          {account.healthScore}°
                        </span>
                      </span>
                      <span>
                        Credits:{" "}
                        {account.creditUnit === "unlimited" ? (
                          <span className="text-emerald-500 font-medium">
                            Unlimited
                          </span>
                        ) : (
                          <span>{account.remainingPercent}%</span>
                        )}
                      </span>
                      <span>{account.avgLatencyMs}ms</span>
                      <span className="text-muted-foreground/60">
                        Priority {account.priority}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}