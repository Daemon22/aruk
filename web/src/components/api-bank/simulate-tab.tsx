"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Play, Square, Activity, Trash2, Zap } from "lucide-react";

type Strategy =
  | "best"
  | "fastest"
  | "cheapest"
  | "highest_quality"
  | "round_robin"
  | "load_balance";

const STRATEGIES: { value: Strategy; label: string }[] = [
  { value: "best", label: "Best Overall" },
  { value: "fastest", label: "Fastest" },
  { value: "cheapest", label: "Cheapest" },
  { value: "highest_quality", label: "Highest Quality" },
  { value: "round_robin", label: "Round Robin" },
  { value: "load_balance", label: "Load Balance" },
];

interface RoutingLogEntry {
  timestamp: string;
  providerName: string;
  accountName: string;
  strategy: string;
  status: string;
}

interface SimResult {
  routed: number;
  failed: number;
  details?: RoutingLogEntry[];
}

export function SimulateTab() {
  const [count, setCount] = useState(50);
  const [strategy, setStrategy] = useState<Strategy>("best");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SimResult | null>(null);
  const [continuous, setContinuous] = useState(false);
  const [log, setLog] = useState<RoutingLogEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const runSimulation = useCallback(async (reqCount: number, reqStrategy: Strategy) => {
    let cancelled = false;
    setRunning(true);
    setProgress(0);

    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: reqCount, strategy: reqStrategy }),
      });
      const data: SimResult = await res.json();

      if (!cancelled) {
        setResult(data);
        setProgress(100);

        if (data.details && data.details.length > 0) {
          setLog((prev) => {
            const next = [...prev, ...data.details!];
            return next.slice(-50);
          });
        }
      }
    } catch {
      if (!cancelled) {
        setProgress(0);
      }
    } finally {
      if (!cancelled) {
        setRunning(false);
      }
    }
  }, []);

  const handleRunSimulation = () => {
    runSimulation(count, strategy);
  };

  useEffect(() => {
    if (continuous) {
      runSimulation(5, strategy);
      intervalRef.current = setInterval(() => {
        runSimulation(5, strategy);
      }, 2000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [continuous, strategy, runSimulation]);

  const handleClearLog = () => {
    setLog([]);
  };

  function statusDot(status: string) {
    if (status === "success" || status === "routed") {
      return <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />;
    }
    if (status === "failed" || status === "error") {
      return <span className="inline-block h-2 w-2 rounded-full bg-red-500 shrink-0 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />;
    }
    if (status === "fallback" || status === "retry") {
      return <span className="inline-block h-2 w-2 rounded-full bg-amber-500 shrink-0 shadow-[0_0_6px_rgba(245,158,11,0.4)]" />;
    }
    return <span className="inline-block h-2 w-2 rounded-full bg-zinc-600 shrink-0" />;
  }

  return (
    <div className="space-y-5">
      {/* Traffic Simulator */}
      <Card className="rounded-xl border-border/50 overflow-hidden">
        <CardHeader className="pb-3 px-5 pt-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-brand" />
            Traffic Simulator
          </CardTitle>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Watch the bank route requests in real-time across your providers
          </p>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="space-y-1.5">
              <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                Requests
              </label>
              <Input
                type="number"
                min={1}
                max={500}
                value={count}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v >= 1 && v <= 500) setCount(v);
                }}
                className="w-32 h-9 text-sm rounded-lg bg-muted/30 border-border/50"
                disabled={running || continuous}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                Strategy
              </label>
              <Select
                value={strategy}
                onValueChange={(v) => setStrategy(v as Strategy)}
                disabled={running}
              >
                <SelectTrigger className="sm:w-48 h-9 text-sm rounded-lg bg-muted/30 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STRATEGIES.map((s) => (
                    <SelectItem key={s.value} value={s.value} className="text-sm">
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleRunSimulation}
              disabled={running || continuous || count < 1}
              className="gap-2 h-9 rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground"
            >
              <Play className="h-3.5 w-3.5" />
              {running ? "Running..." : "Run Simulation"}
            </Button>
            <Button
              variant={continuous ? "destructive" : "outline"}
              onClick={() => setContinuous((prev) => !prev)}
              disabled={running}
              className="gap-2 h-9 rounded-lg"
            >
              {continuous ? (
                <>
                  <Square className="h-3.5 w-3.5" />
                  Stop
                </>
              ) : (
                <>
                  <Activity className="h-3.5 w-3.5" />
                  Continuous
                </>
              )}
            </Button>
          </div>

          {/* Progress */}
          {(running || progress > 0) && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span className="tabular-nums">{progress}%</span>
              </div>
              <Progress
                value={progress}
                className={`h-1.5 rounded-full ${progress === 100 ? "[&>div]:bg-emerald-500" : "[&>div]:bg-brand"}`}
              />
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-2 mt-2 animate-fade-in-up">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Simulation Results
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    label: "Total",
                    value: (result.routed ?? 0) + (result.failed ?? 0),
                    color: "",
                  },
                  {
                    label: "Routed",
                    value: result.routed ?? 0,
                    color: "text-emerald-500",
                  },
                  {
                    label: "Failed",
                    value: result.failed ?? 0,
                    color: "text-red-400",
                  },
                  {
                    label: "Success Rate",
                    value:
                      result.routed + result.failed > 0
                        ? `${(((result.routed ?? 0) / (result.routed + result.failed)) * 100).toFixed(1)}%`
                        : "—",
                    color:
                      result.routed + result.failed > 0 &&
                      result.routed / (result.routed + result.failed) >= 0.95
                        ? "text-emerald-500"
                        : "",
                  },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    className="rounded-xl border border-border/50 p-3 space-y-1 bg-muted/20"
                  >
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {label}
                    </div>
                    <div className={`text-xl font-bold tabular-nums ${color}`}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live Routing Log */}
      <Card className="rounded-xl border-border/50 overflow-hidden">
        <CardHeader className="pb-3 px-5 pt-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-brand" />
              Live Routing Log
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearLog}
              className="gap-1.5 text-muted-foreground hover:text-destructive h-7 text-[11px]"
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="bg-zinc-950 text-zinc-100 rounded-xl p-4 h-80 overflow-y-auto font-mono text-xs space-y-0.5 ring-1 ring-white/[0.06] shadow-[inset_0_2px_4px_rgba(0,0,0,0.3),0_0_40px_-10px_var(--glow)]">
            {log.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-600">
              <div className="relative mb-4 breathe-glow">
                <div className="w-14 h-14 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-inner">
                  <Activity className="h-6 w-6 text-zinc-600" />
                </div>
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-zinc-800 border border-zinc-700 animate-pulse shadow-[0_0_8px_rgba(113,113,122,0.3)]" />
              </div>
              <p className="text-sm font-medium text-zinc-500 mb-1">Waiting for routing events</p>
              <p className="text-xs text-zinc-700">Run a simulation above to see live decisions stream here</p>
            </div>
            ) : (
              log.map((entry, i) => (
                <div
                  key={`${entry.timestamp}-${i}`}
                  className="flex items-center gap-2 py-1 px-1.5 rounded-md hover:bg-zinc-900/60 transition-colors"
                >
                  {statusDot(entry.status)}
                  <span className="text-zinc-600 shrink-0 tabular-nums w-16">
                    {entry.timestamp}
                  </span>
                  <span className="text-emerald-400 shrink-0 font-medium">
                    {entry.providerName}
                  </span>
                  <span className="text-zinc-400 truncate">
                    {entry.accountName}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[9px] h-4 px-1.5 border-zinc-800 text-zinc-500 shrink-0 ml-auto rounded font-mono"
                  >
                    {entry.strategy}
                  </Badge>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}