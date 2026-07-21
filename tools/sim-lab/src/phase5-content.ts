/* eslint-disable @typescript-eslint/no-non-null-assertion -- schema cardinalities and required division entries are validated before indexed access */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const PHASE_FIVE_CONTENT_VERSION =
  'phase-five-real-content-adapter-v1' as const;

export type DivisionId = 'serie-a' | 'serie-b' | 'serie-c';

export interface RealClubIdentity {
  readonly id: string;
  readonly name: string;
  readonly initialDivision: DivisionId;
  readonly provenance: Readonly<{
    source: string;
    heading: string;
    identity: 'raw-markdown';
  }>;
}

export interface LeagueConfig {
  readonly id: string;
  readonly name: string;
  readonly division: DivisionId;
  readonly clubs: number;
  readonly roundRobinLegs: number;
  readonly promoted: number;
  readonly relegated: number;
  readonly firstMatchDay: number;
  readonly matchDayInterval: number;
}

export interface CupConfig {
  readonly id: string;
  readonly name: string;
  readonly participantSelector: 'all-national-clubs';
  readonly legsByRound: readonly number[];
  readonly matchDays: readonly number[];
}

export interface StateLeagueConfig {
  readonly id: string;
  readonly name: string;
  readonly sourceSection: string;
  readonly firstMatchDay: number;
  readonly matchDayInterval: number;
  readonly participants: readonly (readonly [string, string])[];
}

export interface ContinentalConfig {
  readonly id: string;
  readonly name: string;
  readonly initialDirectClubIds: readonly string[];
  readonly initialPreliminaryClubIds: readonly string[];
  readonly directSlots: number;
  readonly preliminarySlots: number;
  readonly groupCount: number;
  readonly groupSize: number;
  readonly qualifiersPerGroup: number;
  readonly preliminaryLegs: number;
  readonly knockoutLegs: number;
  readonly preliminaryMatchDays: readonly number[];
  readonly groupMatchDays: readonly number[];
  readonly knockoutMatchDays: readonly number[];
}

export interface CompetitionConfig {
  readonly schemaVersion: 'footebas-mvp-competitions-v1';
  readonly seasonDays: number;
  readonly minimumRestDays: number;
  readonly sources: Readonly<
    Record<DivisionId | 'states' | 'cup' | 'continental', string>
  >;
  readonly nationalLeagues: readonly LeagueConfig[];
  readonly nationalCup: CupConfig;
  readonly stateLeagues: readonly StateLeagueConfig[];
  readonly continental: ContinentalConfig;
}

export interface PhaseFiveContent {
  readonly version: typeof PHASE_FIVE_CONTENT_VERSION;
  readonly config: CompetitionConfig;
  readonly clubs: readonly RealClubIdentity[];
  readonly sourceIds: readonly string[];
}

function record(value: unknown, context: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${context} must be an object`);
  return value as Record<string, unknown>;
}

function text(value: unknown, context: string): string {
  if (typeof value !== 'string' || value.length === 0)
    throw new Error(`${context} must be a non-empty string`);
  return value;
}

function integer(value: unknown, context: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum)
    throw new Error(`${context} must be an integer >= ${String(minimum)}`);
  return value as number;
}

function strings(value: unknown, context: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${context} must be an array`);
  return value.map((item, index) => text(item, `${context}[${String(index)}]`));
}

function integers(value: unknown, context: string): readonly number[] {
  if (!Array.isArray(value)) throw new Error(`${context} must be an array`);
  return value.map((item, index) =>
    integer(item, `${context}[${String(index)}]`, 1),
  );
}

function unique(values: readonly string[], context: string): void {
  if (new Set(values).size !== values.length)
    throw new Error(`${context} must contain unique values`);
}

