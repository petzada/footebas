/* eslint-disable @typescript-eslint/no-non-null-assertion -- ids come from the same aggregate */
import type { CoachMessage, InboxTopic } from '@footebas/contracts';
import {
  clubCashBalance,
  createTransferListing,
  renewContract,
  transferWindowStatus,
  type CompetitionCalendarFixture,
  type MatchResult,
  type Money,
  type Player,
} from '@footebas/domain';
import { clubWageBill } from './career-world-rules.js';
import { marketOf } from './career-market.js';
import { INBOX_VOICE, type InboxVoiceKey } from './career-inbox-voice.js';
import type { CareerSnapshot } from './service.js';

/**
 * Generated inbox (docs/09 Central): board, athletes, press and notices.
 * Messages are created deterministically from the save on the dates the
 * season advances; each decision option carries a small, fixed effect that
 * `ResolveInboxDecision` applies once. Messages expire.
 */
export const INBOX_RULES_VERSION = 'career-inbox-v1' as const;
/** Upper bound of any confidence effect (board or fans), in points. */
export const MAX_CONFIDENCE_EFFECT = 5;
/** Upper bound of any morale effect, in points. */
export const MAX_MORALE_EFFECT = 10;
const KEPT_MESSAGES = 40;
const KEPT_KEYS = 400;
/** Read and deleted ids kept (well above the 20 messages the home shows). */
const KEPT_MARKS = 200;
const NOTICE_DAYS = 30;
const DAYS: Readonly<Record<string, number>> = {
  board: 14,
  player: 10,
  press: 5,
  contract: 30,
};
const RENEWAL_YEARS = 2;
const RENEWAL_RAISE = 1.1;
const CONTRACT_NOTICE_FROM = '-10-01';
const RENEWAL_REQUEST_FROM = '-07-01';
const MAX_CONTRACT_NOTICES = 3;
/** Days before the same athlete asks for minutes again (any answer). */
export const MINUTES_COOLDOWN_DAYS = 60;
/** Answers after which the athlete does not ask again in the season. */
const MINUTES_CLOSING_OPTIONS: ReadonlySet<string> = new Set([
  'deny',
  'list_player',
]);
const minutesAskedKey = (playerId: string, date: string) =>
  `player_minutes_asked|${playerId}|${date}`;
const minutesClosedKey = (playerId: string, year: string) =>
  `player_minutes_closed|${playerId}|${year}`;

export interface InboxEffect {
  board?: number;
  fans?: number;
  playerMorale?: number;
  squadMorale?: number;
  listPlayer?: boolean;
  renewal?: { wage: number; endsOn: string };
}

export interface InboxOptionState {
  id: string;
  label: string;
  effect: InboxEffect;
}

export type InboxKind = Extract<
  CoachMessage['kind'],
  'board_message' | 'player_request' | 'press_conference' | 'notice'
>;

export interface InboxMessageState {
  id: string;
  kind: InboxKind;
  topic: InboxTopic;
  subject: string;
  body: string;
  occurredOn: string;
  expiresOn: string;
  playerId?: string;
  options: InboxOptionState[];
  status: 'pending' | 'resolved' | 'expired' | 'info';
  chosenOptionId?: string;
  resolvedOn?: string;
}

export interface CareerInboxState {
  version: typeof INBOX_RULES_VERSION;
  messages: InboxMessageState[];
  /** Generation keys already used, so each trigger fires once. */
  keys: string[];
  /** Inbox ids (any source) the coach has seen, newest last. */
  read?: string[];
  /** Ids of offers and match reports the coach removed, newest last. */
  deleted?: string[];
}

export class InboxRuleError extends Error {
  public constructor(
    public readonly code: 'NOT_FOUND' | 'VALIDATION_ERROR' | 'FORBIDDEN',
    message: string,
  ) {
    super(message);
  }
}

export const emptyInbox = (): CareerInboxState => ({
  version: INBOX_RULES_VERSION,
  messages: [],
  keys: [],
});

const DAY = 86_400_000;
function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY)
    .toISOString()
    .slice(0, 10);
}
const addYears = (date: string, years: number) =>
  `${String(Number(date.slice(0, 4)) + years)}${date.slice(4)}`;
