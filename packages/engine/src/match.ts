/* eslint-disable @typescript-eslint/no-non-null-assertion -- lineup cardinalities are domain-validated */
import {
  createMatchInput,
  createMatchResult,
  entityId,
  type LineupSlot,
  type MatchEvent,
  type MatchInstruction,
  type MatchPlay,
  type MatchInput,
  type MatchResult,
  type MatchSide,
  type Player,
  type PlayerId,
  type Position,
  type Tactic,
} from '@footebas/domain';
import { createPrng, hashSeed, type Prng } from './prng.js';

export const ENGINE_VERSION = 'match-v4' as const;
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

function computeMatchup(valid: MatchInput): MatchupCalculation {
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

/**
 * Nominal matchup from the squads as they are, without the day's form. Used
 * for previews and calibration; the match itself uses
 * {@link calculateMatchExpectation}.
 */
export function calculateMatchup(input: MatchInput): MatchupCalculation {
  return computeMatchup(createMatchInput(input));
}

// --- day form (ADR 0015) -------------------------------------------------------

interface DayForm {
  /** Multiplier on the athlete's strength for this match only. */
  readonly factor: number;
  /** A night where everything works: more involvement and better finishing. */
  readonly inspired: boolean;
}

/** Approximately standard normal from four uniforms, clamped to ±2.5. */
function normal(random: Prng): number {
  const sum = random.next() + random.next() + random.next() + random.next();
  return clamp((sum - 2) * Math.sqrt(3), -2.5, 2.5);
}

/**
 * Every athlete gets a form of the day and a small chance of an inspired
 * night, drawn from the match seed: the same match always replays the same
 * way, but two matches between the same squads differ. Consistent athletes
 * vary less; the whole side also has a shared "day".
 */
function dayForms(
  seed: string,
  sideName: MatchSide,
  side: MatchSideInput,
): ReadonlyMap<PlayerId, DayForm> {
  const team = 1 + 0.025 * normal(createPrng(`${seed}|${sideName}|team-day`));
  return new Map(
    side.players.map((player) => {
      const random = createPrng(`${seed}|form|${player.id}`);
      const spread = 0.03 + (100 - Number(player.hidden.consistency)) * 0.0008;
      const factor = team * (1 + spread * normal(random));
      const inspired =
        random.next() < 0.045 + Number(player.hidden.bigGame) * 0.0003;
      return [player.id, Object.freeze({ factor: round(factor, 4), inspired })];
    }),
  );
}

function withForm(
  side: MatchSideInput,
  forms: ReadonlyMap<PlayerId, DayForm>,
): MatchSideInput {
  return Object.freeze({
    ...side,
    players: side.players.map((player) => ({
      ...player,
      strength: (Number(player.strength) *
        (forms.get(player.id)?.factor ?? 1)) as Player['strength'],
    })),
  });
}

function matchForms(valid: MatchInput, seed: string) {
  return {
    home: dayForms(seed, 'home', valid.home),
    away: dayForms(seed, 'away', valid.away),
  };
}

function matchSeed(valid: MatchInput): string {
  return `${valid.seed}|${valid.engineVersion}|${valid.rulesVersion}|${valid.fixtureId}`;
}

/**
 * Pre-match expectation for this specific match: the nominal matchup with the
 * day's form of every athlete applied. Deterministic by seed.
 */
export function calculateMatchExpectation(
  input: MatchInput,
): MatchupCalculation {
  const valid = createMatchInput(input);
  const forms = matchForms(valid, matchSeed(valid));
  return computeMatchup({
    ...valid,
    home: withForm(valid.home, forms.home),
    away: withForm(valid.away, forms.away),
  });
}

// --- minute-by-minute simulation ------------------------------------------------

const LAST_MINUTE = 94;
const PERIOD_MINUTES = 15;
/** Late games are more open: chance intensity rises through the match. */
const minuteProfile = (minute: number) => 0.88 + 0.28 * (minute / LAST_MINUTE);
const PROFILE_MEAN =
  Array.from({ length: LAST_MINUTE }, (_, index) =>
    minuteProfile(index + 1),
  ).reduce((sum, value) => sum + value, 0) / LAST_MINUTE;
const cardProfile = (minute: number) => 0.6 + 0.8 * (minute / LAST_MINUTE);
const YELLOW_FIRST = 8;
const YELLOW_LAST = 93;
const CARD_PROFILE_MEAN =
  Array.from({ length: YELLOW_LAST - YELLOW_FIRST + 1 }, (_, index) =>
    cardProfile(index + YELLOW_FIRST),
  ).reduce((sum, value) => sum + value, 0) /
  (YELLOW_LAST - YELLOW_FIRST + 1);

/** Share of each play and its xG multiplier; weighted xG multiplier ≈ 1. */
const PLAYS: Readonly<
  Record<MatchPlay, Readonly<{ weight: number; xg: number; assist: number }>>
> = {
  build_up: { weight: 0.3, xg: 1.05, assist: 0.8 },
  counter: { weight: 0.14, xg: 1.3, assist: 0.72 },
  individual: { weight: 0.14, xg: 1.05, assist: 0.22 },
  cross: { weight: 0.2, xg: 0.9, assist: 0.95 },
  long_shot: { weight: 0.16, xg: 0.5, assist: 0.25 },
  defensive_error: { weight: 0.06, xg: 1.6, assist: 0.35 },
};
const PLAY_ORDER = Object.keys(PLAYS) as MatchPlay[];

type PositionWeights = Readonly<Partial<Record<Position, number>>>;
/** Who tends to finish each kind of play. */
const SHOOTERS: Readonly<Record<MatchPlay, PositionWeights>> = {
  build_up: {
    ST: 4,
    AM: 3,
    RW: 2.5,
    LW: 2.5,
    CM: 1.5,
    DM: 0.6,
    RB: 0.7,
    LB: 0.7,
    CB: 0.4,
  },
  counter: {
    ST: 4,
    RW: 3.5,
    LW: 3.5,
    AM: 2.5,
    CM: 1,
    DM: 0.4,
    RB: 0.6,
    LB: 0.6,
    CB: 0.2,
  },
  individual: {
    RW: 4,
    LW: 4,
    AM: 3.5,
    ST: 3,
    CM: 1.2,
    DM: 0.4,
    RB: 0.6,
    LB: 0.6,
    CB: 0.2,
  },
  cross: {
    ST: 5,
    CB: 1.2,
    AM: 1.5,
    RW: 1.5,
    LW: 1.5,
    CM: 1,
    DM: 0.6,
    RB: 0.3,
    LB: 0.3,
  },
  long_shot: {
    CM: 3.5,
    AM: 3.5,
    DM: 2,
    RW: 1.5,
    LW: 1.5,
    ST: 1,
    RB: 1,
    LB: 1,
    CB: 0.5,
  },
  defensive_error: {
    ST: 4,
    AM: 2.5,
    RW: 2.5,
    LW: 2.5,
    CM: 1.2,
    DM: 0.5,
    RB: 0.5,
    LB: 0.5,
    CB: 0.3,
  },
};
/** Who tends to set each kind of play up. */
const ASSISTANTS: Readonly<Record<MatchPlay, PositionWeights>> = {
  build_up: {
    AM: 3.5,
    CM: 3,
    RW: 2,
    LW: 2,
    ST: 1.5,
    DM: 1.5,
    RB: 1.2,
    LB: 1.2,
    CB: 0.4,
  },
  counter: {
    RW: 3,
    LW: 3,
    AM: 3,
    CM: 2,
    ST: 2,
    DM: 1.2,
    RB: 1,
    LB: 1,
    CB: 0.3,
    GK: 0.1,
  },
  individual: {
    AM: 2,
    CM: 2,
    RW: 1.5,
    LW: 1.5,
    ST: 1.5,
    DM: 1,
    RB: 1,
    LB: 1,
    CB: 0.3,
  },
  cross: {
    RW: 4,
    LW: 4,
    RB: 3,
    LB: 3,
    AM: 1.5,
    CM: 1.2,
    ST: 0.8,
    DM: 0.5,
    CB: 0.2,
  },
  long_shot: {
    CM: 2.5,
    AM: 2.5,
    DM: 1.5,
    RW: 1.5,
    LW: 1.5,
    ST: 1.5,
    RB: 1,
    LB: 1,
    CB: 0.5,
  },
  defensive_error: {
    ST: 2.5,
    AM: 2,
    RW: 2,
    LW: 2,
    CM: 2,
    DM: 2,
    RB: 0.8,
    LB: 0.8,
    CB: 0.5,
  },
};
const SHOOTER_TRAITS: Readonly<Record<MatchPlay, readonly string[]>> = {
  build_up: ['finishing', 'positioning'],
  counter: ['pace', 'finishing'],
  individual: ['playmaking', 'pace'],
  cross: ['heading', 'positioning'],
  long_shot: ['passing', 'playmaking'],
  defensive_error: ['finishing', 'positioning'],
};
const ASSIST_TRAITS: Readonly<Record<MatchPlay, readonly string[]>> = {
  build_up: ['passing', 'playmaking'],
  counter: ['pace', 'passing'],
  individual: ['playmaking'],
  cross: ['crossing'],
  long_shot: ['passing'],
  defensive_error: ['tackling', 'marking'],
};
const BOOKING: PositionWeights = {
  GK: 0.15,
  CB: 1.6,
  RB: 1.3,
  LB: 1.3,
  DM: 1.8,
  CM: 1.2,
  AM: 0.8,
  RW: 0.8,
  LW: 0.8,
  ST: 0.7,
};
/**
 * Calibrated so match-v1-bands-v1 (goals, home advantage, upsets, monotonic
 * favouritism) stays green: see tools/sim-lab/reports/variance-after.md.
 */
const CONVERSION = 1.0;

interface SideState {
  readonly name: MatchSide;
  readonly input: MatchSideInput;
  readonly forms: ReadonlyMap<PlayerId, DayForm>;
  readonly expectedGoals: number;
  readonly discipline: number;
  readonly instructions: readonly MatchInstruction[];
  readonly spells: readonly (readonly [number, number])[];
  readonly subPlan: readonly number[];
  readonly applied: MatchInstruction[];
  /** On-pitch athletes and the slot they occupy. */
  readonly positions: Map<PlayerId, Position>;
  readonly usedBench: Set<PlayerId>;
  readonly booked: Set<PlayerId>;
  readonly shotsBy: Map<PlayerId, number>;
  readonly goalsBy: Map<PlayerId, number>;
  tactic: Tactic;
  nextInstruction: number;
  managerActed: boolean;
  modifier: number;
  substitutions: number;
  goals: number;
  shots: number;
  onTarget: number;
  xg: number;
  yellow: number;
  red: number;
  injured: boolean;
  pendingInjury: PlayerId | undefined;
}

function formOf(state: SideState, id: PlayerId): DayForm {
  return state.forms.get(id) ?? { factor: 1, inspired: false };
}

function formStrength(state: SideState, id: PlayerId): number {
  return Number(playerFor(state.input, id).strength) * formOf(state, id).factor;
}

function pickWeighted<T>(
  random: Prng,
  entries: readonly (readonly [T, number])[],
): T | undefined {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) return undefined;
  let cursor = random.next() * total;
  for (const [value, weight] of entries) {
    cursor -= weight;
    if (cursor <= 0) return value;
  }
  return entries[entries.length - 1]?.[0];
}

