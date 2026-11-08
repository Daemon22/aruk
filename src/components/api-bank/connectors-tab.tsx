"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Cable, Check, ChevronDown, ChevronUp, LoaderCircle, Plus, RefreshCw, Search, Trash2, Wrench } from "lucide-react";

type Connector = { id: string; name: string; endpoint: string; registryName: string | null; authHeader: string; hasCredential: boolean; hasOAuthAccount: boolean };
type RegistryServer = { name: string; title: string; description: string; version: string; remotes: Array<{ url: string }> };
type McpTool = { name: string; description: string; inputSchema: unknown };

export function ConnectorsTab() {
  const [connections, setConnections] = useState<Connector[]>([]);
  const [servers, setServers] = useState<RegistryServer[]>([]);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [registryName, setRegistryName] = useState("");
  const [token, setToken] = useState("");
  const [authHeader, setAuthHeader] = useState("Authorization");
  const [tools, setTools] = useState<Record<string, McpTool[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [args, setArgs] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadConnections = useCallback(async () => {
    try {
      const response = await fetch("/api/mcp", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load connectors.");
      setConnections(data.connections || []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load connectors."); }
  }, []);
  useEffect(() => { void loadConnections(); }, [loadConnections]);
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("oauth");
    if (status === "connected") setNotice("The external account is connected. OAuth tokens are encrypted in your Vault.");
    else if (status === "cancelled") setNotice("External account sign-in was cancelled.");
    else if (status === "signin-required") setError("Sign in to Aruk again, then reconnect the external account.");
    else if (status === "failed") setError("External account sign-in could not be completed. Try connecting again.");
  }, []);

  useEffect(() => {
    const query = search.trim();
    if (query.length < 3) { setServers([]); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setBusy("search"); setError("");
      try {
        const response = await fetch(`/api/mcp?search=${encodeURIComponent(query)}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Registry search failed.");
        setServers(data.servers || []);
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Registry search failed."); }
      finally { if (!controller.signal.aborted) setBusy(null); }
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [search]);

  async function send(body: Record<string, unknown>) {
    const response = await fetch("/api/mcp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The connector request failed.");
    return data;
  }

  async function add(event: FormEvent) {
    event.preventDefault(); setBusy("add"); setError(""); setNotice("");
    try {
      await send({ action: "add", name, endpoint, token, authHeader, registryName });
      setName(""); setEndpoint(""); setToken(""); setRegistryName("");
      setNotice("Connection saved in your encrypted Vault."); await loadConnections();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the connection."); }
    finally { setBusy(null); }
  }

  async function discover(connection: Connector) {
    setBusy(connection.id); setError(""); setNotice("");
    try {
      const data = await send({ action: "tools", id: connection.id });
      setTools((old) => ({ ...old, [connection.id]: data.tools || [] })); setExpanded(connection.id);
      setNotice(`Found ${(data.tools || []).length} tools on ${connection.name}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not connect to that MCP server."); }
    finally { setBusy(null); }
  }

  async function connectAccount(connection: Connector) {
    setBusy(`oauth:${connection.id}`); setError(""); setNotice("");
    try {
      const data = await send({ action: "oauth-start", id: connection.id });
      const authorizationUrl = new URL(data.authorizationUrl);
      if (authorizationUrl.protocol !== "https:" && authorizationUrl.hostname !== "localhost") throw new Error("The external server returned an invalid sign-in address.");
      if (!window.confirm(`Continue to ${authorizationUrl.host} to sign in to this connected service? This does not sign you into Aruk.`)) return;
      window.location.assign(authorizationUrl.toString());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not start external account sign-in."); }
    finally { setBusy(null); }
  }

  async function runTool(connection: Connector, tool: McpTool) {
    const key = `${connection.id}:${tool.name}`;
    let parsed: Record<string, unknown>;
    try {
      const value = JSON.parse(args[key] || "{}");
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Arguments must be a JSON object.");
      parsed = value;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Invalid JSON arguments."); return; }
    if (!window.confirm(`Run “${tool.name}” on ${connection.name}?\n\n${tool.description}\n\nArguments:\n${JSON.stringify(parsed, null, 2)}\n\nThe server may read or change data in the connected account.`)) return;
    setBusy(key); setError(""); setNotice("");
    try {
      const data = await send({ action: "call", id: connection.id, name: tool.name, arguments: parsed });
      setResults((old) => ({ ...old, [key]: JSON.stringify(data, null, 2) })); await loadConnections();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The tool call failed."); }
    finally { setBusy(null); }
  }

  async function remove(connection: Connector) {
    if (!window.confirm(`Remove ${connection.name} and its encrypted credentials from your Vault?`)) return;
    setBusy(connection.id); setError("");
    try {
      const response = await fetch(`/api/mcp?id=${encodeURIComponent(connection.id)}`, { method: "DELETE" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not remove this connection.");
      setConnections((old) => old.filter((item) => item.id !== connection.id)); setNotice("Connection and encrypted credentials removed.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not remove this connection."); }
    finally { setBusy(null); }
  }

  function choose(server: RegistryServer, url: string) {
    setName(server.title); setEndpoint(url); setRegistryName(server.name); setServers([]);
    document.getElementById("mcp-add")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return <section className="space-y-5">
    <div className="rounded-2xl border border-border/50 bg-card/70 p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3"><span className="rounded-xl bg-primary/10 p-2.5 text-primary"><Cable className="h-5 w-5" /></span><div><h2 className="text-lg font-semibold">Connectors</h2><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Connect Aruk to remote MCP servers. Find a server in the public registry or enter its address. Each named connection can use a different account credential; Aruk encrypts credentials in your Vault.</p></div></div>
      <div className="mt-5 rounded-xl border border-border/40 bg-background/60 p-4">
        <label htmlFor="mcp-search" className="text-sm font-medium">Find remote MCP servers</label>
        <div className="mt-2 flex gap-2"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input id="mcp-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name (at least 3 characters)" className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary" /></div>{busy === "search" && <LoaderCircle className="my-auto h-5 w-5 animate-spin text-muted-foreground" />}</div>
        {servers.length > 0 && <div className="mt-3 divide-y divide-border/50 rounded-lg border border-border/50">{servers.map((server) => <div key={`${server.name}:${server.version}`} className="p-3"><p className="font-medium">{server.title}</p><p className="break-all font-mono text-[11px] text-muted-foreground">{server.name} · {server.version}</p><p className="mt-1 text-xs text-muted-foreground">{server.description}</p><div className="mt-3 flex flex-wrap gap-2">{server.remotes.map((remote) => <button key={remote.url} onClick={() => choose(server, remote.url)} className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted"><Plus className="h-3.5 w-3.5" /><span className="max-w-[36rem] truncate">Use {remote.url}</span></button>)}</div></div>)}</div>}
        {search.trim().length >= 3 && !servers.length && busy !== "search" && <p className="mt-3 text-xs text-muted-foreground">No hosted Streamable HTTP servers found. Local or command-line-only servers cannot be run by the hosted Aruk app.</p>}
      </div>
    </div>

    <form id="mcp-add" onSubmit={add} className="rounded-2xl border border-border/50 bg-card/70 p-5 shadow-sm sm:p-6">
      <h3 className="font-semibold">Add a connection</h3><p className="mt-1 text-sm text-muted-foreground">Add the same server again with a different name to keep separate provider accounts isolated.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5 text-sm"><span className="font-medium">Connection name</span><input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Drive — work" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 outline-none focus:border-primary" /></label>
        <label className="space-y-1.5 text-sm"><span className="font-medium">Remote MCP server URL</span><input required type="url" maxLength={2048} value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="https://service.example.com/mcp" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 outline-none focus:border-primary" /></label>
        <label className="space-y-1.5 text-sm"><span className="font-medium">Credential type</span><select value={authHeader} onChange={(event) => setAuthHeader(event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 outline-none focus:border-primary"><option value="Authorization">Bearer token</option><option value="X-API-Key">API key header</option></select></label>
        <label className="space-y-1.5 text-sm"><span className="font-medium">Token or API key <span className="text-muted-foreground">(optional)</span></span><input type="password" autoComplete="new-password" maxLength={8192} value={token} onChange={(event) => setToken(event.target.value)} placeholder="Encrypted when saved" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 outline-none focus:border-primary" /></label>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">The Registry is a directory; the server supplies its tools. Connect with an OAuth sign-in when the server supports it, or save a bearer token/API key in your Vault. External sign-in connects that service to Aruk; it does not sign you into Aruk.</p>
      <button disabled={busy === "add"} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">{busy === "add" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Save connection</button>
    </form>

    <div className="rounded-2xl border border-border/50 bg-card/70 p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">Your connections</h3><p className="mt-1 text-sm text-muted-foreground">Each connection and its credential belongs to your signed-in Aruk account.</p></div><button onClick={() => void loadConnections()} className="rounded-lg border border-border p-2 hover:bg-muted" aria-label="Refresh connections"><RefreshCw className="h-4 w-4" /></button></div>
      {!connections.length ? <div className="mt-5 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No MCP connections yet. Search above or add a remote server URL.</div> : <div className="mt-4 space-y-3">{connections.map((connection) => <article key={connection.id} className="overflow-hidden rounded-xl border border-border/50 bg-background/50">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="min-w-0"><h4 className="font-medium">{connection.name}</h4><p className="break-all font-mono text-[11px] text-muted-foreground">{connection.endpoint}</p><p className="mt-1 text-xs text-muted-foreground">{connection.hasOAuthAccount ? "OAuth account connected; tokens encrypted in Vault" : connection.hasCredential ? `${connection.authHeader === "X-API-Key" ? "API key" : "Bearer token"} encrypted in Vault` : "No token/API key saved"}{connection.registryName ? ` · Registry: ${connection.registryName}` : ""}</p></div><div className="flex shrink-0 flex-wrap gap-2"><button disabled={busy === connection.id} onClick={() => void discover(connection)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted disabled:opacity-50">{busy === connection.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}Discover tools</button><button disabled={busy === `oauth:${connection.id}`} onClick={() => void connectAccount(connection)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted disabled:opacity-50">{busy === `oauth:${connection.id}` ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Cable className="h-3.5 w-3.5" />}Connect account</button><button disabled={busy === connection.id} onClick={() => void remove(connection)} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Remove ${connection.name}`}><Trash2 className="h-4 w-4" /></button><button onClick={() => setExpanded(expanded === connection.id ? null : connection.id)} className="rounded-lg border border-border p-2" aria-label="Expand tools">{expanded === connection.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button></div></div>
        {expanded === connection.id && <div className="border-t border-border/50 p-4">{!tools[connection.id] ? <p className="text-sm text-muted-foreground">Choose “Discover tools” to load available tools.</p> : !tools[connection.id].length ? <p className="text-sm text-muted-foreground">This server did not advertise any tools.</p> : <div className="space-y-3">{tools[connection.id].map((tool) => { const key = `${connection.id}:${tool.name}`; return <div key={tool.name} className="rounded-lg border border-border/50 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-mono text-sm">{tool.name}</p><p className="mt-1 text-xs text-muted-foreground">{tool.description}</p></div><button disabled={busy === key} onClick={() => void runTool(connection, tool)} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">{busy === key ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}Review & run</button></div><label className="mt-3 block space-y-1"><span className="text-[11px] font-medium text-muted-foreground">Arguments as JSON</span><textarea value={args[key] ?? "{}"} onChange={(event) => setArgs((old) => ({ ...old, [key]: event.target.value }))} rows={3} spellCheck={false} className="w-full rounded-md border border-border bg-background p-2 font-mono text-xs outline-none focus:border-primary" /></label>{results[key] && <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/60 p-3 text-xs">{results[key]}</pre>}</div>; })}</div>}</div>}
      </article>)}</div>}
    </div>
    {(error || notice) && <div role={error ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${error ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"}`}>{error || <><Check className="mr-2 inline h-4 w-4" />{notice}</>}</div>}
  </section>;
}