const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
const brl = (minor: number): string =>
  (minor / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
const signed = (value: number) =>
  `${value > 0 ? '+' : '−'}${String(Math.abs(value))}`;

function fill(text: string, names: Readonly<Record<string, string>>): string {
  return Object.entries(names).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    text,
  );
}

/** Readable consequences of an option, as the read model shows them. */
export function describeEffect(
  effect: InboxEffect,
  playerName = 'atleta',
): string[] {
  return [
    ...(effect.board === undefined
      ? []
      : [`Diretoria ${signed(effect.board)}`]),
    ...(effect.fans === undefined ? [] : [`Torcida ${signed(effect.fans)}`]),
    ...(effect.playerMorale === undefined
      ? []
      : [`Moral de ${playerName} ${signed(effect.playerMorale)}`]),
    ...(effect.squadMorale === undefined
      ? []
      : [`Moral do elenco ${signed(effect.squadMorale)}`]),
    ...(effect.listPlayer === true
      ? [`${playerName} na lista de transferências`]
      : []),
    ...(effect.renewal === undefined
      ? []
      : [`Contrato até ${effect.renewal.endsOn}`]),
  ].map((text) => text.slice(0, 80));
}

interface Context {
  readonly snapshot: CareerSnapshot;
  readonly inbox: CareerInboxState;
  readonly date: string;
  readonly clubId: string;
  readonly clubName: string;
}

function voice(
  context: Context,
  key: InboxVoiceKey,
  names: Readonly<Record<string, string>> = {},
): string {
  return fill(INBOX_VOICE[context.snapshot.coach.personality][key], {
    club: context.clubName,
    ...names,
  });
}

function push(
  context: Context,
  key: string,
  message: Omit<InboxMessageState, 'id' | 'occurredOn' | 'status'> & {
    status?: InboxMessageState['status'];
  },
): boolean {
  if (context.inbox.keys.includes(key)) return false;
  context.inbox.keys.push(key);
  context.inbox.messages.push({
    id: `mail_${slug(key)}`.slice(0, 128),
    occurredOn: context.date,
    status: message.options.length > 0 ? 'pending' : 'info',
    ...message,
  });
  return true;
}

function option(
  context: Context,
  topic: string,
  id: string,
  effect: InboxEffect,
  names: Readonly<Record<string, string>> = {},
): InboxOptionState {
  return {
    id,
    label: voice(context, `${topic}.${id}` as InboxVoiceKey, names),
    effect,
  };
}

function notice(
  context: Context,
  key: string,
  topic: InboxTopic,
  subject: string,
  body: string,
  note?: string,
  playerId?: string,
): void {
  push(context, key, {
    kind: 'notice',
    topic,
    subject,
    body:
      note === undefined
        ? body
        : `${body}\n${context.snapshot.managerName}: ${note}`,
    expiresOn: addDays(context.date, NOTICE_DAYS),
    options: [],
    ...(playerId === undefined ? {} : { playerId }),
  });
}

const squadOf = (context: Context): Player[] =>
  context.snapshot.players.filter(({ clubId }) => clubId === context.clubId);

function contractOf(context: Context, playerId: string) {
  return context.snapshot.world.contracts.find(
    (contract) =>
      contract.playerId === playerId &&
      contract.clubId === context.clubId &&
      (contract.status === 'active' || contract.status === 'expiring'),
  );
}

function renewalTerms(context: Context, playerId: string) {
  const contract = contractOf(context, playerId);
  if (contract === undefined) return undefined;
  return {
    wage: Math.round(Number(contract.wage) * RENEWAL_RAISE),
    endsOn: addYears(contract.endsOn, RENEWAL_YEARS),
  };
}

