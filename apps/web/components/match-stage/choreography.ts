/**
 * Deterministic, presentation-only choreography for the Phaser match stage.
 *
 * The official timeline (ADR 0001/0010) is the only input: this module never
 * changes the score, events or statistics and never re-simulates anything.
 * Positions and trajectories between events are derived from a seeded PRNG
 * keyed by the match id and the step index, so the same match always yields
 * the same animation.
 */
import type {
  MatchReplayInput,
  ReplayEvent,
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
}

export type StageOverlay =
  | Readonly<{ kind: 'goal'; side: ReplaySide; playerKey: string }>
  | Readonly<{
      kind: 'chance';
      side: ReplaySide;
      outcome: 'saved' | 'wide' | 'over';
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

/** 4-3-3 anchors for a team attacking to the right (home orientation). */
const ANCHORS: readonly StagePoint[] = [
  { x: 7, y: 32 },
  { x: 22, y: 10 },
  { x: 20, y: 25 },
  { x: 20, y: 39 },
  { x: 22, y: 54 },
  { x: 38, y: 16 },
  { x: 35, y: 32 },
  { x: 38, y: 48 },
  { x: 55, y: 14 },
  { x: 58, y: 32 },
  { x: 55, y: 50 },
];

const ATTACKERS = [9, 8, 10, 6, 5, 7] as const;
const BUILDERS = [2, 3, 5, 6, 7, 1, 4] as const;
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
  return side === 'home' ? anchor : { x: PITCH.width - anchor.x, y: anchor.y };
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
  return { id: player.id, number: player.number, name: player.name };
}

