"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Power,
  Trash2,
  Eye,
  EyeOff,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  X,
  Pencil,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Types ──────────────────────────────────────────────────

interface Account {
  id: string;
  name: string;
  providerName: string;
  apiKey: string;
  status: string;
  priority: number;
  totalCredits: number;
  usedCredits: number;
  creditUnit: string;
  healthScore: number;
  avgLatencyMs: number;
  successRate: number;
  totalRequests: number;
  todayRequests: number;
  errorCount: number;
  lastUsedAt: string | null;
  remainingCredits: number;
  remainingPercent: number;
}

// ─── Helpers ────────────────────────────────────────────────

function healthColor(score: number) {
  if (score >= 80) return "text-emerald-500";
  if (score >= 50) return "text-amber-500";
  return "text-red-400";
}

function healthBg(score: number) {
  if (score >= 80) return "bg-emerald-500/5";
  if (score >= 50) return "bg-amber-500/5";
  return "bg-red-500/5";
}

function statusBorder(status: string) {
  switch (status) {
    case "active": return "border-l-[3px] border-l-emerald-500";
    case "backup": return "border-l-[3px] border-l-blue-400";
    case "expired": return "border-l-[3px] border-l-red-400";
    default: return "border-l-[3px] border-l-zinc-500";
  }
}

function statusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
      return "default";
    case "backup":
      return "secondary";
    case "expired":
      return "destructive";
    default:
      return "outline";
  }
}

function statusColor(status: string) {
  switch (status) {
    case "active":
      return "bg-emerald-500 text-white border-0";
    case "backup":
      return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    case "expired":
      return "bg-red-500/15 text-red-400 border-red-500/30";
    default:
      return "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
  }
}

function HealthStars({ score }: { score: number }) {
  const stars = 5;
  const filled = Math.round((score / 100) * stars);
  return (
    <span className="text-[10px] tracking-wider opacity-70">
      {"★".repeat(filled)}
      {"☆".repeat(stars - filled)}
    </span>
  );
}

function countKeys(keysText: string): number {
  return keysText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean).length;
}

// ─── Single Account Card ────────────────────────────────────

