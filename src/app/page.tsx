"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "next-themes";
import {
  RefreshCw,
  Sun,
  Moon,
  ShieldCheck,
  Lock,
  GitBranch,
  Ticket,
  ScrollText,
  ShieldAlert,
  Fingerprint,
  Cloud,
  ArrowRightLeft,
  User,
} from "lucide-react";

import { OverviewTab } from "@/components/api-bank/overview-tab";
import { VaultTab } from "@/components/api-bank/vault-tab";
import { LineageTab } from "@/components/api-bank/lineage-tab";
import { PassesTab } from "@/components/api-bank/passes-tab";
import { PoliciesTab } from "@/components/api-bank/policies-tab";
import { AuditTab } from "@/components/api-bank/audit-tab";
import { PerimeterTab } from "@/components/api-bank/perimeter-tab";
import { CloudsTab } from "@/components/api-bank/clouds-tab";
import { PassageTab } from "@/components/api-bank/passage-tab";

const TAB_KEYS = [
  "overview",
  "vault",
  "lineage",
  "passes",
  "policies",
  "perimeter",
  "audit",
  "clouds",
  "passage",
] as const;

const TAB_CONFIG = [
  { value: "overview",  label: "Overview",  icon: ShieldCheck },
  { value: "vault",     label: "Vault",     icon: Lock },
  { value: "lineage",   label: "Lineage",   icon: GitBranch },
  { value: "passes",    label: "Passes",    icon: Ticket },
  { value: "policies",  label: "Policies",  icon: Fingerprint },
  { value: "perimeter", label: "Perimeter", icon: ShieldAlert },
  { value: "audit",     label: "Audit",     icon: ScrollText },
  { value: "clouds",    label: "Clouds",    icon: Cloud },
  { value: "passage",   label: "Passage",   icon: ArrowRightLeft },
] as const;

export default function Home() {
  const { theme, setTheme } = useTheme();
  const user = { id: 'dev', email: 'dev@aruk.local', name: 'Dev' };
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  // ── Keyboard shortcuts ──────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const key = e.key.toLowerCase();
      const num = parseInt(key, 10);
      if (num >= 1 && num <= TAB_KEYS.length) {
        setActiveTab(TAB_KEYS[num - 1]);
        return;
      }
      if (key === "r") { e.preventDefault(); refresh(); }
      if (key === "d") { e.preventDefault(); setTheme(theme === "dark" ? "light" : "dark"); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [refresh, theme, setTheme]);

  // ── Dashboard ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 glass-strong border-b border-border/50 dark:border-border/25 relative overflow-hidden">
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent transition-opacity duration-500" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative h-10 w-10 rounded-xl overflow-hidden shrink-0 shadow-lg ring-1 ring-brand/25 transition-all duration-500 hover:ring-brand/50 hover:shadow-[0_0_24px_var(--glow-strong)] hover:scale-105">
              <img src="/logo.png" alt="Aruk" width={40} height={40} className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold tracking-tight leading-none">
                <span className="text-gradient-strong">Aruk</span>
              </h1>
              <p className="text-[11px] text-muted-foreground hidden sm:block truncate mt-0.5">
                The immovable protective perimeter
              </p>
            </div>
            <div className="hidden md:flex items-center gap-2 ml-3 px-2.5 py-1 rounded-full bg-muted/40 text-[11px] font-medium border border-border/40 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-emerald-500">GATE ACTIVE</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <div className="md:hidden flex items-center gap-1.5 mr-0.5 px-2 py-1 rounded-full bg-muted/40 text-[10px] font-medium border border-border/40 backdrop-blur-sm">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <span className="text-emerald-500">LIVE</span>
            </div>

            {/* User menu */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted/30 border border-border/30">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground max-w-[120px] truncate hidden sm:inline">{user.name}</span>

            </div>

            <div className="w-px h-5 bg-border/60 mx-0.5" />

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:rotate-12 transition-all duration-300"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle dark mode"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
            <TabsContent value="vault" className="mt-0">
              <VaultTab refreshKey={refreshKey} onRefresh={refresh} />
            </TabsContent>
            <TabsContent value="lineage" className="mt-0">
              <LineageTab refreshKey={refreshKey} />
            </TabsContent>
            <TabsContent value="passes" className="mt-0">
              <PassesTab refreshKey={refreshKey} />
            </TabsContent>
            <TabsContent value="policies" className="mt-0">
              <PoliciesTab refreshKey={refreshKey} />
            </TabsContent>
            <TabsContent value="perimeter" className="mt-0">
<<<<<<< HEAD
              <PerimeterTab refreshKey={refreshKey} />
=======
              <PerimeterTab refreshKey={refreshKey} onRefresh={refresh} />
>>>>>>> 193e563eec90177528092e21ed6ea88aad226193
            </TabsContent>
            <TabsContent value="audit" className="mt-0">
              <AuditTab refreshKey={refreshKey} />
            </TabsContent>
            <TabsContent value="clouds" className="mt-0">
              <CloudsTab refreshKey={refreshKey} />
            </TabsContent>
            <TabsContent value="passage" className="mt-0">
<<<<<<< HEAD
              <PassageTab refreshKey={refreshKey} />
=======
              <PassageTab refreshKey={refreshKey} onRefresh={refresh} />
>>>>>>> 193e563eec90177528092e21ed6ea88aad226193
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
            <span className="text-muted-foreground/40">The gate holds</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-muted/40 border border-border/25 text-[9px] font-mono text-muted-foreground/60">1-9</kbd>
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