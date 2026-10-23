import { canonicalJson } from '@footebas/domain';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { loadCareerWorldContent } from './career-content.js';
import { runPhaseFourGate } from './phase4.js';

describe('phase four long-horizon gate', () => {
  it('adapts exactly two real-identity divisions with derived provenance', () => {
    const content = loadCareerWorldContent();
    expect(content.clubs).toHaveLength(40);
    expect(
      content.clubs.every(
        ({ players }) => players.length >= 22 && players.length <= 24,
      ),
    ).toBe(true);
    expect(
      content.clubs
        .flatMap(({ players }) => players)
        .every(
          (player) =>
            player.identitySourceId.startsWith('dados/elencos/') &&
            player.attributesVersion.length > 0,
        ),
    ).toBe(true);
  });

  it('keeps the world in explicit bands for twenty seasons', () => {
    const report = runPhaseFourGate({ seasons: 20, seed: 'phase4-test-v1' });
    expect(report.failures).toEqual([]);
    expect(report.passed).toBe(true);
    expect(report.archive.seasons).toBe(15);
  }, 180_000);

  it('is exactly deterministic across a long horizon except for runtime', () => {
    const first = runPhaseFourGate({ seasons: 20, seed: 'phase4-replay-v1' });
    const second = runPhaseFourGate({ seasons: 20, seed: 'phase4-replay-v1' });
    expect(canonicalJson({ ...first, elapsedMs: 0 })).toBe(
      canonicalJson({ ...second, elapsedMs: 0 }),
    );
  }, 180_000);

  it('holds the versioned invariants across generated seeds', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const report = runPhaseFourGate({
          seasons: 20,
          seed: `phase4-property-${String(seed)}`,
        });
        return report.passed && report.failures.length === 0;
      }),
      { numRuns: 3, seed: 4_204_026 },
    );
  }, 180_000);
});