function AccountCard({
  account,
  showKey,
  onToggleKey,
  onToggleStatus,
  onDelete,
  onEdit,
}: {
  account: Account;
  showKey: boolean;
  onToggleKey: (id: string) => void;
  onToggleStatus: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (account: Account) => void;
}) {
  return (
    <Card
      className={`rounded-xl border-border/40 overflow-hidden card-hover border-l-[3px] ${statusBorder(account.status)}`}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Left: Name + Key */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm truncate">{account.name}</h3>
              <Badge
                variant={statusVariant(account.status)}
                className={`text-[10px] h-5 rounded-md font-medium ${statusColor(account.status)}`}
              >
                {account.status}
              </Badge>
            </div>
            <div className="text-[11px] font-mono text-muted-foreground/70 flex items-center gap-1.5">
              <span>
                {showKey ? account.apiKey : "••••••••••••••••"}
              </span>
              <button
                onClick={() => onToggleKey(account.id)}
                className="text-muted-foreground/50 hover:text-foreground transition-colors"
              >
                {showKey ? (
                  <EyeOff className="h-3 w-3" />
                ) : (
                  <Eye className="h-3 w-3" />
                )}
              </button>
            </div>
          </div>

          {/* Middle: Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2.5 text-xs shrink-0">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                Health
              </div>
              <div className={`font-bold tabular-nums ${healthColor(account.healthScore)}`}>
                {account.healthScore}
                <span className="text-[10px] font-normal">°</span>{" "}
                <HealthStars score={account.healthScore} />
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                Credits
              </div>
              <div className="font-medium">
                {account.creditUnit === "unlimited" ? (
                  <span className="text-emerald-500">Unlimited</span>
                ) : (
                  <span
                    className={
                      account.remainingPercent < 20
                        ? "text-red-400 font-semibold"
                        : ""
                    }
                  >
                    ${account.remainingCredits.toFixed(2)}
                    <span className="text-muted-foreground/60 font-normal">
                      {" "}
                      / ${account.totalCredits.toFixed(2)}
                    </span>
                  </span>
                )}
              </div>
              {account.creditUnit !== "unlimited" && (
                <Progress
                  value={account.remainingPercent}
                  className={`h-1 mt-1 rounded-full ${account.remainingPercent < 20 ? "[&>div]:bg-red-500" : account.remainingPercent < 50 ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-500"}`}
                />
              )}
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                Requests
              </div>
              <div className="font-medium">
                {account.todayRequests.toLocaleString()}{" "}
                <span className="text-muted-foreground/60 font-normal">today</span>
              </div>
              <div className="text-muted-foreground/70">
                {account.totalRequests.toLocaleString()} total
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                Performance
              </div>
              <div className="font-medium">{account.avgLatencyMs}ms avg</div>
              <div
                className={
                  account.successRate >= 99
                    ? "text-emerald-500"
                    : account.successRate >= 95
                      ? "text-amber-500"
                      : "text-red-400"
                }
              >
                {account.successRate}% success
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground/70 hover:text-foreground hover:bg-muted/50 rounded-lg"
              onClick={() => onEdit(account)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-[11px] gap-1.5 rounded-lg border-border/50"
              onClick={() => onToggleStatus(account.id)}
            >
              <Power className="h-3 w-3" />
              <span className="hidden sm:inline">
                {account.status === "active" ? "Disable" : "Enable"}
              </span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg"
              onClick={() => onDelete(account.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ────────────────────────────────────────

export function AccountsTab({
  refreshKey,
  onRefresh,
}: {
  refreshKey: number;
  onRefresh: () => void;
}) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showKeys, setShowKeys] = useState<Set<string>>(new Set());
  const [collapsedProviders, setCollapsedProviders] = useState<Set<string>>(
    new Set()
  );
  const { toast } = useToast();

  // ── Add Account Dialog State ─────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const [addProvider, setAddProvider] = useState("");
  const [addName, setAddName] = useState("");
  const [addKeys, setAddKeys] = useState("");
  const [addStatus, setAddStatus] = useState("active");
  const [adding, setAdding] = useState(false);

  // ── Edit Account Dialog State ────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [editApiKey, setEditApiKey] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editSnapshot, setEditSnapshot] = useState<Account | null>(null);

  const openEdit = (account: Account) => {
    setEditId(account.id);
    setEditName(account.name);
    setEditApiKey(account.apiKey);
    setEditStatus(account.status);
    setEditPriority(String(account.priority));
    setEditSnapshot(account);
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editId) return;
    setEditSaving(true);
    try {
      const body: Record<string, unknown> = {
        id: editId,
        name: editName.trim(),
        apiKey: editApiKey,
        status: editStatus,
      };
      if (editPriority) body.priority = parseInt(editPriority, 10);

      await fetch("/api/accounts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      toast({ title: `Updated ${editName.trim()}` });
      setEditOpen(false);
      onRefresh();
    } catch {
      toast({ title: "Failed to update account", variant: "destructive" });
    } finally {
      setEditSaving(false);
    }
  };

  // ── Quick Add Dialog State (per-provider) ────────────────
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddProvider, setQuickAddProvider] = useState("");
  const [quickAddKeys, setQuickAddKeys] = useState("");
  const [quickAdding, setQuickAdding] = useState(false);

  // ── Data Loading ─────────────────────────────────────────
  const load = useCallback(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (filter !== "all") params.set("status", filter);
    fetch(`/api/accounts?${params}`)
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
  }, [filter]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // ── Actions ─────────────────────────────────────────────
  const toggleKey = (id: string) => {
    setShowKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleProviderCollapse = (provider: string) => {
    setCollapsedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(provider)) next.delete(provider);
      else next.add(provider);
      return next;
    });
  };

  const toggleStatus = async (id: string) => {
    await fetch(`/api/accounts/toggle?id=${id}`, { method: "POST" });
    toast({ title: "Status toggled" });
    load();
  };

  const deleteAccount = async (id: string) => {
    if (!confirm("Delete this account?")) return;
    await fetch(`/api/accounts?id=${id}`, { method: "DELETE" });
    toast({ title: "Account deleted" });
    load();
  };

  // ── Add Accounts (main dialog) ──────────────────────────
  const handleAdd = async () => {
    if (!addProvider || !addName.trim() || !addKeys.trim()) return;
    setAdding(true);
    try {
      const keys = addKeys
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      if (keys.length === 0) return;

      const body =
        keys.length === 1
          ? {
              providerName: addProvider,
              name: addName.trim(),
              apiKey: keys[0],
              status: addStatus,
            }
          : {
              providerName: addProvider,
              namePrefix: addName.trim(),
              apiKeys: keys,
              status: addStatus,
            };

      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      const count = data.created ?? 1;
      toast({
        title:
          count > 1
            ? `Added ${count} keys to ${addProvider}`
            : `Added ${addName.trim()} to ${addProvider}`,
      });

      setAddProvider("");
      setAddName("");
      setAddKeys("");
      setAddStatus("active");
      setAddOpen(false);
      onRefresh();
    } catch {
      toast({ title: "Failed to add account", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  // ── Quick Add (per-provider) ────────────────────────────
  const openQuickAdd = (providerName: string) => {
    setQuickAddProvider(providerName);
    setQuickAddKeys("");
    setQuickAddOpen(true);
  };

  const handleQuickAdd = async () => {
    if (!quickAddProvider || !quickAddKeys.trim()) return;
    setQuickAdding(true);
    try {
      const keys = quickAddKeys
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (keys.length === 0) return;

      // Count existing keys for this provider to auto-name
      const existing = accounts.filter(
        (a) => a.providerName === quickAddProvider
      ).length;

      const body = {
        providerName: quickAddProvider,
        namePrefix: `Key ${existing + 1}`,
        apiKeys: keys,
        status: "active" as const,
      };

      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      toast({
        title: `Added ${data.created ?? 1} key${(data.created ?? 1) > 1 ? "s" : ""} to ${quickAddProvider}`,
      });

      setQuickAddOpen(false);
      onRefresh();
    } catch {
      toast({ title: "Failed to add keys", variant: "destructive" });
    } finally {
      setQuickAdding(false);
    }
  };

  // ── Group & Filter ──────────────────────────────────────
  const filtered = useMemo(() => {
    return accounts.filter(
      (a) =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.providerName.toLowerCase().includes(search.toLowerCase())
    );
  }, [accounts, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Account[]>();
    for (const a of filtered) {
      const list = map.get(a.providerName) || [];
      list.push(a);
      map.set(a.providerName, list);
    }
    // Sort providers by total health (sum of health scores, descending)
    return [...map.entries()].sort(([, a], [, b]) => {
      const healthA = a.reduce((s, x) => s + x.healthScore, 0);
      const healthB = b.reduce((s, x) => s + x.healthScore, 0);
      return healthB - healthA;
    });
  }, [filtered]);

  const keyCount = countKeys(addKeys);

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 items-center w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search accounts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm rounded-lg bg-muted/30 border-border/50"
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[130px] h-9 text-xs rounded-lg bg-muted/30 border-border/50">
              <Filter className="h-3 w-3 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="backup">Backup</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Main Add Button */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              className="gap-1.5 text-xs h-9 rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground"
            >
              <Plus className="h-3.5 w-3.5" /> Add Account
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg rounded-xl">
            <DialogHeader>
              <DialogTitle>Add API Account</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Provider</Label>
                  <Input
                    placeholder="e.g. OpenAI, Anthropic, Groq..."
                    value={addProvider}
                    onChange={(e) => setAddProvider(e.target.value)}
                    className="h-9 text-sm rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Name / Prefix</Label>
                  <Input
                    placeholder="e.g. Primary, Production..."
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    className="h-9 text-sm rounded-lg"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">API Keys</Label>
                  <span className="text-[10px] text-muted-foreground">
                    One key per line — {keyCount} key{keyCount !== 1 ? "s" : ""} detected
                  </span>
                </div>
                <textarea
                  placeholder={"sk-proj-abc123...\nsk-proj-def456...\n\nPaste multiple keys to add them all at once."}
                  value={addKeys}
                  onChange={(e) => setAddKeys(e.target.value)}
                  rows={5}
                  className="w-full text-sm font-mono rounded-lg border border-border bg-background px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-ring/50 placeholder:text-muted-foreground/50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Initial Status</Label>
                <Select value={addStatus} onValueChange={setAddStatus}>
                  <SelectTrigger className="h-9 text-sm rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="backup">Backup</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {keyCount > 1 && (
                <div className="text-[11px] text-muted-foreground bg-muted/30 rounded-lg p-3 leading-relaxed">
                  <span className="font-medium text-foreground">
                    {keyCount} keys detected
                  </span>{" "}
                  — they will be added as{" "}
                  <span className="font-mono">
                    {addName.trim() || "Key"} #1
                  </span>
                  ,{" "}
                  <span className="font-mono">
                    {addName.trim() || "Key"} #2
                  </span>
                  , etc.
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddOpen(false)}
                className="rounded-lg"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={
                  adding ||
                  !addProvider ||
                  !addName.trim() ||
                  !addKeys.trim()
                }
                className="rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground"
              >
                {adding
                  ? "Adding..."
                  : keyCount > 1
                    ? `Add ${keyCount} Keys`
                    : "Add Account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Account Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg rounded-xl">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Name</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-9 text-sm rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger className="h-9 text-sm rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="backup">Backup</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">API Key</Label>
              <Input
                value={editApiKey}
                onChange={(e) => setEditApiKey(e.target.value)}
                className="h-9 text-sm font-mono rounded-lg"
                placeholder="sk-proj-..."
              />
            </div>
            {/* Read-only Account Balance — like a bank statement */}
            {editSnapshot && (
              <div className="rounded-xl bg-muted/40 border border-border/40 p-4 space-y-3">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
                  Account Balance
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Credits Remaining</div>
                    <div className="text-lg font-bold tabular-nums leading-none">
                      {editSnapshot.creditUnit === "unlimited" ? (
                        <span className="text-emerald-500">Unlimited</span>
                      ) : (
                        <span className={editSnapshot.remainingPercent < 20 ? "text-red-400" : ""}>
                          ${editSnapshot.remainingCredits.toFixed(2)}
                        </span>
                      )}
                    </div>
                    {editSnapshot.creditUnit !== "unlimited" && (
                      <Progress
                        value={editSnapshot.remainingPercent}
                        className={`h-1.5 mt-2 rounded-full ${editSnapshot.remainingPercent < 20 ? "[&>div]:bg-red-500" : editSnapshot.remainingPercent < 50 ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-500"}`}
                      />
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Credits</div>
                    <div className="text-lg font-bold tabular-nums leading-none">
                      {editSnapshot.creditUnit === "unlimited" ? "—" : `$${editSnapshot.totalCredits.toFixed(2)}`}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-2">
                      Used ${editSnapshot.usedCredits.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Health Score</div>
                    <div className={`text-lg font-bold tabular-nums leading-none ${healthColor(editSnapshot.healthScore)}`}>
                      {editSnapshot.healthScore}°
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-2">
                      {editSnapshot.avgLatencyMs}ms avg latency
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Requests</div>
                    <div className="text-lg font-bold tabular-nums leading-none">
                      {editSnapshot.todayRequests.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-2">
                      {editSnapshot.totalRequests.toLocaleString()} total
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs">Priority</Label>
              <Input
                type="number"
                min={0}
                max={10}
                value={editPriority}
                onChange={(e) => setEditPriority(e.target.value)}
                className="h-9 text-sm rounded-lg"
                placeholder="5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(false)} className="rounded-lg">Cancel</Button>
            <Button
              size="sm"
              onClick={handleEdit}
              disabled={editSaving || !editName.trim()}
              className="rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground"
            >
              {editSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Add Dialog (per-provider) */}
      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle>
              Add Keys to{" "}
              <span className="text-brand">{quickAddProvider}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">API Keys</Label>
                <span className="text-[10px] text-muted-foreground">
                  {countKeys(quickAddKeys)} key{countKeys(quickAddKeys) !== 1 ? "s" : ""} detected
                </span>
              </div>
              <textarea
                placeholder={"sk-proj-abc123...\nsk-proj-def456...\n\nPaste one or more keys."}
                value={quickAddKeys}
                onChange={(e) => setQuickAddKeys(e.target.value)}
                rows={4}
                className="w-full text-sm font-mono rounded-lg border border-border bg-background px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-ring/50 placeholder:text-muted-foreground/50"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickAddOpen(false)}
              className="rounded-lg"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleQuickAdd}
              disabled={quickAdding || !quickAddKeys.trim()}
              className="rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground"
            >
              {quickAdding
                ? "Adding..."
                : `Add ${countKeys(quickAddKeys) || ""} Key${countKeys(quickAddKeys) !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accounts List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className={"h-36 rounded-xl skeleton-shimmer"} style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="py-16 text-center text-sm text-muted-foreground rounded-xl border-border/50">
          <div className="text-3xl mb-2 opacity-30">
            <Search className="h-8 w-8 mx-auto" />
          </div>
          No accounts found.
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([provider, providerAccounts]) => {
            const isCollapsed = collapsedProviders.has(provider);
            const activeCount = providerAccounts.filter(
              (a) => a.status === "active"
            ).length;

            return (
              <div key={provider}>
                {/* Provider Group Header */}
                <button
                  onClick={() => toggleProviderCollapse(provider)}
                  className="w-full flex items-center gap-3 py-2 px-1 group text-left"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                  )}
                  <h2 className="text-sm font-semibold tracking-tight">
                    {provider}
                  </h2>
                  <Badge
                    variant="secondary"
                    className="text-[10px] h-5 rounded-md font-medium tabular-nums"
                  >
                    {providerAccounts.length} key
                    {providerAccounts.length !== 1 ? "s" : ""}
                  </Badge>
                  {activeCount > 0 && (
                    <span className="text-[10px] text-emerald-500 font-medium">
                      {activeCount} active
                    </span>
                  )}
                  <span className="flex-1" />

                  {/* Quick add button for this provider */}
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openQuickAdd(provider);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-brand font-medium hover:underline"
                  >
                    + Add key
                  </span>
                </button>

                {/* Account Cards */}
                {!isCollapsed && (
                  <div className="grid gap-2.5 ml-1 border-l-2 border-border/30 pl-4 sm:pl-5 mt-1">
                    {providerAccounts.map((account) => (
                      <AccountCard
                        key={account.id}
                        account={account}
                        showKey={showKeys.has(account.id)}
                        onToggleKey={toggleKey}
                        onToggleStatus={toggleStatus}
                        onDelete={deleteAccount}
                        onEdit={openEdit}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="text-[11px] text-muted-foreground/60 text-center py-2">
        Showing {filtered.length} of {accounts.length} accounts across{" "}
        {grouped.length} provider{grouped.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}