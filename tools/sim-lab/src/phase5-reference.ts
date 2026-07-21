/* eslint-disable @typescript-eslint/no-non-null-assertion -- canonical config and stage cardinalities are validated before execution */
/* Canonical Phase 5 harness: orchestration only; all scheduling, ranking,
 * transitions and validation execute @footebas/engine. */
import {
  entityId,
  type ClubId,
  type CompetitionCalendarFixture,
  type CompetitionDefinition,
  type CompetitionMatchResult,
  type CompetitionOutcome,
  type StageOutcome,
} from '@footebas/domain';
import {
  COMPETITION_ENGINE_VERSION,
  canonicalCompetitionId,
  createConfiguredMvpCompetitionSystem,
  evaluateKnockoutRound,
  evaluateRankingStage,
  generateCompetitionAwards,
  generateNextSeason,
  hashSeed,
  resolveStageParticipants,
  scheduleCompetitionStage,
  validateCompetitionCalendar,
} from '@footebas/engine';
import type {
  CompetitionConfig,
  DivisionId,
  PhaseFiveContent,
} from './phase5-content.js';

export const PHASE_FIVE_REFERENCE_VERSION = COMPETITION_ENGINE_VERSION;

export type ReferenceFixture = CompetitionCalendarFixture;

export interface CompetitionClosure {
  readonly competitionId: string;
  readonly championClubId: string;
  readonly participants: number;
  readonly matches: number;
  readonly closed: true;
}

export interface ReferenceSeasonState {
  readonly season: number;
  readonly divisions: Readonly<Record<DivisionId, readonly string[]>>;
  readonly continentalDirect: readonly string[];
  readonly continentalPreliminary: readonly string[];
}

export interface ReferenceSeasonResult {
  readonly season: number;
  readonly fixtures: readonly ReferenceFixture[];
  readonly closures: readonly CompetitionClosure[];
  readonly nationalRankings: Readonly<Record<DivisionId, readonly string[]>>;
  readonly cupChampion: string;
  readonly next: ReferenceSeasonState;
}

function canonicalClubId(value: string): ClubId {
  return entityId(
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, ''),
    'club',
  );
}

function deterministicOrder(
  values: readonly ClubId[],
  seed: string,
): readonly ClubId[] {
  return Object.freeze(
    [...values].sort(
      (left, right) =>
        hashSeed(`${seed}|${left}`) - hashSeed(`${seed}|${right}`) ||
        left.localeCompare(right),
    ),
  );
}

function resultFor(
  fixture: CompetitionCalendarFixture,
  seed: string,
): CompetitionMatchResult {
  return Object.freeze({
    fixtureId: fixture.id,
    homeGoals: hashSeed(`${seed}|${fixture.id}|home`) % 5,
    awayGoals: hashSeed(`${seed}|${fixture.id}|away`) % 5,
  });
}

interface PlayedCompetition {
  readonly outcome: CompetitionOutcome;
  readonly fixtures: readonly CompetitionCalendarFixture[];
  readonly stageParticipants: Readonly<Record<string, readonly ClubId[]>>;
  readonly entrants: number;
}

