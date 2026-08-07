#!/usr/bin/env bun
// ============================================================
// Aruk CLI — Layer 2: Terminal Interface
// ============================================================
// Usage:
//   bun scripts/apibank.ts list              List all API accounts
//   bun scripts/apibank.ts status            Overall status (keys + vault)
//   bun scripts/apibank.ts provider <name>   Provider details
//   bun scripts/apibank.ts credits           Credit monitor
//   bun scripts/apibank.ts use [strategy]    Get best key
//   bun scripts/apibank.ts failover          Show failover chain
//   bun scripts/apibank.ts add <prov> <name> <key>  Add API account
//   bun scripts/apibank.ts toggle <id>       Enable/disable account
//   bun scripts/apibank.ts logs              Recent usage logs
//   bun scripts/apibank.ts simulate [n] [s]  Simulate traffic
//   bun scripts/apibank.ts predictions       Credit exhaustion predictions
//   bun scripts/apibank.ts export [json|csv]  Export all accounts
//   bun scripts/apibank.ts vault             List all secrets in the vault
//   bun scripts/apibank.ts vault-add <name> <type> <provider> <key=val>...
//   bun scripts/apibank.ts vault-get <purpose> [provider]
//   bun scripts/apibank.ts vault-del <id>    Delete a secret
//   bun scripts/apibank.ts --json            Machine-readable output
// ============================================================

const BASE = process.env.APIBANK_URL || 'http://localhost:3000';

interface CliOpts {
  json: boolean;
}

function parseOpts(): CliOpts {
  return { json: process.argv.includes('--json') };
}

function json(data: unknown) {
  console.log(JSON.stringify(data, null, 2));
}

function bar(label: string, value: number, max: number, width = 30) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 100;
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  console.log(`  ${label.padEnd(18)} ${bar} ${pct}%`);
}

function healthStars(score: number) {
  const full = Math.floor(score / 20);
  const half = score % 20 >= 10 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '☆' : '') + '☆'.repeat(Math.max(0, empty - half));
}

function maskKey(key: string) {
  if (key === 'local') return 'local';
  if (key.length <= 8) return '****';
  return key.slice(0, 7) + '····' + key.slice(-4);
}

function statusColor(status: string) {
  switch (status) {
    case 'active': return '\x1b[32m✓\x1b[0m';
    case 'backup': return '\x1b[33m◆\x1b[0m';
    case 'expired': return '\x1b[31m✗\x1b[0m';
    case 'disabled': return '\x1b[90m○\x1b[0m';
    default: return '○';
  }
}

// ─── Commands ───────────────────────────────────────────────

async function cmdList(opts: CliOpts) {
  const res = await fetch(`${BASE}/api/accounts`);
  const accounts = await res.json();
  if (opts.json) return json(accounts);

  console.log('\n  \x1b[1mAPI BANK — All Accounts\x1b[0m\n');
  console.log('  ' + 'STATUS'.padEnd(8) + 'PROVIDER'.padEnd(14) + 'NAME'.padEnd(22) + 'PRIORITY'.padEnd(9) + 'HEALTH'.padEnd(12) + 'CREDITS');
  console.log('  ' + '─'.repeat(85));

  for (const a of accounts) {
    const sc = statusColor(a.status);
    const credits = a.creditUnit === 'unlimited'
      ? '\x1b[36mUnlimited\x1b[0m'
      : `$${a.remainingCredits.toFixed(2)} / $${a.totalCredits.toFixed(2)}`;
    const hp = a.healthScore >= 80 ? '\x1b[32m' : a.healthScore >= 50 ? '\x1b[33m' : '\x1b[31m';
    console.log(
      `  ${sc} ${a.status.padEnd(6)} ${a.providerName.padEnd(14)} ${a.name.padEnd(22)} ${String(a.priority).padEnd(9)} ${hp}${a.healthScore}°\x1b[0m`.padEnd(66) + `  ${credits}`
    );
  }
  console.log(`\n  Total: ${accounts.length} accounts\n`);
}

