/* eslint-disable @typescript-eslint/no-non-null-assertion -- synthetic cardinalities are asserted by the tests */
import {
  createCompetitionDefinition,
  entityId,
  type ClubId,
  type CompetitionCalendarFixture,
  type CompetitionDefinition,
  type CompetitionId,
  type CompetitionMatchResult,
  type CompetitionOutcome,
  type CompetitionStage,
} from '@footebas/domain';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  assertValidCompetitionCalendar,
  InvalidCalendarError,
  validateCompetitionCalendar,
} from './calendar.js';
import {
  evaluateKnockoutRound,
  evaluateRankingStage,
  generateCompetitionAwards,
  generateNextSeason,
  resolveStageParticipants,
  scheduleCompetitionStage,
} from './competition.js';
import {
  BRAZILIAN_RANKING_RULE,
  createMvpCompetitionSystem,
} from './mvp-competitions.js';

const clubs = (prefix: string, count: number): ClubId[] =>
  Array.from({ length: count }, (_, index) =>
    entityId(`${prefix}_${String(index + 1)}`, 'club'),
  );

const result = (
  fixture: CompetitionCalendarFixture,
  homeGoals: number,
  awayGoals: number,
  penalties?: readonly [number, number],
): CompetitionMatchResult => ({
  fixtureId: fixture.id,
  homeGoals,
  awayGoals,
  ...(penalties === undefined
    ? {}
    : { homePenaltyGoals: penalties[0], awayPenaltyGoals: penalties[1] }),
});

function definition(
  stage: CompetitionStage,
  competitionId: CompetitionId = entityId('generic_competition', 'competition'),
): CompetitionDefinition {
  return createCompetitionDefinition({
    id: competitionId,
    name: 'Generic competition',
    tier: 'national_league',
    stages: [stage],
    awards: [],
  });
}

const leagueStage: Extract<CompetitionStage, { type: 'league' }> = {
  id: 'league',
  name: 'League',
  type: 'league',
  participantSource: { type: 'seeded' },
  schedule: { firstDate: '2026-03-08', intervalDays: 7 },
  roundRobin: 'double',
  ranking: BRAZILIAN_RANKING_RULE,
};

function outcome(
  competitionId: CompetitionId,
  stageId: string,
  orderedClubIds: readonly ClubId[],
  edition = 2026,
): CompetitionOutcome {
  return {
    competitionId,
    edition,
    stages: [{ stageId, orderedClubIds }],
    championId: orderedClubIds[0]!,
    ...(orderedClubIds[1] === undefined
      ? {}
      : { runnerUpId: orderedClubIds[1] }),
  };
}

