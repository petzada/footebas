/* eslint-disable @typescript-eslint/no-non-null-assertion -- lineup cardinalities are domain-validated */
import {
  createMatchInput,
  createMatchResult,
  entityId,
  type LineupSlot,
  type MatchEvent,
  type MatchInstruction,
  type MatchInput,
  type MatchResult,
  type MatchSide,
  type Player,
  type PlayerId,
  type Position,
} from '@footebas/domain';
import { createPrng, hashSeed, type Prng } from './prng.js';

export const ENGINE_VERSION = 'match-v3' as const;
export const POSITION_SUITABILITY = Object.freeze({
  primary: 1,
  secondary: 0.92,
  improvised: 0.72,
} as const);
type MatchSideInput = MatchInput['home'];

export interface EffectiveStrength {
  readonly total: number;
  readonly average: number;
  readonly positionalSuitability: number;
  readonly condition: number;
  readonly morale: number;
  readonly sharpness: number;
  readonly formationCoherence: number;
}

export interface SideCalculation {
  readonly effective: EffectiveStrength;
  readonly attack: number;
  readonly defense: number;
  readonly control: number;
  readonly discipline: number;
}

export interface MatchupCalculation {
  readonly home: SideCalculation;
  readonly away: SideCalculation;
  readonly expectedGoals: Readonly<{ home: number; away: number }>;
  readonly possession: Readonly<{ home: number; away: number }>;
}

const round = (value: number, digits = 3): number =>
  Number(value.toFixed(digits));
const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(maximum, value));

function playerFor(side: MatchSideInput, id: PlayerId): Player {
  const player = side.players.find((candidate) => candidate.id === id);
  if (player === undefined)
    throw new Error(`Lineup player ${id} is absent from snapshot`);
  return player;
}

function suitability(player: Player, slot: LineupSlot): number {
  if (player.position === slot.position) return POSITION_SUITABILITY.primary;
  if (player.secondaryPositions.includes(slot.position))
    return POSITION_SUITABILITY.secondary;
  return POSITION_SUITABILITY.improvised;
}

function formationCoherence(side: MatchSideInput): number {
  const counts = new Map<Position, number>();
  for (const slot of side.lineup.starters)
    counts.set(slot.position, (counts.get(slot.position) ?? 0) + 1);
  const defenders =
    (counts.get('RB') ?? 0) + (counts.get('CB') ?? 0) + (counts.get('LB') ?? 0);
  const midfielders =
    (counts.get('DM') ?? 0) + (counts.get('CM') ?? 0) + (counts.get('AM') ?? 0);
  const attackers =
    (counts.get('RW') ?? 0) + (counts.get('LW') ?? 0) + (counts.get('ST') ?? 0);
  const expected: readonly [number, number, number] =
    side.tactic.formation === '4-4-2'
      ? [4, 4, 2]
      : side.tactic.formation === '4-3-3'
        ? [4, 3, 3]
        : [3, 5, 2];
  const [expectedDefenders, expectedMidfielders, expectedAttackers] = expected;
  const distance =
    Math.abs(defenders - expectedDefenders) +
    Math.abs(midfielders - expectedMidfielders) +
    Math.abs(attackers - expectedAttackers);
  return clamp(1 - distance * 0.035, 0.78, 1);
}

export function calculateEffectiveStrength(
  side: MatchSideInput,
): EffectiveStrength {
  let weighted = 0;
  let positionTotal = 0;
  let conditionTotal = 0;
  let moraleTotal = 0;
  let sharpnessTotal = 0;
  for (const slot of side.lineup.starters) {
    const player = playerFor(side, slot.playerId);
    const fit = suitability(player, slot);
    const condition = 0.78 + Number(player.condition) * 0.0022;
    const morale = 0.88 + Number(player.morale) * 0.0012;
    const sharpness = 0.86 + Number(player.matchSharpness) * 0.0014;
    weighted += Number(player.strength) * fit * condition * morale * sharpness;
    positionTotal += fit;
    conditionTotal += Number(player.condition);
    moraleTotal += Number(player.morale);
    sharpnessTotal += Number(player.matchSharpness);
  }
  const coherence = formationCoherence(side);
  const average = (weighted / 11) * coherence;
  return Object.freeze({
    total: round(average * 11),
    average: round(average),
    positionalSuitability: round(positionTotal / 11),
    condition: round(conditionTotal / 11),
    morale: round(moraleTotal / 11),
    sharpness: round(sharpnessTotal / 11),
    formationCoherence: round(coherence),
  });
}