async function cmdStatus(opts: CliOpts) {
  const res = await fetch(`${BASE}/api/stats`);
  const { stats } = await res.json();
  if (opts.json) return json(stats);

  console.log('\n  ╔══════════════════════════════════════╗');
  console.log('  ║          A P I   B A N K            ║');
  console.log('  ╚══════════════════════════════════════╝\n');

  console.log(`  Accounts        ${String(stats.totalAccounts).padStart(8)}`);
  console.log(`  \x1b[32mHealthy         ${String(stats.healthyAccounts).padStart(8)}\x1b[0m`);
  console.log(`  \x1b[33mWarning         ${String(stats.warningAccounts).padStart(8)}\x1b[0m`);
  console.log(`  \x1b[31mOffline         ${String(stats.offlineAccounts).padStart(8)}\x1b[0m`);
  console.log('');
  console.log(`  Credits Left    ${String(stats.avgCreditsRemaining + '%').padStart(8)}`);
  console.log(`  Today's Reqs    ${String(stats.todayRequests.toLocaleString()).padStart(8)}`);
  console.log(`  Avg Cost/Req    ${('$' + stats.avgCostPerRequest).padStart(8)}`);
  console.log('');
  console.log(`  Current Best    \x1b[1m\x1b[36m${stats.currentBestProvider || 'N/A'}\x1b[0m`);
  console.log(`  Backup          ${stats.backupProvider || 'N/A'}`);
  console.log(`  Emergency       ${stats.emergencyProvider || 'N/A'}\n`);
}

async function cmdProvider(name: string, opts: CliOpts) {
  const res = await fetch(`${BASE}/api/accounts?provider=${encodeURIComponent(name)}`);
  const accounts = await res.json();
  if (opts.json) return json(accounts);
  if (accounts.length === 0) return console.log(`\n  No accounts found for "${name}"\n`);

  console.log(`\n  \x1b[1m${name}\x1b[0m — ${accounts.length} account(s)\n`);
  for (const a of accounts) {
    console.log(`  ${statusColor(a.status)} ${a.name}`);
    console.log(`    Key:        ${maskKey(a.apiKey)}`);
    console.log(`    Status:     ${a.status}  |  Priority: ${a.priority}  |  Health: ${healthStars(a.healthScore)} ${a.healthScore}°`);
    console.log(`    Credits:    ${a.creditUnit === 'unlimited' ? 'Unlimited' : `$${a.remainingCredits.toFixed(2)} remaining ($${a.totalCredits.toFixed(2)} total)`}`);
    console.log(`    Requests:   ${a.totalRequests.toLocaleString()} total  |  ${a.todayRequests.toLocaleString()} today`);
    console.log(`    Latency:    ${a.avgLatencyMs}ms avg  |  Success: ${a.successRate}%`);
    console.log(`    Last Used:  ${a.lastUsedAt ? new Date(a.lastUsedAt).toLocaleString() : 'Never'}`);
    console.log('');
  }
}

async function cmdCredits(opts: CliOpts) {
  const res = await fetch(`${BASE}/api/credits`);
  const accounts = await res.json();
  if (opts.json) return json(accounts);

  console.log('\n  \x1b[1mCREDIT MONITOR\x1b[0m\n');
  for (const a of accounts) {
    const label = `${a.providerName} — ${a.name}`;
    if (a.creditUnit === 'unlimited') {
      console.log(`  \x1b[32m✓\x1b[0m ${label.padEnd(42)} Unlimited`);
    } else if (a.remainingPercent >= 50) {
      console.log(`  \x1b[32m✓\x1b[0m ${label.padEnd(42)} ${a.remainingPercent}% Remaining`);
    } else if (a.remainingPercent >= 15) {
      console.log(`  \x1b[33m⚠\x1b[0m ${label.padEnd(42)} ${a.remainingPercent}% Remaining`);
    } else {
      console.log(`  \x1b[31m✗\x1b[0m ${label.padEnd(42)} ${a.remainingPercent}% Remaining`);
    }
  }
  console.log('');
}