/** Transfer window notices and the board's sale or reinforcement request. */
function windowMessages(context: Context): void {
  const status = transferWindowStatus(context.date);
  if (!status.open || status.current === undefined) return;
  const window = status.current;
  const year = context.date.slice(0, 4);
  notice(
    context,
    `window_open|${window.id}|${year}`,
    'notice_window_open',
    'Janela de transferências aberta',
    `${window.name} aberta até ${window.closesOn}.`,
    voice(context, 'note.window_open'),
  );
  if ((status.daysRemaining ?? 99) <= 5)
    notice(
      context,
      `window_closing|${window.id}|${year}`,
      'notice_window_closing',
      'Janela de transferências fechando',
      `${window.name} fecha em ${window.closesOn}: restam ${String(status.daysRemaining)} dia(s).`,
      voice(context, 'note.window_closing'),
    );
  const club = context.snapshot.clubs.find(({ id }) => id === context.clubId)!;
  const cash = Number(
    clubCashBalance(context.snapshot.world.ledger, club.id, club.balance),
  );
  const bill = clubWageBill(context.snapshot.world, club.id);
  const key = `board_window|${window.id}|${year}`;
  if (cash < bill * 3) {
    const starters = new Set<string>(
      context.snapshot.lineup?.starters.map(({ playerId }) => playerId) ?? [],
    );
    const target = squadOf(context)
      .filter((player) => !starters.has(player.id))
      .filter((player) => contractOf(context, player.id) !== undefined)
      .sort(
        (left, right) =>
          Number(contractOf(context, right.id)!.wage) -
            Number(contractOf(context, left.id)!.wage) ||
          left.id.localeCompare(right.id),
      )[0];
    if (target === undefined) return;
    const names = { player: target.name };
    push(context, key, {
      kind: 'board_message',
      topic: 'board_sale',
      subject: 'Diretoria pede uma venda',
      body: `As finanças do ${context.clubName} estão apertadas (caixa de ${brl(cash)}). A diretoria pede a venda de ${target.name}, um dos maiores salários fora do time titular.`,
      expiresOn: minDate(addDays(context.date, DAYS.board!), window.closesOn),
      playerId: target.id,
      options: [
        option(
          context,
          'board_sale',
          'list_player',
          {
            listPlayer: true,
            board: 3,
          },
          names,
        ),
        option(context, 'board_sale', 'refuse', { board: -4 }, names),
      ],
    });
  } else if (cash > bill * 15)
    push(context, key, {
      kind: 'board_message',
      topic: 'board_reinforcement',
      subject: 'Diretoria oferece reforço',
      body: `Com o caixa em dia (${brl(cash)}), a diretoria do ${context.clubName} pergunta se o treinador quer um reforço nesta janela.`,
      expiresOn: minDate(addDays(context.date, DAYS.board!), window.closesOn),
      options: [
        option(context, 'board_reinforcement', 'commit', {
          board: 2,
          fans: 2,
        }),
        option(context, 'board_reinforcement', 'decline', {
          board: 1,
          squadMorale: 2,
        }),
      ],
    });
}

const minDate = (left: string, right: string) => (left < right ? left : right);

