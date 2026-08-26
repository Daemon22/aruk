"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, Plus, ArrowUpRight, ArrowDownLeft, ArrowLeftRight, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PassageRule {
  id: string; name: string; direction: string; description: string | null;
  dataType: string; pattern: string | null; action: string;
  daemonRole: string | null; resourceType: string | null;
  status: string; priority: number; hitCount: number;
  createdAt: string;
}

const DIR_ICON: Record<string, any> = { outbound: ArrowUpRight, inbound: ArrowDownLeft, bidirectional: ArrowLeftRight };
const DIR_COLOR: Record<string, string> = {
  outbound: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  inbound: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  bidirectional: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
};
const ACTION_COLOR: Record<string, string> = {
  allow: 'text-emerald-400', block: 'text-red-400', sanitize: 'text-amber-400', log_only: 'text-muted-foreground',
};

export function PerimeterTab({ refreshKey }: { refreshKey: number }) {
  const [rules, setRules] = useState<PassageRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [filterDir, setFilterDir] = useState<string>('');
  const { toast } = useToast();

  const load = async () => {
    try {
      const params = filterDir ? `?direction=${filterDir}` : '';
      const data = await fetch(`/api/perimeter${params}`).then(r => r.json());
      setRules(data);
    } catch {
      toast({ title: "Failed to load rules", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load().catch(() => setLoading(false)); }, [refreshKey, filterDir]);

  const createRule = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await fetch('/api/perimeter', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fd.get('name'), direction: fd.get('direction'),
          dataType: fd.get('dataType'), action: fd.get('action'),
          description: fd.get('description') || undefined,
          pattern: fd.get('pattern') || undefined,
          daemonRole: fd.get('daemonRole') || undefined,
          resourceType: fd.get('resourceType') || undefined,
          priority: parseInt(fd.get('priority') as string) || 0,
        }),
      });
      setOpen(false); load();
    } catch {
      toast({ title: "Failed to create rule", variant: "destructive" });
    }
  };

  const deleteRule = async (id: string) => {
    try {
      await fetch(`/api/perimeter?id=${id}`, { method: 'DELETE' });
      setRules(rules.filter(r => r.id !== id));
    } catch {
      toast({ title: "Failed to delete rule", variant: "destructive" });
    }
  };

  if (loading) return <div className="space-y-3">{Array.from({length: 4}).map((_,i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand" /> The Perimeter
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            What information may leave the system and what external input may enter. The immovable boundary.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterDir} onValueChange={v => setFilterDir(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="All directions" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All directions</SelectItem>
              <SelectItem value="outbound">Outbound</SelectItem>
              <SelectItem value="inbound">Inbound</SelectItem>
              <SelectItem value="bidirectional">Bidirectional</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm" className="gap-1.5 text-xs rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground"><Plus className="h-3 w-3" /> Add Rule</Button></DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Add Passage Rule</DialogTitle></DialogHeader>
              <form onSubmit={createRule} className="space-y-3">
                <div><Label className="text-xs">Rule Name</Label><Input name="name" required placeholder="e.g. Block system prompt leakage" className="mt-1" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Direction</Label>
                    <Select name="direction" defaultValue="outbound">
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="outbound">Outbound</SelectItem>
                        <SelectItem value="inbound">Inbound</SelectItem>
                        <SelectItem value="bidirectional">Bidirectional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Action</Label>
                    <Select name="action" defaultValue="block">
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="allow">Allow</SelectItem>
                        <SelectItem value="block">Block</SelectItem>
                        <SelectItem value="sanitize">Sanitize</SelectItem>
                        <SelectItem value="log_only">Log Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label className="text-xs">Data Type</Label><Input name="dataType" required placeholder="e.g. system_prompt, model_output" className="mt-1" /></div>
                <div><Label className="text-xs">Pattern (regex, optional)</Label><Input name="pattern" placeholder="e.g. .*system.prompt.*" className="mt-1" /></div>
                <div><Label className="text-xs">Priority</Label><Input name="priority" type="number" defaultValue="0" className="mt-1" /></div>
                <Button type="submit" className="w-full rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground">Create Rule</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {rules.length === 0 ? (
        <Card className="rounded-xl border-dashed border-border/60">
          <CardContent className="py-16 text-center">
            <ShieldCheck className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No passage rules defined. The perimeter is open.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Aruk controls what may pass outward and what may return inward.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2 stagger-children">
          {rules.map(r => {
            const DirIcon = DIR_ICON[r.direction] || ArrowUpRight;
            return (
              <Card key={r.id} className={`rounded-xl border-border/50 overflow-hidden card-hover ${r.status !== 'active' ? 'opacity-50' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${DIR_COLOR[r.direction] || ''}`}>
                        <DirIcon className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="font-medium text-sm flex items-center gap-2">
                          {r.name}
                          <Badge variant="outline" className={`text-[10px] ${ACTION_COLOR[r.action] || ''} border-current/20`}>{r.action}</Badge>
                        </div>
                        {r.description && <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground tabular-nums">P{r.priority}</span>
                      <span className="text-[10px] text-muted-foreground">{r.hitCount} hits</span>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400" onClick={() => deleteRule(r.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
                </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
