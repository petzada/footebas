import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  canonicalJson,
  createClub,
  createCompetition,
  createFixture,
  createLineup,
  createMatchInput,
  createMatchResult,
  createPlayer,
  createTactic,
  DomainError,
  entityId,
  GameDate,
  money,
  percentage,
  strength,
} from './index.js';
import type {
  ClubId,
  Lineup,
  MatchStatistics,
  Player,
  PlayerId,
} from './index.js';

const playerId = (index: number): PlayerId =>
  entityId(`player_${String(index)}`, 'player');
const clubId = (name: string): ClubId => entityId(`club_${name}`, 'club');
const stats: MatchStatistics = {
  shots: 1,
  shotsOnTarget: 1,
  possession: 50,
  yellowCards: 0,
  redCards: 0,
  xg: 0.2,
};

function player(index: number, club?: ClubId): Player {
  return createPlayer({
    id: playerId(index),
    name: `Jogador ${String(index)}`,
    age: 24,
    position: index % 12 === 0 ? 'GK' : 'CM',
    secondaryPositions: [],
    strength: strength(70),
    traits: [],
    hidden: {
      potential: percentage(70),
      consistency: percentage(70),
      injuryProneness: percentage(10),
      adaptation: percentage(70),
      professionalism: percentage(70),
      bigGame: percentage(70),
    },
    morale: percentage(70),
    condition: percentage(100),
    matchSharpness: percentage(80),
    value: money(0),
    salary: money(0),
    ...(club === undefined ? {} : { clubId: club }),
    squadStatus: 'starter',
    injuryRounds: 0,
    suspensionRounds: 0,
    careerStats: {
      appearances: 0,
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
    },
  });
}

function players(offset: number, club: ClubId): readonly Player[] {
  return Array.from({ length: 12 }, (_, index) => player(offset + index, club));
}

function lineup(club: ClubId, offset = 0): Lineup {
  return createLineup({
    clubId: club,
    starters: Array.from({ length: 11 }, (_, index) => ({
      playerId: playerId(offset + index),
      position: index === 0 ? ('GK' as const) : ('CM' as const),
    })),
    substitutes: [playerId(offset + 11)],
    captainId: playerId(offset + 1),
  });
}

describe('bounded value objects', () => {
  it('accept their complete integer domains and reject values immediately outside', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (value) => strength(value) === value,
      ),
    );
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (value) => percentage(value) === value,
      ),
    );
    fc.assert(
      fc.property(
        fc.integer({
          min: Number.MIN_SAFE_INTEGER,
          max: Number.MAX_SAFE_INTEGER,
        }),
        (value) => money(value) === value,
      ),
    );
    for (const value of [0, 101, 1.5, Number.NaN])
      expect(() => strength(value)).toThrow(DomainError);
    for (const value of [-1, 101, 0.5, Number.POSITIVE_INFINITY])
      expect(() => percentage(value)).toThrow(DomainError);
  });
});

describe('Player', () => {
  const valid: Player = {
    id: playerId(1),
    name: 'Jogador',
    age: 24,
    position: 'ST',
    secondaryPositions: ['RW'],
    strength: strength(75),
    traits: ['pace', 'finishing'],
    hidden: {
      potential: percentage(80),
      consistency: percentage(70),
      injuryProneness: percentage(10),
      adaptation: percentage(60),
      professionalism: percentage(90),
      bigGame: percentage(75),
    },
    morale: percentage(70),
    condition: percentage(100),
    matchSharpness: percentage(85),
    value: money(1_000_00),
    salary: money(5_000_00),
    squadStatus: 'starter',
    injuryRounds: 0,
    suspensionRounds: 0,
    careerStats: {
      appearances: 10,
      goals: 4,
      assists: 2,
      yellowCards: 1,
      redCards: 0,
    },
  };
  it('copies and freezes nested mutable inputs', () => {
    const input = {
      ...valid,
      traits: [...valid.traits],
      secondaryPositions: [...valid.secondaryPositions],
    };
    const player = createPlayer(input);
    input.traits.pop();
    expect(player.traits).toEqual(['pace', 'finishing']);
    expect(Object.isFrozen(player.hidden)).toBe(true);
  });
  it('enforces the compact visible model', () => {
    expect(() =>
      createPlayer({ ...valid, traits: ['pace', 'finishing', 'heading'] }),
    ).toThrow(DomainError);
    expect(() =>
      createPlayer({ ...valid, secondaryPositions: ['ST'] }),
    ).toThrow(DomainError);
  });
});