describe('data-driven competition stages', () => {
  it('schedules and ranks odd or even league sizes with complete home/away symmetry', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 12 }),
        fc.array(
          fc.tuple(
            fc.integer({ min: 0, max: 6 }),
            fc.integer({ min: 0, max: 6 }),
          ),
          {
            minLength: 132,
            maxLength: 132,
          },
        ),
        (count, scores) => {
          const participants = clubs('property_club', count);
          const configured = definition(leagueStage);
          const scheduled = scheduleCompetitionStage(
            configured,
            'league',
            participants,
          );
          expect(scheduled.fixtures).toHaveLength(count * (count - 1));
          const results = scheduled.fixtures.map((fixture, index) =>
            result(fixture, scores[index]![0], scores[index]![1]),
          );
          const stageOutcome = evaluateRankingStage(
            leagueStage,
            participants,
            scheduled.fixtures,
            results,
            'property-seed',
          );
          expect(stageOutcome.orderedClubIds).toHaveLength(count);
          expect(new Set(stageOutcome.orderedClubIds).size).toBe(count);
          expect(
            stageOutcome.standings!.every(
              ({ played }) => played === (count - 1) * 2,
            ),
          ).toBe(true);
          expect(
            stageOutcome.standings!.reduce((sum, row) => sum + row.goalsFor, 0),
          ).toBe(
            stageOutcome.standings!.reduce(
              (sum, row) => sum + row.goalsAgainst,
              0,
            ),
          );
        },
      ),
      { numRuns: 60 },
    );
  });

  it('runs continental preliminaries, groups, and knockout using the same stage interpreter', () => {
    const continental = createMvpCompetitionSystem(2026, []).definitions.find(
      ({ id }) => id === 'continental',
    )!;
    const [preliminary, groupsStage, knockoutStage] = continental.stages;
    expect(preliminary?.type).toBe('knockout');
    expect(groupsStage?.type).toBe('groups');
    expect(knockoutStage?.type).toBe('knockout');
    if (
      preliminary?.type !== 'knockout' ||
      groupsStage?.type !== 'groups' ||
      knockoutStage?.type !== 'knockout'
    )
      throw new Error('Unexpected continental configuration');

    const preliminaryClubs = clubs('pre_club', 8);
    const preliminarySchedule = scheduleCompetitionStage(
      continental,
      'preliminary',
      preliminaryClubs,
    );
    const preliminaryOutcome = evaluateKnockoutRound(
      preliminary,
      preliminarySchedule.fixtures,
      preliminarySchedule.fixtures.map((fixture) => result(fixture, 1, 0)),
      'continental-pre',
    );
    const groupClubs = resolveStageParticipants(
      groupsStage,
      clubs('direct_club', 28),
      [preliminaryOutcome],
    );
    expect(groupClubs).toHaveLength(32);
    const groupSchedule = scheduleCompetitionStage(
      continental,
      'groups',
      groupClubs,
    );
    expect(groupSchedule.fixtures).toHaveLength(96);
    const groupOutcome = evaluateRankingStage(
      groupsStage,
      groupClubs,
      groupSchedule.fixtures,
      groupSchedule.fixtures.map((fixture, index) =>
        result(fixture, index % 4, (index * 3) % 5),
      ),
      'continental-groups',
    );
    expect(groupOutcome.orderedClubIds).toHaveLength(32);
    const qualified = resolveStageParticipants(
      knockoutStage,
      [],
      [groupOutcome],
    );
    expect(qualified).toHaveLength(16);
    expect(new Set(qualified).size).toBe(16);
  });

  it('closes one thousand deterministic knockout editions', () => {
    const cup = createMvpCompetitionSystem(2026, []).definitions.find(
      ({ id }) => id === 'copa_brasil',
    )!;
    const stage = cup.stages[0]!;
    if (stage.type !== 'knockout') throw new Error('Cup must be knockout');
    const entrants = clubs('cup_club', 8);
    const champions = new Set<ClubId>();
    for (let edition = 0; edition < 1_000; edition += 1) {
      let roundParticipants = entrants;
      let round = 1;
      while (roundParticipants.length > 1) {
        const scheduled = scheduleCompetitionStage(
          cup,
          stage.id,
          roundParticipants,
          { knockoutRound: round },
        );
        const stageOutcome = evaluateKnockoutRound(
          stage,
          scheduled.fixtures,
          scheduled.fixtures.map((fixture) => result(fixture, 0, 0)),
          `edition-${String(edition)}`,
        );
        roundParticipants = stageOutcome.orderedClubIds.slice(
          0,
          roundParticipants.length / 2,
        );
        round += 1;
      }
      champions.add(roundParticipants[0]!);
    }
    expect(champions.size).toBeGreaterThan(1);
  });
});

