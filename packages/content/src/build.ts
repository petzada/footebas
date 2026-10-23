/* eslint-disable @typescript-eslint/no-non-null-assertion -- regex captures are guaranteed by the matched patterns */
import type { PlayerTrait, Position, PreferredSide } from '@footebas/domain';
import {
  hashSeed,
  parseMvpCompetitionConfig,
  type MvpCompetitionConfig,
  type MvpDivisionId,
} from '@footebas/engine';
import {
  ATTRIBUTE_DERIVATION_VERSION,
  CATALOG_SCHEMA_VERSION,
  MAXIMUM_SQUAD,
  parseCatalog,
  type CatalogClub,
  type CatalogHighlight,
  type CatalogNote,
  type CatalogPlayer,
  type CatalogShirt,
  type CatalogSource,
  type ContentCatalog,
} from './catalog.js';

/** A club outside Série A/B/C taken from the state or continental research. */
export interface ExtraClubConfig {
  readonly id: string;
  readonly name: string;
  readonly heading: string;
  readonly source: string;
  readonly origin: 'state' | 'foreign';
  readonly country: string;
  readonly tier: string;
  readonly tierBounds: readonly [number, number];
  readonly tierBasis: string;
}

export interface CatalogBuildInput {
  readonly contentVersion: string;
  readonly snapshotDate: string;
  /** Raw, immutable Markdown keyed by repository-relative path. */
  readonly files: Readonly<Record<string, string>>;
  readonly competitionConfig: unknown;
  readonly glueFile: string;
  readonly extraClubs?: readonly ExtraClubConfig[];
  /** Optional research file listing standout players per club. */
  readonly highlightsFile?: string;
}

const DIVISIONS = ['serie-a', 'serie-b', 'serie-c'] as const;
const GLUE_HEADINGS: Readonly<Record<MvpDivisionId, string>> = {
  'serie-a': '## Série A 2026',
  'serie-b': '## Série B 2026',
  'serie-c': '## Série C 2026',
};
/** Rule 5 of the glue: unlisted clubs fall back to the division default. */
const DEFAULT_TIER: Readonly<
  Record<MvpDivisionId, { tier: string; low: number; high: number }>
> = {
  'serie-a': { tier: 'C', low: 62, high: 66 },
  'serie-b': { tier: 'D', low: 54, high: 58 },
  'serie-c': { tier: 'E', low: 48, high: 53 },
};
const MINIMUM_PLAYERS = 18;
const MINIMUM_GOALKEEPERS = 2;
/** Positional floor kept before the cap trims a squad to 35. */
const CAP_FLOOR: Readonly<Record<'GK' | 'DEF' | 'MID' | 'FWD', number>> = {
  GK: 3,
  DEF: 8,
  MID: 8,
  FWD: 5,
};
const HIGHLIGHT_STRENGTH = { craque: 6, destaque: 3 } as const;

const POSITIONS: readonly Readonly<{
  pattern: RegExp;
  position: Position;
  side?: PreferredSide;
}>[] = [
  { pattern: /^(Goleiro|GOL)$/i, position: 'GK' },
  { pattern: /^(Zagueiro|ZAG|Defensor|DEF)$/i, position: 'CB', side: 'center' },
  { pattern: /^(Lateral Esq\.|LE)$/i, position: 'LB', side: 'left' },
  { pattern: /^(Lateral Dir\.|LD)$/i, position: 'RB', side: 'right' },
  { pattern: /^(Volante|VOL)$/i, position: 'DM', side: 'center' },
  {
    pattern: /^(Meia Central|MC|Meio-campo)$/i,
    position: 'CM',
    side: 'center',
  },
  { pattern: /^(Meia Dir\.|MD)$/i, position: 'RW', side: 'right' },
  { pattern: /^(Meia Ofensivo|MEI|MO)$/i, position: 'AM', side: 'center' },
  { pattern: /^(Ponta Esq\.|PE)$/i, position: 'LW', side: 'left' },
  { pattern: /^(Ponta Dir\.|PD)$/i, position: 'RW', side: 'right' },
  {
    pattern: /^(Centroavante|ATA|Atacante|Seg\. Atacante|SA)$/i,
    position: 'ST',
    side: 'center',
  },
];

