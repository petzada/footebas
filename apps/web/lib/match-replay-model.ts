import type { NarrationEvent } from '@footebas/engine/narration';

export type ReplaySide = 'home' | 'away';
/** How a chance was built and how it ended (match-v4, ADR 0015). */
export type ReplayPlay = NonNullable<NarrationEvent['play']>;
export type ReplayOutcome = NonNullable<NarrationEvent['outcome']>;

export interface ReplayPlayer {
  readonly id: string;
  readonly name: string;
  readonly number: number;
  readonly started?: boolean;
  readonly rating?: number;
}

export interface ReplayTeam {
  readonly id: string;
  readonly name: string;
  readonly abbreviation: string;
  readonly color: string;
  readonly players: readonly ReplayPlayer[];
}

export interface ReplayStatistics {
  readonly shots: number;
  /** Optional: only shown when the authoritative source provides it. */
  readonly shotsOnTarget?: number;
  /** Optional: only shown when the authoritative source provides it. */
  readonly possession?: number;
  readonly yellowCards: number;
  readonly redCards: number;
  readonly xg: number;
}

/** `note` carries the narration line when the source already wrote one. */
export type ReplayEvent = Readonly<{ note?: string }> &
  (
    | Readonly<{
        type: 'chance';
        minute: number;
        side: ReplaySide;
        xg: number;
        /** Shooter, assistant, play and outcome: absent before match-v4. */
        playerId?: string;
        assistId?: string;
        play?: ReplayPlay;
        outcome?: ReplayOutcome;
      }>
    | Readonly<{
        type: 'goal';
        minute: number;
        side: ReplaySide;
        playerId: string;
        assistId?: string;
        play?: ReplayPlay;
      }>
    | Readonly<{
        type: 'card';
        minute: number;
        side: ReplaySide;
        playerId: string;
        card: 'yellow' | 'red';
      }>
    | Readonly<{
        type: 'injury';
        minute: number;
        side: ReplaySide;
        playerId: string;
        rounds: number;
      }>
    | Readonly<{
        type: 'substitution';
        minute: number;
        side: ReplaySide;
        playerOutId: string;
        playerInId: string;
        source?: 'manager' | 'automatic';
      }>
    | Readonly<{
        type: 'tactical_change';
        minute: number;
        side: ReplaySide;
        formation: string;
        mentality: string;
      }>
  );

export interface MatchReplayInput {
  readonly matchId: string;
  readonly durationMinutes?: number;
  readonly home: ReplayTeam;
  readonly away: ReplayTeam;
  readonly finalScore: Readonly<{ home: number; away: number }>;
  readonly finalStatistics: Readonly<{
    home: ReplayStatistics;
    away: ReplayStatistics;
  }>;
  /** Ordered, authoritative events produced by the match engine. */
  readonly timeline: readonly ReplayEvent[];
}

export interface ReplayPoint {
  readonly x: number;
  readonly y: number;
}

export interface PositionedReplayPlayer extends ReplayPoint {
  readonly id: string;
  readonly name: string;
  readonly number: number;
  readonly rating?: number;
  readonly side: ReplaySide;
}

export interface ReplayTelemetry {
  readonly momentum: Readonly<{ home: number; away: number }>;
  readonly xgLite: Readonly<{ home: number; away: number }>;
  readonly chances: Readonly<{ home: number; away: number }>;
  readonly cards: Readonly<{ home: number; away: number }>;
}

export interface MatchReplayFrame {
  readonly minute: number;
  readonly complete: boolean;
  readonly score: Readonly<{ home: number; away: number }>;
  readonly eventIndex: number;
  readonly activeEvent?: ReplayEvent;
  readonly ball: ReplayPoint;
  readonly players: readonly PositionedReplayPlayer[];
  readonly telemetry: ReplayTelemetry;
  readonly description: string;
}

const HOME_ANCHORS: readonly ReplayPoint[] = [
  { x: 8, y: 32 },
  { x: 23, y: 9 },
  { x: 22, y: 24 },
  { x: 22, y: 40 },
  { x: 23, y: 55 },
  { x: 42, y: 13 },
  { x: 39, y: 32 },
  { x: 42, y: 51 },
  { x: 61, y: 12 },
  { x: 65, y: 32 },
  { x: 61, y: 52 },
] as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function hashUnit(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0) / 4_294_967_295;
}

function eventPlayerId(event: ReplayEvent | undefined): string | undefined {
  if (!event) return undefined;
  if ('playerId' in event) return event.playerId;
  if (event.type === 'substitution') return event.playerInId;
  return undefined;
}

function knownName(
  input: MatchReplayInput,
  id: string | undefined,
): string | undefined {
  return id === undefined
    ? undefined
    : [...input.home.players, ...input.away.players].find(
        (player) => player.id === id,
      )?.name;
}

function playerName(input: MatchReplayInput, id: string): string {
  return knownName(input, id) ?? 'Jogador';
}