describe('strict calendar validation', () => {
  const participants = clubs('calendar_club', 4);
  const configured = definition(
    leagueStage,
    entityId('calendar_competition', 'competition'),
  );
  const fixtures = scheduleCompetitionStage(
    configured,
    'league',
    participants,
  ).fixtures;
  const base = {
    competitions: [configured],
    stageParticipants: { [configured.id]: { league: participants } },
    minimumIntervalDays: 3,
  } as const;

  it('accepts the generated calendar and rejects every required invalid mutation', () => {
    expect(validateCompetitionCalendar({ ...base, fixtures })).toEqual({
      valid: true,
      violations: [],
    });

    const invalidCalendars: readonly Readonly<{
      fixtures: readonly CompetitionCalendarFixture[];
      reservedDates?: readonly string[];
      code: string;
    }>[] = [
      { fixtures: [...fixtures, fixtures[0]!], code: 'DUPLICATE_FIXTURE_ID' },
      {
        fixtures: fixtures.map((fixture, index) =>
          index === 0
            ? { ...fixture, homeClubId: entityId('outsider_club', 'club') }
            : fixture,
        ),
        code: 'PARTICIPANT_NOT_REGISTERED',
      },
      {
        fixtures: fixtures.map((fixture, index) =>
          index === 0
            ? { ...fixture, awayClubId: fixture.homeClubId }
            : fixture,
        ),
        code: 'SELF_MATCH',
      },
      {
        fixtures: fixtures.map((fixture, index) =>
          index === 0 ? { ...fixture, date: '2026-02-30' } : fixture,
        ),
        code: 'INVALID_DATE',
      },
      { fixtures, reservedDates: [fixtures[0]!.date], code: 'RESERVED_DATE' },
      {
        fixtures: fixtures.map((fixture) =>
          fixture.round === 2
            ? { ...fixture, date: fixtures[0]!.date }
            : fixture,
        ),
        code: 'CLUB_DATE_CONFLICT',
      },
      {
        fixtures: fixtures.map((fixture) =>
          fixture.round === 2 ? { ...fixture, date: '2026-03-09' } : fixture,
        ),
        code: 'MINIMUM_INTERVAL',
      },
      {
        fixtures: fixtures.map((fixture, index) =>
          index === 0 ? { ...fixture, phaseOrder: 2 } : fixture,
        ),
        code: 'INVALID_PHASE_ORDER',
      },
      { fixtures: fixtures.slice(1), code: 'INVALID_PAIRING' },
      {
        fixtures: fixtures.map((fixture, index) => {
          if (index !== fixtures.length / 2) return fixture;
          const firstLeg = fixtures.find(
            (candidate) =>
              candidate.homeClubId === fixture.awayClubId &&
              candidate.awayClubId === fixture.homeClubId,
          )!;
          return {
            ...fixture,
            homeClubId: firstLeg.homeClubId,
            awayClubId: firstLeg.awayClubId,
          };
        }),
        code: 'INVALID_HOME_AWAY',
      },
    ];
    for (const invalid of invalidCalendars) {
      const validation = validateCompetitionCalendar({
        ...base,
        fixtures: invalid.fixtures,
        ...(invalid.reservedDates === undefined
          ? {}
          : { reservedDates: invalid.reservedDates }),
      });
      expect(validation.valid, invalid.code).toBe(false);
      expect(
        validation.violations.map(({ code }) => code),
        invalid.code,
      ).toContain(invalid.code);
      expect(() =>
        assertValidCompetitionCalendar({
          ...base,
          fixtures: invalid.fixtures,
          ...(invalid.reservedDates === undefined
            ? {}
            : { reservedDates: invalid.reservedDates }),
        }),
      ).toThrow(InvalidCalendarError);
    }
  });

  it('rejects a later phase that starts before its prerequisite finishes', () => {
    const phased = createCompetitionDefinition({
      id: entityId('phased_competition', 'competition'),
      name: 'Phased',
      tier: 'continental',
      stages: [
        { ...leagueStage, id: 'qualifying' },
        {
          id: 'final',
          name: 'Final',
          type: 'knockout',
          participantSource: {
            type: 'qualified',
            fromStageId: 'qualifying',
            positions: [1, 2],
          },
          schedule: { firstDate: '2026-03-10', intervalDays: 7 },
          legs: 1,
        },
      ],
      awards: [],
    });
    const qualifiers = participants.slice(0, 2);
    const qualifyingFixtures = scheduleCompetitionStage(
      phased,
      'qualifying',
      participants,
    ).fixtures;
    const finalFixtures = scheduleCompetitionStage(
      phased,
      'final',
      qualifiers,
    ).fixtures;
    const validation = validateCompetitionCalendar({
      fixtures: [...qualifyingFixtures, ...finalFixtures],
      competitions: [phased],
      stageParticipants: {
        [phased.id]: { qualifying: participants, final: qualifiers },
      },
    });
    expect(validation.violations.map(({ code }) => code)).toContain(
      'PHASE_OVERLAP',
    );
  });
});

