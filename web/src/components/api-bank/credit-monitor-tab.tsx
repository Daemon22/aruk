"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Infinity,
} from "lucide-react";

interface Account {
  id: string;
  name: string;
  providerName: string;
  status: string;
  totalCredits: number;
  usedCredits: number;
  creditUnit: string;
  healthScore: number;
  remainingCredits: number;
  remainingPercent: number;
}

function getStatusColor(percent: number, status: string) {
  if (status === "expired" || status === "disabled")
    return { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" };
  if (percent === 100 || percent >= 50)
    return { icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10" };
  if (percent >= 15)
    return { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10" };
  return { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" };
}

function getProgressColor(percent: number) {
  if (percent === 100) return "[&>div]:bg-emerald-500";
  if (percent >= 50) return "[&>div]:bg-emerald-500";
  if (percent >= 15) return "[&>div]:bg-amber-500";
  return "[&>div]:bg-red-500";
}

export function CreditMonitorTab({ refreshKey }: { refreshKey: number }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/credits")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setAccounts(data);
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
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  const sorted = [...accounts].sort((a, b) => {
    if (a.creditUnit === "unlimited" && b.creditUnit !== "unlimited") return -1;
    if (a.creditUnit !== "unlimited" && b.creditUnit === "unlimited") return 1;
    return a.remainingPercent - b.remainingPercent;
  });

  const summary = {
    unlimited: accounts.filter((a) => a.creditUnit === "unlimited").length,
    healthy: accounts.filter(
      (a) => a.creditUnit !== "unlimited" && a.remainingPercent >= 50
    ).length,
    warning: accounts.filter(
      (a) =>
        a.creditUnit !== "unlimited" &&
        a.remainingPercent >= 15 &&
        a.remainingPercent < 50
    ).length,
    critical: accounts.filter(
      (a) => a.creditUnit !== "unlimited" && a.remainingPercent < 15
    ).length,
  };

  const summaryCards = [
    {
      label: "Unlimited",
      value: summary.unlimited,
      icon: Infinity,
      color: "text-emerald-500",
      bg: "bg-emerald-500/8",
    },
    {
      label: "Healthy (50%+)",
      value: summary.healthy,
      icon: CheckCircle,
      color: "text-emerald-500",
      bg: "",
    },
    {
      label: "Warning (15-50%)",
      value: summary.warning,
      icon: AlertTriangle,
      color: "text-amber-500",
      bg: "bg-amber-500/8",
    },
    {
      label: "Critical (<15%)",
      value: summary.critical,
      icon: XCircle,
      color: "text-red-400",
      bg: "bg-red-500/8",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summaryCards.map(({ label, value, icon: Icon, color, bg }, i) => (
          <Card
            key={label}
            className={`rounded-xl border-border/40 card-hover ${bg} overflow-hidden`}
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium mb-2">
                <Icon className={`h-3.5 w-3.5 ${color}`} />
                {label}
              </div>
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Full Monitor List */}
      <Card className="rounded-xl border-border/40 overflow-hidden">
        <CardHeader className="pb-3 px-5 pt-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-brand" />
            All Accounts — Credit Status
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="divide-y divide-border/40">
            {sorted.map((account) => {
              const statusInfo = getStatusColor(
                account.remainingPercent,
                account.status
              );
              const StatusIcon = statusInfo.icon;
              const isCritical =
                account.remainingPercent < 15 &&
                account.creditUnit !== "unlimited";

              return (
                <div
                  key={account.id}
                  className={`flex items-center gap-3 py-3 px-2.5 rounded-lg mx-0.5 transition-all duration-200 hover:bg-muted/30 ${isCritical ? "bg-red-500/5 ring-1 ring-red-500/20" : ""}`}
                >
                  <div
                    className={`p-1.5 rounded-lg ${statusInfo.bg} transition-transform duration-200 group-hover:scale-105`}
                  >
                    <StatusIcon
                      className={`h-3.5 w-3.5 ${statusInfo.color}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium truncate">
                        {account.providerName}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {account.creditUnit === "unlimited" ? (
                          <span className="text-emerald-500 font-semibold">
                            Unlimited
                          </span>
                        ) : (
                          <>
                            <span
                              className={
                                isCritical
                                  ? "text-red-400 font-bold"
                                  : "font-semibold"
                              }
                            >
                              {account.remainingPercent}%
                            </span>
                            <span className="ml-1.5 text-muted-foreground/60 font-normal">
                              ${account.remainingCredits.toFixed(2)} / $
                              {account.totalCredits.toFixed(2)}
                            </span>
                          </>
                        )}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground/60 truncate mt-0.5">
                      {account.name}
                    </div>
                    {account.creditUnit !== "unlimited" && (
                      <Progress
                        value={account.remainingPercent}
                        className={`h-1 mt-2 rounded-full progress-animated ${getProgressColor(account.remainingPercent)}`}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}