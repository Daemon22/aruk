"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "next-themes";
import {
  RefreshCw,
  Terminal,
  ShieldCheck,
  Sun,
  Moon,
  Activity,
  Play,
  CreditCard,
  Route,
  BarChart3,
  TrendingUp,
  Lock,
} from "lucide-react";
import { io } from "socket.io-client";
import { OverviewTab } from "@/components/api-bank/overview-tab";
import { AccountsTab } from "@/components/api-bank/accounts-tab";
import { RoutingTab } from "@/components/api-bank/routing-tab";
import { CreditMonitorTab } from "@/components/api-bank/credit-monitor-tab";
import { AnalyticsTab } from "@/components/api-bank/analytics-tab";
import { CLITab } from "@/components/api-bank/cli-tab";
import { SimulateTab } from "@/components/api-bank/simulate-tab";
import { VaultTab } from "@/components/api-bank/vault-tab";

const TAB_KEYS = [
  "overview",
  "accounts",
  "vault",
  "credits",
  "routing",
  "analytics",
  "simulate",
  "cli",
] as const;

const TAB_CONFIG = [
  { value: "overview", label: "Overview", icon: ShieldCheck },
  { value: "accounts", label: "Accounts", icon: CreditCard },
  { value: "vault", label: "Vault", icon: Lock },
  { value: "credits", label: "Credits", icon: BarChart3 },
  { value: "routing", label: "Routing", icon: Route },
  { value: "analytics", label: "Analytics", icon: TrendingUp },
  { value: "simulate", label: "Simulate", icon: Activity },
  { value: "cli", label: "CLI & SDK", icon: Terminal },
] as const;

function formatNumber(n: number): string {
  if (n >= 1_000_000)
    return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString();
}