describe('MVP pyramid and rewards', () => {
  it('describes three divisions, cup, content-defined states, and continental phases without tournament branches', () => {
    const system = createMvpCompetitionSystem(2026, ['sp', 'rj', 'mg', 'rs']);
    expect(system.definitions.map(({ id }) => id)).toEqual([
      'serie_a',
      'serie_b',
      'serie_c',
      'copa_brasil',
      'state_sp',
      'state_rj',
      'state_mg',
      'state_rs',
      'continental',
    ]);
    expect(
      system.definitions.find(({ id }) => id === 'state_sp')?.stages[0],
    ).toMatchObject({
      type: 'league',
      roundRobin: 'single',
    });
    expect(
      system.definitions
        .find(({ id }) => id === 'continental')
        ?.stages.map(({ type }) => type),
    ).toEqual(['knockout', 'groups', 'knockout']);
  });

  it('feeds promotions, relegations, qualifications, and vacancy fallback into the next season', () => {
    const system = createMvpCompetitionSystem(2026, []);
    const serieA = entityId('serie_a', 'competition');
    const serieB = entityId('serie_b', 'competition');
    const serieC = entityId('serie_c', 'competition');
    const cup = entityId('copa_brasil', 'competition');
    const continental = entityId('continental', 'competition');
    const a = clubs('a_club', 20);
    const b = clubs('b_club', 20);
    const c = clubs('c_club', 20);
    const support = clubs('continental_club', 32);
    const generated = generateNextSeason(
      [
        outcome(serieA, 'league', a),
        outcome(serieB, 'league', b),
        outcome(serieC, 'league', c),
        outcome(cup, 'knockout', [a[2]!, b[0]!]),
        outcome(continental, 'groups', support),
      ],
      system.nextSeasonAllocations,
    );
    expect(generated.participants.serie_a).toEqual([
      ...a.slice(0, 16),
      ...b.slice(0, 4),
    ]);
    expect(generated.participants.serie_b).toEqual([
      ...b.slice(4, 16),
      ...a.slice(16),
      ...c.slice(0, 4),
    ]);
    expect(generated.participants.serie_c).toEqual([
      ...c.slice(4),
      ...b.slice(16),
    ]);
    expect(generated.participants.continental).toHaveLength(32);
    expect(generated.participants.continental?.slice(0, 7)).toEqual([
      a[2],
      a[0],
      a[1],
      a[3],
      a[4],
      a[5],
      a[6],
    ]);
    expect(
      generated.events.filter(({ type }) => type === 'ClubPromoted'),
    ).toHaveLength(8);
    expect(
      generated.events.filter(({ type }) => type === 'ClubRelegated'),
    ).toHaveLength(8);
    expect(
      generated.events.filter(({ type }) => type === 'ClubQualified'),
    ).toHaveLength(7);
  });

  it('emits title, prize, and prestige domain events from configured awards', () => {
    const definition = createMvpCompetitionSystem(2026, []).definitions.find(
      ({ id }) => id === 'serie_a',
    )!;
    const ordered = clubs('award_club', 20);
    const events = generateCompetitionAwards(
      definition,
      outcome(definition.id, 'league', ordered),
    );
    expect(events).toEqual([
      {
        type: 'CompetitionWon',
        competitionId: definition.id,
        clubId: ordered[0],
        edition: 2026,
        stageId: 'league',
      },
      {
        type: 'PrizeAwarded',
        competitionId: definition.id,
        clubId: ordered[0],
        edition: 2026,
        amount: 5_000_000_000,
      },
      {
        type: 'PrestigeAwarded',
        competitionId: definition.id,
        clubId: ordered[0],
        edition: 2026,
        points: 100,
        achievement: 'league_title',
      },
    ]);
  });
});
