// Edge cache of the public leaderboard (ADR 0017): `GET /v1/rankings` is live
// (read from the totals by index) and goes through the Workers Cache for at
// most 30 seconds, the max-age the route sends. The Cache API only works on
// the custom domain (api.footebas.com.br); on workers.dev and in local runs it
// is absent and every request reaches the route.

/** The subset of the Workers Cache API used here (`caches.default`). */
export interface EdgeCache {
  match(key: Request): Promise<Response | undefined>;
  put(key: Request, response: Response): Promise<void>;
}

/** Paths whose public GET responses may come from the edge cache. */
const CACHED_PATHS = new Set(['/v1/rankings']);

/** `caches.default` when the runtime has it (Workers), otherwise undefined. */
export function workersCache(): EdgeCache | undefined {
  return (globalThis as { caches?: { default?: EdgeCache } }).caches?.default;
}

/**
 * Cache key of a public read: the URL with sorted query parameters plus the
 * request Origin. The response carries the CORS headers of that Origin and
 * the Cache API ignores `Vary: origin`, so each origin gets its own entry.
 */
export function publicCacheKey(request: Request): Request | undefined {
  if (request.method !== 'GET') return undefined;
  const url = new URL(request.url);
  // The route never reads the bearer, so signed-in calls share the entry.
  if (!CACHED_PATHS.has(url.pathname.replace(/\/$/, ''))) return undefined;
  const key = new URL(url.origin + url.pathname);
  for (const [name, value] of [...url.searchParams].sort(([a], [b]) =>
    a.localeCompare(b),
  ))
    key.searchParams.append(name, value);
  key.searchParams.set('__origin', request.headers.get('origin') ?? '');
  return new Request(key.toString(), { method: 'GET' });
}

/**
 * Serves a cached public read or produces it and stores a successful,
 * publicly cacheable answer (the store runs after the response, through
 * `defer`). Anything else passes straight to `produce`.
 */
export async function withPublicCache(
  request: Request,
  cache: EdgeCache | undefined,
  produce: () => Promise<Response>,
  defer: (work: Promise<unknown>) => void,
): Promise<Response> {
  const key = cache === undefined ? undefined : publicCacheKey(request);
  if (cache === undefined || key === undefined) return produce();
  const hit = await cache.match(key).catch(() => undefined);
  if (hit !== undefined) return hit;
  const response = await produce();
  const control = response.headers.get('cache-control') ?? '';
  if (response.status === 200 && /\bpublic\b/.test(control))
    defer(cache.put(key, response.clone()).catch(() => undefined));
  return response;
}