/** Contract-end notices from October and renewal requests from July. */
function contractMessages(context: Context): void {
  const year = context.date.slice(0, 4);
  const seasonEnd = `${year}-12-31`;
  const squad = squadOf(context).sort(
    (left, right) =>
      Number(right.strength) - Number(left.strength) ||
      left.id.localeCompare(right.id),
  );
  if (context.date >= `${year}${CONTRACT_NOTICE_FROM}`) {
    let sent = 0;
    for (const player of squad) {
      if (sent >= MAX_CONTRACT_NOTICES) break;
      const contract = contractOf(context, player.id);
      const terms = renewalTerms(context, player.id);
      if (contract === undefined || terms === undefined) continue;
      if (contract.endsOn > seasonEnd) continue;
      const names = {
        player: player.name,
        until: terms.endsOn,
        wage: brl(terms.wage),
      };
      if (
        push(context, `contract_end|${player.id}|${year}`, {
          kind: 'notice',
          topic: 'notice_contract_end',
          subject: `Fim de contrato: ${player.name}`,
          body: `O contrato de ${player.name} com o ${context.clubName} termina em ${contract.endsOn}.`,
          expiresOn: minDate(addDays(context.date, DAYS.contract!), seasonEnd),
          playerId: player.id,
          options: [
            option(
              context,
              'notice_contract_end',
              'renew',
              {
                renewal: terms,
              },
              names,
            ),
            option(context, 'notice_contract_end', 'release', {}, names),
          ],
        })
      )
        sent += 1;
    }
  }
  const monthKey = `player_renewal|${context.date.slice(0, 7)}`;
  if (
    context.date >= `${year}${RENEWAL_REQUEST_FROM}` &&
    !context.inbox.keys.includes(monthKey)
  ) {
    const nextYearEnd = `${String(Number(year) + 1)}-12-31`;
    const player = squad.slice(0, 5).find((candidate) => {
      const contract = contractOf(context, candidate.id);
      return (
        contract !== undefined &&
        contract.endsOn > seasonEnd &&
        contract.endsOn <= nextYearEnd &&
        !context.inbox.keys.includes(`player_renewal|${candidate.id}|${year}`)
      );
    });
    const terms =
      player === undefined ? undefined : renewalTerms(context, player.id);
    if (player !== undefined && terms !== undefined) {
      context.inbox.keys.push(monthKey);
      const names = {
        player: player.name,
        until: terms.endsOn,
        wage: brl(terms.wage),
      };
      push(context, `player_renewal|${player.id}|${year}`, {
        kind: 'player_request',
        topic: 'player_renewal',
        subject: `${player.name} quer renovar`,
        body: `${player.name} pediu para discutir a renovação do contrato, que termina em ${contractOf(context, player.id)!.endsOn}.`,
        expiresOn: addDays(context.date, DAYS.player!),
        playerId: player.id,
        options: [
          option(
            context,
            'player_renewal',
            'accept',
            {
              renewal: terms,
              playerMorale: 5,
            },
            names,
          ),
          option(
            context,
            'player_renewal',
            'deny',
            { playerMorale: -10 },
            names,
          ),
        ],
      });
    }
  }
}

export interface PlayedManagedMatch {
  readonly fixture: CompetitionCalendarFixture;
  readonly result: MatchResult;
  /** Managed results up to and including this match, oldest first. */
  readonly form: readonly ('W' | 'D' | 'L')[];
  readonly opponentName: string;
}

export interface InboxDayInput {
  readonly date: string;
  readonly played?: PlayedManagedMatch;
  /** Latest managed league position and the objective it is judged by. */
  readonly league?: { position: number; rounds: number };
}

function matchMessages(context: Context, played: PlayedManagedMatch): void {
  const { fixture, result } = played;
  const home = fixture.homeClubId === context.clubId;
  const side = home ? 'home' : 'away';
  const names = new Map(context.snapshot.players.map((p) => [p.id, p.name]));
  for (const performance of result.playerPerformances ?? []) {
    if (performance.side !== side) continue;
    const name = names.get(performance.playerId);
    if (name === undefined) continue;
    if (performance.injuryRounds > 0)
      notice(
        context,
        `injury|${fixture.id}|${performance.playerId}`,
        'notice_injury',
        `Lesão: ${name}`,
        `${name} se lesionou e deve desfalcar o ${context.clubName} por ${String(performance.injuryRounds)} rodada(s).`,
        voice(context, 'note.injury', { player: name }),
        performance.playerId,
      );
    if (performance.suspensionRounds > 0)
      notice(
        context,
        `suspension|${fixture.id}|${performance.playerId}`,
        'notice_suspension',
        `Suspensão: ${name}`,
        `${name} está suspenso por ${String(performance.suspensionRounds)} jogo(s).`,
        voice(context, 'note.suspension', { player: name }),
        performance.playerId,
      );
  }
  const goalsFor = home ? result.homeGoals : result.awayGoals;
  const goalsAgainst = home ? result.awayGoals : result.homeGoals;
  const situation =
    goalsFor > goalsAgainst ? 'win' : goalsFor < goalsAgainst ? 'loss' : 'draw';
  const month = context.date.slice(0, 7);
  const press = {
    win: [
      ['praise_group', { squadMorale: 2, fans: 1 }],
      ['stay_humble', { board: 2 }],
      ['provoke', { fans: 3, board: -2 }],
    ],
    draw: [
      ['see_positives', { squadMorale: 2 }],
      ['demand_more', { board: 2, squadMorale: -1 }],
      ['blame_referee', { fans: 2, board: -2 }],
    ],
    loss: [
      ['take_blame', { board: -1, fans: 2, squadMorale: 2 }],
      ['criticize_squad', { board: 2, squadMorale: -3 }],
      ['blame_referee', { fans: 2, board: -2 }],
    ],
  } as const satisfies Record<
    string,
    readonly (readonly [string, InboxEffect])[]
  >;
  push(context, `press|${month}`, {
    kind: 'press_conference',
    topic: 'press_conference',
    subject: 'Coletiva de imprensa',
    body: `Coletiva após o ${String(goalsFor)} x ${String(goalsAgainst)} contra o ${played.opponentName}: os repórteres querem a avaliação do treinador sobre o desempenho do ${context.clubName}.`,
    expiresOn: addDays(context.date, DAYS.press!),
    options: press[situation].map(([id, effect]) =>
      option(context, `press_${situation}`, id, { ...effect }),
    ),
  });
}

