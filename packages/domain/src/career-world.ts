import { DomainError } from './errors.js';
import type { ClubId, PlayerId } from './entities.js';

export type ObjectiveMetric =
  | 'league_position'
  | 'promotion'
  | 'avoid_relegation'
  | 'financial_balance'
  | 'youth_promotions';
export interface BoardObjective {
  readonly id: string;
  readonly metric: ObjectiveMetric;
  readonly target: number;
  readonly progress: number;
  readonly weight: number;
  readonly status: 'active' | 'met' | 'failed';
}

export interface ManagerCareer {
  readonly managerId: string;
  readonly currentClubId?: ClubId;
  readonly employmentStatus: 'employed' | 'available' | 'retired';
  readonly boardConfidence: number;
  readonly fanConfidence: number;
  readonly prestige: number;
  readonly seasons: number;
  readonly appointments: readonly Readonly<{
    clubId: ClubId;
    joinedOn: string;
    leftOn?: string;
    reason?: 'fired' | 'resigned' | 'accepted_offer';
  }>[];
}

const confidence = (value: number): number =>
  Math.max(0, Math.min(100, Math.round(value)));

export function evaluateManagerConfidence(
  career: ManagerCareer,
  objectives: readonly BoardObjective[],
  recentResults: readonly ('W' | 'D' | 'L')[],
): ManagerCareer {
  const objectiveScore = objectives.reduce(
    (total, objective) =>
      total +
      (objective.status === 'met'
        ? objective.weight
        : objective.status === 'failed'
          ? -objective.weight
          : 0),
    0,
  );
  const formScore = recentResults.reduce(
    (total, result) => total + (result === 'W' ? 3 : result === 'D' ? 0 : -3),
    0,
  );
  return Object.freeze({
    ...career,
    boardConfidence: confidence(
      career.boardConfidence + objectiveScore + formScore / 2,
    ),
    fanConfidence: confidence(
      career.fanConfidence + formScore + objectiveScore / 2,
    ),
    appointments: Object.freeze(
      career.appointments.map((item) => Object.freeze({ ...item })),
    ),
  });
}

export function shouldFireManager(career: ManagerCareer): boolean {
  return career.employmentStatus === 'employed' && career.boardConfidence < 20;
}

export function leaveClub(
  career: ManagerCareer,
  onDate: string,
  reason: 'fired' | 'resigned' | 'accepted_offer',
): ManagerCareer {
  if (
    career.currentClubId === undefined ||
    career.employmentStatus !== 'employed'
  )
    throw new DomainError('INVALID_ENTITY', 'manager is not employed');
  const { currentClubId: _currentClubId, ...withoutCurrentClub } = career;
  void _currentClubId;
  return Object.freeze({
    ...withoutCurrentClub,
    employmentStatus: 'available',
    appointments: Object.freeze(
      career.appointments.map((item, index) =>
        index === career.appointments.length - 1
          ? Object.freeze({ ...item, leftOn: onDate, reason })
          : Object.freeze({ ...item }),
      ),
    ),
  });
}

export interface JobProposal {
  readonly id: string;
  readonly clubId: ClubId;
  readonly offeredOn: string;
  readonly expiresOn: string;
  readonly minimumPrestige: number;
  readonly status: 'open' | 'accepted' | 'rejected' | 'expired';
  /**
   * Why the club called: a bigger club after good work (`step_up`), a peer
   * (`lateral`), a smaller club after a poor run (`step_down`) or any club
   * for a coach out of work (`reemployment`). Absent on older proposals.
   */
  readonly reason?: JobProposalReason;
}

export type JobProposalReason =
  'step_up' | 'lateral' | 'step_down' | 'reemployment';

