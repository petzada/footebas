import { DomainError } from './errors.js';
import type { ClubId, CompetitionId } from './entities.js';
import { GameDate } from './game-date.js';

export type StageId = string;
export type TieBreakerRule =
  | 'points'
  | 'wins'
  | 'goal_difference'
  | 'goals_for'
  | 'head_to_head'
  | 'deterministic_draw';

export interface RankingRule {
  readonly pointsForWin: number;
  readonly pointsForDraw: number;
  readonly pointsForLoss: number;
  readonly tieBreakers: readonly TieBreakerRule[];
}

export interface StageScheduleRule {
  readonly firstDate: string;
  readonly intervalDays: number;
}

export interface SeededParticipants {
  readonly type: 'seeded';
}

export interface QualifiedParticipants {
  readonly type: 'qualified';
  readonly fromStageId: StageId;
  readonly positions: readonly number[];
}

export interface SeededAndQualifiedParticipants {
  readonly type: 'seeded_and_qualified';
  readonly fromStageId: StageId;
  readonly positions: readonly number[];
}

export type ParticipantSource =
  SeededParticipants | QualifiedParticipants | SeededAndQualifiedParticipants;

interface BaseStage {
  readonly id: StageId;
  readonly name: string;
  readonly participantSource: ParticipantSource;
  readonly schedule: StageScheduleRule;
}

export interface LeagueStage extends BaseStage {
  readonly type: 'league';
  readonly roundRobin: 'single' | 'double';
  readonly ranking: RankingRule;
}

export interface GroupStage extends BaseStage {
  readonly type: 'groups';
  readonly groupCount: number;
  readonly roundRobin: 'single' | 'double';
  readonly ranking: RankingRule;
  readonly advancePerGroup: number;
}

export interface KnockoutStage extends BaseStage {
  readonly type: 'knockout';
  readonly legs: 1 | 2;
  readonly finalLegs?: 1 | 2;
  readonly thirdPlace?: boolean;
}

export type CompetitionStage = LeagueStage | GroupStage | KnockoutStage;

export type CompetitionTier =
  'national_league' | 'national_cup' | 'state' | 'continental';

export interface CompetitionDefinition {
  readonly id: CompetitionId;
  readonly name: string;
  readonly tier: CompetitionTier;
  readonly stages: readonly CompetitionStage[];
  readonly awards: readonly AwardRule[];
}

export interface AwardRule {
  readonly stageId: StageId;
  readonly positions: readonly number[];
  readonly prize: number;
  readonly prestige: number;
  readonly achievement:
    | 'league_title'
    | 'cup_title'
    | 'continental_title'
    | 'state_title'
    | 'promotion'
    | 'qualification';
}

export interface CompetitionMatchResult {
  readonly fixtureId: string;
  readonly homeGoals: number;
  readonly awayGoals: number;
  readonly homePenaltyGoals?: number;
  readonly awayPenaltyGoals?: number;
}

export interface CompetitionStanding {
  readonly clubId: ClubId;
  readonly played: number;
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly goalDifference: number;
  readonly points: number;
}

export interface StageOutcome {
  readonly stageId: StageId;
  readonly orderedClubIds: readonly ClubId[];
  readonly standings?: readonly CompetitionStanding[];
  readonly groupStandings?: Readonly<
    Record<string, readonly CompetitionStanding[]>
  >;
}

export interface CompetitionOutcome {
  readonly competitionId: CompetitionId;
  readonly edition: number;
  readonly stages: readonly StageOutcome[];
  readonly championId: ClubId;
  readonly runnerUpId?: ClubId;
}

export interface SeasonSelection {
  readonly sourceCompetitionId: CompetitionId;
  readonly sourceStageId: StageId;
  readonly positions: readonly number[];
  /** Keep scanning the supplied positions until this many unique clubs are found. */
  readonly count?: number;
  readonly event?: 'promoted' | 'relegated' | 'qualified';
}

export interface SeasonAllocationRule {
  readonly targetCompetitionId: CompetitionId;
  readonly targetSize: number;
  readonly selections: readonly SeasonSelection[];
}

export interface CompetitionCalendarFixture {
  readonly id: string;
  readonly competitionId: CompetitionId;
  readonly stageId: StageId;
  readonly phaseOrder: number;
  readonly round: number;
  readonly date: string;
  readonly homeClubId: ClubId;
  readonly awayClubId: ClubId;
  readonly tieId?: string;
  readonly leg?: 1 | 2;
  readonly groupId?: string;
}

