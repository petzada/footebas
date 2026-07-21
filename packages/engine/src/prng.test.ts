import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createPrng, hashSeed, PRNG_VERSION } from './index.js';

describe(PRNG_VERSION, () => {
  it('keeps its golden sequence stable', () => {
    const random = createPrng('footebas-phase-0');
    expect(Array.from({ length: 5 }, () => random.next())).toEqual([
      0.6404509483836591, 0.07405924214981496, 0.899139667628333,
      0.9384745780844241, 0.5092449286021292,
    ]);
  });

  it('is deterministic for every generated seed', () => {
    fc.assert(
      fc.property(fc.string(), (seed) => {
        const left = createPrng(seed);
        const right = createPrng(seed);
        expect(Array.from({ length: 20 }, () => left.next())).toEqual(
          Array.from({ length: 20 }, () => right.next()),
        );
      }),
    );
  });

  it('returns values in the requested inclusive integer range', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.integer({ min: -100, max: 100 }),
        (seed, min) => {
          const value = createPrng(hashSeed(seed)).nextInt(min, min + 20);
          expect(value).toBeGreaterThanOrEqual(min);
          expect(value).toBeLessThanOrEqual(min + 20);
        },
      ),
    );
  });
});