function initialLineup(input: MatchReplayInput): Lineup {
  const pick = (players: readonly ReplayPlayer[]) => {
    const starters = players.filter((player) => player.started !== false);
    const chosen = (starters.length >= SLOTS ? starters : players).slice(
      0,
      SLOTS,
    );
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

const PRIORITY: Readonly<Record<ReplayEvent['type'], number>> = {
  goal: 6,
  chance: 5,
  card: 4,
  injury: 3,
  substitution: 2,
  tactical_change: 1,
};

function primaryEvent(events: readonly ReplayEvent[]): ReplayEvent | undefined {
  let best: ReplayEvent | undefined;
  for (const event of events)
    if (!best || PRIORITY[event.type] > PRIORITY[best.type]) best = event;
  return best;
}

function kickoffPose(): Pose {
  const pose: Record<string, StagePoint> = {};
  for (const side of SIDES)
    ANCHORS.forEach((anchor, slot) => {
      const compact = {
        x: Math.min(47, PITCH.left + (anchor.x - PITCH.left) * 0.8),
        y: anchor.y,
      };
      const placed = orient(side, compact);
      pose[playerKey(side, slot)] = point(placed.x, placed.y);
    });
  pose[playerKey('home', 9)] = point(48.6, 32);
  return pose;
}

function openPlayPose(
  attacking: ReplaySide,
  ball: StagePoint,
  intensity: number,
  random: () => number,
): Record<string, StagePoint> {
  const pose: Record<string, StagePoint> = {};
  for (const side of SIDES) {
    const direction = attackDirection(side);
    const isAttacking = side === attacking;
    ANCHORS.forEach((source, slot) => {
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
}

function planSegment(
  lineup: Lineup,
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
    };
  }
  switch (primary.type) {
    case 'goal':
    case 'chance': {
      const slot =
        primary.type === 'goal'
          ? (slotOf(lineup, primary.side, primary.playerId) ??
            pickSlot(lineup, primary.side, ATTACKERS, random))
          : pickSlot(lineup, primary.side, ATTACKERS, random);
      const spot = point(
        goalX - direction * (8 + random() * 12),
        32 + (random() - 0.5) * 26,
      );
      const outcomes = ['saved', 'wide', 'over'] as const;
      return {
        involvedSide: primary.side,
        involvedSlot: slot,
        spot,
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
                outcome: pickFrom(outcomes, random),
              },
      };
    }
    case 'card':
    case 'injury': {
      const slot =
        slotOf(lineup, primary.side, primary.playerId) ??
        pickSlot(lineup, primary.side, BUILDERS, random);
      const spot = point(
        goalX - direction * (20 + random() * 25),
        10 + random() * 44,
      );
      const key = playerKey(primary.side, slot);
      return {
        involvedSide: primary.side,
        involvedSlot: slot,
        spot,
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
        pickSlot(lineup, primary.side, BUILDERS, random);
      return {
        involvedSide: primary.side,
        involvedSlot: slot,
        spot: point(42 + random() * 16, PITCH.bottom + 0.6),
        overlay: null,
      };
    }
    case 'tactical_change':
      return {
        involvedSide: primary.side,
        involvedSlot: undefined,
        spot: midfield,
        overlay: null,
      };
  }
}

function shotTarget(
  attacking: ReplaySide,
  overlay: StageOverlay | null,
  random: () => number,
): StagePoint {
  const behind = attackDirection(attacking) * (PITCH.netDepth * 0.75);
  const lineX = attackedGoalX(attacking);
  const inside =
    PITCH.goalTop + 1 + random() * (PITCH.goalBottom - PITCH.goalTop - 2);
  if (overlay?.kind === 'goal') return point(lineX + behind, inside);
  if (overlay?.kind === 'chance' && overlay.outcome === 'wide') {
    const high = random() < 0.5;
    return point(
      lineX + behind * 1.6,
      high
        ? PITCH.goalTop - 2 - random() * 4
        : PITCH.goalBottom + 2 + random() * 4,
    );
  }
  if (overlay?.kind === 'chance' && overlay.outcome === 'over')
    return point(lineX + behind * 1.6, inside);
  // Saved: the keeper gathers in front of the line.
  return point(lineX - attackDirection(attacking) * 1.4, inside);
}

function buildSegment(
  input: MatchReplayInput,
  step: number,
  minute: number,
  events: readonly ReplayEvent[],
  previousRest: Readonly<{ pose: Pose; ball: StagePoint }>,
  lineupBefore: Lineup,
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
  const lineupAfter = applyEvents(input, lineupBefore, events);
  const plan = planSegment(lineupBefore, primary, attacking, random);
  const direction = attackDirection(attacking);
  const involvedKey =
    plan.involvedSlot === undefined
      ? undefined
      : playerKey(plan.involvedSide, plan.involvedSlot);

  // Passing carriers from the attacking side, distinct from the protagonist.
  const protagonistSlot =
    plan.involvedSide === attacking ? plan.involvedSlot : undefined;
  const carrierA = pickSlot(lineupBefore, attacking, BUILDERS, random, [
    protagonistSlot,
  ]);
  const carrierB = pickSlot(lineupBefore, attacking, BUILDERS, random, [
    protagonistSlot,
    carrierA,
  ]);
  const receiver =
    protagonistSlot ??
    pickSlot(lineupBefore, attacking, ATTACKERS, random, [carrierA, carrierB]);
  const keyA = playerKey(attacking, carrierA);
  const keyB = playerKey(attacking, carrierB);
  const keyReceiver = playerKey(attacking, receiver);

  const openBall = point(50 - direction * 8, 14 + random() * 36);
  const poseOpen = openPlayPose(attacking, openBall, 0.35, random);
  const poseBuild = openPlayPose(
    attacking,
    plan.spot,
    plan.overlay?.kind === 'goal' || plan.overlay?.kind === 'chance'
      ? 0.85
      : 0.55,
    random,
  );
  poseBuild[keyReceiver] = offset(plan.spot, -direction * 1.4, 0.6);

  const poseAction: Record<string, StagePoint> = { ...poseBuild };
  const poseRest: Record<string, StagePoint> = { ...poseBuild };
  const defending = opposite(attacking);
  const keeperKey = playerKey(defending, 0);
  const isShot =
    plan.overlay?.kind === 'goal' || plan.overlay?.kind === 'chance';
  const target = isShot
    ? shotTarget(attacking, plan.overlay, random)
    : undefined;

  const ballKeys: BallKey[] = [{ p: 0, point: previousRest.ball, arc: 0 }];

  if (isShot && target) {
    poseAction[keyReceiver] = offset(plan.spot, direction * 1.6, 0.4);
    const keeperDiveY =
      plan.overlay?.kind === 'goal'
        ? target.y + (target.y < 32 ? 4 : -4)
        : target.y;
    poseAction[keeperKey] = point(
      attackedGoalX(attacking) - direction * 1.6,
      keeperDiveY,
    );
    poseRest[keeperKey] = poseAction[keeperKey]!;
    if (plan.overlay?.kind === 'goal') {
      const corner = point(
        attackedGoalX(attacking) - direction * 6,
        plan.spot.y < 32 ? 6 : 58,
      );
      poseRest[keyReceiver] = corner;
      const mates = ATTACKERS.filter((slot) => slot !== receiver).slice(0, 3);
      mates.forEach((slot, index) => {
        if (!lineupBefore[attacking][slot]) return;
        poseRest[playerKey(attacking, slot)] = offset(
          corner,
          -direction * (2.5 + index * 1.5),
          (index - 1) * 2.4,
        );
      });
    } else {
      poseRest[keyReceiver] = offset(plan.spot, direction * 2.4, 0);
    }
    const rest =
      plan.overlay?.kind === 'chance' && plan.overlay.outcome === 'saved'
        ? offset(poseRest[keeperKey]!, direction * -0.8, 0)
        : target;
    ballKeys.push(
      { p: 0.14, point: offset(poseOpen[keyA]!, direction, 0), arc: 0.06 },
      {
        p: PHASES.open,
        point: offset(poseOpen[keyB]!, direction, 0),
        arc: 0.1,
      },
      {
        p: PHASES.carry,
        point: offset(poseBuild[keyReceiver]!, -direction * 4, 0),
        arc: 0.08,
      },
      { p: PHASES.build, point: plan.spot, arc: 0 },
      {
        p: PHASES.action,
        point: target,
        arc:
          plan.overlay?.kind === 'chance' && plan.overlay.outcome === 'over'
            ? 1
            : 0.35,
      },
      { p: 1, point: rest, arc: 0 },
    );
  } else if (primary?.type === 'card' || primary?.type === 'injury') {
    const fouled = keyReceiver;
    poseBuild[fouled] = offset(plan.spot, -direction * 0.8, 0);
    if (involvedKey) {
      poseBuild[involvedKey] = offset(plan.spot, direction * 1.8, 1.2);
      poseAction[involvedKey] = offset(plan.spot, direction * 0.4, 0.6);
      poseRest[involvedKey] =
        primary.type === 'card' && primary.card === 'red'
          ? point(plan.spot.x, PITCH.bottom + 1)
          : offset(plan.spot, direction * 1.2, -1.6);
    }
    poseAction[fouled] = offset(plan.spot, 0, -0.4);
    poseRest[fouled] = offset(plan.spot, -direction * 0.6, 0.8);
    ballKeys.push(
      { p: 0.14, point: offset(poseOpen[keyA]!, direction, 0), arc: 0.06 },
      {
        p: PHASES.open,
        point: offset(poseOpen[keyB]!, direction, 0),
        arc: 0.1,
      },
      { p: PHASES.build, point: plan.spot, arc: 0.05 },
      { p: PHASES.action, point: offset(plan.spot, direction * 2, 1), arc: 0 },
      { p: 1, point: offset(plan.spot, direction * 2.4, 1.2), arc: 0 },
    );
  } else if (primary?.type === 'substitution' && involvedKey) {
    poseAction[involvedKey] = point(BENCH.x - 1.5, PITCH.bottom - 0.5);
    poseRest[involvedKey] = point(BENCH.x + 1.5, PITCH.bottom - 0.8);
    ballKeys.push(
      { p: 0.14, point: offset(poseOpen[keyA]!, direction, 0), arc: 0.06 },
      {
        p: PHASES.open,
        point: offset(poseOpen[keyB]!, direction, 0),
        arc: 0.1,
      },
      { p: PHASES.build, point: point(plan.spot.x, PITCH.bottom - 3), arc: 0 },
      { p: PHASES.action, point: plan.spot, arc: 0.1 },
      { p: 1, point: plan.spot, arc: 0 },
    );
  } else {
    // Open play: tactical tweak or the run to full time.
    ballKeys.push(
      { p: 0.14, point: offset(poseOpen[keyA]!, direction, 0), arc: 0.06 },
      {
        p: PHASES.open,
        point: offset(poseOpen[keyB]!, direction, 0),
        arc: 0.1,
      },
      {
        p: PHASES.build,
        point: offset(poseBuild[keyReceiver]!, direction, 0),
        arc: 0.12,
      },
      { p: 1, point: offset(poseBuild[keyReceiver]!, direction, 0), arc: 0 },
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
      { p: PHASES.build, pose: poseBuild },
      { p: PHASES.action, pose: poseAction },
      { p: 1, pose: poseRest },
    ],
    ballKeys,
    overlay,
    lineupBefore,
    lineupAfter,
    involvedKey,
    shot: isShot ? { from: plan.spot } : null,
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

  const kickoff = kickoffPose();
  const firstLineup = applyEvents(input, initialLineup(input), eventsAt(0));
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