function traitBonus(player: Player, traits: readonly string[], each: number) {
  return player.traits.reduce(
    (product, trait) => (traits.includes(trait) ? product * each : product),
    1,
  );
}

/**
 * Who finishes the chance. Position, traits and the day's form weigh in,
 * decisive athletes (big-game) a little; every shot already taken and every
 * goal already scored in this match damp the next pick, so no one monopolises
 * a match.
 */
function pickShooter(
  random: Prng,
  state: SideState,
  play: MatchPlay,
): PlayerId | undefined {
  return pickWeighted(
    random,
    [...state.positions].map(([id, position]) => {
      const player = playerFor(state.input, id);
      const form = formOf(state, id);
      const quality = (formStrength(state, id) / 75) ** 1.6;
      const decisive = 0.9 + Number(player.hidden.bigGame) * 0.003;
      const damping =
        1 /
        (1 + 0.22 * (state.shotsBy.get(id) ?? 0)) /
        (1 + 0.45 * (state.goalsBy.get(id) ?? 0));
      return [
        id,
        (SHOOTERS[play][position] ?? 0) *
          traitBonus(player, SHOOTER_TRAITS[play], 1.3) *
          quality *
          decisive *
          (form.inspired ? 1.6 : 1) *
          damping,
      ] as const;
    }),
  );
}

