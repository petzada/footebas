/* eslint-disable @typescript-eslint/no-non-null-assertion -- config cardinalities are validated before compilation */
import {
  GameDate,
  createCompetitionDefinition,
  entityId,
  type CompetitionDefinition,
  type CompetitionId,
  type RankingRule,
  type SeasonAllocationRule,
} from '@footebas/domain';

export const MVP_COMPETITION_CONFIG_VERSION =
  'footebas-mvp-competitions-v1' as const;

export type MvpDivisionId = 'serie-a' | 'serie-b' | 'serie-c';

export interface MvpLeagueConfig {
  readonly id: string;
  readonly name: string;
  readonly division: MvpDivisionId;
  readonly clubs: number;
  readonly roundRobinLegs: 1 | 2;
  readonly promoted: number;
  readonly relegated: number;
  readonly firstMatchDay: number;
  readonly matchDayInterval: number;
}

export interface MvpCupConfig {
  readonly id: string;
  readonly name: string;
  readonly participantSelector: 'all-national-clubs';
  readonly legsByRound: readonly (1 | 2)[];
  readonly matchDays: readonly number[];
}

export interface MvpStateLeagueConfig {
  readonly id: string;
  readonly name: string;
  readonly sourceSection: string;
  readonly firstMatchDay: number;
  readonly matchDayInterval: number;
  readonly participants: readonly (readonly [string, string])[];
}

export interface MvpContinentalConfig {
  readonly id: string;
  readonly name: string;
  readonly initialDirectClubIds: readonly string[];
  readonly initialPreliminaryClubIds: readonly string[];
  /** Clubs outside the national pyramid (e.g. foreign) seeded into groups every season. */
  readonly fixedClubIds: readonly string[];
  readonly directSlots: number;
  readonly preliminarySlots: number;
  readonly groupCount: number;
  readonly groupSize: number;
  readonly qualifiersPerGroup: number;
  readonly preliminaryLegs: 1 | 2;
  readonly knockoutLegs: 1 | 2;
  readonly preliminaryMatchDays: readonly number[];
  readonly groupMatchDays: readonly number[];
  readonly knockoutMatchDays: readonly number[];
}

export interface MvpCompetitionConfig {
  readonly schemaVersion: typeof MVP_COMPETITION_CONFIG_VERSION;
  readonly seasonDays: number;
  /** Whole rest days between fixtures; one rest day means dates differ by two. */
  readonly minimumRestDays: number;
  readonly reservedMatchDays: readonly number[];
  readonly sources: Readonly<
    Record<MvpDivisionId | 'states' | 'cup' | 'continental', string>
  >;
  readonly nationalLeagues: readonly MvpLeagueConfig[];
  readonly nationalCup: MvpCupConfig;
  readonly stateLeagues: readonly MvpStateLeagueConfig[];
  readonly continental: MvpContinentalConfig;
}

export interface ConfiguredMvpCompetitionSystem {
  readonly configVersion: typeof MVP_COMPETITION_CONFIG_VERSION;
  readonly definitions: readonly CompetitionDefinition[];
  readonly nextSeasonAllocations: readonly SeasonAllocationRule[];
  readonly ids: Readonly<{
    divisions: Readonly<Record<MvpDivisionId, CompetitionId>>;
    nationalCup: CompetitionId;
    continental: CompetitionId;
  }>;
  readonly reservedDates: readonly string[];
  readonly minimumIntervalDays: number;
}

const ranking: RankingRule = Object.freeze({
  pointsForWin: 3,
  pointsForDraw: 1,
  pointsForLoss: 0,
  tieBreakers: Object.freeze<RankingRule['tieBreakers']>([
    'points',
    'wins',
    'goal_difference',
    'goals_for',
    'head_to_head',
    'deterministic_draw',
  ]),
});

