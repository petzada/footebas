/* eslint-disable @typescript-eslint/no-non-null-assertion -- adapter validates section and row cardinalities before indexing */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  hashSeed,
  type CareerDivision,
  type CareerPosition,
  type CareerWorldContent,
} from '@footebas/engine';

export const CAREER_CONTENT_ADAPTER_VERSION =
  'serie-a-b-markdown-adapter-v1' as const;
export const CAREER_ATTRIBUTE_DERIVATION_VERSION =
  'relative-strength-derived-v1' as const;
export const CAREER_ATTRIBUTE_SEED = 'phase4-real-content-v1' as const;

const SOURCES = Object.freeze({
  'serie-a': '../../../dados/elencos/brasileirao-serie-a-2026.md',
  'serie-b': '../../../dados/elencos/brasileirao-serie-b-2026.md',
  glue: '../../../dados/elencos/forca-relativa-cola.md',
});

const POSITION_PATTERNS: readonly Readonly<{
  pattern: RegExp;
  position: CareerPosition;
}>[] = [
  { pattern: /^Goleiro$/i, position: 'GK' },
  { pattern: /^(Zagueiro|Lateral|Defensor)/i, position: 'DEF' },
  { pattern: /^(Volante|Meia|Meio-campo)/i, position: 'MID' },
  {
    pattern: /^(Ponta|Centroavante|Seg\. Atacante|Atacante)/i,
    position: 'FWD',
  },
];

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function positionFor(raw: string): CareerPosition {
  const match = POSITION_PATTERNS.find(({ pattern }) => pattern.test(raw));
  if (!match) throw new Error(`Unsupported raw career position: ${raw}`);
  return match.position;
}

interface TierInfo {
  readonly tier: string;
  readonly mean: number;
  readonly rank: number;
  readonly size: number;
}

