"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Database, LockKeyhole, RefreshCw, Server, ShieldAlert, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { SessionStatus, SystemHealth, SystemStats } from "@/lib/ui-contracts";

type LoadState<T> =
  | { status: "pending"; data: null; error: null }
  | { status: "success"; data: T; error: null }
  | { status: "failure"; data: null; error: string };

interface SystemStatusProps {
  refreshKey: number;
}

function initialState<T>(): LoadState<T> {
  return { status: "pending", data: null, error: null };
}

async function readJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      typeof payload?.error === "string" ? payload.error : `Request failed (${response.status})`,
    );
  }
  return payload as T;
}

function StatusBadge({ state, label }: { state: "good" | "bad" | "pending"; label: string }) {
  const styles = {
    good: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    bad: "border-red-500/30 bg-red-500/10 text-red-400",
    pending: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  };
  const Icon = state === "good" ? CheckCircle2 : state === "bad" ? XCircle : RefreshCw;
  return (
    <Badge variant="outline" className={`gap-1.5 ${styles[state]}`}>
      <Icon className={`h-3 w-3 ${state === "pending" ? "animate-spin" : ""}`} />
      {label}
    </Badge>
  );
}

export function SystemStatus({ refreshKey }: SystemStatusProps) {
  const [health, setHealth] = useState<LoadState<SystemHealth>>(initialState);
  const [session, setSession] = useState<LoadState<SessionStatus>>(initialState);
  const [stats, setStats] = useState<LoadState<SystemStats>>(initialState);

  useEffect(() => {
    let cancelled = false;
    setHealth(initialState());
    setSession(initialState());
    setStats(initialState());

    const load = async <T,>(
      path: string,
      setter: (state: LoadState<T>) => void,
    ) => {
      try {
        const data = await readJson<T>(path);
        if (!cancelled) setter({ status: "success", data, error: null });
      } catch (error) {
        if (!cancelled) {
          setter({
            status: "failure",
            data: null,
            error: error instanceof Error ? error.message : "Request failed",
          });
        }
      }
    };

    void load<SystemHealth>("/api/health", setHealth);
    void load<SessionStatus>("/api/session", setSession);
    void load<SystemStats>("/api/stats", setStats);

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const healthState = health.status === "pending"
    ? "pending"
    : health.status === "success" && health.data.status === "healthy"
      ? "good"
      : "bad";
  const authState = session.status === "pending"
    ? "pending"
    : session.status === "success" && session.data.authenticated
      ? "good"
      : "bad";
  const dataState = stats.status === "pending"
    ? "pending"
    : stats.status === "success" ? "good" : "bad";

  return (
    <section aria-label="Aruk system status" className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="rounded-xl border-border/40">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Server className="h-4 w-4 text-brand" />
              <div>
                <p className="text-xs font-medium">Core service</p>
                <p className="text-[11px] text-muted-foreground">Runtime and database heartbeat</p>
              </div>
            </div>
            <StatusBadge
              state={healthState}
              label={health.status === "success" ? health.data.status : health.status === "failure" ? "Unavailable" : "Checking"}
            />
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/40">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <LockKeyhole className="h-4 w-4 text-brand" />
              <div>
                <p className="text-xs font-medium">Security session</p>
                <p className="text-[11px] text-muted-foreground">
                  {session.status === "success" && session.data.authenticated
                    ? session.data.user?.email
                    : "Authentication is required"}
                </p>
              </div>
            </div>
            <StatusBadge
              state={authState}
              label={session.status === "success" && session.data.authenticated ? "Authenticated" : session.status === "pending" ? "Checking" : "Unauthenticated"}
            />
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/40">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Database className="h-4 w-4 text-brand" />
              <div>
                <p className="text-xs font-medium">Authoritative state</p>
                <p className="text-[11px] text-muted-foreground">
                  {stats.status === "success"
                    ? `${stats.data.stats.totalAccounts} accounts · ${stats.data.stats.todayRequests} requests today`
                    : stats.status === "failure" ? stats.error : "Reading core state"}
                </p>
              </div>
            </div>
            <StatusBadge state={dataState} label={dataState === "good" ? "Live" : dataState === "pending" ? "Checking" : "Unavailable"} />
          </CardContent>
        </Card>
      </div>

      {(health.status === "failure" || session.status === "failure" || stats.status === "failure" || (session.status === "success" && !session.data.authenticated)) && (
        <Card className="rounded-xl border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            {session.status === "success" && !session.data.authenticated ? (
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            )}
            <div className="flex-1">
              <p className="text-xs font-medium">
                {session.status === "success" && !session.data.authenticated
                  ? "Aruk is not authenticated"
                  : "Some core state is unavailable"}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {session.status === "success" && !session.data.authenticated
                  ? "Protected operations remain unavailable until the core establishes a session."
                  : "The UI is showing the failure instead of substituting local or simulated values."}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="gap-1.5">
              <RefreshCw className="h-3 w-3" /> Retry
            </Button>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