function boardMessages(context: Context, input: InboxDayInput): void {
  const manager = context.snapshot.world.manager;
  const season = String(context.snapshot.season);
  if (manager.boardConfidence < 30)
    push(context, `board_ultimatum|${season}`, {
      kind: 'board_message',
      topic: 'board_ultimatum',
      subject: 'Aviso da diretoria: cargo em risco',
      body: `A confiança da diretoria do ${context.clubName} no trabalho está em ${String(manager.boardConfidence)}%. Sem reação imediata, a demissão será discutida no fim da temporada.`,
      expiresOn: addDays(context.date, DAYS.board!),
      options: [
        option(context, 'board_ultimatum', 'promise_results', {
          board: 4,
          squadMorale: -2,
        }),
        option(context, 'board_ultimatum', 'defend_project', {
          board: -1,
          fans: 3,
        }),
      ],
    });
  const form = input.played?.form ?? [];
  const losses = form.slice(-5).filter((value) => value === 'L').length;
  const objective = context.snapshot.world.objectives.find(
    ({ status, metric }) =>
      status === 'active' &&
      (metric === 'league_position' || metric === 'avoid_relegation'),
  );
  const below =
    objective !== undefined &&
    input.league !== undefined &&
    input.league.rounds >= 8 &&
    input.league.position > objective.target;
  if (input.played === undefined || (losses < 3 && !below)) return;
  const reason =
    losses >= 3
      ? `${String(losses)} derrotas nos últimos ${String(Math.min(5, form.length))} jogos`
      : `o time está em ${String(input.league!.position)}º, abaixo da meta (${String(objective!.target)}º)`;
  push(context, `board_objective|${context.date.slice(0, 7)}`, {
    kind: 'board_message',
    topic: 'board_objective',
    subject: 'Diretoria cobra resultados',
    body: `A diretoria do ${context.clubName} cobra uma reação: ${reason}. Espera uma resposta do treinador.`,
    expiresOn: addDays(context.date, DAYS.board!),
    options: [
      option(context, 'board_objective', 'take_responsibility', {
        board: 3,
        fans: 1,
      }),
      option(context, 'board_objective', 'demand_squad', {
        board: 1,
        squadMorale: -3,
      }),
      option(context, 'board_objective', 'ask_patience', {
        board: -2,
        squadMorale: 2,
      }),
    ],
  });
}

/**
 * Whether this athlete may ask for minutes today: not after the coach said
 * no or listed him this season, not within the cooldown of his last request
 * (answered or ignored), and not while he is on the transfer list.
 */
function mayAskForMinutes(context: Context, playerId: string): boolean {
  const year = context.date.slice(0, 4);
  if (context.inbox.keys.includes(minutesClosedKey(playerId, year)))
    return false;
  const since = addDays(context.date, -MINUTES_COOLDOWN_DAYS);
  const prefix = minutesAskedKey(playerId, '');
  if (
    context.inbox.keys.some(
      (key) => key.startsWith(prefix) && key.slice(prefix.length) > since,
    ) ||
    context.inbox.messages.some(
      (message) =>
        message.topic === 'player_minutes' &&
        message.playerId === playerId &&
        message.occurredOn > since,
    )
  )
    return false;
  return !(context.snapshot.world.market?.listings ?? []).some(
    (listing) => listing.playerId === playerId,
  );
}

