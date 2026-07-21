import { DomainError } from './errors.js';
import { createPlayer } from './entities.js';
import type { Club, FixtureId, Lineup, MatchId, Player, PlayerId, Tactic } from './entities.js';

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
}
function snapshotSide(side: MatchSideInput, label: MatchSide): Readonly<MatchSideInput> {
  const playerIds = side.players.map(({ id }) => id);
  if (new Set(playerIds).size !== playerIds.length) throw new DomainError('INVALID_ENTITY', `${label} player snapshot IDs must be unique`);
  const lineupIds = [...side.lineup.starters.map(({ playerId }) => playerId), ...side.lineup.substitutes];
  const snapshotIds = new Set(playerIds);
  if (lineupIds.some((id) => !snapshotIds.has(id))) throw new DomainError('INVALID_ENTITY', `${label} player snapshot must contain every lineup player`);
  if (side.players.some(({ clubId }) => clubId !== undefined && clubId !== side.club.id)) throw new DomainError('INVALID_ENTITY', `${label} player snapshot contains a player from another club`);
  return Object.freeze({ ...side, players: Object.freeze(side.players.map((player) => createPlayer(player))) });
}
export function createMatchInput(input: MatchInput): MatchInput {
  if (input.seed.length === 0 || input.engineVersion.length === 0 || input.rulesVersion.length === 0) throw new DomainError('INVALID_ENTITY', 'match seed and versions cannot be empty');
  if (input.home.club.id === input.away.club.id || input.home.lineup.clubId !== input.home.club.id || input.away.lineup.clubId !== input.away.club.id) throw new DomainError('INVALID_ENTITY', 'match clubs and lineups are inconsistent');
  const home = snapshotSide(input.home, 'home');
  const away = snapshotSide(input.away, 'away');
  const homeIds = new Set(home.players.map(({ id }) => id));
  if (away.players.some(({ id }) => homeIds.has(id))) throw new DomainError('INVALID_ENTITY', 'players cannot appear on both match sides');
  return Object.freeze({ ...input, home, away });
}

export type MatchSide = 'home' | 'away';
export type MatchEvent =
  | Readonly<{ type: 'chance'; minute: number; side: MatchSide; xg: number }>
  | Readonly<{ type: 'goal'; minute: number; side: MatchSide; scorerId: PlayerId; assistId?: PlayerId }>
  | Readonly<{ type: 'card'; minute: number; side: MatchSide; playerId: PlayerId; card: 'yellow' | 'red' }>
  | Readonly<{ type: 'injury'; minute: number; side: MatchSide; playerId: PlayerId; rounds: number }>
  | Readonly<{ type: 'substitution'; minute: number; side: MatchSide; playerOutId: PlayerId; playerInId: PlayerId }>;
export interface MatchStatistics { readonly shots: number; readonly shotsOnTarget: number; readonly possession: number; readonly yellowCards: number; readonly redCards: number; readonly xg: number }
export interface MatchResult { readonly matchId: MatchId; readonly fixtureId: FixtureId; readonly homeGoals: number; readonly awayGoals: number; readonly home: Readonly<MatchStatistics>; readonly away: Readonly<MatchStatistics>; readonly timeline: readonly MatchEvent[]; readonly seed: string; readonly engineVersion: string }
function validateStatistics(statistics: MatchStatistics, side: MatchSide): void {
  for (const [field, value] of Object.entries(statistics)) {
    if (!Number.isFinite(value) || value < 0) throw new DomainError('INVALID_ENTITY', `${side}.${field} must be finite and non-negative`);
  }
  if (!Number.isInteger(statistics.shots) || !Number.isInteger(statistics.shotsOnTarget) || statistics.shotsOnTarget > statistics.shots) throw new DomainError('INVALID_ENTITY', `${side} shot statistics are inconsistent`);
  if (!Number.isInteger(statistics.yellowCards) || !Number.isInteger(statistics.redCards) || statistics.possession > 100) throw new DomainError('INVALID_ENTITY', `${side} card/possession statistics are invalid`);
}
function eventPlayerIds(event: MatchEvent): readonly PlayerId[] {
  switch (event.type) {
    case 'goal': return event.assistId === undefined ? [event.scorerId] : [event.scorerId, event.assistId];
    case 'card':
    case 'injury': return [event.playerId];
    case 'substitution': return [event.playerOutId, event.playerInId];
    case 'chance': return [];
  }
}
export function createMatchResult(input: MatchResult, matchInput?: MatchInput): MatchResult {
  for (const [field, value] of [['homeGoals', input.homeGoals], ['awayGoals', input.awayGoals]] as const) if (!Number.isSafeInteger(value) || value < 0) throw new DomainError('INVALID_ENTITY', `${field} must be non-negative`);
  validateStatistics(input.home, 'home'); validateStatistics(input.away, 'away');
  if (Math.abs(input.home.possession + input.away.possession - 100) > 0.001) throw new DomainError('INVALID_ENTITY', 'match possession must total 100');
  const goals = input.timeline.filter((event) => event.type === 'goal');
  if (goals.filter((event) => event.side === 'home').length !== input.homeGoals || goals.filter((event) => event.side === 'away').length !== input.awayGoals) throw new DomainError('INVALID_ENTITY', 'score must equal goal events');
  let previousMinute = 0;
  for (const event of input.timeline) {
    if (!Number.isInteger(event.minute) || event.minute < previousMinute || event.minute > 130) throw new DomainError('INVALID_ENTITY', 'timeline minutes must be ordered integers from 0 to 130');
    if (event.type === 'chance' && (!Number.isFinite(event.xg) || event.xg < 0 || event.xg > 1)) throw new DomainError('INVALID_ENTITY', 'chance xg must be from 0 to 1');
    if (event.type === 'injury' && (!Number.isSafeInteger(event.rounds) || event.rounds < 1)) throw new DomainError('INVALID_ENTITY', 'injury rounds must be positive');
    if (event.type === 'substitution' && event.playerInId === event.playerOutId) throw new DomainError('INVALID_ENTITY', 'substitution players must differ');
    if (matchInput !== undefined) {
      const snapshotIds = new Set(matchInput[event.side].players.map(({ id }) => id));
      if (eventPlayerIds(event).some((id) => !snapshotIds.has(id))) throw new DomainError('INVALID_ENTITY', `${event.side} timeline event references a player outside its snapshot`);
    }
    previousMinute = event.minute;
  }
  return Object.freeze({ ...input, home: Object.freeze({ ...input.home }), away: Object.freeze({ ...input.away }), timeline: Object.freeze(input.timeline.map((event) => Object.freeze({ ...event }))) });
}
