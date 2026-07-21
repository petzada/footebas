import { DomainError } from './errors.js';
import {
  createClub,
  createLineup,
  createPlayer,
  createTactic,
  validateLineupForMatch,
} from './entities.js';
import type {
  Club,
  FixtureId,
  Lineup,
  MatchId,
  Player,
  PlayerId,
  Tactic,
} from './entities.js';

export const MATCH_DECISION_MINUTES = [15, 30, 45, 60, 75] as const;
export type MatchDecisionMinute = (typeof MATCH_DECISION_MINUTES)[number];
export type MatchInstruction =
  | Readonly<{
      type: 'substitution';
      minute: MatchDecisionMinute;
      side: MatchSide;
      playerOutId: PlayerId;
      playerInId: PlayerId;
      position: Lineup['starters'][number]['position'];
    }>
  | Readonly<{
      type: 'tactical_change';
      minute: MatchDecisionMinute;
      side: MatchSide;
      tactic: Tactic;
    }>;

export interface MatchSideInput {
  readonly club: Club;
  readonly lineup: Lineup;
  readonly tactic: Tactic;
  readonly players: readonly Player[];
}

export interface MatchInput {
  readonly fixtureId: FixtureId;
  readonly seed: string;
  readonly engineVersion: string;
  readonly rulesVersion: string;
  readonly home: Readonly<MatchSideInput>;
  readonly away: Readonly<MatchSideInput>;
  readonly instructions?: readonly MatchInstruction[];
}
function snapshotSide(
  side: MatchSideInput,
  label: MatchSide,
): Readonly<MatchSideInput> {
  const playerIds = side.players.map(({ id }) => id);
  if (new Set(playerIds).size !== playerIds.length)
    throw new DomainError(
      'INVALID_ENTITY',
      `${label} player snapshot IDs must be unique`,
    );
  const lineupIds = [
    ...side.lineup.starters.map(({ playerId }) => playerId),
    ...side.lineup.substitutes,
  ];
  const snapshotIds = new Set(playerIds);
  if (lineupIds.some((id) => !snapshotIds.has(id)))
    throw new DomainError(
      'INVALID_ENTITY',
      `${label} player snapshot must contain every lineup player`,
    );
  if (
    side.players.some(
      ({ clubId }) => clubId !== undefined && clubId !== side.club.id,
    )
  )
    throw new DomainError(
      'INVALID_ENTITY',
      `${label} player snapshot contains a player from another club`,
    );
  return Object.freeze({
    ...side,
    club: createClub(side.club),
    lineup: createLineup(side.lineup),
    tactic: createTactic(side.tactic),
    players: Object.freeze(side.players.map((player) => createPlayer(player))),
  });
}
export function createMatchInput(input: MatchInput): MatchInput {
  if (
    input.seed.length === 0 ||
    input.engineVersion.length === 0 ||
    input.rulesVersion.length === 0
  )
    throw new DomainError(
      'INVALID_ENTITY',
      'match seed and versions cannot be empty',
    );
  if (
    input.home.club.id === input.away.club.id ||
    input.home.lineup.clubId !== input.home.club.id ||
    input.away.lineup.clubId !== input.away.club.id
  )
    throw new DomainError(
      'INVALID_ENTITY',
      'match clubs and lineups are inconsistent',
    );
  const home = snapshotSide(input.home, 'home');
  const away = snapshotSide(input.away, 'away');
  validateLineupForMatch(
    home.lineup,
    home.club,
    home.players,
    home.tactic.formation,
  );
  validateLineupForMatch(
    away.lineup,
    away.club,
    away.players,
    away.tactic.formation,
  );
  const homeIds = new Set(home.players.map(({ id }) => id));
  if (away.players.some(({ id }) => homeIds.has(id)))
    throw new DomainError(
      'INVALID_ENTITY',
      'players cannot appear on both match sides',
    );
  const instructions = [...(input.instructions ?? [])];
  let previousMinute = 0;
  const substitutions = { home: 0, away: 0 };
  const activePlayers = {
    home: new Set(home.lineup.starters.map(({ playerId }) => playerId)),
    away: new Set(away.lineup.starters.map(({ playerId }) => playerId)),
  };
  const benchPlayers = {
    home: new Set(home.lineup.substitutes),
    away: new Set(away.lineup.substitutes),
  };
  for (const instruction of instructions) {
    if (
      !MATCH_DECISION_MINUTES.includes(instruction.minute) ||
      instruction.minute < previousMinute
    )
      throw new DomainError(
        'INVALID_ENTITY',
        'match instructions must use ordered decision minutes',
      );
    const side = instruction.side === 'home' ? home : away;
    if (instruction.type === 'substitution') {
      substitutions[instruction.side] += 1;
      if (substitutions[instruction.side] > 5)
        throw new DomainError(
          'INVALID_ENTITY',
          'a side cannot plan more than five substitutions',
        );
      const active = activePlayers[instruction.side];
      const bench = benchPlayers[instruction.side];
      if (
        !active.has(instruction.playerOutId) ||
        !bench.has(instruction.playerInId)
      )
        throw new DomainError(
          'INVALID_ENTITY',
          'substitution must exchange an active player with an unused bench player',
        );
      const incoming = side.players.find(
        ({ id }) => id === instruction.playerInId,
      );
      if (
        !incoming ||
        incoming.injuryRounds > 0 ||
        incoming.suspensionRounds > 0
      )
        throw new DomainError('INVALID_ENTITY', 'substitute is unavailable');
      active.delete(instruction.playerOutId);
      active.add(instruction.playerInId);
      bench.delete(instruction.playerInId);
    } else createTactic(instruction.tactic);
    previousMinute = instruction.minute;
  }
  return Object.freeze({
    ...input,
    home,
    away,
    instructions: Object.freeze(
      instructions.map((instruction) =>
        Object.freeze(
          instruction.type === 'tactical_change'
            ? { ...instruction, tactic: createTactic(instruction.tactic) }
            : { ...instruction },
        ),
      ),
    ),
  });
}

