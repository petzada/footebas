import { DomainError } from './errors.js';
import type { GameDate } from './game-date.js';
import type { EntityId } from './id.js';
import type { Money, Percentage, PlayerTrait, Position, Strength } from './values.js';

export type PlayerId = EntityId<'player'>;
export type ClubId = EntityId<'club'>;
export type CareerId = EntityId<'career'>;
export type CompetitionId = EntityId<'competition'>;
export type FixtureId = EntityId<'fixture'>;
export type MatchId = EntityId<'match'>;

export type SquadStatus = 'starter' | 'rotation' | 'backup' | 'listed' | 'youth';
export type PreferredSide = 'left' | 'right' | 'center';

export interface CareerStats {
  readonly appearances: number;
  readonly goals: number;
  readonly assists: number;
  readonly yellowCards: number;
  readonly redCards: number;
}

export interface Player {
  readonly id: PlayerId;
  readonly name: string;
  readonly age: number;
  readonly nationalityId?: string;
  readonly position: Position;
  readonly secondaryPositions: readonly Position[];
  readonly preferredSide?: PreferredSide;
  readonly strength: Strength;
  readonly traits: readonly PlayerTrait[];
  readonly hidden: Readonly<{
    potential: Percentage; consistency: Percentage; injuryProneness: Percentage;
    adaptation: Percentage; professionalism: Percentage; bigGame: Percentage;
  }>;
  readonly morale: Percentage;
  readonly condition: Percentage;
  readonly matchSharpness: Percentage;
  readonly value: Money;
  readonly salary: Money;
  readonly contractEndsAt?: GameDate;
  readonly clubId?: ClubId;
  readonly squadStatus: SquadStatus;
  readonly injuryRounds: number;
  readonly suspensionRounds: number;
  readonly careerStats: Readonly<CareerStats>;
}

function nonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) throw new DomainError('INVALID_ENTITY', `${field} cannot be empty`, { field });
}
function natural(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new DomainError('INVALID_ENTITY', `${field} must be a non-negative safe integer`, { field, value });
}

export function createPlayer(input: Player): Player {
  nonEmpty(input.name, 'player.name');
  if (!Number.isInteger(input.age) || input.age < 15 || input.age > 60) throw new DomainError('INVALID_ENTITY', 'player.age must be from 15 to 60', { age: input.age });
  if (input.traits.length > 2 || new Set(input.traits).size !== input.traits.length) throw new DomainError('INVALID_ENTITY', 'player.traits must contain at most two unique traits');
  if (new Set(input.secondaryPositions).size !== input.secondaryPositions.length || input.secondaryPositions.includes(input.position)) throw new DomainError('INVALID_ENTITY', 'player.secondaryPositions must be unique and exclude the primary position');
  natural(input.injuryRounds, 'player.injuryRounds'); natural(input.suspensionRounds, 'player.suspensionRounds');
  for (const [key, value] of Object.entries(input.careerStats)) natural(value, `player.careerStats.${key}`);
  return Object.freeze({ ...input, secondaryPositions: Object.freeze([...input.secondaryPositions]), traits: Object.freeze([...input.traits]), hidden: Object.freeze({ ...input.hidden }), careerStats: Object.freeze({ ...input.careerStats }) });
}

export interface Club {
  readonly id: ClubId;
  readonly name: string;
  readonly shortName: string;
  readonly squad: readonly PlayerId[];
  readonly balance: Money;
  readonly reputation: Percentage;
}
export function createClub(input: Club): Club {
  nonEmpty(input.name, 'club.name'); nonEmpty(input.shortName, 'club.shortName');
  if (new Set(input.squad).size !== input.squad.length) throw new DomainError('INVALID_ENTITY', 'club.squad cannot contain duplicates');
  return Object.freeze({ ...input, squad: Object.freeze([...input.squad]) });
}

