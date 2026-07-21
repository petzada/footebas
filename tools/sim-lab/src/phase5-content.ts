/* eslint-disable @typescript-eslint/no-non-null-assertion -- regex captures are checked by source cardinality */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  parseMvpCompetitionConfig,
  type MvpCompetitionConfig,
  type MvpContinentalConfig,
  type MvpDivisionId,
  type MvpLeagueConfig,
  type MvpStateLeagueConfig,
  type MvpCupConfig,
} from '@footebas/engine';

export const PHASE_FIVE_CONTENT_VERSION =
  'phase-five-real-content-adapter-v1' as const;

export type DivisionId = MvpDivisionId;
export type CompetitionConfig = MvpCompetitionConfig;
export type ContinentalConfig = MvpContinentalConfig;
export type LeagueConfig = MvpLeagueConfig;
export type StateLeagueConfig = MvpStateLeagueConfig;
export type CupConfig = MvpCupConfig;
export const parseCompetitionConfig = parseMvpCompetitionConfig;

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

export interface PhaseFiveContent {
  readonly version: typeof PHASE_FIVE_CONTENT_VERSION;
  readonly config: CompetitionConfig;
  readonly clubs: readonly RealClubIdentity[];
  readonly sourceIds: readonly string[];
}

function unique(values: readonly string[], context: string): void {
  if (new Set(values).size !== values.length)
    throw new Error(`${context} must contain unique values`);
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
