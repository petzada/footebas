/* eslint-disable @typescript-eslint/restrict-template-expressions -- versioned gate diagnostics intentionally interpolate measured numbers */
import { canonicalJson } from '@footebas/domain';
import {
  advanceCareerSeason,
  createCareerWorld,
  createCareerWorldSave,
  ledgerConservationErrors,
  migrateCareerWorldSave,
  type CareerPlayer,
  type CareerWorld,
} from '@footebas/engine';
import { loadCareerWorldContent } from './career-content.js';

export const PHASE_FOUR_GATE_VERSION = 'phase-four-gate-v1' as const;
export const PHASE_FOUR_BANDS_VERSION = 'phase-four-bands-v1' as const;

export const PHASE_FOUR_BANDS = Object.freeze({
  seasons: Object.freeze({ minimum: 20, maximum: 30 }),
  players: Object.freeze({ minimum: 840, maximum: 1_120 }),
  strength: Object.freeze({
    minimum: 28,
    maximum: 96,
    meanMinimum: 50,
    meanMaximum: 78,
  }),
  salary: Object.freeze({
    minimum: 2_000,
    maximum: 100_000,
    meanMaximum: 35_000,
  }),
  clubCash: Object.freeze({ minimum: -120_000_000, maximum: 1_200_000_000 }),
  worldCash: Object.freeze({ minimum: -500_000_000, maximum: 30_000_000_000 }),
  transfersPerSeason: Object.freeze({ minimum: 0, maximum: 160 }),
  loansPerSeason: Object.freeze({ minimum: 0, maximum: 100 }),
  freeAgentSigningsPerSeason: Object.freeze({ minimum: 0, maximum: 160 }),
  squad: Object.freeze({ minimum: 22, maximum: 28 }),
  coverage: Object.freeze({ GK: 2, DEF: 6, MID: 6, FWD: 4 }),
  history: Object.freeze({ recentMaximum: 5, newsMaximum: 160 }),
});

export interface PhaseFourSeasonMetrics {
  readonly season: number;
  readonly players: number;
  readonly meanStrength: number;
  readonly minimumStrength: number;
  readonly maximumStrength: number;
  readonly meanSalary: number;
  readonly minimumSalary: number;
  readonly maximumSalary: number;
  readonly minimumCash: number;
  readonly maximumCash: number;
  readonly worldCash: number;
  readonly transfers: number;
  readonly loans: number;
  readonly freeAgentSignings: number;
  readonly generated: number;
  readonly ledgerEntries: number;
}

export interface PhaseFourGateReport {
  readonly schemaVersion: typeof PHASE_FOUR_GATE_VERSION;
  readonly boundsVersion: typeof PHASE_FOUR_BANDS_VERSION;
  readonly seed: string;
  readonly seasons: number;
  readonly content: Readonly<{
    clubs: number;
    realPlayers: number;
    sources: readonly string[];
  }>;
  readonly final: PhaseFourSeasonMetrics;
  readonly manager: Readonly<{
    id: string;
    clubId: string;
    seasons: number;
    dismissals: number;
    jobCount: number;
    prestige: number;
  }>;
  readonly archive: Readonly<{
    seasons: number;
    throughSeason: number;
    recentSeasons: number;
    news: number;
    transfers: number;
    loans: number;
    freeAgentSignings: number;
  }>;
  readonly elapsedMs: number;
  readonly failures: readonly string[];
  readonly passed: boolean;
}

