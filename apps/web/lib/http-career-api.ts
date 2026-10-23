import type {
  AutoPickStrategy,
  CareerApiPort,
  CareerList,
  CareerSummary,
  CoachProfile,
  CreateCareerInput,
  CareerView,
  PublicStats,
  Formation,
  MatchActionView,
  MatchResultView,
  MatchUpdate,
  OpponentView,
  PlayerView,
  SquadRole,
  StandingView,
  TacticsView,
} from '@/lib/career-api';
import type {
  CompetitionProductPort,
  CompetitionProductView,
  CompetitionView,
} from '@/lib/competition-product';
import type { MatchReplayInput, ReplayEvent } from '@/lib/match-replay-model';
import { statisticsFromTimeline } from '@/lib/match-replay-model';
import type {
  ContractView,
  LedgerEntryView,
  MarketPlayerView,
  Phase4View,
  TransferKind,
} from '@/lib/phase4-model';
import {
  marketRefusalMessage,
  type ChemistryView,
  type FinanceCategories,
  type LineupInput,
  type ListingInput,
  type MarketListingView,
  type MarketOfferInput,
  type MarketOfferView,
  type MarketQuery,
  type MarketView,
  type MembershipTier,
  type OfficeView,
  type SponsorContractView,
  type SponsorOfferView,
} from '@/lib/management-model';

/** A capability the authoritative server does not offer yet. Never faked. */
export class NotSupportedYetError extends Error {
  public constructor(capability: string) {
    super(`${capability} ainda não está disponível no servidor.`);
    this.name = 'NotSupportedYetError';
  }
}

export class ApiRequestError extends Error {
  public constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/** The bearer could not be renewed: the player has to sign in again. */
export class SessionExpiredError extends ApiRequestError {
  public constructor() {
    super('Sua sessão expirou. Entre novamente.', 401, 'UNAUTHORIZED');
    this.name = 'SessionExpiredError';
  }
}

/** Supplies the API bearer; `forceRefresh` asks for a renewed one. */
export type AccessTokenProvider = (options?: {
  forceRefresh?: boolean;
}) => Promise<string | null>;

export interface HttpCareerApiOptions {
  readonly baseUrl: string;
  /** Bearer source used on every call (Supabase access token). */
  readonly getAccessToken?: AccessTokenProvider;
  /**
   * Local development only: `login(email)` exchanges the e-mail for a bearer
   * at POST /v1/dev/session (NEXT_PUBLIC_AUTH_MODE=dev).
   */
  readonly devSession?: boolean;
  /** Called once the bearer is rejected and could not be renewed. */
  readonly onSessionExpired?: () => void;
  readonly fetch?: typeof fetch;
  readonly startDate?: string;
  readonly jobPollMs?: number;
  readonly storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  /** Clock for the public stats cache (ms since epoch). */
  readonly now?: () => number;
}

/** Public counters are cached on the client for five minutes. */
export const PUBLIC_STATS_TTL_MS = 5 * 60 * 1000;

interface CareerListModel {
  careers: {
    careerId: string;
    aggregateVersion: number;
    managerName?: string;
    clubId?: string;
    clubName?: string;
    season?: number;
    currentDate?: string;
    careerName?: string;
    coach?: CoachProfile;
    /** Last change timestamp (ISO), when the server sends it. */
    updatedAt?: string;
  }[];
  /** Plan limit (docs/09 decision 5). */
  limits?: { maxCareers: number; activeCareers?: number; anyClub?: boolean };
}

// --- transport shapes (subset of @footebas/contracts read models) ---
type Side = 'home' | 'away';
interface ClubSummary {
  id: string;
  name: string;
  shortName: string;
}
interface HomeModel {
  aggregateVersion: number;
  managerName: string;
  /** Optional so older servers keep working. */
  careerName?: string;
  coach?: CoachProfile;
  club?: ClubSummary;
  currentDate: string;
  season: number;
  nextFixtureId?: string;
  pendingActions: string[];
}
interface SquadPlayer {
  id: string;
  name: string;
  age: number;
  position: string;
  secondaryPositions: string[];
  preferredSide?: 'left' | 'right' | 'center';
  shirtNumber?: number;
  strength: number;
  traits: string[];
  condition: number;
  morale: number;
  matchSharpness: number;
  squadStatus: string;
  injuryRounds: number;
  suspensionRounds: number;
  lastMatchRating?: number;
  careerStats: {
    appearances: number;
    goals: number;
    yellowCards: number;
    redCards: number;
  };
  hiddenEstimates: Record<string, string>;
}
interface ServerTactic {
  formation: '4-4-2' | '4-3-3' | '3-5-2';
  mentality: 'balanced' | 'all_out_attack' | 'counter_attack';
  attackDirection: 'center' | 'wings';
  marking: 'light' | 'heavy' | 'very_heavy';
  buildUp?: 'short' | 'mixed' | 'direct';
  focus?: 'center' | 'wings' | 'balanced';
  press?: 'low' | 'medium' | 'high';
  defensiveLine?: 'deep' | 'normal' | 'high';
  markingStyle?: 'zonal' | 'mixed' | 'man';
}
interface SquadModel {
  club: ClubSummary;
  players: SquadPlayer[];
  tactic?: ServerTactic;
  lineup?: {
    formation: '4-4-2' | '4-3-3' | '3-5-2';
    starters: string[];
    bench: string[];
    reserves: string[];
  };
  chemistry?: ChemistryView;
}
/** `careerMarketReadModelSchema` (money in minor units). */
interface MarketModel {
  currentDate: string;
  club?: {
    id: string;
    name: string;
    cash: number;
    squadSize: number;
    maxSquadSize: number;
    monthlyWageBill: number;
  };
  window: {
    status: 'open' | 'closed';
    current?: { name: string; closesOn: string };
    daysRemaining?: number;
    next: { name: string; opensOn: string };
    daysUntilNext: number;
  };
  listings: (MarketListingView & { position: string })[];
  offersReceived: (MarketOfferView & {
    counterpartClubId?: string;
    decisionId?: string;
  })[];
  offersSent: (MarketOfferView & {
    counterpartClubId?: string;
    decisionId?: string;
  })[];
  loans: MarketView['loans'];
  search: {
    total: number;
    results: {
      id: string;
      name: string;
      age: number;
      position: string;
      strength: number;
      value: number;
      wage: number;
      clubId?: string;
      clubName?: string;
      origin?: 'national' | 'state' | 'foreign';
      country?: string;
      freeAgent: boolean;
      listed: boolean;
    }[];
  };
}
/** `careerOfficeReadModelSchema` (money in minor units). */
type OfficeModel = Omit<OfficeView, 'club' | 'coach'> & {
  club?: NonNullable<OfficeView['club']>;
  coach: OfficeView['coach'] & { profile: unknown; clubId?: string };
};
interface NextMatchModel {
  fixtureId: string;
  competition: string;
  round: number;
  date: string;
  homeClub: ClubSummary;
  awayClub: ClubSummary;
  preparation: {
    opponent: ClubSummary;
    venue: Side;
    recentForm: ('W' | 'D' | 'L')[];
    approximateStrength:
      'much_weaker' | 'weaker' | 'similar' | 'stronger' | 'much_stronger';
    absences: { playerName: string; reason: string; rounds: number }[];
  };
}
interface StandingsModel {
  competition: string;
  rows: {
    position: number;
    club: ClubSummary;
    played: number;
    points: number;
  }[];
}
interface PostMatchModel {
  matchId: string;
  fixtureId: string;
  homeClub: ClubSummary;
  awayClub: ClubSummary;
  score: { home: number; away: number };
  timeline: ReplayEvent[];
  participants?: { id: string; name: string; side: Side }[];
}
interface WorldModel {
  aggregateVersion: number;
  season: number;
  currentDate: string;
  manager: {
    employmentStatus: string;
    clubId?: string;
    boardConfidence: number;
    fanConfidence: number;
    prestige: number;
    seasons: number;
  };
  club?: {
    id: string;
    name: string;
    cash: number;
    monthlyWageBill: number;
    stadium: {
      capacity: number;
      ticketPrice: number;
      maintenance: number;
      quality: number;
    };
  };
  ledger: {
    id: string;
    occurredAt: string;
    kind: string;
    amount: number;
    label: string;
  }[];
  objectives: { metric: string; target: number; status: string }[];
  jobProposals: {
    id: string;
    clubName: string;
    minimumPrestige: number;
    status: string;
  }[];
  contracts: {
    contractId: string;
    playerId: string;
    playerName: string;
    endsOn: string;
    wage: number;
    status: string;
  }[];
  offers?: {
    id: string;
    playerId: string;
    status: string;
    fee: number;
    counterOf?: string;
    kind: TransferKind;
  }[];
  youth: {
    playerId: string;
    name: string;
    position: string;
    age: number;
    estimate: string;
    status: 'academy' | 'promoted' | 'released';
  }[];
  history: {
    id: string;
    type: string;
    season: number;
    clubName?: string;
    competitionId?: string;
    playerName?: string;
  }[];
}
interface MarketEntry {
  id: string;
  name: string;
  age: number;
  position: string;
  strength: number;
  value: number;
  wage: number;
  clubId?: string;
}

const POSITION_LABEL: Readonly<Record<string, string>> = {
  GK: 'GOL',
  CB: 'ZAG',
  RB: 'LD',
  LB: 'LE',
  DM: 'VOL',
  CM: 'MC',
  AM: 'MEI',
  RW: 'PD',
  LW: 'PE',
  ST: 'ATA',
};
const TRAIT_LABEL: Readonly<Record<string, string>> = {
  pace: 'Velocidade',
  crossing: 'Cruzamento',
  playmaking: 'Armação',
  passing: 'Passe',
  heading: 'Cabeceio',
  marking: 'Marcação',
  tackling: 'Desarme',
  finishing: 'Finalização',
  positioning: 'Colocação',
  aerial_command: 'Jogo aéreo',
  reflexes: 'Reflexos',
  penalty_saving: 'Pênaltis',
};
const FORMATION_SLOTS: Readonly<Record<string, readonly string[]>> = {
  '4-4-2': ['GK', 'RB', 'CB', 'CB', 'LB', 'CM', 'CM', 'RW', 'LW', 'ST', 'ST'],
  '4-3-3': ['GK', 'RB', 'CB', 'CB', 'LB', 'DM', 'CM', 'AM', 'RW', 'LW', 'ST'],
  '3-5-2': ['GK', 'CB', 'CB', 'CB', 'RB', 'LB', 'DM', 'CM', 'AM', 'ST', 'ST'],
};
const SERVER_POSITION: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(POSITION_LABEL).map(([server, client]) => [client, server]),
);
const DECISION_MINUTES = [15, 30, 45, 60, 75] as const;
const centsToBrl = (value: number) => Math.round(value / 100);
const brlToCents = (value: number) => Math.round(value * 100);
const moneyOf = <T extends Record<string, number>>(record: T): T =>
  Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, centsToBrl(value)]),
  ) as T;