export const FORMATIONS = ['4-4-2', '4-3-3', '3-5-2'] as const;
export type Formation = (typeof FORMATIONS)[number];
export const MENTALITIES = ['balanced', 'all_out_attack', 'counter_attack'] as const;
export type Mentality = (typeof MENTALITIES)[number];
export type AttackDirection = 'center' | 'wings';
export type MarkingIntensity = 'light' | 'heavy' | 'very_heavy';
export interface Tactic { readonly formation: Formation; readonly mentality: Mentality; readonly attackDirection: AttackDirection; readonly marking: MarkingIntensity }
export function createTactic(input: Tactic): Tactic { return Object.freeze({ ...input }); }

export interface LineupSlot { readonly playerId: PlayerId; readonly position: Position }
export interface Lineup { readonly clubId: ClubId; readonly starters: readonly LineupSlot[]; readonly substitutes: readonly PlayerId[]; readonly captainId: PlayerId }
export function createLineup(input: Lineup): Lineup {
  if (input.starters.length !== 11) throw new DomainError('INVALID_ENTITY', 'lineup must have exactly 11 starters');
  const starterIds = input.starters.map(({ playerId }) => playerId);
  const all = [...starterIds, ...input.substitutes];
  if (new Set(all).size !== all.length) throw new DomainError('INVALID_ENTITY', 'lineup players must be unique');
  if (!starterIds.includes(input.captainId)) throw new DomainError('INVALID_ENTITY', 'lineup captain must be a starter');
  if (input.starters.filter(({ position }) => position === 'GK').length !== 1) throw new DomainError('INVALID_ENTITY', 'lineup must have exactly one starting goalkeeper');
  return Object.freeze({ ...input, starters: Object.freeze(input.starters.map((slot) => Object.freeze({ ...slot }))), substitutes: Object.freeze([...input.substitutes]) });
}

export type CareerStatus = 'active' | 'ended';
export interface Career { readonly id: CareerId; readonly managerId: EntityId<'manager'>; readonly currentClubId?: ClubId; readonly currentDate: GameDate; readonly season: number; readonly status: CareerStatus; readonly version: number }
export function createCareer(input: Career): Career {
  if (!Number.isSafeInteger(input.season) || input.season < 1 || !Number.isSafeInteger(input.version) || input.version < 0) throw new DomainError('INVALID_ENTITY', 'career season/version are invalid');
  return Object.freeze({ ...input });
}

export type CompetitionFormat = { readonly type: 'double_round_robin'; readonly pointsForWin: number; readonly pointsForDraw: number; readonly pointsForLoss: number } | { readonly type: 'knockout'; readonly legs: 1 | 2 };
export interface Competition { readonly id: CompetitionId; readonly name: string; readonly clubIds: readonly ClubId[]; readonly format: CompetitionFormat }
export function createCompetition(input: Competition): Competition {
  nonEmpty(input.name, 'competition.name');
  if (input.clubIds.length < 2 || new Set(input.clubIds).size !== input.clubIds.length) throw new DomainError('INVALID_ENTITY', 'competition requires at least two unique clubs');
  if (input.format.type === 'double_round_robin') for (const value of [input.format.pointsForWin, input.format.pointsForDraw, input.format.pointsForLoss]) natural(value, 'competition.points');
  return Object.freeze({ ...input, clubIds: Object.freeze([...input.clubIds]), format: Object.freeze({ ...input.format }) });
}

export type FixtureStatus = 'scheduled' | 'played';
export interface Fixture { readonly id: FixtureId; readonly competitionId: CompetitionId; readonly round: number; readonly date: GameDate; readonly homeClubId: ClubId; readonly awayClubId: ClubId; readonly status: FixtureStatus; readonly matchId?: MatchId }
export function createFixture(input: Fixture): Fixture {
  if (!Number.isSafeInteger(input.round) || input.round < 1 || input.homeClubId === input.awayClubId) throw new DomainError('INVALID_ENTITY', 'fixture round/clubs are invalid');
  if ((input.status === 'played') !== (input.matchId !== undefined)) throw new DomainError('INVALID_ENTITY', 'played fixture must have matchId and scheduled fixture must not');
  return Object.freeze({ ...input });
}