function pickAssistant(
  random: Prng,
  state: SideState,
  play: MatchPlay,
  shooter: PlayerId,
): PlayerId | undefined {
  return pickWeighted(
    random,
    [...state.positions]
      .filter(([id]) => id !== shooter)
      .map(([id, position]) => {
        const player = playerFor(state.input, id);
        return [
          id,
          (ASSISTANTS[play][position] ?? 0) *
            traitBonus(player, ASSIST_TRAITS[play], 1.4) *
            (formStrength(state, id) / 75) ** 1.5 *
            (formOf(state, id).inspired ? 1.4 : 1),
        ] as const;
      }),
  );
}

function pickPlay(
  random: Prng,
  state: SideState,
  opponent: SideState,
): MatchPlay {
  const tactic = state.tactic;
  const wings = (tactic.focus ?? tactic.attackDirection) === 'wings' ? 1.5 : 1;
  const counter =
    (tactic.mentality === 'counter_attack' ? 1.8 : 1) *
    (opponent.tactic.mentality === 'all_out_attack' ? 1.3 : 1) *
    (opponent.tactic.defensiveLine === 'high' ? 1.25 : 1);
  const longShots =
    (opponent.tactic.defensiveLine === 'deep' ? 1.35 : 1) *
    (opponent.tactic.mentality === 'counter_attack' ? 1.2 : 1);
  const errors =
    (tactic.press === 'high' ? 1.5 : 1) *
    (opponent.tactic.buildUp === 'short' ? 1.3 : 1);
  const buildUp = tactic.buildUp === 'short' ? 1.3 : 1;
  const individual =
    1 +
    Math.min(
      0.6,
      [...state.positions.keys()].reduce(
        (sum, id) =>
          sum +
          playerFor(state.input, id).traits.filter(
            (trait) => trait === 'pace' || trait === 'playmaking',
          ).length *
            0.06,
        0,
      ),
    );
  const factors: Readonly<Record<MatchPlay, number>> = {
    build_up: buildUp,
    counter,
    individual,
    cross: wings,
    long_shot: longShots,
    defensive_error: errors,
  };
  return (
    pickWeighted(
      random,
      PLAY_ORDER.map((play) => [play, PLAYS[play].weight * factors[play]]),
    ) ?? 'build_up'
  );
}

