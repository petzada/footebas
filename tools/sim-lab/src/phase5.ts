/* eslint-disable @typescript-eslint/no-non-null-assertion -- required league/fixture cardinalities are validated before indexed access */
import { canonicalJson } from '@footebas/domain';
import {
  loadPhaseFiveContent,
  parseCompetitionConfig,
  type CompetitionConfig,
  type DivisionId,
} from './phase5-content.js';
import {
  initialReferenceState,
  simulateReferenceSeason,
  validateReferenceCalendar,
  type ReferenceSeasonState,
} from './phase5-reference.js';

export const PHASE_FIVE_GATE_VERSION = 'phase-five-gate-v1' as const;
export const PHASE_FIVE_GATE_MINIMUM_SEASONS = 1_000;

export interface PhaseFiveGateReport {
  readonly schemaVersion: typeof PHASE_FIVE_GATE_VERSION;
  readonly seed: string;
  readonly seasons: number;
  readonly competitionsPerSeason: number;
  readonly clubs: number;
  readonly sourceIds: readonly string[];
  readonly simulatedMatches: number;
  readonly transitions: Readonly<{
    promotions: number;
    relegations: number;
    continentalQualifications: number;
  }>;
  readonly rejectionProbes: Readonly<{
    invalidConfig: boolean;
    invalidCalendar: boolean;
  }>;
  readonly elapsedMs: number;
  readonly failures: readonly string[];
  readonly passed: boolean;
}

function sameMembers(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    new Set(left).size === left.length &&
    left.every((value) => right.includes(value))
  );
}

function transitionFailures(
  state: ReferenceSeasonState,
  next: ReferenceSeasonState,
  rankings: Readonly<Record<DivisionId, readonly string[]>>,
  config: CompetitionConfig,
): readonly string[] {
  const failures: string[] = [];
  const leagueA = config.nationalLeagues.find(
    ({ division }) => division === 'serie-a',
  )!;
  const leagueB = config.nationalLeagues.find(
    ({ division }) => division === 'serie-b',
  )!;
  const leagueC = config.nationalLeagues.find(
    ({ division }) => division === 'serie-c',
  )!;
  const promotedB = rankings['serie-b'].slice(0, leagueB.promoted);
  const promotedC = rankings['serie-c'].slice(0, leagueC.promoted);
  const relegatedA = rankings['serie-a'].slice(-leagueA.relegated);
  const relegatedB = rankings['serie-b'].slice(-leagueB.relegated);
  if (!promotedB.every((clubId) => next.divisions['serie-a'].includes(clubId)))
    failures.push('Serie B promoted clubs did not enter next Serie A');
  if (!relegatedA.every((clubId) => next.divisions['serie-b'].includes(clubId)))
    failures.push('Serie A relegated clubs did not enter next Serie B');
  if (!promotedC.every((clubId) => next.divisions['serie-b'].includes(clubId)))
    failures.push('Serie C promoted clubs did not enter next Serie B');
  if (!relegatedB.every((clubId) => next.divisions['serie-c'].includes(clubId)))
    failures.push('Serie B relegated clubs did not enter next Serie C');
  for (const division of ['serie-a', 'serie-b', 'serie-c'] as const) {
    if (next.divisions[division].length !== state.divisions[division].length)
      failures.push(`${division} cardinality changed across seasons`);
  }
  const allNext = (['serie-a', 'serie-b', 'serie-c'] as const).flatMap(
    (division) => next.divisions[division],
  );
  const allCurrent = (['serie-a', 'serie-b', 'serie-c'] as const).flatMap(
    (division) => state.divisions[division],
  );
  if (!sameMembers(allNext, allCurrent))
    failures.push('National pyramid lost or duplicated a club');
  if (
    next.continentalDirect.length !== config.continental.directSlots ||
    next.continentalPreliminary.length !== config.continental.preliminarySlots
  )
    failures.push('Next continental qualification slot cardinality changed');
  const qualifiers = [
    ...next.continentalDirect,
    ...next.continentalPreliminary,
  ];
  if (
    new Set(qualifiers).size !== qualifiers.length ||
    !qualifiers.every((clubId) => allCurrent.includes(clubId))
  )
    failures.push('Next continental qualification is duplicated or unknown');
  return failures;
}

function runInvalidConfigProbe(config: CompetitionConfig): boolean {
  const invalid = {
    ...config,
    nationalLeagues: config.nationalLeagues.map((league, index) => ({
      ...league,
      id: index < 2 ? 'duplicate-league' : league.id,
    })),
  };
  try {
    parseCompetitionConfig(invalid);
    return false;
  } catch {
    return true;
  }
}

export function runPhaseFiveGate(
  options: Readonly<{ seasons?: number; seed?: string }> = {},
): PhaseFiveGateReport {
  const seasons = options.seasons ?? 2_000;
  const seed = options.seed ?? 'phase-five-stress-v1';
  if (
    !Number.isSafeInteger(seasons) ||
    seasons < PHASE_FIVE_GATE_MINIMUM_SEASONS
  )
    throw new Error(
      `Phase five gate requires at least ${String(PHASE_FIVE_GATE_MINIMUM_SEASONS)} seasons`,
    );
  const started = performance.now();
  const content = loadPhaseFiveContent();
  const competitionCount =
    content.config.nationalLeagues.length +
    content.config.stateLeagues.length +
    2;
  let state = initialReferenceState(content);
  let simulatedMatches = 0;
  let invalidCalendar = false;
  const failures: string[] = [];
  for (let index = 0; index < seasons; index += 1) {
    const result = simulateReferenceSeason(content, state, seed);
    simulatedMatches += result.fixtures.length;
    if (
      result.closures.length !== competitionCount ||
      result.closures.some(
        ({ championClubId, matches }) =>
          championClubId.length === 0 || matches < 1,
      )
    )
      failures.push(
        `season ${String(state.season)} did not close every competition`,
      );
    failures.push(
      ...transitionFailures(
        state,
        result.next,
        result.nationalRankings,
        content.config,
      ).map((failure) => `season ${String(state.season)}: ${failure}`),
    );
    if (index === 0) {
      const first = result.fixtures[0]!;
      invalidCalendar =
        validateReferenceCalendar(
          [
            ...result.fixtures,
            { ...first, id: `${first.id}:injected-conflict` },
          ],
          content.config,
        ).length > 0;
    }
    state = result.next;
  }
  const invalidConfig = runInvalidConfigProbe(content.config);
  if (!invalidConfig)
    failures.push('invalid competition configuration was accepted');
  if (!invalidCalendar) failures.push('invalid calendar was accepted');
  return Object.freeze({
    schemaVersion: PHASE_FIVE_GATE_VERSION,
    seed,
    seasons,
    competitionsPerSeason: competitionCount,
    clubs: content.clubs.length,
    sourceIds: content.sourceIds,
    simulatedMatches,
    transitions: Object.freeze({
      promotions: seasons * 8,
      relegations: seasons * 8,
      continentalQualifications:
        seasons *
        (content.config.continental.directSlots +
          content.config.continental.preliminarySlots),
    }),
    rejectionProbes: Object.freeze({ invalidConfig, invalidCalendar }),
    elapsedMs: Number((performance.now() - started).toFixed(2)),
    failures: Object.freeze(failures),
    passed: failures.length === 0,
  });
}

export function phaseFiveGateOutput(
  options: Readonly<{ seasons?: number; seed?: string }> = {},
): string {
  return canonicalJson(runPhaseFiveGate(options));
}