async function cmdUse(strategy: string, opts: CliOpts) {
  const url = `${BASE}/api/routing?strategy=${strategy}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json();
    console.log(`\n  \x1b[31mError:\x1b[0m ${err.error}\n`);
    return;
  }
  const decision = await res.json();
  if (opts.json) return json(decision);

  console.log('\n  \x1b[1mROUTING DECISION\x1b[0m\n');
  console.log(`  Strategy:     ${decision.strategy}`);
  console.log(`  Provider:     \x1b[1m\x1b[36m${decision.providerName}\x1b[0m`);
  console.log(`  Account:      ${decision.accountName}`);
  console.log(`  API Key:      ${maskKey(decision.apiKey)}`);
  console.log(`  Health:       ${decision.healthScore}° ${healthStars(decision.healthScore)}`);
  console.log(`  Credits:      ${decision.remainingPercent}%`);
  console.log(`  Reason:       ${decision.reason}\n`);
}

async function cmdFailover(opts: CliOpts) {
  const res = await fetch(`${BASE}/api/stats`);
  const { failover } = await res.json();
  if (opts.json) return json(failover);

  console.log('\n  \x1b[1mFAILOVER CHAIN\x1b[0m\n');
  for (let i = 0; i < failover.length; i++) {
    const a = failover[i];
    const arrow = i < failover.length - 1 ? '↓' : '●';
    const hp = a.healthScore >= 80 ? '\x1b[32m' : a.healthScore >= 50 ? '\x1b[33m' : '\x1b[31m';
    const status = a.status === 'active' ? '' : ` [${a.status}]`;
    console.log(`  ${i + 1}. ${hp}${a.providerName} — ${a.name}${status}\x1b[0m`);
    console.log(`     Health: ${a.healthScore}°  |  Credits: ${a.creditUnit === 'unlimited' ? 'Unlimited' : a.remainingPercent + '%'}  |  Latency: ${a.avgLatencyMs}ms`);
    if (i < failover.length - 1) console.log(`     ${arrow}`);
  }
  console.log('');
}

async function cmdAdd(provider: string, name: string, apiKey: string, opts: CliOpts) {
  const res = await fetch(`${BASE}/api/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerName: provider, name, apiKey }),
  });
  const account = await res.json();
  if (opts.json) return json(account);
  console.log(`\n  \x1b[32m✓\x1b[0m Account added: ${account.providerName} — ${account.name}`);
  console.log(`    ID: ${account.id}\n`);
}

async function cmdToggle(id: string, opts: CliOpts) {
  const res = await fetch(`${BASE}/api/accounts/toggle?id=${encodeURIComponent(id)}`, { method: 'POST' });
  const account = await res.json();
  if (opts.json) return json(account);
  console.log(`\n  \x1b[32m✓\x1b[0m ${account.name} → ${account.status}\n`);
}

async function cmdSimulate(countStr: string, strategy: string, opts: CliOpts) {
  const count = parseInt(countStr) || 10;
  const res = await fetch(`${BASE}/api/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count, strategy: strategy || 'best' }),
  });
  const data = await res.json();
  if (opts.json) return json(data);

  console.log(`\n  \x1b[1mSIMULATED ${data.simulated} REQUESTS\x1b[0m\n`);
  const byProvider = new Map<string, number>();
  for (const r of data.routed) {
    byProvider.set(r.provider, (byProvider.get(r.provider) || 0) + 1);
  }
  for (const [provider, count] of byProvider) {
    const bar = '█'.repeat(Math.min(count, 40));
    console.log(`  ${provider.padEnd(16)} ${bar} ${count}`);
  }
  console.log('');
}

async function cmdPredictions(opts: CliOpts) {
  const res = await fetch(`${BASE}/api/predictions`);
  const data = await res.json();
  if (opts.json) return json(data);

  console.log('\n  \x1b[1mCREDIT PREDICTIONS\x1b[0m\n');
  for (const p of data.predictions) {
    const color = p.daysLeft <= 7 ? '\x1b[31m' : p.daysLeft <= 30 ? '\x1b[33m' : '\x1b[32m';
    const icon = p.daysLeft <= 7 ? '✗' : p.daysLeft <= 30 ? '⚠' : '✓';
    console.log(`  ${color}${icon}\x1b[0m ${p.providerName.padEnd(14)} ${p.name.padEnd(20)} ${String(p.daysLeft + 'd').padStart(5)} ${('$' + p.remainingCredits.toFixed(2)).padStart(10)} ${p.estimatedExhaustion}`);
  }
  console.log('');
}

async function cmdExport(format: string) {
  const res = await fetch(`${BASE}/api/export?format=${format || 'json'}`);
  if (format === 'csv') {
    console.log(await res.text());
  } else {
    const data = await res.json();
    console.log(`Exported ${data.accounts.length} accounts at ${data.exportedAt}`);
  }
}

async function cmdVault(opts: CliOpts) {
  const res = await fetch(`${BASE}/api/secrets`);
  const secrets = await res.json();
  if (opts.json) return json(secrets);

  console.log('\n  \x1b[1mVAULT — All Secrets\x1b[0m\n');
  if (secrets.length === 0) { console.log('  (empty)\n'); return; }

  for (const s of secrets) {
    const sc = s.status === 'active' ? '\x1b[32m✓\x1b[0m' : '\x1b[90m○\x1b[0m';
    const fields = Object.keys(s.credentials || {}).join(', ');
    console.log(`  ${sc} ${s.name.padEnd(24)} ${s.type.padEnd(16)} ${s.provider.padEnd(12)} ${fields}`);
  }
  console.log(`\n  Total: ${secrets.length} secrets\n`);
}

async function cmdVaultAdd(args: string[], opts: CliOpts) {
  const name = args[0] || '';
  const type = args[1] || 'other';
  const provider = args[2] || '';
  const kvPairs = args.slice(3);
  if (!name || !provider || kvPairs.length === 0) {
    console.log('\n  \x1b[31mUsage:\x1b[0m vault-add <name> <type> <provider> <key=val>...\n');
    console.log('  Types: api_key, password, oauth, service_account, token, certificate, ssh_key, other');
    console.log('  Example: vault-add "GCS Prod" password Google "email=user@gmail.com" "password=xxx"\n');
    return;
  }
  const credentials: Record<string, string> = {};
  for (const kv of kvPairs) {
    const eq = kv.indexOf('=');
    if (eq > 0) credentials[kv.slice(0, eq)] = kv.slice(eq + 1);
  }
  const res = await fetch(`${BASE}/api/secrets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, type, provider, credentials }),
  });
  const secret = await res.json();
  if (opts.json) return json(secret);
  console.log(`\n  \x1b[32m✓\x1b[0m Secret added: ${secret.name} (${secret.provider})`);
  console.log(`    ID: ${secret.id}\n`);
}

async function cmdVaultGet(purpose: string, provider: string | undefined, opts: CliOpts) {
  if (!purpose) { console.log('\n  \x1b[31mUsage:\x1b[0m vault-get <purpose> [provider]\n'); return; }
  const params = new URLSearchParams({ purpose });
  if (provider) params.set('provider', provider);
  const res = await fetch(`${BASE}/api/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'get_secret', purpose, provider }),
  });
  const data = await res.json();
  if (!data.ok) { console.log(`\n  \x1b[31mError:\x1b[0m ${data.error}\n`); return; }
  if (opts.json) return json(data.data);

  console.log(`\n  \x1b[1mSECRET RETRIEVED\x1b[0m\n`);
  console.log(`  Name:     ${data.data.name}`);
  console.log(`  Type:     ${data.data.type}`);
  console.log(`  Provider: ${data.data.provider}`);
  console.log(`  Purpose:  ${data.data.purpose || 'N/A'}`);
  console.log('  Fields:');
  for (const [k, v] of Object.entries(data.data.credentials as Record<string, string>)) {
    console.log(`    ${k.padEnd(20)} ${v}`);
  }
  console.log('');
}

async function cmdVaultDel(id: string, opts: CliOpts) {
  if (!id) { console.log('\n  \x1b[31mUsage:\x1b[0m vault-del <id>\n'); return; }
  await fetch(`${BASE}/api/secrets?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  console.log(`\n  \x1b[32m✓\x1b[0m Secret deleted: ${id}\n`);
}

async function cmdLogs(opts: CliOpts) {
  const res = await fetch(`${BASE}/api/usage/logs?perPage=15`);
  const { logs } = await res.json();
  if (opts.json) return json(logs);

  console.log('\n  \x1b[1mRECENT USAGE LOGS\x1b[0m\n');
  for (const log of logs) {
    const status = log.status === 'success' ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
    const name = log.account?.provider?.name || '?';
    console.log(`  ${status} ${name.padEnd(12)} ${log.model.padEnd(20)} ${String(log.latencyMs + 'ms').padEnd(10)} ${('$' + log.cost).padEnd(10)} ${new Date(log.createdAt).toLocaleString()}`);
  }
  console.log('');
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const opts = parseOpts();
  const cmd = args.find(a => !a.startsWith('--'));

  if (!cmd || cmd === 'help') {
    console.log(`
  \x1b[1mAruk CLI\x1b[0m — Keeper of secrets and keys

  \x1b[36mAPI Keys:\x1b[0m
    list                          List all accounts
    status                        Overall bank status
    provider <name>               Provider details
    credits                       Credit monitor
    use [strategy]                Get best key (best/fastest/cheapest/round_robin/load_balance)
    failover                      Show failover chain
    add <provider> <name> <key>   Add a new account
    toggle <id>                   Enable/disable account
    logs                          Recent usage logs
    simulate [count] [strategy]    Simulate traffic (default: 10 best)
    predictions                   Credit exhaustion predictions
    export [json|csv]              Export all accounts

  \x1b[36mVault (Secrets):\x1b[0m
    vault                         List all secrets
    vault-add <name> <type> <provider> <key=val>...  Add a secret
    vault-get <purpose> [provider] Retrieve credentials for a purpose
    vault-del <id>                Delete a secret

  \x1b[36mFlags:\x1b[0m
    --json                        Machine-readable output

  \x1b[36mExamples:\x1b[0m
    bun scripts/apibank.ts status
    bun scripts/apibank.ts use fastest
    bun scripts/apibank.ts vault
    bun scripts/apibank.ts vault-add "GCS Prod" password Google "email=x@gmail.com" "pass=xxx"
    bun scripts/apibank.ts vault-get cloud_storage Google
    bun scripts/apibank.ts vault-del <secret-id>
`);
    return;
  }

  try {
    switch (cmd) {
      case 'list': await cmdList(opts); break;
      case 'status': await cmdStatus(opts); break;
      case 'provider': await cmdProvider(args[args.indexOf(cmd) + 1] || '', opts); break;
      case 'credits': await cmdCredits(opts); break;
      case 'use': await cmdUse(args[args.indexOf(cmd) + 1] || 'best', opts); break;
      case 'failover': await cmdFailover(opts); break;
      case 'add': {
        const idx = args.indexOf(cmd);
        await cmdAdd(args[idx + 1] || '', args[idx + 2] || '', args[idx + 3] || '', opts);
        break;
      }
      case 'toggle': await cmdToggle(args[args.indexOf(cmd) + 1] || '', opts); break;
      case 'logs': await cmdLogs(opts); break;
      case 'simulate': await cmdSimulate(args[args.indexOf(cmd) + 1] || '10', args[args.indexOf(cmd) + 2] || 'best', opts); break;
      case 'predictions': await cmdPredictions(opts); break;
      case 'export': await cmdExport(args[args.indexOf(cmd) + 1] || 'json'); break;
      case 'vault': await cmdVault(opts); break;
      case 'vault-add': await cmdVaultAdd(args.slice(args.indexOf(cmd) + 1), opts); break;
      case 'vault-get': await cmdVaultGet(args[args.indexOf(cmd) + 1] || '', args[args.indexOf(cmd) + 2], opts); break;
      case 'vault-del': await cmdVaultDel(args[args.indexOf(cmd) + 1] || '', opts); break;
      default: console.log(`\n  Unknown command: ${cmd}\n  Run with no args for help.\n`);
    }
  } catch (e: any) {
    console.error(`\n  \x1b[31mError:\x1b[0m ${e.message}\n`);
    process.exit(1);
  }
}

main();