function goalkeeperStrength(state: SideState): number {
  for (const [id, position] of state.positions)
    if (position === 'GK') return formStrength(state, id);
  return 45;
}

function instructionFactor(
  side: MatchSideInput,
  instruction: MatchInstruction,
): number {
  const duration = Math.max(0, 90 - instruction.minute) / 90;
  if (instruction.type === 'substitution') {
    const outgoing = playerFor(side, instruction.playerOutId);
    const incoming = playerFor(side, instruction.playerInId);
    return (
      1 +
      ((Number(incoming.strength) - Number(outgoing.strength)) / 100) *
        duration *
        0.18
    );
  }
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
  return 1 + (attackDelta + pressDelta) * duration;
}

/** Two to four spells where a side takes over the game for a few minutes. */
function pressureSpells(
  seed: string,
  sideName: MatchSide,
): readonly (readonly [number, number])[] {
  const random = createPrng(`${seed}|${sideName}|spells`);
  const count = random.nextInt(2, 4);
  return Array.from({ length: count }, () => {
    const from = random.nextInt(3, 86);
    return [from, from + random.nextInt(4, 9)] as const;
  });
}

/** Automatic substitution minutes, used while the manager has not acted. */
function substitutionPlan(seed: string, sideName: MatchSide): number[] {
  const random = createPrng(`${seed}|${sideName}|substitutions`);
  const first = random.nextInt(55, 66);
  const second = random.nextInt(first + 4, 77);
  const plan = [first, second];
  if (random.next() < 0.55) plan.push(random.nextInt(second + 3, 86));
  return plan;
}

