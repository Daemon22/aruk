import { NextResponse } from "next/server";

// ── GET /api ───────────────────────────────────────────────
// API discovery — tells agents what's available
export async function GET() {
  return NextResponse.json({
    name: "Aruk",
    version: "1.0.0",
    description: "Centralized API key management with intelligent routing",
    endpoints: {
      health: "GET  /api/health                          — Heartbeat check",
      agent: "GET  /api/agent?strategy=best&provider=...  — One-shot key retrieval",
      agent_post: "POST /api/agent                        — Structured actions (get_key, status, list, add_key, add_keys, report_usage, failover)",
      accounts: "GET  /api/accounts                       — List all accounts",
      accounts_add: "POST /api/accounts                   — Add account(s)",
      routing: "GET  /api/routing?strategy=...            — Routing decision",
      stats: "GET  /api/stats                             — Full stats + credits + failover",
      credits: "GET  /api/credits                         — Credit monitor",
      usage_logs: "GET  /api/usage/logs                   — Usage history",
      usage_daily: "GET  /api/usage/daily                 — Daily usage aggregates",
      predictions: "GET  /api/predictions                 — Credit exhaustion predictions",
      simulate: "POST /api/simulate                       — Simulate traffic",
      providers: "GET  /api/providers                     — List providers",
      export: "GET  /api/export?format=json|csv           — Export all data",
    },
    agent_actions: ["get_key", "status", "list", "add_key", "add_keys", "report_usage", "failover", "get_secret", "list_secrets", "add_secret"],
    strategies: ["best", "fastest", "cheapest", "highest_quality", "round_robin", "load_balance"],
  });
}