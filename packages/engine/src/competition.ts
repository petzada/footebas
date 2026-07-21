/* eslint-disable @typescript-eslint/no-non-null-assertion -- cardinalities and map membership are validated */
import {
  GameDate,
  type AwardRule,
  type ClubId,
  type CompetitionCalendarFixture,
  type CompetitionDefinition,
  type CompetitionDomainEvent,
  type CompetitionMatchResult,
  type CompetitionOutcome,
  type CompetitionStage,
  type CompetitionStanding,
  type GroupStage,
  type KnockoutStage,
  type RankingRule,
  type SeasonAllocationRule,
  type StageOutcome,
  type TieBreakerRule,
} from '@footebas/domain';
import { hashSeed } from './prng.js';

export const COMPETITION_ENGINE_VERSION = 'competition-engine-v1' as const;

export interface ScheduledStage {
  readonly fixtures: readonly CompetitionCalendarFixture[];
  readonly groups: Readonly<Record<string, readonly ClubId[]>>;
  /** Entrants advanced without a fixture to close a non-power-of-two bracket. */
  readonly byeClubIds: readonly ClubId[];
}

export interface SeasonGeneration {
  readonly participants: Readonly<Record<string, readonly ClubId[]>>;
  readonly events: readonly CompetitionDomainEvent[];
}

interface PlayedMatch {
  readonly fixture: CompetitionCalendarFixture;
  readonly result: CompetitionMatchResult;
}

const emptyGroups: Readonly<Record<string, readonly ClubId[]>> = Object.freeze(
  {},
);

function uniqueParticipants(participants: readonly ClubId[]): void {
  if (
    participants.length < 2 ||
    new Set(participants).size !== participants.length
  )
    throw new Error('A stage requires at least two unique participants');
}

function pairRounds(
  participants: readonly ClubId[],
): readonly (readonly (readonly [ClubId, ClubId])[])[] {
  uniqueParticipants(participants);
  const rotating: (ClubId | undefined)[] = [...participants];
  if (rotating.length % 2 === 1) rotating.push(undefined);
  const rounds: [ClubId, ClubId][][] = [];
  for (let round = 0; round < rotating.length - 1; round += 1) {
    const matches: [ClubId, ClubId][] = [];
    for (let index = 0; index < rotating.length / 2; index += 1) {
      const left = rotating[index];
      const right = rotating[rotating.length - 1 - index];
      if (left === undefined || right === undefined) continue;
      matches.push(
        index === 0 && round % 2 === 1 ? [right, left] : [left, right],
      );
    }
    rounds.push(matches);
    const last = rotating.pop();
    rotating.splice(1, 0, last);
  }
  return Object.freeze(rounds.map((round) => Object.freeze(round)));
}

function scheduleRoundRobin(
  definition: CompetitionDefinition,
  stage: Extract<CompetitionStage, { type: 'league' | 'groups' }>,
  phaseOrder: number,
  groups: Readonly<Record<string, readonly ClubId[]>>,
): readonly CompetitionCalendarFixture[] {
  const firstDate = GameDate.parse(stage.schedule.firstDate);
  const output: CompetitionCalendarFixture[] = [];
  let globalRound = 0;
  const groupRounds = Object.entries(groups).map(([groupId, clubs]) => ({
    groupId,
    rounds: pairRounds(clubs),
  }));
  const roundsPerLeg = Math.max(
    ...groupRounds.map(({ rounds }) => rounds.length),
  );
  const legs = stage.roundRobin === 'double' ? 2 : 1;
  for (let legIndex = 0; legIndex < legs; legIndex += 1)
    for (let roundIndex = 0; roundIndex < roundsPerLeg; roundIndex += 1) {
      globalRound += 1;
      for (const { groupId, rounds } of groupRounds) {
        const matches = rounds[roundIndex] ?? [];
        for (const [matchIndex, pair] of matches.entries()) {
          const [first, second] = pair;
          const [homeClubId, awayClubId] =
            legIndex === 0 ? [first, second] : [second, first];
          output.push(
            Object.freeze({
              id: `${definition.id}_${stage.id}_r${String(globalRound)}_${groupId}_m${String(matchIndex + 1)}`,
              competitionId: definition.id,
              stageId: stage.id,
              phaseOrder,
              round: globalRound,
              date: firstDate
                .addDays((globalRound - 1) * stage.schedule.intervalDays)
                .toString(),
              homeClubId,
              awayClubId,
              ...(stage.type === 'groups' ? { groupId } : {}),
            }),
          );
        }
      }
    }
  return Object.freeze(output);
}

