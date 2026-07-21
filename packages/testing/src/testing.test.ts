import { describe, expect, it } from 'vitest';
import {
  expectCanonicalEquivalent,
  matchInputFactory,
  squadFactory,
  TEST_SEEDS,
} from './index.js';

describe('deterministic testing helpers', () => {
  it('exposes versioned named seeds', () => {
    expect(TEST_SEEDS.phaseZeroSmoke).toBe('phase-zero-smoke-v1');
  });

  it('compares values canonically', () => {
    expect(() =>
      expectCanonicalEquivalent({ b: 2, a: 1 }, { a: 1, b: 2 }),
    ).not.toThrow();
  });

  it('creates deterministic valid squads and match inputs', () => {
    expect(squadFactory()).toEqual(squadFactory());
    const match = matchInputFactory({ seed: 'factory-seed', homeStrength: 80 });
    expect(match.home.lineup.starters).toHaveLength(11);
    expect(match.home.players).toHaveLength(16);
    expect(match).toEqual(
      matchInputFactory({ seed: 'factory-seed', homeStrength: 80 }),
    );
  });
});