const financesOf = <T extends FinanceCategories>(value: T): T => ({
  ...value,
  income: moneyOf(value.income),
  expenses: moneyOf(value.expenses),
  totalIncome: centsToBrl(value.totalIncome),
  totalExpenses: centsToBrl(value.totalExpenses),
  net: centsToBrl(value.net),
});
const sponsorOfferOf = (offer: SponsorOfferView): SponsorOfferView => ({
  ...offer,
  monthlyValue: centsToBrl(offer.monthlyValue),
  bonuses: moneyOf(offer.bonuses),
  terminationFee: centsToBrl(offer.terminationFee),
  ...(offer.counter
    ? {
        counter: {
          ...offer.counter,
          monthlyValue: centsToBrl(offer.counter.monthlyValue),
        },
      }
    : {}),
  ...(offer.counterRange ? { counterRange: moneyOf(offer.counterRange) } : {}),
});
const sponsorContractOf = (
  contract: SponsorContractView,
): SponsorContractView => ({
  ...contract,
  monthlyValue: centsToBrl(contract.monthlyValue),
  bonuses: moneyOf(contract.bonuses),
  terminationFee: centsToBrl(contract.terminationFee),
});
const offerOf = (
  offer: MarketModel['offersReceived'][number],
): MarketOfferView => ({
  id: offer.id,
  kind: offer.kind,
  playerId: offer.playerId,
  playerName: offer.playerName,
  ...(offer.counterpartClubName
    ? { counterpartClubName: offer.counterpartClubName }
    : {}),
  fee: centsToBrl(offer.fee),
  wage: centsToBrl(offer.wage),
  ...(offer.loan ? { loan: offer.loan } : {}),
  status: offer.status,
  createdOn: offer.createdOn,
  expiresOn: offer.expiresOn,
  awaiting: offer.awaiting,
  ...(offer.counterOf ? { counterOf: offer.counterOf } : {}),
});

const toServerTactic = (
  formation: Formation,
  tactics: TacticsView,
): ServerTactic => {
  if (formation === '5-3-2') throw new NotSupportedYetError('A formação 5-3-2');
  return {
    formation,
    mentality:
      tactics.mentality === 'attacking'
        ? 'all_out_attack'
        : tactics.mentality === 'cautious'
          ? 'counter_attack'
          : 'balanced',
    attackDirection: tactics.focus === 'wings' ? 'wings' : 'center',
    focus: tactics.focus === 'wings' ? 'wings' : 'center',
    marking:
      tactics.marking === 'very-strong'
        ? 'very_heavy'
        : tactics.marking === 'strong'
          ? 'heavy'
          : 'light',
    buildUp: tactics.buildUp,
    press: tactics.press,
    defensiveLine:
      tactics.defensiveLine === 'standard' ? 'normal' : tactics.defensiveLine,
  };
};

const fromServerTactic = (tactic?: ServerTactic): TacticsView => ({
  mentality:
    tactic?.mentality === 'all_out_attack'
      ? 'attacking'
      : tactic?.mentality === 'counter_attack'
        ? 'cautious'
        : 'balanced',
  buildUp: tactic?.buildUp ?? 'mixed',
  focus:
    (tactic?.focus ?? tactic?.attackDirection) === 'wings' ? 'wings' : 'middle',
  press: tactic?.press ?? 'medium',
  defensiveLine:
    tactic?.defensiveLine === 'deep'
      ? 'deep'
      : tactic?.defensiveLine === 'high'
        ? 'high'
        : 'standard',
  marking:
    tactic?.marking === 'very_heavy'
      ? 'very-strong'
      : tactic?.marking === 'light'
        ? 'light'
        : 'strong',
});

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number) as [number, number];
  const [ty, tm] = to.split('-').map(Number) as [number, number];
  return Math.max(0, (ty - fy) * 12 + (tm - fm));
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

interface LiveMatch {
  fixtureId: string;
  managedSide: Side;
  instructions: Record<string, unknown>[];
  actions: MatchActionView[];
  feed: MatchUpdate[];
  cursor: number;
  preview: PostMatchModel;
}

/**
 * CareerApiPort over the authoritative HTTP API. Every mutation is a
 * versioned, idempotent command; reads come from server projections.
 */
export class HttpCareerApi implements CareerApiPort {
  readonly #options: HttpCareerApiOptions;
  readonly #fetch: typeof fetch;
  #bearer?: string;
  #careerId: string | undefined;
  #version = 0;
  #squad: SquadModel | undefined;
  #roles = new Map<string, SquadRole>();
  /** Slot position (client code) of each starter, in lineup order. */
  #positions = new Map<string, string>();
  #scouted = new Set<string>();
  #match: LiveMatch | undefined;
  #sequence = 0;
  #listed = new Map<string, CareerListModel['careers'][number]>();
  #stats: { at: number; value: PublicStats | null } | undefined;

  public constructor(options: HttpCareerApiOptions) {
    this.#options = options;
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    if (options.devSession) {
      const stored = options.storage?.getItem('footebas-bearer');
      if (stored) this.#bearer = stored;
    }
  }