function makeGroups(
  stage: GroupStage,
  participants: readonly ClubId[],
): Readonly<Record<string, readonly ClubId[]>> {
  if (participants.length % stage.groupCount !== 0)
    throw new Error('Group participants must divide evenly across groups');
  if (participants.length / stage.groupCount <= stage.advancePerGroup)
    throw new Error('A group must eliminate at least one participant');
  const groups: Record<string, ClubId[]> = {};
  for (let index = 0; index < stage.groupCount; index += 1)
    groups[`group_${String(index + 1)}`] = [];
  for (const [index, clubId] of participants.entries())
    groups[`group_${String((index % stage.groupCount) + 1)}`]!.push(clubId);
  return Object.freeze(
    Object.fromEntries(
      Object.entries(groups).map(([groupId, clubs]) => [
        groupId,
        Object.freeze(clubs),
      ]),
    ),
  );
}

function scheduleKnockout(
  definition: CompetitionDefinition,
  stage: KnockoutStage,
  phaseOrder: number,
  participants: readonly ClubId[],
  knockoutRound: number,
): readonly CompetitionCalendarFixture[] {
  if (participants.length % 2 !== 0)
    throw new Error('A knockout round requires an even participant count');
  const firstDate = GameDate.parse(stage.schedule.firstDate);
  const legs =
    participants.length === 2 ? (stage.finalLegs ?? stage.legs) : stage.legs;
  const fixtures: CompetitionCalendarFixture[] = [];
  for (let index = 0; index < participants.length / 2; index += 1) {
    const home = participants[index]!;
    const away = participants[participants.length - 1 - index]!;
    const tieId = `${definition.id}_${stage.id}_r${String(knockoutRound)}_t${String(index + 1)}`;
    for (let leg = 1; leg <= legs; leg += 1)
      fixtures.push(
        Object.freeze({
          id: `${tieId}_l${String(leg)}`,
          competitionId: definition.id,
          stageId: stage.id,
          phaseOrder,
          round: knockoutRound,
          date: firstDate
            .addDays(
              ((knockoutRound - 1) * 2 + (leg - 1)) *
                stage.schedule.intervalDays,
            )
            .toString(),
          homeClubId: leg === 1 ? home : away,
          awayClubId: leg === 1 ? away : home,
          tieId,
          leg: leg as 1 | 2,
        }),
      );
  }
  return Object.freeze(fixtures);
}

export function scheduleCompetitionStage(
  definition: CompetitionDefinition,
  stageId: string,
  participants: readonly ClubId[],
  options: Readonly<{ phaseOrder?: number; knockoutRound?: number }> = {},
): ScheduledStage {
  uniqueParticipants(participants);
  const stageIndex = definition.stages.findIndex(
    (candidate) => candidate.id === stageId,
  );
  const stage = definition.stages[stageIndex];
  if (stage === undefined) throw new Error(`Unknown stage ${stageId}`);
  const phaseOrder = options.phaseOrder ?? stageIndex + 1;
  if (stage.type === 'knockout') {
    const bracketSize = 2 ** Math.ceil(Math.log2(participants.length));
    const byeCount = bracketSize - participants.length;
    const byeClubIds = Object.freeze(participants.slice(0, byeCount));
    const activeParticipants = participants.slice(byeCount);
    return Object.freeze({
      fixtures: scheduleKnockout(
        definition,
        stage,
        phaseOrder,
        activeParticipants,
        options.knockoutRound ?? 1,
      ),
      groups: emptyGroups,
      byeClubIds,
    });
  }
  const groups =
    stage.type === 'groups'
      ? makeGroups(stage, participants)
      : Object.freeze({ all: Object.freeze([...participants]) });
  return Object.freeze({
    fixtures: scheduleRoundRobin(definition, stage, phaseOrder, groups),
    groups,
    byeClubIds: Object.freeze([]),
  });
}

function playedMatches(
  fixtures: readonly CompetitionCalendarFixture[],
  results: readonly CompetitionMatchResult[],
): readonly PlayedMatch[] {
  const byId = new Map(results.map((result) => [result.fixtureId, result]));
  if (byId.size !== results.length || fixtures.length !== results.length)
    throw new Error('Every fixture requires exactly one result');
  return fixtures.map((fixture) => {
    const result = byId.get(fixture.id);
    if (result === undefined)
      throw new Error(`Missing result for ${fixture.id}`);
    if (
      !Number.isSafeInteger(result.homeGoals) ||
      !Number.isSafeInteger(result.awayGoals) ||
      result.homeGoals < 0 ||
      result.awayGoals < 0
    )
      throw new Error('Goals must be non-negative safe integers');
    return { fixture, result };
  });
}

