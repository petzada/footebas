/* eslint-disable @typescript-eslint/no-non-null-assertion -- fixed-size synthetic fixture */
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
} from '@footebas/domain';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  calculateEffectiveStrength,
  calculateMatchup,
  ENGINE_VERSION,
  simulateMatch,
} from './index.js';

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

function match(
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
    const formation =
      label === 'home'
        ? (options.homeFormation ?? '4-4-2')
        : (options.awayFormation ?? '4-4-2');
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
          position: slots[index]!,
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

describe('simulateMatch', () => {
  it('keeps a golden result stable by seed', () => {
    const result = simulateMatch(match('golden-match-v1', 76, 68));
    expect({
      score: [result.homeGoals, result.awayGoals],
      shots: [result.home.shots, result.away.shots],
      xg: [result.home.xg, result.away.xg],
      events: result.timeline.length,
      first: result.timeline.slice(0, 4),
    }).toMatchInlineSnapshot(`
      {
        "events": 36,
        "first": [
          {
            "minute": 3,
            "side": "home",
            "type": "chance",
            "xg": 0.252,
          },
          {
            "minute": 4,
            "side": "home",
            "type": "chance",
            "xg": 0.097,
          },
          {
            "minute": 6,
            "side": "home",
            "type": "chance",
            "xg": 0.037,
          },
          {
            "minute": 18,
            "side": "home",
            "type": "chance",
            "xg": 0.186,
          },
        ],
        "score": [
          2,
          2,
        ],
        "shots": [
          13,
          11,
        ],
        "xg": [
          2.2,
          1.711,
        ],
      }
    `);
  });

  it('is deterministic and maintains domain invariants for generated inputs', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.integer({ min: 45, max: 95 }),
        fc.integer({ min: 45, max: 95 }),
        (seed, home, away) => {
          const input = match(seed, home, away);
          const left = simulateMatch(input);
          const right = simulateMatch(input);
          expect(left).toEqual(right);
          expect(left.home.possession + left.away.possession).toBe(100);
          expect(left.home.shotsOnTarget).toBeLessThanOrEqual(left.home.shots);
          expect(left.away.shotsOnTarget).toBeLessThanOrEqual(left.away.shots);
          expect(
            left.timeline.every(
              (event, index) =>
                index === 0 || event.minute >= left.timeline[index - 1]!.minute,
            ),
          ).toBe(true);
        },
      ),
      { numRuns: 120 },
    );
  });

  it('penalizes improvisation and exposes calibration calculations immutably', () => {
    const input = match('fit');
    const normal = calculateEffectiveStrength(input.home);
    const improvised = calculateEffectiveStrength({
      ...input.home,
      lineup: {
        ...input.home.lineup,
        starters: input.home.lineup.starters.map((slot, index) =>
          index === 1 ? { ...slot, position: 'GK' } : slot,
        ),
      },
    });
    expect(improvised.average).toBeLessThan(normal.average);
    expect(Object.isFrozen(calculateMatchup(input))).toBe(true);
  });

  it('gives every formation and mentality a bounded, measurable profile', () => {
    const formations = ['4-4-2', '4-3-3', '3-5-2'] as const;
    const mentalities = [
      'balanced',
      'all_out_attack',
      'counter_attack',
    ] as const;
    const formationProfiles = formations.map(
      (homeFormation) =>
        calculateMatchup(
          match(`formation-${homeFormation}`, 70, 70, { homeFormation }),
        ).home,
    );
    const mentalityProfiles = mentalities.map((homeMentality) =>
      calculateMatchup(
        match(`mentality-${homeMentality}`, 70, 70, {
          homeMentality,
          awayMentality: 'all_out_attack',
        }),
      ),
    );
    expect(
      new Set(
        formationProfiles.map(
          ({ attack, control }) => `${String(attack)}:${String(control)}`,
        ),
      ).size,
    ).toBe(3);
    expect(mentalityProfiles[1]!.home.attack).toBeGreaterThan(
      mentalityProfiles[0]!.home.attack,
    );
    expect(mentalityProfiles[2]!.home.defense).toBeGreaterThan(
      mentalityProfiles[0]!.home.defense,
    );
    expect(mentalityProfiles[2]!.expectedGoals.home).toBeGreaterThan(1);
  });

  it('shows monotonic favoritism while preserving upsets', () => {
    const bands = [
      [55, 75],
      [65, 75],
      [75, 75],
      [85, 75],
    ] as const;
    const rates = bands.map(([home, away], band) => {
      let points = 0;
      let upsets = 0;
      const games = 700;
      for (let index = 0; index < games; index += 1) {
        const result = simulateMatch(
          match(`band-${String(band)}-${String(index)}`, home, away),
        );
        points +=
          result.homeGoals > result.awayGoals
            ? 3
            : result.homeGoals === result.awayGoals
              ? 1
              : 0;
        if (home >= 85 && result.awayGoals > result.homeGoals) upsets += 1;
      }
      if (home >= 85) expect(upsets).toBeGreaterThan(0);
      return points / games;
    });
    expect(rates[0]).toBeLessThan(rates[1]!);
    expect(rates[1]).toBeLessThan(rates[2]!);
    expect(rates[2]).toBeLessThan(rates[3]!);
  });

  it('makes home advantage and tactical choices measurable without certainty', () => {
    let homePoints = 0;
    let awayPoints = 0;
    let attackingGoals = 0;
    let balancedGoals = 0;
    let attackLosses = 0;
    let lightCards = 0;
    let heavyCards = 0;
    for (let index = 0; index < 900; index += 1) {
      const a = simulateMatch(match(`venue-${String(index)}`));
      homePoints +=
        a.homeGoals > a.awayGoals ? 3 : a.homeGoals === a.awayGoals ? 1 : 0;
      awayPoints +=
        a.awayGoals > a.homeGoals ? 3 : a.homeGoals === a.awayGoals ? 1 : 0;
      const attack = simulateMatch(
        match(`tactic-${String(index)}`, 70, 70, {
          homeMentality: 'all_out_attack',
          homeFormation: '4-3-3',
          homeDirection: 'wings',
        }),
      );
      const balanced = simulateMatch(match(`tactic-${String(index)}`, 70, 70));
      attackingGoals += attack.homeGoals;
      balancedGoals += balanced.homeGoals;
      if (attack.homeGoals < attack.awayGoals) attackLosses += 1;
      lightCards += simulateMatch(
        match(`cards-${String(index)}`, 70, 70, { homeMarking: 'light' }),
      ).home.yellowCards;
      heavyCards += simulateMatch(
        match(`cards-${String(index)}`, 70, 70, { homeMarking: 'very_heavy' }),
      ).home.yellowCards;
    }
    expect(homePoints).toBeGreaterThan(awayPoints);
    expect(attackingGoals).toBeGreaterThan(balancedGoals);
    expect(attackLosses).toBeGreaterThan(0);
    expect(heavyCards).toBeGreaterThan(lightCards);
  });
});
