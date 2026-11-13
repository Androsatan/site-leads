const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;
const GLOBAL_MAX = 40;
const GLOBAL = "*";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function bucket(key: string, now: number) {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    const fresh = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, fresh);
    return fresh;
  }
  return current;
}

export function loginBlocked(key: string, now = Date.now()) {
  const own = buckets.get(key);
  const all = buckets.get(GLOBAL);
  const ownBlocked = Boolean(own && own.resetAt > now && own.count >= MAX_FAILURES);
  const allBlocked = Boolean(all && all.resetAt > now && all.count >= GLOBAL_MAX);
  return ownBlocked || allBlocked;
}

export function recordLoginFailure(key: string, now = Date.now()) {
  bucket(key, now).count += 1;
  bucket(GLOBAL, now).count += 1;
}

export function clearLoginFailures(key: string) {
  buckets.delete(key);
}
