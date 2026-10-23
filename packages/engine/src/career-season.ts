/* eslint-disable @typescript-eslint/no-non-null-assertion -- stage indexes and configured ids are validated before indexed access */
import type {
  ClubId,
  CompetitionCalendarFixture,
  CompetitionDefinition,
  CompetitionId,
  CompetitionMatchResult,
  CompetitionOutcome,
  CompetitionStanding,
  StageOutcome,
} from '@footebas/domain';
import {
  evaluateKnockoutRound,
  evaluateRankingStage,
  generateNextSeason,
  resolveStageParticipants,
  scheduleCompetitionStage,
  type SeasonGeneration,
} from './competition.js';
import {
  canonicalCompetitionId,
  createConfiguredMvpCompetitionSystem,
  type ConfiguredMvpCompetitionSystem,
  type MvpCompetitionConfig,
  type MvpDivisionId,
} from './mvp-competition-config.js';
import { hashSeed } from './prng.js';

export const CAREER_SEASON_VERSION = 'career-season-v1' as const;
const DIVISIONS = ['serie-a', 'serie-b', 'serie-c'] as const;

/** Progress of one competition inside a running season. */
export interface SeasonCompetition {
  readonly competitionId: CompetitionId;
  readonly stageIndex: number;
  readonly seededByStage: Readonly<Record<string, readonly ClubId[]>>;
  readonly outcomes: readonly StageOutcome[];
  readonly stageFixtureIds: readonly string[];
  readonly stageParticipants: readonly ClubId[];
  readonly byeClubIds: readonly ClubId[];
  readonly entrants: number;
  readonly outcome?: CompetitionOutcome;
}

export interface CareerSeasonState {
  readonly version: typeof CAREER_SEASON_VERSION;
  readonly season: number;
  readonly year: number;
  readonly seed: string;
  readonly divisions: Readonly<Record<MvpDivisionId, readonly ClubId[]>>;
  readonly continentalDirect: readonly ClubId[];
  readonly continentalPreliminary: readonly ClubId[];
  readonly competitions: readonly SeasonCompetition[];
  /** Every fixture scheduled so far, in date order; knockouts appear as draws are made. */
  readonly fixtures: readonly CompetitionCalendarFixture[];
  readonly results: Readonly<Record<string, CompetitionMatchResult>>;
}

export interface CareerSeasonInput {
  readonly season: number;
  readonly year: number;
  readonly seed: string;
  readonly divisions: Readonly<Record<MvpDivisionId, readonly ClubId[]>>;
  readonly continentalDirect: readonly ClubId[];
  readonly continentalPreliminary: readonly ClubId[];
}

export interface SeasonClosure {
  readonly outcomes: readonly CompetitionOutcome[];
  readonly generation: SeasonGeneration;
  readonly next: CareerSeasonInput;
}

function deterministicOrder(
  values: readonly ClubId[],
  seed: string,
): readonly ClubId[] {
  return [...values].sort(
    (left, right) =>
      hashSeed(`${seed}|${left}`) - hashSeed(`${seed}|${right}`) ||
      left.localeCompare(right),
  );
}

function byDate(
  left: CompetitionCalendarFixture,
  right: CompetitionCalendarFixture,
): number {
  return (
    left.date.localeCompare(right.date) ||
    left.competitionId.localeCompare(right.competitionId) ||
    left.id.localeCompare(right.id)
  );
}

export function careerSeasonSystem(
  config: MvpCompetitionConfig,
  state: Pick<CareerSeasonState, 'year'>,
): ConfiguredMvpCompetitionSystem {
  return createConfiguredMvpCompetitionSystem(config, state.year);
}

function definitionOf(
  system: ConfiguredMvpCompetitionSystem,
  competitionId: CompetitionId,
): CompetitionDefinition {
  const definition = system.definitions.find(({ id }) => id === competitionId);
  if (definition === undefined)
    throw new Error(`unknown competition ${competitionId}`);
  return definition;
}

