// Bounded, process-local throttle for authentication endpoints.
// Public deployments must also rate-limit at their trusted reverse proxy.
const windows = new Map<string, { count: number; resetAt: number }>();

export function allowAuthAttempt(req: Request, action: 'login' | 'register', subject: string): boolean {
  const forwarded = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const limit = action === 'login' ? 10 : 5;
  return consume(`${action}:ip:${forwarded}`.slice(0, 512), limit)
    && consume(`${action}:subject:${subject}`.slice(0, 512), limit);
}

function consume(key: string, limit: number): boolean {
  const now = Date.now();
  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    if (windows.size >= 10_000) {
      for (const [entryKey, entry] of windows) {
        if (entry.resetAt <= now) windows.delete(entryKey);
      }
      while (windows.size >= 10_000) windows.delete(windows.keys().next().value!);
    }
    windows.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}
