// Rate limiting (Fase 9): a port with the Workers Rate Limiting binding as the
// production adapter and a fixed-window fake for tests. Keys never carry raw
// identifiers: authenticated callers are keyed by a hash of the bearer (no
// second JWT validation here) and anonymous callers by a hash of the IP.
import type { RequestIdentity } from './request-identity.js';

/** `command`: POST writes; `read`: authenticated GETs; `public`: anonymous, per IP. */
export type RateLimitBucket = 'command' | 'read' | 'public';

export interface RateLimitDecision {
  readonly allowed: boolean;
  /** Seconds to wait before retrying; 0 when allowed. */
  readonly retryAfterSeconds: number;
}

export interface RateLimiterPort {
  limit(bucket: RateLimitBucket, key: string): Promise<RateLimitDecision>;
}

/** Workers Rate Limiting binding (`ratelimits` in wrangler.jsonc). */
export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/** Window used by every binding in wrangler.jsonc (Cloudflare allows 10 or 60). */
export const RATE_LIMIT_PERIOD_SECONDS = 60;

/**
 * Requests per window and key. Mirrors `ratelimits` in apps/api/wrangler.jsonc
 * (the binding config is the source of truth in production).
 */
export const RATE_LIMITS: Readonly<Record<RateLimitBucket, number>> = {
  command: 60,
  read: 600,
  public: 120,
};

const ALLOWED: RateLimitDecision = { allowed: true, retryAfterSeconds: 0 };

/** Routes that never count: health probes and the signed Woovi webhook. */
const EXEMPT_ROUTES = new Set(['/health', '/v1/billing/webhook']);

export class WorkersRateLimiter implements RateLimiterPort {
  public constructor(
    private readonly bindings: Readonly<
      Partial<Record<RateLimitBucket, RateLimitBinding | undefined>>
    >,
    private readonly periodSeconds = RATE_LIMIT_PERIOD_SECONDS,
  ) {}

  public async limit(
    bucket: RateLimitBucket,
    key: string,
  ): Promise<RateLimitDecision> {
    const binding = this.bindings[bucket];
    // Missing binding (local tooling, tests) or a binding failure fails open:
    // rate limiting protects capacity, it must not take the API down.
    if (binding === undefined) return ALLOWED;
    try {
      const { success } = await binding.limit({ key });
      return success
        ? ALLOWED
        : { allowed: false, retryAfterSeconds: this.periodSeconds };
    } catch {
      return ALLOWED;
    }
  }
}

/** Deterministic fixed-window limiter for tests and local servers. */
export class FakeRateLimiter implements RateLimiterPort {
  public readonly calls: { bucket: RateLimitBucket; key: string }[] = [];
  private readonly windows = new Map<
    string,
    { startedAt: number; count: number }
  >();

  public constructor(
    private readonly limits: Readonly<
      Record<RateLimitBucket, number>
    > = RATE_LIMITS,
    private readonly options: Readonly<{
      periodSeconds?: number;
      now?: () => number;
    }> = {},
  ) {}

  public limit(
    bucket: RateLimitBucket,
    key: string,
  ): Promise<RateLimitDecision> {
    this.calls.push({ bucket, key });
    const period =
      (this.options.periodSeconds ?? RATE_LIMIT_PERIOD_SECONDS) * 1000;
    const now = (this.options.now ?? Date.now)();
    const id = `${bucket}:${key}`;
    let window = this.windows.get(id);
    if (window === undefined || now - window.startedAt >= period) {
      window = { startedAt: now, count: 0 };
      this.windows.set(id, window);
    }
    window.count += 1;
    if (window.count <= this.limits[bucket]) return Promise.resolve(ALLOWED);
    const remainingMs = window.startedAt + period - now;
    return Promise.resolve({
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
    });
  }
}

/** Which bucket a request counts against; `undefined` means exempt. */
export function rateLimitBucket(
  method: string,
  route: string | undefined,
  authenticated: boolean,
): RateLimitBucket | undefined {
  if (method === 'OPTIONS') return undefined;
  if (route !== undefined && EXEMPT_ROUTES.has(route)) return undefined;
  if (!authenticated) return 'public';
  return method === 'GET' || method === 'HEAD' ? 'read' : 'command';
}

/** Rate limit key for an identity: bearer hash, else IP hash. */
export function rateLimitKey(identity: RequestIdentity): string {
  return identity.bearerHash !== undefined
    ? `user:${identity.bearerHash}`
    : `ip:${identity.ipHash ?? 'unknown'}`;
}

/** Guard plugged into `createFetchHandler` (runs after route matching). */
export function rateLimitGuard(
  limiter: RateLimiterPort,
  identity: RequestIdentity,
): (request: Request, route: string | undefined) => Promise<RateLimitDecision> {
  return async (request, route) => {
    const bucket = rateLimitBucket(
      request.method,
      route,
      identity.bearerHash !== undefined,
    );
    if (bucket === undefined) return ALLOWED;
    return limiter.limit(bucket, rateLimitKey(identity));
  };
}
