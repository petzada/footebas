import {
  FREE_ENTITLEMENTS,
  LICENSED_ENTITLEMENTS,
} from '@footebas/application';
import { describe, expect, it } from 'vitest';
import {
  cachedCareerSlots,
  cachedLicensedEntitlements,
} from './career-access-cache.js';

describe('career access cache (Durable Object)', () => {
  it('caches only `licensed`, so paying unlocks on the next request', async () => {
    let now = 0;
    let plan: 'free' | 'licensed' = 'free';
    let reads = 0;
    const port = cachedLicensedEntitlements(
      () => ({
        forUser: () => {
          reads += 1;
          return Promise.resolve(
            plan === 'licensed' ? LICENSED_ENTITLEMENTS : FREE_ENTITLEMENTS,
          );
        },
      }),
      30_000,
      () => now,
    );
    expect((await port.forUser('u')).plan).toBe('free');
    plan = 'licensed';
    expect((await port.forUser('u')).plan).toBe('licensed');
    plan = 'free';
    // Revocation lands within the TTL.
    expect((await port.forUser('u')).plan).toBe('licensed');
    now = 30_001;
    expect((await port.forUser('u')).plan).toBe('free');
    expect(reads).toBe(3);
  });

  it('caches the creation order for the TTL', async () => {
    let now = 0;
    let reads = 0;
    const port = cachedCareerSlots(
      () => ({
        activeCareerIds: () => {
          reads += 1;
          return Promise.resolve(['a', 'b']);
        },
      }),
      30_000,
      () => now,
    );
    await port.activeCareerIds('u');
    await port.activeCareerIds('u');
    now = 31_000;
    expect(await port.activeCareerIds('u')).toEqual(['a', 'b']);
    expect(reads).toBe(2);
  });
});