function headToHead(
  left: ClubId,
  right: ClubId,
  matches: readonly PlayedMatch[],
): number {
  let score = 0;
  for (const { fixture, result } of matches) {
    if (fixture.homeClubId === left && fixture.awayClubId === right)
      score +=
        result.homeGoals > result.awayGoals
          ? 3
          : result.homeGoals === result.awayGoals
            ? 1
            : 0;
    if (fixture.homeClubId === right && fixture.awayClubId === left)
      score -=
        result.homeGoals > result.awayGoals
          ? 3
          : result.homeGoals === result.awayGoals
            ? 1
            : 0;
  }
  return score;
}

function rankParticipants(
  participants: readonly ClubId[],
  matches: readonly PlayedMatch[],
  rules: RankingRule,
  seed: string,
): readonly CompetitionStanding[] {
  const rows = new Map<ClubId, CompetitionStanding>(
    participants.map((clubId) => [
      clubId,
      {
        clubId,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
      },
    ]),
  );
  for (const { fixture, result } of matches) {
    const home = rows.get(fixture.homeClubId);
    const away = rows.get(fixture.awayClubId);
    if (home === undefined || away === undefined)
      throw new Error('Fixture includes a club outside the stage');
    const homeWin = result.homeGoals > result.awayGoals;
    const awayWin = result.awayGoals > result.homeGoals;
    rows.set(home.clubId, {
      ...home,
      played: home.played + 1,
      wins: home.wins + (homeWin ? 1 : 0),
      draws: home.draws + (!homeWin && !awayWin ? 1 : 0),
      losses: home.losses + (awayWin ? 1 : 0),
      goalsFor: home.goalsFor + result.homeGoals,
      goalsAgainst: home.goalsAgainst + result.awayGoals,
      goalDifference: home.goalDifference + result.homeGoals - result.awayGoals,
      points:
        home.points +
        (homeWin
          ? rules.pointsForWin
          : awayWin
            ? rules.pointsForLoss
            : rules.pointsForDraw),
    });
    rows.set(away.clubId, {
      ...away,
      played: away.played + 1,
      wins: away.wins + (awayWin ? 1 : 0),
      draws: away.draws + (!homeWin && !awayWin ? 1 : 0),
      losses: away.losses + (homeWin ? 1 : 0),
      goalsFor: away.goalsFor + result.awayGoals,
      goalsAgainst: away.goalsAgainst + result.homeGoals,
      goalDifference: away.goalDifference + result.awayGoals - result.homeGoals,
      points:
        away.points +
        (awayWin
          ? rules.pointsForWin
          : homeWin
            ? rules.pointsForLoss
            : rules.pointsForDraw),
    });
  }
  const compare = (
    left: CompetitionStanding,
    right: CompetitionStanding,
  ): number => {
    for (const tieBreaker of rules.tieBreakers) {
      const difference = compareTieBreaker(
        tieBreaker,
        left,
        right,
        matches,
        seed,
      );
      if (difference !== 0) return difference;
    }
    return left.clubId.localeCompare(right.clubId);
  };
  return Object.freeze(
    [...rows.values()].sort(compare).map((row) => Object.freeze(row)),
  );
}

function compareTieBreaker(
  rule: TieBreakerRule,
  left: CompetitionStanding,
  right: CompetitionStanding,
  matches: readonly PlayedMatch[],
  seed: string,
): number {
  switch (rule) {
    case 'points':
      return right.points - left.points;
    case 'wins':
      return right.wins - left.wins;
    case 'goal_difference':
      return right.goalDifference - left.goalDifference;
    case 'goals_for':
      return right.goalsFor - left.goalsFor;
    case 'head_to_head':
      return -headToHead(left.clubId, right.clubId, matches);
    case 'deterministic_draw':
      return (
        hashSeed(`${seed}|${left.clubId}`) -
          hashSeed(`${seed}|${right.clubId}`) ||
        left.clubId.localeCompare(right.clubId)
      );
  }
}