  // --- transport -----------------------------------------------------------
  async #token(forceRefresh: boolean): Promise<string | undefined> {
    const provider = this.#options.getAccessToken;
    if (!provider) return this.#bearer;
    return (
      (await provider(forceRefresh ? { forceRefresh } : undefined)) ?? undefined
    );
  }

  async #request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
    renewed = false,
  ): Promise<T> {
    const bearer = await this.#token(renewed);
    const response = await this.#fetch(`${this.#options.baseUrl}${path}`, {
      method,
      headers: {
        ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (response.status === 401 && path !== '/v1/dev/session') {
      // Commands carry idempotency keys, so replaying one once is safe.
      if (this.#options.getAccessToken && !renewed)
        return this.#request<T>(method, path, body, headers, true);
      this.#options.onSessionExpired?.();
      throw new SessionExpiredError();
    }
    const text = await response.text();
    const payload: unknown = text ? JSON.parse(text) : undefined;
    if (!response.ok) {
      const error = payload as { code?: string; message?: string } | undefined;
      throw new ApiRequestError(
        error?.code === 'VERSION_CONFLICT'
          ? 'A carreira mudou em outro lugar. Os dados foram recarregados; tente de novo.'
          : error?.code === 'UNAUTHORIZED'
            ? 'Sua sessão expirou. Entre novamente.'
            : ((error?.code && marketRefusalMessage(error.code)) ??
              error?.message ??
              'Não foi possível falar com o servidor.'),
        response.status,
        error?.code,
      );
    }
    return payload as T;
  }

  #key(kind: string): string {
    this.#sequence += 1;
    return `web:${kind}:${String(Date.now())}:${String(this.#sequence)}`;
  }

  async #command(
    type: string,
    payload: Record<string, unknown>,
  ): Promise<{ jobId?: string }> {
    const idempotencyKey = this.#key(type);
    try {
      const accepted = await this.#request<{
        aggregateVersion: number;
        jobId?: string;
      }>(
        'POST',
        '/v1/commands',
        {
          version: 1,
          commandId: `command_${slug(idempotencyKey)}`,
          idempotencyKey,
          expectedVersion: this.#version,
          type,
          payload,
        },
        { 'idempotency-key': idempotencyKey },
      );
      this.#version = accepted.aggregateVersion;
      if (accepted.jobId) await this.#waitJob(accepted.jobId);
      return accepted.jobId === undefined ? {} : { jobId: accepted.jobId };
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === 'VERSION_CONFLICT')
        await this.#refreshVersion();
      throw error;
    }
  }

  async #worldCommand(type: string, payload: Record<string, unknown>) {
    const idempotencyKey = this.#key(type);
    try {
      const receipt = await this.#request<{
        aggregateVersion: number;
        outcome: 'applied' | 'refused';
      }>('POST', '/v1/phase-four/commands', {
        version: 1,
        careerId: this.#career(),
        commandId: `command_${slug(idempotencyKey)}`,
        idempotencyKey,
        expectedVersion: this.#version,
        type,
        payload,
      });
      this.#version = receipt.aggregateVersion;
      if (receipt.outcome === 'refused')
        throw new ApiRequestError('A operação foi recusada pelo clube.', 409);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 409)
        await this.#refreshVersion();
      throw error;
    }
  }

  async #waitJob(jobId: string): Promise<void> {
    const pause = this.#options.jobPollMs ?? 250;
    for (let attempt = 0; attempt < 240; attempt++) {
      const status = await this.#request<{ state: string }>(
        'GET',
        `/v1/jobs/${jobId}`,
      );
      if (status.state === 'succeeded') {
        await this.#refreshVersion();
        return;
      }
      if (status.state === 'failed' && attempt > 20)
        throw new ApiRequestError('A simulação falhou no servidor.', 500);
      await new Promise((resolve) => setTimeout(resolve, pause));
    }
    throw new ApiRequestError('A simulação demorou demais.', 504);
  }

  async #refreshVersion() {
    const home = await this.#request<HomeModel>(
      'GET',
      `/v1/careers/${this.#career()}/home`,
    );
    this.#version = home.aggregateVersion;
  }

  #career(): string {
    if (!this.#careerId) throw new Error('Nenhuma carreira carregada.');
    return this.#careerId;
  }

  async #optional<T>(path: string): Promise<T | undefined> {
    try {
      return await this.#request<T>('GET', path);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 404)
        return undefined;
      throw error;
    }
  }

  /** Reads a career projection (used by the competition screens). */
  public async read<T>(view: string): Promise<T> {
    if (!this.#careerId) await this.getCareer();
    return this.#request<T>('GET', `/v1/careers/${this.#career()}/${view}`);
  }

  // --- session and career --------------------------------------------------
  /**
   * Starts a session and forgets any career cached for a previous player.
   * With a token provider the e-mail is ignored: identity comes from the
   * bearer. The dev session only exists when `devSession` is enabled.
   */
  async login(email: string) {
    this.#careerId = undefined;
    this.#version = 0;
    this.#squad = undefined;
    this.#roles = new Map();
    this.#scouted = new Set();
    this.#match = undefined;
    if (this.#options.getAccessToken) {
      if (!(await this.#token(false))) throw new SessionExpiredError();
      return;
    }
    if (!this.#options.devSession)
      throw new Error('Entre com sua conta para continuar.');
    if (!email.includes('@')) throw new Error('Informe um e-mail válido.');
    this.#bearer = (
      await this.#request<{ bearer: string }>('POST', '/v1/dev/session', {
        email,
      })
    ).bearer;
    this.#options.storage?.setItem('footebas-bearer', this.#bearer);
  }

  async createCareer({ coach, careerName, coachProfile }: CreateCareerInput) {
    if (!coach.trim()) throw new Error('Informe o nome do treinador.');
    this.#version = 0;
    // One key per creation: players may keep several careers (plan limit is
    // enforced by the server with CAREER_LIMIT_REACHED).
    const idempotencyKey = this.#key('CreateCareer');
    const accepted = await this.#request<{
      careerId: string;
      aggregateVersion: number;
    }>(
      'POST',
      '/v1/commands',
      {
        version: 1,
        commandId: `command_${slug(idempotencyKey)}`,
        idempotencyKey,
        expectedVersion: 0,
        type: 'CreateCareer',
        payload: {
          managerName: coach.trim(),
          startDate: this.#options.startDate ?? '2026-01-01',
          ...(careerName === undefined
            ? {}
            : { careerName: careerName.trim() }),
          ...(coachProfile === undefined
            ? {}
            : {
                coach: {
                  nationality: coachProfile.nationality,
                  avatar: coachProfile.avatar,
                  personality: coachProfile.personality,
                },
              }),
        },
      },
      { 'idempotency-key': idempotencyKey },
    );
    this.#careerId = accepted.careerId;
    this.#version = accepted.aggregateVersion;
  }

  async selectClub(club: string) {
    await this.#command('SelectClub', {
      careerId: this.#career(),
      clubId: `club_${slug(club)}`,
    });
  }

  /**
   * Public counters (coaches, clubs, athletes). The route may not exist yet:
   * any failure resolves to `null` so the screen simply hides them.
   */
  async getPublicStats(): Promise<PublicStats | null> {
    const now = (this.#options.now ?? Date.now)();
    if (this.#stats && now - this.#stats.at < PUBLIC_STATS_TTL_MS)
      return this.#stats.value;
    let value: PublicStats | null = null;
    try {
      const response = await this.#fetch(
        `${this.#options.baseUrl}/v1/public/stats`,
        { method: 'GET' },
      );
      if (response.ok) {
        const body = (await response.json()) as Partial<PublicStats>;
        const valid = (['coaches', 'clubs', 'athletes'] as const).every(
          (key) => Number.isFinite(body[key]) && Number(body[key]) >= 0,
        );
        if (valid)
          value = {
            coaches: Number(body.coaches),
            clubs: Number(body.clubs),
            athletes: Number(body.athletes),
          };
      }
    } catch {
      value = null;
    }
    this.#stats = { at: now, value };
    return value;
  }

  async listCareers(): Promise<CareerList> {
    const list = await this.#request<CareerListModel>('GET', '/v1/careers');
    this.#listed = new Map(list.careers.map((item) => [item.careerId, item]));
    return {
      careers: list.careers.map((item): CareerSummary => ({
        id: item.careerId,
        coach: item.managerName ?? 'Treinador',
        ...(item.careerName ? { name: item.careerName } : {}),
        ...(item.coach ? { coachProfile: item.coach } : {}),
        ...(item.clubName ? { clubName: item.clubName } : {}),
        ...(item.season === undefined ? {} : { season: item.season }),
        ...(item.currentDate ? { currentDate: item.currentDate } : {}),
        ...(item.updatedAt ? { updatedAt: item.updatedAt } : {}),
      })),
      ...(list.limits === undefined
        ? {}
        : {
            limit: list.limits.maxCareers,
            ...(list.limits.anyClub === undefined
              ? {}
              : { anyClub: list.limits.anyClub }),
          }),
    };
  }

  async openCareer(careerId: string): Promise<CareerView | null> {
    if (!this.#listed.has(careerId)) await this.listCareers();
    const listed = this.#listed.get(careerId);
    if (!listed) throw new Error('Carreira não encontrada.');
    this.#careerId = careerId;
    this.#version = listed.aggregateVersion;
    this.#squad = undefined;
    this.#roles = new Map();
    this.#match = undefined;
    if (listed.clubId === undefined) return null;
    return this.#view();
  }

  /** Sends `DeleteCareer` in the same versioned envelope as every command. */
  async deleteCareer(careerId: string): Promise<void> {
    if (!this.#listed.has(careerId)) await this.listCareers();
    const listed = this.#listed.get(careerId);
    if (!listed) throw new Error('Carreira não encontrada.');
    const idempotencyKey = this.#key('DeleteCareer');
    await this.#request(
      'POST',
      '/v1/commands',
      {
        version: 1,
        commandId: `command_${slug(idempotencyKey)}`,
        idempotencyKey,
        expectedVersion: listed.aggregateVersion,
        type: 'DeleteCareer',
        payload: { careerId },
      },
      { 'idempotency-key': idempotencyKey },
    );
    this.#listed.delete(careerId);
    if (this.#careerId === careerId) {
      this.#careerId = undefined;
      this.#version = 0;
      this.#squad = undefined;
      this.#match = undefined;
    }
  }

  async getCareer(): Promise<CareerView | null> {
    if (!this.#careerId) {
      const list = await this.#request<CareerListModel>('GET', '/v1/careers');
      const career = list.careers.find(({ clubId }) => clubId !== undefined);
      if (!career) return null;
      this.#careerId = career.careerId;
      this.#version = career.aggregateVersion;
    }
    return this.#view();
  }

  async #view(): Promise<CareerView> {
    const id = this.#career();
    const [home, squad, next, standings, post, world] = await Promise.all([
      this.#request<HomeModel>('GET', `/v1/careers/${id}/home`),
      this.#request<SquadModel>('GET', `/v1/careers/${id}/squad`),
      this.#optional<NextMatchModel>(`/v1/careers/${id}/next-match`),
      this.#optional<StandingsModel>(`/v1/careers/${id}/standings`),
      this.#optional<PostMatchModel>(`/v1/careers/${id}/post-match`),
      this.#request<WorldModel>('GET', `/v1/careers/${id}/world`),
    ]);
    this.#version = home.aggregateVersion;
    this.#squad = squad;
    this.#roles = this.#rolesFrom(squad);
    const players = squad.players.map((player) => this.#player(player));
    return {
      careerId: id,
      coach: home.managerName,
      ...(home.careerName ? { careerName: home.careerName } : {}),
      ...(home.coach ? { coachProfile: home.coach } : {}),
      club: home.club?.name ?? squad.club.name,
      ...(standings?.competition ? { division: standings.competition } : {}),
      ...(next
        ? {
            fixture: {
              competition: next.competition,
              date: next.date,
              venue: next.preparation.venue,
            },
          }
        : {}),
      round: next?.round ?? 0,
      formation: squad.lineup?.formation ?? squad.tactic?.formation ?? '4-4-2',
      tactics: fromServerTactic(squad.tactic),
      players,
      standings: (standings?.rows ?? []).map((row): StandingView => ({
        position: row.position,
        club: row.club.name,
        played: row.played,
        points: row.points,
      })),
      opponent: this.#opponent(next, players),
      world: await this.#world(world, squad),
      ...(post === undefined
        ? {}
        : { lastResult: this.#result(post, squad, home.club?.id) }),
      ...(squad.chemistry ? { chemistry: squad.chemistry } : {}),
    };
  }

  #rolesFrom(squad: SquadModel): Map<string, SquadRole> {
    const starters = new Set(squad.lineup?.starters ?? []);
    const bench = new Set(squad.lineup?.bench ?? []);
    // The server keeps starters in slot order (SetLineup/AutoPickLineup).
    const slots = FORMATION_SLOTS[squad.lineup?.formation ?? ''] ?? [];
    this.#positions = new Map(
      (squad.lineup?.starters ?? []).flatMap((id, index) => {
        const slot = slots[index];
        return slot ? [[id, POSITION_LABEL[slot] ?? slot] as const] : [];
      }),
    );
    return new Map(
      squad.players.map((player) => [
        player.id,
        starters.has(player.id)
          ? 'starter'
          : bench.has(player.id)
            ? 'bench'
            : 'reserve',
      ]),
    );
  }

  #player(player: SquadPlayer): PlayerView {
    const estimate = player.hiddenEstimates;
    return {
      id: player.id,
      name: player.name,
      shirt: player.shirtNumber ?? 0,
      age: player.age,
      nationality: '',
      primaryPosition: POSITION_LABEL[player.position] ?? player.position,
      secondaryPositions: player.secondaryPositions.map(
        (position) => POSITION_LABEL[position] ?? position,
      ),
      side:
        player.preferredSide === 'left'
          ? 'esquerdo'
          : player.preferredSide === 'right'
            ? 'direito'
            : 'centro',
      strength: Math.round(player.strength),
      traits: player.traits.map((trait) => TRAIT_LABEL[trait] ?? trait),
      condition: Math.round(player.condition),
      morale: Math.round(player.morale),
      sharpness: Math.round(player.matchSharpness),
      role: this.#roles.get(player.id) ?? 'reserve',
      injuryRounds: player.injuryRounds,
      suspended: player.suspensionRounds > 0,
      yellowCards: player.careerStats.yellowCards,
      redCards: player.careerStats.redCards,
      goals: player.careerStats.goals,
      appearances: player.careerStats.appearances,
      lastRating: player.lastMatchRating ?? null,
      lineupPosition: this.#positions.get(player.id),
      scoutingEstimates: {
        potential:
          estimate.potential === 'excellent'
            ? 'alto'
            : estimate.potential === 'good'
              ? 'bom'
              : 'limitado',
        consistency:
          estimate.consistency === 'excellent'
            ? 'muito estável'
            : estimate.consistency === 'good'
              ? 'estável'
              : 'irregular',
        injuryProneness:
          estimate.injuryRisk === 'high'
            ? 'alta'
            : estimate.injuryRisk === 'average'
              ? 'moderada'
              : 'baixa',
        adaptation: estimate.adaptation === 'low' ? 'em adaptação' : 'adaptado',
        professionalism:
          estimate.professionalism === 'excellent' ? 'referência' : 'adequado',
        bigMatches:
          estimate.bigGames === 'excellent'
            ? 'decisivo'
            : estimate.bigGames === 'good'
              ? 'confiável'
              : 'a observar',
      },
    };
  }

  #opponent(
    next: NextMatchModel | undefined,
    players: readonly PlayerView[],
  ): OpponentView {
    if (!next)
      return {
        club: 'Sem jogo marcado',
        formation: '4-4-2',
        form: [],
        approximateStrength: 0,
        absences: [],
        report: 'Nenhuma partida pendente nesta temporada.',
      };
    const own =
      players
        .map(({ strength }) => strength)
        .sort((left, right) => right - left)
        .slice(0, 16)
        .reduce((sum, value) => sum + value, 0) /
      Math.max(1, Math.min(16, players.length));
    const offset = {
      much_weaker: -8,
      weaker: -4,
      similar: 0,
      stronger: 4,
      much_stronger: 8,
    }[next.preparation.approximateStrength];
    return {
      club: next.preparation.opponent.name,
      formation: '4-4-2',
      form: next.preparation.recentForm.map((result) =>
        result === 'W' ? 'V' : result === 'D' ? 'E' : 'D',
      ),
      approximateStrength: Math.round(own + offset),
      absences: next.preparation.absences.map(({ playerName }) => playerName),
      report: `${next.competition} · ${next.preparation.venue === 'home' ? 'em casa' : 'fora'} · ${next.date.split('-').reverse().join('/')}`,
    };
  }

  #names(post: PostMatchModel, squad?: SquadModel): Map<string, string> {
    return new Map([
      ...(squad?.players ?? []).map(({ id, name }) => [id, name] as const),
      ...(post.participants ?? []).map(({ id, name }) => [id, name] as const),
    ]);
  }

  #replay(post: PostMatchModel, squad?: SquadModel): MatchReplayInput {
    const names = this.#names(post, squad);
    const team = (side: Side, club: ClubSummary) => ({
      id: club.id,
      name: club.name,
      abbreviation: club.shortName.slice(0, 3).toUpperCase(),
      color: side === 'home' ? '#1f9d55' : '#d64545',
      players: [
        ...new Set(
          post.timeline.flatMap((event) =>
            event.side !== side
              ? []
              : 'playerId' in event
                ? [event.playerId]
                : event.type === 'substitution'
                  ? [event.playerInId, event.playerOutId]
                  : [],
          ),
        ),
        ...(post.participants ?? [])
          .filter((participant) => participant.side === side)
          .map(({ id }) => id),
      ]
        .filter((id, index, all) => all.indexOf(id) === index)
        .map((id, index) => ({
          id,
          name: names.get(id) ?? 'Atleta',
          number: index + 1,
        })),
    });
    return {
      matchId: post.matchId,
      home: team('home', post.homeClub),
      away: team('away', post.awayClub),
      finalScore: post.score,
      finalStatistics: statisticsFromTimeline(post.timeline),
      timeline: post.timeline,
    };
  }

  #feed(post: PostMatchModel, squad?: SquadModel): MatchUpdate[] {
    const names = this.#names(post, squad);
    const club = (side: Side) =>
      side === 'home' ? post.homeClub.name : post.awayClub.name;
    const score = { home: 0, away: 0 };
    const updates: MatchUpdate[] = [
      {
        id: `${post.fixtureId}-0`,
        progress: 1,
        minute: 0,
        message: `Bola rolando: ${post.homeClub.name} × ${post.awayClub.name}`,
        score: '0 × 0',
        kind: 'kickoff',
        decisionPoint: false,
        done: false,
      },
    ];
    const pauses = [...DECISION_MINUTES];
    const push = (update: Omit<MatchUpdate, 'progress' | 'done' | 'score'>) =>
      updates.push({
        ...update,
        progress: Math.min(99, Math.round((update.minute / 94) * 100)),
        score: `${String(score.home)} × ${String(score.away)}`,
        done: false,
      });
    const flushPauses = (minute: number) => {
      while (pauses[0] !== undefined && pauses[0] < minute) {
        const pause = pauses.shift()!;
        push({
          id: `${post.fixtureId}-pause-${String(pause)}`,
          minute: pause,
          message: `Pausa técnica aos ${String(pause)}'. Ajuste ou siga.`,
          kind: 'save',
          decisionPoint: true,
        });
      }
    };
    post.timeline.forEach((event, index) => {
      flushPauses(event.minute);
      const id = `${post.fixtureId}-${String(index + 1)}`;
      const who = (playerId: string) => names.get(playerId) ?? 'um atleta';
      if (event.type === 'goal') {
        score[event.side] += 1;
        push({
          id,
          minute: event.minute,
          message: `GOL do ${club(event.side)}! ${who(event.playerId)} marca.`,
          kind: 'goal',
          side: event.side,
          decisionPoint: false,
        });
      } else if (event.type === 'chance')
        push({
          id,
          minute: event.minute,
          message: `${club(event.side)} finaliza (${event.xg.toFixed(2)} xG).`,
          kind: 'chance',
          side: event.side,
          decisionPoint: false,
        });
      else if (event.type === 'card')
        push({
          id,
          minute: event.minute,
          message: `Cartão ${event.card === 'red' ? 'vermelho' : 'amarelo'} para ${who(event.playerId)}.`,
          kind: 'card',
          side: event.side,
          decisionPoint: false,
        });
      else if (event.type === 'injury')
        push({
          id,
          minute: event.minute,
          message: `${who(event.playerId)} sente lesão (${club(event.side)}).`,
          kind: 'card',
          side: event.side,
          decisionPoint: false,
        });
      else if (event.type === 'substitution')
        push({
          id,
          minute: event.minute,
          message: `${club(event.side)}: entra ${who(event.playerInId)}, sai ${who(event.playerOutId)}.`,
          kind: 'save',
          side: event.side,
          decisionPoint: false,
        });
      else
        push({
          id,
          minute: event.minute,
          message: `${club(event.side)} muda para ${event.formation}.`,
          kind: 'save',
          side: event.side,
          decisionPoint: false,
        });
    });
    flushPauses(95);
    updates.push({
      id: `${post.fixtureId}-end`,
      progress: 100,
      minute: 90,
      message: `Fim de jogo: ${post.homeClub.name} ${String(score.home)} × ${String(score.away)} ${post.awayClub.name}`,
      score: `${String(score.home)} × ${String(score.away)}`,
      kind: 'full-time',
      decisionPoint: false,
      done: true,
    });
    return updates;
  }

  #result(
    post: PostMatchModel,
    squad: SquadModel,
    managedClubId?: string,
  ): MatchResultView {
    const managedHome = post.homeClub.id === managedClubId;
    const goalsFor = managedHome ? post.score.home : post.score.away;
    const goalsAgainst = managedHome ? post.score.away : post.score.home;
    return {
      score: `${String(post.score.home)} × ${String(post.score.away)}`,
      headline:
        goalsFor > goalsAgainst
          ? 'Vitória construída em campo'
          : goalsFor === goalsAgainst
            ? 'Empate com lições para a próxima rodada'
            : 'Derrota que pede ajustes',
      events: this.#feed(post, squad),
      actions: this.#match?.actions ?? [],
      replay: this.#replay(post, squad),
    };
  }

  // --- world (phase four) ---------------------------------------------------
  async #world(world: WorldModel, squad: SquadModel): Promise<Phase4View> {
    const market = await this.#optional<MarketEntry[]>(
      `/v1/phase-four/careers/${this.#career()}/market?minStrength=60`,
    );
    const clubNames = new Map<string, string>();
    const contracts: ContractView[] = world.contracts.map((contract) => {
      const months = monthsBetween(world.currentDate, contract.endsOn);
      return {
        playerId: contract.playerId,
        playerName: contract.playerName,
        monthsRemaining: months,
        salary: centsToBrl(contract.wage),
        renewalDemand: Math.round(centsToBrl(contract.wage) * 1.1),
        status: months <= 6 ? 'expiring' : 'active',
      };
    });
    let balance = world.club?.cash ?? 0;
    const ledger: LedgerEntryView[] = world.ledger.slice(0, 40).map((entry) => {
      const view: LedgerEntryView = {
        id: entry.id,
        date: entry.occurredAt.slice(5, 10).split('-').reverse().join('/'),
        sourceLabel: entry.label,
        category:
          entry.kind === 'gate'
            ? 'tickets'
            : (entry.kind as LedgerEntryView['category']),
        amount: centsToBrl(entry.amount),
        balance: centsToBrl(balance),
      };
      balance -= entry.amount;
      return view;
    });
    const offers = new Map(
      (world.offers ?? []).map((offer) => [offer.playerId, offer]),
    );
    const own = new Set(squad.players.map(({ id }) => id));
    const marketView: MarketPlayerView[] = (market ?? [])
      .filter(({ id }) => !own.has(id))
      .sort((left, right) => right.strength - left.strength)
      .slice(0, 40)
      .map((player) => {
        const offer = offers.get(player.id);
        return {
          id: player.id,
          name: player.name,
          club: player.clubId
            ? (clubNames.get(player.clubId) ??
              player.clubId.replace(/^club_/, '').replaceAll('_', ' '))
            : 'Sem clube',
          position: POSITION_LABEL[player.position] ?? player.position,
          age: player.age,
          strength: Math.round(player.strength),
          value: centsToBrl(player.value),
          salary: centsToBrl(player.wage),
          availability: player.clubId ? 'transfer' : 'free-agent',
          scouted: this.#scouted.has(player.id),
          potentialEstimate: this.#scouted.has(player.id)
            ? 'observado'
            : 'a observar',
          adaptationEstimate: 'a observar',
          offerStatus:
            offer?.status === 'accepted'
              ? 'accepted'
              : offer?.counterOf
                ? 'countered'
                : 'none',
          ...(offer?.counterOf ? { counterAmount: centsToBrl(offer.fee) } : {}),
          ...(offer ? { pendingKind: offer.kind } : {}),
        };
      });
    const objective =
      world.objectives.find(({ metric }) => metric !== 'financial_balance') ??
      world.objectives[0];
    const objectiveLabel =
      objective === undefined
        ? 'Sem objetivo definido'
        : objective.metric === 'league_position'
          ? `Terminar entre os ${String(objective.target)} primeiros`
          : objective.metric === 'promotion'
            ? 'Conquistar o acesso'
            : objective.metric === 'avoid_relegation'
              ? 'Evitar o rebaixamento'
              : 'Equilibrar as finanças';
    const titles = world.history.filter(
      ({ type, clubName }) => type === 'title' && clubName === world.club?.name,
    ).length;
    return {
      contracts,
      contractAlerts: contracts
        .filter(({ status }) => status === 'expiring')
        .map(
          ({ playerName, monthsRemaining }) =>
            `${playerName}: contrato termina em ${String(monthsRemaining)} meses.`,
        ),
      market: marketView,
      finances: {
        cash: centsToBrl(world.club?.cash ?? 0),
        wageBill: centsToBrl(world.club?.monthlyWageBill ?? 0),
        wageBudget: Math.round(
          centsToBrl(world.club?.monthlyWageBill ?? 0) * 1.15,
        ),
        transferGate: Math.max(
          0,
          Math.round(centsToBrl(world.club?.cash ?? 0) * 0.3),
        ),
        sponsor: 'Cota mensal proporcional à folha',
        ledger,
      },
      stadium: {
        name: `Estádio do ${world.club?.name ?? 'clube'}`,
        capacity: world.club?.stadium.capacity ?? 0,
        averageCrowd: 0,
        ticketPrice: centsToBrl(world.club?.stadium.ticketPrice ?? 0),
        maintenance:
          (world.club?.stadium.quality ?? 100) < 60 ? 'atenção' : 'em dia',
        expansionCost: 15_000_000,
      },
      youth: world.youth.map((youth) => ({
        id: youth.playerId,
        name: youth.name,
        position: POSITION_LABEL[youth.position] ?? youth.position,
        age: youth.age,
        generated: true as const,
        strengthEstimate: 'a observar',
        potentialEstimate:
          youth.estimate === 'exceptional'
            ? 'alto'
            : youth.estimate === 'promising'
              ? 'bom'
              : 'limitado',
        readiness: youth.status === 'academy' ? 'na base' : 'no elenco',
        status: youth.status,
      })),
      board: {
        confidence: Math.round(world.manager.boardConfidence),
        fanConfidence: Math.round(world.manager.fanConfidence),
        objective: objectiveLabel,
        status:
          world.manager.boardConfidence >= 60
            ? 'Diretoria satisfeita'
            : world.manager.boardConfidence >= 35
              ? 'Diretoria atenta'
              : 'Cargo ameaçado',
        firingRisk:
          world.manager.boardConfidence < 20
            ? 'alto'
            : world.manager.boardConfidence < 40
              ? 'moderado'
              : 'baixo',
        proposals: world.jobProposals
          .filter(({ status }) => status === 'open')
          .map((proposal) => ({
            id: proposal.id,
            club: proposal.clubName,
            division: '',
            objective: `Prestígio mínimo ${String(Math.round(proposal.minimumPrestige))}`,
            salary: 0,
          })),
      },
      news: world.history.slice(0, 12).map((event) => ({
        id: event.id,
        tag:
          event.type === 'title'
            ? 'Título'
            : event.type === 'promotion'
              ? 'Acesso'
              : event.type === 'relegation'
                ? 'Rebaixamento'
                : event.type === 'retirement'
                  ? 'Aposentadoria'
                  : 'Carreira',
        headline:
          event.type === 'title'
            ? `${event.clubName ?? 'Clube'} campeão`
            : event.type === 'retirement'
              ? `${event.playerName ?? 'Atleta'} se aposenta`
              : `${event.clubName ?? event.playerName ?? 'Carreira'}`,
        detail: `Temporada ${String(event.season)}`,
      })),
      history: {
        seasons: [],
        champions: world.history
          .filter(({ type }) => type === 'title')
          .map((event) => ({
            season: String(event.season),
            competition: event.competitionId ?? '',
            club: event.clubName ?? '',
          })),
        records: [],
        idols: [],
      },
      prestige: {
        points: Math.round(world.manager.prestige),
        level:
          world.manager.prestige >= 300
            ? 'Lenda'
            : world.manager.prestige >= 100
              ? 'Consagrado'
              : 'Em ascensão',
        titles,
        promotions: world.history.filter(
          ({ type, clubName }) =>
            type === 'promotion' && clubName === world.club?.name,
        ).length,
        seasons: world.manager.seasons,
      },
      leaderboards: { global: [], underdog: [], monthly: [] },
      archive: {
        saveVersion: 'game-save-v2',
        migrationStatus: 'atualizado',
        archiveStatus: 'sem compactação pendente',
        lastCompaction: '—',
        checksum: `versão ${String(world.aggregateVersion)}`,
      },
    };
  }

  // --- squad and tactics ----------------------------------------------------
  async setPlayerRole(playerId: string, role: SquadRole) {
    const squad = this.#squad ?? (await this.#view(), this.#squad);
    if (!squad) throw new Error('Elenco indisponível.');
    const player = squad.players.find(({ id }) => id === playerId);
    if (!player) throw new Error('Jogador não encontrado.');
    if (
      role === 'starter' &&
      (player.injuryRounds > 0 || player.suspensionRounds > 0)
    )
      throw new Error(
        player.injuryRounds > 0
          ? 'Jogador lesionado não pode ser titular.'
          : 'Jogador suspenso não pode ser titular.',
      );
    const roles = new Map(this.#roles);
    roles.set(playerId, role);
    const count = (target: SquadRole) =>
      [...roles.values()].filter((value) => value === target).length;
    if (count('bench') > 7)
      throw new Error('O banco aceita no máximo 7 jogadores.');
    if (count('starter') > 11)
      throw new Error('A escalação aceita somente 11 titulares.');
    this.#roles = roles;
    if (count('starter') === 11) await this.#sendLineup(squad);
    return this.#localView();
  }

  async #sendLineup(squad: SquadModel) {
    const formation =
      squad.lineup?.formation ?? squad.tactic?.formation ?? '4-4-2';
    const byId = new Map(squad.players.map((player) => [player.id, player]));
    const starters = [...this.#roles]
      .filter(([, role]) => role === 'starter')
      .map(([id]) => byId.get(id)!);
    const slots = [
      ...(FORMATION_SLOTS[formation] ?? FORMATION_SLOTS['4-4-2']!),
    ];
    const assigned: { playerId: string; position: string }[] = [];
    const pending = [...starters];
    for (const position of slots) {
      const index = Math.max(
        0,
        pending.findIndex((player) => player.position === position) >= 0
          ? pending.findIndex((player) => player.position === position)
          : pending.findIndex((player) =>
              player.secondaryPositions.includes(position),
            ),
      );
      const [player] = pending.splice(index, 1);
      if (player) assigned.push({ playerId: player.id, position });
    }
    const bench = [...this.#roles]
      .filter(([, role]) => role === 'bench')
      .map(([id]) => id);
    const reserves = [...this.#roles]
      .filter(([, role]) => role === 'reserve')
      .map(([id]) => id);
    await this.#command('SetLineup', {
      careerId: this.#career(),
      clubId: squad.club.id,
      starters: assigned,
      substitutes: bench,
      reserves,
      captainId: assigned[1]?.playerId ?? assigned[0]!.playerId,
    });
  }

  async #localView() {
    return this.#view();
  }

  async autoPick(strategy: AutoPickStrategy) {
    const squad = this.#squad;
    await this.#command('AutoPickLineup', {
      careerId: this.#career(),
      clubId: squad?.club.id,
      formation:
        squad?.lineup?.formation ?? squad?.tactic?.formation ?? '4-4-2',
      mode: strategy,
    });
    return this.#view();
  }

  async setTactics(input: { formation: Formation; tactics: TacticsView }) {
    await this.#command('SetTactics', {
      careerId: this.#career(),
      ...toServerTactic(input.formation, input.tactics),
    });
    return this.#view();
  }

  async validateMatchday() {
    await this.#refreshVersion();
  }

  // --- matchday ---------------------------------------------------------------
  async #preview(): Promise<PostMatchModel> {
    return this.#request<PostMatchModel>(
      'POST',
      `/v1/careers/${this.#career()}/match-preview`,
      { instructions: this.#match?.instructions ?? [] },
    );
  }

  async beginMatch() {
    const next = await this.#request<NextMatchModel>(
      'GET',
      `/v1/careers/${this.#career()}/next-match`,
    );
    const squad = this.#squad ?? (await this.#view(), this.#squad);
    this.#match = {
      fixtureId: next.fixtureId,
      managedSide: next.homeClub.id === squad?.club.id ? 'home' : 'away',
      instructions: [],
      actions: [],
      feed: [],
      cursor: 0,
      preview: undefined as unknown as PostMatchModel,
    };
    const preview = await this.#preview();
    this.#match.preview = preview;
    this.#match.feed = this.#feed(preview, squad);
    return structuredClone(this.#match.feed[0]!);
  }

  async nextMatchEvent() {
    const match = this.#requireMatch();
    match.cursor = Math.min(match.feed.length - 1, match.cursor + 1);
    return structuredClone(match.feed[match.cursor]!);
  }

  #requireMatch(): LiveMatch {
    if (!this.#match) throw new Error('A partida ainda não começou.');
    return this.#match;
  }

  #decisionMinute(): number {
    const match = this.#requireMatch();
    const current = match.feed[match.cursor]!;
    if (!current.decisionPoint)
      throw new Error('Mudanças só podem ser feitas nas pausas técnicas.');
    return current.minute;
  }

  async #replan(action: MatchActionView, instruction: Record<string, unknown>) {
    const match = this.#requireMatch();
    const minute = action.minute;
    match.instructions.push(instruction);
    match.actions.push(action);
    const preview = await this.#preview();
    const feed = this.#feed(preview, this.#squad);
    // Prefix-stable engine: everything up to the pause stays as already shown.
    const resume = feed.findIndex(
      (update) => update.minute === minute && update.decisionPoint,
    );
    match.preview = preview;
    match.feed = [
      ...match.feed.slice(0, match.cursor + 1),
      ...feed.slice(resume + 1),
    ];
    return structuredClone(match.feed[match.cursor]!);
  }

  async makeSubstitution(input: { outgoingId: string; incomingId: string }) {
    const minute = this.#decisionMinute();
    const match = this.#requireMatch();
    const squad = this.#squad;
    const formation = squad?.lineup?.formation ?? '4-4-2';
    const slot = squad?.lineup?.starters.indexOf(input.outgoingId) ?? -1;
    const position =
      (FORMATION_SLOTS[formation] ?? FORMATION_SLOTS['4-4-2']!)[slot] ??
      squad?.players.find(({ id }) => id === input.incomingId)?.position ??
      'CM';
    const name = (id: string) =>
      squad?.players.find((player) => player.id === id)?.name ?? 'Atleta';
    return this.#replan(
      {
        minute,
        type: 'substitution',
        description: `Entra ${name(input.incomingId)}, sai ${name(input.outgoingId)}`,
      },
      {
        type: 'substitution',
        minute,
        side: match.managedSide,
        playerOutId: input.outgoingId,
        playerInId: input.incomingId,
        position,
      },
    );
  }

  async changeMatchTactics(input: Partial<TacticsView>) {
    const minute = this.#decisionMinute();
    const match = this.#requireMatch();
    const squad = this.#squad;
    const current = fromServerTactic(squad?.tactic);
    const formation = (squad?.lineup?.formation ?? '4-4-2') as Formation;
    return this.#replan(
      {
        minute,
        type: 'tactics',
        description: `Ajuste tático: ${input.mentality ?? current.mentality}`,
      },
      {
        type: 'tactical_change',
        minute,
        side: match.managedSide,
        tactic: toServerTactic(formation, { ...current, ...input }),
      },
    );
  }

  async finishMatch() {
    const match = this.#requireMatch();
    await this.#command('SimulateMatch', {
      careerId: this.#career(),
      fixtureId: match.fixtureId,
      instructions: match.instructions,
    });
    const view = await this.#view();
    this.#match = undefined;
    return view;
  }

  async instantResult() {
    const next = await this.#request<NextMatchModel>(
      'GET',
      `/v1/careers/${this.#career()}/next-match`,
    );
    await this.#command('SimulateMatch', {
      careerId: this.#career(),
      fixtureId: next.fixtureId,
    });
    this.#match = undefined;
    return this.#view();
  }

  // --- world commands ---------------------------------------------------------
  async #worldState() {
    return this.#request<WorldModel>(
      'GET',
      `/v1/careers/${this.#career()}/world`,
    );
  }

  async renewContract(playerId: string, months: 6 | 12 | 24) {
    const world = await this.#worldState();
    const contract = world.contracts.find((item) => item.playerId === playerId);
    if (!contract) throw new Error('Contrato não encontrado.');
    await this.#worldCommand('RenewPlayerContract', {
      contractId: contract.contractId,
      wage: Math.round(contract.wage * 1.1),
      endsOn: addDays(
        contract.endsOn > world.currentDate
          ? contract.endsOn
          : world.currentDate,
        Math.round(months * 30.4),
      ),
    });
    return this.#view();
  }

  async refuseContract(): Promise<CareerView> {
    throw new NotSupportedYetError('Recusar renovação');
  }

  async terminateContract(playerId: string) {
    const world = await this.#worldState();
    const contract = world.contracts.find((item) => item.playerId === playerId);
    if (!contract) throw new Error('Contrato não encontrado.');
    await this.#worldCommand('TerminatePlayerContract', {
      contractId: contract.contractId,
    });
    return this.#view();
  }

  async setSquadMarketStatus(): Promise<CareerView> {
    throw new NotSupportedYetError('Listar atleta para venda ou empréstimo');
  }

  async scoutMarketPlayer(playerId: string) {
    await this.#request(
      'GET',
      `/v1/phase-four/careers/${this.#career()}/scout/${playerId}`,
    );
    this.#scouted.add(playerId);
    return this.#view();
  }

  async submitTransferOffer(input: {
    playerId: string;
    amount: number;
    kind: TransferKind;
  }) {
    const world = await this.#worldState();
    const market = await this.#request<MarketEntry[]>(
      'GET',
      `/v1/phase-four/careers/${this.#career()}/market?text=`,
    );
    const target = market.find(({ id }) => id === input.playerId);
    if (!target || !world.club) throw new Error('Atleta indisponível.');
    await this.#worldCommand('SubmitTransferOffer', {
      playerId: input.playerId,
      ...(target.clubId ? { fromClubId: target.clubId } : {}),
      toClubId: world.club.id,
      kind: input.kind,
      fee: Math.round(input.amount * 100),
      wage: target.wage,
      expiresOn: addDays(world.currentDate, 14),
      ...(input.kind === 'loan'
        ? {
            loan: {
              endsOn: `${world.currentDate.slice(0, 4)}-12-31`,
              wageSharePercentage: 50,
            },
          }
        : {}),
    });
    return this.#view();
  }

  async acceptTransferCounter(playerId: string) {
    const world = await this.#worldState();
    const offer = (world.offers ?? []).find(
      (item) =>
        item.playerId === playerId &&
        item.counterOf !== undefined &&
        item.status === 'pending',
    );
    if (!offer) throw new Error('Não há contraproposta pendente.');
    await this.#worldCommand('DecideTransferOffer', {
      offerId: offer.id,
      decision: 'accept',
    });
    return this.#view();
  }

  async setTicketPrice(price: number) {
    const world = await this.#worldState();
    if (!world.club) throw new Error('Clube indisponível.');
    await this.#worldCommand('SetTicketPrice', {
      clubId: world.club.id,
      ticketPrice: Math.round(price * 100),
    });
    return this.#view();
  }

  async maintainStadium(): Promise<CareerView> {
    throw new NotSupportedYetError('Manutenção avulsa do estádio');
  }

  async expandStadium() {
    const world = await this.#worldState();
    if (!world.club) throw new Error('Clube indisponível.');
    await this.#worldCommand('ExpandStadium', {
      clubId: world.club.id,
      addedCapacity: 5_000,
      cost: 1_500_000_000,
      completesOn: addDays(world.currentDate, 180),
    });
    return this.#view();
  }

  async developYouth(): Promise<CareerView> {
    throw new NotSupportedYetError('Plano individual de desenvolvimento');
  }

  async promoteYouth(playerId: string) {
    await this.#worldCommand('PromoteYouth', { playerId });
    return this.#view();
  }

  async releaseYouth(playerId: string) {
    await this.#worldCommand('ReleaseYouth', { playerId });
    return this.#view();
  }

  async acceptJobProposal(proposalId: string) {
    await this.#worldCommand('AcceptJobProposal', { proposalId });
    return this.#view();
  }

  // --- management screens ---------------------------------------------------
  async setLineup(input: LineupInput) {
    const squad = this.#squad ?? (await this.#view(), this.#squad);
    if (!squad) throw new Error('Elenco indisponível.');
    if (squad.tactic && squad.tactic.formation !== input.formation)
      await this.#command('SetTactics', {
        careerId: this.#career(),
        ...squad.tactic,
        formation: input.formation,
      });
    await this.#command('SetLineup', {
      careerId: this.#career(),
      clubId: squad.club.id,
      starters: input.starters.map(({ playerId, position }) => ({
        playerId,
        position: SERVER_POSITION[position] ?? position,
      })),
      substitutes: [...input.bench],
      reserves: [...input.reserves],
      captainId: input.captainId,
    });
    return this.#view();
  }

  async getMarket(query: MarketQuery = {}): Promise<MarketView> {
    if (!this.#careerId) await this.getCareer();
    const params = new URLSearchParams();
    if (query.text?.trim()) params.set('text', query.text.trim());
    if (query.position)
      params.set('position', SERVER_POSITION[query.position] ?? query.position);
    if (query.minStrength) params.set('minStrength', String(query.minStrength));
    if (query.maxAge) params.set('maxAge', String(query.maxAge));
    if (query.maxValue !== undefined)
      params.set('maxValue', String(brlToCents(query.maxValue)));
    if (query.origin && query.origin !== 'all')
      params.set('origin', query.origin);
    if (query.freeAgentsOnly) params.set('freeAgentsOnly', 'true');
    params.set('limit', '40');
    const model = await this.#request<MarketModel>(
      'GET',
      `/v1/careers/${this.#career()}/market?${params.toString()}`,
    );
    return {
      currentDate: model.currentDate,
      ...(model.club
        ? {
            club: {
              ...model.club,
              cash: centsToBrl(model.club.cash),
              monthlyWageBill: centsToBrl(model.club.monthlyWageBill),
            },
          }
        : {}),
      window: {
        status: model.window.status,
        ...(model.window.current
          ? {
              name: model.window.current.name,
              closesOn: model.window.current.closesOn,
            }
          : {}),
        ...(model.window.daysRemaining === undefined
          ? {}
          : { daysRemaining: model.window.daysRemaining }),
        nextName: model.window.next.name,
        nextOpensOn: model.window.next.opensOn,
        daysUntilNext: model.window.daysUntilNext,
      },
      listings: model.listings.map((listing) =>
        listing.mode === 'sale'
          ? {
              ...listing,
              position: POSITION_LABEL[listing.position] ?? listing.position,
              value: centsToBrl(listing.value),
              askingPrice: centsToBrl(listing.askingPrice),
            }
          : {
              ...listing,
              position: POSITION_LABEL[listing.position] ?? listing.position,
              value: centsToBrl(listing.value),
            },
      ),
      offersReceived: model.offersReceived.map(offerOf),
      offersSent: model.offersSent.map(offerOf),
      loans: model.loans,
      search: {
        total: model.search.total,
        results: model.search.results.map((result) => ({
          ...result,
          position: POSITION_LABEL[result.position] ?? result.position,
          value: centsToBrl(result.value),
          wage: centsToBrl(result.wage),
          origin: result.origin ?? 'national',
        })),
      },
    };
  }

  async listForTransfer(input: ListingInput) {
    await this.#worldCommand(
      'ListPlayerForTransfer',
      input.mode === 'sale'
        ? { ...input, askingPrice: brlToCents(input.askingPrice) }
        : { ...input },
    );
    return this.getMarket();
  }

  async withdrawListing(playerId: string) {
    await this.#worldCommand('WithdrawTransferListing', { playerId });
    return this.getMarket();
  }

  async submitMarketOffer(input: MarketOfferInput) {
    const [market, world] = await Promise.all([
      this.getMarket({ text: '' }),
      this.#worldState(),
    ]);
    if (!world.club) throw new Error('Clube indisponível.');
    const target =
      market.search.results.find(({ id }) => id === input.playerId) ??
      (await this.getMarket({ minStrength: 1 })).search.results.find(
        ({ id }) => id === input.playerId,
      );
    await this.#worldCommand('SubmitTransferOffer', {
      playerId: input.playerId,
      ...(target?.clubId ? { fromClubId: target.clubId } : {}),
      toClubId: world.club.id,
      kind: input.kind,
      fee: brlToCents(input.fee),
      wage: brlToCents(input.wage),
      expiresOn: addDays(world.currentDate, 7),
      ...(input.kind === 'loan'
        ? {
            loan: input.loan ?? {
              endsOn: `${world.currentDate.slice(0, 4)}-12-31`,
              wageSharePercentage: 50,
            },
          }
        : {}),
    });
    return this.getMarket();
  }

  async decideMarketOffer(offerId: string, decision: 'accept' | 'reject') {
    await this.#worldCommand('DecideTransferOffer', { offerId, decision });
    return this.getMarket();
  }

  async counterMarketOffer(
    offerId: string,
    terms: { fee: number; wage: number },
  ) {
    const world = await this.#worldState();
    await this.#worldCommand('CounterTransferOffer', {
      offerId,
      fee: brlToCents(terms.fee),
      wage: brlToCents(terms.wage),
      expiresOn: addDays(world.currentDate, 7),
    });
    return this.getMarket();
  }

  async getOffice(): Promise<OfficeView> {
    if (!this.#careerId) await this.getCareer();
    const model = await this.#request<OfficeModel>(
      'GET',
      `/v1/careers/${this.#career()}/office`,
    );
    const coach: OfficeView['coach'] = {
      managerName: model.coach.managerName,
      employmentStatus: model.coach.employmentStatus,
      boardConfidence: model.coach.boardConfidence,
      fanConfidence: model.coach.fanConfidence,
      prestige: model.coach.prestige,
      seasons: model.coach.seasons,
      appointments: model.coach.appointments,
      achievements: model.coach.achievements,
    };
    return {
      currentDate: model.currentDate,
      season: model.season,
      ...(model.club
        ? {
            club: {
              ...model.club,
              cash: centsToBrl(model.club.cash),
              monthlyWageBill: centsToBrl(model.club.monthlyWageBill),
            },
          }
        : {}),
      proposals: {
        sponsorship: model.proposals.sponsorship.map(sponsorOfferOf),
        jobs: model.proposals.jobs,
        transfers: model.proposals.transfers.map((offer) => ({
          ...offer,
          fee: centsToBrl(offer.fee),
          wage: centsToBrl(offer.wage),
        })),
      },
      sponsorship: {
        ...(model.sponsorship.contract
          ? { contract: sponsorContractOf(model.sponsorship.contract) }
          : {}),
        fallbackMonthly: centsToBrl(model.sponsorship.fallbackMonthly),
        history: model.sponsorship.history.map(sponsorContractOf),
      },
      ...(model.membership
        ? {
            membership: {
              ...model.membership,
              monthlyPrice: centsToBrl(model.membership.monthlyPrice),
              priceRange: moneyOf(model.membership.priceRange),
              referencePrice: centsToBrl(model.membership.referencePrice),
              tiers: model.membership.tiers.map((tier) => ({
                ...tier,
                costPerMember: centsToBrl(tier.costPerMember),
              })),
              monthlyRevenue: centsToBrl(model.membership.monthlyRevenue),
              monthlyCost: centsToBrl(model.membership.monthlyCost),
            },
          }
        : {}),
      finances: {
        month: financesOf(model.finances.month),
        season: financesOf(model.finances.season),
        pendingGate: centsToBrl(model.finances.pendingGate),
      },
      contracts: model.contracts.map((contract) => ({
        ...contract,
        wage: centsToBrl(contract.wage),
      })),
      coach,
      ...(model.chemistry ? { chemistry: model.chemistry } : {}),
    };
  }

  async decideSponsorship(offerId: string, decision: 'accept' | 'reject') {
    await this.#command('DecideSponsorshipOffer', {
      careerId: this.#career(),
      offerId,
      decision,
    });
    return this.getOffice();
  }

  async counterSponsorship(offerId: string, monthlyValue: number) {
    await this.#command('CounterSponsorshipOffer', {
      careerId: this.#career(),
      offerId,
      monthlyValue: brlToCents(monthlyValue),
    });
    return this.getOffice();
  }

  async configureMembership(input: {
    monthlyPrice: number;
    tier: MembershipTier;
  }) {
    await this.#command('ConfigureFanMembership', {
      careerId: this.#career(),
      monthlyPrice: brlToCents(input.monthlyPrice),
      tier: input.tier,
    });
    return this.getOffice();
  }
}