const TRAIT_POOLS: Readonly<Record<Position, readonly PlayerTrait[]>> = {
  GK: ['reflexes', 'positioning', 'aerial_command', 'penalty_saving'],
  CB: ['marking', 'tackling', 'heading'],
  LB: ['pace', 'crossing', 'tackling'],
  RB: ['pace', 'crossing', 'tackling'],
  DM: ['tackling', 'passing', 'marking'],
  CM: ['passing', 'playmaking', 'crossing'],
  AM: ['playmaking', 'passing', 'finishing'],
  LW: ['pace', 'crossing', 'finishing'],
  RW: ['pace', 'crossing', 'finishing'],
  ST: ['finishing', 'heading', 'pace'],
};

const GROUP: Readonly<Record<Position, 'GK' | 'DEF' | 'MID' | 'FWD'>> = {
  GK: 'GK',
  CB: 'DEF',
  LB: 'DEF',
  RB: 'DEF',
  DM: 'MID',
  CM: 'MID',
  AM: 'MID',
  LW: 'FWD',
  RW: 'FWD',
  ST: 'FWD',
};

export function slug(value: string, separator = '_'): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`^\\${separator}+|\\${separator}+$`, 'g'), '');
}

/** Comparable club name: no accents, case, punctuation or location. */
function clubKey(value: string): string {
  return slug(
    value.replace(/\s*\[parcial[^\]]*\]/g, '').replace(/\s*\([^)]*\).*$/, ''),
    ' ',
  );
}

function lineOf(markdown: string, index: number): number {
  return markdown.slice(0, index).split('\n').length;
}

