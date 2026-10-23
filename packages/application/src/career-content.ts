import { loadCatalog, type ContentCatalog } from '@footebas/content';
import {
  createClub,
  createPlayer,
  entityId,
  money,
  percentage,
  strength,
  type Club,
  type ClubId,
  type Player,
  type Position,
} from '@footebas/domain';
import type { MvpCompetitionConfig, MvpDivisionId } from '@footebas/engine';

/** Everything a new career needs, already shaped as domain entities. */
export interface CareerContent {
  readonly version: string;
  readonly clubs: readonly Club[];
  readonly players: readonly Player[];
  readonly competitions: MvpCompetitionConfig;
  readonly divisions: Readonly<Record<MvpDivisionId, readonly ClubId[]>>;
  readonly continentalDirect: readonly ClubId[];
  readonly continentalPreliminary: readonly ClubId[];
}

export interface CareerContentPort {
  load(): CareerContent;
}

/** Initial club cash in BRL by strength tier of the glue file. */
const BALANCE_BY_TIER: Readonly<Record<string, number>> = {
  'S+': 250_000_000,
  S: 150_000_000,
  A: 90_000_000,
  B: 50_000_000,
  'B+': 25_000_000,
  C: 15_000_000,
  'C+': 12_000_000,
  D: 6_000_000,
  E: 2_500_000,
};

const SECONDARY: Readonly<Record<Position, readonly Position[]>> = {
  GK: [],
  CB: ['DM'],
  LB: ['LW'],
  RB: ['RW'],
  DM: ['CM'],
  CM: ['AM'],
  AM: ['CM'],
  LW: ['ST'],
  RW: ['ST'],
  ST: ['AM'],
};

const centavos = (brl: number) => money(Math.round(brl * 100));

export function careerContentFromCatalog(
  catalog: ContentCatalog,
): CareerContent {
  const players: Player[] = [];
  const clubs = catalog.clubs.map((club) => {
    const roster = catalog.players
      .filter(({ clubId }) => clubId === club.id)
      .sort(
        (left, right) =>
          right.derived.strength - left.derived.strength ||
          left.id.localeCompare(right.id),
      );
    roster.forEach((player, depth) =>
      players.push(
        createPlayer({
          id: entityId(player.id, 'player'),
          name: player.name,
          age: player.derived.age,
          position: player.position,
          secondaryPositions: SECONDARY[player.position],
          ...(player.preferredSide === undefined
            ? {}
            : { preferredSide: player.preferredSide }),
          strength: strength(player.derived.strength),
          traits: player.derived.traits,
          hidden: {
            potential: percentage(player.derived.potential),
            consistency: percentage(player.derived.consistency),
            injuryProneness: percentage(
              Math.round(player.derived.injuryProneness / 3),
            ),
            adaptation: percentage(player.derived.adaptation),
            professionalism: percentage(player.derived.professionalism),
            bigGame: percentage(player.derived.bigGame),
          },
          morale: percentage(70),
          condition: percentage(100),
          matchSharpness: percentage(75),
          value: centavos(player.derived.valueBrl),
          salary: centavos(player.derived.monthlyWageBrl),
          clubId: entityId(club.id, 'club'),
          squadStatus:
            depth < 11 ? 'starter' : depth < 18 ? 'rotation' : 'backup',
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
      ),
    );
    const mean =
      roster.reduce((sum, { derived }) => sum + derived.strength, 0) /
      Math.max(1, roster.length);
    return createClub({
      id: entityId(club.id, 'club'),
      name: club.name,
      shortName: club.shortName,
      squad: roster.map(({ id }) => entityId(id, 'player')),
      balance: centavos(BALANCE_BY_TIER[club.tier] ?? 2_500_000),
      reputation: percentage(Math.round(mean)),
    });
  });
  const divisions = Object.fromEntries(
    (['serie-a', 'serie-b', 'serie-c'] as const).map((division) => [
      division,
      catalog.clubs
        .filter((club) => club.division === division)
        .map(({ id }) => entityId(id, 'club')),
    ]),
  ) as unknown as Record<MvpDivisionId, readonly ClubId[]>;
  return {
    version: catalog.contentVersion,
    clubs,
    players,
    competitions: catalog.competitions,
    divisions,
    continentalDirect:
      catalog.competitions.continental.initialDirectClubIds.map((id) =>
        entityId(id, 'club'),
      ),
    continentalPreliminary:
      catalog.competitions.continental.initialPreliminaryClubIds.map((id) =>
        entityId(id, 'club'),
      ),
  };
}

let launch: CareerContent | undefined;

/** Launch content built once per process from the embedded catalog. */
export const catalogCareerContent: CareerContentPort = {
  load() {
    launch ??= careerContentFromCatalog(loadCatalog());
    return launch;
  },
};