function traitCount(side: MatchSideInput, traits: readonly string[]): number {
  return side.lineup.starters.reduce(
    (sum, slot) =>
      sum +
      playerFor(side, slot.playerId).traits.filter((trait) =>
        traits.includes(trait),
      ).length,
    0,
  );
}

function sideCalculation(side: MatchSideInput): SideCalculation {
  const effective = calculateEffectiveStrength(side);
  const mentalityAttack =
    side.tactic.mentality === 'all_out_attack'
      ? 1.13
      : side.tactic.mentality === 'counter_attack'
        ? 0.96
        : 1;
  const mentalityDefense =
    side.tactic.mentality === 'all_out_attack'
      ? 0.91
      : side.tactic.mentality === 'counter_attack'
        ? 1.07
        : 1;
  const focus = side.tactic.focus ?? side.tactic.attackDirection;
  const directionTraits =
    focus === 'wings'
      ? ['pace', 'crossing', 'heading']
      : ['passing', 'playmaking', 'finishing'];
  const directionBonus =
    1 + Math.min(0.07, traitCount(side, directionTraits) * 0.009);
  const markingDefense =
    side.tactic.marking === 'very_heavy'
      ? 1.07
      : side.tactic.marking === 'heavy'
        ? 1.035
        : 0.98;
  const pressDefense =
    side.tactic.press === 'high'
      ? 1.035
      : side.tactic.press === 'low'
        ? 0.985
        : 1;
  const lineDefense =
    side.tactic.defensiveLine === 'deep'
      ? 1.02
      : side.tactic.defensiveLine === 'high'
        ? 0.985
        : 1;
  const buildUpAttack =
    side.tactic.buildUp === 'direct'
      ? 1.02
      : side.tactic.buildUp === 'short'
        ? 1.01
        : 1;
  const markingStyleDefense =
    side.tactic.markingStyle === 'man'
      ? 1.018
      : side.tactic.markingStyle === 'zonal'
        ? 1.008
        : 1;
  const discipline =
    side.tactic.marking === 'very_heavy'
      ? 1.65
      : side.tactic.marking === 'heavy'
        ? 1.25
        : 0.78;
  const formationAttack =
    side.tactic.formation === '4-3-3'
      ? 1.035
      : side.tactic.formation === '3-5-2'
        ? 1.015
        : 1;
  const formationControl =
    side.tactic.formation === '3-5-2'
      ? 1.04
      : side.tactic.formation === '4-3-3'
        ? 1.01
        : 1;
  return Object.freeze({
    effective,
    attack: round(
      effective.average *
        mentalityAttack *
        directionBonus *
        formationAttack *
        buildUpAttack,
    ),
    defense: round(
      effective.average *
        mentalityDefense *
        markingDefense *
        pressDefense *
        lineDefense *
        markingStyleDefense,
    ),
    control: round(effective.average * formationControl),
    discipline,
  });
}

