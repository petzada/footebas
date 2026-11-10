/**
 * Deterministic, presentation-only choreography for the 3D match stage.
 *
 * The official timeline (ADR 0001/0010) is the only input: this module never
 * changes the score, events or statistics and never re-simulates anything.
 * Positions and trajectories between events are derived from a seeded PRNG
 * keyed by the match id and the step index, so the same match always yields
 * the same animation.
 */
import { PLAY_MS, playDurationMs, primaryEvent } from '@/lib/match-pace';
import type {
  MatchReplayInput,
  ReplayEvent,
  ReplayPlay,
  ReplayPlayer,
  ReplaySide,
} from '@/lib/match-replay-model';

/** Pitch geometry in the same 100x64 units the 2D fallback uses. */
export const PITCH = {
  width: 100,
  height: 64,
  left: 2,
  right: 98,
  top: 2,
  bottom: 62,
  goalTop: 28.5,
  goalBottom: 35.5,
  /** Depth of the net behind each goal line. */
  netDepth: 1.8,
} as const;

/** Progress marks inside one segment (0 = previous rest, 1 = new rest). */
export const PHASES = {
  open: 0.3,
  carry: 0.44,
  build: 0.58,
  action: 0.72,
} as const;

export interface StagePoint {
  readonly x: number;
  readonly y: number;
}

export interface StageSlotPlayer {
  readonly id: string;
  readonly number: number;
  readonly name: string;
  readonly position?: string;
}

/** How a chance that is not a goal ends on the pitch. */
export type ChanceEnding = 'saved' | 'wide' | 'over' | 'blocked' | 'post';

/** A body movement the renderer animates on one athlete. */
export interface StageAction {
  /** Segment progress the movement starts at. */
  readonly p: number;
  /** Progress it is held until (falls, celebrations); a one-off otherwise. */
  readonly until?: number;
  readonly playerKey: string;
  readonly kind:
    | 'pass'
    | 'shot'
    | 'header'
    | 'dive'
    | 'tackle'
    | 'fall'
    | 'celebrate'
    | 'despair';
  /** -1 or 1: which way a keeper dives (towards the top or the bottom). */
  readonly lean?: number;
}

export type StageOverlay =
  | Readonly<{ kind: 'goal'; side: ReplaySide; playerKey: string }>
  | Readonly<{
      kind: 'chance';
      side: ReplaySide;
      outcome: ChanceEnding;
    }>
  | Readonly<{
      kind: 'card';
      side: ReplaySide;
      card: 'yellow' | 'red';
      playerKey: string;
    }>
  | Readonly<{
      kind: 'substitution';
      side: ReplaySide;
      playerKey: string;
      inNumber: number;
      outNumber: number;
    }>
  | Readonly<{ kind: 'injury'; side: ReplaySide; playerKey: string }>;

export interface StagePlayerFrame {
  readonly key: string;
  readonly side: ReplaySide;
  readonly slot: number;
  readonly number: number;
  readonly x: number;
  readonly y: number;
  readonly visible: boolean;
  readonly involved: boolean;
}

export interface StageBallFrame extends StagePoint {
  /** 0 on the grass; ~1 for a lofted ball. Purely visual. */
  readonly height: number;
}

export interface StageFrame {
  readonly step: number;
  readonly minute: number;
  readonly progress: number;
  readonly ball: StageBallFrame;
  readonly players: readonly StagePlayerFrame[];
  readonly overlay: StageOverlay | null;
  /** 0..1 intensity of the goal celebration. */
  readonly celebration: number;
  /** Shot origin while a shot is in flight, for the trajectory trail. */
  readonly shotFrom: StagePoint | null;
}

type Lineup = Readonly<Record<ReplaySide, readonly (StageSlotPlayer | null)[]>>;
type Pose = Readonly<Record<string, StagePoint>>;

interface BallKey {
  readonly p: number;
  readonly point: StagePoint;
  /** Apex of the arc on the way *into* this key. */
  readonly arc: number;
}

export interface StageSegment {
  readonly step: number;
  readonly minute: number;
  readonly events: readonly ReplayEvent[];
  readonly primary: ReplayEvent | undefined;
  readonly attacking: ReplaySide;
  readonly poseKeys: readonly Readonly<{ p: number; pose: Pose }>[];
  readonly ballKeys: readonly BallKey[];
  readonly overlay: StageOverlay | null;
  readonly lineupBefore: Lineup;
  readonly lineupAfter: Lineup;
  readonly involvedKey: string | undefined;
  readonly shot: Readonly<{ from: StagePoint }> | null;
  /** Formation anchors of each side during this segment (home-oriented). */
  readonly anchors: Anchors;
  readonly actions: readonly StageAction[];
  /** How the chance was built, when the engine told us. */
  readonly play: ReplayPlay | undefined;
  /** Real time of the segment at 1x. */
  readonly durationMs: number;
}

export interface StageChoreography {
  readonly matchId: string;
  readonly duration: number;
  /** Minutes the replay stops at: 0, each event minute, full time. */
  readonly minutes: readonly number[];
  readonly segments: readonly StageSegment[];
}

const SIDES = ['home', 'away'] as const;
const SLOTS = 11;

export type Anchors = Readonly<Record<ReplaySide, readonly StagePoint[]>>;

/** Slot order used when the source does not say who plays where. */
const DEFAULT_CODES: readonly string[] = [
  'GK',
  'RB',
  'CB',
  'CB',
  'LB',
  'DM',
  'CM',
  'AM',
  'RW',
  'LW',
  'ST',
];