function object(value: unknown, context: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${context} must be an object`);
  return value as Record<string, unknown>;
}

function text(value: unknown, context: string): string {
  if (typeof value !== 'string' || value.trim().length === 0)
    throw new Error(`${context} must be a non-empty string`);
  return value;
}

function integer(value: unknown, context: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum)
    throw new Error(`${context} must be an integer >= ${String(minimum)}`);
  return value as number;
}

function leg(value: unknown, context: string): 1 | 2 {
  const parsed = integer(value, context, 1);
  if (parsed !== 1 && parsed !== 2)
    throw new Error(`${context} must be one or two`);
  return parsed;
}

function array(value: unknown, context: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${context} must be an array`);
  return value;
}

function integers(value: unknown, context: string): readonly number[] {
  return array(value, context).map((item, index) =>
    integer(item, `${context}[${String(index)}]`),
  );
}

function strings(value: unknown, context: string): readonly string[] {
  return array(value, context).map((item, index) =>
    text(item, `${context}[${String(index)}]`),
  );
}

function unique(values: readonly (string | number)[], context: string): void {
  if (new Set(values).size !== values.length)
    throw new Error(`${context} must contain unique values`);
}

function parseLeague(value: unknown, index: number): MvpLeagueConfig {
  const item = object(value, `nationalLeagues[${String(index)}]`);
  const division = text(item.division, 'league.division');
  if (
    division !== 'serie-a' &&
    division !== 'serie-b' &&
    division !== 'serie-c'
  )
    throw new Error(`Unsupported national division ${division}`);
  return {
    id: text(item.id, 'league.id'),
    name: text(item.name, 'league.name'),
    division,
    clubs: integer(item.clubs, 'league.clubs', 2),
    roundRobinLegs: leg(item.roundRobinLegs, 'league.roundRobinLegs'),
    promoted: integer(item.promoted, 'league.promoted'),
    relegated: integer(item.relegated, 'league.relegated'),
    firstMatchDay: integer(item.firstMatchDay, 'league.firstMatchDay'),
    matchDayInterval: integer(
      item.matchDayInterval,
      'league.matchDayInterval',
      1,
    ),
  };
}

function parseCup(value: unknown): MvpCupConfig {
  const item = object(value, 'nationalCup');
  if (item.participantSelector !== 'all-national-clubs')
    throw new Error('nationalCup.participantSelector is unsupported');
  const legsByRound = array(item.legsByRound, 'nationalCup.legsByRound').map(
    (item, index) => leg(item, `nationalCup.legsByRound[${String(index)}]`),
  );
  const matchDays = integers(item.matchDays, 'nationalCup.matchDays');
  if (
    legsByRound.length === 0 ||
    legsByRound.reduce((sum, count) => sum + count, 0) !== matchDays.length
  )
    throw new Error(
      'nationalCup must provide one match day per configured leg',
    );
  unique(matchDays, 'nationalCup.matchDays');
  return {
    id: text(item.id, 'nationalCup.id'),
    name: text(item.name, 'nationalCup.name'),
    participantSelector: 'all-national-clubs',
    legsByRound,
    matchDays,
  };
}

function parseState(value: unknown, index: number): MvpStateLeagueConfig {
  const item = object(value, `stateLeagues[${String(index)}]`);
  const participants = array(item.participants, 'stateLeague.participants').map(
    (entry, participantIndex) => {
      if (!Array.isArray(entry) || entry.length !== 2)
        throw new Error(
          `stateLeague participant ${String(participantIndex)} must be [clubId, sourceIdentity]`,
        );
      return [
        text(entry[0], 'stateLeague participant clubId'),
        text(entry[1], 'stateLeague participant sourceIdentity'),
      ] as const;
    },
  );
  if (participants.length < 4)
    throw new Error('stateLeague must contain at least four national clubs');
  unique(
    participants.map(([clubId]) => clubId),
    'stateLeague participant club IDs',
  );
  return {
    id: text(item.id, 'stateLeague.id'),
    name: text(item.name, 'stateLeague.name'),
    sourceSection: text(item.sourceSection, 'stateLeague.sourceSection'),
    firstMatchDay: integer(item.firstMatchDay, 'stateLeague.firstMatchDay'),
    matchDayInterval: integer(
      item.matchDayInterval,
      'stateLeague.matchDayInterval',
      1,
    ),
    participants,
  };
}