export interface JobMarketInput {
  readonly career: ManagerCareer;
  /** Reputation of the club the coach manages; absent when out of work. */
  readonly currentReputation?: number;
  /** Reputation of the last club managed (out of work). */
  readonly lastReputation?: number;
  /**
   * Recent work from -1 (crisis) to 1 (excellent): league standing against
   * the objective, form and board confidence.
   */
  readonly performance: number;
  /** Clubs of the pyramid; `interested` means a vacancy this time. */
  readonly clubs: readonly Readonly<{
    clubId: ClubId;
    reputation: number;
    interested: boolean;
  }>[];
  /** Clubs with an open proposal already (never offered twice). */
  readonly excludedClubIds?: readonly ClubId[];
  readonly onDate: string;
  readonly maxOffers: number;
  readonly validDays?: number;
  readonly nextId: () => string;
}

/**
 * Clubs that call the coach. Good work brings bigger clubs, a poor run only
 * smaller ones; prestige widens the reach. A coach out of work always hears
 * from someone (the nearest clubs below the last one), so a career never
 * stalls after a dismissal.
 */
export function jobMarketOffers(input: JobMarketInput): readonly JobProposal[] {
  if (input.maxOffers <= 0) return Object.freeze([]);
  const performance = Math.max(-1, Math.min(1, input.performance));
  const employed = input.currentReputation !== undefined;
  const reference = input.currentReputation ?? (input.lastReputation ?? 58) - 5;
  const center =
    reference +
    performance * 12 +
    Math.min(6, Math.max(0, input.career.prestige) / 30);
  const low = employed ? center - 6 : center - 12;
  const high = employed ? center + 6 : center + 4;
  const excluded = new Set<string>([
    ...(input.excludedClubIds ?? []),
    ...(input.career.currentClubId === undefined
      ? []
      : [input.career.currentClubId]),
  ]);
  const distance = (reputation: number) => Math.abs(reputation - center);
  const eligible = input.clubs
    .filter(({ clubId }) => !excluded.has(clubId))
    .sort(
      (a, b) =>
        distance(a.reputation) - distance(b.reputation) ||
        a.clubId.localeCompare(b.clubId),
    );
  const inBand = eligible.filter(
    ({ interested, reputation }) =>
      interested && reputation >= low && reputation <= high,
  );
  // Out of work, the nearest clubs (not above the reach) fill the list.
  const chosen = employed
    ? inBand
    : [
        ...new Set([
          ...inBand,
          ...eligible.filter(({ reputation }) => reputation <= high),
          ...eligible,
        ]),
      ];
  return Object.freeze(
    chosen.slice(0, input.maxOffers).map(({ clubId, reputation }) =>
      Object.freeze({
        id: input.nextId(),
        clubId,
        offeredOn: input.onDate,
        expiresOn: addDays(input.onDate, input.validDays ?? 21),
        minimumPrestige: Math.max(0, input.career.prestige),
        status: 'open' as const,
        reason: !employed
          ? ('reemployment' as const)
          : reputation > reference + 2
            ? ('step_up' as const)
            : reputation < reference - 2
              ? ('step_down' as const)
              : ('lateral' as const),
      }),
    ),
  );
}

export function proposeJobs(
  career: ManagerCareer,
  clubs: readonly Readonly<{
    clubId: ClubId;
    reputation: number;
    hasVacancy: boolean;
  }>[],
  onDate: string,
  nextId: () => string,
): readonly JobProposal[] {
  return Object.freeze(
    clubs
      .filter(
        ({ hasVacancy, reputation }) =>
          hasVacancy && career.prestige + 20 >= reputation,
      )
      .sort(
        (a, b) =>
          a.reputation - b.reputation || a.clubId.localeCompare(b.clubId),
      )
      .slice(0, 3)
      .map(({ clubId, reputation }) =>
        Object.freeze({
          id: nextId(),
          clubId,
          offeredOn: onDate,
          expiresOn: addDays(onDate, 14),
          minimumPrestige: Math.max(0, reputation - 20),
          status: 'open' as const,
        }),
      ),
  );
}