/** Game rhythm: an open or closed match, and calmer or wilder periods. */
function matchTempo(seed: string): readonly number[] {
  const random = createPrng(`${seed}|tempo`);
  const overall = Math.exp(0.2 * normal(random)) / Math.exp(0.02);
  return Array.from(
    { length: 7 },
    () => (overall * Math.exp(0.22 * normal(random))) / Math.exp(0.0242),
  );
}

function createSideState(
  seed: string,
  name: MatchSide,
  input: MatchSideInput,
  forms: ReadonlyMap<PlayerId, DayForm>,
  expectedGoals: number,
  discipline: number,
  instructions: readonly MatchInstruction[],
): SideState {
  return {
    name,
    input,
    forms,
    expectedGoals,
    discipline,
    instructions,
    spells: pressureSpells(seed, name),
    subPlan: substitutionPlan(seed, name),
    applied: [],
    positions: new Map(
      input.lineup.starters.map(({ playerId, position }) => [
        playerId,
        position,
      ]),
    ),
    usedBench: new Set(),
    booked: new Set(),
    shotsBy: new Map(),
    goalsBy: new Map(),
    tactic: input.tactic,
    nextInstruction: 0,
    managerActed: false,
    modifier: 1,
    substitutions: 0,
    goals: 0,
    shots: 0,
    onTarget: 0,
    xg: 0,
    yellow: 0,
    red: 0,
    injured: false,
    pendingInjury: undefined,
  };
}

/** Applies every instruction given before `minute` (i.e. at minute - 1 or earlier). */
function applyInstructions(
  state: SideState,
  minute: number,
  timeline: MatchEvent[],
): void {
  while (
    state.nextInstruction < state.instructions.length &&
    state.instructions[state.nextInstruction]!.minute < minute
  ) {
    const instruction = state.instructions[state.nextInstruction]!;
    state.nextInstruction += 1;
    state.managerActed = true;
    if (instruction.type === 'substitution') {
      if (
        !state.positions.has(instruction.playerOutId) ||
        state.positions.has(instruction.playerInId) ||
        state.usedBench.has(instruction.playerInId) ||
        state.substitutions >= 5
      )
        continue;
      state.positions.delete(instruction.playerOutId);
      state.positions.set(instruction.playerInId, instruction.position);
      state.usedBench.add(instruction.playerInId);
      state.substitutions += 1;
      timeline.push({
        type: 'substitution',
        minute: instruction.minute,
        side: state.name,
        playerOutId: instruction.playerOutId,
        playerInId: instruction.playerInId,
        position: instruction.position,
        source: 'manager',
      });
    } else {
      state.tactic = instruction.tactic;
      timeline.push({
        type: 'tactical_change',
        minute: instruction.minute,
        side: state.name,
        tactic: instruction.tactic,
      });
    }
    state.modifier = clamp(
      state.modifier * instructionFactor(state.input, instruction),
      0.9,
      1.12,
    );
    state.applied.push(instruction);
  }
}