function parseContinental(value: unknown): MvpContinentalConfig {
  const item = object(value, 'continental');
  const parsed: MvpContinentalConfig = {
    id: text(item.id, 'continental.id'),
    name: text(item.name, 'continental.name'),
    initialDirectClubIds: strings(
      item.initialDirectClubIds,
      'continental.initialDirectClubIds',
    ),
    initialPreliminaryClubIds: strings(
      item.initialPreliminaryClubIds,
      'continental.initialPreliminaryClubIds',
    ),
    fixedClubIds:
      item.fixedClubIds === undefined
        ? []
        : strings(item.fixedClubIds, 'continental.fixedClubIds'),
    directSlots: integer(item.directSlots, 'continental.directSlots', 1),
    preliminarySlots: integer(
      item.preliminarySlots,
      'continental.preliminarySlots',
      2,
    ),
    groupCount: integer(item.groupCount, 'continental.groupCount', 1),
    groupSize: integer(item.groupSize, 'continental.groupSize', 2),
    qualifiersPerGroup: integer(
      item.qualifiersPerGroup,
      'continental.qualifiersPerGroup',
      1,
    ),
    preliminaryLegs: leg(item.preliminaryLegs, 'continental.preliminaryLegs'),
    knockoutLegs: leg(item.knockoutLegs, 'continental.knockoutLegs'),
    preliminaryMatchDays: integers(
      item.preliminaryMatchDays,
      'continental.preliminaryMatchDays',
    ),
    groupMatchDays: integers(item.groupMatchDays, 'continental.groupMatchDays'),
    knockoutMatchDays: integers(
      item.knockoutMatchDays,
      'continental.knockoutMatchDays',
    ),
  };
  unique(
    [
      ...parsed.initialDirectClubIds,
      ...parsed.initialPreliminaryClubIds,
      ...parsed.fixedClubIds,
    ],
    'continental initial participants',
  );
  const preliminaryWinners = parsed.preliminarySlots / 2;
  if (!Number.isInteger(preliminaryWinners))
    throw new Error('continental.preliminarySlots must be even');
  if (
    parsed.directSlots + parsed.fixedClubIds.length + preliminaryWinners !==
    parsed.groupCount * parsed.groupSize
  )
    throw new Error(
      'continental group cardinality does not close after preliminary',
    );
  if (parsed.initialDirectClubIds.length !== parsed.directSlots)
    throw new Error('continental initial direct slots do not match config');
  if (parsed.initialPreliminaryClubIds.length !== parsed.preliminarySlots)
    throw new Error(
      'continental initial preliminary slots do not match config',
    );
  if (parsed.qualifiersPerGroup >= parsed.groupSize)
    throw new Error(
      'continental group qualifiers must be fewer than group size',
    );
  if (parsed.preliminaryMatchDays.length !== parsed.preliminaryLegs)
    throw new Error('continental preliminary legs/match days mismatch');
  const groupRounds = (parsed.groupSize - 1) * 2;
  if (parsed.groupMatchDays.length !== groupRounds)
    throw new Error('continental group match-day cardinality mismatch');
  const knockoutClubs = parsed.groupCount * parsed.qualifiersPerGroup;
  const knockoutRounds = Math.log2(knockoutClubs);
  if (!Number.isInteger(knockoutRounds))
    throw new Error('continental knockout qualifiers must be a power of two');
  if (parsed.knockoutMatchDays.length !== knockoutRounds * parsed.knockoutLegs)
    throw new Error('continental knockout legs/match days mismatch');
  return parsed;
}

