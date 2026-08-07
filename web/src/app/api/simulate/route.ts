import { apiBank, RoutingStrategy } from '@/lib/api-bank';
import { NextRequest, NextResponse } from 'next/server';

const VALID_STRATEGIES: RoutingStrategy[] = [
  'best', 'fastest', 'cheapest', 'highest_quality', 'round_robin', 'load_balance',
];

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function POST(req: NextRequest) {
  let body: { count?: number; strategy?: string } = {};
  try {
    const raw = await req.json();
    body = raw ?? {};
  } catch {
    // empty body is fine, use defaults
  }

  const count = Math.min(Math.max(body.count ?? 10, 1), 1000);
  const strategy = VALID_STRATEGIES.includes(body.strategy as RoutingStrategy)
    ? (body.strategy as RoutingStrategy)
    : 'best';

  const routed: { provider: string; account: string }[] = [];

  for (let i = 0; i < count; i++) {
    try {
      const decision = await apiBank.route(strategy);

      const success = Math.random() < 0.9;
      const latency = randInt(100, 3000);
      const inputTokens = randInt(100, 2000);
      const outputTokens = randInt(200, 1500);
      const cost = Math.round(((inputTokens + outputTokens) / 1_000_000 * randInt(2, 15)) * 10_000) / 10_000;

      await apiBank.logUsage({
        accountId: decision.accountId,
        endpoint: '/v1/chat/completions',
        model: 'gpt-4o-mini',
        inputTokens,
        outputTokens,
        cost,
        latencyMs: latency,
        status: success ? 'success' : 'error',
        errorMessage: success ? undefined : 'Simulated error: rate limit exceeded',
      });

      routed.push({ provider: decision.providerName, account: decision.accountName });
    } catch {
      // routing failed for this iteration — skip
    }
  }

  return NextResponse.json({ simulated: routed.length, routed });
}