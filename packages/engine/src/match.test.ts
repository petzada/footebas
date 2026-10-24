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
  type MatchEvent,
  type MatchInput,
  type Mentality,
  type Player,
  type Position,
  FORMATION_POSITIONS,
} from '@footebas/domain';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  calculateEffectiveStrength,
  calculateMatchExpectation,
  calculateMatchup,
  ENGINE_VERSION,
  simulateMatch,
} from './index.js';

// Monte Carlo de milhares de partidas (~15 s nesta suíte): o pre-push local pula com
// FOOTEBAS_SKIP_SLOW=1; o CI roda sempre.
// O engine não tem tipos do Node: lê o ambiente do processo do vitest via globalThis.
const env = (
  globalThis as { process?: { env: Record<string, string | undefined> } }
).process?.env;
const slowIt = env?.FOOTEBAS_SKIP_SLOW === '1' ? it.skip : it;

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

describe('simulateMatch', () => {
  // Golden regenerated explicitly for match-v4 (ADR 0015): minute-by-minute
  // engine with day form, named shooters and play types. v3 values: 0 × 2,
  // 7 × 19 shots, 40 events.
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
        "events": 43,
        "first": [
          {
            "assistId": "home_player_10",
            "minute": 11,
            "outcome": "saved",
            "play": "individual",
            "playerId": "home_player_7",
            "side": "home",
            "type": "chance",
            "xg": 0.134,
          },
          {
            "minute": 13,
            "outcome": "goal",
            "play": "build_up",
            "playerId": "home_player_3",
            "side": "home",
            "type": "chance",
            "xg": 0.489,
          },
          {
            "minute": 13,
            "play": "build_up",
            "scorerId": "home_player_3",
            "side": "home",
            "type": "goal",
          },
          {
            "assistId": "home_player_5",
            "minute": 17,
            "outcome": "off_target",
            "play": "build_up",
            "playerId": "home_player_10",
            "side": "home",
            "type": "chance",
            "xg": 0.474,
          },
        ],
        "score": [
          4,
          3,
        ],
        "shots": [
          13,
          17,
        ],
        "xg": [
          3.093,
          2.578,
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

  slowIt('shows monotonic favoritism while preserving upsets', () => {
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

  slowIt(
    'makes home advantage and tactical choices measurable without certainty',
    () => {
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
        const balanced = simulateMatch(
          match(`tactic-${String(index)}`, 70, 70),
        );
        attackingGoals += attack.homeGoals;
        balancedGoals += balanced.homeGoals;
        if (attack.homeGoals < attack.awayGoals) attackLosses += 1;
        lightCards += simulateMatch(
          match(`cards-${String(index)}`, 70, 70, { homeMarking: 'light' }),
        ).home.yellowCards;
        heavyCards += simulateMatch(
          match(`cards-${String(index)}`, 70, 70, {
            homeMarking: 'very_heavy',
          }),
        ).home.yellowCards;
      }
      expect(homePoints).toBeGreaterThan(awayPoints);
      expect(attackingGoals).toBeGreaterThan(balancedGoals);
      expect(attackLosses).toBeGreaterThan(0);
      expect(heavyCards).toBeGreaterThan(lightCards);
    },
  );

  it('gives decisive (high big-game) forwards a damped edge in goals', () => {
    // match-v4 (ADR 0015): big-game still helps, but it no longer
    // monopolises finishing (v3 required star > other × 1.4).
    const decisive = (seed: string) => {
      const input = match(seed);
      const tune = (player: Player) =>
        player.id === 'home_player_9' || player.id === 'home_player_10'
          ? createPlayer({
              ...player,
              hidden: {
                ...player.hidden,
                bigGame: percentage(player.id === 'home_player_9' ? 95 : 30),
              },
            })
          : player;
      return createMatchInput({
        ...input,
        home: { ...input.home, players: input.home.players.map(tune) },
      });
    };
    let star = 0;
    let other = 0;
    for (let index = 0; index < 400; index++)
      for (const event of simulateMatch(decisive(`decisive-${String(index)}`))
        .timeline)
        if (event.type === 'goal') {
          if (event.scorerId === 'home_player_9') star++;
          if (event.scorerId === 'home_player_10') other++;
        }
    expect(star).toBeGreaterThan(other * 1.05);
    expect(star).toBeLessThan(other * 1.6);
  });

  it('keeps finishing spread across the side (no monopoly)', () => {
    const goalsBy = new Map<string, number>();
    let teamGoals = 0;
    let hatTricks = 0;
    const matches = 400;
    for (let index = 0; index < matches; index++) {
      const input = match(`spread-${String(index)}`, 72, 72);
      const tuned = createMatchInput({
        ...input,
        home: {
          ...input.home,
          players: input.home.players.map((player) =>
            player.id === 'home_player_9'
              ? createPlayer({
                  ...player,
                  strength: strength(90),
                  hidden: { ...player.hidden, bigGame: percentage(95) },
                })
              : player,
          ),
        },
      });
      const perMatch = new Map<string, number>();
      for (const event of simulateMatch(tuned).timeline)
        if (event.type === 'goal' && event.side === 'home') {
          teamGoals++;
          goalsBy.set(event.scorerId, (goalsBy.get(event.scorerId) ?? 0) + 1);
          perMatch.set(event.scorerId, (perMatch.get(event.scorerId) ?? 0) + 1);
        }
      if ([...perMatch.values()].some((goals) => goals >= 3)) hatTricks++;
    }
    const shares = [...goalsBy.values()].map((goals) => goals / teamGoals);
    const hhi = shares.reduce((sum, share) => sum + share ** 2, 0);
    // The 90-rated, decisive striker leads, without taking over.
    expect(goalsBy.get('home_player_9')! / teamGoals).toBeLessThan(0.33);
    expect(Math.max(...shares)).toBe(goalsBy.get('home_player_9')! / teamGoals);
    expect(hhi).toBeLessThan(0.17);
    expect(goalsBy.size).toBeGreaterThanOrEqual(10);
    expect(hatTricks / matches).toBeLessThan(0.05);
  });

  it('names shooters and builds chances in varied ways', () => {
    const plays = new Map<string, number>();
    let counterNormal = 0;
    let counterReactive = 0;
    for (let index = 0; index < 150; index++) {
      for (const event of simulateMatch(match(`plays-${String(index)}`))
        .timeline) {
        if (event.type !== 'chance') continue;
        expect(event.playerId).toBeDefined();
        expect(event.outcome).toBeDefined();
        plays.set(event.play!, (plays.get(event.play!) ?? 0) + 1);
        if (event.side === 'home' && event.play === 'counter') counterNormal++;
      }
      for (const event of simulateMatch(
        match(`plays-${String(index)}`, 70, 70, {
          homeMentality: 'counter_attack',
          awayMentality: 'all_out_attack',
        }),
      ).timeline)
        if (
          event.type === 'chance' &&
          event.side === 'home' &&
          event.play === 'counter'
        )
          counterReactive++;
    }
    expect([...plays.keys()].sort()).toEqual([
      'build_up',
      'counter',
      'cross',
      'defensive_error',
      'individual',
      'long_shot',
    ]);
    expect(counterReactive).toBeGreaterThan(counterNormal * 1.5);
  });

  it('varies the pre-match expectation by the day form, not the nominal matchup', () => {
    const expectations = Array.from(
      { length: 40 },
      (_, index) =>
        calculateMatchExpectation(match(`form-${String(index)}`, 72, 72))
          .expectedGoals.home,
    );
    const nominal = Array.from(
      { length: 5 },
      (_, index) =>
        calculateMatchup(match(`form-${String(index)}`, 72, 72)).expectedGoals
          .home,
    );
    expect(new Set(nominal).size).toBe(1);
    expect(new Set(expectations).size).toBeGreaterThan(30);
    expect(Math.max(...expectations) - Math.min(...expectations)).toBeLessThan(
      0.9,
    );
    expect(calculateMatchExpectation(match('form-0', 72, 72))).toEqual(
      calculateMatchExpectation(match('form-0', 72, 72)),
    );
  });

  it('keeps everything up to minute m unchanged for an instruction at any minute m', () => {
    const managerEvent = (event: MatchEvent) =>
      event.type === 'tactical_change' ||
      (event.type === 'substitution' && event.source === 'manager');
    let changedLater = 0;
    for (let index = 0; index < 80; index++) {
      const input = match(`prefix-${String(index)}`, 72, 70);
      const minute = 1 + ((index * 37) % 92);
      const before = (events: readonly MatchEvent[]) =>
        events.filter(
          (event) => event.minute <= minute && !managerEvent(event),
        );
      const plain = simulateMatch(input);
      const decided = simulateMatch(
        createMatchInput({
          ...input,
          instructions:
            index % 2 === 0
              ? [
                  {
                    type: 'substitution',
                    minute,
                    side: 'home',
                    playerOutId: input.home.lineup.starters[9]!.playerId,
                    playerInId: input.home.lineup.substitutes[0]!,
                    position: 'ST',
                  },
                ]
              : [
                  {
                    type: 'tactical_change',
                    minute,
                    side: 'home',
                    tactic: createTactic({
                      ...input.home.tactic,
                      mentality: 'all_out_attack',
                      press: 'high',
                    }),
                  },
                ],
        }),
      );
      expect(before(decided.timeline)).toEqual(before(plain.timeline));
      // The decision appears right after everything already played at m.
      // (A substitution is skipped when an automatic change or a red card
      // already took one of the players off before m.)
      const firstManager = decided.timeline.findIndex(managerEvent);
      if (firstManager >= 0) {
        expect(decided.timeline[firstManager]!.minute).toBe(minute);
        expect(
          decided.timeline
            .slice(firstManager + 1)
            .every((event) => event.minute > minute),
        ).toBe(true);
      }
      if (JSON.stringify(decided.timeline) !== JSON.stringify(plain.timeline))
        changedLater++;
    }
    expect(changedLater).toBeGreaterThan(60);
  });

  it('accepts instructions at any whole minute and rejects the rest', () => {
    const input = match('minutes');
    const at = (minute: number) =>
      createMatchInput({
        ...input,
        instructions: [
          {
            type: 'substitution',
            minute,
            side: 'home',
            playerOutId: input.home.lineup.starters[9]!.playerId,
            playerInId: input.home.lineup.substitutes[0]!,
            position: 'ST',
          },
        ],
      });
    for (const minute of [0, 1, 37, 45, 52, 89, 93])
      expect(() => simulateMatch(at(minute))).not.toThrow();
    for (const minute of [-1, 94, 12.5]) expect(() => at(minute)).toThrow();
  });
});