const FORMATION_CODES: Readonly<Record<string, readonly string[]>> = {
  '4-4-2': ['GK', 'RB', 'CB', 'CB', 'LB', 'CM', 'CM', 'RW', 'LW', 'ST', 'ST'],
  '4-3-3': DEFAULT_CODES,
  '3-5-2': ['GK', 'CB', 'CB', 'CB', 'RB', 'LB', 'DM', 'CM', 'AM', 'ST', 'ST'],
};

/** Depth of each line for a team attacking to the right. */
const LINE_X: Readonly<Record<string, number>> = {
  GK: 7,
  CB: 20,
  RB: 24,
  LB: 24,
  DM: 33,
  CM: 41,
  AM: 50,
  RW: 57,
  LW: 57,
  ST: 62,
};
const WIDE_Y: Readonly<Record<string, number>> = {
  RB: 54,
  LB: 10,
  RW: 52,
  LW: 12,
};
const SPREAD: Readonly<Record<string, number>> = {
  CB: 13,
  DM: 16,
  CM: 18,
  AM: 16,
  ST: 13,
};
/** Lone central players of different lines do not queue on the same axis. */
const STAGGER: Readonly<Record<string, number>> = { CM: -7, AM: 7 };

/** Formation anchors (home orientation) for 11 position codes, by slot. */
export function anchorsForCodes(codes: readonly string[]): StagePoint[] {
  const normal = codes.map((code) => (code in LINE_X ? code : 'CM'));
  const counts = new Map<string, number>();
  for (const code of normal) counts.set(code, (counts.get(code) ?? 0) + 1);
  const wingBacks = (counts.get('CB') ?? 0) >= 3;
  const seen = new Map<string, number>();
  return normal.map((code) => {
    const index = seen.get(code) ?? 0;
    seen.set(code, index + 1);
    const total = counts.get(code) ?? 1;
    const wide = WIDE_Y[code];
    if (wide !== undefined) {
      const push = wingBacks && (code === 'RB' || code === 'LB') ? 9 : 0;
      return { x: LINE_X[code]! + push, y: wide };
    }
    const y =
      total === 1
        ? 32 + (STAGGER[code] ?? 0)
        : 32 + (index - (total - 1) / 2) * (SPREAD[code] ?? 14);
    return { x: LINE_X[code]!, y };
  });
}

function codesOf(lineup: readonly (StageSlotPlayer | null)[]): string[] {
  const known = lineup.every(
    (player) => player === null || player.position !== undefined,
  );
  return lineup.map((player, slot) =>
    known && player?.position ? player.position : DEFAULT_CODES[slot]!,
  );
}

/**
 * Anchors after a formation change: the new shape is handed to the slots in
 * depth order, so each athlete keeps roughly the zone he already covered.
 */
function reshape(
  current: readonly StagePoint[],
  formation: string,
): readonly StagePoint[] {
  const codes = FORMATION_CODES[formation];
  if (!codes) return current;
  const target = anchorsForCodes(codes);
  const order = (points: readonly StagePoint[]) =>
    points
      .map((anchor, slot) => ({ anchor, slot }))
      .slice(1)
      .sort(
        (left, right) =>
          left.anchor.x - right.anchor.x || left.anchor.y - right.anchor.y,
      );
  const from = order(current);
  const to = order(target);
  const next = [...current];
  next[0] = target[0]!;
  from.forEach(({ slot }, index) => {
    next[slot] = to[index]!.anchor;
  });
  return next;
}

/** Slots most likely to finish (furthest forward) and to build, by anchors. */
function rolesOf(anchors: readonly StagePoint[]) {
  const outfield = anchors
    .map((anchor, slot) => ({ anchor, slot }))
    .slice(1)
    .sort((left, right) => right.anchor.x - left.anchor.x);
  return {
    attackers: outfield.slice(0, 6).map(({ slot }) => slot),
    builders: outfield.slice(3).map(({ slot }) => slot),
    defenders: outfield
      .slice(-4)
      .reverse()
      .map(({ slot }) => slot),
  };
}

const BENCH: StagePoint = { x: 50, y: 63.2 };