function playCompetition(
  definition: CompetitionDefinition,
  seededByStage: Readonly<Record<string, readonly ClubId[]>>,
  edition: number,
  seed: string,
): PlayedCompetition {
  const outcomes: StageOutcome[] = [];
  const fixtures: CompetitionCalendarFixture[] = [];
  const stageParticipants: Record<string, readonly ClubId[]> = {};
  let entrants = 0;
  for (const stage of definition.stages) {
    const seeded = seededByStage[stage.id] ?? [];
    const participants = resolveStageParticipants(stage, seeded, outcomes);
    if (outcomes.length === 0) entrants = participants.length;
    const scheduled = scheduleCompetitionStage(
      definition,
      stage.id,
      deterministicOrder(participants, `${seed}|${stage.id}|seeding`),
    );
    const byes = new Set(scheduled.byeClubIds);
    const activeParticipants = participants.filter(
      (clubId) => !byes.has(clubId),
    );
    stageParticipants[stage.id] = Object.freeze(activeParticipants);
    fixtures.push(...scheduled.fixtures);
    const results = scheduled.fixtures.map((fixture) =>
      resultFor(fixture, `${seed}|${stage.id}`),
    );
    let outcome: StageOutcome;
    if (stage.type === 'knockout') {
      const played = evaluateKnockoutRound(
        stage,
        scheduled.fixtures,
        results,
        `${seed}|${stage.id}`,
      );
      const winners = played.orderedClubIds.slice(
        0,
        activeParticipants.length / 2,
      );
      const losers = played.orderedClubIds.slice(activeParticipants.length / 2);
      outcome = Object.freeze({
        stageId: stage.id,
        orderedClubIds: Object.freeze([
          ...scheduled.byeClubIds,
          ...winners,
          ...losers,
        ]),
      });
    } else {
      outcome = evaluateRankingStage(
        stage,
        participants,
        scheduled.fixtures,
        results,
        `${seed}|${stage.id}`,
      );
    }
    outcomes.push(outcome);
  }
  const final = outcomes.at(-1);
  const champion = final?.orderedClubIds[0];
  if (final === undefined || champion === undefined)
    throw new Error(`${definition.id} did not produce a champion`);
  return Object.freeze({
    outcome: Object.freeze({
      competitionId: definition.id,
      edition,
      stages: Object.freeze(outcomes),
      championId: champion,
      ...(final.orderedClubIds[1] === undefined
        ? {}
        : { runnerUpId: final.orderedClubIds[1] }),
    }),
    fixtures: Object.freeze(fixtures),
    stageParticipants: Object.freeze(stageParticipants),
    entrants,
  });
}

export function initialReferenceState(
  content: PhaseFiveContent,
): ReferenceSeasonState {
  const divisions = Object.fromEntries(
    (['serie-a', 'serie-b', 'serie-c'] as const).map((division) => [
      division,
      Object.freeze(
        content.clubs
          .filter(({ initialDivision }) => initialDivision === division)
          .map(({ id }) => canonicalClubId(id)),
      ),
    ]),
  ) as unknown as Record<DivisionId, readonly string[]>;
  return Object.freeze({
    season: 1,
    divisions: Object.freeze(divisions),
    continentalDirect: Object.freeze(
      content.config.continental.initialDirectClubIds.map(canonicalClubId),
    ),
    continentalPreliminary: Object.freeze(
      content.config.continental.initialPreliminaryClubIds.map(canonicalClubId),
    ),
  });
}

function yearForSeason(season: number): number {
  const year = 2025 + season;
  if (year > 9999) throw new Error('Phase five season exceeds game-date range');
  return year;
}

function stageMap(
  target: Record<string, Record<string, readonly ClubId[]>>,
  competitionId: string,
  participants: Readonly<Record<string, readonly ClubId[]>>,
): void {
  target[competitionId] = { ...participants };
}

export function validateReferenceCalendar(
  fixtures: readonly ReferenceFixture[],
  config: CompetitionConfig,
): readonly string[] {
  if (fixtures.length === 0) return ['calendar has no fixtures'];
  const year = Number(fixtures[0]!.date.slice(0, 4));
  const system = createConfiguredMvpCompetitionSystem(config, year);
  const participants: Record<string, Record<string, readonly ClubId[]>> = {};
  for (const fixture of fixtures) {
    const byStage = participants[fixture.competitionId] ?? {};
    const clubs = new Set(byStage[fixture.stageId] ?? []);
    clubs.add(fixture.homeClubId);
    clubs.add(fixture.awayClubId);
    byStage[fixture.stageId] = Object.freeze([...clubs]);
    participants[fixture.competitionId] = byStage;
  }
  const validation = validateCompetitionCalendar({
    fixtures,
    competitions: system.definitions,
    stageParticipants: participants,
    minimumIntervalDays: system.minimumIntervalDays,
    reservedDates: system.reservedDates,
  });
  return Object.freeze(
    validation.violations.map(({ code, message }) =>
      code === 'MINIMUM_INTERVAL'
        ? `${code} rest days: ${message}`
        : `${code}: ${message}`,
    ),
  );
}

