/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/restrict-template-expressions -- RegExp match cardinality/indexes are checked before access; raw row index is part of the derivation seed */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Position } from '@footebas/domain';

export const REAL_SAMPLE_VERSION = 'serie-a-2026-eight-clubs-v1' as const;
export const DERIVATION_VERSION = 'relative-strength-glue-v1' as const;
export const DERIVATION_SEED = 'real-sample-derived-v1' as const;
export const SAMPLE_CLUBS = [
  'Flamengo',
  'Palmeiras',
  'Atlético Mineiro',
  'Fluminense',
  'São Paulo',
  'Botafogo',
  'Corinthians',
  'Bahia',
] as const;
const TIER: Readonly<
  Record<(typeof SAMPLE_CLUBS)[number], { tier: string; mean: number }>
> = {
  Flamengo: { tier: 'S+', mean: 82 },
  Palmeiras: { tier: 'S+', mean: 80 },
  'Atlético Mineiro': { tier: 'S', mean: 78 },
  Fluminense: { tier: 'S', mean: 77 },
  'São Paulo': { tier: 'S', mean: 76 },
  Botafogo: { tier: 'S', mean: 75 },
  Corinthians: { tier: 'A', mean: 74 },
  Bahia: { tier: 'A', mean: 70 },
};
const POSITION: Readonly<Record<string, Position>> = {
  Goleiro: 'GK',
  Zagueiro: 'CB',
  'Lateral Esq.': 'LB',
  'Lateral Dir.': 'RB',
  Volante: 'DM',
  'Meia Central': 'CM',
  'Meia Ofensivo': 'AM',
  'Ponta Esq.': 'LW',
  'Ponta Dir.': 'RW',
  'Seg. Atacante': 'ST',
  Centroavante: 'ST',
};
function hash(text: string): number {
  let result = 2166136261;
  for (const character of text) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}
export interface SamplePlayer {
  readonly name: string;
  readonly rawPosition: string;
  readonly position: Position;
  readonly shirtMarker: string;
  readonly strength: number;
  readonly provenance: Readonly<{
    readonly identity: 'raw-markdown';
    readonly attributes: 'derived';
    readonly seed: string;
    readonly version: string;
  }>;
}
export interface SampleClub {
  readonly name: string;
  readonly tier: string;
  readonly players: readonly SamplePlayer[];
}
export interface RealSample {
  readonly version: string;
  readonly source: string;
  readonly clubs: readonly SampleClub[];
  readonly playerCount: number;
}

export function loadRealSample(
  sourcePath = fileURLToPath(
    new URL(
      '../../../dados/elencos/brasileirao-serie-a-2026.md',
      import.meta.url,
    ),
  ),
): RealSample {
  const markdown = readFileSync(sourcePath, 'utf8');
  const headings = [...markdown.matchAll(/^### (.+?)(?: \(.+\))?\r?$/gm)];
  const clubs = SAMPLE_CLUBS.map((name) => {
    const heading = headings.find((candidate) => candidate[1] === name);
    if (heading?.index === undefined)
      throw new Error(`Missing raw roster section: ${name}`);
    const next = headings.find(
      (candidate) => (candidate.index ?? 0) > heading.index!,
    );
    const section = markdown.slice(
      heading.index + heading[0].length,
      next?.index ?? markdown.length,
    );
    const rows = [
      ...section.matchAll(/^- ([^|\r\n]+?) \| ([^|\r\n]+?) \| ([^\r\n]+)$/gm),
    ].slice(0, 25);
    if (rows.length < 22)
      throw new Error(
        `Insufficient conservative coverage for ${name}: ${rows.length}`,
      );
    const info = TIER[name];
    const players = rows.map((row, index): SamplePlayer => {
      const rawPosition = row[1]!.trim();
      const position = POSITION[rawPosition];
      if (position === undefined)
        throw new Error(`Unsupported raw position ${rawPosition} for ${name}`);
      const playerName = row[2]!.trim();
      return {
        name: playerName,
        rawPosition,
        position,
        shirtMarker: row[3]!.trim(),
        strength: Math.max(
          1,
          Math.min(
            100,
            info.mean +
              (hash(`${DERIVATION_SEED}|${name}|${playerName}|${index}`) % 7) -
              3,
          ),
        ),
        provenance: {
          identity: 'raw-markdown',
          attributes: 'derived',
          seed: DERIVATION_SEED,
          version: DERIVATION_VERSION,
        },
      };
    });
    return { name, tier: info.tier, players };
  });
  return {
    version: REAL_SAMPLE_VERSION,
    source: sourcePath,
    clubs,
    playerCount: clubs.reduce((sum, club) => sum + club.players.length, 0),
  };
}