/**
 * A benched top player asks for minutes: at most once a month, one request
 * open at a time, each athlete respecting his cooldown and the answer given.
 */
function minutesRequest(context: Context, played: PlayedManagedMatch): void {
  if (
    context.inbox.messages.some(
      (message) =>
        message.topic === 'player_minutes' &&
        message.status === 'pending' &&
        message.expiresOn >= context.date,
    )
  )
    return;
  const side = played.fixture.homeClubId === context.clubId ? 'home' : 'away';
  const started = new Set(
    (played.result.playerPerformances ?? [])
      .filter((item) => item.side === side && item.started)
      .map(({ playerId }) => playerId),
  );
  const squad = squadOf(context)
    .filter((player) => player.injuryRounds === 0 && player.age >= 19)
    .sort(
      (left, right) =>
        Number(right.strength) - Number(left.strength) ||
        left.id.localeCompare(right.id),
    );
  const player = squad
    .slice(0, 9)
    .find(
      (candidate) =>
        !started.has(candidate.id) && mayAskForMinutes(context, candidate.id),
    );
  if (player === undefined) return;
  const names = { player: player.name };
  const monthKey = `player_minutes|${context.date.slice(0, 7)}`;
  if (context.inbox.keys.includes(monthKey)) return;
  context.inbox.keys.push(minutesAskedKey(player.id, context.date));
  push(context, monthKey, {
    kind: 'player_request',
    topic: 'player_minutes',
    subject: `${player.name} pede mais minutos`,
    body: `${player.name} pediu uma conversa: não começou jogando contra o ${played.opponentName} e quer mais minutos no ${context.clubName}.`,
    expiresOn: addDays(context.date, DAYS.player!),
    playerId: player.id,
    options: [
      option(
        context,
        'player_minutes',
        'promise_minutes',
        {
          playerMorale: 8,
        },
        names,
      ),
      option(context, 'player_minutes', 'deny', { playerMorale: -8 }, names),
      option(
        context,
        'player_minutes',
        'list_player',
        {
          playerMorale: -4,
          listPlayer: true,
        },
        names,
      ),
    ],
  });
}

function expire(inbox: CareerInboxState, date: string): void {
  for (const message of inbox.messages)
    if (message.status === 'pending' && message.expiresOn < date)
      message.status = 'expired';
}

function prune(inbox: CareerInboxState): void {
  const ordered = [...inbox.messages].sort(
    (left, right) =>
      right.occurredOn.localeCompare(left.occurredOn) ||
      left.id.localeCompare(right.id),
  );
  const kept = new Set(
    [
      ...ordered.filter(({ status }) => status === 'pending'),
      ...ordered.filter(({ status }) => status !== 'pending'),
    ]
      .slice(0, KEPT_MESSAGES)
      .map(({ id }) => id),
  );
  inbox.messages = inbox.messages.filter(({ id }) => kept.has(id));
  inbox.keys = inbox.keys.slice(-KEPT_KEYS);
}

/**
 * Generates the day's messages for the managed club (no randomness: every
 * trigger reads the save) and expires stale decisions.
 */
export function runInboxDay(
  snapshot: CareerSnapshot,
  input: InboxDayInput,
): void {
  const clubId = snapshot.world.manager.currentClubId;
  if (clubId === undefined || clubId !== snapshot.selectedClubId) return;
  snapshot.inbox ??= emptyInbox();
  const inbox = snapshot.inbox;
  expire(inbox, input.date);
  const context: Context = {
    snapshot,
    inbox,
    date: input.date,
    clubId,
    clubName: snapshot.clubs.find(({ id }) => id === clubId)?.name ?? 'clube',
  };
  windowMessages(context);
  contractMessages(context);
  boardMessages(context, input);
  if (input.played !== undefined) {
    matchMessages(context, input.played);
    minutesRequest(context, input.played);
  }
  prune(inbox);
}

const clamp = (value: number) => Math.max(0, Math.min(100, value));

