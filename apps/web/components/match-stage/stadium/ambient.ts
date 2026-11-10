/**
 * Open play between highlights: a small tactical simulation that keeps the 22
 * athletes and the ball moving while the official clock runs through quiet
 * minutes. Teams hold their formation, press the ball and pass it around the
 * middle of the pitch; nobody ever shoots here, because shots, goals and
 * cards only come from the official timeline.
 *
 * Presentation only, in world metres (home attacks +X). Seeded, so a match
 * always starts its open play the same way.
 */
import {
  PITCH,
  seededRandom,
  type Anchors,
  type StagePoint,
} from '../choreography';
import { FIELD, unitsToWorld } from '../projection';

export const TEAM_SIZE = 11;
export const AGENTS = TEAM_SIZE * 2;

export interface AmbientAgent {
  x: number;
  z: number;
  vx: number;
  vz: number;
  active: boolean;
}

export interface AmbientBall {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

export interface AmbientEvent {
  readonly kind: 'kick' | 'tackle';
  /** Agent index (home 0..10, away 11..21). */
  readonly index: number;
  /** 0..1: how hard the ball was struck. */
  readonly power: number;
}

export interface AmbientSetup {
  readonly positions: readonly Readonly<{ x: number; z: number }>[];
  readonly ball: Readonly<{ x: number; y: number; z: number }>;
  readonly active: readonly boolean[];
  readonly anchors: Anchors;
  /** `kickoff` walks everybody back to their half before play resumes. */
  readonly mode: 'play' | 'kickoff';
  /** Side that restarts the game on a kickoff. */
  readonly side?: 'home' | 'away';
}

const HALF_X = FIELD.lineLength / 2 - 1.2;
const HALF_Z = FIELD.lineWidth / 2 - 1.2;
const BALL_RADIUS = 0.16;
const GRAVITY = 9.8;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

const sideOf = (index: number) => (index < TEAM_SIZE ? 0 : 1);
const directionOf = (index: number) => (index < TEAM_SIZE ? 1 : -1);
const slotOf = (index: number) => index % TEAM_SIZE;

function worldAnchor(index: number, anchor: StagePoint) {
  const world =
    index < TEAM_SIZE
      ? unitsToWorld(anchor.x, anchor.y)
      : unitsToWorld(PITCH.width - anchor.x, PITCH.height - anchor.y);
  return { x: world.x, z: world.z };
}

export function createAmbient(seed: number) {
  const random = seededRandom(seed);
  const agents: AmbientAgent[] = Array.from({ length: AGENTS }, () => ({
    x: 0,
    z: 0,
    vx: 0,
    vz: 0,
    active: true,
  }));
  const ball: AmbientBall = { x: 0, y: BALL_RADIUS, z: 0, vx: 0, vy: 0, vz: 0 };
  let anchors: Array<{ x: number; z: number }> = agents.map(() => ({
    x: 0,
    z: 0,
  }));
  let kickoffSpots: Array<{ x: number; z: number }> = anchors;
  let owner = -1;
  let passTarget = -1;
  let possession = 0;
  let time = 0;
  let decisionAt = 0;
  let flightStart = 0;
  let lastDuel = 0;
  let setupUntil = 0;
  let restartSide = 0;

  const nearest = (
    x: number,
    z: number,
    accept: (index: number) => boolean,
  ): number => {
    let best = -1;
    let bestDistance = Infinity;
    for (let index = 0; index < AGENTS; index += 1) {
      const agent = agents[index]!;
      if (!agent.active || !accept(index)) continue;
      const distance = Math.hypot(agent.x - x, agent.z - z);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    }
    return best;
  };

  const give = (index: number) => {
    owner = index;
    passTarget = -1;
    possession = sideOf(index);
    decisionAt = time + 0.8 + random() * 1.9;
  };

  const pass = (events: AmbientEvent[]) => {
    const from = agents[owner]!;
    const direction = directionOf(owner);
    let best = -1;
    let bestScore = -Infinity;
    for (let index = 0; index < AGENTS; index += 1) {
      const mate = agents[index]!;
      if (index === owner || !mate.active || sideOf(index) !== possession)
        continue;
      // The keeper is only an outlet when the ball is deep in his own half.
      if (slotOf(index) === 0 && from.x * direction > -22) continue;
      const distance = Math.hypot(mate.x - from.x, mate.z - from.z);
      if (distance < 5 || distance > 42) continue;
      const forward = clamp((mate.x - from.x) * direction, -20, 25);
      const rival = nearest(
        mate.x,
        mate.z,
        (other) => sideOf(other) !== possession,
      );
      const space =
        rival < 0
          ? 8
          : clamp(
              Math.hypot(agents[rival]!.x - mate.x, agents[rival]!.z - mate.z),
              0,
              8,
            );
      let score =
        forward * 0.035 -
        Math.abs(distance - 16) * 0.03 +
        space * 0.05 +
        random() * 0.9;
      // Open play stays out of the last third: chances belong to the timeline.
      if (mate.x * direction > 30) score -= 2.5;
      if (from.x * direction > 26) score -= forward * 0.08;
      if (score > bestScore) {
        bestScore = score;
        best = index;
      }
    }
    if (best < 0) {
      decisionAt = time + 0.6;
      return;
    }
    let target = best;
    // Now and then the pass is read by the other side.
    if (random() < 0.2) {
      const thief = nearest(
        agents[best]!.x,
        agents[best]!.z,
        (other) => sideOf(other) !== possession && slotOf(other) !== 0,
      );
      if (
        thief >= 0 &&
        Math.hypot(
          agents[thief]!.x - agents[best]!.x,
          agents[thief]!.z - agents[best]!.z,
        ) < 10
      )
        target = thief;
    }
    const mate = agents[target]!;
    const distance = Math.hypot(mate.x - from.x, mate.z - from.z);
    const lofted = distance > 26;
    const speed = clamp(11 + distance * 0.36, 12, lofted ? 20 : 24);
    const flight = distance / speed;
    const aimX = clamp(mate.x + mate.vx * flight * 0.7, -HALF_X, HALF_X);
    const aimZ = clamp(mate.z + mate.vz * flight * 0.7, -HALF_Z, HALF_Z);
    const aimed = Math.max(1, Math.hypot(aimX - ball.x, aimZ - ball.z));
    ball.vx = ((aimX - ball.x) / aimed) * speed;
    ball.vz = ((aimZ - ball.z) / aimed) * speed;
    ball.vy = lofted ? (GRAVITY * (aimed / speed)) / 2 : 0;
    events.push({
      kind: 'kick',
      index: owner,
      power: clamp(distance / 32, 0.25, 1),
    });
    owner = -1;
    passTarget = target;
    flightStart = time;
  };

  const stepBall = (dt: number, events: AmbientEvent[]) => {
    if (time < setupUntil) {
      ball.x = 0;
      ball.z = 0;
      ball.y = BALL_RADIUS;
      ball.vx = ball.vy = ball.vz = 0;
      return;
    }
    if (owner < 0 && passTarget < 0) {
      // Restart: the nearest athlete of the side with the ball takes it.
      const taker = nearest(
        ball.x,
        ball.z,
        (index) => sideOf(index) === restartSide && slotOf(index) !== 0,
      );
      if (taker >= 0) passTarget = taker;
      flightStart = time;
    }
    if (owner >= 0) {
      const carrier = agents[owner]!;
      const speed = Math.hypot(carrier.vx, carrier.vz);
      const headingX = speed > 0.3 ? carrier.vx / speed : directionOf(owner);
      const headingZ = speed > 0.3 ? carrier.vz / speed : 0;
      // The ball rolls a touch ahead of the feet, further at speed.
      const reach = 0.55 + Math.min(0.5, speed * 0.07);
      ball.vx = carrier.vx;
      ball.vz = carrier.vz;
      ball.vy = 0;
      ball.x += (carrier.x + headingX * reach - ball.x) * Math.min(1, dt * 12);
      ball.z += (carrier.z + headingZ * reach - ball.z) * Math.min(1, dt * 12);
      ball.y = BALL_RADIUS;
      if (time >= decisionAt) pass(events);
      else if (time - lastDuel > 1.3) {
        const presser = nearest(
          carrier.x,
          carrier.z,
          (index) => sideOf(index) !== possession && slotOf(index) !== 0,
        );
        if (
          presser >= 0 &&
          Math.hypot(
            agents[presser]!.x - carrier.x,
            agents[presser]!.z - carrier.z,
          ) < 1.25
        ) {
          lastDuel = time;
          if (random() < 0.4) {
            events.push({ kind: 'tackle', index: presser, power: 0.5 });
            give(presser);
          }
        }
      }
      return;
    }
    ball.vy -= GRAVITY * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.z += ball.vz * dt;
    if (ball.y <= BALL_RADIUS) {
      ball.y = BALL_RADIUS;
      ball.vy = Math.abs(ball.vy) > 1.6 ? -ball.vy * 0.42 : 0;
      const drag = Math.max(0, 1 - 0.9 * dt);
      ball.vx *= drag;
      ball.vz *= drag;
    }
    if (Math.abs(ball.x) > HALF_X || Math.abs(ball.z) > HALF_Z) {
      ball.x = clamp(ball.x, -HALF_X, HALF_X);
      ball.z = clamp(ball.z, -HALF_Z, HALF_Z);
      ball.vx = ball.vz = 0;
    }
    const target = passTarget >= 0 ? agents[passTarget] : undefined;
    if (
      target?.active &&
      ball.y < 1.7 &&
      Math.hypot(target.x - ball.x, target.z - ball.z) < 1.35
    ) {
      give(passTarget);
      return;
    }
    if (!target?.active || time - flightStart > 4.5) {
      const taker = nearest(ball.x, ball.z, (index) => slotOf(index) !== 0);
      if (taker >= 0) passTarget = taker;
      flightStart = time;
    }
  };

  const stepAgents = (dt: number) => {
    const setting = time < setupUntil;
    const ballX = clamp(ball.x, -40, 40);
    const presser =
      setting || owner < 0
        ? -1
        : nearest(
            ball.x,
            ball.z,
            (index) => sideOf(index) !== possession && slotOf(index) !== 0,
          );
    for (let index = 0; index < AGENTS; index += 1) {
      const agent = agents[index]!;
      if (!agent.active) continue;
      const direction = directionOf(index);
      const anchor = anchors[index]!;
      const has = sideOf(index) === possession;
      let tx: number;
      let tz: number;
      let pace = 0;
      if (setting) {
        tx = kickoffSpots[index]!.x;
        tz = kickoffSpots[index]!.z;
        pace = 5.4;
      } else if (slotOf(index) === 0) {
        const depth = clamp(
          (ball.x * direction + FIELD.lineLength / 2) / FIELD.lineLength,
          0,
          1,
        );
        tx = -direction * (FIELD.lineLength / 2) + direction * (3 + 9 * depth);
        tz = clamp(ball.z * 0.15, -4, 4);
      } else if (index === owner) {
        const advanced = agent.x * direction > 28;
        tx = agent.x + (advanced ? 0 : direction * 5);
        tz = agent.z + (anchor.z * 0.8 - agent.z) * 0.3;
        pace = 4.4;
      } else if (index === passTarget) {
        tx = ball.x + ball.vx * 0.45;
        tz = ball.z + ball.vz * 0.45;
        pace = 6.8;
      } else if (index === presser) {
        tx = ball.x;
        tz = ball.z;
        pace = 6.2;
      } else {
        tx = anchor.x * 0.6 + ballX * 0.55 + direction * (has ? 6 : -4);
        tz = anchor.z * 0.82 + ball.z * 0.2;
      }
      tx = clamp(tx, -HALF_X, HALF_X);
      tz = clamp(tz, -HALF_Z, HALF_Z);
      const dx = tx - agent.x;
      const dz = tz - agent.z;
      const distance = Math.hypot(dx, dz);
      const top = pace || (distance > 14 ? 6.2 : distance > 4 ? 4 : 2.4);
      const wanted = Math.min(top, distance * 1.7);
      const ease = Math.min(1, dt * 3.4);
      agent.vx +=
        ((distance > 0.01 ? (dx / distance) * wanted : 0) - agent.vx) * ease;
      agent.vz +=
        ((distance > 0.01 ? (dz / distance) * wanted : 0) - agent.vz) * ease;
    }
    // Nobody runs through anybody.
    for (let a = 0; a < AGENTS; a += 1) {
      const first = agents[a]!;
      if (!first.active) continue;
      for (let b = a + 1; b < AGENTS; b += 1) {
        const second = agents[b]!;
        if (!second.active) continue;
        const dx = second.x - first.x;
        const dz = second.z - first.z;
        const distance = Math.hypot(dx, dz);
        if (distance >= 1.1 || distance < 0.001) continue;
        const push = ((1.1 - distance) / distance) * 2.2;
        first.vx -= dx * push;
        first.vz -= dz * push;
        second.vx += dx * push;
        second.vz += dz * push;
      }
    }
    for (const agent of agents) {
      if (!agent.active) continue;
      agent.x += agent.vx * dt;
      agent.z += agent.vz * dt;
    }
  };

  return {
    agents,
    ball,
    /** Agent with the ball at his feet, or -1 while it travels. */
    get owner() {
      return owner;
    },
    /** True while everybody walks back for a kickoff. */
    get settingUp() {
      return time < setupUntil;
    },
    /** Starts open play from what is on the pitch right now. */
    reset(setup: AmbientSetup) {
      anchors = agents.map((_, index) =>
        worldAnchor(
          index,
          setup.anchors[index < TEAM_SIZE ? 'home' : 'away'][slotOf(index)]!,
        ),
      );
      kickoffSpots = agents.map((_, index) => {
        const anchor =
          setup.anchors[index < TEAM_SIZE ? 'home' : 'away'][slotOf(index)]!;
        return worldAnchor(index, {
          x: Math.min(46.5, PITCH.left + (anchor.x - PITCH.left) * 0.8),
          y: anchor.y,
        });
      });
      agents.forEach((agent, index) => {
        const from = setup.positions[index];
        agent.x = from?.x ?? anchors[index]!.x;
        agent.z = from?.z ?? anchors[index]!.z;
        agent.vx = 0;
        agent.vz = 0;
        agent.active = setup.active[index] ?? true;
      });
      ball.x = setup.ball.x;
      ball.y = Math.max(BALL_RADIUS, setup.ball.y);
      ball.z = setup.ball.z;
      ball.vx = ball.vy = ball.vz = 0;
      owner = -1;
      passTarget = -1;
      flightStart = time;
      restartSide = setup.side === 'away' ? 1 : 0;
      if (setup.mode === 'kickoff') {
        setupUntil = time + 3.2;
        possession = restartSide;
      } else {
        setupUntil = 0;
        const taker = nearest(ball.x, ball.z, (index) => slotOf(index) !== 0);
        restartSide = taker >= 0 ? sideOf(taker) : restartSide;
        possession = restartSide;
      }
    },
    /** Advances open play by `dt` seconds. */
    step(dt: number): AmbientEvent[] {
      const events: AmbientEvent[] = [];
      const delta = clamp(dt, 0, 0.1);
      if (delta <= 0) return events;
      time += delta;
      stepBall(delta, events);
      stepAgents(delta);
      return events;
    },
  };
}

export type Ambient = ReturnType<typeof createAmbient>;