/** Draws the current stage of a competition and returns its fixtures. */
function scheduleStage(
  definition: CompetitionDefinition,
  competition: SeasonCompetition,
  seed: string,
): { competition: SeasonCompetition; fixtures: CompetitionCalendarFixture[] } {
  const stage = definition.stages[competition.stageIndex]!;
  const participants = resolveStageParticipants(
    stage,
    competition.seededByStage[stage.id] ?? [],
    competition.outcomes,
  );
  const scheduled = scheduleCompetitionStage(
    definition,
    stage.id,
    deterministicOrder(
      participants,
      `${seed}|${definition.id}|${stage.id}|seeding`,
    ),
  );
  const byes = new Set(scheduled.byeClubIds);
  return {
    competition: {
      ...competition,
      stageFixtureIds: scheduled.fixtures.map(({ id }) => id),
      stageParticipants: participants.filter((clubId) => !byes.has(clubId)),
      byeClubIds: [...scheduled.byeClubIds],
      entrants:
        competition.stageIndex === 0
          ? participants.length
          : competition.entrants,
    },
    fixtures: [...scheduled.fixtures],
  };
}

export function createCareerSeason(
  config: MvpCompetitionConfig,
  input: CareerSeasonInput,
): CareerSeasonState {
  const system = createConfiguredMvpCompetitionSystem(config, input.year);
  const seeded = new Map<CompetitionId, Record<string, readonly ClubId[]>>();
  for (const league of config.nationalLeagues)
    seeded.set(system.ids.divisions[league.division], {
      league: input.divisions[league.division],
    });
  for (const league of config.stateLeagues)
    seeded.set(canonicalCompetitionId(league.id), {
      league: league.participants.map(([clubId]) => clubId as ClubId),
    });
  const cup = definitionOf(system, system.ids.nationalCup);
  seeded.set(cup.id, {
    [cup.stages[0]!.id]: DIVISIONS.flatMap(
      (division) => input.divisions[division],
    ),
  });
  const continental = definitionOf(system, system.ids.continental);
  seeded.set(continental.id, {
    [continental.stages[0]!.id]: input.continentalPreliminary,
    groups: [
      ...input.continentalDirect,
      ...config.continental.fixedClubIds.map((clubId) => clubId as ClubId),
    ],
  });

  const fixtures: CompetitionCalendarFixture[] = [];
  const competitions = system.definitions.map((definition) => {
    const seededByStage = seeded.get(definition.id);
    if (seededByStage === undefined)
      throw new Error(`no participants configured for ${definition.id}`);
    const scheduled = scheduleStage(
      definition,
      {
        competitionId: definition.id,
        stageIndex: 0,
        seededByStage,
        outcomes: [],
        stageFixtureIds: [],
        stageParticipants: [],
        byeClubIds: [],
        entrants: 0,
      },
      input.seed,
    );
    fixtures.push(...scheduled.fixtures);
    return scheduled.competition;
  });
  return {
    version: CAREER_SEASON_VERSION,
    ...input,
    competitions,
    fixtures: fixtures.sort(byDate),
    results: {},
  };
}

export function pendingFixtures(
  state: CareerSeasonState,
): readonly CompetitionCalendarFixture[] {
  return state.fixtures.filter(({ id }) => state.results[id] === undefined);
}

export function nextMatchDate(state: CareerSeasonState): string | undefined {
  return pendingFixtures(state)[0]?.date;
}

export function fixturesOn(
  state: CareerSeasonState,
  date: string,
): readonly CompetitionCalendarFixture[] {
  return pendingFixtures(state).filter((fixture) => fixture.date === date);
}

export function isSeasonComplete(state: CareerSeasonState): boolean {
  return state.competitions.every(({ outcome }) => outcome !== undefined);
}

function closeStage(
  definition: CompetitionDefinition,
  competition: SeasonCompetition,
  state: CareerSeasonState,
): StageOutcome {
  const stage = definition.stages[competition.stageIndex]!;
  const ids = new Set(competition.stageFixtureIds);
  const fixtures = state.fixtures.filter(({ id }) => ids.has(id));
  const results = fixtures.map(({ id }) => state.results[id]!);
  const seed = `${state.seed}|${String(state.season)}|${definition.id}|${stage.id}`;
  if (stage.type !== 'knockout')
    return evaluateRankingStage(
      stage,
      resolveStageParticipants(
        stage,
        competition.seededByStage[stage.id] ?? [],
        competition.outcomes,
      ),
      fixtures,
      results,
      seed,
    );
  const played = evaluateKnockoutRound(stage, fixtures, results, seed);
  const half = competition.stageParticipants.length / 2;
  return {
    stageId: stage.id,
    orderedClubIds: [
      ...competition.byeClubIds,
      ...played.orderedClubIds.slice(0, half),
      ...played.orderedClubIds.slice(half),
    ],
  };
}

