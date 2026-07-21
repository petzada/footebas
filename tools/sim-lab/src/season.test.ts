import { describe, expect, it } from 'vitest';
import { runPhaseOneGate, runSeasonStress } from './gate.js';
import { runPlaythrough } from './playthrough.js';
import { runSeason } from './season.js';

describe('phase one season gate', () => {
  it('closes a canonical eight-club double round robin', () => {
    const report = runSeason();
    expect(report).toMatchObject({ clubs: 8, players: 200, rounds: 14, matches: 56, passed: true });
    expect(report.standings).toHaveLength(8);
    expect(report.standings.every(({ played }) => played === 14)).toBe(true);
  });

  it('keeps a smaller CI stress sample invariant-safe', () => {
    expect(runSeasonStress(10)).toEqual([]);
  }, 30_000);

  it('records an adversarial full playthrough and measurable proxies', () => {
    const report = runPlaythrough();
    expect(report.passed).toBe(true);
    expect(report.decisions).toHaveLength(14);
    expect(report.proxies.changedOutcomesVersusBalanced).toBeGreaterThan(0);
  });

  it('aggregates the gate with configurable small test counts', () => {
    const report = runPhaseOneGate(1_000, 2);
    expect(report).toMatchObject({ matches: 1_000, seasons: 2, seasonMatches: 112, passed: true });
  }, 30_000);
});