export default function Home() {
  const { theme, setTheme } = useTheme();
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [wsConnected, setWsConnected] = useState(false);
  const [liveStats, setLiveStats] = useState<{
    totalRequests?: number;
    [key: string]: unknown;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  // ── WebSocket connection ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const socket = io("/?XTransformPort=3003");

    socket.on("connect", () => {
      if (cancelled) return;
      setWsConnected(true);
    });

    socket.on("disconnect", () => {
      if (cancelled) return;
      setWsConnected(false);
    });

    socket.on(
      "stats",
      (data: { totalRequests?: number; [key: string]: unknown }) => {
        if (cancelled) return;
        setLiveStats(data as typeof liveStats);
        setRefreshKey((k) => k + 1);
      }
    );

    return () => {
      cancelled = true;
      socket.disconnect();
    };
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const key = e.key.toLowerCase();
      const num = parseInt(key, 10);
      if (num >= 1 && num <= 8 && TAB_KEYS[num - 1]) {
        setActiveTab(TAB_KEYS[num - 1]);
        return;
      }

      if (key === "r") {
        e.preventDefault();
        refresh();
        return;
      }

      if (key === "d") {
        e.preventDefault();
        setTheme(theme === "dark" ? "light" : "dark");
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [refresh, theme, setTheme]);

  const requestCount = liveStats?.totalRequests ?? 0;

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 glass-strong border-b border-border/50 dark:border-border/25 relative overflow-hidden">
        {/* Animated bottom glow line */}
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent transition-opacity duration-500" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          {/* Left: Logo + Brand */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative h-10 w-10 rounded-xl overflow-hidden shrink-0 shadow-lg ring-1 ring-brand/25 transition-all duration-500 hover:ring-brand/50 hover:shadow-[0_0_24px_var(--glow-strong)] hover:scale-105">
              <img
                src="/logo.png"
                alt="Aruk"
                width={40}
                height={40}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold tracking-tight leading-none">
                <span className="text-gradient-strong">Aruk</span>
              </h1>
              <p className="text-[11px] text-muted-foreground hidden sm:block truncate mt-0.5">
                Keeper of secrets and keys
              </p>
            </div>

            {/* Live indicator */}
            <div className="hidden md:flex items-center gap-2 ml-3 px-2.5 py-1 rounded-full bg-muted/40 text-[11px] font-medium border border-border/40 backdrop-blur-sm">
              {wsConnected ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="text-emerald-500">LIVE</span>
                </>
              ) : (
                <>
                  <span className="inline-flex rounded-full h-2 w-2 bg-zinc-500/60" />
                  <span className="text-zinc-500">OFFLINE</span>
                </>
              )}
              {requestCount > 0 && (
                <span className="text-muted-foreground ml-0.5">
                  {formatNumber(requestCount)} reqs
                </span>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Mobile live indicator */}
            <div className="md:hidden flex items-center gap-1.5 mr-0.5 px-2 py-1 rounded-full bg-muted/40 text-[10px] font-medium border border-border/40 backdrop-blur-sm">
              {wsConnected ? (
                <>
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                  </span>
                  <span className="text-emerald-500">LIVE</span>
                </>
              ) : (
                <>
                  <span className="inline-flex rounded-full h-1.5 w-1.5 bg-zinc-500/60" />
                  <span className="text-zinc-500">OFF</span>
                </>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab("simulate")}
              className="gap-1.5 text-xs text-brand hover:text-brand hover:bg-brand-muted hover:shadow-[0_0_12px_var(--glow)] transition-all duration-300"
            >
              <Play className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Simulate</span>
            </Button>

            <div className="w-px h-5 bg-border/60 mx-0.5" />

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:rotate-12 transition-all duration-300"
              onClick={() =>
                setTheme(theme === "dark" ? "light" : "dark")
              }
              aria-label="Toggle dark mode"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground active:scale-90 transition-transform"
              onClick={refresh}
              aria-label="Refresh"
            >
              <RefreshCw className={"h-3.5 w-3.5 transition-transform duration-500" + (refreshing ? " animate-spin" : " hover:rotate-180")} />
            </Button>
          </div>
        </div>
      </header>

      {/* ── Main Content ────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-5">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="w-full sm:w-auto flex flex-wrap h-auto gap-0.5 bg-muted/25 p-1.5 rounded-xl border border-border/25 dark:border-border/12 backdrop-blur-md">
            {TAB_CONFIG.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="text-xs sm:text-sm gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground data-[state=active]:font-medium"
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="mt-5">
            <TabsContent value="overview" className="mt-0">
              <OverviewTab refreshKey={refreshKey} />
            </TabsContent>
            <TabsContent value="accounts" className="mt-0">
              <AccountsTab refreshKey={refreshKey} onRefresh={refresh} />
            </TabsContent>
            <TabsContent value="vault" className="mt-0">
              <VaultTab refreshKey={refreshKey} onRefresh={refresh} />
            </TabsContent>
            <TabsContent value="credits" className="mt-0">
              <CreditMonitorTab refreshKey={refreshKey} />
            </TabsContent>
            <TabsContent value="routing" className="mt-0">
              <RoutingTab refreshKey={refreshKey} onRefresh={refresh} />
            </TabsContent>
            <TabsContent value="analytics" className="mt-0">
              <AnalyticsTab refreshKey={refreshKey} />
            </TabsContent>
            <TabsContent value="simulate" className="mt-0">
              <SimulateTab />
            </TabsContent>
            <TabsContent value="cli" className="mt-0">
              <CLITab />
            </TabsContent>
          </div>
        </Tabs>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-border/15 py-3 text-center text-[11px] text-muted-foreground/50 mt-auto relative backdrop-blur-sm bg-background/60">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-border/30 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-1.5">
          <span className="flex items-center gap-1.5">
            <img src="/logo.png" alt="" width={14} height={14} className="rounded opacity-50 hover:opacity-80 transition-opacity duration-300" />
            <span>Aruk</span>
            <span className="text-muted-foreground/30">—</span>
            <span className="text-muted-foreground/40">Headless by default</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-muted/40 border border-border/25 text-[9px] font-mono text-muted-foreground/60">1-8</kbd>
            <span className="hidden sm:inline text-muted-foreground/40">navigate</span>
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-muted/40 border border-border/25 text-[9px] font-mono text-muted-foreground/60">R</kbd>
            <span className="hidden sm:inline text-muted-foreground/40">refresh</span>
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-muted/40 border border-border/25 text-[9px] font-mono text-muted-foreground/60">D</kbd>
            <span className="hidden sm:inline text-muted-foreground/40">theme</span>
          </span>
        </div>
      </footer>
    </div>
  );
}