/**
 * Records authoritative results and advances every competition whose current
 * stage is complete: next knockout draws are made only after results exist.
 */
export function recordSeasonResults(
  config: MvpCompetitionConfig,
  state: CareerSeasonState,
  results: readonly CompetitionMatchResult[],
): CareerSeasonState {
  const known = new Set(state.fixtures.map(({ id }) => id));
  const recorded: Record<string, CompetitionMatchResult> = { ...state.results };
  for (const result of results) {
    if (!known.has(result.fixtureId))
      throw new Error(`unknown fixture ${result.fixtureId}`);
    if (recorded[result.fixtureId] !== undefined)
      throw new Error(`fixture ${result.fixtureId} already has a result`);
    recorded[result.fixtureId] = result;
  }
  let next: CareerSeasonState = { ...state, results: recorded };
  const system = createConfiguredMvpCompetitionSystem(config, state.year);
  let progressed = true;
  while (progressed) {
    progressed = false;
    const fixtures = [...next.fixtures];
    const competitions = next.competitions.map((competition) => {
      if (competition.outcome !== undefined) return competition;
      if (
        competition.stageFixtureIds.some((id) => next.results[id] === undefined)
      )
        return competition;
      progressed = true;
      const definition = definitionOf(system, competition.competitionId);
      const outcomes = [
        ...competition.outcomes,
        closeStage(definition, competition, next),
      ];
      if (competition.stageIndex + 1 < definition.stages.length) {
        const scheduled = scheduleStage(
          definition,
          { ...competition, stageIndex: competition.stageIndex + 1, outcomes },
          next.seed,
        );
        fixtures.push(...scheduled.fixtures);
        return scheduled.competition;
      }
      const final = outcomes.at(-1)!;
      const champion = final.orderedClubIds[0];
      if (champion === undefined)
        throw new Error(`${definition.id} finished without a champion`);
      const runnerUp = final.orderedClubIds[1];
      return {
        ...competition,
        outcomes,
        stageFixtureIds: [],
        outcome: {
          competitionId: definition.id,
          edition: next.season,
          stages: outcomes,
          championId: champion,
          ...(runnerUp === undefined ? {} : { runnerUpId: runnerUp }),
        },
      };
    });
    next = { ...next, competitions, fixtures: fixtures.sort(byDate) };
  }
  return next;
}

/** Live table of a ranking stage, valid mid-season. */
export function liveStandings(
  config: MvpCompetitionConfig,
  state: CareerSeasonState,
  competitionId: CompetitionId,
): readonly CompetitionStanding[] {
  const system = createConfiguredMvpCompetitionSystem(config, state.year);
  const definition = definitionOf(system, competitionId);
  const competition = state.competitions.find(
    (candidate) => candidate.competitionId === competitionId,
  );
  if (competition === undefined)
    throw new Error(`competition ${competitionId} is not in this season`);
  const stageIndex =
    competition.outcome === undefined
      ? competition.stageIndex
      : definition.stages.length - 1;
  const stage = definition.stages[stageIndex]!;
  if (stage.type !== 'league') return [];
  if (competition.outcome !== undefined)
    return competition.outcome.stages.at(-1)?.standings ?? [];
  const ids = new Set(competition.stageFixtureIds);
  const fixtures = state.fixtures.filter(
    ({ id }) => ids.has(id) && state.results[id] !== undefined,
  );
  const outcome = evaluateRankingStage(
    stage,
    competition.seededByStage[stage.id] ?? [],
    fixtures,
    fixtures.map(({ id }) => state.results[id]!),
    `${state.seed}|${String(state.season)}|${definition.id}|live`,
  );
  return outcome.standings ?? [];
}

