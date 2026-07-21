/* eslint-disable @typescript-eslint/no-non-null-assertion -- fixture cardinality is constructed locally */
import {
  createClub,
  createLineup,
  createPlayer,
  createTactic,
  entityId,
  money,
  percentage,
  strength,
  type Club,
  type Lineup,
  type Player,
  type Position,
  type Tactic,
} from '@footebas/domain';

const CLUB_NAMES = [
  'Aurora',
  'Bandeirantes',
  'Cruzeiro do Sul',
  'Dourados',
  'Estrela',
  'Ferroviario',
  'Guanabara',
  'Horizonte',
] as const;
const POSITIONS: readonly Position[] = [
  'GK',
  'GK',
  'RB',
  'RB',
  'CB',
  'CB',
  'CB',
  'CB',
  'LB',
  'LB',
  'DM',
  'DM',
  'CM',
  'CM',
  'CM',
  'AM',
  'AM',
  'RW',
  'RW',
  'LW',
  'LW',
  'ST',
  'ST',
  'ST',
  'ST',
];

export interface FixtureContent {
  readonly clubs: readonly Club[];
  readonly players: readonly Player[];
}

export function createFixtureContent(): FixtureContent {
  const clubs: Club[] = [];
  const players: Player[] = [];
  CLUB_NAMES.forEach((name, clubIndex) => {
    const clubId = entityId(`club_${String(clubIndex + 1)}`, 'club');
    const squad = POSITIONS.map((position, playerIndex) => {
      const id = entityId(
        `player_${String(clubIndex + 1)}_${String(playerIndex + 1)}`,
        'player',
      );
      players.push(
        createPlayer({
          id,
          name: `Jogador ${String(clubIndex + 1)}-${String(playerIndex + 1)}`,
          age: 19 + (playerIndex % 15),
          position,
          secondaryPositions: [],
          strength: strength(55 + ((clubIndex * 3 + playerIndex) % 26)),
          traits: [],
          hidden: {
            potential: percentage(60),
            consistency: percentage(70),
            injuryProneness: percentage(15),
            adaptation: percentage(70),
            professionalism: percentage(75),
            bigGame: percentage(60),
          },
          morale: percentage(70),
          condition: percentage(100),
          matchSharpness: percentage(75),
          value: money(1_000_000),
          salary: money(10_000),
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
        name,
        shortName: name.slice(0, 3).toUpperCase(),
        squad,
        balance: money(20_000_000),
        reputation: percentage(50 + clubIndex * 5),
      }),
    );
  });
  return { clubs, players };
}

export function defaultLineup(club: Club, players: readonly Player[]): Lineup {
  const available = players.filter(({ clubId }) => clubId === club.id);
  const wanted: readonly Position[] = [
    'GK',
    'RB',
    'CB',
    'CB',
    'LB',
    'CM',
    'CM',
    'RW',
    'LW',
    'ST',
    'ST',
  ];
  const used = new Set<string>();
  const starters = wanted.map((position) => {
    const player =
      available.find(
        (candidate) =>
          candidate.position === position && !used.has(candidate.id),
      ) ?? available.find(({ id }) => !used.has(id));
    if (!player) throw new Error('fixture squad cannot form a lineup');
    used.add(player.id);
    return { playerId: player.id, position };
  });
  const substitutes = available
    .filter(({ id }) => !used.has(id))
    .slice(0, 7)
    .map(({ id }) => id);
  return createLineup({
    clubId: club.id,
    starters,
    substitutes,
    captainId: starters[0]!.playerId,
  });
}
export function defaultTactic(): Tactic {
  return createTactic({
    formation: '4-4-2',
    mentality: 'balanced',
    attackDirection: 'center',
    marking: 'heavy',
  });
}