export function parseMvpCompetitionConfig(
  value: unknown,
): MvpCompetitionConfig {
  const root = object(value, 'competition config');
  if (root.schemaVersion !== MVP_COMPETITION_CONFIG_VERSION)
    throw new Error('Unsupported competition config schemaVersion');
  const source = object(root.sources, 'sources');
  const nationalLeagues = array(root.nationalLeagues, 'nationalLeagues').map(
    parseLeague,
  );
  const stateLeagues = array(root.stateLeagues, 'stateLeagues').map(parseState);
  unique(
    nationalLeagues.map(({ id }) => id),
    'national league IDs',
  );
  unique(
    nationalLeagues.map(({ division }) => division),
    'national divisions',
  );
  if (nationalLeagues.length !== 3)
    throw new Error(
      'MVP competition config requires exactly three national divisions',
    );
  unique(
    stateLeagues.map(({ id }) => id),
    'state league IDs',
  );
  const config: MvpCompetitionConfig = {
    schemaVersion: MVP_COMPETITION_CONFIG_VERSION,
    seasonDays: integer(root.seasonDays, 'seasonDays', 1),
    minimumRestDays: integer(root.minimumRestDays, 'minimumRestDays'),
    reservedMatchDays: integers(root.reservedMatchDays, 'reservedMatchDays'),
    sources: {
      'serie-a': text(source['serie-a'], 'sources.serie-a'),
      'serie-b': text(source['serie-b'], 'sources.serie-b'),
      'serie-c': text(source['serie-c'], 'sources.serie-c'),
      states: text(source.states, 'sources.states'),
      cup: text(source.cup, 'sources.cup'),
      continental: text(source.continental, 'sources.continental'),
    },
    nationalLeagues,
    nationalCup: parseCup(root.nationalCup),
    stateLeagues,
    continental: parseContinental(root.continental),
  };
  unique(config.reservedMatchDays, 'reservedMatchDays');
  const competitionIds = [
    ...nationalLeagues.map(({ id }) => id),
    config.nationalCup.id,
    ...stateLeagues.map(({ id }) => id),
    config.continental.id,
  ];
  unique(competitionIds, 'competition IDs');
  const maximumDay = (days: readonly number[], context: string): void => {
    if (days.some((day) => day >= config.seasonDays))
      throw new Error(`${context} contains a match day outside the season`);
  };
  maximumDay(config.reservedMatchDays, 'reservedMatchDays');
  for (const league of nationalLeagues) {
    const rounds =
      (league.clubs % 2 === 0 ? league.clubs - 1 : league.clubs) *
      league.roundRobinLegs;
    maximumDay(
      [league.firstMatchDay + (rounds - 1) * league.matchDayInterval],
      league.id,
    );
  }
  for (const state of stateLeagues) {
    const rounds =
      state.participants.length % 2 === 0
        ? state.participants.length - 1
        : state.participants.length;
    maximumDay(
      [state.firstMatchDay + (rounds - 1) * state.matchDayInterval],
      state.id,
    );
  }
  maximumDay(config.nationalCup.matchDays, config.nationalCup.id);
  maximumDay(
    [
      ...config.continental.preliminaryMatchDays,
      ...config.continental.groupMatchDays,
      ...config.continental.knockoutMatchDays,
    ],
    config.continental.id,
  );
  const byDivision = new Map(
    nationalLeagues.map((league) => [league.division, league] as const),
  );
  if (
    byDivision.get('serie-a')?.relegated !==
      byDivision.get('serie-b')?.promoted ||
    byDivision.get('serie-b')?.relegated !== byDivision.get('serie-c')?.promoted
  )
    throw new Error('national promotion and relegation slots must balance');
  return Object.freeze(config);
}

export function canonicalCompetitionId(value: string): CompetitionId {
  return entityId(
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, ''),
    'competition',
  );
}

function positions(from: number, to: number): readonly number[] {
  return Object.freeze(
    Array.from({ length: to - from + 1 }, (_, index) => from + index),
  );
}

function date(year: number, day: number): string {
  return GameDate.parse(`${String(year)}-01-01`)
    .addDays(day)
    .toString();
}

function interval(days: readonly number[], fallback = 1): number {
  if (days.length < 2) return fallback;
  const value = days[1]! - days[0]!;
  if (
    value < 1 ||
    days.some((day, index) => index > 0 && day - days[index - 1]! !== value)
  )
    throw new Error('configured stage match days must use a regular interval');
  return value;
}