export function calculateMatchup(input: MatchInput): MatchupCalculation {
  const valid = createMatchInput(input);
  const home = sideCalculation(valid.home);
  const away = sideCalculation(valid.away);
  const homeRatio = clamp(home.attack / Math.max(1, away.defense), 0.55, 1.7);
  const awayRatio = clamp(away.attack / Math.max(1, home.defense), 0.55, 1.7);
  const homeCounter =
    valid.home.tactic.mentality === 'counter_attack' &&
    valid.away.tactic.mentality === 'all_out_attack'
      ? 1.1
      : 1;
  const awayCounter =
    valid.away.tactic.mentality === 'counter_attack' &&
    valid.home.tactic.mentality === 'all_out_attack'
      ? 1.1
      : 1;
  const expectedGoals = Object.freeze({
    home: round(1.34 * Math.pow(homeRatio, 1.35) * 1.075 * homeCounter),
    away: round(1.18 * Math.pow(awayRatio, 1.35) * awayCounter),
  });
  const homePossession = clamp(
    50 +
      (home.control - away.control) * 0.33 +
      (valid.home.tactic.mentality === 'all_out_attack' ? 2 : 0) -
      (valid.away.tactic.mentality === 'all_out_attack' ? 2 : 0),
    34,
    66,
  );
  return Object.freeze({
    home,
    away,
    expectedGoals,
    possession: Object.freeze({
      home: round(homePossession, 1),
      away: round(100 - homePossession, 1),
    }),
  });
}

function weightedPlayer(
  random: Prng,
  side: MatchSideInput,
  role: 'attack' | 'any',
): PlayerId {
  const slots = side.lineup.starters;
  // Decisive players (high big-game rating, the research standouts) finish
  // more of their side's chances; goal counts themselves are unaffected.
  const weights = slots.map((slot) =>
    role === 'any'
      ? 1
      : (slot.position === 'ST'
          ? 5
          : ['RW', 'LW', 'AM'].includes(slot.position)
            ? 3
            : ['CM', 'RB', 'LB'].includes(slot.position)
              ? 1.5
              : 0.5) *
        (0.6 + Number(playerFor(side, slot.playerId).hidden.bigGame) * 0.008),
  );
  let cursor = random.next() * weights.reduce((a, b) => a + b, 0);
  for (let index = 0; index < slots.length; index += 1) {
    cursor -= weights[index] ?? 0;
    if (cursor <= 0) return slots[index]?.playerId ?? slots[0]!.playerId;
  }
  return slots[slots.length - 1]!.playerId;
}

function poisson(random: Prng, mean: number): number {
  const limit = Math.exp(-mean);
  let product = 1;
  let count = 0;
  do {
    count += 1;
    product *= random.next();
  } while (product > limit && count < 30);
  return count - 1;
}

interface SideEvents {
  events: MatchEvent[];
  shots: number;
  shotsOnTarget: number;
  xg: number;
  goals: number;
  yellow: number;
  red: number;
}
function generateSideEvents(
  random: Prng,
  sideName: MatchSide,
  side: MatchSideInput,
  expectedGoals: number,
  discipline: number,
  automaticSubstitutions: boolean,
): SideEvents {
  const events: MatchEvent[] = [];
  const shotCount = clamp(poisson(random, 8.2 + expectedGoals * 2.8), 2, 24);
  let goals = 0;
  let onTarget = 0;
  let xgTotal = 0;
  for (let index = 0; index < shotCount; index += 1) {
    const minute = random.nextInt(1, 94);
    const xg = round(
      clamp(
        0.025 + random.next() ** 2 * (0.34 + expectedGoals * 0.055),
        0.02,
        0.72,
      ),
    );
    xgTotal += xg;
    events.push({ type: 'chance', minute, side: sideName, xg });
    const target = random.next() < clamp(0.28 + xg * 0.85, 0.3, 0.88);
    if (target) onTarget += 1;
    if (
      random.next() <
      xg * clamp(expectedGoals / Math.max(0.35, xgTotal), 0.72, 1.35)
    ) {
      const scorerId = weightedPlayer(random, side, 'attack');
      const assistId =
        random.next() < 0.72
          ? weightedPlayer(random, side, 'attack')
          : undefined;
      events.push(
        assistId === undefined || assistId === scorerId
          ? { type: 'goal', minute, side: sideName, scorerId }
          : { type: 'goal', minute, side: sideName, scorerId, assistId },
      );
      goals += 1;
      onTarget = Math.max(onTarget, goals);
    }
  }
  const yellow = clamp(poisson(random, 1.45 * discipline), 0, 7);
  let red = 0;
  for (let index = 0; index < yellow; index += 1)
    events.push({
      type: 'card',
      minute: random.nextInt(8, 93),
      side: sideName,
      playerId: weightedPlayer(random, side, 'any'),
      card: 'yellow',
    });
  if (random.next() < 0.035 * discipline) {
    red = 1;
    events.push({
      type: 'card',
      minute: random.nextInt(25, 92),
      side: sideName,
      playerId: weightedPlayer(random, side, 'any'),
      card: 'red',
    });
  }
  if (random.next() < 0.075)
    events.push({
      type: 'injury',
      minute: random.nextInt(12, 86),
      side: sideName,
      playerId: weightedPlayer(random, side, 'any'),
      rounds: random.nextInt(1, 5),
    });
  const substitutions = automaticSubstitutions
    ? Math.min(side.lineup.substitutes.length, random.nextInt(2, 3))
    : 0;
  const usedOut = new Set<PlayerId>();
  for (let index = 0; index < substitutions; index += 1) {
    const available = side.lineup.starters.filter(
      ({ playerId }) => !usedOut.has(playerId),
    );
    const out = available[random.nextInt(0, available.length - 1)]!.playerId;
    usedOut.add(out);
    events.push({
      type: 'substitution',
      minute: random.nextInt(58 + index * 5, 78 + index * 6),
      side: sideName,
      playerOutId: out,
      playerInId: side.lineup.substitutes[index]!,
      source: 'automatic',
    });
  }
  return {
    events,
    shots: shotCount,
    shotsOnTarget: Math.min(shotCount, onTarget),
    xg: round(xgTotal),
    goals,
    yellow,
    red,
  };
}

