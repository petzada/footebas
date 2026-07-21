import {
  canonicalJson,
  createClub,
  createLineup,
  createMatchInput,
  createPlayer,
  createTactic,
  entityId,
  money,
  percentage,
  strength,
  type Club,
  type Formation,
  type Lineup,
  type MatchInput,
  type Player,
  type Position,
  type Tactic,
} from '@footebas/domain';

export const TEST_SEEDS = Object.freeze({
  goldenMatch: 'golden-match-v1',
  phaseZeroSmoke: 'phase-zero-smoke-v1',
  syntheticSeason: 'synthetic-season-v1',
  calibration: 'phase-one-calibration-v1',
});
export const FACTORY_VERSION = 'testing-factories-v1' as const;

export function expectCanonicalEquivalent(left: unknown, right: unknown): void {
  if (canonicalJson(left) !== canonicalJson(right))
    throw new Error(
      `Canonical values differ:\n${canonicalJson(left)}\n${canonicalJson(right)}`,
    );
}

function hash(text: string): number {
  let value = 2166136261;
  for (const character of text) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

export interface PlayerFactoryOptions {
  readonly key?: string;
  readonly name?: string;
  readonly clubKey?: string;
  readonly position?: Position;
  readonly strength?: number;
}
export function playerFactory(options: PlayerFactoryOptions = {}): Player {
  const key = options.key ?? 'player_01';
  const clubKey = options.clubKey ?? 'club_home';
  const jitter = hash(`${FACTORY_VERSION}|${key}`) % 9;
  return createPlayer({
    id: entityId(key, 'player'),
    name: options.name ?? `Test ${key}`,
    age: 20 + (hash(key) % 14),
    position: options.position ?? 'CM',
    secondaryPositions: [],
    strength: strength(options.strength ?? 66 + jitter),
    traits: [],
    hidden: {
      potential: percentage(60 + jitter),
      consistency: percentage(65 + jitter),
      injuryProneness: percentage(10 + jitter),
      adaptation: percentage(70),
      professionalism: percentage(70),
      bigGame: percentage(60 + jitter),
    },
    morale: percentage(75),
    condition: percentage(92),
    matchSharpness: percentage(85),
    value: money(1_000_000 + jitter * 100_000),
    salary: money(50_000 + jitter * 1_000),
    clubId: entityId(clubKey, 'club'),
    squadStatus: 'listed',
    injuryRounds: 0,
    suspensionRounds: 0,
    careerStats: {
      appearances: 0,
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
    },
  });
}

const FORMATION_POSITIONS: Readonly<Record<Formation, readonly Position[]>> = {
  '4-4-2': ['GK', 'RB', 'CB', 'CB', 'LB', 'CM', 'CM', 'RW', 'LW', 'ST', 'ST'],
  '4-3-3': ['GK', 'RB', 'CB', 'CB', 'LB', 'DM', 'CM', 'AM', 'RW', 'LW', 'ST'],
  '3-5-2': ['GK', 'CB', 'CB', 'CB', 'RB', 'LB', 'DM', 'CM', 'AM', 'ST', 'ST'],
};
export interface SquadFactory {
  readonly club: Club;
  readonly players: readonly Player[];
  readonly lineup: Lineup;
}
export function squadFactory(
  key = 'club_home',
  averageStrength = 72,
  formation: Formation = '4-3-3',
): SquadFactory {
  const positions = [
    ...FORMATION_POSITIONS[formation],
    'GK',
    'CB',
    'CM',
    'RW',
    'ST',
  ] as const;
  const players = positions.map((position, index) =>
    playerFactory({
      key: `${key}_p${String(index + 1).padStart(2, '0')}`,
      clubKey: key,
      position,
      strength: Math.max(1, Math.min(100, averageStrength + (index % 5) - 2)),
    }),
  );
  const club = createClub({
    id: entityId(key, 'club'),
    name: `Test ${key}`,
    shortName: key.slice(0, 10),
    squad: players.map(({ id }) => id),
    balance: money(100_000_000),
    reputation: percentage(averageStrength),
  });
  const captain = players.at(0);
  if (captain === undefined)
    throw new Error('Factory formation must contain players');
  const lineup = createLineup({
    clubId: club.id,
    starters: players.slice(0, 11).map((player, index) => ({
      playerId: player.id,
      position: FORMATION_POSITIONS[formation][index] ?? player.position,
    })),
    substitutes: players.slice(11).map(({ id }) => id),
    captainId: captain.id,
  });
  return { club, players, lineup };
}
export function tacticFactory(overrides: Partial<Tactic> = {}): Tactic {
  return createTactic({
    formation: '4-3-3',
    mentality: 'balanced',
    attackDirection: 'center',
    marking: 'heavy',
    ...overrides,
  });
}
export interface MatchInputFactoryOptions {
  readonly seed?: string;
  readonly homeStrength?: number;
  readonly awayStrength?: number;
  readonly homeTactic?: Partial<Tactic>;
  readonly awayTactic?: Partial<Tactic>;
}
export function matchInputFactory(
  options: MatchInputFactoryOptions = {},
): MatchInput {
  const homeTactic = tacticFactory(options.homeTactic);
  const awayTactic = tacticFactory(options.awayTactic);
  const home = squadFactory(
    'club_home',
    options.homeStrength ?? 72,
    homeTactic.formation,
  );
  const away = squadFactory(
    'club_away',
    options.awayStrength ?? 72,
    awayTactic.formation,
  );
  return createMatchInput({
    fixtureId: entityId('fixture_calibration', 'fixture'),
    seed: options.seed ?? TEST_SEEDS.goldenMatch,
    engineVersion: 'match-v1',
    rulesVersion: 'rules-v1',
    home: { ...home, tactic: homeTactic },
    away: { ...away, tactic: awayTactic },
  });
}
