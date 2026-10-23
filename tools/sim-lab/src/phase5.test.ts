import { describe, expect, it } from 'vitest';
import {
  loadPhaseFiveContent,
  parseCompetitionConfig,
} from './phase5-content.js';
import {
  initialReferenceState,
  simulateReferenceSeason,
  validateReferenceCalendar,
} from './phase5-reference.js';
import { runPhaseFiveGate } from './phase5.js';

describe('phase five Brazilian competition content', () => {
  it('adapts three real roster divisions and source-backed state membership', () => {
    const content = loadPhaseFiveContent();
    expect(content.clubs).toHaveLength(60);
    expect(content.config.nationalLeagues).toHaveLength(3);
    expect(content.config.stateLeagues).toHaveLength(5);
    expect(content.sourceIds).toEqual(
      expect.arrayContaining([
        'dados/elencos/brasileirao-serie-a-2026.md',
        'dados/elencos/brasileirao-serie-b-2026.md',
        'dados/elencos/brasileirao-serie-c-2026.md',
        'dados/elencos/estaduais-1a-divisao-2026.md',
        'dados/elencos/copa-do-brasil-2026.md',
        'dados/elencos/copa-libertadores-2026.md',
      ]),
    );
    expect(
      content.clubs.every(
        ({ provenance }) =>
          provenance.source.startsWith('dados/elencos/') &&
          provenance.heading.length > 0,
      ),
    ).toBe(true);
  });

  it('closes leagues, state tournaments, cup, and continental stages conflict-free', () => {
    const content = loadPhaseFiveContent();
    const result = simulateReferenceSeason(
      content,
      initialReferenceState(content),
      'phase5-one-season-v1',
    );
    expect(result.closures).toHaveLength(10);
    expect(
      result.closures.every(
        ({ championClubId, matches }) =>
          championClubId.length > 0 && matches > 0,
      ),
    ).toBe(true);
    expect(validateReferenceCalendar(result.fixtures, content.config)).toEqual(
      [],
    );
    expect(result.next.continentalDirect).toHaveLength(6);
    expect(result.next.continentalPreliminary).toHaveLength(4);
  });

  it('replays the same calendar, winners, and next season from the same seed', () => {
    const content = loadPhaseFiveContent();
    const state = initialReferenceState(content);
    const first = simulateReferenceSeason(content, state, 'phase5-replay-v1');
    const second = simulateReferenceSeason(content, state, 'phase5-replay-v1');
    expect(second).toEqual(first);
  });

  it('rejects invalid competition configuration before the season starts', () => {
    const config = loadPhaseFiveContent().config;
    expect(() =>
      parseCompetitionConfig({
        ...config,
        continental: { ...config.continental, groupSize: 5 },
      }),
    ).toThrow(/cardinality/);
    expect(() =>
      parseCompetitionConfig({
        ...config,
        nationalLeagues: config.nationalLeagues.map((league, index) => ({
          ...league,
          firstMatchDay: index === 0 ? config.seasonDays : league.firstMatchDay,
        })),
      }),
    ).toThrow(/outside the season/);
  });

  it('rejects simultaneous fixtures and insufficient rest', () => {
    const content = loadPhaseFiveContent();
    const result = simulateReferenceSeason(
      content,
      initialReferenceState(content),
      'phase5-invalid-calendar-v1',
    );
    const fixture = result.fixtures.at(0);
    if (fixture === undefined) throw new Error('Expected a generated fixture');
    expect(
      validateReferenceCalendar(
        [...result.fixtures, { ...fixture, id: 'injected-conflict' }],
        content.config,
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/simultaneous matches/),
        expect.stringMatching(/rest days/),
      ]),
    );
  });

  it('keeps the full pyramid valid across one thousand seasons', () => {
    const report = runPhaseFiveGate({
      seasons: 1_000,
      seed: 'phase5-thousand-season-test-v1',
    });
    expect(report.failures).toEqual([]);
    expect(report.passed).toBe(true);
    expect(report.competitionsPerSeason).toBe(10);
    expect(report.rejectionProbes).toEqual({
      invalidConfig: true,
      invalidCalendar: true,
    });
    expect(report.simulatedMatches).toBeGreaterThan(1_000_000);
  }, 300_000);
});
