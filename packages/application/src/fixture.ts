/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/restrict-template-expressions -- raw roster sections are checked before indexed access */
import {
  createClub,
  createPlayer,
  entityId,
  money,
  percentage,
  strength,
  type Club,
  type Lineup,
  type Player,
  type PlayerTrait,
  type Position,
} from '@footebas/domain';
import { autoSelectLineup } from '@footebas/engine';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const FIXTURE_CONTENT_VERSION =
  'serie-a-2026-eight-clubs-matchday-v2' as const;
export const FIXTURE_DERIVATION_VERSION =
  'relative-strength-glue-matchday-v2' as const;
export const FIXTURE_DERIVATION_SEED = 'real-sample-derived-v1' as const;
export const FIXTURE_SOURCE =
  'dados/elencos/brasileirao-serie-a-2026.md' as const;
export const FIXTURE_CLUBS = [
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
  Record<(typeof FIXTURE_CLUBS)[number], { tier: string; mean: number }>
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

interface RawPlayer {
  readonly name: string;
  readonly position: Position;
  readonly strength: number;
}
interface RawClub {
  readonly name: (typeof FIXTURE_CLUBS)[number];
  readonly mean: number;
  readonly players: readonly RawPlayer[];
}

function hash(text: string): number {
  let result = 2166136261;
  for (const character of text) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function loadRawClubs(
  sourcePath = fileURLToPath(
    new URL(
      '../../../dados/elencos/brasileirao-serie-a-2026.md',
      import.meta.url,
    ),
  ),
): readonly RawClub[] {
  const markdown = readFileSync(sourcePath, 'utf8');
  const headings = [...markdown.matchAll(/^### (.+?)(?: \(.+\))?\r?$/gm)];
  return FIXTURE_CLUBS.map((name) => {
    const heading = headings.find((candidate) => candidate[1] === name);
    if (heading?.index === undefined)
      throw new Error(`Missing raw roster section: ${name}`);
    const next = headings.find(
      (candidate) => (candidate.index ?? 0) > heading.index,
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
    const { mean } = TIER[name];
    return {
      name,
      mean,
      players: rows.map((row, index) => {
        const rawPosition = row[1]!.trim();
        const position = POSITION[rawPosition];
        if (position === undefined)
          throw new Error(
            `Unsupported raw position ${rawPosition} for ${name}`,
          );
        const playerName = row[2]!.trim();
        return {
          name: playerName,
          position,
          strength: Math.max(
            1,
            Math.min(
              100,
              mean +
                (hash(
                  `${FIXTURE_DERIVATION_SEED}|${name}|${playerName}|${index}`,
                ) %
                  7) -
                3,
            ),
          ),
        };
      }),
    };
  });
}

export interface FixtureContent {
  readonly clubs: readonly Club[];
  readonly players: readonly Player[];
  readonly provenance: Readonly<{
    source: typeof FIXTURE_SOURCE;
    identity: 'raw-markdown';
    attributes: 'derived';
    seed: typeof FIXTURE_DERIVATION_SEED;
    version: typeof FIXTURE_DERIVATION_VERSION;
  }>;
}

export function createFixtureContent(): FixtureContent {
  const clubs: Club[] = [];
  const players: Player[] = [];
  loadRawClubs().forEach((rawClub, clubIndex) => {
    const clubId = entityId(`club_${String(clubIndex + 1)}`, 'club');
    const squad = rawClub.players.map((rawPlayer, playerIndex) => {
      const id = entityId(
        `player_${String(clubIndex + 1)}_${String(playerIndex + 1)}`,
        'player',
      );
      const derivation = hash(
        `${FIXTURE_DERIVATION_SEED}|${rawClub.name}|${rawPlayer.name}|attributes`,
      );
      const secondary =
        rawPlayer.position === 'GK'
          ? []
          : rawPlayer.position === 'ST'
            ? [derivation % 2 === 0 ? ('RW' as const) : ('LW' as const)]
            : rawPlayer.position === 'CB'
              ? ['DM' as const]
              : rawPlayer.position === 'RB' || rawPlayer.position === 'LB'
                ? [
                    rawPlayer.position === 'RB'
                      ? ('RW' as const)
                      : ('LW' as const),
                  ]
                : [
                    rawPlayer.position === 'CM'
                      ? ('AM' as const)
                      : ('CM' as const),
                  ];
      const traits: readonly PlayerTrait[] =
        rawPlayer.position === 'GK'
          ? derivation % 2 === 0
            ? ['reflexes', 'positioning']
            : ['aerial_command', 'penalty_saving']
          : rawPlayer.position === 'ST'
            ? ['finishing', derivation % 2 === 0 ? 'heading' : 'pace']
            : rawPlayer.position === 'RB' || rawPlayer.position === 'LB'
              ? ['pace', 'crossing']
              : rawPlayer.position === 'CB' || rawPlayer.position === 'DM'
                ? ['marking', 'tackling']
                : ['passing', 'playmaking'];
      players.push(
        createPlayer({
          id,
          name: rawPlayer.name,
          age: 19 + (derivation % 15),
          position: rawPlayer.position,
          secondaryPositions: secondary,
          preferredSide:
            rawPlayer.position === 'LB' || rawPlayer.position === 'LW'
              ? 'left'
              : rawPlayer.position === 'RB' || rawPlayer.position === 'RW'
                ? 'right'
                : 'center',
          strength: strength(rawPlayer.strength),
          traits,
          hidden: {
            potential: percentage(60 + (derivation % 21)),
            consistency: percentage(65 + (derivation % 16)),
            injuryProneness: percentage(8 + (derivation % 14)),
            adaptation: percentage(65 + (derivation % 21)),
            professionalism: percentage(65 + (derivation % 21)),
            bigGame: percentage(55 + (derivation % 26)),
          },
          morale: percentage(68 + (derivation % 9)),
          condition: percentage(100),
          matchSharpness: percentage(72 + (derivation % 9)),
          value: money(rawPlayer.strength * 150_000),
          salary: money(rawPlayer.strength * 1_000),
          clubId,
          squadStatus: playerIndex < 11 ? 'starter' : 'rotation',
          injuryRounds: 0,
          suspensionRounds: 0,
          careerStats: {
            appearances: 0,
            goals: 0,
            assists: 0,
            yellowCards: 0,
            redCards: 0,
          },
        }),
      );
      return id;
    });
    clubs.push(
      createClub({
        id: clubId,
        name: rawClub.name,
        shortName: rawClub.name.slice(0, 3).toUpperCase(),
        squad,
        balance: money(20_000_000),
        reputation: percentage(rawClub.mean),
      }),
    );
  });
  return {
    clubs,
    players,
    provenance: {
      source: FIXTURE_SOURCE,
      identity: 'raw-markdown',
      attributes: 'derived',
      seed: FIXTURE_DERIVATION_SEED,
      version: FIXTURE_DERIVATION_VERSION,
    },
  };
}

export function defaultLineup(club: Club, players: readonly Player[]): Lineup {
  return autoSelectLineup({ club, players, formation: '4-4-2', mode: 'best' });
}
export { defaultTactic } from './tactics.js';