describe('lineup and fixtures', () => {
  it('requires eleven unique starters, one goalkeeper and a starting captain', () => {
    expect(lineup(clubId('a')).starters).toHaveLength(11);
    expect(() =>
      createLineup({
        ...lineup(clubId('a')),
        starters: lineup(clubId('a')).starters.slice(1),
      }),
    ).toThrow(DomainError);
  });
  it('enforces fixture state as a discriminated invariant', () => {
    const base = {
      id: entityId('fixture_1', 'fixture'),
      competitionId: entityId('competition_1', 'competition'),
      round: 1,
      date: GameDate.parse('2026-01-01'),
      homeClubId: clubId('a'),
      awayClubId: clubId('b'),
    };
    expect(
      createFixture({ ...base, status: 'scheduled' }).matchId,
    ).toBeUndefined();
    expect(() => createFixture({ ...base, status: 'played' })).toThrow(
      DomainError,
    );
  });
});

describe('competition and match contracts', () => {
  it('validates every tactic option at runtime', () => {
    expect(
      createTactic({
        formation: '4-4-2',
        mentality: 'balanced',
        attackDirection: 'center',
        marking: 'light',
      }),
    ).toEqual({
      formation: '4-4-2',
      mentality: 'balanced',
      attackDirection: 'center',
      marking: 'light',
    });
    for (const field of [
      'formation',
      'mentality',
      'attackDirection',
      'marking',
    ] as const) {
      expect(() =>
        createTactic({
          formation: '4-4-2',
          mentality: 'balanced',
          attackDirection: 'center',
          marking: 'light',
          [field]: 'invalid',
        } as never),
      ).toThrow(DomainError);
    }
  });
  it('rejects duplicate participants for arbitrary list sizes', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 40 }), (size) => {
        const ids = Array.from({ length: size }, (_, index) =>
          clubId(`c${String(index)}`),
        );
        const duplicate = clubId('c0');
        expect(
          createCompetition({
            id: entityId(`competition_${String(size)}`, 'competition'),
            name: 'Liga',
            clubIds: ids,
            format: {
              type: 'double_round_robin',
              pointsForWin: 3,
              pointsForDraw: 1,
              pointsForLoss: 0,
            },
          }).clubIds,
        ).toHaveLength(size);
        expect(() =>
          createCompetition({
            id: entityId(`competition_dup${String(size)}`, 'competition'),
            name: 'Liga',
            clubIds: [...ids, duplicate],
            format: { type: 'knockout', legs: 1 },
          }),
        ).toThrow(DomainError);
      }),
    );
  });
  it('produces canonically serializable inputs and validates result score against timeline', () => {
    const homeId = clubId('home');
    const awayId = clubId('away');
    const home = createClub({
      id: homeId,
      name: 'Home',
      shortName: 'HOM',
      squad: lineup(homeId).starters.map((slot) => slot.playerId),
      balance: money(0),
      reputation: percentage(50),
    });
    const away = createClub({
      id: awayId,
      name: 'Away',
      shortName: 'AWY',
      squad: lineup(awayId, 20).starters.map((slot) => slot.playerId),
      balance: money(0),
      reputation: percentage(50),
    });
    const input = createMatchInput({
      fixtureId: entityId('fixture_1', 'fixture'),
      seed: 'seed-1',
      engineVersion: '1',
      rulesVersion: '1',
      home: {
        club: home,
        lineup: lineup(homeId),
        tactic: {
          formation: '4-4-2',
          mentality: 'balanced',
          attackDirection: 'center',
          marking: 'light',
        },
        players: players(0, homeId),
      },
      away: {
        club: away,
        lineup: lineup(awayId, 20),
        tactic: {
          formation: '4-3-3',
          mentality: 'counter_attack',
          attackDirection: 'wings',
          marking: 'heavy',
        },
        players: players(20, awayId),
      },
    });
    expect(() => canonicalJson(input)).not.toThrow();
    expect(Object.isFrozen(input.home.players)).toBe(true);
    expect(Object.isFrozen(input.home.players[0]?.hidden)).toBe(true);
    const result = createMatchResult({
      matchId: entityId('match_1', 'match'),
      fixtureId: input.fixtureId,
      homeGoals: 1,
      awayGoals: 0,
      home: stats,
      away: stats,
      timeline: [
        { type: 'goal', minute: 42, side: 'home', scorerId: playerId(1) },
      ],
      seed: input.seed,
      engineVersion: input.engineVersion,
    });
    expect(result.homeGoals).toBe(1);
    expect(() => createMatchResult({ ...result, awayGoals: 1 })).toThrow(
      DomainError,
    );
    expect(() =>
      createMatchResult(
        {
          ...result,
          timeline: [
            { type: 'goal', minute: 42, side: 'away', scorerId: playerId(1) },
          ],
          homeGoals: 0,
          awayGoals: 1,
        },
        input,
      ),
    ).toThrow(DomainError);
    expect(createMatchResult(result, input).timeline).toHaveLength(1);
  });
  it('validates snapshot coverage, ownership, uniqueness and side separation', () => {
    fc.assert(
      fc.property(fc.integer({ min: 100, max: 10_000 }), (offset) => {
        const homeId = clubId(`home${String(offset)}`);
        const awayId = clubId(`away${String(offset)}`);
        const homeLineup = lineup(homeId, offset);
        const awayLineup = lineup(awayId, offset + 20);
        const homeClub = createClub({
          id: homeId,
          name: 'Home',
          shortName: 'H',
          squad: [],
          balance: money(0),
          reputation: percentage(50),
        });
        const awayClub = createClub({
          id: awayId,
          name: 'Away',
          shortName: 'A',
          squad: [],
          balance: money(0),
          reputation: percentage(50),
        });
        const base = {
          fixtureId: entityId(`fixture_${String(offset)}`, 'fixture'),
          seed: 's',
          engineVersion: '1',
          rulesVersion: '1',
          home: {
            club: homeClub,
            lineup: homeLineup,
            tactic: createTactic({
              formation: '4-4-2',
              mentality: 'balanced',
              attackDirection: 'center',
              marking: 'light',
            }),
            players: players(offset, homeId),
          },
          away: {
            club: awayClub,
            lineup: awayLineup,
            tactic: createTactic({
              formation: '4-3-3',
              mentality: 'counter_attack',
              attackDirection: 'wings',
              marking: 'heavy',
            }),
            players: players(offset + 20, awayId),
          },
        };
        expect(createMatchInput(base).home.players).toHaveLength(12);
        expect(() =>
          createMatchInput({
            ...base,
            home: { ...base.home, players: base.home.players.slice(1) },
          }),
        ).toThrow(DomainError);
        expect(() =>
          createMatchInput({
            ...base,
            home: {
              ...base.home,
              players: [...base.home.players, ...base.home.players.slice(0, 1)],
            },
          }),
        ).toThrow(DomainError);
        expect(() =>
          createMatchInput({
            ...base,
            home: {
              ...base.home,
              players: [player(offset, awayId), ...base.home.players.slice(1)],
            },
          }),
        ).toThrow(DomainError);
        expect(() =>
          createMatchInput({
            ...base,
            away: {
              ...base.away,
              players: [...base.away.players, player(offset)],
            },
          }),
        ).toThrow(DomainError);
      }),
      { numRuns: 25 },
    );
  });
});