/** One knockout tie of a stage, with the legs played so far. */
export interface LiveTie {
  readonly tieId: string;
  /** Home club of the first leg. */
  readonly homeClubId: ClubId;
  readonly awayClubId: ClubId;
  readonly legs: readonly {
    readonly fixture: CompetitionCalendarFixture;
    readonly result?: CompetitionMatchResult;
  }[];
  /** Goals over the legs played, from the first-leg home club's side. */
  readonly aggregate?: { readonly home: number; readonly away: number };
  /** Set once every leg is played (same rule as the stage close). */
  readonly winnerClubId?: ClubId;
  /** `tiebreak` when the aggregate was level (penalties or the draw). */
  readonly decidedBy?: 'goals' | 'tiebreak';
}

/** A stage of a competition as it stands now (tables or ties). */
export interface LiveStage {
  readonly stageId: string;
  readonly name: string;
  readonly type: CompetitionDefinition['stages'][number]['type'];
  readonly status: 'scheduled' | 'active' | 'complete';
  /** League: one group (the stage itself); groups: one per group. */
  readonly groups: readonly {
    readonly groupId: string;
    readonly standings: readonly CompetitionStanding[];
  }[];
  readonly ties: readonly LiveTie[];
  /** Clubs that skip the current knockout round. */
  readonly byeClubIds: readonly ClubId[];
}

export interface LiveCompetition {
  readonly competitionId: CompetitionId;
  readonly currentStageId: string;
  readonly championId?: ClubId;
  /** Date of the last match, once the competition is decided. */
  readonly decidedOn?: string;
  readonly stages: readonly LiveStage[];
}

function knockoutTies(
  stage: Extract<CompetitionDefinition['stages'][number], { type: 'knockout' }>,
  fixtures: readonly CompetitionCalendarFixture[],
  results: CareerSeasonState['results'],
  seed: string,
): LiveTie[] {
  const byTie = new Map<string, CompetitionCalendarFixture[]>();
  for (const fixture of fixtures) {
    const tieId = fixture.tieId ?? fixture.id;
    byTie.set(tieId, [...(byTie.get(tieId) ?? []), fixture]);
  }
  return [...byTie].map(([tieId, legs]) => {
    const ordered = [...legs].sort(
      (left, right) => (left.leg ?? 1) - (right.leg ?? 1),
    );
    const first = ordered[0]!;
    const played = ordered.filter(({ id }) => results[id] !== undefined);
    const goals = (clubId: ClubId) =>
      played.reduce((sum, fixture) => {
        const result = results[fixture.id]!;
        return (
          sum +
          (fixture.homeClubId === clubId
            ? result.homeGoals
            : fixture.awayClubId === clubId
              ? result.awayGoals
              : 0)
        );
      }, 0);
    const aggregate =
      played.length === 0
        ? undefined
        : { home: goals(first.homeClubId), away: goals(first.awayClubId) };
    const complete = played.length === ordered.length && aggregate;
    const winnerClubId = complete
      ? evaluateKnockoutRound(
          stage,
          ordered,
          ordered.map(({ id }) => results[id]!),
          seed,
        ).orderedClubIds[0]
      : undefined;
    return {
      tieId,
      homeClubId: first.homeClubId,
      awayClubId: first.awayClubId,
      legs: ordered.map((fixture) => ({
        fixture,
        ...(results[fixture.id] === undefined
          ? {}
          : { result: results[fixture.id]! }),
      })),
      ...(aggregate === undefined ? {} : { aggregate }),
      ...(winnerClubId === undefined
        ? {}
        : {
            winnerClubId,
            decidedBy:
              aggregate!.home === aggregate!.away
                ? ('tiebreak' as const)
                : ('goals' as const),
          }),
    };
  });
}

/**
 * Every stage of a competition as it stands mid-season: league and group
 * tables (live until the stage closes, then the closed ranking) and
 * knockout ties with aggregate and winner. Read-only; never changes the
 * season.
 */