function automaticSubstitution(
  random: Prng,
  state: SideState,
  minute: number,
  timeline: MatchEvent[],
  forced?: PlayerId,
): void {
  if (state.substitutions >= 5) return;
  const outgoing =
    forced ??
    pickWeighted(
      random,
      [...state.positions]
        .filter(([, position]) => position !== 'GK')
        .map(([id, position]) => {
          const form = formOf(state, id).factor;
          return [
            id,
            1 +
              (state.booked.has(id) ? 1.5 : 0) +
              Math.max(0, 1 - form) * 25 +
              (['ST', 'RW', 'LW', 'AM'].includes(position) ? 0.5 : 0),
          ] as const;
        }),
    );
  if (outgoing === undefined || !state.positions.has(outgoing)) return;
  const position = state.positions.get(outgoing)!;
  const available = state.input.lineup.substitutes.filter(
    (id) =>
      !state.usedBench.has(id) &&
      playerFor(state.input, id).injuryRounds === 0 &&
      playerFor(state.input, id).suspensionRounds === 0,
  );
  const incoming = pickWeighted(
    random,
    available.map((id) => {
      const player = playerFor(state.input, id);
      const fit =
        player.position === position
          ? 1
          : player.secondaryPositions.includes(position)
            ? 0.75
            : position === 'GK' || player.position === 'GK'
              ? 0.02
              : 0.3;
      return [id, fit * (formStrength(state, id) / 70) ** 3] as const;
    }),
  );
  if (incoming === undefined) return;
  state.positions.delete(outgoing);
  state.positions.set(incoming, position);
  state.usedBench.add(incoming);
  state.substitutions += 1;
  timeline.push({
    type: 'substitution',
    minute,
    side: state.name,
    playerOutId: outgoing,
    playerInId: incoming,
    source: 'automatic',
  });
}

function bookingCandidates(state: SideState) {
  return [...state.positions].map(([id, position]) => {
    const player = playerFor(state.input, id);
    return [
      id,
      (BOOKING[position] ?? 1) *
        traitBonus(player, ['tackling', 'marking'], 1.25) *
        (state.booked.has(id) ? 0.35 : 1),
    ] as const;
  });
}

function sendOff(state: SideState, id: PlayerId): void {
  state.positions.delete(id);
  state.red += 1;
}