function applyEffect(
  snapshot: CareerSnapshot,
  message: InboxMessageState,
  effect: InboxEffect,
): void {
  const world = snapshot.world;
  const clubId = world.manager.currentClubId;
  world.manager = {
    ...world.manager,
    boardConfidence: clamp(world.manager.boardConfidence + (effect.board ?? 0)),
    fanConfidence: clamp(world.manager.fanConfidence + (effect.fans ?? 0)),
  };
  const morale = (player: Player): number =>
    (player.id === message.playerId ? (effect.playerMorale ?? 0) : 0) +
    (effect.squadMorale ?? 0);
  snapshot.players = snapshot.players.map((player) =>
    player.clubId !== undefined &&
    player.clubId === clubId &&
    morale(player) !== 0
      ? ({
          ...player,
          morale: clamp(Number(player.morale) + morale(player)),
        } as Player)
      : player,
  );
  const player = snapshot.players.find(({ id }) => id === message.playerId);
  if (player === undefined || clubId === undefined || player.clubId !== clubId)
    return;
  if (effect.renewal !== undefined) {
    const renewal = effect.renewal;
    world.contracts = world.contracts.map((contract) =>
      contract.playerId === player.id &&
      contract.clubId === clubId &&
      (contract.status === 'active' || contract.status === 'expiring') &&
      contract.endsOn < renewal.endsOn
        ? renewContract(contract, {
            wage: renewal.wage as Money,
            endsOn: renewal.endsOn,
          })
        : contract,
    );
  }
  const borrowed = world.loans.some(
    (loan) =>
      loan.status === 'active' &&
      loan.playerId === player.id &&
      loan.borrowingClubId === clubId,
  );
  if (effect.listPlayer === true && !borrowed) {
    const market = marketOf(world);
    market.listings = [
      ...market.listings.filter(({ playerId }) => playerId !== player.id),
      createTransferListing({
        playerId: player.id,
        clubId: player.clubId,
        mode: 'sale',
        askingPrice: player.value,
        listedOn: snapshot.currentDate,
      }),
    ];
  }
}

/**
 * Applies the chosen option once. Repeating the same option is a no-op
 * (`unchanged`); another option on a resolved message, or any option after
 * the message expired, is refused.
 */
export function resolveInboxDecision(
  snapshot: CareerSnapshot,
  messageId: string,
  optionId: string,
): 'applied' | 'unchanged' {
  const message = snapshot.inbox?.messages.find(({ id }) => id === messageId);
  if (message === undefined)
    throw new InboxRuleError('NOT_FOUND', 'inbox message not found');
  const chosen = message.options.find(({ id }) => id === optionId);
  if (chosen === undefined)
    throw new InboxRuleError(
      'VALIDATION_ERROR',
      'option not offered by this message',
    );
  if (message.status === 'resolved') {
    if (message.chosenOptionId === optionId) return 'unchanged';
    throw new InboxRuleError(
      'VALIDATION_ERROR',
      'inbox message already resolved with another option',
    );
  }
  if (
    message.status === 'expired' ||
    message.expiresOn < snapshot.currentDate
  ) {
    message.status = 'expired';
    throw new InboxRuleError('VALIDATION_ERROR', 'inbox message expired');
  }
  applyEffect(snapshot, message, chosen.effect);
  if (
    message.topic === 'player_minutes' &&
    message.playerId !== undefined &&
    MINUTES_CLOSING_OPTIONS.has(optionId)
  ) {
    snapshot.inbox ??= emptyInbox();
    snapshot.inbox.keys.push(
      minutesClosedKey(message.playerId, snapshot.currentDate.slice(0, 4)),
    );
  }
  message.status = 'resolved';
  message.chosenOptionId = optionId;
  message.resolvedOn = snapshot.currentDate;
  return 'applied';
}