function mean(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function metrics(world: CareerWorld): PhaseFourSeasonMetrics {
  const contracted = world.players.filter(
    (player) => player.clubId !== null && player.contract !== null,
  );
  const strengths = contracted.map(({ strength }) => strength);
  const salaries = contracted.map((player) => player.contract?.salary ?? 0);
  const cash = world.clubs.map(({ balance }) => balance);
  const last = world.history.at(-1);
  return {
    season: world.season - 1,
    players: world.players.length,
    meanStrength: Number(mean(strengths).toFixed(2)),
    minimumStrength: Math.min(...strengths),
    maximumStrength: Math.max(...strengths),
    meanSalary: Number(mean(salaries).toFixed(2)),
    minimumSalary: Math.min(...salaries),
    maximumSalary: Math.max(...salaries),
    minimumCash: Math.min(...cash),
    maximumCash: Math.max(...cash),
    worldCash: cash.reduce((sum, value) => sum + value, 0),
    transfers: last?.transfers ?? 0,
    loans: last?.loans ?? 0,
    freeAgentSignings: last?.freeAgentSignings ?? 0,
    generated: world.players.filter(
      ({ identity }) => identity.source === 'generated-derived',
    ).length,
    ledgerEntries: world.ledger.length,
  };
}

function coverageFailures(world: CareerWorld): readonly string[] {
  const failures: string[] = [];
  for (const club of world.clubs) {
    const members = world.players.filter(({ clubId }) => clubId === club.id);
    if (
      members.length < PHASE_FOUR_BANDS.squad.minimum ||
      members.length > PHASE_FOUR_BANDS.squad.maximum
    )
      failures.push(`${club.id}: squad ${members.length} outside bounds`);
    if (
      club.stadium.averageAttendance < 1 ||
      club.stadium.averageAttendance > club.stadium.capacity
    )
      failures.push(`${club.id}: crowd outside stadium capacity`);
    for (const position of ['GK', 'DEF', 'MID', 'FWD'] as const) {
      const count = members.filter(
        (player) => player.position === position,
      ).length;
      if (count < PHASE_FOUR_BANDS.coverage[position])
        failures.push(`${club.id}: ${position} coverage ${count}`);
    }
  }
  return failures;
}

function validatePlayerProvenance(
  players: readonly CareerPlayer[],
): readonly string[] {
  return players.flatMap((player) => {
    const failures: string[] = [];
    if (
      player.attributes.version.length === 0 ||
      player.attributes.seed.length === 0
    )
      failures.push(`${player.id}: missing derived attributes provenance`);
    if (
      player.identity.source === 'generated-derived' &&
      !player.id.startsWith('generated:')
    )
      failures.push(`${player.id}: generated identity not visibly marked`);
    if (
      player.identity.source === 'raw-markdown' &&
      !player.identity.sourceId.startsWith('dados/elencos/')
    )
      failures.push(
        `${player.id}: raw identity lacks immutable adapter source`,
      );
    return failures;
  });
}

function validateMetric(metric: PhaseFourSeasonMetrics): readonly string[] {
  const failures: string[] = [];
  if (
    metric.players < PHASE_FOUR_BANDS.players.minimum ||
    metric.players > PHASE_FOUR_BANDS.players.maximum
  )
    failures.push(`season ${metric.season}: players ${metric.players}`);
  if (
    metric.minimumStrength < PHASE_FOUR_BANDS.strength.minimum ||
    metric.maximumStrength > PHASE_FOUR_BANDS.strength.maximum ||
    metric.meanStrength < PHASE_FOUR_BANDS.strength.meanMinimum ||
    metric.meanStrength > PHASE_FOUR_BANDS.strength.meanMaximum
  )
    failures.push(
      `season ${metric.season}: strength ${metric.minimumStrength}/${metric.meanStrength}/${metric.maximumStrength}`,
    );
  if (
    metric.minimumSalary < PHASE_FOUR_BANDS.salary.minimum ||
    metric.maximumSalary > PHASE_FOUR_BANDS.salary.maximum ||
    metric.meanSalary > PHASE_FOUR_BANDS.salary.meanMaximum
  )
    failures.push(
      `season ${metric.season}: salary ${metric.minimumSalary}/${metric.meanSalary}/${metric.maximumSalary}`,
    );
  if (
    metric.minimumCash < PHASE_FOUR_BANDS.clubCash.minimum ||
    metric.maximumCash > PHASE_FOUR_BANDS.clubCash.maximum ||
    metric.worldCash < PHASE_FOUR_BANDS.worldCash.minimum ||
    metric.worldCash > PHASE_FOUR_BANDS.worldCash.maximum
  )
    failures.push(
      `season ${metric.season}: cash ${metric.minimumCash}/${metric.maximumCash}/${metric.worldCash}`,
    );
  if (
    metric.transfers < PHASE_FOUR_BANDS.transfersPerSeason.minimum ||
    metric.transfers > PHASE_FOUR_BANDS.transfersPerSeason.maximum
  )
    failures.push(`season ${metric.season}: transfers ${metric.transfers}`);
  if (
    metric.loans < PHASE_FOUR_BANDS.loansPerSeason.minimum ||
    metric.loans > PHASE_FOUR_BANDS.loansPerSeason.maximum
  )
    failures.push(`season ${metric.season}: loans ${metric.loans}`);
  if (
    metric.freeAgentSignings <
      PHASE_FOUR_BANDS.freeAgentSigningsPerSeason.minimum ||
    metric.freeAgentSignings >
      PHASE_FOUR_BANDS.freeAgentSigningsPerSeason.maximum
  )
    failures.push(
      `season ${metric.season}: free agents ${metric.freeAgentSignings}`,
    );
  return failures;
}

export function runPhaseFourGate(
  options: Readonly<{ seasons?: number; seed?: string }> = {},
): PhaseFourGateReport {
  const seasons = options.seasons ?? 25;
  const seed = options.seed ?? 'phase-four-gate-seed-v1';
  if (
    !Number.isSafeInteger(seasons) ||
    seasons < PHASE_FOUR_BANDS.seasons.minimum ||
    seasons > PHASE_FOUR_BANDS.seasons.maximum
  )
    throw new Error(
      `Phase four gate requires ${PHASE_FOUR_BANDS.seasons.minimum}-${PHASE_FOUR_BANDS.seasons.maximum} seasons`,
    );
  const started = performance.now();
  const content = loadCareerWorldContent();
  const initial = createCareerWorld(content, {
    seed,
    managerName: 'Treinador Gate',
    managerClubId: 'serie-b:athletic-club',
  });
  let world = initial;
  const failures: string[] = [];
  for (let index = 0; index < seasons; index += 1) {
    world = advanceCareerSeason(world);
    failures.push(
      ...validateMetric(metrics(world)),
      ...coverageFailures(world),
    );
    const divisionA = world.clubs.filter(
      ({ division }) => division === 'serie-a',
    );
    const divisionB = world.clubs.filter(
      ({ division }) => division === 'serie-b',
    );
    if (divisionA.length !== 20 || divisionB.length !== 20)
      failures.push(
        `season ${String(world.season - 1)}: division cardinality ${String(divisionA.length)}/${String(divisionB.length)}`,
      );
    const movement = world.history.at(-1);
    if (movement?.promoted.length !== 4 || movement.relegated.length !== 4)
      failures.push(
        `season ${String(world.season - 1)}: invalid access/relegation`,
      );
  }
  failures.push(
    ...ledgerConservationErrors(world.ledger),
    ...validatePlayerProvenance(world.players),
  );
  if (
    world.manager.id !== initial.manager.id ||
    world.manager.seasons !== seasons ||
    !world.clubs.some(({ id }) => id === world.manager.clubId)
  )
    failures.push('manager identity or career continuity was not preserved');
  if (
    world.manager.jobHistory.filter(({ toSeason }) => toSeason === null)
      .length !== 1
  )
    failures.push('manager job history lacks one active appointment');
  if (
    world.archive.seasons !==
      Math.max(0, seasons - PHASE_FOUR_BANDS.history.recentMaximum) ||
    world.history.length > PHASE_FOUR_BANDS.history.recentMaximum ||
    world.news.length > PHASE_FOUR_BANDS.history.newsMaximum
  )
    failures.push('history/news compaction violated versioned bounds');
  const recentTransfers = world.history.reduce(
    (sum, item) => sum + item.transfers,
    0,
  );
  const recentLoans = world.history.reduce((sum, item) => sum + item.loans, 0);
  if (
    world.archive.transfers + recentTransfers === 0 ||
    world.archive.loans + recentLoans === 0
  )
    failures.push(
      'transfer and loan systems were not exercised over the long horizon',
    );
  const migrated = migrateCareerWorldSave({
    schemaVersion: 'career-save-v0',
    snapshot: world,
  });
  if (
    migrated.migrationHistory.length !== 1 ||
    createCareerWorldSave(world).snapshot !== world
  )
    failures.push('save migration proxy failed');
  return {
    schemaVersion: PHASE_FOUR_GATE_VERSION,
    boundsVersion: PHASE_FOUR_BANDS_VERSION,
    seed,
    seasons,
    content: {
      clubs: content.clubs.length,
      realPlayers: initial.players.length,
      sources: content.sourceIds,
    },
    final: metrics(world),
    manager: {
      id: world.manager.id,
      clubId: world.manager.clubId,
      seasons: world.manager.seasons,
      dismissals: world.manager.dismissals,
      jobCount: world.manager.jobHistory.length,
      prestige: world.manager.prestige,
    },
    archive: {
      seasons: world.archive.seasons,
      throughSeason: world.archive.throughSeason,
      recentSeasons: world.history.length,
      news: world.news.length,
      transfers: world.archive.transfers + recentTransfers,
      loans: world.archive.loans + recentLoans,
      freeAgentSignings:
        world.archive.freeAgentSignings +
        world.history.reduce((sum, item) => sum + item.freeAgentSignings, 0),
    },
    elapsedMs: Number((performance.now() - started).toFixed(2)),
    failures: Object.freeze(failures),
    passed: failures.length === 0,
  };
}

export function phaseFourGateOutput(
  options: Readonly<{ seasons?: number; seed?: string }> = {},
): string {
  return canonicalJson(runPhaseFourGate(options));
}