function knockoutStages(
  prefix: string,
  name: string,
  year: number,
  legsByRound: readonly (1 | 2)[],
  matchDays: readonly number[],
  firstSource:
    'seeded' | Readonly<{ fromStageId: string; positions: readonly number[] }>,
) {
  let cursor = 0;
  return legsByRound.map((legs, index) => {
    const stageId = `${prefix}_${String(index + 1)}`;
    const days = matchDays.slice(cursor, cursor + legs);
    cursor += legs;
    const previousId = `${prefix}_${String(index)}`;
    return {
      id: stageId,
      name: `${name} ${String(index + 1)}`,
      type: 'knockout' as const,
      participantSource:
        index === 0
          ? firstSource === 'seeded'
            ? ({ type: 'seeded' } as const)
            : ({ type: 'qualified', ...firstSource } as const)
          : ({
              type: 'qualified',
              fromStageId: previousId,
              positions: positions(1, 2 ** (legsByRound.length - index)),
            } as const),
      schedule: {
        firstDate: date(year, days[0]!),
        intervalDays: interval(days),
      },
      legs,
    };
  });
}

export function createConfiguredMvpCompetitionSystem(
  config: MvpCompetitionConfig,
  year: number,
): ConfiguredMvpCompetitionSystem {
  const divisions = Object.fromEntries(
    config.nationalLeagues.map(({ division, id }) => [
      division,
      canonicalCompetitionId(id),
    ]),
  ) as Record<MvpDivisionId, CompetitionId>;
  const cupId = canonicalCompetitionId(config.nationalCup.id);
  const continentalId = canonicalCompetitionId(config.continental.id);
  const definitions: CompetitionDefinition[] = config.nationalLeagues.map(
    (league) =>
      createCompetitionDefinition({
        id: divisions[league.division],
        name: league.name,
        tier: 'national_league',
        stages: [
          {
            id: 'league',
            name: 'Pontos corridos',
            type: 'league',
            participantSource: { type: 'seeded' },
            schedule: {
              firstDate: date(year, league.firstMatchDay),
              intervalDays: league.matchDayInterval,
            },
            roundRobin: league.roundRobinLegs === 2 ? 'double' : 'single',
            ranking,
          },
        ],
        awards: [
          {
            stageId: 'league',
            positions: [1],
            prize: 0,
            prestige: 100,
            achievement: 'league_title',
          },
        ],
      }),
  );
  const cupStages = knockoutStages(
    'round',
    'Rodada',
    year,
    config.nationalCup.legsByRound,
    config.nationalCup.matchDays,
    'seeded',
  );
  definitions.push(
    createCompetitionDefinition({
      id: cupId,
      name: config.nationalCup.name,
      tier: 'national_cup',
      stages: cupStages,
      awards: [
        {
          stageId: cupStages.at(-1)!.id,
          positions: [1],
          prize: 0,
          prestige: 70,
          achievement: 'cup_title',
        },
      ],
    }),
  );
  for (const state of config.stateLeagues)
    definitions.push(
      createCompetitionDefinition({
        id: canonicalCompetitionId(state.id),
        name: state.name,
        tier: 'state',
        stages: [
          {
            id: 'league',
            name: 'Turno unico',
            type: 'league',
            participantSource: { type: 'seeded' },
            schedule: {
              firstDate: date(year, state.firstMatchDay),
              intervalDays: state.matchDayInterval,
            },
            roundRobin: 'single',
            ranking,
          },
        ],
        awards: [
          {
            stageId: 'league',
            positions: [1],
            prize: 0,
            prestige: 20,
            achievement: 'state_title',
          },
        ],
      }),
    );
  const continental = config.continental;
  const preliminaryId = 'preliminary_1';
  const knockoutCount = Math.log2(
    continental.groupCount * continental.qualifiersPerGroup,
  );
  const continentalKnockout = knockoutStages(
    'knockout',
    'Mata-mata',
    year,
    Array.from({ length: knockoutCount }, () => continental.knockoutLegs),
    continental.knockoutMatchDays,
    {
      fromStageId: 'groups',
      positions: positions(
        1,
        continental.groupCount * continental.qualifiersPerGroup,
      ),
    },
  );
  const continentalStages = [
    {
      id: preliminaryId,
      name: 'Pre-continental',
      type: 'knockout' as const,
      participantSource: { type: 'seeded' as const },
      schedule: {
        firstDate: date(year, continental.preliminaryMatchDays[0]!),
        intervalDays: interval(continental.preliminaryMatchDays),
      },
      legs: continental.preliminaryLegs,
    },
    {
      id: 'groups',
      name: 'Fase de grupos',
      type: 'groups' as const,
      participantSource: {
        type: 'seeded_and_qualified' as const,
        fromStageId: preliminaryId,
        positions: positions(1, continental.preliminarySlots / 2),
      },
      schedule: {
        firstDate: date(year, continental.groupMatchDays[0]!),
        intervalDays: interval(continental.groupMatchDays),
      },
      groupCount: continental.groupCount,
      roundRobin: 'double' as const,
      ranking,
      advancePerGroup: continental.qualifiersPerGroup,
    },
    ...continentalKnockout,
  ];
  definitions.push(
    createCompetitionDefinition({
      id: continentalId,
      name: continental.name,
      tier: 'continental',
      stages: continentalStages,
      awards: [
        {
          stageId: continentalStages.at(-1)!.id,
          positions: [1],
          prize: 0,
          prestige: 180,
          achievement: 'continental_title',
        },
      ],
    }),
  );

  const byDivision = new Map(
    config.nationalLeagues.map((league) => [league.division, league] as const),
  );
  const a = byDivision.get('serie-a')!;
  const b = byDivision.get('serie-b')!;
  const c = byDivision.get('serie-c')!;
  const allocations: SeasonAllocationRule[] = [
    {
      targetCompetitionId: divisions['serie-a'],
      targetSize: a.clubs,
      selections: [
        {
          sourceCompetitionId: divisions['serie-a'],
          sourceStageId: 'league',
          positions: positions(1, a.clubs - a.relegated),
        },
        {
          sourceCompetitionId: divisions['serie-b'],
          sourceStageId: 'league',
          positions: positions(1, b.promoted),
          event: 'promoted',
        },
      ],
    },
    {
      targetCompetitionId: divisions['serie-b'],
      targetSize: b.clubs,
      selections: [
        {
          sourceCompetitionId: divisions['serie-b'],
          sourceStageId: 'league',
          positions: positions(b.promoted + 1, b.clubs - b.relegated),
        },
        {
          sourceCompetitionId: divisions['serie-a'],
          sourceStageId: 'league',
          positions: positions(a.clubs - a.relegated + 1, a.clubs),
          event: 'relegated',
        },
        {
          sourceCompetitionId: divisions['serie-c'],
          sourceStageId: 'league',
          positions: positions(1, c.promoted),
          event: 'promoted',
        },
      ],
    },
    {
      targetCompetitionId: divisions['serie-c'],
      targetSize: c.clubs,
      selections: [
        {
          sourceCompetitionId: divisions['serie-c'],
          sourceStageId: 'league',
          positions: positions(c.promoted + 1, c.clubs),
        },
        {
          sourceCompetitionId: divisions['serie-b'],
          sourceStageId: 'league',
          positions: positions(b.clubs - b.relegated + 1, b.clubs),
          event: 'relegated',
        },
      ],
    },
    {
      targetCompetitionId: continentalId,
      targetSize: continental.directSlots + continental.preliminarySlots,
      selections: [
        {
          sourceCompetitionId: cupId,
          sourceStageId: cupStages.at(-1)!.id,
          positions: [1],
          count: 1,
          event: 'qualified',
        },
        {
          sourceCompetitionId: divisions['serie-a'],
          sourceStageId: 'league',
          positions: positions(1, a.clubs),
          count: continental.directSlots + continental.preliminarySlots - 1,
          event: 'qualified',
        },
      ],
    },
  ];
  return Object.freeze({
    configVersion: MVP_COMPETITION_CONFIG_VERSION,
    definitions: Object.freeze(definitions),
    nextSeasonAllocations: Object.freeze(allocations),
    ids: Object.freeze({
      divisions: Object.freeze(divisions),
      nationalCup: cupId,
      continental: continentalId,
    }),
    reservedDates: Object.freeze(
      config.reservedMatchDays.map((day) => date(year, day)),
    ),
    minimumIntervalDays: config.minimumRestDays + 1,
  });
}