export function evaluateRankingStage(
  stage: Extract<CompetitionStage, { type: 'league' | 'groups' }>,
  participants: readonly ClubId[],
  fixtures: readonly CompetitionCalendarFixture[],
  results: readonly CompetitionMatchResult[],
  seed: string,
): StageOutcome {
  const matches = playedMatches(fixtures, results);
  if (stage.type === 'league') {
    const standings = rankParticipants(
      participants,
      matches,
      stage.ranking,
      seed,
    );
    return Object.freeze({
      stageId: stage.id,
      orderedClubIds: Object.freeze(standings.map(({ clubId }) => clubId)),
      standings,
    });
  }
  const groupIds = [...new Set(fixtures.map(({ groupId }) => groupId))];
  if (groupIds.includes(undefined))
    throw new Error('Group fixture is missing groupId');
  const groupStandings: Record<string, readonly CompetitionStanding[]> = {};
  for (const groupId of groupIds as string[]) {
    const groupMatches = matches.filter(
      ({ fixture }) => fixture.groupId === groupId,
    );
    const groupParticipants = [
      ...new Set(
        groupMatches.flatMap(({ fixture }) => [
          fixture.homeClubId,
          fixture.awayClubId,
        ]),
      ),
    ];
    groupStandings[groupId] = rankParticipants(
      groupParticipants,
      groupMatches,
      stage.ranking,
      `${seed}|${groupId}`,
    );
  }
  const sortedGroupIds = Object.keys(groupStandings).sort();
  const ordered = [
    ...sortedGroupIds.flatMap((groupId) =>
      groupStandings[groupId]!.slice(0, stage.advancePerGroup).map(
        ({ clubId }) => clubId,
      ),
    ),
    ...sortedGroupIds.flatMap((groupId) =>
      groupStandings[groupId]!.slice(stage.advancePerGroup).map(
        ({ clubId }) => clubId,
      ),
    ),
  ];
  return Object.freeze({
    stageId: stage.id,
    orderedClubIds: Object.freeze(ordered),
    groupStandings: Object.freeze(groupStandings),
  });
}

export function evaluateKnockoutRound(
  stage: KnockoutStage,
  fixtures: readonly CompetitionCalendarFixture[],
  results: readonly CompetitionMatchResult[],
  seed: string,
): StageOutcome {
  const matches = playedMatches(fixtures, results);
  const ties = new Map<string, PlayedMatch[]>();
  for (const match of matches) {
    if (match.fixture.tieId === undefined)
      throw new Error('Knockout fixture is missing tieId');
    const existing = ties.get(match.fixture.tieId) ?? [];
    existing.push(match);
    ties.set(match.fixture.tieId, existing);
  }
  const winners: ClubId[] = [];
  const losers: ClubId[] = [];
  for (const [tieId, tieMatches] of [...ties].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const clubs = [
      ...new Set(
        tieMatches.flatMap(({ fixture }) => [
          fixture.homeClubId,
          fixture.awayClubId,
        ]),
      ),
    ];
    if (clubs.length !== 2)
      throw new Error(`Tie ${tieId} must contain exactly two clubs`);
    const totals = new Map(clubs.map((clubId) => [clubId, 0]));
    for (const { fixture, result } of tieMatches) {
      totals.set(
        fixture.homeClubId,
        totals.get(fixture.homeClubId)! + result.homeGoals,
      );
      totals.set(
        fixture.awayClubId,
        totals.get(fixture.awayClubId)! + result.awayGoals,
      );
    }
    const left = clubs[0]!;
    const right = clubs[1]!;
    let winner: ClubId;
    if (totals.get(left)! !== totals.get(right)!)
      winner = totals.get(left)! > totals.get(right)! ? left : right;
    else {
      const deciding = tieMatches
        .sort((a, b) => (a.fixture.leg ?? 1) - (b.fixture.leg ?? 1))
        .at(-1)!;
      const homePenalties = deciding.result.homePenaltyGoals;
      const awayPenalties = deciding.result.awayPenaltyGoals;
      if (
        homePenalties !== undefined &&
        awayPenalties !== undefined &&
        homePenalties !== awayPenalties
      )
        winner =
          homePenalties > awayPenalties
            ? deciding.fixture.homeClubId
            : deciding.fixture.awayClubId;
      else
        winner =
          hashSeed(`${seed}|${tieId}|${left}`) <=
          hashSeed(`${seed}|${tieId}|${right}`)
            ? left
            : right;
    }
    winners.push(winner);
    losers.push(winner === left ? right : left);
  }
  return Object.freeze({
    stageId: stage.id,
    orderedClubIds: Object.freeze([...winners, ...losers]),
  });
}