export function simulateReferenceSeason(
  content: PhaseFiveContent,
  state: ReferenceSeasonState,
  seed: string,
): ReferenceSeasonResult {
  const system = createConfiguredMvpCompetitionSystem(
    content.config,
    yearForSeason(state.season),
  );
  const played: PlayedCompetition[] = [];
  const rankings = {} as Record<DivisionId, readonly string[]>;
  const fixtures: CompetitionCalendarFixture[] = [];
  const calendarParticipants: Record<
    string,
    Record<string, readonly ClubId[]>
  > = {};
  const definitionById = new Map(
    system.definitions.map((definition) => [definition.id, definition]),
  );

  for (const league of content.config.nationalLeagues) {
    const definition = definitionById.get(
      system.ids.divisions[league.division],
    );
    if (definition === undefined)
      throw new Error(`Missing ${league.division} definition`);
    const participants = state.divisions[league.division].map(canonicalClubId);
    const competition = playCompetition(
      definition,
      { league: participants },
      state.season,
      `${seed}|${String(state.season)}|${definition.id}`,
    );
    rankings[league.division] = competition.outcome.stages[0]!.orderedClubIds;
    played.push(competition);
  }

  for (const configured of content.config.stateLeagues) {
    const definition = definitionById.get(
      canonicalCompetitionId(configured.id),
    );
    if (definition === undefined)
      throw new Error(`Missing state definition ${configured.id}`);
    played.push(
      playCompetition(
        definition,
        {
          league: configured.participants.map(([clubId]) =>
            canonicalClubId(clubId),
          ),
        },
        state.season,
        `${seed}|${String(state.season)}|${definition.id}`,
      ),
    );
  }

  const allNational = (['serie-a', 'serie-b', 'serie-c'] as const).flatMap(
    (division) => state.divisions[division].map(canonicalClubId),
  );
  const cupDefinition = definitionById.get(system.ids.nationalCup)!;
  const cup = playCompetition(
    cupDefinition,
    { [cupDefinition.stages[0]!.id]: allNational },
    state.season,
    `${seed}|${String(state.season)}|${cupDefinition.id}`,
  );
  played.push(cup);

  const continentalDefinition = definitionById.get(system.ids.continental)!;
  const continental = playCompetition(
    continentalDefinition,
    {
      [continentalDefinition.stages[0]!.id]:
        state.continentalPreliminary.map(canonicalClubId),
      groups: state.continentalDirect.map(canonicalClubId),
    },
    state.season,
    `${seed}|${String(state.season)}|${continentalDefinition.id}`,
  );
  played.push(continental);

  for (const competition of played) {
    fixtures.push(...competition.fixtures);
    stageMap(
      calendarParticipants,
      competition.outcome.competitionId,
      competition.stageParticipants,
    );
    const definition = definitionById.get(competition.outcome.competitionId)!;
    const events = generateCompetitionAwards(definition, competition.outcome);
    if (!events.some(({ type }) => type === 'CompetitionWon'))
      throw new Error(`${definition.id} did not emit its title event`);
  }
  const validation = validateCompetitionCalendar({
    fixtures,
    competitions: system.definitions,
    stageParticipants: calendarParticipants,
    minimumIntervalDays: system.minimumIntervalDays,
    reservedDates: system.reservedDates,
  });
  if (!validation.valid)
    throw new Error(
      `Calendar rejected before season: ${validation.violations
        .map(({ code }) => code)
        .join(', ')}`,
    );

  const generation = generateNextSeason(
    played.map(({ outcome }) => outcome),
    system.nextSeasonAllocations,
  );
  const continentalEntrants = generation.participants[system.ids.continental];
  if (continentalEntrants === undefined)
    throw new Error('Engine did not generate continental entrants');
  const next: ReferenceSeasonState = Object.freeze({
    season: state.season + 1,
    divisions: Object.freeze(
      Object.fromEntries(
        (['serie-a', 'serie-b', 'serie-c'] as const).map((division) => {
          const participants =
            generation.participants[system.ids.divisions[division]];
          if (participants === undefined)
            throw new Error(`Engine did not generate ${division}`);
          return [division, participants];
        }),
      ) as unknown as Record<DivisionId, readonly string[]>,
    ),
    continentalDirect: Object.freeze(
      continentalEntrants.slice(0, content.config.continental.directSlots),
    ),
    continentalPreliminary: Object.freeze(
      continentalEntrants.slice(content.config.continental.directSlots),
    ),
  });
  const closures = played.map(({ outcome, fixtures: matches, entrants }) =>
    Object.freeze({
      competitionId: outcome.competitionId,
      championClubId: outcome.championId,
      participants: entrants,
      matches: matches.length,
      closed: true as const,
    }),
  );
  return Object.freeze({
    season: state.season,
    fixtures: Object.freeze(fixtures),
    closures: Object.freeze(closures),
    nationalRankings: Object.freeze(rankings),
    cupChampion: cup.outcome.championId,
    next,
  });
}