export function liveCompetition(
  config: MvpCompetitionConfig,
  state: CareerSeasonState,
  competitionId: CompetitionId,
): LiveCompetition {
  const system = createConfiguredMvpCompetitionSystem(config, state.year);
  const definition = definitionOf(system, competitionId);
  const competition = state.competitions.find(
    (candidate) => candidate.competitionId === competitionId,
  );
  if (competition === undefined)
    throw new Error(`competition ${competitionId} is not in this season`);
  const decided = competition.outcome !== undefined;
  const current = decided
    ? definition.stages.length - 1
    : competition.stageIndex;
  const all = state.fixtures.filter(
    (fixture) => fixture.competitionId === competitionId,
  );
  const stages = definition.stages.map((stage, index): LiveStage => {
    const fixtures = all.filter(({ stageId }) => stageId === stage.id);
    const closed = competition.outcomes.find(
      (outcome) => outcome.stageId === stage.id,
    );
    const status =
      closed !== undefined
        ? ('complete' as const)
        : index === current &&
            fixtures.some(({ id }) => state.results[id] !== undefined)
          ? ('active' as const)
          : ('scheduled' as const);
    const seed = `${state.seed}|${String(state.season)}|${definition.id}|${stage.id}`;
    const base = {
      stageId: stage.id,
      name: stage.name,
      type: stage.type,
      status,
      byeClubIds:
        index === current && !decided ? [...competition.byeClubIds] : [],
    };
    if (stage.type === 'knockout')
      return {
        ...base,
        groups: [],
        ties: knockoutTies(stage, fixtures, state.results, seed),
      };
    if (stage.type === 'league') {
      const standings =
        closed?.standings ??
        (index === current ? liveStandings(config, state, competitionId) : []);
      return {
        ...base,
        groups:
          standings.length === 0 ? [] : [{ groupId: stage.id, standings }],
        ties: [],
      };
    }
    const groupIds = [
      ...new Set(fixtures.flatMap(({ groupId }) => groupId ?? [])),
    ].sort();
    const groups = groupIds.map((groupId) => {
      const known = closed?.groupStandings?.[groupId];
      if (known !== undefined) return { groupId, standings: known };
      const groupFixtures = fixtures.filter(
        (fixture) => fixture.groupId === groupId,
      );
      const played = groupFixtures.filter(
        ({ id }) => state.results[id] !== undefined,
      );
      const outcome = evaluateRankingStage(
        {
          id: stage.id,
          name: stage.name,
          type: 'league',
          participantSource: stage.participantSource,
          schedule: stage.schedule,
          roundRobin: stage.roundRobin,
          ranking: stage.ranking,
        },
        [
          ...new Set(
            groupFixtures.flatMap(({ homeClubId, awayClubId }) => [
              homeClubId,
              awayClubId,
            ]),
          ),
        ],
        played,
        played.map(({ id }) => state.results[id]!),
        `${seed}|${groupId}`,
      );
      return { groupId, standings: outcome.standings ?? [] };
    });
    return { ...base, groups, ties: [] };
  });
  const lastDate = all
    .filter(({ id }) => state.results[id] !== undefined)
    .map(({ date }) => date)
    .sort()
    .at(-1);
  return {
    competitionId,
    currentStageId: definition.stages[current]!.id,
    ...(competition.outcome === undefined
      ? {}
      : {
          championId: competition.outcome.championId,
          ...(lastDate === undefined ? {} : { decidedOn: lastDate }),
        }),
    stages,
  };
}

export function closeCareerSeason(
  config: MvpCompetitionConfig,
  state: CareerSeasonState,
): SeasonClosure {
  if (!isSeasonComplete(state))
    throw new Error('season still has competitions in progress');
  const system = createConfiguredMvpCompetitionSystem(config, state.year);
  const outcomes = state.competitions.map(({ outcome }) => outcome!);
  const generation = generateNextSeason(outcomes, system.nextSeasonAllocations);
  const continental = generation.participants[system.ids.continental];
  if (continental === undefined)
    throw new Error('season generation produced no continental entrants');
  const divisions = Object.fromEntries(
    DIVISIONS.map((division) => {
      const participants =
        generation.participants[system.ids.divisions[division]];
      if (participants === undefined)
        throw new Error(`season generation produced no ${division}`);
      return [division, participants];
    }),
  ) as unknown as Record<MvpDivisionId, readonly ClubId[]>;
  return {
    outcomes,
    generation,
    next: {
      season: state.season + 1,
      year: state.year + 1,
      seed: state.seed,
      divisions,
      continentalDirect: continental.slice(0, config.continental.directSlots),
      continentalPreliminary: continental.slice(config.continental.directSlots),
    },
  };
}
