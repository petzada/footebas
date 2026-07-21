import { DomainError } from './errors.js';
import type { Club, FixtureId, Lineup, MatchId, PlayerId, Tactic } from './entities.js';

export interface MatchInput {
  readonly fixtureId: FixtureId;
  readonly seed: string;
  readonly engineVersion: string;
  readonly rulesVersion: string;
  readonly home: Readonly<{ club: Club; lineup: Lineup; tactic: Tactic }>;
  readonly away: Readonly<{ club: Club; lineup: Lineup; tactic: Tactic }>;
}
export function createMatchInput(input: MatchInput): MatchInput {
  if (input.seed.length === 0 || input.engineVersion.length === 0 || input.rulesVersion.length === 0) throw new DomainError('INVALID_ENTITY', 'match seed and versions cannot be empty');
  if (input.home.club.id === input.away.club.id || input.home.lineup.clubId !== input.home.club.id || input.away.lineup.clubId !== input.away.club.id) throw new DomainError('INVALID_ENTITY', 'match clubs and lineups are inconsistent');
  return Object.freeze({ ...input, home: Object.freeze({ ...input.home }), away: Object.freeze({ ...input.away }) });
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
export function createMatchResult(input: MatchResult): MatchResult {
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
    previousMinute = event.minute;
  }
  return Object.freeze({ ...input, home: Object.freeze({ ...input.home }), away: Object.freeze({ ...input.away }), timeline: Object.freeze(input.timeline.map((event) => Object.freeze({ ...event }))) });
}