export type MatchSide = 'home' | 'away';
export type MatchEvent =
  | Readonly<{ type: 'chance'; minute: number; side: MatchSide; xg: number }>
  | Readonly<{
      type: 'goal';
      minute: number;
      side: MatchSide;
      scorerId: PlayerId;
      assistId?: PlayerId;
    }>
  | Readonly<{
      type: 'card';
      minute: number;
      side: MatchSide;
      playerId: PlayerId;
      card: 'yellow' | 'red';
    }>
  | Readonly<{
      type: 'injury';
      minute: number;
      side: MatchSide;
      playerId: PlayerId;
      rounds: number;
    }>
  | Readonly<{
      type: 'substitution';
      minute: number;
      side: MatchSide;
      playerOutId: PlayerId;
      playerInId: PlayerId;
      position?: Lineup['starters'][number]['position'];
      source?: 'manager' | 'automatic';
    }>
  | Readonly<{
      type: 'tactical_change';
      minute: number;
      side: MatchSide;
      tactic: Tactic;
    }>;

export interface PlayerMatchPerformance {
  readonly playerId: PlayerId;
  readonly side: MatchSide;
  readonly started: boolean;
  readonly rating: number;
  readonly goals: number;
  readonly assists: number;
  readonly yellowCards: number;
  readonly redCards: number;
  readonly conditionDelta: number;
  readonly moraleDelta: number;
  readonly injuryRounds: number;
  readonly suspensionRounds: number;
}
export interface MatchStatistics {
  readonly shots: number;
  readonly shotsOnTarget: number;
  readonly possession: number;
  readonly yellowCards: number;
  readonly redCards: number;
  readonly xg: number;
}
export interface MatchResult {
  readonly matchId: MatchId;
  readonly fixtureId: FixtureId;
  readonly homeGoals: number;
  readonly awayGoals: number;
  readonly home: Readonly<MatchStatistics>;
  readonly away: Readonly<MatchStatistics>;
  readonly timeline: readonly MatchEvent[];
  readonly seed: string;
  readonly engineVersion: string;
  readonly decisions?: readonly MatchInstruction[];
  readonly playerPerformances?: readonly PlayerMatchPerformance[];
}
function validateStatistics(
  statistics: MatchStatistics,
  side: MatchSide,
): void {
  for (const [field, value] of Object.entries(statistics)) {
    if (!Number.isFinite(value) || value < 0)
      throw new DomainError(
        'INVALID_ENTITY',
        `${side}.${field} must be finite and non-negative`,
      );
  }
  if (
    !Number.isInteger(statistics.shots) ||
    !Number.isInteger(statistics.shotsOnTarget) ||
    statistics.shotsOnTarget > statistics.shots
  )
    throw new DomainError(
      'INVALID_ENTITY',
      `${side} shot statistics are inconsistent`,
    );
  if (
    !Number.isInteger(statistics.yellowCards) ||
    !Number.isInteger(statistics.redCards) ||
    statistics.possession > 100
  )
    throw new DomainError(
      'INVALID_ENTITY',
      `${side} card/possession statistics are invalid`,
    );
}
function eventPlayerIds(event: MatchEvent): readonly PlayerId[] {
  switch (event.type) {
    case 'goal':
      return event.assistId === undefined
        ? [event.scorerId]
        : [event.scorerId, event.assistId];
    case 'card':
    case 'injury':
      return [event.playerId];
    case 'substitution':
      return [event.playerOutId, event.playerInId];
    case 'tactical_change':
    case 'chance':
      return [];
  }
}
export function createMatchResult(
  input: MatchResult,
  matchInput?: MatchInput,
): MatchResult {
  for (const [field, value] of [
    ['homeGoals', input.homeGoals],
    ['awayGoals', input.awayGoals],
  ] as const)
    if (!Number.isSafeInteger(value) || value < 0)
      throw new DomainError('INVALID_ENTITY', `${field} must be non-negative`);
  validateStatistics(input.home, 'home');
  validateStatistics(input.away, 'away');
  if (Math.abs(input.home.possession + input.away.possession - 100) > 0.001)
    throw new DomainError('INVALID_ENTITY', 'match possession must total 100');
  const goals = input.timeline.filter((event) => event.type === 'goal');
  if (
    goals.filter((event) => event.side === 'home').length !== input.homeGoals ||
    goals.filter((event) => event.side === 'away').length !== input.awayGoals
  )
    throw new DomainError('INVALID_ENTITY', 'score must equal goal events');
  let previousMinute = 0;
  for (const event of input.timeline) {
    if (
      !Number.isInteger(event.minute) ||
      event.minute < previousMinute ||
      event.minute > 130
    )
      throw new DomainError(
        'INVALID_ENTITY',
        'timeline minutes must be ordered integers from 0 to 130',
      );
    if (
      event.type === 'chance' &&
      (!Number.isFinite(event.xg) || event.xg < 0 || event.xg > 1)
    )
      throw new DomainError('INVALID_ENTITY', 'chance xg must be from 0 to 1');
    if (
      event.type === 'injury' &&
      (!Number.isSafeInteger(event.rounds) || event.rounds < 1)
    )
      throw new DomainError('INVALID_ENTITY', 'injury rounds must be positive');
    if (event.type === 'substitution' && event.playerInId === event.playerOutId)
      throw new DomainError(
        'INVALID_ENTITY',
        'substitution players must differ',
      );
    if (event.type === 'tactical_change') createTactic(event.tactic);
    if (matchInput !== undefined) {
      const snapshotIds = new Set(
        matchInput[event.side].players.map(({ id }) => id),
      );
      if (eventPlayerIds(event).some((id) => !snapshotIds.has(id)))
        throw new DomainError(
          'INVALID_ENTITY',
          `${event.side} timeline event references a player outside its snapshot`,
        );
    }
    previousMinute = event.minute;
  }
  return Object.freeze({
    ...input,
    home: Object.freeze({ ...input.home }),
    away: Object.freeze({ ...input.away }),
    timeline: Object.freeze(
      input.timeline.map((event) => Object.freeze({ ...event })),
    ),
    decisions: Object.freeze([...(input.decisions ?? [])]),
    playerPerformances: Object.freeze(
      (input.playerPerformances ?? []).map((performance) =>
        Object.freeze({ ...performance }),
      ),
    ),
  });
}