export function resolveStageParticipants(
  stage: CompetitionStage,
  seeded: readonly ClubId[],
  outcomes: readonly StageOutcome[],
): readonly ClubId[] {
  if (stage.participantSource.type === 'seeded')
    return Object.freeze([...seeded]);
  const sourceRule = stage.participantSource;
  const source = outcomes.find(
    ({ stageId }) => stageId === sourceRule.fromStageId,
  );
  if (source === undefined)
    throw new Error(`Missing outcome for ${sourceRule.fromStageId}`);
  const participants = sourceRule.positions.map(
    (position) => source.orderedClubIds[position - 1],
  );
  if (participants.some((clubId) => clubId === undefined))
    throw new Error('Qualification position is outside stage outcome');
  const qualified = participants as ClubId[];
  if (stage.participantSource.type === 'qualified')
    return Object.freeze(qualified);
  const combined = [...seeded, ...qualified];
  if (new Set(combined).size !== combined.length)
    throw new Error('Seeded and qualified participants must be unique');
  return Object.freeze(combined);
}

export function generateCompetitionAwards(
  definition: CompetitionDefinition,
  outcome: CompetitionOutcome,
): readonly CompetitionDomainEvent[] {
  if (definition.id !== outcome.competitionId)
    throw new Error('Definition and outcome competition IDs differ');
  const events: CompetitionDomainEvent[] = [];
  const finalStage = outcome.stages.at(-1);
  if (finalStage === undefined)
    throw new Error('Competition outcome has no stages');
  events.push(
    Object.freeze({
      type: 'CompetitionWon',
      competitionId: definition.id,
      clubId: outcome.championId,
      edition: outcome.edition,
      stageId: finalStage.stageId,
    }),
  );
  for (const award of definition.awards)
    applyAward(events, definition, outcome, award);
  return Object.freeze(events);
}

function applyAward(
  events: CompetitionDomainEvent[],
  definition: CompetitionDefinition,
  outcome: CompetitionOutcome,
  award: AwardRule,
): void {
  const stage = outcome.stages.find(({ stageId }) => stageId === award.stageId);
  if (stage === undefined)
    throw new Error(`Award stage ${award.stageId} has no outcome`);
  for (const position of award.positions) {
    const clubId = stage.orderedClubIds[position - 1];
    if (clubId === undefined)
      throw new Error('Award position is outside stage outcome');
    if (award.prize > 0)
      events.push(
        Object.freeze({
          type: 'PrizeAwarded',
          competitionId: definition.id,
          clubId,
          edition: outcome.edition,
          amount: award.prize,
        }),
      );
    if (award.prestige > 0)
      events.push(
        Object.freeze({
          type: 'PrestigeAwarded',
          competitionId: definition.id,
          clubId,
          edition: outcome.edition,
          points: award.prestige,
          achievement: award.achievement,
        }),
      );
  }
}

export function generateNextSeason(
  outcomes: readonly CompetitionOutcome[],
  allocations: readonly SeasonAllocationRule[],
): SeasonGeneration {
  const outcomeById = new Map(
    outcomes.map((outcome) => [outcome.competitionId, outcome]),
  );
  const participants: Record<string, readonly ClubId[]> = {};
  const events: CompetitionDomainEvent[] = [];
  for (const allocation of allocations) {
    const selected: ClubId[] = [];
    for (const selection of allocation.selections) {
      const outcome = outcomeById.get(selection.sourceCompetitionId);
      if (outcome === undefined)
        throw new Error(`Missing outcome for ${selection.sourceCompetitionId}`);
      const stage = outcome.stages.find(
        ({ stageId }) => stageId === selection.sourceStageId,
      );
      if (stage === undefined)
        throw new Error(`Missing stage outcome ${selection.sourceStageId}`);
      const wanted = selection.count ?? selection.positions.length;
      let added = 0;
      for (const position of selection.positions) {
        const clubId = stage.orderedClubIds[position - 1];
        if (clubId === undefined)
          throw new Error('Season selection position is outside outcome');
        if (selected.includes(clubId)) continue;
        selected.push(clubId);
        added += 1;
        if (selection.event !== undefined)
          events.push(
            Object.freeze({
              type:
                selection.event === 'promoted'
                  ? 'ClubPromoted'
                  : selection.event === 'relegated'
                    ? 'ClubRelegated'
                    : 'ClubQualified',
              clubId,
              fromCompetitionId: selection.sourceCompetitionId,
              toCompetitionId: allocation.targetCompetitionId,
              edition: outcome.edition,
            }),
          );
        if (added === wanted) break;
      }
      if (added !== wanted)
        throw new Error('Season selection could not fill its vacancy count');
    }
    if (selected.length !== allocation.targetSize)
      throw new Error(
        `Allocation for ${allocation.targetCompetitionId} expected ${String(allocation.targetSize)} unique clubs, got ${String(selected.length)}`,
      );
    participants[allocation.targetCompetitionId] = Object.freeze(selected);
  }
  return Object.freeze({
    participants: Object.freeze(participants),
    events: Object.freeze(events),
  });
}
