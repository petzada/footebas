/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/restrict-template-expressions -- fixed eight-club laboratory cardinality and canonical seed segments */
import {
  canonicalJson,
  createClub,
  createLineup,
  createMatchInput,
  entityId,
  money,
  percentage,
  GameDate,
  type Club,
  type Fixture,
  type Formation,
  type Player,
  type Position,
  type Tactic,
} from '@footebas/domain';
import {
  advanceRound,
  createSeasonState,
  generateDoubleRoundRobin,
  simulateMatch,
  type LeagueRow,
  type SeasonState,
} from '@footebas/engine';
import { playerFactory, tacticFactory } from '@footebas/testing';
import { loadRealSample } from './real-sample.js';

export const SEASON_REPORT_VERSION = 'phase-one-season-report-v1' as const;
export const SEASON_SEED_VERSION = 'phase-one-season-seed-v1' as const;
const SLOTS: Readonly<Record<Formation, readonly Position[]>> = {
  '4-4-2': ['GK', 'RB', 'CB', 'CB', 'LB', 'CM', 'CM', 'RW', 'LW', 'ST', 'ST'],
  '4-3-3': ['GK', 'RB', 'CB', 'CB', 'LB', 'DM', 'CM', 'AM', 'RW', 'LW', 'ST'],
  '3-5-2': ['GK', 'CB', 'CB', 'CB', 'RB', 'LB', 'DM', 'CM', 'AM', 'ST', 'ST'],
};

interface LaboratoryClub { readonly club: Club; readonly players: readonly Player[] }
export interface SeasonOptions { readonly seed?: string; readonly controlledClubIndex?: number; readonly tacticForRound?: (round: number) => Tactic }
export interface SeasonReport {
  readonly schemaVersion: typeof SEASON_REPORT_VERSION;
  readonly seedVersion: typeof SEASON_SEED_VERSION;
  readonly seed: string;
  readonly clubs: number;
  readonly players: number;
  readonly rounds: number;
  readonly matches: number;
  readonly champion: string;
  readonly standings: readonly LeagueRow[];
  readonly scorelines: readonly string[];
  readonly eventTypes: readonly string[];
  readonly maximumConditionDelta: number;
  readonly maximumMoraleDelta: number;
  readonly maximumInjuryRounds: number;
  readonly maximumSuspensionRounds: number;
  readonly failures: readonly string[];
  readonly passed: boolean;
}

function buildLaboratoryClubs(): readonly LaboratoryClub[] {
  return loadRealSample().clubs.map((sample, clubIndex) => {
    const key = `phase1_club_${clubIndex + 1}`;
    const players = sample.players.map((raw, playerIndex) => playerFactory({
      key: `${key}_p${String(playerIndex + 1).padStart(2, '0')}`,
      clubKey: key,
      name: raw.name,
      position: raw.position,
      strength: raw.strength,
    }));
    return {
      club: createClub({
        id: entityId(key, 'club'), name: sample.name, shortName: `P1-${clubIndex + 1}`,
        squad: players.map(({ id }) => id), balance: money(100_000_000), reputation: percentage(70),
      }),
      players,
    };
  });
}
const LABORATORY_CLUBS = buildLaboratoryClubs();

function lineup(club: Club, players: readonly Player[], formation: Formation) {
  const available = players.filter((player) => player.injuryRounds === 0 && player.suspensionRounds === 0);
  if (available.length < 11) throw new Error(`${club.name} has fewer than eleven available players`);
  const unused = [...available];
  const starters = SLOTS[formation].map((position) => {
    let index = unused.findIndex((player) => player.position === position);
    if (index < 0) index = 0;
    const [selected] = unused.splice(index, 1);
    return { playerId: selected!.id, position };
  });
  return createLineup({
    clubId: club.id, starters, substitutes: unused.slice(0, 5).map(({ id }) => id), captainId: starters[0]!.playerId,
  });
}

function side(entry: LaboratoryClub, state: SeasonState, tactic: Tactic) {
  const players = state.players.filter(({ clubId }) => clubId === entry.club.id);
  return { club: entry.club, players, tactic, lineup: lineup(entry.club, players, tactic.formation) };
}