export function hashSeed(text: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

/** mulberry32: tiny, fast and pure; returns values in [0, 1). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function playerKey(side: ReplaySide, slot: number): string {
  return `${side}-${slot}`;
}

export function attackDirection(side: ReplaySide): 1 | -1 {
  return side === 'home' ? 1 : -1;
}

/** x of the goal line a side attacks. */
export function attackedGoalX(side: ReplaySide): number {
  return side === 'home' ? PITCH.right : PITCH.left;
}

function opposite(side: ReplaySide): ReplaySide {
  return side === 'home' ? 'away' : 'home';
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function point(x: number, y: number): StagePoint {
  return {
    x: round(clamp(x, 0.3, PITCH.width - 0.3)),
    y: round(clamp(y, 1, PITCH.height - 0.5)),
  };
}

function orient(side: ReplaySide, anchor: StagePoint): StagePoint {
  return side === 'home'
    ? anchor
    : { x: PITCH.width - anchor.x, y: PITCH.height - anchor.y };
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function smooth(t: number): number {
  const clamped = clamp(t, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function easeOut(t: number): number {
  const clamped = clamp(t, 0, 1);
  return 1 - (1 - clamped) * (1 - clamped);
}

function toSlotPlayer(player: ReplayPlayer): StageSlotPlayer {
  return {
    id: player.id,
    number: player.number,
    name: player.name,
    ...(player.position === undefined ? {} : { position: player.position }),
  };
}

function initialLineup(input: MatchReplayInput): Lineup {
  const pick = (players: readonly ReplayPlayer[]) => {
    const starters = players.filter((player) => player.started !== false);
    const chosen = (starters.length >= SLOTS ? starters : players).slice(
      0,
      SLOTS,
    );
    // The keeper always owns slot 0, whatever order the source used.
    const keeper = chosen.findIndex((player) => player.position === 'GK');
    if (keeper > 0) chosen.unshift(...chosen.splice(keeper, 1));
    return Array.from({ length: SLOTS }, (_, slot) =>
      chosen[slot] ? toSlotPlayer(chosen[slot]) : null,
    );
  };
  return { home: pick(input.home.players), away: pick(input.away.players) };
}

function slotOf(
  lineup: Lineup,
  side: ReplaySide,
  playerId: string,
): number | undefined {
  const slot = lineup[side].findIndex((player) => player?.id === playerId);
  return slot >= 0 ? slot : undefined;
}

function applyEvents(
  input: MatchReplayInput,
  lineup: Lineup,
  events: readonly ReplayEvent[],
): Lineup {
  const next = { home: [...lineup.home], away: [...lineup.away] };
  for (const event of events) {
    const team = event.side === 'home' ? input.home : input.away;
    if (event.type === 'substitution') {
      const slot = next[event.side].findIndex(
        (player) => player?.id === event.playerOutId,
      );
      const incoming = team.players.find(
        (player) => player.id === event.playerInId,
      );
      if (slot >= 0 && incoming)
        next[event.side][slot] = toSlotPlayer(incoming);
    } else if (event.type === 'card' && event.card === 'red') {
      const slot = next[event.side].findIndex(
        (player) => player?.id === event.playerId,
      );
      if (slot >= 0) next[event.side][slot] = null;
    }
  }
  return next;
}

function kickoffPose(anchors: Anchors): Pose {
  const pose: Record<string, StagePoint> = {};
  for (const side of SIDES)
    anchors[side].forEach((anchor, slot) => {
      const compact = {
        x: Math.min(47, PITCH.left + (anchor.x - PITCH.left) * 0.8),
        y: anchor.y,
      };
      const placed = orient(side, compact);
      pose[playerKey(side, slot)] = point(placed.x, placed.y);
    });
  const striker = rolesOf(anchors.home).attackers[0] ?? 9;
  pose[playerKey('home', striker)] = point(48.6, 32);
  return pose;
}

function openPlayPose(
  anchors: Anchors,
  attacking: ReplaySide,
  ball: StagePoint,
  intensity: number,
  random: () => number,
): Record<string, StagePoint> {
  const pose: Record<string, StagePoint> = {};
  for (const side of SIDES) {
    const direction = attackDirection(side);
    const isAttacking = side === attacking;
    anchors[side].forEach((source, slot) => {
      const anchor = orient(side, source);
      const jitterX = (random() - 0.5) * 3;
      const jitterY = (random() - 0.5) * 3;
      if (slot === 0) {
        const goalX = side === 'home' ? 6.5 : PITCH.width - 6.5;
        pose[playerKey(side, slot)] = point(
          goalX + direction * (isAttacking ? intensity * 6 : 0),
          32 + (ball.y - 32) * 0.25,
        );
        return;
      }
      const shift = direction * (isAttacking ? 14 : -4) * intensity;
      const pullX = isAttacking ? 0.18 : 0.28;
      const pullY = isAttacking ? 0.15 : 0.3;
      pose[playerKey(side, slot)] = point(
        anchor.x + shift + (ball.x - anchor.x) * pullX + jitterX,
        anchor.y + (ball.y - anchor.y) * pullY + jitterY,
      );
    });
  }
  return pose;
}

function pickFrom<T>(options: readonly T[], random: () => number): T {
  return options[Math.floor(random() * options.length) % options.length]!;
}

function pickSlot(
  lineup: Lineup,
  side: ReplaySide,
  options: readonly number[],
  random: () => number,
  exclude: readonly (number | undefined)[] = [],
): number {
  const present = options.filter(
    (slot) => lineup[side][slot] && !exclude.includes(slot),
  );
  return pickFrom(present.length > 0 ? present : options, random);
}

function offset(base: StagePoint, dx: number, dy: number): StagePoint {
  return point(base.x + dx, base.y + dy);
}

interface SegmentPlan {
  readonly involvedSide: ReplaySide;
  readonly involvedSlot: number | undefined;
  readonly spot: StagePoint;
  readonly overlay: StageOverlay | null;
  readonly play: ReplayPlay | undefined;
}

type Finish = 'goal' | ChanceEnding;

function chanceEnding(
  event: Extract<ReplayEvent, { type: 'chance' }>,
  random: () => number,
): ChanceEnding {
  switch (event.outcome) {
    case 'saved':
      return 'saved';
    case 'blocked':
      return 'blocked';
    case 'woodwork':
      return 'post';
    case 'off_target':
      return random() < 0.5 ? 'wide' : 'over';
    default:
      // Before match-v4 the engine did not say how the chance ended.
      return pickFrom(['saved', 'wide', 'over'] as const, random);
  }
}

function planSegment(
  lineup: Lineup,
  anchors: Anchors,
  primary: ReplayEvent | undefined,
  attacking: ReplaySide,
  random: () => number,
): SegmentPlan {
  const direction = attackDirection(attacking);
  const goalX = attackedGoalX(attacking);
  const midfield = point(35 + random() * 30, 15 + random() * 34);
  if (!primary) {
    return {
      involvedSide: attacking,
      involvedSlot: undefined,
      spot: midfield,
      overlay: null,
      play: undefined,
    };
  }
  switch (primary.type) {
    case 'goal':
    case 'chance': {
      const roles = rolesOf(anchors[primary.side]);
      const named =
        primary.playerId === undefined
          ? undefined
          : slotOf(lineup, primary.side, primary.playerId);
      const slot =
        named ?? pickSlot(lineup, primary.side, roles.attackers, random);
      const play = primary.play;
      const spot =
        play === 'long_shot'
          ? point(
              goalX - direction * (24 + random() * 7),
              32 + (random() - 0.5) * 22,
            )
          : play === 'cross'
            ? point(
                goalX - direction * (6 + random() * 5),
                32 + (random() - 0.5) * 11,
              )
            : point(
                goalX - direction * (8 + random() * 12),
                32 + (random() - 0.5) * 26,
              );
      return {
        involvedSide: primary.side,
        involvedSlot: slot,
        spot,
        play,
        overlay:
          primary.type === 'goal'
            ? {
                kind: 'goal',
                side: primary.side,
                playerKey: playerKey(primary.side, slot),
              }
            : {
                kind: 'chance',
                side: primary.side,
                outcome: chanceEnding(primary, random),
              },
      };
    }
    case 'card':
    case 'injury': {
      const slot =
        slotOf(lineup, primary.side, primary.playerId) ??
        pickSlot(
          lineup,
          primary.side,
          rolesOf(anchors[primary.side]).builders,
          random,
        );
      const spot = point(
        goalX - direction * (20 + random() * 25),
        10 + random() * 44,
      );
      const key = playerKey(primary.side, slot);
      return {
        involvedSide: primary.side,
        involvedSlot: slot,
        spot,
        play: undefined,
        overlay:
          primary.type === 'card'
            ? {
                kind: 'card',
                side: primary.side,
                card: primary.card,
                playerKey: key,
              }
            : { kind: 'injury', side: primary.side, playerKey: key },
      };
    }
    case 'substitution': {
      const slot =
        slotOf(lineup, primary.side, primary.playerOutId) ??
        pickSlot(
          lineup,
          primary.side,
          rolesOf(anchors[primary.side]).builders,
          random,
        );
      return {
        involvedSide: primary.side,
        involvedSlot: slot,
        spot: point(42 + random() * 16, PITCH.bottom + 0.6),
        overlay: null,
        play: undefined,
      };
    }
    case 'tactical_change':
      return {
        involvedSide: primary.side,
        involvedSlot: undefined,
        spot: midfield,
        overlay: null,
        play: undefined,
      };
  }
}

function shotTarget(
  attacking: ReplaySide,
  finish: Finish,
  random: () => number,
): StagePoint {
  const direction = attackDirection(attacking);
  const behind = direction * (PITCH.netDepth * 0.75);
  const lineX = attackedGoalX(attacking);
  const inside =
    PITCH.goalTop + 1 + random() * (PITCH.goalBottom - PITCH.goalTop - 2);
  switch (finish) {
    case 'goal':
      return point(lineX + behind, inside);
    case 'wide': {
      const high = random() < 0.5;
      return point(
        lineX + behind * 1.6,
        high
          ? PITCH.goalTop - 2 - random() * 4
          : PITCH.goalBottom + 2 + random() * 4,
      );
    }
    case 'over':
      return point(lineX + behind * 1.6, inside);
    case 'post':
      return point(
        lineX - direction * 0.25,
        random() < 0.5 ? PITCH.goalTop : PITCH.goalBottom,
      );
    case 'saved':
    case 'blocked':
      // Saved: the keeper gathers in front of the line.
      return point(lineX - direction * 1.4, inside);
  }
}

function blendPose(
  from: Pose,
  to: Pose,
  t: number,
): Record<string, StagePoint> {
  const pose: Record<string, StagePoint> = {};
  for (const key of Object.keys(to)) {
    const target = to[key]!;
    const source = from[key] ?? target;
    pose[key] = point(lerp(source.x, target.x, t), lerp(source.y, target.y, t));
  }
  return pose;
}

function buildSegment(
  input: MatchReplayInput,
  step: number,
  minute: number,
  events: readonly ReplayEvent[],
  previousRest: Readonly<{ pose: Pose; ball: StagePoint }>,
  lineupBefore: Lineup,
  anchorsBefore: Anchors,
  last: boolean,
): StageSegment {
  const random = seededRandom(hashSeed(`${input.matchId}:stage:${step}`));
  const primary = primaryEvent(events);
  const attacking: ReplaySide = primary
    ? primary.type === 'card' || primary.type === 'injury'
      ? opposite(primary.side)
      : primary.side
    : random() < 0.5
      ? 'home'
      : 'away';
  const defending = opposite(attacking);
  const lineupAfter = applyEvents(input, lineupBefore, events);
  let anchors = anchorsBefore;
  for (const event of events)
    if (event.type === 'tactical_change')
      anchors = {
        ...anchors,
        [event.side]: reshape(anchors[event.side], event.formation),
      };
  const plan = planSegment(lineupBefore, anchors, primary, attacking, random);
  const direction = attackDirection(attacking);
  const lineX = attackedGoalX(attacking);
  const involvedKey =
    plan.involvedSlot === undefined
      ? undefined
      : playerKey(plan.involvedSide, plan.involvedSlot);
  const roles = rolesOf(anchors[attacking]);
  const play = plan.play;

  // Passing carriers from the attacking side, distinct from the protagonist.
  // The official assistant, when there is one, plays the last pass.
  const protagonistSlot =
    plan.involvedSide === attacking ? plan.involvedSlot : undefined;
  const assistSlot =
    primary &&
    (primary.type === 'goal' || primary.type === 'chance') &&
    primary.assistId !== undefined
      ? slotOf(lineupBefore, attacking, primary.assistId)
      : undefined;
  const carrierB =
    assistSlot !== undefined && assistSlot !== protagonistSlot
      ? assistSlot
      : pickSlot(lineupBefore, attacking, roles.builders, random, [
          protagonistSlot,
        ]);
  const carrierA = pickSlot(lineupBefore, attacking, roles.builders, random, [
    protagonistSlot,
    carrierB,
  ]);
  const receiver =
    protagonistSlot ??
    pickSlot(lineupBefore, attacking, roles.attackers, random, [
      carrierA,
      carrierB,
    ]);
  const keyA = playerKey(attacking, carrierA);
  const keyB = playerKey(attacking, carrierB);
  const keyReceiver = playerKey(attacking, receiver);
  const keeperKey = playerKey(defending, 0);

  const isShot =
    plan.overlay?.kind === 'goal' || plan.overlay?.kind === 'chance';
  const counter = play === 'counter';
  const openBall = point(
    50 - direction * (counter ? 24 : 8),
    14 + random() * 36,
  );
  const poseOpen = openPlayPose(
    anchors,
    attacking,
    openBall,
    counter ? 0.05 : 0.35,
    random,
  );
  const poseBuild = openPlayPose(
    anchors,
    attacking,
    plan.spot,
    isShot ? (counter ? 0.6 : 0.85) : 0.55,
    random,
  );
  poseBuild[keyReceiver] = offset(plan.spot, -direction * 1.4, 0.6);

  const extraPoses: Array<Readonly<{ p: number; pose: Pose }>> = [];
  const actions: StageAction[] = [];
  const ballKeys: BallKey[] = [{ p: 0, point: previousRest.ball, arc: 0 }];
  const feet = (pose: Pose, key: string) => offset(pose[key]!, direction, 0);
  let poseAction: Record<string, StagePoint> = { ...poseBuild };
  let poseRest: Record<string, StagePoint> = { ...poseBuild };

  if (isShot) {
    const finish: Finish =
      plan.overlay?.kind === 'chance' ? plan.overlay.outcome : 'goal';
    let shotAt: number = PHASES.build;

    // --- How the ball gets to the finisher. --------------------------------
    if (play === 'cross') {
      const wideY = random() < 0.5 ? 5.5 : 58.5;
      const wide = point(lineX - direction * (6 + random() * 4), wideY);
      poseOpen[keyB] = point(
        wide.x - direction * 20,
        wideY + (wideY < 32 ? 4 : -4),
      );
      const poseWide = blendPose(poseOpen, poseBuild, 0.6);
      poseWide[keyB] = offset(wide, -direction * 1.2, 0);
      poseBuild[keyB] = offset(wide, -direction * 0.6, 0);
      extraPoses.push({ p: 0.48, pose: poseWide });
      shotAt = 0.62;
      ballKeys.push(
        { p: 0.14, point: feet(poseOpen, keyA), arc: 0.06 },
        { p: PHASES.open, point: feet(poseOpen, keyB), arc: 0.12 },
        { p: 0.48, point: wide, arc: 0 },
        { p: shotAt, point: plan.spot, arc: 0.75 },
      );
      actions.push(
        { p: 0.14, playerKey: keyA, kind: 'pass' },
        { p: 0.48, playerKey: keyB, kind: 'pass' },
      );
    } else if (play === 'individual') {
      const start = poseOpen[keyReceiver]!;
      const mid = point(
        lerp(start.x, plan.spot.x, 0.5),
        lerp(start.y, plan.spot.y, 0.5) + (random() < 0.5 ? -5 : 5),
      );
      const poseDribble = blendPose(poseOpen, poseBuild, 0.5);
      poseDribble[keyReceiver] = offset(mid, -direction * 1.2, 0);
      extraPoses.push({ p: PHASES.carry, pose: poseDribble });
      ballKeys.push(
        { p: 0.14, point: feet(poseOpen, keyA), arc: 0.06 },
        { p: PHASES.open, point: feet(poseOpen, keyReceiver), arc: 0.1 },
        { p: PHASES.carry, point: mid, arc: 0 },
        { p: PHASES.build, point: plan.spot, arc: 0 },
      );
      actions.push({ p: 0.14, playerKey: keyA, kind: 'pass' });
    } else if (play === 'defensive_error') {
      const culprit = pickSlot(
        lineupBefore,
        defending,
        rolesOf(anchors[defending]).defenders,
        random,
      );
      const keyCulprit = playerKey(defending, culprit);
      const loss = point(
        lineX - direction * (20 + random() * 8),
        32 + (random() - 0.5) * 24,
      );
      poseOpen[keyCulprit] = offset(loss, direction * 1.2, 0);
      poseOpen[keyReceiver] = offset(loss, -direction * 5, 2);
      poseBuild[keyCulprit] = offset(loss, -direction * 1, 3);
      ballKeys.push(
        { p: 0.14, point: offset(loss, direction * 9, 4), arc: 0.05 },
        { p: PHASES.open, point: loss, arc: 0.08 },
        { p: 0.42, point: offset(loss, -direction * 2.5, 1), arc: 0 },
        { p: PHASES.build, point: plan.spot, arc: 0 },
      );
      actions.push({ p: 0.36, playerKey: keyReceiver, kind: 'tackle' });
    } else {
      ballKeys.push(
        { p: 0.14, point: feet(poseOpen, keyA), arc: 0.06 },
        { p: PHASES.open, point: feet(poseOpen, keyB), arc: 0.1 },
        {
          p: PHASES.carry,
          point: offset(poseBuild[keyReceiver]!, -direction * 4, 0),
          arc: counter ? 0.55 : 0.08,
        },
        { p: PHASES.build, point: plan.spot, arc: 0 },
      );
      actions.push(
        { p: 0.14, playerKey: keyA, kind: 'pass' },
        { p: PHASES.open, playerKey: keyB, kind: 'pass' },
      );
    }
    actions.push({
      p: shotAt,
      playerKey: keyReceiver,
      kind: play === 'cross' ? 'header' : 'shot',
    });

    // --- How it ends. --------------------------------------------------------
    poseAction = { ...poseBuild };
    poseRest = { ...poseBuild };
    poseAction[keyReceiver] = offset(plan.spot, direction * 1.6, 0.4);
    let target = shotTarget(attacking, finish, random);
    let rest = target;
    let arc = finish === 'over' ? 1 : 0.35;
    let restArc = 0;
    const keeperHome = poseBuild[keeperKey]!;
    const dive = (toY: number) => {
      poseAction[keeperKey] = point(lineX - direction * 1.6, toY);
      poseRest[keeperKey] = poseAction[keeperKey]!;
      actions.push({
        p: shotAt + 0.06,
        until: 0.94,
        playerKey: keeperKey,
        kind: 'dive',
        lean: toY < keeperHome.y ? -1 : 1,
      });
    };

    if (finish === 'goal') {
      // Beaten: the keeper goes the right way but short of the ball.
      dive(target.y + (target.y < 32 ? 4 : -4) * 0.5);
      const corner = point(lineX - direction * 6, plan.spot.y < 32 ? 6 : 58);
      poseRest[keyReceiver] = corner;
      const mates = roles.attackers
        .filter((slot) => slot !== receiver && lineupBefore[attacking][slot])
        .slice(0, 4);
      mates.forEach((slot, index) => {
        const key = playerKey(attacking, slot);
        poseRest[key] = offset(
          corner,
          -direction * (2.5 + index * 1.4),
          (index - 1.5) * 2.2,
        );
        actions.push({
          p: PHASES.action + 0.1,
          until: 1,
          playerKey: key,
          kind: 'celebrate',
        });
      });
      actions.push({
        p: PHASES.action + 0.05,
        until: 1,
        playerKey: keyReceiver,
        kind: 'celebrate',
      });
    } else {
      poseRest[keyReceiver] = offset(plan.spot, direction * 2.4, 0);
      if (finish === 'saved') {
        dive(target.y);
        rest = offset(poseRest[keeperKey]!, -direction * 0.8, 0);
      } else if (finish === 'blocked') {
        const block = point(
          lerp(plan.spot.x, lineX, 0.3),
          lerp(plan.spot.y, 32, 0.3),
        );
        const blocker =
          rolesOf(anchors[defending]).defenders.find(
            (slot) => lineupBefore[defending][slot],
          ) ?? 2;
        const keyBlocker = playerKey(defending, blocker);
        poseBuild[keyBlocker] = offset(block, direction * 2.5, 0.8);
        poseAction[keyBlocker] = offset(block, direction * 0.4, 0);
        poseRest[keyBlocker] = poseAction[keyBlocker]!;
        actions.push({
          p: shotAt + 0.04,
          playerKey: keyBlocker,
          kind: 'tackle',
        });
        target = block;
        arc = 0.08;
        rest = offset(block, -direction * 6, random() < 0.5 ? -7 : 7);
        restArc = 0.3;
      } else if (finish === 'post') {
        dive(target.y + (target.y < 32 ? 1.5 : -1.5));
        arc = 0.3;
        rest = offset(target, -direction * 8, target.y < 32 ? -5 : 5);
        restArc = 0.25;
      } else if (finish === 'wide') {
        dive(target.y < 32 ? PITCH.goalTop + 1 : PITCH.goalBottom - 1);
      }
      actions.push({
        p: PHASES.action + 0.08,
        until: 1,
        playerKey: keyReceiver,
        kind: 'despair',
      });
    }
    ballKeys.push(
      { p: PHASES.action, point: target, arc },
      { p: 1, point: rest, arc: restArc },
    );
  } else if (primary?.type === 'card' || primary?.type === 'injury') {
    const fouled = keyReceiver;
    poseBuild[fouled] = offset(plan.spot, -direction * 0.8, 0);
    poseAction = { ...poseBuild };
    poseRest = { ...poseBuild };
    if (involvedKey) {
      poseBuild[involvedKey] = offset(plan.spot, direction * 1.8, 1.2);
      poseAction[involvedKey] = offset(plan.spot, direction * 0.4, 0.6);
      poseRest[involvedKey] =
        primary.type === 'card' && primary.card === 'red'
          ? point(plan.spot.x, PITCH.bottom + 1)
          : offset(plan.spot, direction * 1.2, -1.6);
      if (primary.type === 'card') {
        actions.push(
          { p: PHASES.build + 0.05, playerKey: involvedKey, kind: 'tackle' },
          {
            p: PHASES.action - 0.03,
            until: 0.95,
            playerKey: fouled,
            kind: 'fall',
          },
        );
      } else {
        // The injured athlete stays down where the duel happened.
        poseRest[involvedKey] = poseAction[involvedKey]!;
        actions.push({
          p: PHASES.action - 0.03,
          until: 1,
          playerKey: involvedKey,
          kind: 'fall',
        });
      }
    }
    poseAction[fouled] = offset(plan.spot, 0, -0.4);
    poseRest[fouled] = offset(plan.spot, -direction * 0.6, 0.8);
    ballKeys.push(
      { p: 0.14, point: feet(poseOpen, keyA), arc: 0.06 },
      { p: PHASES.open, point: feet(poseOpen, keyB), arc: 0.1 },
      { p: PHASES.build, point: plan.spot, arc: 0.05 },
      { p: PHASES.action, point: offset(plan.spot, direction * 2, 1), arc: 0 },
      { p: 1, point: offset(plan.spot, direction * 2.4, 1.2), arc: 0 },
    );
    actions.push(
      { p: 0.14, playerKey: keyA, kind: 'pass' },
      { p: PHASES.open, playerKey: keyB, kind: 'pass' },
    );
  } else if (primary?.type === 'substitution' && involvedKey) {
    poseAction[involvedKey] = point(BENCH.x - 1.5, PITCH.bottom - 0.5);
    poseRest[involvedKey] = point(BENCH.x + 1.5, PITCH.bottom - 0.8);
    ballKeys.push(
      { p: 0.14, point: feet(poseOpen, keyA), arc: 0.06 },
      { p: PHASES.open, point: feet(poseOpen, keyB), arc: 0.1 },
      { p: PHASES.build, point: point(plan.spot.x, PITCH.bottom - 3), arc: 0 },
      { p: PHASES.action, point: plan.spot, arc: 0.1 },
      { p: 1, point: plan.spot, arc: 0 },
    );
    actions.push({ p: 0.14, playerKey: keyA, kind: 'pass' });
  } else {
    // Open play: tactical tweak or the run to full time.
    ballKeys.push(
      { p: 0.14, point: feet(poseOpen, keyA), arc: 0.06 },
      { p: PHASES.open, point: feet(poseOpen, keyB), arc: 0.1 },
      {
        p: PHASES.build,
        point: offset(poseBuild[keyReceiver]!, direction, 0),
        arc: 0.12,
      },
      { p: 1, point: offset(poseBuild[keyReceiver]!, direction, 0), arc: 0 },
    );
    actions.push(
      { p: 0.14, playerKey: keyA, kind: 'pass' },
      { p: PHASES.open, playerKey: keyB, kind: 'pass' },
    );
  }

  const overlay: StageOverlay | null =
    primary?.type === 'substitution' && involvedKey
      ? (() => {
          const outgoing = lineupBefore[primary.side][plan.involvedSlot!];
          const incoming = lineupAfter[primary.side][plan.involvedSlot!];
          return outgoing && incoming && outgoing.id !== incoming.id
            ? {
                kind: 'substitution' as const,
                side: primary.side,
                playerKey: involvedKey,
                inNumber: incoming.number,
                outNumber: outgoing.number,
              }
            : null;
        })()
      : plan.overlay;

  return {
    step,
    minute,
    events,
    primary,
    attacking,
    poseKeys: [
      { p: 0, pose: previousRest.pose },
      { p: PHASES.open, pose: poseOpen },
      ...extraPoses,
      { p: PHASES.build, pose: poseBuild },
      { p: PHASES.action, pose: poseAction },
      { p: 1, pose: poseRest },
    ].sort((left, right) => left.p - right.p),
    ballKeys,
    overlay,
    lineupBefore,
    lineupAfter,
    involvedKey,
    shot: isShot ? { from: plan.spot } : null,
    anchors,
    actions: actions.sort((left, right) => left.p - right.p),
    play,
    durationMs: last ? PLAY_MS.none : playDurationMs(events),
  };
}

function restOf(
  segment: StageSegment,
): Readonly<{ pose: Pose; ball: StagePoint }> {
  return {
    pose: segment.poseKeys[segment.poseKeys.length - 1]!.pose,
    ball: segment.ballKeys[segment.ballKeys.length - 1]!.point,
  };
}

/** Builds the whole choreography once per match. Pure and deterministic. */
export function buildChoreography(input: MatchReplayInput): StageChoreography {
  const duration = input.durationMinutes ?? 90;
  const eventMinutes = input.timeline.map((event) =>
    clamp(Math.floor(event.minute), 0, duration),
  );
  const minutes = [...new Set([0, ...eventMinutes, duration])].sort(
    (left, right) => left - right,
  );
  const eventsAt = (minute: number) =>
    input.timeline.filter((_, index) => eventMinutes[index] === minute);

  const firstLineup = applyEvents(input, initialLineup(input), eventsAt(0));
  const firstAnchors: Anchors = {
    home: anchorsForCodes(codesOf(firstLineup.home)),
    away: anchorsForCodes(codesOf(firstLineup.away)),
  };
  const kickoff = kickoffPose(firstAnchors);
  const segments: StageSegment[] = [
    {
      step: 0,
      minute: 0,
      events: eventsAt(0),
      primary: undefined,
      attacking: 'home',
      poseKeys: [{ p: 0, pose: kickoff }],
      ballKeys: [{ p: 0, point: { x: 50, y: 32 }, arc: 0 }],
      overlay: null,
      lineupBefore: firstLineup,
      lineupAfter: firstLineup,
      involvedKey: undefined,
      shot: null,
      anchors: firstAnchors,
      actions: [],
      play: undefined,
      durationMs: 0,
    },
  ];
  for (let step = 1; step < minutes.length; step += 1) {
    const previous = segments[step - 1]!;
    segments.push(
      buildSegment(
        input,
        step,
        minutes[step]!,
        eventsAt(minutes[step]!),
        restOf(previous),
        previous.lineupAfter,
        previous.anchors,
        step === minutes.length - 1,
      ),
    );
  }
  return { matchId: input.matchId, duration, minutes, segments };
}

/** Step the replay is at for a given official minute. */
export function stepForMinute(
  choreography: StageChoreography,
  minute: number,
): number {
  let step = 0;
  choreography.minutes.forEach((value, index) => {
    if (value <= minute) step = index;
  });
  return step;
}

function bracket<T extends { p: number }>(
  keys: readonly T[],
  progress: number,
): readonly [T, T, number] {
  if (keys.length === 1 || progress <= keys[0]!.p)
    return [keys[0]!, keys[0]!, 0];
  for (let index = 1; index < keys.length; index += 1) {
    const to = keys[index]!;
    if (progress <= to.p) {
      const from = keys[index - 1]!;
      const span = to.p - from.p;
      return [from, to, span <= 0 ? 1 : (progress - from.p) / span];
    }
  }
  const last = keys[keys.length - 1]!;
  return [last, last, 1];
}

/** Samples a segment at progress 0..1. Pure: same input, same frame. */
export function sampleStage(
  choreography: StageChoreography,
  step: number,
  progress: number,
): StageFrame {
  const index = clamp(Math.round(step), 0, choreography.segments.length - 1);
  const segment = choreography.segments[index]!;
  const p = clamp(progress, 0, 1);
  const [poseFrom, poseTo, poseT] = bracket(segment.poseKeys, p);
  const eased = smooth(poseT);
  const swapped = p >= PHASES.action;

  const players: StagePlayerFrame[] = [];
  for (const side of SIDES) {
    for (let slot = 0; slot < SLOTS; slot += 1) {
      const key = playerKey(side, slot);
      const before = segment.lineupBefore[side][slot] ?? null;
      const after = segment.lineupAfter[side][slot] ?? null;
      const identity = swapped ? (after ?? before) : before;
      const from = poseFrom.pose[key] ?? { x: 50, y: 32 };
      const to = poseTo.pose[key] ?? from;
      players.push({
        key,
        side,
        slot,
        number: identity?.number ?? 0,
        x: round(lerp(from.x, to.x, eased)),
        y: round(lerp(from.y, to.y, eased)),
        // A sent-off player walks off and disappears at rest.
        visible: before !== null && (after !== null || p < 1),
        involved: key === segment.involvedKey && p >= PHASES.open,
      });
    }
  }

  const [ballFrom, ballTo, ballT] = bracket(segment.ballKeys, p);
  const ballEased = easeOut(ballT);
  const height =
    ballTo.arc > 0 && ballFrom !== ballTo
      ? round(ballTo.arc * Math.sin(Math.PI * clamp(ballT, 0, 1)))
      : 0;

  const overlay = p >= PHASES.action ? segment.overlay : null;
  const inFlight =
    segment.shot !== null && p > PHASES.build && p < PHASES.action + 0.12;

  return {
    step: index,
    minute: segment.minute,
    progress: p,
    ball: {
      x: round(lerp(ballFrom.point.x, ballTo.point.x, ballEased)),
      y: round(lerp(ballFrom.point.y, ballTo.point.y, ballEased)),
      height,
    },
    players,
    overlay,
    celebration:
      segment.overlay?.kind === 'goal'
        ? round(smooth((p - PHASES.action) / (1 - PHASES.action)))
        : 0,
    shotFrom: inFlight && segment.shot ? segment.shot.from : null,
  };
}

export interface NormalizedStagePoint {
  /** 0 = home goal line side of the canvas, 1 = away side. */
  readonly u: number;
  /** 0 = far touchline, 1 = near touchline. */
  readonly v: number;
}

export interface NormalizedStageFrame extends Omit<
  StageFrame,
  'ball' | 'players' | 'shotFrom'
> {
  readonly ball: NormalizedStagePoint & Readonly<{ height: number }>;
  readonly players: readonly (Omit<StagePlayerFrame, 'x' | 'y'> &
    NormalizedStagePoint)[];
  readonly shotFrom: NormalizedStagePoint | null;
}

export function normalizeStagePoint(value: StagePoint): NormalizedStagePoint {
  return { u: round(value.x / PITCH.width), v: round(value.y / PITCH.height) };
}

/**
 * Renderer-agnostic view of `sampleStage`: positions as 0..1 fractions of
 * the 100x64 pitch box, so a Phaser, Three.js or perspective renderer can
 * consume the same trajectories.
 */
export function sampleStageNormalized(
  choreography: StageChoreography,
  step: number,
  progress: number,
): NormalizedStageFrame {
  const frame = sampleStage(choreography, step, progress);
  return {
    ...frame,
    ball: { ...normalizeStagePoint(frame.ball), height: frame.ball.height },
    players: frame.players.map(({ x, y, ...player }) => ({
      ...player,
      ...normalizeStagePoint({ x, y }),
    })),
    shotFrom: frame.shotFrom ? normalizeStagePoint(frame.shotFrom) : null,
  };
}