export function acceptJobProposal(
  career: ManagerCareer,
  proposal: JobProposal,
  onDate: string,
): { readonly career: ManagerCareer; readonly proposal: JobProposal } {
  if (
    proposal.status !== 'open' ||
    proposal.expiresOn < onDate ||
    career.prestige < proposal.minimumPrestige
  )
    throw new DomainError('INVALID_ENTITY', 'job proposal cannot be accepted');
  const available =
    career.employmentStatus === 'employed'
      ? leaveClub(career, onDate, 'accepted_offer')
      : career;
  return Object.freeze({
    career: Object.freeze({
      ...available,
      currentClubId: proposal.clubId,
      employmentStatus: 'employed',
      boardConfidence: 60,
      fanConfidence: 55,
      appointments: Object.freeze([
        ...available.appointments,
        Object.freeze({ clubId: proposal.clubId, joinedOn: onDate }),
      ]),
    }),
    proposal: Object.freeze({ ...proposal, status: 'accepted' }),
  });
}

function addDays(iso: string, days: number): string {
  const value = new Date(`${iso}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export type HistoryEventType =
  | 'title'
  | 'promotion'
  | 'relegation'
  | 'top_scorer'
  | 'record'
  | 'idol'
  | 'manager_fired'
  | 'transfer'
  | 'retirement';
export interface HistoryEvent {
  readonly id: string;
  readonly type: HistoryEventType;
  readonly season: number;
  readonly occurredOn: string;
  readonly clubId?: ClubId;
  readonly playerId?: PlayerId;
  readonly competitionId?: string;
  readonly value?: number;
}

export interface SeasonHistory {
  readonly season: number;
  readonly champions: readonly Readonly<{
    competitionId: string;
    clubId: ClubId;
  }>[];
  readonly topScorers: readonly Readonly<{
    competitionId: string;
    playerId: PlayerId;
    goals: number;
  }>[];
  readonly records: readonly HistoryEvent[];
  readonly idols: readonly Readonly<{
    clubId: ClubId;
    playerId: PlayerId;
    score: number;
  }>[];
}

export function projectSeasonHistory(
  events: readonly HistoryEvent[],
  season: number,
): SeasonHistory {
  const selected = events.filter((event) => event.season === season);
  return Object.freeze({
    season,
    champions: Object.freeze(
      selected.flatMap((event) =>
        event.type === 'title' &&
        event.clubId !== undefined &&
        event.competitionId !== undefined
          ? [
              Object.freeze({
                competitionId: event.competitionId,
                clubId: event.clubId,
              }),
            ]
          : [],
      ),
    ),
    topScorers: Object.freeze(
      selected.flatMap((event) =>
        event.type === 'top_scorer' &&
        event.playerId !== undefined &&
        event.competitionId !== undefined
          ? [
              Object.freeze({
                competitionId: event.competitionId,
                playerId: event.playerId,
                goals: event.value ?? 0,
              }),
            ]
          : [],
      ),
    ),
    records: Object.freeze(
      selected
        .filter((event) => event.type === 'record')
        .map((event) => Object.freeze({ ...event })),
    ),
    idols: Object.freeze(
      selected.flatMap((event) =>
        event.type === 'idol' &&
        event.clubId !== undefined &&
        event.playerId !== undefined
          ? [
              Object.freeze({
                clubId: event.clubId,
                playerId: event.playerId,
                score: event.value ?? 0,
              }),
            ]
          : [],
      ),
    ),
  });
}

const newsTemplates: Readonly<Record<HistoryEventType, string>> = Object.freeze(
  {
    title: '{club} conquista {competition}',
    promotion: '{club} garante o acesso',
    relegation: '{club} sofre o rebaixamento',
    top_scorer: '{player} termina como artilheiro',
    record: 'Novo recorde registrado na temporada {season}',
    idol: '{player} entra para a história de {club}',
    manager_fired: 'Treinador deixa {club}',
    transfer: '{player} muda de clube',
    retirement: '{player} anuncia aposentadoria',
  },
);

export interface NewsItem {
  readonly id: string;
  readonly eventId: string;
  readonly headline: string;
  readonly occurredOn: string;
}

export function renderNews(
  event: HistoryEvent,
  names: Readonly<{ club?: string; player?: string; competition?: string }>,
): NewsItem {
  const headline = newsTemplates[event.type]
    .replace('{club}', names.club ?? 'Clube')
    .replace('{player}', names.player ?? 'Atleta')
    .replace('{competition}', names.competition ?? 'competição')
    .replace('{season}', String(event.season));
  return Object.freeze({
    id: `news_${event.id}`,
    eventId: event.id,
    headline,
    occurredOn: event.occurredOn,
  });
}

export interface PrestigeAchievement {
  readonly id: string;
  readonly managerId: string;
  readonly occurredOn: string;
  readonly type:
    | 'league_title'
    | 'cup_title'
    | 'continental_title'
    | 'promotion'
    | 'season_completed';
  readonly clubReputation: number;
}

const prestigePoints: Readonly<Record<PrestigeAchievement['type'], number>> =
  Object.freeze({
    league_title: 100,
    cup_title: 70,
    continental_title: 180,
    promotion: 45,
    season_completed: 5,
  });

export function calculateManagerPrestige(
  achievements: readonly PrestigeAchievement[],
): number {
  return achievements.reduce(
    (total, item) => total + prestigePoints[item.type],
    0,
  );
}

export interface LeaderboardRow {
  readonly managerId: string;
  readonly score: number;
  readonly rank: number;
}

export function projectLeaderboards(
  achievements: readonly PrestigeAchievement[],
  month: string,
): Readonly<{
  global: readonly LeaderboardRow[];
  underdog: readonly LeaderboardRow[];
  monthly: readonly LeaderboardRow[];
}> {
  const project = (
    items: readonly PrestigeAchievement[],
    underdog: boolean,
  ): readonly LeaderboardRow[] => {
    const scores = new Map<string, number>();
    for (const item of items) {
      const multiplier = underdog
        ? Math.max(1, (100 - item.clubReputation) / 35)
        : 1;
      scores.set(
        item.managerId,
        (scores.get(item.managerId) ?? 0) +
          Math.round(prestigePoints[item.type] * multiplier),
      );
    }
    return Object.freeze(
      [...scores]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([managerId, score], index) =>
          Object.freeze({ managerId, score, rank: index + 1 }),
        ),
    );
  };
  return Object.freeze({
    global: project(achievements, false),
    underdog: project(achievements, true),
    monthly: project(
      achievements.filter(({ occurredOn }) => occurredOn.startsWith(month)),
      false,
    ),
  });
}

export interface DivisionResult {
  readonly divisionId: string;
  readonly orderedClubIds: readonly ClubId[];
  readonly promotionPlaces: number;
  readonly relegationPlaces: number;
}

export function rollDivisions(
  upper: DivisionResult,
  lower: DivisionResult,
): Readonly<{
  upper: readonly ClubId[];
  lower: readonly ClubId[];
  promoted: readonly ClubId[];
  relegated: readonly ClubId[];
}> {
  if (
    upper.relegationPlaces !== lower.promotionPlaces ||
    upper.orderedClubIds.length < upper.relegationPlaces ||
    lower.orderedClubIds.length < lower.promotionPlaces
  )
    throw new DomainError(
      'INVALID_ENTITY',
      'division movement places must match',
    );
  const relegated = upper.orderedClubIds.slice(-upper.relegationPlaces);
  const promoted = lower.orderedClubIds.slice(0, lower.promotionPlaces);
  return Object.freeze({
    upper: Object.freeze([
      ...upper.orderedClubIds.slice(0, -upper.relegationPlaces),
      ...promoted,
    ]),
    lower: Object.freeze([
      ...lower.orderedClubIds.slice(lower.promotionPlaces),
      ...relegated,
    ]),
    promoted: Object.freeze([...promoted]),
    relegated: Object.freeze([...relegated]),
  });
}
