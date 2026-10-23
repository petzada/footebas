/* eslint-disable @typescript-eslint/no-non-null-assertion -- fixed-size synthetic fixture */
// Synthetic match input for engine tests (not exported by the package).
import {
  createClub,
  createLineup,
  createMatchInput,
  createPlayer,
  createTactic,
  entityId,
  money,
  percentage,
  strength,
  type Formation,
  type MatchInput,
  type Mentality,
  type Player,
  type Position,
  FORMATION_POSITIONS,
} from '@footebas/domain';
import { ENGINE_VERSION } from './match.js';

const slots: readonly Position[] = [
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

export function syntheticMatch(
  seed: string,
  homeStrength = 70,
  awayStrength = 70,
  options: {
    homeFormation?: Formation;
    awayFormation?: Formation;
    homeMentality?: Mentality;
    awayMentality?: Mentality;
    homeDirection?: 'center' | 'wings';
    homeMarking?: 'light' | 'heavy' | 'very_heavy';
  } = {},
): MatchInput {
  function side(label: 'home' | 'away', value: number) {
    const clubId = entityId(`${label}_club`, 'club');
    const formation =
      label === 'home'
        ? (options.homeFormation ?? '4-4-2')
        : (options.awayFormation ?? '4-4-2');
    const players: Player[] = Array.from({ length: 16 }, (_, index) =>
      createPlayer({
        id: entityId(`${label}_player_${String(index)}`, 'player'),
        name: `${label} ${String(index)}`,
        age: 25,
        position:
          index < 11 ? slots[index]! : index === 11 ? 'GK' : slots[index - 5]!,
        secondaryPositions:
          index < 11 && slots[index] !== 'GK'
            ? [slots[index] === 'CM' ? 'AM' : 'CM']
            : [],
        strength: strength(value),
        traits:
          index % 3 === 0
            ? ['passing', 'playmaking']
            : index % 3 === 1
              ? ['pace', 'crossing']
              : ['finishing', 'heading'],
        hidden: {
          potential: percentage(70),
          consistency: percentage(70),
          injuryProneness: percentage(20),
          adaptation: percentage(70),
          professionalism: percentage(70),
          bigGame: percentage(60),
        },
        morale: percentage(80),
        condition: percentage(90),
        matchSharpness: percentage(85),
        value: money(1_000_000),
        salary: money(10_000),
        clubId,
        squadStatus: index < 11 ? 'starter' : 'rotation',
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
    const mentality =
      label === 'home'
        ? (options.homeMentality ?? 'balanced')
        : (options.awayMentality ?? 'balanced');
    return {
      club: createClub({
        id: clubId,
        name: label,
        shortName: label,
        squad: players.map(({ id }) => id),
        balance: money(0),
        reputation: percentage(50),
      }),
      players,
      lineup: createLineup({
        clubId,
        starters: players.slice(0, 11).map((player, index) => ({
          playerId: player.id,
          position: FORMATION_POSITIONS[formation][index]!,
        })),
        substitutes: players.slice(11).map(({ id }) => id),
        captainId: players[0]!.id,
      }),
      tactic: createTactic({
        formation,
        mentality,
        attackDirection:
          label === 'home' ? (options.homeDirection ?? 'center') : 'center',
        marking: label === 'home' ? (options.homeMarking ?? 'heavy') : 'heavy',
      }),
    };
  }
  return createMatchInput({
    fixtureId: entityId('fixture_test', 'fixture'),
    seed,
    engineVersion: ENGINE_VERSION,
    rulesVersion: 'rules-v1',
    home: side('home', homeStrength),
    away: side('away', awayStrength),
  });
}
