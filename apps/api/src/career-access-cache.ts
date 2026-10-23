// Short-lived caches for the career Durable Object (ADR 0014): it serves
// every read of a career from memory, so the locked-career guard must not
// add two Postgres round trips to each request. Only answers that cannot
// hurt are cached: `licensed` (a purchase is never delayed, a revocation
// lands within the TTL) and the creation order of the user's careers.
import type {
  CareerSlotsPort,
  Entitlements,
  EntitlementsPort,
} from '@footebas/application';

/** Default lifetime of a cached answer. */
export const CAREER_ACCESS_TTL_MS = 30_000;

interface Entry<T> {
  readonly value: T;
  readonly until: number;
}

export function cachedLicensedEntitlements(
  inner: () => EntitlementsPort,
  ttlMs = CAREER_ACCESS_TTL_MS,
  now: () => number = Date.now,
): EntitlementsPort {
  const cache = new Map<string, Entry<Entitlements>>();
  return {
    async forUser(userId) {
      const hit = cache.get(userId);
      if (hit !== undefined && hit.until > now()) return hit.value;
      const value = await inner().forUser(userId);
      // `free` is never cached: paying unlocks on the very next request.
      if (value.plan === 'licensed')
        cache.set(userId, { value, until: now() + ttlMs });
      else cache.delete(userId);
      return value;
    },
  };
}

export function cachedCareerSlots(
  inner: () => CareerSlotsPort,
  ttlMs = CAREER_ACCESS_TTL_MS,
  now: () => number = Date.now,
): CareerSlotsPort {
  const cache = new Map<string, Entry<readonly string[]>>();
  return {
    async activeCareerIds(userId) {
      const hit = cache.get(userId);
      if (hit !== undefined && hit.until > now()) return hit.value;
      const value = await inner().activeCareerIds(userId);
      cache.set(userId, { value, until: now() + ttlMs });
      return value;
    },
  };
}
