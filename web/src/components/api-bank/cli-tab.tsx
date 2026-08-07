"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Terminal, Package, Plug, Copy, Check, Code2, Blocks, Bot, Rocket } from "lucide-react";

function CB({ code, lang = "" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="relative group rounded-xl overflow-hidden ring-1 ring-white/[0.06] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.4)] transition-all duration-300 group-hover:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.5)] group-hover:ring-white/10">
      <div className="absolute top-2.5 left-3 flex items-center gap-1.5 z-10">
        <Code2 className="h-3 w-3 text-zinc-500" />
        {lang && <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">{lang}</span>}
      </div>
      <button onClick={copy} className="absolute top-2 right-2 p-1.5 rounded-md bg-zinc-800/80 hover:bg-zinc-700/80 opacity-0 group-hover:opacity-100 transition-all text-zinc-400 hover:text-zinc-200 z-10">
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <pre className="bg-zinc-950 text-zinc-100 p-4 pt-10 pb-4 text-xs leading-relaxed overflow-x-auto font-mono"><code>{code}</code></pre>
    </div>
  );
}

const ARCH = [
  { icon: Package, title: "Core Engine", desc: "Pure logic. No UI, no terminal.", layer: "Layer 1", color: "bg-emerald-500", border: "border-emerald-500/20" },
  { icon: Terminal, title: "CLI", desc: "Terminal interface for ops and scripts.", layer: "Layer 2", color: "bg-amber-500", border: "border-amber-500/20" },
  { icon: Code2, title: "SDK", desc: "HTTP client library for any app.", layer: "Layer 3", color: "bg-blue-500", border: "border-blue-500/20" },
  { icon: Plug, title: "Agent Plugin", desc: "Pre-built agent integrations.", layer: "Layer 4", color: "bg-violet-500", border: "border-violet-500/20" },
];

const ACT = [["get_key","Best key"],["status","Health"],["list","Accounts"],["add_key","Add key"],["add_keys","Batch"],["report_usage","Log"],["failover","Chain"],["get_secret","Vault get"],["list_secrets","Vault list"],["add_secret","Vault add"]];

export function CLITab() {
  return (
    <div className="space-y-5">
      <Card className="rounded-xl border-border/50 overflow-hidden">
        <CardHeader className="pb-3 px-5 pt-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2"><Blocks className="h-4 w-4 text-brand" /> Four-Layer Architecture</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-0 relative">
            {/* Animated connecting line */}
            <div className="hidden lg:block absolute top-[42px] left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-emerald-500/40 via-blue-500/40 to-violet-500/40 z-0">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-brand/30 to-transparent animate-[shimmer_3s_ease-in-out_infinite]" />
            </div>
            {ARCH.map((item, i) => (
              <div key={item.title} className={`relative z-10 p-4 rounded-xl border ${item.border} bg-muted/20 space-y-3 card-hover`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-lg ${item.color} flex items-center justify-center shadow-sm`}><item.icon className="h-3.5 w-3.5 text-white" /></div>
                  <span className="text-sm font-semibold block leading-tight">{item.title}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{item.desc}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] rounded-md font-mono">{item.layer}</Badge>
                  <Badge className="text-[9px] rounded-md bg-emerald-500/15 text-emerald-500 border-0">built</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/50 overflow-hidden">
        <CardHeader className="pb-3 px-5 pt-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2"><Bot className="h-4 w-4 text-violet-400" /> Agent API</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">Any agent or script can consume Aruk via HTTP. Responses use the {`{ ok, data, error, meta }`} envelope. CORS enabled.</p>
          <div><div className="text-xs font-medium mb-1.5">Quick key retrieval</div><CB lang="bash" code={`$ curl http://localhost:3000/api/agent?strategy=fastest
{ "ok": true, "data": { "apiKey": "gsk-xxxx", "provider": "Groq" } }`} /></div>
          <div><div className="text-xs font-medium mb-1.5">Agent actions</div><CB lang="bash" code={`# Get key for a provider
$ curl -X POST http://localhost:3000/api/agent \\
  -d '{"action":"get_key","provider":"Anthropic"}'

# Get vault credentials
$ curl -X POST http://localhost:3000/api/agent \\
  -d '{"action":"get_secret","purpose":"cloud_storage"}'`} /></div>
          <div><div className="text-xs font-medium mb-1.5">All 10 actions</div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {ACT.map(([a,d]) => (
                <div key={a} className="flex items-center gap-1.5 p-1.5 rounded-lg bg-muted/20 border border-border/30">
                  <code className="text-[10px] font-mono text-brand">{a}</code>
                  <span className="text-[10px] text-muted-foreground">{d}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/50 overflow-hidden">
        <CardHeader className="pb-3 px-5 pt-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2"><Terminal className="h-4 w-4 text-brand" /> CLI</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">Point at any deployed instance with <code className="bg-muted px-1.5 py-0.5 rounded-md text-[11px] font-mono border border-border/50">APIBANK_URL</code>. Use <code className="bg-muted px-1.5 py-0.5 rounded-md text-[11px] font-mono border border-border/50">--json</code> for scripts.</p>
          <CB lang="shell" code={`$ bun scripts/apibank.ts status          # Bank + vault status
$ bun scripts/apibank.ts use fastest     # Get best key
$ bun scripts/apibank.ts vault           # List vault secrets
$ bun scripts/apibank.ts vault-add "GCS" password Google "email=x@y.com" "pass=xxx"
$ bun scripts/apibank.ts vault-get cloud_storage Google
$ bun scripts/apibank.ts use best --json  # Machine-readable

# Remote deployment
$ APIBANK_URL=https://aruk.your-server.com bun scripts/apibank.ts status`} />
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/50 overflow-hidden">
        <CardHeader className="pb-3 px-5 pt-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2"><Code2 className="h-4 w-4 text-blue-400" /> SDK — ArukClient</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">TypeScript HTTP client. Auto-retry on 503, typed responses, full vault access. Works in any app.</p>
          <div><div className="text-xs font-medium mb-1.5">Inside the Next.js app</div><CB lang="typescript" code={`import { ArukClient } from "@/lib/sdk";

const aruk = new ArukClient();

// Get the best key (auto-retries on 503)
const { apiKey, provider } = await aruk.getKey("fastest");

// Get vault credentials for cloud storage
const secret = await aruk.getSecret("cloud_storage", "Google");
// secret.credentials -> { client_email, private_key, ... }

// Full bank status
const { stats } = await aruk.getStatus();`} /></div>
          <div><div className="text-xs font-medium mb-1.5">External apps / scripts</div><CB lang="typescript" code={`// From any TypeScript project
const aruk = new ArukClient({
  baseUrl: "https://aruk.your-server.com",
  authToken: process.env.ARUK_TOKEN,  // optional
  retries: 2,
});

const { apiKey } = await aruk.getKey("cheapest");
await aruk.addKey({ providerName: "OpenAI", apiKey: "sk-proj-..." });
await aruk.reportUsage(accountId, { latencyMs: 450 });`} /></div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/50 overflow-hidden">
        <CardHeader className="pb-3 px-5 pt-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2"><Rocket className="h-4 w-4 text-violet-400" /> Agent Plugin</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">Pre-built integrations. OpenAI-compatible chat, auto-key injection, credential resolution.</p>
          <div><div className="text-xs font-medium mb-1.5">Chat (auto-routed by Aruk)</div><CB lang="typescript" code={`import { ArukAgentPlugin } from "@/lib/agent-plugin";

const agent = new ArukAgentPlugin({ defaultStrategy: "best" });

// Aruk picks the provider. Your agent doesn't care.
const { content, provider, healthScore } = await agent.chat([
  { role: "system", content: "You are helpful." },
  { role: "user", content: "What is 2+2?" },
]);
// content: "4", provider: "Groq", healthScore: 99

// Single prompt shorthand
const answer = await agent.prompt("Explain quantum computing");`} /></div>
          <div><div className="text-xs font-medium mb-1.5">Credential resolution for agents</div><CB lang="typescript" code={`const agent = new ArukAgentPlugin();

// Agent needs GCS access
const gcs = await agent.getCredentials("cloud_storage", "Google");
// gcs.credentials.client_email, gcs.credentials.private_key

// Agent needs database access
const db = await agent.getCredentials("database", "Supabase");
// db.credentials.host, db.credentials.password

// Authenticated requests using vault credentials
const res = await agent.fetchWithAuth("cloud_storage", "Google",
  "https://storage.googleapis.com/bucket/file");`} /></div>
          <div><div className="text-xs font-medium mb-1.5">Supported providers</div>
            <div className="flex flex-wrap gap-1.5">
              {["OpenAI","Anthropic","Google","Groq","OpenRouter","DeepSeek"].map(p => (
                <Badge key={p} variant="outline" className="text-[10px] rounded-md">{p}</Badge>
              ))}
              <Badge variant="outline" className="text-[10px] rounded-md text-muted-foreground">+ custom</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/50 overflow-hidden">
        <CardHeader className="pb-3 px-5 pt-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2"><Rocket className="h-4 w-4 text-amber-400" /> Deploy</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">Docker-based deployment. One command. SQLite data persists in a volume.</p>
          <CB lang="shell" code={`# Copy env config and fill in your values
cp .env.example .env

# Build and start
docker compose up -d

# Check status
docker compose logs -f

# Point CLI at deployed instance
export APIBANK_URL=https://aruk.your-server.com
bun scripts/apibank.ts status`} />
        </CardContent>
      </Card>
    </div>
  );
}