function playMinute(
  seed: string,
  minute: number,
  state: SideState,
  opponent: SideState,
  tempo: readonly number[],
  score: Readonly<{ own: number; opponent: number }>,
  timeline: MatchEvent[],
): void {
  const random = createPrng(`${seed}|${state.name}|minute-${String(minute)}`);
  if (state.pendingInjury !== undefined) {
    if (state.positions.has(state.pendingInjury))
      automaticSubstitution(
        random,
        state,
        minute,
        timeline,
        state.pendingInjury,
      );
    state.pendingInjury = undefined;
  }
  const expected = state.expectedGoals * state.modifier;
  const inSpell = (spells: SideState['spells']) =>
    spells.some(([from, to]) => minute >= from && minute <= to);
  const difference = score.own - score.opponent;
  const gameState =
    minute <= 55
      ? 1
      : difference < 0
        ? 1 + Math.min(2, -difference) * 0.1
        : difference > 0
          ? 1 - Math.min(2, difference) * 0.06
          : 1;
  const intensity =
    ((8.2 + expected * 2.8) / LAST_MINUTE) *
    (minuteProfile(minute) / PROFILE_MEAN) *
    (tempo[Math.min(6, Math.floor((minute - 1) / PERIOD_MINUTES))] ?? 1) *
    (inSpell(state.spells) ? 1.55 : 1) *
    (inSpell(opponent.spells) ? 0.8 : 1) *
    gameState *
    (state.red > 0 ? 0.82 : 1) *
    (opponent.red > 0 ? 1.12 : 1);
  const chances = poisson(random, intensity);
  for (let index = 0; index < chances; index += 1) {
    const play = pickPlay(random, state, opponent);
    const shooter = pickShooter(random, state, play);
    if (shooter === undefined) break;
    const xg = round(
      clamp(
        (0.025 + random.next() ** 2 * (0.34 + expected * 0.055)) *
          PLAYS[play].xg,
        0.02,
        0.72,
      ),
    );
    const assistId =
      random.next() < PLAYS[play].assist
        ? pickAssistant(random, state, play, shooter)
        : undefined;
    const finishing =
      clamp(
        1 +
          (formStrength(state, shooter) - goalkeeperStrength(opponent)) * 0.008,
        0.75,
        1.3,
      ) * (formOf(state, shooter).inspired ? 1.12 : 1);
    const conversion =
      CONVERSION * Math.pow(Math.max(0.2, expected) / 1.3, 0.35) * finishing;
    const scored = random.next() < xg * conversion;
    const outcomeRoll = random.next();
    const outcome = scored
      ? 'goal'
      : outcomeRoll < clamp(0.24 + xg * 0.8, 0.26, 0.82)
        ? 'saved'
        : outcomeRoll < 0.9
          ? play === 'long_shot' || outcomeRoll < 0.6
            ? 'blocked'
            : 'off_target'
          : outcomeRoll < 0.94
            ? 'woodwork'
            : 'off_target';
    state.shots += 1;
    state.xg += xg;
    state.shotsBy.set(shooter, (state.shotsBy.get(shooter) ?? 0) + 1);
    if (outcome === 'goal' || outcome === 'saved') state.onTarget += 1;
    timeline.push({
      type: 'chance',
      minute,
      side: state.name,
      xg,
      playerId: shooter,
      ...(assistId === undefined ? {} : { assistId }),
      play,
      outcome,
    });
    if (scored) {
      state.goals += 1;
      state.goalsBy.set(shooter, (state.goalsBy.get(shooter) ?? 0) + 1);
      timeline.push({
        type: 'goal',
        minute,
        side: state.name,
        scorerId: shooter,
        ...(assistId === undefined ? {} : { assistId }),
        play,
      });
    }
  }
  if (
    minute >= YELLOW_FIRST &&
    minute <= YELLOW_LAST &&
    state.yellow < 7 &&
    random.next() <
      ((1.45 * state.discipline) / (YELLOW_LAST - YELLOW_FIRST + 1)) *
        (cardProfile(minute) / CARD_PROFILE_MEAN)
  ) {
    const playerId = pickWeighted(random, bookingCandidates(state));
    if (playerId !== undefined) {
      if (state.booked.has(playerId)) {
        if (state.red === 0) {
          sendOff(state, playerId);
          timeline.push({
            type: 'card',
            minute,
            side: state.name,
            playerId,
            card: 'red',
          });
        }
      } else {
        state.booked.add(playerId);
        state.yellow += 1;
        timeline.push({
          type: 'card',
          minute,
          side: state.name,
          playerId,
          card: 'yellow',
        });
      }
    }
  }
  if (
    state.red === 0 &&
    minute >= 25 &&
    minute <= 92 &&
    random.next() < (0.035 * state.discipline) / 68
  ) {
    const playerId = pickWeighted(random, bookingCandidates(state));
    if (playerId !== undefined) {
      sendOff(state, playerId);
      timeline.push({
        type: 'card',
        minute,
        side: state.name,
        playerId,
        card: 'red',
      });
    }
  }
  if (
    !state.injured &&
    minute >= 12 &&
    minute <= 86 &&
    random.next() < 0.075 / 75
  ) {
    const playerId = pickWeighted(
      random,
      [...state.positions.keys()].map(
        (id) =>
          [
            id,
            0.6 +
              Number(playerFor(state.input, id).hidden.injuryProneness) / 40,
          ] as const,
      ),
    );
    if (playerId !== undefined) {
      state.injured = true;
      state.pendingInjury = playerId;
      timeline.push({
        type: 'injury',
        minute,
        side: state.name,
        playerId,
        rounds: random.nextInt(1, 5),
      });
    }
  }
  if (!state.managerActed && state.subPlan.includes(minute))
    automaticSubstitution(random, state, minute, timeline);
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

function performances(
  input: MatchInput,
  timeline: readonly MatchEvent[],
  sideName: MatchSide,
  goalsFor: number,
  goalsAgainst: number,
  forms: ReadonlyMap<PlayerId, DayForm>,
) {
  const side = input[sideName];
  const starterIds = new Set(
    side.lineup.starters.map(({ playerId }) => playerId),
  );
  const substituteIds = new Set(
    timeline.flatMap((event) =>
      event.type === 'substitution' && event.side === sideName
        ? [event.playerInId]
        : [],
    ),
  );
  const own = timeline.filter((event) => event.side === sideName);
  return side.players
    .filter(({ id }) => starterIds.has(id) || substituteIds.has(id))
    .map((player) => {
      const goals = own.filter(
        (event) => event.type === 'goal' && event.scorerId === player.id,
      ).length;
      const assists = own.filter(
        (event) => event.type === 'goal' && event.assistId === player.id,
      ).length;
      const shots = own.filter(
        (event) =>
          event.type === 'chance' &&
          event.playerId === player.id &&
          event.outcome !== 'goal',
      ).length;
      const yellowCards = own.filter(
        (event) =>
          event.type === 'card' &&
          event.playerId === player.id &&
          event.card === 'yellow',
      ).length;
      const redCards = own.filter(
        (event) =>
          event.type === 'card' &&
          event.playerId === player.id &&
          event.card === 'red',
      ).length;
      const injuryRounds = own
        .filter(
          (event): event is Extract<MatchEvent, { type: 'injury' }> =>
            event.type === 'injury' && event.playerId === player.id,
        )
        .reduce((maximum, event) => Math.max(maximum, event.rounds), 0);
      const jitter =
        ((hashSeed(`${input.seed}|rating|${player.id}`) % 9) - 4) * 0.05;
      const form = (forms.get(player.id)?.factor ?? 1) - 1;
      const rating = clamp(
        6.2 +
          (goalsFor - goalsAgainst) * 0.12 +
          goals * 1.05 +
          assists * 0.55 +
          Math.min(0.4, shots * 0.08) -
          yellowCards * 0.2 -
          redCards * 1.2 +
          form * 6 +
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

/**
 * match-v4 (ADR 0015): minute by minute, each side and minute with its own
 * random stream. An instruction at minute m is applied before minute m + 1, so
 * everything up to and including minute m stays identical whatever the
 * manager decides then (prefix stability at any minute).
 */
export function simulateMatch(input: MatchInput): MatchResult {
  const valid = createMatchInput(input);
  const seed = matchSeed(valid);
  const forms = matchForms(valid, seed);
  const matchup = computeMatchup({
    ...valid,
    home: withForm(valid.home, forms.home),
    away: withForm(valid.away, forms.away),
  });
  const orders = (side: MatchSide) =>
    (valid.instructions ?? [])
      .filter((instruction) => instruction.side === side)
      .sort((left, right) => left.minute - right.minute);
  const home = createSideState(
    seed,
    'home',
    valid.home,
    forms.home,
    matchup.expectedGoals.home,
    matchup.home.discipline,
    orders('home'),
  );
  const away = createSideState(
    seed,
    'away',
    valid.away,
    forms.away,
    matchup.expectedGoals.away,
    matchup.away.discipline,
    orders('away'),
  );
  const tempo = matchTempo(seed);
  const timeline: MatchEvent[] = [];
  for (let minute = 1; minute <= LAST_MINUTE; minute += 1) {
    applyInstructions(home, minute, timeline);
    applyInstructions(away, minute, timeline);
    const homeScore = home.goals;
    const awayScore = away.goals;
    playMinute(
      seed,
      minute,
      home,
      away,
      tempo,
      { own: homeScore, opponent: awayScore },
      timeline,
    );
    playMinute(
      seed,
      minute,
      away,
      home,
      tempo,
      { own: awayScore, opponent: homeScore },
      timeline,
    );
  }
  const decisions = [...home.applied, ...away.applied].sort(
    (left, right) => left.minute - right.minute,
  );
  const matchId = entityId(
    `match_${hashSeed(`${valid.fixtureId}|${valid.seed}|${valid.engineVersion}`).toString(16)}`,
    'match',
  );
  const statistics = (state: SideState, possession: number) => ({
    shots: state.shots,
    shotsOnTarget: Math.min(state.shots, state.onTarget),
    possession,
    yellowCards: state.yellow,
    redCards: state.red,
    xg: round(state.xg),
  });
  return createMatchResult(
    {
      matchId,
      fixtureId: valid.fixtureId,
      homeGoals: home.goals,
      awayGoals: away.goals,
      home: statistics(home, matchup.possession.home),
      away: statistics(away, matchup.possession.away),
      timeline,
      seed: valid.seed,
      engineVersion: valid.engineVersion,
      decisions,
      playerPerformances: [
        ...performances(
          valid,
          timeline,
          'home',
          home.goals,
          away.goals,
          forms.home,
        ),
        ...performances(
          valid,
          timeline,
          'away',
          away.goals,
          home.goals,
          forms.away,
        ),
      ],
    },
    valid,
  );
}
