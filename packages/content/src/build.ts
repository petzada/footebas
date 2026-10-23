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
  parseCatalog,
  type CatalogClub,
  type CatalogNote,
  type CatalogPlayer,
  type CatalogShirt,
  type CatalogSource,
  type ContentCatalog,
} from './catalog.js';

export interface CatalogBuildInput {
  readonly contentVersion: string;
  readonly snapshotDate: string;
  /** Raw, immutable Markdown keyed by repository-relative path. */
  readonly files: Readonly<Record<string, string>>;
  readonly competitionConfig: unknown;
  readonly glueFile: string;
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
  { pattern: /^(Meia Ofensivo|MEI)$/i, position: 'AM', side: 'center' },
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
): CatalogPlayer['derived'] {
  const seed = `${ATTRIBUTE_DERIVATION_VERSION}|${playerId}`;
  const mean = (tier.low + tier.high) / 2;
  const rankBias =
    tier.size === 1 ? 0 : 1.5 - (tier.rank / (tier.size - 1)) * 3;
  const depthBias =
    depth < (position === 'GK' ? 1 : 4) ? 2 : depth > 7 ? -2 : 0;
  const partialBias = partial && row >= 18 ? -2 : 0;
  const noise = (unit(seed, 'strength') % 7) - 3;
  const strength = Math.max(
    35,
    Math.min(94, Math.round(mean + rankBias + depthBias + partialBias + noise)),
  );
  const age = 18 + (unit(seed, 'age') % 17);
  const potential =
    age >= 30
      ? strength
      : Math.min(96, strength + (unit(seed, 'potential') % 18));
  const hidden = (field: string) => 35 + (unit(seed, field) % 56);
  const pool = TRAIT_POOLS[position];
  const traitCount =
    strength >= 75 ? 2 : strength >= 62 ? 1 : unit(seed, 'trait-count') % 2;
  const first = unit(seed, 'trait') % pool.length;
  const traits = Array.from(
    { length: traitCount },
    (_, index) => pool[(first + index) % pool.length]!,
  );
  const ageFactor = age < 24 ? 1.3 : age < 29 ? 1 : 0.6;
  const valueBrl =
    Math.round(((strength - 30) ** 3 * 150 * ageFactor) / 10_000) * 10_000;
  const monthlyWageBrl = Math.max(3_000, Math.round(valueBrl / 60 / 500) * 500);
  return {
    version: ATTRIBUTE_DERIVATION_VERSION,
    seed,
    age,
    strength,
    potential,
    consistency: hidden('consistency'),
    injuryProneness: hidden('injury'),
    adaptation: hidden('adaptation'),
    professionalism: hidden('professionalism'),
    bigGame: hidden('big-game'),
    traits,
    valueBrl,
    monthlyWageBrl,
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
  const clubs: CatalogClub[] = [];
  const players: CatalogPlayer[] = [];
  const notes: CatalogNote[] = [];
  const legacyIds = new Map<string, string>();

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
      const clubId = `club_${slug(name)}`;
      if (clubs.some(({ id }) => id === clubId))
        throw new Error(`club id collision ${clubId}`);
      legacyIds.set(`${division}:${slug(name, '-')}`, clubId);
      const source: CatalogSource = {
        file,
        line: lineOf(markdown, offset + heading.index),
      };
      if (partial)
        notes.push({ kind: 'partial-club', subject: clubId, source });
      const tier = tiers.get(name) ?? {
        ...DEFAULT_TIER[division],
        rank: 0,
        size: 1,
      };
      const next = headings[index + 1];
      const start = heading.index + heading[0].length;
      const clubBody = body.slice(start, next?.index ?? body.length);
      const depthByGroup = new Map<string, number>();
      const seenNames = new Map<string, number>();
      const playerIds: string[] = [];
      [
        ...clubBody.matchAll(
          /^- ([^|\r\n]+?) \| ([^|\r\n]+?) \| ([^\r\n]+)$/gm,
        ),
      ].forEach((row, rowIndex) => {
        const rawPosition = row[1]!.trim();
        const mapped = POSITIONS.find(({ pattern }) =>
          pattern.test(rawPosition),
        );
        if (!mapped)
          throw new Error(`${file}: unsupported position ${rawPosition}`);
        const playerName = row[2]!.trim();
        const occurrence = (seenNames.get(playerName) ?? 0) + 1;
        seenNames.set(playerName, occurrence);
        const playerId = `player_${slug(name)}_${slug(playerName)}${
          occurrence > 1 ? `_${String(occurrence)}` : ''
        }`;
        const playerSource: CatalogSource = {
          file,
          line: lineOf(markdown, offset + start + row.index),
        };
        if (occurrence > 1)
          notes.push({
            kind: 'repeated-name-in-club',
            subject: playerId,
            source: playerSource,
          });
        const shirt = parseShirt(row[3]!);
        if (shirt.status !== 'known')
          notes.push({
            kind:
              shirt.status === 'unknown'
                ? 'unknown-shirt'
                : shirt.status === 'absent'
                  ? 'absent-shirt'
                  : 'shirt-conflict',
            subject: playerId,
            source: playerSource,
          });
        const group = GROUP[mapped.position];
        const depth = depthByGroup.get(group) ?? 0;
        depthByGroup.set(group, depth + 1);
        players.push({
          id: playerId,
          clubId,
          name: playerName,
          rawPosition,
          position: mapped.position,
          ...(mapped.side === undefined ? {} : { preferredSide: mapped.side }),
          shirt,
          source: playerSource,
          derived: derive(
            playerId,
            mapped.position,
            tier,
            depth,
            rowIndex,
            partial,
          ),
        });
        playerIds.push(playerId);
      });
      clubs.push({
        id: clubId,
        name,
        shortName: name.length <= 24 ? name : name.slice(0, 24).trim(),
        ...(located?.[2] === undefined ? {} : { location: located[2] }),
        division,
        tier: tier.tier,
        tierRank: tier.rank + 1,
        partial,
        source,
        playerIds,
      });
    });
  }

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
      participants: league.participants.map(
        ([legacy, identity]) => [rewrite(legacy), identity] as const,
      ),
    })),
    continental: {
      ...raw.continental,
      initialDirectClubIds: raw.continental.initialDirectClubIds.map(rewrite),
      initialPreliminaryClubIds:
        raw.continental.initialPreliminaryClubIds.map(rewrite),
    },
  };

  return parseCatalog({
    schemaVersion: CATALOG_SCHEMA_VERSION,
    contentVersion: input.contentVersion,
    snapshotDate: input.snapshotDate,
    sources: [...Object.values(raw.sources), input.glueFile],
    clubs,
    players,
    competitions,
    notes,
  });
}