function parseLeague(value: unknown, index: number): LeagueConfig {
  const item = record(value, `nationalLeagues[${String(index)}]`);
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
    roundRobinLegs: integer(item.roundRobinLegs, 'league.roundRobinLegs', 1),
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

function parseCup(value: unknown): CupConfig {
  const item = record(value, 'nationalCup');
  if (item.participantSelector !== 'all-national-clubs')
    throw new Error('nationalCup.participantSelector is unsupported');
  const legsByRound = integers(item.legsByRound, 'nationalCup.legsByRound');
  const matchDays = integers(item.matchDays, 'nationalCup.matchDays');
  if (
    legsByRound.length === 0 ||
    legsByRound.reduce((sum, legs) => sum + legs, 0) !== matchDays.length
  )
    throw new Error(
      'nationalCup must provide one match day per configured leg',
    );
  unique(matchDays.map(String), 'nationalCup.matchDays');
  return {
    id: text(item.id, 'nationalCup.id'),
    name: text(item.name, 'nationalCup.name'),
    participantSelector: 'all-national-clubs',
    legsByRound,
    matchDays,
  };
}

function parseState(value: unknown, index: number): StateLeagueConfig {
  const item = record(value, `stateLeagues[${String(index)}]`);
  if (!Array.isArray(item.participants))
    throw new Error('stateLeague.participants must be an array');
  const participants = item.participants.map((entry, participantIndex) => {
    if (!Array.isArray(entry) || entry.length !== 2)
      throw new Error(
        `stateLeague participant ${String(participantIndex)} must be [clubId, sourceIdentity]`,
      );
    return [
      text(entry[0], 'stateLeague participant clubId'),
      text(entry[1], 'stateLeague participant sourceIdentity'),
    ] as const;
  });
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

function parseContinental(value: unknown): ContinentalConfig {
  const item = record(value, 'continental');
  const parsed: ContinentalConfig = {
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
    preliminaryLegs: integer(
      item.preliminaryLegs,
      'continental.preliminaryLegs',
      1,
    ),
    knockoutLegs: integer(item.knockoutLegs, 'continental.knockoutLegs', 1),
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
    [...parsed.initialDirectClubIds, ...parsed.initialPreliminaryClubIds],
    'continental initial participants',
  );
  const preliminaryWinners = parsed.preliminarySlots / 2;
  if (!Number.isInteger(preliminaryWinners))
    throw new Error('continental.preliminarySlots must be even');
  if (
    parsed.directSlots + preliminaryWinners !==
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

export function parseCompetitionConfig(value: unknown): CompetitionConfig {
  const root = record(value, 'competition config');
  if (root.schemaVersion !== 'footebas-mvp-competitions-v1')
    throw new Error('Unsupported competition config schemaVersion');
  const sources = record(root.sources, 'sources');
  if (!Array.isArray(root.nationalLeagues))
    throw new Error('nationalLeagues must be an array');
  if (!Array.isArray(root.stateLeagues))
    throw new Error('stateLeagues must be an array');
  const nationalLeagues = root.nationalLeagues.map(parseLeague);
  const stateLeagues = root.stateLeagues.map(parseState);
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
  const config: CompetitionConfig = {
    schemaVersion: 'footebas-mvp-competitions-v1',
    seasonDays: integer(root.seasonDays, 'seasonDays', 1),
    minimumRestDays: integer(root.minimumRestDays, 'minimumRestDays'),
    sources: {
      'serie-a': text(sources['serie-a'], 'sources.serie-a'),
      'serie-b': text(sources['serie-b'], 'sources.serie-b'),
      'serie-c': text(sources['serie-c'], 'sources.serie-c'),
      states: text(sources.states, 'sources.states'),
      cup: text(sources.cup, 'sources.cup'),
      continental: text(sources.continental, 'sources.continental'),
    },
    nationalLeagues,
    nationalCup: parseCup(root.nationalCup),
    stateLeagues,
    continental: parseContinental(root.continental),
  };
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
    byDivision.get('serie-a')!.relegated !==
      byDivision.get('serie-b')!.promoted ||
    byDivision.get('serie-b')!.relegated !== byDivision.get('serie-c')!.promoted
  )
    throw new Error('national promotion and relegation slots must balance');
  return config;
}

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function readClubs(
  sourceId: string,
  division: DivisionId,
): readonly RealClubIdentity[] {
  const sourcePath = fileURLToPath(
    new URL(`../../../${sourceId}`, import.meta.url),
  );
  const markdown = readFileSync(sourcePath, 'utf8');
  const clubsStart = markdown.search(/^## Clubes(?: \(20\))?\r?$/m);
  if (clubsStart < 0)
    throw new Error(`${sourceId} lacks its club roster section`);
  const section = markdown.slice(clubsStart);
  const nextSection = section.slice(1).search(/^## /m);
  const body = nextSection < 0 ? section : section.slice(0, nextSection + 1);
  const headings = [...body.matchAll(/^### (.+)\r?$/gm)].map((match) =>
    match[1]!.trim(),
  );
  if (headings.length !== 20)
    throw new Error(
      `${sourceId} must expose exactly 20 roster club identities`,
    );
  return headings.map((heading) => {
    const name = heading
      .replace(/ \([^)]*\)(?: \[parcial\])?$/, '')
      .replace(/ \[parcial\]$/, '')
      .trim();
    return Object.freeze({
      id: `${division}:${slug(name)}`,
      name,
      initialDivision: division,
      provenance: Object.freeze({
        source: sourceId,
        heading,
        identity: 'raw-markdown' as const,
      }),
    });
  });
}

function verifyStateProvenance(
  config: CompetitionConfig,
  clubIds: ReadonlySet<string>,
): void {
  const sourcePath = fileURLToPath(
    new URL(`../../../${config.sources.states}`, import.meta.url),
  );
  const markdown = readFileSync(sourcePath, 'utf8');
  for (const state of config.stateLeagues) {
    if (
      !markdown.includes(`## ${state.sourceSection}`) &&
      !markdown.includes(`| ${state.sourceSection} |`)
    )
      throw new Error(`Missing raw state section ${state.sourceSection}`);
    for (const [clubId, identity] of state.participants) {
      if (!clubIds.has(clubId))
        throw new Error(
          `${state.id} references unknown national roster identity ${clubId}`,
        );
      if (
        !new RegExp(
          `^### ${identity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?: |$)`,
          'm',
        ).test(markdown)
      )
        throw new Error(
          `${state.id} lacks raw state provenance for ${identity}`,
        );
    }
  }
}

export function loadPhaseFiveContent(): PhaseFiveContent {
  const configPath = fileURLToPath(
    new URL('../config/mvp-competitions.json', import.meta.url),
  );
  const config = parseCompetitionConfig(
    JSON.parse(readFileSync(configPath, 'utf8')) as unknown,
  );
  const clubs = (['serie-a', 'serie-b', 'serie-c'] as const).flatMap(
    (division) => readClubs(config.sources[division], division),
  );
  unique(
    clubs.map(({ id }) => id),
    'national club IDs',
  );
  const clubIds = new Set(clubs.map(({ id }) => id));
  for (const clubId of [
    ...config.continental.initialDirectClubIds,
    ...config.continental.initialPreliminaryClubIds,
  ])
    if (!clubIds.has(clubId))
      throw new Error(
        `Continental config references unknown roster identity ${clubId}`,
      );
  verifyStateProvenance(config, clubIds);
  for (const sourceId of Object.values(config.sources))
    readFileSync(
      fileURLToPath(new URL(`../../../${sourceId}`, import.meta.url)),
      'utf8',
    );
  return Object.freeze({
    version: PHASE_FIVE_CONTENT_VERSION,
    config,
    clubs: Object.freeze(clubs),
    sourceIds: Object.freeze(Object.values(config.sources)),
  });
}