function instructionModifier(input: MatchInput, sideName: MatchSide): number {
  const side = input[sideName];
  let modifier = 1;
  for (const instruction of input.instructions ?? []) {
    if (instruction.side !== sideName) continue;
    const duration = (90 - instruction.minute) / 90;
    if (instruction.type === 'substitution') {
      const outgoing = playerFor(side, instruction.playerOutId);
      const incoming = playerFor(side, instruction.playerInId);
      modifier *=
        1 +
        ((Number(incoming.strength) - Number(outgoing.strength)) / 100) *
          duration *
          0.18;
    } else {
      const attackDelta =
        instruction.tactic.mentality === 'all_out_attack'
          ? 0.06
          : instruction.tactic.mentality === 'counter_attack'
            ? -0.015
            : 0;
      const pressDelta =
        instruction.tactic.press === 'high'
          ? 0.018
          : instruction.tactic.press === 'low'
            ? -0.008
            : 0;
      modifier *= 1 + (attackDelta + pressDelta) * duration;
    }
  }
  return clamp(modifier, 0.9, 1.12);
}

function instructionEvents(
  instructions: readonly MatchInstruction[],
): MatchEvent[] {
  return instructions.map((instruction) =>
    instruction.type === 'substitution'
      ? {
          type: 'substitution',
          minute: instruction.minute,
          side: instruction.side,
          playerOutId: instruction.playerOutId,
          playerInId: instruction.playerInId,
          position: instruction.position,
          source: 'manager',
        }
      : {
          type: 'tactical_change',
          minute: instruction.minute,
          side: instruction.side,
          tactic: instruction.tactic,
        },
  );
}

