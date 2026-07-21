/* eslint-disable @typescript-eslint/no-non-null-assertion -- contiguous rounds and paired fixture/result arrays are validated */
import {
  createFixture,
  createPlayer,
  percentage,
  type ClubId,
  type Fixture,
  type MatchInput,
  type MatchResult,
  type Player,
  type PlayerId,
} from '@footebas/domain';
import { LeagueTable, type LeagueRules } from './league.js';
import { simulateMatch } from './match.js';

export interface SeasonState {
  readonly round: number;
  readonly fixtures: readonly Fixture[];
  readonly players: readonly Player[];
  readonly results: readonly MatchResult[];
  readonly table: LeagueTable;
  readonly complete: boolean;
}

export type MatchInputFactory = (
  fixture: Fixture,
  state: SeasonState,
) => MatchInput;
export type MatchSimulator = (input: MatchInput) => MatchResult;

export function createSeasonState(
  fixtures: readonly Fixture[],
  players: readonly Player[],
  rules?: LeagueRules,
): SeasonState {
  if (fixtures.length === 0) throw new Error('Season requires fixtures');
  const clubIds = [
    ...new Set(
      fixtures.flatMap((fixture) => [fixture.homeClubId, fixture.awayClubId]),
    ),
  ];
  const rounds = new Set(fixtures.map(({ round }) => round));
  const maxRound = Math.max(...rounds);
  if (rounds.size !== maxRound || [...rounds].some((round) => round < 1))
    throw new Error('Season rounds must be contiguous from one');
  return freezeSeason({
    round: 0,
    fixtures,
    players,
    results: [],
    table: new LeagueTable(clubIds, rules),
    complete: false,
  });
}

function freezeSeason(state: SeasonState): SeasonState {
  return Object.freeze({
    ...state,
    fixtures: Object.freeze([...state.fixtures]),
    players: Object.freeze([...state.players]),
    results: Object.freeze([...state.results]),
  });
}

const clamp = (value: number): number => Math.max(0, Math.min(100, value));

function evolvePlayers(
  players: readonly Player[],
  inputs: readonly MatchInput[],
  results: readonly MatchResult[],
): readonly Player[] {
  const starters = new Set<PlayerId>();
  const substitutesUsed = new Set<PlayerId>();
  const outcome = new Map<ClubId, -1 | 0 | 1>();
  const injuries = new Map<PlayerId, number>();
  const suspensions = new Set<PlayerId>();
  for (let index = 0; index < inputs.length; index += 1) {
    const input = inputs[index]!;
    const result = results[index]!;
    for (const side of [input.home, input.away])
      for (const slot of side.lineup.starters) starters.add(slot.playerId);
    const sign = Math.sign(result.homeGoals - result.awayGoals) as -1 | 0 | 1;
    outcome.set(input.home.club.id, sign);
    outcome.set(input.away.club.id, sign === 0 ? 0 : sign === 1 ? -1 : 1);
    for (const event of result.timeline) {
      if (event.type === 'substitution') substitutesUsed.add(event.playerInId);
      if (event.type === 'injury')
        injuries.set(
          event.playerId,
          Math.max(injuries.get(event.playerId) ?? 0, event.rounds),
        );
      if (event.type === 'card' && event.card === 'red')
        suspensions.add(event.playerId);
    }
  }
  return Object.freeze(
    players.map((player) => {
      const played = starters.has(player.id);
      const cameOn = substitutesUsed.has(player.id);
      const clubOutcome =
        player.clubId === undefined ? undefined : outcome.get(player.clubId);
      const conditionDelta = played ? -6 : cameOn ? -3 : 4;
      const moraleDelta =
        clubOutcome === 1
          ? 3
          : clubOutcome === -1
            ? -3
            : clubOutcome === 0
              ? 1
              : 0;
      const injuryRounds = Math.max(
        Math.max(0, player.injuryRounds - 1),
        injuries.get(player.id) ?? 0,
      );
      const suspensionRounds = Math.max(
        Math.max(0, player.suspensionRounds - 1),
        suspensions.has(player.id) ? 1 : 0,
      );
      return createPlayer({
        ...player,
        condition: percentage(clamp(Number(player.condition) + conditionDelta)),
        morale: percentage(clamp(Number(player.morale) + moraleDelta)),
        matchSharpness: percentage(
          clamp(Number(player.matchSharpness) + (played || cameOn ? 2 : -1)),
        ),
        injuryRounds,
        suspensionRounds,
      });
    }),
  );
}

export function advanceRound(
  state: SeasonState,
  inputFactory: MatchInputFactory,
  simulator: MatchSimulator = simulateMatch,
): SeasonState {
  if (state.complete) return state;
  const nextRound = state.round + 1;
  const fixtures = state.fixtures.filter(
    (fixture) => fixture.round === nextRound && fixture.status === 'scheduled',
  );
  if (fixtures.length === 0)
    throw new Error(`Round ${String(nextRound)} has no scheduled fixtures`);
  const inputs = fixtures.map((fixture) => inputFactory(fixture, state));
  const results = inputs.map((input, index) => {
    const result = simulator(input);
    if (result.fixtureId !== fixtures[index]!.id)
      throw new Error('Simulator returned a result for another fixture');
    return result;
  });
  let table = state.table;
  for (let index = 0; index < fixtures.length; index += 1)
    table = table.apply(fixtures[index]!, results[index]!);
  const played = new Map(
    fixtures.map((fixture, index) => [fixture.id, results[index]!]),
  );
  const updatedFixtures = state.fixtures.map((fixture) => {
    const result = played.get(fixture.id);
    return result === undefined
      ? fixture
      : createFixture({
          ...fixture,
          status: 'played',
          matchId: result.matchId,
        });
  });
  const finalRound = Math.max(...state.fixtures.map(({ round }) => round));
  return freezeSeason({
    round: nextRound,
    fixtures: updatedFixtures,
    players: evolvePlayers(state.players, inputs, results),
    results: [...state.results, ...results],
    table,
    complete: nextRound === finalRound,
  });
}