/** Inbox items of the generated messages, as the home read model shows them. */
export function generatedMessages(snapshot: CareerSnapshot): CoachMessage[] {
  const names = new Map<string, string>(
    snapshot.players.map((p) => [p.id, p.name]),
  );
  return (snapshot.inbox?.messages ?? []).map((message) => {
    const status =
      message.status === 'pending' && message.expiresOn < snapshot.currentDate
        ? 'expired'
        : message.status;
    const playerName =
      message.playerId === undefined ? undefined : names.get(message.playerId);
    return {
      id: message.id,
      kind: message.kind,
      topic: message.topic,
      subject: message.subject.slice(0, 160),
      body: message.body.slice(0, 600),
      occurredOn: message.occurredOn,
      ...(message.options.length === 0 || status === 'info'
        ? {}
        : {
            choice: {
              messageId: message.id,
              options: message.options.map(({ id, label, effect }) => ({
                id,
                label: label.slice(0, 160),
                effects: describeEffect(effect, playerName),
              })),
              expiresOn: message.expiresOn,
              status,
              ...(message.chosenOptionId === undefined
                ? {}
                : { chosenOptionId: message.chosenOptionId }),
            },
          }),
    };
  });
}

/** Whether a projected message still waits for the coach's decision. */
export function awaitsDecision(
  message: CoachMessage,
  currentDate: string,
): boolean {
  if (message.choice !== undefined)
    return (
      message.choice.status === 'pending' &&
      message.choice.expiresOn >= currentDate
    );
  return (
    message.decision !== undefined && message.decision.expiresOn >= currentDate
  );
}

const remember = (list: string[] | undefined, ids: readonly string[]) =>
  [...(list ?? []).filter((id) => !ids.includes(id)), ...ids].slice(
    -KEPT_MARKS,
  );

/**
 * Hides removed messages and flags what the coach has already read. Takes
 * every projected message (all sources), newest first.
 */
export function withInboxMarks(
  snapshot: CareerSnapshot,
  messages: readonly CoachMessage[],
): CoachMessage[] {
  const deleted = new Set(snapshot.inbox?.deleted ?? []);
  const read = new Set(snapshot.inbox?.read ?? []);
  return messages
    .filter(({ id }) => !deleted.has(id))
    .map((message) => ({ ...message, read: read.has(message.id) }));
}

/**
 * `MarkInboxRead`: remembers the ids that are in the inbox now; unknown or
 * already read ids change nothing.
 */
export function markInboxRead(
  snapshot: CareerSnapshot,
  visible: readonly CoachMessage[],
  messageIds: readonly string[],
): 'applied' | 'unchanged' {
  const known = new Set(visible.map(({ id }) => id));
  const already = new Set(snapshot.inbox?.read ?? []);
  const fresh = [...new Set(messageIds)].filter(
    (id) => known.has(id) && !already.has(id),
  );
  if (fresh.length === 0) return 'unchanged';
  snapshot.inbox ??= emptyInbox();
  snapshot.inbox.read = remember(snapshot.inbox.read, fresh);
  return 'applied';
}

/**
 * `DeleteInboxMessage`: generated messages leave the save (their generation
 * key stays, so they never come back); offers and match reports, projected
 * from elsewhere, are remembered as deleted. Waiting decisions are refused.
 */
export function deleteInboxMessage(
  snapshot: CareerSnapshot,
  visible: readonly CoachMessage[],
  messageId: string,
): 'applied' | 'unchanged' {
  if (snapshot.inbox?.deleted?.includes(messageId) === true) return 'unchanged';
  const message = visible.find(({ id }) => id === messageId);
  if (message === undefined) {
    // A generated message already removed is gone from the projection too.
    if (
      snapshot.inbox?.keys.some(
        (key) => `mail_${slug(key)}`.slice(0, 128) === messageId,
      ) === true
    )
      return 'unchanged';
    throw new InboxRuleError('NOT_FOUND', 'inbox message not found');
  }
  if (awaitsDecision(message, snapshot.currentDate))
    throw new InboxRuleError(
      'VALIDATION_ERROR',
      'decide this message before deleting it',
    );
  snapshot.inbox ??= emptyInbox();
  const inbox = snapshot.inbox;
  const generated = inbox.messages.some(({ id }) => id === messageId);
  if (generated)
    inbox.messages = inbox.messages.filter(({ id }) => id !== messageId);
  else inbox.deleted = remember(inbox.deleted, [messageId]);
  inbox.read = remember(inbox.read, [messageId]);
  return 'applied';
}