function assertReport(state: SeasonState, initialPlayers: readonly Player[]): Omit<SeasonReport, 'schemaVersion' | 'seedVersion' | 'seed' | 'clubs' | 'players' | 'rounds'> {
  const failures: string[] = [];
  const standings = state.table.standings;
  if (!state.complete) failures.push('season is incomplete');
  if (state.results.length !== 56) failures.push(`expected 56 results, received ${state.results.length}`);
  if (new Set(state.results.map(({ fixtureId }) => fixtureId)).size !== 56) failures.push('fixture results are not unique');
  if (standings.length !== 8 || standings.some((row) => row.played !== 14 || row.wins + row.draws + row.losses !== row.played)) failures.push('league table is invalid');
  const goalsFor = standings.reduce((sum, row) => sum + row.goalsFor, 0);
  const goalsAgainst = standings.reduce((sum, row) => sum + row.goalsAgainst, 0);
  if (goalsFor !== goalsAgainst) failures.push('league goals do not balance');
  if (state.table.champion === undefined) failures.push('champion is absent');
  if (state.fixtures.some(({ status }) => status !== 'played')) failures.push('scheduled fixture remains');
  const initial = new Map(initialPlayers.map((player) => [player.id, player]));
  let maximumConditionDelta = 0, maximumMoraleDelta = 0, maximumInjuryRounds = 0, maximumSuspensionRounds = 0;
  for (const player of state.players) {
    const origin = initial.get(player.id)!;
    maximumConditionDelta = Math.max(maximumConditionDelta, Math.abs(Number(player.condition) - Number(origin.condition)));
    maximumMoraleDelta = Math.max(maximumMoraleDelta, Math.abs(Number(player.morale) - Number(origin.morale)));
    maximumInjuryRounds = Math.max(maximumInjuryRounds, player.injuryRounds);
    maximumSuspensionRounds = Math.max(maximumSuspensionRounds, player.suspensionRounds);
    if (![player.condition, player.morale, player.matchSharpness].every((value) => Number(value) >= 0 && Number(value) <= 100)) failures.push(`player ${player.id} has an impossible percentage`);
  }
  return {
    matches: state.results.length,
    champion: state.table.champion ?? 'absent', standings,
    scorelines: [...new Set(state.results.map((result) => `${result.homeGoals}-${result.awayGoals}`))].sort(),
    eventTypes: [...new Set(state.results.flatMap((result) => result.timeline.map(({ type }) => type)))].sort(),
    maximumConditionDelta, maximumMoraleDelta, maximumInjuryRounds, maximumSuspensionRounds,
    failures, passed: failures.length === 0,
  };
}

export function runSeason(options: SeasonOptions = {}): SeasonReport {
  const seed = options.seed ?? `${SEASON_SEED_VERSION}|canonical`;
  const clubs = LABORATORY_CLUBS;
  const players = clubs.flatMap(({ players: squad }) => squad);
  const fixtures = generateDoubleRoundRobin(entityId('phase1_league', 'competition'), clubs.map(({ club }) => club.id), GameDate.parse('2026-01-01'));
  let state = createSeasonState(fixtures, players);
  while (!state.complete) {
    state = advanceRound(state, (fixture: Fixture, current) => {
      const home = clubs.find(({ club }) => club.id === fixture.homeClubId)!;
      const away = clubs.find(({ club }) => club.id === fixture.awayClubId)!;
      const tactic = options.tacticForRound?.(current.round + 1) ?? tacticFactory();
      return createMatchInput({
        fixtureId: fixture.id, seed: `${seed}|round-${current.round + 1}|${fixture.id}`,
        engineVersion: 'match-v1', rulesVersion: 'rules-v1',
        home: side(home, current, home.club.id === clubs[options.controlledClubIndex ?? -1]?.club.id ? tactic : tacticFactory()),
        away: side(away, current, away.club.id === clubs[options.controlledClubIndex ?? -1]?.club.id ? tactic : tacticFactory()),
      });
    }, simulateMatch);
  }
  return { schemaVersion: SEASON_REPORT_VERSION, seedVersion: SEASON_SEED_VERSION, seed, clubs: clubs.length, players: players.length, rounds: state.round, ...assertReport(state, players) };
}

export function seasonOutput(options: SeasonOptions = {}): string { return canonicalJson(runSeason(options)); }
