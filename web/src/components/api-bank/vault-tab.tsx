"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Trash2,
  Eye,
  EyeOff,
  Search,
  Filter,
  Key,
  Lock,
  Shield,
  Cloud,
  Mail,
  Database,
  Rocket,
  User,
  HelpCircle,
  Copy,
  Check,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Types ──────────────────────────────────────────────────

interface Secret {
  id: string;
  name: string;
  type: string;
  provider: string;
  purpose: string | null;
  credentials: Record<string, string>;
  status: string;
  notes: string | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

// ─── Config ────────────────────────────────────────────────

const TYPES = [
  { value: 'api_key', label: 'API Key', icon: Key, color: 'text-emerald-500' },
  { value: 'password', label: 'Password', icon: Lock, color: 'text-red-400' },
  { value: 'oauth', label: 'OAuth', icon: Shield, color: 'text-blue-400' },
  { value: 'service_account', label: 'Service Account', icon: Shield, color: 'text-violet-400' },
  { value: 'token', label: 'Token', icon: Key, color: 'text-amber-500' },
  { value: 'certificate', label: 'Certificate', icon: Shield, color: 'text-teal-400' },
  { value: 'ssh_key', label: 'SSH Key', icon: Key, color: 'text-orange-400' },
  { value: 'other', label: 'Other', icon: HelpCircle, color: 'text-zinc-400' },
] as const;

const PURPOSES = [
  { value: 'cloud_storage', label: 'Cloud Storage', icon: Cloud, color: 'text-blue-400' },
  { value: 'email', label: 'Email', icon: Mail, color: 'text-amber-500' },
  { value: 'database', label: 'Database', icon: Database, color: 'text-violet-400' },
  { value: 'ai_api', label: 'AI API', icon: Rocket, color: 'text-emerald-500' },
  { value: 'deployment', label: 'Deployment', icon: Rocket, color: 'text-orange-400' },
  { value: 'identity', label: 'Identity', icon: User, color: 'text-teal-400' },
  { value: 'other', label: 'Other', icon: HelpCircle, color: 'text-zinc-400' },
] as const;

function typeIcon(type: string) {
  return TYPES.find(t => t.value === type) || TYPES[7];
}

function purposeIcon(purpose: string | null) {
  if (!purpose) return PURPOSES[6];
  return PURPOSES.find(p => p.value === purpose) || PURPOSES[6];
}

function typeBadge(type: string) {
  const t = typeIcon(type);
  return (
    <Badge variant="outline" className={`text-[10px] gap-1 rounded-md border-border/50 ${t.color}`}>
      <t.icon className="h-2.5 w-2.5" />
      {t.label}
    </Badge>
  );
}

function purposeBadge(purpose: string | null) {
  if (!purpose) return <span className="text-[10px] text-muted-foreground/60">No purpose set</span>;
  const p = purposeIcon(purpose);
  return (
    <Badge variant="outline" className={`text-[10px] gap-1 rounded-md border-border/50 ${p.color}`}>
      <p.icon className="h-2.5 w-2.5" />
      {p.label}
    </Badge>
  );
}

// ─── Credential Display ────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="text-muted-foreground/50 hover:text-foreground transition-colors">
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function CredentialsList({ credentials, revealed }: { credentials: Record<string, string>; revealed: boolean }) {
  const entries = Object.entries(credentials);
  return (
    <div className="space-y-1.5">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground font-mono min-w-[100px]">{key}</span>
          <span className="flex-1 font-mono text-foreground/80 truncate">
            {revealed ? value : '••••••••' + (value.length > 8 ? '•••' : '')}
          </span>
          {revealed && <CopyButton text={value} />}
        </div>
      ))}
    </div>
  );
}

// ─── Secret Card ────────────────────────────────────────────