/** How the play reached the finish ("Pedro finaliza após cruzamento"). */
const PLAY_LABELS: Readonly<Record<ReplayPlay, string>> = {
  build_up: 'após troca de passes',
  counter: 'em contra-ataque',
  individual: 'em jogada individual',
  cross: 'após cruzamento',
  long_shot: 'de fora da área',
  defensive_error: 'após erro da defesa',
};
const OUTCOME_LABELS: Readonly<Record<ReplayOutcome, string>> = {
  goal: 'gol',
  saved: 'defesa do goleiro',
  off_target: 'para fora',
  blocked: 'travado pela defesa',
  woodwork: 'na trave',
};

function describeChance(
  input: MatchReplayInput,
  event: Extract<ReplayEvent, { type: 'chance' }>,
  prefix: string,
): string {
  // Only athletes of the match are named; unknown shooters fall back to xG.
  const shooter = knownName(input, event.playerId);
  if (shooter === undefined)
    return `${prefix} cria uma chance de ${event.xg.toFixed(2)} xG.`;
  const play = event.play === undefined ? '' : ` ${PLAY_LABELS[event.play]}`;
  const outcome =
    event.outcome === undefined ? '' : `… ${OUTCOME_LABELS[event.outcome]}`;
  return `${prefix}: ${shooter} finaliza${play}${outcome}.`;
}

function describeGoal(
  input: MatchReplayInput,
  event: Extract<ReplayEvent, { type: 'goal' }>,
  prefix: string,
): string {
  const play = event.play === undefined ? '' : ` ${PLAY_LABELS[event.play]}`;
  const assistant = knownName(input, event.assistId);
  const assist = assistant === undefined ? '' : `, passe de ${assistant}`;
  return `${prefix} marca com ${playerName(input, event.playerId)}${play}${assist}.`;
}

export function describeReplayEvent(
  input: MatchReplayInput,
  event: ReplayEvent,
): string {
  const team = event.side === 'home' ? input.home : input.away;
  if (event.note) return `${event.minute}' · ${event.note}`;
  const prefix = `${event.minute}' · ${team.abbreviation}`;
  switch (event.type) {
    case 'chance':
      return describeChance(input, event, prefix);
    case 'goal':
      return describeGoal(input, event, prefix);
    case 'card':
      return `${prefix}: cartão ${event.card === 'red' ? 'vermelho' : 'amarelo'} para ${playerName(input, event.playerId)}.`;
    case 'injury':
      return `${prefix}: ${playerName(input, event.playerId)} sai lesionado.`;
    case 'substitution':
      return `${prefix}: entra ${playerName(input, event.playerInId)}, sai ${playerName(input, event.playerOutId)}.`;
    case 'tactical_change':
      return `${prefix} muda para ${event.formation}, mentalidade ${event.mentality}.`;
  }
}

function visiblePlayers(
  team: ReplayTeam,
  side: ReplaySide,
  events: readonly ReplayEvent[],
): readonly ReplayPlayer[] {
  const initial = team.players.filter((player) => player.started !== false);
  const active = (initial.length >= 11 ? initial : team.players).slice(0, 11);
  for (const event of events) {
    if (event.type !== 'substitution' || event.side !== side) continue;
    const slot = active.findIndex((player) => player.id === event.playerOutId);
    const incoming = team.players.find(
      (player) => player.id === event.playerInId,
    );
    if (slot >= 0 && incoming) active.splice(slot, 1, incoming);
  }
  return active;
}

function ballForEvent(
  matchId: string,
  event: ReplayEvent | undefined,
  eventIndex: number,
): ReplayPoint {
  if (!event) return { x: 50, y: 32 };
  const y = 10 + hashUnit(`${matchId}:${eventIndex}:${event.type}`) * 44;
  if (event.type === 'goal') return { x: event.side === 'home' ? 94 : 6, y };
  if (event.type === 'chance') return { x: event.side === 'home' ? 82 : 18, y };
  if (event.type === 'tactical_change')
    return { x: event.side === 'home' ? 46 : 54, y };
  return { x: event.side === 'home' ? 58 : 42, y };
}

function positionsForFrame(
  input: MatchReplayInput,
  events: readonly ReplayEvent[],
  activeEvent: ReplayEvent | undefined,
  ball: ReplayPoint,
): readonly PositionedReplayPlayer[] {
  const involvedId = eventPlayerId(activeEvent);
  return (['home', 'away'] as const).flatMap((side) => {
    const team = side === 'home' ? input.home : input.away;
    return visiblePlayers(team, side, events).map((player, index) => {
      const source = HOME_ANCHORS[index % HOME_ANCHORS.length]!;
      const anchor =
        side === 'home' ? source : { x: 100 - source.x, y: source.y };
      const eventBias = activeEvent?.side === side ? 0.2 : 0.08;
      const jitter =
        hashUnit(`${input.matchId}:${player.id}:${events.length}`) - 0.5;
      const isInvolved = player.id === involvedId;
      const x = isInvolved
        ? ball.x + (side === 'home' ? -3 : 3)
        : anchor.x + (ball.x - anchor.x) * eventBias + jitter * 2;
      const y = isInvolved
        ? ball.y + 2
        : anchor.y + (ball.y - anchor.y) * eventBias + jitter * 2;
      return {
        id: player.id,
        name: player.name,
        number: player.number,
        ...(player.rating === undefined ? {} : { rating: player.rating }),
        side,
        x: Number(clamp(x, 3, 97).toFixed(3)),
        y: Number(clamp(y, 3, 61).toFixed(3)),
      };
    });
  });
}