function performances(
  input: MatchInput,
  timeline: readonly MatchEvent[],
  sideName: MatchSide,
  goalsFor: number,
  goalsAgainst: number,
) {
  const side = input[sideName];
  const starterIds = new Set(
    side.lineup.starters.map(({ playerId }) => playerId),
  );
  const substituteEvents = timeline.filter(
    (event): event is Extract<MatchEvent, { type: 'substitution' }> =>
      event.type === 'substitution' && event.side === sideName,
  );
  const substituteIds = new Set(
    substituteEvents.map((event) => event.playerInId),
  );
  return side.players
    .filter(({ id }) => starterIds.has(id) || substituteIds.has(id))
    .map((player) => {
      const goals = timeline.filter(
        (event) =>
          event.type === 'goal' &&
          event.side === sideName &&
          event.scorerId === player.id,
      ).length;
      const assists = timeline.filter(
        (event) =>
          event.type === 'goal' &&
          event.side === sideName &&
          event.assistId === player.id,
      ).length;
      const yellowCards = timeline.filter(
        (event) =>
          event.type === 'card' &&
          event.side === sideName &&
          event.playerId === player.id &&
          event.card === 'yellow',
      ).length;
      const redCards = timeline.filter(
        (event) =>
          event.type === 'card' &&
          event.side === sideName &&
          event.playerId === player.id &&
          event.card === 'red',
      ).length;
      const injuryRounds = timeline
        .filter(
          (event): event is Extract<MatchEvent, { type: 'injury' }> =>
            event.type === 'injury' &&
            event.side === sideName &&
            event.playerId === player.id,
        )
        .reduce((maximum, event) => Math.max(maximum, event.rounds), 0);
      const jitter =
        ((hashSeed(`${input.seed}|rating|${player.id}`) % 9) - 4) * 0.05;
      const rating = clamp(
        6.2 +
          (goalsFor - goalsAgainst) * 0.12 +
          goals * 1.05 +
          assists * 0.55 -
          yellowCards * 0.2 -
          redCards * 1.2 +
          jitter,
        1,
        10,
      );
      return Object.freeze({
        playerId: player.id,
        side: sideName,
        started: starterIds.has(player.id),
        rating: round(rating, 1),
        goals,
        assists,
        yellowCards,
        redCards,
        conditionDelta: starterIds.has(player.id) ? -6 : -3,
        moraleDelta:
          goalsFor > goalsAgainst ? 3 : goalsFor < goalsAgainst ? -2 : 0,
        injuryRounds,
        suspensionRounds: redCards > 0 ? 1 : 0,
      });
    });
}

export function simulateMatch(input: MatchInput): MatchResult {
  const valid = createMatchInput(input);
  const random = createPrng(
    `${valid.seed}|${valid.engineVersion}|${valid.rulesVersion}|${valid.fixtureId}`,
  );
  const matchup = calculateMatchup(valid);
  const home = generateSideEvents(
    random,
    'home',
    valid.home,
    matchup.expectedGoals.home * instructionModifier(valid, 'home'),
    matchup.home.discipline,
    !(valid.instructions ?? []).some(({ side }) => side === 'home'),
  );
  const away = generateSideEvents(
    random,
    'away',
    valid.away,
    matchup.expectedGoals.away * instructionModifier(valid, 'away'),
    matchup.away.discipline,
    !(valid.instructions ?? []).some(({ side }) => side === 'away'),
  );
  const timeline = [
    ...home.events,
    ...away.events,
    ...instructionEvents(valid.instructions ?? []),
  ].sort(
    (left, right) =>
      left.minute - right.minute ||
      [
        'tactical_change',
        'substitution',
        'chance',
        'goal',
        'card',
        'injury',
      ].indexOf(left.type) -
        [
          'tactical_change',
          'substitution',
          'chance',
          'goal',
          'card',
          'injury',
        ].indexOf(right.type),
  );
  const matchId = entityId(
    `match_${hashSeed(`${valid.fixtureId}|${valid.seed}|${valid.engineVersion}`).toString(16)}`,
    'match',
  );
  return createMatchResult(
    {
      matchId,
      fixtureId: valid.fixtureId,
      homeGoals: home.goals,
      awayGoals: away.goals,
      home: {
        shots: home.shots,
        shotsOnTarget: home.shotsOnTarget,
        possession: matchup.possession.home,
        yellowCards: home.yellow,
        redCards: home.red,
        xg: home.xg,
      },
      away: {
        shots: away.shots,
        shotsOnTarget: away.shotsOnTarget,
        possession: matchup.possession.away,
        yellowCards: away.yellow,
        redCards: away.red,
        xg: away.xg,
      },
      timeline,
      seed: valid.seed,
      engineVersion: valid.engineVersion,
      decisions: valid.instructions ?? [],
      playerPerformances: [
        ...performances(valid, timeline, 'home', home.goals, away.goals),
        ...performances(valid, timeline, 'away', away.goals, home.goals),
      ],
    },
    valid,
  );
}
