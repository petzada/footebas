import { canonicalJson } from '@footebas/domain';

export const TEST_SEEDS = Object.freeze({
  goldenMatch: 'golden-match-v1',
  phaseZeroSmoke: 'phase-zero-smoke-v1',
  syntheticSeason: 'synthetic-season-v1',
});

export function expectCanonicalEquivalent(left: unknown, right: unknown): void {
  if (canonicalJson(left) !== canonicalJson(right)) {
    throw new Error(
      `Canonical values differ:\n${canonicalJson(left)}\n${canonicalJson(right)}`,
    );
  }
}