interface PyramidCompetition {
  id: string;
  name: string;
  category: CompetitionView['category'];
  tier?: number;
  formatLabel: string;
  currentPhase: string;
  participantCount: number;
  phases: { name: string; status: 'scheduled' | 'active' | 'complete' }[];
  qualifications: { label: string; places: number }[];
  prize: number;
  prestige: number;
}

/** Competition screens over the same authoritative career. */
export function httpCompetitionPort(
  api: HttpCareerApi,
): CompetitionProductPort {
  return {
    async load() {
      const [pyramid, calendar, transition] = await Promise.all([
        api.read<{
          aggregateVersion: number;
          season: number;
          divisions: PyramidCompetition[];
          cups: PyramidCompetition[];
        }>('competitions'),
        api.read<{
          status: 'draft' | 'validated' | 'published';
          validation: { valid: boolean; conflictCount: number };
          entries: CompetitionProductView['calendar']['entries'][number][];
        }>('calendar'),
        api.read<{
          nextSeason: number;
          status: 'pending' | 'ready' | 'generated';
          movements: {
            clubName: string;
            fromDivisionId: string;
            toDivisionId: string;
            kind: 'promoted' | 'relegated';
          }[];
          qualifiers: CompetitionProductView['nextSeason']['qualifiers'][number][];
          awards: { label: string; prize: number; prestige: number }[];
        }>('next-season'),
      ]);
      const names = new Map(
        [...pyramid.divisions, ...pyramid.cups].map(({ id, name }) => [
          id,
          name,
        ]),
      );
      const competition = (item: PyramidCompetition): CompetitionView => ({
        id: item.id,
        name: item.name,
        category: item.category,
        ...(item.tier === undefined ? {} : { tier: item.tier }),
        formatLabel: item.formatLabel,
        currentPhase: item.currentPhase,
        participantCount: item.participantCount,
        phases: item.phases.map(({ name, status }) => ({ name, status })),
        qualifications: item.qualifications.map(({ label, places }) => ({
          label,
          places,
        })),
        prize: centsToBrl(item.prize),
        prestige: item.prestige,
      });
      return {
        version: 1,
        aggregateVersion: pyramid.aggregateVersion,
        season: pyramid.season,
        divisions: pyramid.divisions.map(competition),
        cups: pyramid.cups.map(competition),
        calendar: {
          status: calendar.status,
          valid: calendar.validation.valid,
          conflictCount: calendar.validation.conflictCount,
          entries: calendar.entries.map(
            ({ id, date, competitionName, phaseName, label, status }) => ({
              id,
              date,
              competitionName,
              phaseName,
              label,
              status,
            }),
          ),
        },
        nextSeason: {
          season: transition.nextSeason,
          status: transition.status,
          movements: transition.movements.map((movement) => ({
            clubName: movement.clubName,
            fromDivision:
              names.get(movement.fromDivisionId) ?? movement.fromDivisionId,
            toDivision:
              names.get(movement.toDivisionId) ?? movement.toDivisionId,
            kind: movement.kind,
          })),
          qualifiers: transition.qualifiers.map(
            ({ clubName, competitionName, route }) => ({
              clubName,
              competitionName,
              route,
            }),
          ),
          awards: transition.awards.map(({ label, prize, prestige }) => ({
            label,
            prize: centsToBrl(prize),
            prestige,
          })),
        },
      };
    },
  };
}
