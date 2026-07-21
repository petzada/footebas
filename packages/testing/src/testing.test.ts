import { describe, expect, it } from 'vitest';
import { expectCanonicalEquivalent, TEST_SEEDS } from './index.js';

describe('deterministic testing helpers', () => {
  it('exposes versioned named seeds', () => {
    expect(TEST_SEEDS.phaseZeroSmoke).toBe('phase-zero-smoke-v1');
  });

  it('compares values canonically', () => {
    expect(() =>
      expectCanonicalEquivalent({ b: 2, a: 1 }, { a: 1, b: 2 }),
    ).not.toThrow();
  });
});