export type CompetitionDomainEvent =
  | Readonly<{
      type: 'CompetitionWon';
      competitionId: CompetitionId;
      clubId: ClubId;
      edition: number;
      stageId: StageId;
    }>
  | Readonly<{
      type: 'PrizeAwarded';
      competitionId: CompetitionId;
      clubId: ClubId;
      edition: number;
      amount: number;
    }>
  | Readonly<{
      type: 'PrestigeAwarded';
      competitionId: CompetitionId;
      clubId: ClubId;
      edition: number;
      points: number;
      achievement: AwardRule['achievement'];
    }>
  | Readonly<{
      type: 'ClubPromoted' | 'ClubRelegated' | 'ClubQualified';
      clubId: ClubId;
      fromCompetitionId: CompetitionId;
      toCompetitionId: CompetitionId;
      edition: number;
    }>;

const stageIdPattern = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;

function positiveInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new DomainError(
      'INVALID_ENTITY',
      `${field} must be a positive safe integer`,
      { field, value },
    );
}

function validatePositions(positions: readonly number[], field: string): void {
  if (positions.length === 0 || new Set(positions).size !== positions.length)
    throw new DomainError(
      'INVALID_ENTITY',
      `${field} must contain unique positions`,
    );
  for (const position of positions) positiveInteger(position, field);
}

export function createCompetitionDefinition(
  input: CompetitionDefinition,
): CompetitionDefinition {
  if (input.name.trim().length === 0 || input.stages.length === 0)
    throw new DomainError(
      'INVALID_ENTITY',
      'competition definition requires a name and stages',
    );
  const stageIds = new Set<string>();
  for (const [index, stage] of input.stages.entries()) {
    if (!stageIdPattern.test(stage.id) || stageIds.has(stage.id))
      throw new DomainError(
        'INVALID_ENTITY',
        'competition stage IDs must be unique canonical IDs',
        { stageId: stage.id },
      );
    stageIds.add(stage.id);
    positiveInteger(stage.schedule.intervalDays, 'stage.schedule.intervalDays');
    try {
      GameDate.parse(stage.schedule.firstDate);
    } catch {
      throw new DomainError(
        'INVALID_ENTITY',
        'stage.schedule.firstDate must be an ISO game date',
      );
    }
    if (stage.participantSource.type !== 'seeded') {
      if (!stageIds.has(stage.participantSource.fromStageId) || index === 0)
        throw new DomainError(
          'INVALID_ENTITY',
          'qualified participant source must reference an earlier stage',
        );
      validatePositions(
        stage.participantSource.positions,
        'stage.participantSource.positions',
      );
    }
    if (stage.type === 'groups') {
      positiveInteger(stage.groupCount, 'stage.groupCount');
      positiveInteger(stage.advancePerGroup, 'stage.advancePerGroup');
    }
    if (stage.type === 'league' || stage.type === 'groups') {
      if (
        new Set(stage.ranking.tieBreakers).size !==
        stage.ranking.tieBreakers.length
      )
        throw new DomainError('INVALID_ENTITY', 'tie breakers must be unique');
      for (const value of [
        stage.ranking.pointsForWin,
        stage.ranking.pointsForDraw,
        stage.ranking.pointsForLoss,
      ])
        if (!Number.isSafeInteger(value) || value < 0)
          throw new DomainError(
            'INVALID_ENTITY',
            'ranking points must be non-negative safe integers',
          );
    }
  }
  for (const award of input.awards) {
    if (!stageIds.has(award.stageId))
      throw new DomainError('INVALID_ENTITY', 'award references unknown stage');
    validatePositions(award.positions, 'award.positions');
    if (
      !Number.isSafeInteger(award.prize) ||
      award.prize < 0 ||
      !Number.isSafeInteger(award.prestige) ||
      award.prestige < 0
    )
      throw new DomainError(
        'INVALID_ENTITY',
        'award prize and prestige must be non-negative safe integers',
      );
  }
  return Object.freeze({
    ...input,
    stages: Object.freeze(
      input.stages.map((stage) =>
        Object.freeze({
          ...stage,
          participantSource: Object.freeze({
            ...stage.participantSource,
            ...(stage.participantSource.type !== 'seeded'
              ? {
                  positions: Object.freeze([
                    ...stage.participantSource.positions,
                  ]),
                }
              : {}),
          }),
          schedule: Object.freeze({ ...stage.schedule }),
          ...(stage.type === 'league' || stage.type === 'groups'
            ? {
                ranking: Object.freeze({
                  ...stage.ranking,
                  tieBreakers: Object.freeze([...stage.ranking.tieBreakers]),
                }),
              }
            : {}),
        }),
      ),
    ),
    awards: Object.freeze(
      input.awards.map((award) =>
        Object.freeze({
          ...award,
          positions: Object.freeze([...award.positions]),
        }),
      ),
    ),
  });
}
