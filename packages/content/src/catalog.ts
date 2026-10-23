import type { PlayerTrait, Position, PreferredSide } from '@footebas/domain';
import {
  parseMvpCompetitionConfig,
  type MvpCompetitionConfig,
  type MvpDivisionId,
} from '@footebas/engine';

export const CATALOG_SCHEMA_VERSION = 'footebas-catalog-v1' as const;
export const ATTRIBUTE_DERIVATION_VERSION = 'relative-strength-derived-v2';

/** Shirt as researched: unknown (`#?`), absent (`—`) and conflicts stay explicit. */
export type CatalogShirt =
  | Readonly<{ status: 'known'; number: number }>
  | Readonly<{ status: 'conflict'; number: number; note: string }>
  | Readonly<{ status: 'unknown' }>
  | Readonly<{ status: 'absent' }>;

export interface CatalogSource {
  readonly file: string;
  readonly line: number;
}

export interface CatalogPlayer {
  readonly id: string;
  readonly clubId: string;
  readonly name: string;
  readonly rawPosition: string;
  readonly position: Position;
  readonly preferredSide?: PreferredSide;
  readonly shirt: CatalogShirt;
  readonly source: CatalogSource;
  /** Every number below is `derived`, never research data. */
  readonly derived: Readonly<{
    version: string;
    seed: string;
    age: number;
    strength: number;
    potential: number;
    consistency: number;
    injuryProneness: number;
    adaptation: number;
    professionalism: number;
    bigGame: number;
    traits: readonly PlayerTrait[];
    valueBrl: number;
    monthlyWageBrl: number;
  }>;
}

export interface CatalogClub {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  readonly location?: string;
  readonly division: MvpDivisionId;
  readonly tier: string;
  readonly tierRank: number;
  readonly partial: boolean;
  readonly source: CatalogSource;
  readonly playerIds: readonly string[];
}

export interface CatalogNote {
  readonly kind:
    | 'partial-club'
    | 'unknown-shirt'
    | 'absent-shirt'
    | 'shirt-conflict'
    | 'repeated-name-in-club'
    | 'name-in-several-clubs';
  readonly subject: string;
  readonly source: CatalogSource;
}

export interface ContentCatalog {
  readonly schemaVersion: typeof CATALOG_SCHEMA_VERSION;
  readonly contentVersion: string;
  readonly snapshotDate: string;
  readonly sources: readonly string[];
  readonly clubs: readonly CatalogClub[];
  readonly players: readonly CatalogPlayer[];
  /** Club references already rewritten to catalog club ids. */
  readonly competitions: MvpCompetitionConfig;
  readonly notes: readonly CatalogNote[];
}

const GOALKEEPER_TRAITS = new Set<string>([
  'positioning',
  'aerial_command',
  'reflexes',
  'penalty_saving',
]);

const fail = (message: string): never => {
  throw new Error(`invalid content catalog: ${message}`);
};

/** Structural validation run whenever a catalog enters the application. */
export function parseCatalog(value: unknown): ContentCatalog {
  if (typeof value !== 'object' || value === null) fail('not an object');
  const schemaVersion = (value as { schemaVersion?: unknown }).schemaVersion;
  if (schemaVersion !== CATALOG_SCHEMA_VERSION)
    fail(`unsupported schema ${String(schemaVersion)}`);
  const catalog = value as ContentCatalog;
  const clubIds = new Set<string>();
  for (const club of catalog.clubs) {
    if (clubIds.has(club.id)) fail(`duplicate club ${club.id}`);
    clubIds.add(club.id);
  }
  const playerIds = new Set<string>();
  const byClub = new Map<string, number>();
  const goalkeepers = new Map<string, number>();
  for (const player of catalog.players) {
    if (playerIds.has(player.id)) fail(`duplicate player ${player.id}`);
    playerIds.add(player.id);
    if (!clubIds.has(player.clubId))
      fail(`player ${player.id} references unknown club ${player.clubId}`);
    byClub.set(player.clubId, (byClub.get(player.clubId) ?? 0) + 1);
    if (
      player.position !== 'GK' &&
      player.derived.traits.some((trait) => GOALKEEPER_TRAITS.has(trait))
    )
      fail(`outfield player ${player.id} has a goalkeeper trait`);
    if (player.position === 'GK')
      goalkeepers.set(player.clubId, (goalkeepers.get(player.clubId) ?? 0) + 1);
  }
  for (const club of catalog.clubs) {
    if ((byClub.get(club.id) ?? 0) < 18)
      fail(`club ${club.id} has fewer than 18 players`);
    if ((goalkeepers.get(club.id) ?? 0) < 2)
      fail(`club ${club.id} has fewer than 2 goalkeepers`);
    for (const playerId of club.playerIds)
      if (!playerIds.has(playerId))
        fail(`club ${club.id} references unknown player ${playerId}`);
  }
  const competitions = parseMvpCompetitionConfig(catalog.competitions);
  for (const league of competitions.stateLeagues)
    for (const [clubId] of league.participants)
      if (!clubIds.has(clubId))
        fail(`${league.id} references unknown club ${clubId}`);
  for (const clubId of [
    ...competitions.continental.initialDirectClubIds,
    ...competitions.continental.initialPreliminaryClubIds,
  ])
    if (!clubIds.has(clubId))
      fail(`continental references unknown club ${clubId}`);
  return catalog;
}