function section(markdown: string, heading: RegExp, file: string) {
  const start = markdown.search(heading);
  if (start < 0) throw new Error(`${file} lacks section ${String(heading)}`);
  const rest = markdown.slice(start);
  const end = rest.slice(1).search(/^## /m);
  return { offset: start, body: end < 0 ? rest : rest.slice(0, end + 1) };
}

interface Tier {
  readonly tier: string;
  readonly low: number;
  readonly high: number;
  readonly rank: number;
  readonly size: number;
}

function readTiers(glue: string, division: MvpDivisionId) {
  const { body } = section(
    glue,
    new RegExp(`^${GLUE_HEADINGS[division]}\\r?$`, 'm'),
    'glue',
  );
  const tiers = new Map<string, Tier>();
  for (const row of body.matchAll(
    /^\| \*\*([^*]+)\*\* \| ([^|]+) \| ([^|]+) \|\r?$/gm,
  )) {
    const bounds = [...row[3]!.matchAll(/\d+/g)].map(Number);
    if (bounds.length < 2) throw new Error(`glue tier ${row[1]!} lacks bounds`);
    const names = row[2]!.split(',').map((name) => name.trim());
    names.forEach((name, rank) =>
      tiers.set(name, {
        tier: row[1]!.trim(),
        low: bounds[0]!,
        high: bounds[1]!,
        rank,
        size: names.length,
      }),
    );
  }
  return tiers;
}

function parseShirt(raw: string): CatalogShirt {
  const value = raw.trim();
  if (value === '—' || value === '-') return { status: 'absent' };
  if (value.startsWith('#?')) return { status: 'unknown' };
  const match = /^#(\d+)\s*(.*)$/.exec(value);
  if (!match) return { status: 'unknown' };
  const note = match[2]!.trim();
  return note.length > 0
    ? {
        status: 'conflict',
        number: Number(match[1]),
        note: note.replace(/^\*\[|\]\*$/g, ''),
      }
    : { status: 'known', number: Number(match[1]) };
}

/** Parses `## Clube` sections of the highlights research file. */
export function parseHighlights(
  markdown: string,
): ReadonlyMap<string, ReadonlyMap<string, CatalogHighlight>> {
  const result = new Map<string, Map<string, CatalogHighlight>>();
  const sections = markdown.split(/^## /m).slice(1);
  for (const block of sections) {
    const [title = '', ...lines] = block.split(/\r?\n/);
    const players = new Map<string, CatalogHighlight>();
    for (const line of lines) {
      const match =
        /^- (craque|destaque) \| ([^|]+?) \| ([^|]+?) \| (.+?)\s*$/.exec(line);
      if (match)
        players.set(match[2]!.trim(), {
          level: match[1] as CatalogHighlight['level'],
          reason: match[3]!.trim(),
          source: match[4]!.trim(),
        });
    }
    if (players.size > 0) result.set(clubKey(title.trim()), players);
  }
  return result;
}

function unit(seed: string, field: string): number {
  return hashSeed(`${seed}|${field}`);
}

function derive(
  playerId: string,
  position: Position,
  tier: Tier,
  depth: number,
  row: number,
  partial: boolean,
  highlight: CatalogHighlight | undefined,
): CatalogPlayer['derived'] {
  const seed = `${ATTRIBUTE_DERIVATION_VERSION}|${playerId}`;
  const mean = (tier.low + tier.high) / 2;
  const rankBias =
    tier.size === 1 ? 0 : 1.5 - (tier.rank / (tier.size - 1)) * 3;
  const depthBias =
    depth < (position === 'GK' ? 1 : 4) ? 2 : depth > 7 ? -2 : 0;
  const partialBias = partial && row >= 18 ? -2 : 0;
  const noise = (unit(seed, 'strength') % 7) - 3;
  const highlightBias =
    highlight === undefined ? 0 : HIGHLIGHT_STRENGTH[highlight.level];
  const strength = Math.max(
    35,
    Math.min(
      94,
      Math.round(
        mean + rankBias + depthBias + partialBias + noise + highlightBias,
      ),
    ),
  );
  const age = 18 + (unit(seed, 'age') % 17);
  const potential =
    age >= 30
      ? strength
      : Math.min(96, strength + (unit(seed, 'potential') % 18));
  const hidden = (field: string) => 35 + (unit(seed, field) % 56);
  const pool = TRAIT_POOLS[position];
  const traitCount =
    strength >= 75 || highlight !== undefined
      ? 2
      : strength >= 62
        ? 1
        : unit(seed, 'trait-count') % 2;
  const first = unit(seed, 'trait') % pool.length;
  const traits = Array.from(
    { length: traitCount },
    (_, index) => pool[(first + index) % pool.length]!,
  );
  const ageFactor = age < 24 ? 1.3 : age < 29 ? 1 : 0.6;
  const popularity = highlight?.level === 'craque' ? 1.6 : highlight ? 1.25 : 1;
  const valueBrl =
    Math.round(((strength - 30) ** 3 * 150 * ageFactor * popularity) / 10_000) *
    10_000;
  const monthlyWageBrl = Math.max(3_000, Math.round(valueBrl / 60 / 500) * 500);
  const elite = (field: string, floor: number) =>
    highlight === undefined ? hidden(field) : Math.max(floor, hidden(field));
  return {
    version: ATTRIBUTE_DERIVATION_VERSION,
    seed,
    age,
    strength,
    potential: Math.max(strength, potential),
    consistency: elite('consistency', highlight?.level === 'craque' ? 80 : 70),
    injuryProneness: hidden('injury'),
    adaptation: hidden('adaptation'),
    professionalism: elite('professionalism', 70),
    bigGame: elite('big-game', highlight?.level === 'craque' ? 85 : 75),
    traits,
    valueBrl,
    monthlyWageBrl,
  };
}

interface RawRow {
  readonly rawPosition: string;
  readonly position: Position;
  readonly side?: PreferredSide;
  readonly name: string;
  readonly shirt: CatalogShirt;
  readonly line: number;
  readonly index: number;
}

function parseRows(
  markdown: string,
  bodyOffset: number,
  body: string,
  file: string,
): RawRow[] {
  return [
    ...body.matchAll(/^- ([^|\r\n]+?) \| ([^|\r\n]+?) \| ([^\r\n]+)$/gm),
  ].map((row, index) => {
    const rawPosition = row[1]!.replace(/^-\s+/, '').trim();
    const mapped = POSITIONS.find(({ pattern }) => pattern.test(rawPosition));
    if (!mapped)
      throw new Error(`${file}: unsupported position ${rawPosition}`);
    return {
      rawPosition,
      position: mapped.position,
      ...(mapped.side === undefined ? {} : { side: mapped.side }),
      name: row[2]!.trim(),
      shirt: parseShirt(row[3]!),
      line: lineOf(markdown, bodyOffset + row.index),
      index,
    };
  });
}

/**
 * Trims a squad to the cap without inventing anyone: standouts first, then a
 * positional floor, then players with a researched shirt number, in file order.
 */
function capSquad(
  rows: readonly RawRow[],
  highlights: ReadonlyMap<string, CatalogHighlight> | undefined,
): { kept: RawRow[]; dropped: RawRow[] } {
  if (rows.length <= MAXIMUM_SQUAD) return { kept: [...rows], dropped: [] };
  const kept = new Set<RawRow>();
  for (const row of rows) if (highlights?.has(row.name)) kept.add(row);
  const preference = [...rows].sort(
    (left, right) =>
      Number(left.shirt.status !== 'known') -
        Number(right.shirt.status !== 'known') || left.index - right.index,
  );
  for (const group of ['GK', 'DEF', 'MID', 'FWD'] as const)
    for (const row of preference) {
      const count = [...kept].filter(
        ({ position }) => GROUP[position] === group,
      ).length;
      if (count >= CAP_FLOOR[group]) break;
      if (GROUP[row.position] === group) kept.add(row);
    }
  for (const row of preference) {
    if (kept.size >= MAXIMUM_SQUAD) break;
    kept.add(row);
  }
  return {
    kept: rows.filter((row) => kept.has(row)),
    dropped: rows.filter((row) => !kept.has(row)),
  };
}

/**
 * Builds the canonical, versioned catalog from the raw research files. The
 * Markdown is never corrected: gaps become explicit notes, never facts.
 */
export function buildCatalog(input: CatalogBuildInput): ContentCatalog {
  const raw = parseMvpCompetitionConfig(input.competitionConfig);
  const glue = input.files[input.glueFile];
  if (glue === undefined) throw new Error('missing strength glue file');
  const highlightsMarkdown =
    input.highlightsFile === undefined
      ? undefined
      : input.files[input.highlightsFile];
  const highlights =
    highlightsMarkdown === undefined
      ? new Map<string, ReadonlyMap<string, CatalogHighlight>>()
      : parseHighlights(highlightsMarkdown);
  const usedHighlights = new Set<string>();
  const clubs: CatalogClub[] = [];
  const players: CatalogPlayer[] = [];
  const notes: CatalogNote[] = [];
  const legacyIds = new Map<string, string>();

  const addClub = (
    meta: Readonly<{
      name: string;
      location?: string;
      division?: MvpDivisionId;
      origin: CatalogClub['origin'];
      country: string;
      partial: boolean;
      tier: Tier;
      source: CatalogSource;
    }>,
    rows: readonly RawRow[],
  ) => {
    const clubId = `club_${slug(meta.name)}`;
    if (clubs.some(({ id }) => id === clubId))
      throw new Error(`club id collision ${clubId}`);
    if (meta.partial)
      notes.push({
        kind: 'partial-club',
        subject: clubId,
        source: meta.source,
      });
    const clubHighlights = highlights.get(clubKey(meta.name));
    const { kept, dropped } = capSquad(rows, clubHighlights);
    for (const row of dropped)
      notes.push({
        kind: 'excluded-over-cap',
        subject: `${clubId}:${row.name}`,
        source: { file: meta.source.file, line: row.line },
      });
    const depthByGroup = new Map<string, number>();
    const seenNames = new Map<string, number>();
    const playerIds: string[] = [];
    for (const row of kept) {
      const occurrence = (seenNames.get(row.name) ?? 0) + 1;
      seenNames.set(row.name, occurrence);
      const playerId = `player_${slug(meta.name)}_${slug(row.name)}${
        occurrence > 1 ? `_${String(occurrence)}` : ''
      }`;
      const source: CatalogSource = { file: meta.source.file, line: row.line };
      if (occurrence > 1)
        notes.push({
          kind: 'repeated-name-in-club',
          subject: playerId,
          source,
        });
      if (row.shirt.status !== 'known')
        notes.push({
          kind:
            row.shirt.status === 'unknown'
              ? 'unknown-shirt'
              : row.shirt.status === 'absent'
                ? 'absent-shirt'
                : 'shirt-conflict',
          subject: playerId,
          source,
        });
      const highlight =
        occurrence === 1 ? clubHighlights?.get(row.name) : undefined;
      if (highlight) usedHighlights.add(`${clubKey(meta.name)}|${row.name}`);
      const group = GROUP[row.position];
      const depth = depthByGroup.get(group) ?? 0;
      depthByGroup.set(group, depth + 1);
      players.push({
        id: playerId,
        clubId,
        name: row.name,
        rawPosition: row.rawPosition,
        position: row.position,
        ...(row.side === undefined ? {} : { preferredSide: row.side }),
        shirt: row.shirt,
        source,
        ...(highlight === undefined ? {} : { highlight }),
        derived: derive(
          playerId,
          row.position,
          meta.tier,
          depth,
          row.index,
          meta.partial,
          highlight,
        ),
      });
      playerIds.push(playerId);
    }
    clubs.push({
      id: clubId,
      name: meta.name,
      shortName:
        meta.name.length <= 24 ? meta.name : meta.name.slice(0, 24).trim(),
      ...(meta.location === undefined ? {} : { location: meta.location }),
      ...(meta.division === undefined ? {} : { division: meta.division }),
      origin: meta.origin,
      country: meta.country,
      tier: meta.tier.tier,
      tierRank: meta.tier.rank + 1,
      partial: meta.partial,
      source: meta.source,
      playerIds,
    });
    return clubId;
  };

  for (const division of DIVISIONS) {
    const file = raw.sources[division];
    const markdown = input.files[file];
    if (markdown === undefined) throw new Error(`missing source ${file}`);
    const tiers = readTiers(glue, division);
    const { offset, body } = section(
      markdown,
      /^## Clubes(?: \(\d+\))?\r?$/m,
      file,
    );
    const headings = [...body.matchAll(/^### (.+?)\r?$/gm)];
    if (headings.length !== 20)
      throw new Error(
        `${file} must list 20 clubs, found ${String(headings.length)}`,
      );
    headings.forEach((heading, index) => {
      const text = heading[1]!.trim();
      const partial = text.endsWith('[parcial]');
      const withoutFlag = text.replace(/\s*\[parcial\]$/, '');
      const located = /^(.*?) \(([^)]*)\)$/.exec(withoutFlag);
      const name = (located?.[1] ?? withoutFlag).trim();
      const next = headings[index + 1];
      const start = heading.index + heading[0].length;
      const clubBody = body.slice(start, next?.index ?? body.length);
      const clubId = addClub(
        {
          name,
          ...(located?.[2] === undefined ? {} : { location: located[2] }),
          division,
          origin: 'national',
          country: 'BRA',
          partial,
          tier: tiers.get(name) ?? {
            ...DEFAULT_TIER[division],
            rank: 0,
            size: 1,
          },
          source: { file, line: lineOf(markdown, offset + heading.index) },
        },
        parseRows(markdown, offset + start, clubBody, file),
      );
      legacyIds.set(`${division}:${slug(name, '-')}`, clubId);
    });
  }

  for (const extra of input.extraClubs ?? []) {
    const markdown = input.files[extra.source];
    if (markdown === undefined)
      throw new Error(`missing source ${extra.source}`);
    const marker = `### ${extra.heading}`;
    const headingIndex = markdown.search(
      new RegExp(`^${marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\r?$`, 'm'),
    );
    if (headingIndex < 0)
      throw new Error(`${extra.source} lacks heading ${extra.heading}`);
    const start = headingIndex + marker.length;
    const rest = markdown.slice(start);
    const end = rest.search(/^#{2,3} /m);
    const body = end < 0 ? rest : rest.slice(0, end);
    const rows = parseRows(markdown, start, body, extra.source);
    const source = {
      file: extra.source,
      line: lineOf(markdown, headingIndex),
    };
    if (
      rows.length < MINIMUM_PLAYERS ||
      rows.filter(({ position }) => position === 'GK').length <
        MINIMUM_GOALKEEPERS
    ) {
      notes.push({
        kind: 'club-without-playable-squad',
        subject: extra.id,
        source,
      });
      continue;
    }
    notes.push({ kind: 'assumed-strength-tier', subject: extra.id, source });
    const clubId = addClub(
      {
        name: extra.name,
        origin: extra.origin,
        country: extra.country,
        partial: extra.heading.includes('[parcial'),
        tier: {
          tier: extra.tier,
          low: extra.tierBounds[0],
          high: extra.tierBounds[1],
          rank: 0,
          size: 1,
        },
        source,
      },
      rows,
    );
    legacyIds.set(extra.id, clubId);
  }

  for (const [club, entries] of highlights)
    for (const [name] of entries)
      if (!usedHighlights.has(`${club}|${name}`))
        notes.push({
          kind: 'highlight-not-in-roster',
          subject: `${club}:${name}`,
          source: { file: input.highlightsFile ?? '', line: 0 },
        });

  const byName = new Map<string, Set<string>>();
  for (const player of players) {
    const clubsForName = byName.get(player.name) ?? new Set<string>();
    clubsForName.add(player.clubId);
    byName.set(player.name, clubsForName);
  }
  for (const player of players)
    if ((byName.get(player.name)?.size ?? 0) > 1)
      notes.push({
        kind: 'name-in-several-clubs',
        subject: player.id,
        source: player.source,
      });

  const rewrite = (legacy: string): string => {
    const id = legacyIds.get(legacy);
    if (id === undefined)
      throw new Error(`competition config references unknown club ${legacy}`);
    return id;
  };
  const competitions: MvpCompetitionConfig = {
    ...raw,
    stateLeagues: raw.stateLeagues.map((league) => ({
      ...league,
      participants: league.participants
        .filter(([legacy]) => legacyIds.has(legacy))
        .map(([legacy, identity]) => [rewrite(legacy), identity] as const),
    })),
    continental: {
      ...raw.continental,
      initialDirectClubIds: raw.continental.initialDirectClubIds.map(rewrite),
      initialPreliminaryClubIds:
        raw.continental.initialPreliminaryClubIds.map(rewrite),
      fixedClubIds: raw.continental.fixedClubIds.map(rewrite),
    },
  };

  return parseCatalog({
    schemaVersion: CATALOG_SCHEMA_VERSION,
    contentVersion: input.contentVersion,
    snapshotDate: input.snapshotDate,
    sources: [
      ...new Set([
        ...Object.values(raw.sources),
        input.glueFile,
        ...(input.extraClubs ?? []).map(({ source }) => source),
        ...(highlightsMarkdown === undefined ? [] : [input.highlightsFile!]),
      ]),
    ],
    clubs,
    players,
    competitions,
    notes,
  });
}
