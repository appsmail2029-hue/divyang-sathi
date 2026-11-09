type Entry = { count: number; resetAt: number };

const globalForLimit = globalThis as unknown as { __metroRateLimit?: Map<string, Entry> };

function store(): Map<string, Entry> {
  if (!globalForLimit.__metroRateLimit) globalForLimit.__metroRateLimit = new Map();
  return globalForLimit.__metroRateLimit;
}

export function isRateLimited(key: string, max = 8, windowMs = 10 * 60_000): boolean {
  const entry = store().get(key);
  if (!entry) return false;
  if (entry.resetAt < Date.now()) {
    store().delete(key);
    return false;
  }
  return entry.count >= max;
}

export function recordFailure(key: string, windowMs = 10 * 60_000) {
  const entry = store().get(key);
  if (!entry || entry.resetAt < Date.now()) {
    store().set(key, { count: 1, resetAt: Date.now() + windowMs });
    return;
  }
  entry.count += 1;
}

export function clearFailures(key: string) {
  store().delete(key);
}

export function clientKey(req: Request, username: string): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  return `${ip}:${username.toLowerCase()}`;
}
