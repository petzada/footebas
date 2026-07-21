/* eslint-disable @typescript-eslint/no-non-null-assertion -- fixed synthetic season fixtures */
import {
  GameDate,
  createPlayer,
  entityId,
  money,
  percentage,
  strength,
  type ClubId,
  type Fixture,
  type MatchInput,
  type MatchResult,
  type Player,
} from '@footebas/domain';
import { describe, expect, it } from 'vitest';
import { generateDoubleRoundRobin } from './league.js';
import { advanceRound, createSeasonState, type SeasonState } from './season.js';

const clubIds: ClubId[] = Array.from({ length: 8 }, (_, index) =>
  entityId(`season_club_${String(index + 1)}`, 'club'),
);
const players: Player[] = clubIds.map((clubId, index) =>
  createPlayer({
    id: entityId(`season_player_${String(index + 1)}`, 'player'),
    name: `Player ${String(index + 1)}`,
    age: 25,
    position: 'GK',
    secondaryPositions: [],
    strength: strength(70),
    traits: [],
    hidden: {
      potential: percentage(70),
      consistency: percentage(70),
      injuryProneness: percentage(20),
      adaptation: percentage(70),
      professionalism: percentage(70),
      bigGame: percentage(60),
    },
    morale: percentage(index === 0 ? 100 : 50),
    condition: percentage(index === 0 ? 2 : 98),
    matchSharpness: percentage(99),
    value: money(0),
    salary: money(0),
    clubId,
    squadStatus: 'starter',
    injuryRounds: index === 1 ? 2 : 0,
    suspensionRounds: index === 2 ? 2 : 0,
    careerStats: {
      appearances: 0,
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
    },
  }),
);

function inputFactory(fixture: Fixture, state: SeasonState): MatchInput {
  const side = (clubId: ClubId) => {
    const player = state.players.find(
      (candidate) => candidate.clubId === clubId,
    )!;
    return {
      club: { id: clubId },
      players: [player],
      lineup: {
        starters: [{ playerId: player.id, position: 'GK' }],
        substitutes: [],
      },
      tactic: {},
    };
  };
  return {
    fixtureId: fixture.id,
    seed: `round-${String(fixture.round)}`,
    engineVersion: 'test',
    rulesVersion: 'test',
    home: side(fixture.homeClubId),
    away: side(fixture.awayClubId),
  } as unknown as MatchInput;
}

function simulator(input: MatchInput): MatchResult {
  const homePlayer = input.home.players[0]!;
  return {
    matchId: entityId(`match_${input.fixtureId}`, 'match'),
    fixtureId: input.fixtureId,
    homeGoals: 1,
    awayGoals: 0,
    home: {
      shots: 1,
      shotsOnTarget: 1,
      possession: 50,
      yellowCards: 0,
      redCards: 1,
      xg: 1,
    },
    away: {
      shots: 0,
      shotsOnTarget: 0,
      possession: 50,
      yellowCards: 0,
      redCards: 0,
      xg: 0,
    },
    timeline: [
      {
        type: 'injury',
        minute: 30,
        side: 'home',
        playerId: homePlayer.id,
        rounds: 2,
      },
      {
        type: 'card',
        minute: 31,
        side: 'home',
        playerId: homePlayer.id,
        card: 'red',
      },
      { type: 'goal', minute: 32, side: 'home', scorerId: homePlayer.id },
    ],
    seed: input.seed,
    engineVersion: input.engineVersion,
  };
}

describe('season progression', () => {
  it('advances a complete deterministic season and produces a champion', () => {
    const fixtures = generateDoubleRoundRobin(
      entityId('season_competition', 'competition'),
      clubIds,
      GameDate.parse('2026-01-03'),
    );
    let state = createSeasonState(fixtures, players);
    while (!state.complete)
      state = advanceRound(state, inputFactory, simulator);
    expect(state.round).toBe(14);
    expect(state.results).toHaveLength(56);
    expect(state.fixtures.every(({ status }) => status === 'played')).toBe(
      true,
    );
    expect(state.table.champion).toBeDefined();
    expect(state.table.standings.every(({ played }) => played === 14)).toBe(
      true,
    );
    expect(advanceRound(state, inputFactory, simulator)).toBe(state);
  });

  it('keeps condition, morale, sharpness, injuries, and suspensions bounded', () => {
    const fixtures = generateDoubleRoundRobin(
      entityId('bounded_competition', 'competition'),
      clubIds,
      GameDate.parse('2026-01-03'),
    );
    const initial = createSeasonState(fixtures, players);
    const advanced = advanceRound(initial, inputFactory, simulator);
    expect(initial.players[0]!.condition).toBe(2);
    expect(
      advanced.players.every(
        (player) =>
          Number(player.condition) >= 0 &&
          Number(player.condition) <= 100 &&
          Number(player.morale) >= 0 &&
          Number(player.morale) <= 100 &&
          Number(player.matchSharpness) >= 0 &&
          Number(player.matchSharpness) <= 100 &&
          player.injuryRounds >= 0 &&
          player.suspensionRounds >= 0,
      ),
    ).toBe(true);
    expect(advanced.players[1]!.injuryRounds).toBeGreaterThanOrEqual(1);
    expect(advanced.players[2]!.suspensionRounds).toBe(1);
    expect(Object.isFrozen(advanced.players)).toBe(true);
  });
});
