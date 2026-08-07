"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewTab } from "@/components/api-bank/overview-tab";
import { AccountsTab } from "@/components/api-bank/accounts-tab";
import { RoutingTab } from "@/components/api-bank/routing-tab";
import { AnalyticsTab } from "@/components/api-bank/analytics-tab";
import { CreditMonitorTab } from "@/components/api-bank/credit-monitor-tab";
import { CLITab } from "@/components/api-bank/cli-tab";
import { Button } from "@/components/ui/button";
import { RefreshCw, Terminal, Package, Globe } from "lucide-react";

export default function ApiBankDashboard() {
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <Package className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">API Bank</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Central API Key Management & Intelligent Routing</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refresh} className="gap-1.5 text-xs">
              <RefreshCw className="h-3 w-3" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full sm:w-auto flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
            <TabsTrigger value="overview" className="text-xs sm:text-sm gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="accounts" className="text-xs sm:text-sm gap-1.5">
              <Package className="h-3.5 w-3.5" />
              Accounts
            </TabsTrigger>
            <TabsTrigger value="credits" className="text-xs sm:text-sm gap-1.5">
              💰 Credits
            </TabsTrigger>
            <TabsTrigger value="routing" className="text-xs sm:text-sm gap-1.5">
              ↔ Routing
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs sm:text-sm gap-1.5">
              📊 Analytics
            </TabsTrigger>
            <TabsTrigger value="cli" className="text-xs sm:text-sm gap-1.5">
              <Terminal className="h-3.5 w-3.5" />
              CLI & SDK
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <OverviewTab refreshKey={refreshKey} />
          </TabsContent>
          <TabsContent value="accounts" className="mt-6">
            <AccountsTab refreshKey={refreshKey} onRefresh={refresh} />
          </TabsContent>
          <TabsContent value="credits" className="mt-6">
            <CreditMonitorTab refreshKey={refreshKey} />
          </TabsContent>
          <TabsContent value="routing" className="mt-6">
            <RoutingTab refreshKey={refreshKey} onRefresh={refresh} />
          </TabsContent>
          <TabsContent value="analytics" className="mt-6">
            <AnalyticsTab refreshKey={refreshKey} />
          </TabsContent>
          <TabsContent value="cli" className="mt-6">
            <CLITab />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t py-3 text-center text-xs text-muted-foreground mt-auto">
        API Bank — Headless by default. Web is just one interface.
      </footer>
    </div>
  );
}