function telemetryForEvents(
  events: readonly ReplayEvent[],
  minute: number,
): ReplayTelemetry {
  const values = {
    home: { xg: 0, chances: 0, cards: 0, pressure: 0 },
    away: { xg: 0, chances: 0, cards: 0, pressure: 0 },
  };
  for (const event of events) {
    const side = values[event.side];
    if (event.type === 'chance') {
      side.xg += event.xg;
      side.chances += 1;
      if (minute - event.minute <= 15)
        side.pressure += (0.4 + event.xg) * (1 - (minute - event.minute) / 30);
    } else if (event.type === 'goal' && minute - event.minute <= 15) {
      side.pressure += 1.25 * (1 - (minute - event.minute) / 30);
    } else if (event.type === 'card') {
      side.cards += 1;
    }
  }
  const pressureTotal = values.home.pressure + values.away.pressure;
  const homeMomentum =
    pressureTotal === 0
      ? 50
      : Math.round((values.home.pressure / pressureTotal) * 100);
  return {
    momentum: { home: homeMomentum, away: 100 - homeMomentum },
    xgLite: {
      home: Number(values.home.xg.toFixed(2)),
      away: Number(values.away.xg.toFixed(2)),
    },
    chances: {
      home: values.home.chances,
      away: values.away.chances,
    },
    cards: { home: values.home.cards, away: values.away.cards },
  };
}

export function createMatchReplayFrame(
  input: MatchReplayInput,
  requestedMinute: number,
): MatchReplayFrame {
  const duration = input.durationMinutes ?? 90;
  const minute = clamp(Math.floor(requestedMinute), 0, duration);
  const visibleEvents = input.timeline.filter(
    (event) => event.minute <= minute,
  );
  const eventIndex = visibleEvents.length - 1;
  const activeEvent = visibleEvents[eventIndex];
  const score = visibleEvents.reduce(
    (current, event) => {
      if (event.type === 'goal') current[event.side] += 1;
      return current;
    },
    { home: 0, away: 0 },
  );
  const ball = ballForEvent(input.matchId, activeEvent, eventIndex);
  return {
    minute,
    complete: minute >= duration,
    score,
    eventIndex,
    activeEvent,
    ball,
    players: positionsForFrame(input, visibleEvents, activeEvent, ball),
    telemetry: telemetryForEvents(visibleEvents, minute),
    description: activeEvent
      ? describeReplayEvent(input, activeEvent)
      : 'Aguardando o apito inicial.',
  };
}

export function nextReplayMinute(
  input: MatchReplayInput,
  currentMinute: number,
): number {
  const duration = input.durationMinutes ?? 90;
  return (
    input.timeline.find((event) => event.minute > currentMinute)?.minute ??
    duration
  );
}

export function textualReplayAlternative(
  input: MatchReplayInput,
  frame: MatchReplayFrame,
): string {
  const homePlayers = frame.players
    .filter((player) => player.side === 'home')
    .map(
      (player) =>
        `${player.name} em ${Math.round(player.x)}, ${Math.round(player.y)}`,
    )
    .join('; ');
  const awayPlayers = frame.players
    .filter((player) => player.side === 'away')
    .map(
      (player) =>
        `${player.name} em ${Math.round(player.x)}, ${Math.round(player.y)}`,
    )
    .join('; ');
  return `${frame.minute} minutos. ${input.home.name} ${frame.score.home}, ${input.away.name} ${frame.score.away}. ${frame.description} Bola em ${Math.round(frame.ball.x)}, ${Math.round(frame.ball.y)}. Posições de ${input.home.name}: ${homePlayers}. Posições de ${input.away.name}: ${awayPlayers}.`;
}

export function statisticsFromTimeline(
  timeline: readonly ReplayEvent[],
): Readonly<{ home: ReplayStatistics; away: ReplayStatistics }> {
  const empty = () => ({ shots: 0, yellowCards: 0, redCards: 0, xg: 0 });
  const totals = { home: empty(), away: empty() };
  for (const event of timeline) {
    const side = totals[event.side];
    if (event.type === 'chance') {
      side.shots += 1;
      side.xg += event.xg;
    } else if (event.type === 'goal') side.shots += 1;
    else if (event.type === 'card') {
      if (event.card === 'red') side.redCards += 1;
      else side.yellowCards += 1;
    }
  }
  return {
    home: { ...totals.home, xg: Number(totals.home.xg.toFixed(2)) },
    away: { ...totals.away, xg: Number(totals.away.xg.toFixed(2)) },
  };
}