function readTierMap(
  markdown: string,
  division: CareerDivision,
): ReadonlyMap<string, TierInfo> {
  const heading =
    division === 'serie-a' ? '## Série A 2026' : '## Série B 2026';
  const start = markdown.indexOf(heading);
  if (start < 0) throw new Error(`Missing strength glue heading ${heading}`);
  const remainder = markdown.slice(start + heading.length);
  const end = remainder.search(/^## /m);
  const section = end < 0 ? remainder : remainder.slice(0, end);
  const result = new Map<string, TierInfo>();
  for (const row of section.matchAll(
    /^\| \*\*([^*]+)\*\* \| ([^|]+) \| ([^|]+) \|$/gm,
  )) {
    const tier = row[1]!.trim();
    const names = row[2]!.split(',').map((name) => name.trim());
    const bounds = [...row[3]!.matchAll(/\d+/g)].map((match) =>
      Number(match[0]),
    );
    if (bounds.length < 2)
      throw new Error(`Missing numeric strength bounds for tier ${tier}`);
    const mean = (bounds[0]! + bounds[1]!) / 2;
    names.forEach((name, rank) =>
      result.set(name, { tier, mean, rank, size: names.length }),
    );
  }
  if (result.size !== 20)
    throw new Error(
      `${division} glue must identify exactly 20 clubs, found ${String(result.size)}`,
    );
  return result;
}

interface RawPlayer {
  readonly name: string;
  readonly rawPosition: string;
  readonly position: CareerPosition;
  readonly row: number;
}

function selectSquad(rows: readonly RawPlayer[]): readonly RawPlayer[] {
  const minimum: Readonly<Record<CareerPosition, number>> = {
    GK: 2,
    DEF: 6,
    MID: 6,
    FWD: 4,
  };
  const selected: RawPlayer[] = [];
  for (const position of ['GK', 'DEF', 'MID', 'FWD'] as const)
    selected.push(
      ...rows
        .filter((player) => player.position === position)
        .slice(0, minimum[position]),
    );
  const selectedRows = new Set(selected.map(({ row }) => row));
  for (const player of rows) {
    if (selected.length >= 24) break;
    if (!selectedRows.has(player.row)) {
      selected.push(player);
      selectedRows.add(player.row);
    }
  }
  if (selected.length < 22)
    throw new Error(
      `Raw squad has only ${String(selected.length)} usable identities`,
    );
  return selected.sort((left, right) => left.row - right.row);
}

function parseDivision(
  markdown: string,
  division: CareerDivision,
  tiers: ReadonlyMap<string, TierInfo>,
  sourceId: string,
) {
  const clubsStart = markdown.indexOf('## Clubes');
  if (clubsStart < 0) throw new Error(`${sourceId} lacks club section`);
  const remainder = markdown.slice(clubsStart + '## Clubes'.length);
  const sectionEnd = remainder.search(/^## /m);
  const section = sectionEnd < 0 ? remainder : remainder.slice(0, sectionEnd);
  const headings = [...section.matchAll(/^### (.+)$/gm)];
  if (headings.length !== 20)
    throw new Error(`${sourceId} must contain 20 club adapters`);
  return headings.map((heading, clubIndex) => {
    const next = headings[clubIndex + 1];
    const body = section.slice(
      heading.index + heading[0].length,
      next?.index ?? section.length,
    );
    const headingText = heading[1]!.trim();
    const name = headingText.replace(/ \([^)]*\)(?: \[parcial\])?$/, '').trim();
    const partial = headingText.endsWith('[parcial]');
    const tier = tiers.get(name);
    if (!tier)
      throw new Error(`Strength glue lacks real club identity ${name}`);
    const rawRows: RawPlayer[] = [
      ...body.matchAll(/^- ([^|\r\n]+?) \| ([^|\r\n]+?) \| ([^\r\n]+)$/gm),
    ].map((row, index) => ({
      rawPosition: row[1]!.trim(),
      name: row[2]!.trim(),
      position: positionFor(row[1]!.trim()),
      row: index,
    }));
    const squad = selectSquad(rawRows);
    const clubId = `${division}:${slug(name)}`;
    const perPosition = new Map<CareerPosition, number>();
    const players = squad.map((player) => {
      const positionDepth = perPosition.get(player.position) ?? 0;
      perPosition.set(player.position, positionDepth + 1);
      const identityOccurrence = rawRows
        .slice(0, player.row + 1)
        .filter(({ name: candidate }) => candidate === player.name).length;
      const id = `player:${clubId}:${slug(player.name)}:${String(identityOccurrence)}`;
      const rankBias =
        tier.size === 1 ? 0 : 1.5 - (tier.rank / (tier.size - 1)) * 3;
      const depthBias =
        positionDepth < (player.position === 'GK' ? 1 : 3)
          ? 2
          : positionDepth > 5
            ? -2
            : 0;
      const partialBias = partial && player.row >= 18 ? -2 : 0;
      const noise =
        (hashSeed(`${CAREER_ATTRIBUTE_SEED}|${id}|strength`) % 7) - 3;
      const strength = Math.max(
        35,
        Math.min(
          94,
          Math.round(tier.mean + rankBias + depthBias + partialBias + noise),
        ),
      );
      const age = 18 + (hashSeed(`${CAREER_ATTRIBUTE_SEED}|${id}|age`) % 17);
      const potential = Math.max(
        strength,
        Math.min(
          96,
          strength +
            (hashSeed(`${CAREER_ATTRIBUTE_SEED}|${id}|potential`) % 18),
        ),
      );
      return {
        id,
        name: player.name,
        position: player.position,
        strength,
        age,
        potential,
        identitySource: 'raw-markdown' as const,
        identitySourceId: `${sourceId}#club:${slug(name)}:row:${String(player.row + 1)}`,
        attributesVersion: CAREER_ATTRIBUTE_DERIVATION_VERSION,
        attributesSeed: `${CAREER_ATTRIBUTE_SEED}|${id}`,
      };
    });
    return { id: clubId, name, division, tier: tier.tier, players };
  });
}

export function loadCareerWorldContent(): CareerWorldContent {
  const serieAPath = fileURLToPath(
    new URL(SOURCES['serie-a'], import.meta.url),
  );
  const serieBPath = fileURLToPath(
    new URL(SOURCES['serie-b'], import.meta.url),
  );
  const gluePath = fileURLToPath(new URL(SOURCES.glue, import.meta.url));
  const glue = readFileSync(gluePath, 'utf8');
  const clubs = [
    ...parseDivision(
      readFileSync(serieAPath, 'utf8'),
      'serie-a',
      readTierMap(glue, 'serie-a'),
      'dados/elencos/brasileirao-serie-a-2026.md',
    ),
    ...parseDivision(
      readFileSync(serieBPath, 'utf8'),
      'serie-b',
      readTierMap(glue, 'serie-b'),
      'dados/elencos/brasileirao-serie-b-2026.md',
    ),
  ];
  return Object.freeze({
    version: CAREER_CONTENT_ADAPTER_VERSION,
    sourceIds: Object.freeze([
      'dados/elencos/brasileirao-serie-a-2026.md',
      'dados/elencos/brasileirao-serie-b-2026.md',
      'dados/elencos/forca-relativa-cola.md',
    ]),
    clubs: Object.freeze(clubs),
  });
}