function SecretCard({
  secret,
  revealed,
  onToggleReveal,
  onDelete,
}: {
  secret: Secret;
  revealed: boolean;
  onToggleReveal: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const t = typeIcon(secret.type);
  const p = purposeIcon(secret.purpose);
  const fieldCount = Object.keys(secret.credentials).length;

  return (
    <Card className={`rounded-xl border-border/40 overflow-hidden card-hover border-l-[3px] group ${secret.status === 'active' ? 'border-l-emerald-500' : 'border-l-zinc-600'}`}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Left: Info */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm truncate">{secret.name}</h3>
              <Badge
                variant={secret.status === 'active' ? 'default' : 'outline'}
                className={`text-[10px] h-5 rounded-md font-medium ${secret.status === 'active' ? 'bg-emerald-500 text-white border-0' : ''}`}
              >
                {secret.status}
              </Badge>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-foreground/70">{secret.provider}</span>
              {typeBadge(secret.type)}
              {purposeBadge(secret.purpose)}
            </div>
            {secret.notes && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">{secret.notes}</p>
            )}
          </div>

          {/* Right: Credentials + Actions */}
          <div className="flex flex-col gap-3 shrink-0 lg:w-[340px]">
            <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                  Credentials ({fieldCount} field{fieldCount !== 1 ? 's' : ''})
                </span>
                <button
                  onClick={() => onToggleReveal(secret.id)}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {revealed ? 'Hide' : 'Reveal'}
                </button>
              </div>
              <CredentialsList credentials={secret.credentials} revealed={revealed} />
            </div>
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-muted-foreground/60">
                {secret.lastUsedAt
                  ? `Last used ${new Date(secret.lastUsedAt).toLocaleDateString()}`
                  : 'Never used'}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                onClick={() => onDelete(secret.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Add Secret Dialog ─────────────────────────────────────

function AddSecretDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [provider, setProvider] = useState('');
  const [purpose, setPurpose] = useState('');
  const [credKey1, setCredKey1] = useState('');
  const [credVal1, setCredVal1] = useState('');
  const [credKey2, setCredKey2] = useState('');
  const [credVal2, setCredVal2] = useState('');
  const [credKey3, setCredKey3] = useState('');
  const [credVal3, setCredVal3] = useState('');
  const [notes, setNotes] = useState('');
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  const handleAdd = async () => {
    if (!name.trim() || !type || !provider.trim() || !credKey1.trim() || !credVal1.trim()) return;
    setAdding(true);
    try {
      const credentials: Record<string, string> = { [credKey1.trim()]: credVal1.trim() };
      if (credKey2.trim() && credVal2.trim()) credentials[credKey2.trim()] = credVal2.trim();
      if (credKey3.trim() && credVal3.trim()) credentials[credKey3.trim()] = credVal3.trim();

      await fetch('/api/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(), type, provider: provider.trim(),
          purpose: purpose || undefined,
          credentials,
          notes: notes.trim() || undefined,
        }),
      });
      toast({ title: `Secret added to ${provider}` });
      setName(''); setType(''); setProvider(''); setPurpose('');
      setCredKey1(''); setCredVal1(''); setCredKey2(''); setCredVal2(''); setCredKey3(''); setCredVal3('');
      setNotes(''); setOpen(false); onAdded();
    } catch {
      toast({ title: 'Failed to add secret', variant: 'destructive' });
    } finally { setAdding(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="gap-1.5 text-xs h-9 rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Add Secret
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg rounded-xl">
        <DialogHeader>
          <DialogTitle>Add Secret to the Vault</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Name</Label>
              <Input
                placeholder="e.g. Production GCS"
                value={name} onChange={e => setName(e.target.value)}
                className="h-9 text-sm rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Provider</Label>
              <Input
                placeholder="e.g. Google, AWS, GitHub"
                value={provider} onChange={e => setProvider(e.target.value)}
                className="h-9 text-sm rounded-lg"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-9 text-sm rounded-lg"><SelectValue placeholder="Select type..." /></SelectTrigger>
                <SelectContent>
                  {TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Purpose</Label>
              <Select value={purpose} onValueChange={setPurpose}>
                <SelectTrigger className="h-9 text-sm rounded-lg"><SelectValue placeholder="What is it for?" /></SelectTrigger>
                <SelectContent>
                  {PURPOSES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Credentials</Label>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="email" value={credKey1} onChange={e => setCredKey1(e.target.value)} className="h-9 text-sm rounded-lg" />
                <Input placeholder="value" value={credVal1} onChange={e => setCredVal1(e.target.value)} type="password" className="h-9 text-sm rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="key (optional)" value={credKey2} onChange={e => setCredKey2(e.target.value)} className="h-9 text-sm rounded-lg" />
                <Input placeholder="value (optional)" value={credVal2} onChange={e => setCredVal2(e.target.value)} type="password" className="h-9 text-sm rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="key (optional)" value={credKey3} onChange={e => setCredKey3(e.target.value)} className="h-9 text-sm rounded-lg" />
                <Input placeholder="value (optional)" value={credVal3} onChange={e => setCredVal3(e.target.value)} type="password" className="h-9 text-sm rounded-lg" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Notes</Label>
            <Input
              placeholder="Optional notes..."
              value={notes} onChange={e => setNotes(e.target.value)}
              className="h-9 text-sm rounded-lg"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="rounded-lg">Cancel</Button>
          <Button
            size="sm" onClick={handleAdd} disabled={adding || !name.trim() || !type || !provider.trim() || !credKey1.trim()}
            className="rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground"
          >
            {adding ? 'Adding...' : 'Add to Vault'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ────────────────────────────────────────

export function VaultTab({ refreshKey, onRefresh }: { refreshKey: number; onRefresh: () => void }) {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterPurpose, setFilterPurpose] = useState('all');
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const load = useCallback(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (filterType !== 'all') params.set('type', filterType);
    if (filterPurpose !== 'all') params.set('purpose', filterPurpose);
    fetch(`/api/secrets?${params}`)
      .then(r => r.json())
      .then(data => { if (!cancelled) { setSecrets(data); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filterType, filterPurpose]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const toggleReveal = (id: string) => {
    setRevealed(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const deleteSecret = async (id: string) => {
    if (!confirm('Delete this secret? This cannot be undone.')) return;
    await fetch(`/api/secrets?id=${id}`, { method: 'DELETE' });
    toast({ title: 'Secret deleted' });
    onRefresh();
  };

  const filtered = useMemo(() => {
    if (!search) return secrets;
    const q = search.toLowerCase();
    return secrets.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.provider.toLowerCase().includes(q) ||
      s.type.toLowerCase().includes(q) ||
      (s.purpose || '').toLowerCase().includes(q)
    );
  }, [secrets, search]);

  // Group by provider
  const grouped = useMemo(() => {
    const map = new Map<string, Secret[]>();
    for (const s of filtered) { const list = map.get(s.provider) || []; list.push(s); map.set(s.provider, list); }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 items-center w-full sm:w-auto flex-wrap">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search secrets..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm rounded-lg bg-muted/30 border-border/50"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[120px] h-9 text-xs rounded-lg bg-muted/30 border-border/50">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterPurpose} onValueChange={setFilterPurpose}>
            <SelectTrigger className="w-[140px] h-9 text-xs rounded-lg bg-muted/30 border-border/50">
              <SelectValue placeholder="Purpose" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Purposes</SelectItem>
              {PURPOSES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <AddSecretDialog onAdded={onRefresh} />
      </div>

      {/* Secret List */}
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="py-16 text-center text-sm text-muted-foreground rounded-xl border-border/40 border-dashed">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted/20 border border-border/30 mb-4 breathe-glow">
            <Lock className="h-7 w-7 opacity-30" />
          </div>
          <p className="font-medium mb-1.5 text-foreground/60">The vault is empty</p>
          <p className="text-xs text-muted-foreground/60 max-w-xs mx-auto leading-relaxed">Add your first secret — passwords, tokens, OAuth creds, service accounts, SSH keys...</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([provider, providerSecrets]) => (
            <div key={provider}>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                {provider} <span className="text-muted-foreground/50 font-normal normal-case">({providerSecrets.length})</span>
              </h2>
              <div className="grid gap-2.5">
                {providerSecrets.map(secret => (
                  <SecretCard
                    key={secret.id}
                    secret={secret}
                    revealed={revealed.has(secret.id)}
                    onToggleReveal={toggleReveal}
                    onDelete={deleteSecret}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      {secrets.length > 0 && (
        <div className="text-[11px] text-muted-foreground/60 text-center py-2">
          Showing {filtered.length} of {secrets.length} secrets across {grouped.length} provider{grouped.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}