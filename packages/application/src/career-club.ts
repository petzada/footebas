import {
  ACADEMY_MAX_AGE,
  ACADEMY_MAX_PROSPECTS,
  ageAcademyProspect,
  coachEffects,
  completeStadiumExpansion,
  generateAcademyIntake,
  jobMarketOffers,
  releaseYouth,
  trainAcademyProspect,
  type JobProposal,
  type Position,
  type YouthCandidate,
} from '@footebas/domain';
import { createPrng } from '@footebas/engine';
import { postNotice } from './career-inbox.js';
import {
  developmentQualityFor,
  jobMarketClubs,
  keptProposals,
  nextWorldId,
  openProposalClubIds,
  workPerformance,
  type AcademyState,
  type CareerWorldState,
} from './career-world-rules.js';
import type { CareerSnapshot } from './service.js';

/**
 * Club life on the days the season advances: stadium works that open,
 * the academy (peneiras twice a year, monthly training, the season turn)
 * and the coach job market, which calls every month with offers that follow
 * the work (bigger clubs after good work, smaller ones after a poor run).
 */
export const CLUB_RULES_VERSION = 'career-club-v1' as const;

/** Academy intakes open on these days of every season. */
const INTAKE_DAYS = ['02-01', '08-01'] as const;
/** Kids of the first intake when the coach takes a club. */
const FIRST_INTAKE = 5;
/** Answered academy entries (promoted or released) kept for the screens. */
const KEPT_GRADUATES = 30;
/** No job offers in the first days of a new appointment. */
const HONEYMOON_DAYS = 60;
const MAX_OPEN_PROPOSALS = 3;
const DAY = 86_400_000;

export interface ClubDayInput {
  readonly date: string;
  readonly seed: string;
  /** Managed results up to this date, oldest first. */
  readonly form: readonly ('W' | 'D' | 'L')[];
  /** National league standing after a managed league round that day. */
  readonly league?: { position: number; rounds: number };
}

export function runClubDay(snapshot: CareerSnapshot, input: ClubDayInput) {
  openFinishedWorks(snapshot, input.date);
  runAcademy(snapshot, input);
  runJobMarket(snapshot, input);
}

export const POSITION_SHORT: Readonly<Record<Position, string>> = {
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

const DIVISION_LABEL: Readonly<Record<string, string>> = {
  'serie-a': 'Série A',
  'serie-b': 'Série B',
  'serie-c': 'Série C',
};

const brDate = (date: string) =>
  `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;

const daysBetween = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) /
      DAY,
  );

function clubName(snapshot: CareerSnapshot, clubId: string): string {
  return snapshot.clubs.find(({ id }) => id === clubId)?.name ?? 'clube';
}

/** Works whose date arrived open their seats (every club, same rule). */
function openFinishedWorks(snapshot: CareerSnapshot, date: string): void {
  const world = snapshot.world;
  const managed = world.manager.currentClubId;
  world.stadiums = world.stadiums.map((stadium) => {
    if (stadium.expansion === undefined || stadium.expansion.completesOn > date)
      return stadium;
    const opened = completeStadiumExpansion(stadium, date);
    if (stadium.clubId === managed)
      postNotice(snapshot, {
        key: `stadium_works|${stadium.expansion.projectId}`,
        topic: 'notice_stadium',
        subject: 'Obra concluída no estádio',
        body: `A ampliação ficou pronta: +${stadium.expansion.addedCapacity.toLocaleString('pt-BR')} lugares. O estádio do ${clubName(snapshot, stadium.clubId)} agora recebe ${opened.capacity.toLocaleString('pt-BR')} torcedores.`,
        date,
      });
    return opened;
  });
}

function academyOf(world: CareerWorldState, date: string): AcademyState {
  world.academy ??= {
    intakes: [],
    trainedThrough: date.slice(0, 7),
    agedThrough: Number(date.slice(0, 4)),
  };
  return world.academy;
}

/** Prospects of the managed club still in the academy. */
export function academyProspects(
  world: Pick<CareerWorldState, 'youth' | 'manager'>,
): YouthCandidate[] {
  const clubId = world.manager.currentClubId;
  return world.youth.filter(
    ({ player, status }) => status === 'academy' && player.clubId === clubId,
  );
}

/** Next academy intake day on or after `date`. */
export function nextIntakeOn(date: string): string {
  const year = Number(date.slice(0, 4));
  for (const candidate of [year, year + 1])
    for (const day of INTAKE_DAYS) {
      const on = `${String(candidate)}-${day}`;
      if (on > date) return on;
    }
  return `${String(year + 1)}-${INTAKE_DAYS[0]}`;
}

/** Kids per intake: bigger clubs scout more. */
function intakeSize(reputation: number): number {
  return 3 + (reputation >= 65 ? 1 : 0) + (reputation >= 75 ? 1 : 0);
}

function runAcademy(snapshot: CareerSnapshot, input: ClubDayInput): void {
  const world = snapshot.world;
  const clubId = world.manager.currentClubId;
  const club = snapshot.clubs.find(({ id }) => id === clubId);
  if (clubId === undefined || club === undefined) return;
  const academy = academyOf(world, input.date);
  const year = Number(input.date.slice(0, 4));
  const personality = snapshot.coach.personality;

  // Season turn: one year older; past the academy age, the kid leaves.
  if (academy.agedThrough < year) {
    academy.agedThrough = year;
    const leaving: string[] = [];
    world.youth = world.youth.map((candidate) => {
      if (candidate.status !== 'academy' || candidate.player.clubId !== clubId)
        return candidate;
      const older = ageAcademyProspect(candidate);
      if (older.player.age <= ACADEMY_MAX_AGE) return older;
      leaving.push(older.player.name);
      return releaseYouth(older);
    });
    if (leaving.length > 0)
      postNotice(snapshot, {
        key: `academy_age|${clubId}|${String(year)}`,
        topic: 'notice_youth_intake',
        subject: 'Base: jovens deixam o clube por idade',
        body: `Passaram dos ${String(ACADEMY_MAX_AGE)} anos sem subir ao profissional e deixaram a base: ${leaving.join(', ')}.`,
        date: input.date,
      });
  }

  // Monthly training: each kid may gain a point towards his potential.
  const month = input.date.slice(0, 7);
  if (academy.trainedThrough < month) {
    academy.trainedThrough = month;
    world.youth = world.youth.map((candidate) =>
      candidate.status === 'academy' && candidate.player.clubId === clubId
        ? trainAcademyProspect(
            candidate,
            createPrng(
              `${input.seed}|academy|${month}|${candidate.player.id}`,
            ).next(),
            developmentQualityFor(candidate.player, clubId, personality),
          )
        : candidate,
    );
  }

  // Intakes: a first one when the coach arrives, then every peneira day.
  const half = INTAKE_DAYS.filter(
    (day) => input.date >= `${String(year)}-${day}`,
  ).length;
  const halfKey = `${clubId}|${String(year)}|${String(half)}`;
  const firstKey = `${clubId}|first`;
  const first = !academy.intakes.includes(firstKey);
  const due = first || (half > 0 && !academy.intakes.includes(halfKey));
  if (!due) return;
  academy.intakes = [
    ...academy.intakes.filter((key) => key !== firstKey && key !== halfKey),
    firstKey,
    ...(half > 0 ? [halfKey] : []),
  ].slice(-40);
  const room = ACADEMY_MAX_PROSPECTS - academyProspects(world).length;
  const count = Math.min(
    room,
    first ? FIRST_INTAKE : intakeSize(Number(club.reputation)),
  );
  if (count <= 0) return;
  const key = first ? firstKey : halfKey;
  const intake = generateAcademyIntake({
    clubId,
    reputation: Number(club.reputation),
    count,
    joinedOn: input.date,
    seed: `${input.seed}|intake|${key}`,
    generatorVersion: CLUB_RULES_VERSION,
    potentialBonus: Math.round(
      (coachEffects(personality).youthDevelopment - 1) * 30,
    ),
    nextId: (kind) => nextWorldId(world, kind),
    random: createPrng(`${input.seed}|intake|${key}`),
  });
  const kept = world.youth.filter(
    ({ status, player }) => status === 'academy' && player.clubId === clubId,
  );
  const answered = world.youth
    .filter(
      ({ status, player }) => status !== 'academy' || player.clubId !== clubId,
    )
    .slice(-KEPT_GRADUATES);
  world.youth = [...answered, ...kept, ...intake];
  const highlights = intake.filter(({ highlight }) => highlight === true);
  postNotice(snapshot, {
    key: `academy_intake|${key}`,
    topic: 'notice_youth_intake',
    subject: first
      ? `Base do ${club.name}: conheça os garotos`
      : `Peneira de ${String(year)}: ${String(intake.length)} garotos na base`,
    body: `${String(intake.length)} jovens chegaram à base (${intake
      .map(({ player }) => `${player.name}, ${POSITION_SHORT[player.position]}`)
      .join('; ')}).${
      highlights.length > 0
        ? ` Destaque: ${highlights
            .map(
              ({ player }) =>
                `${player.name} (${POSITION_SHORT[player.position]}, ${String(player.age)} anos)`,
            )
            .join(' e ')}.`
        : ''
    } Veja em Estádio › Base.`,
    date: input.date,
    ...(highlights[0] === undefined
      ? {}
      : { playerId: highlights[0].player.id }),
  });
}

function reputationOf(snapshot: CareerSnapshot, clubId: string | undefined) {
  const club =
    clubId === undefined
      ? undefined
      : snapshot.clubs.find(({ id }) => id === clubId);
  return club === undefined ? undefined : Number(club.reputation);
}

function divisionOf(snapshot: CareerSnapshot, clubId: string) {
  return Object.entries(snapshot.competition.divisions).find(([, ids]) =>
    (ids as readonly string[]).includes(clubId),
  )?.[0];
}

const REASON_TEXT: Readonly<
  Record<NonNullable<JobProposal['reason']>, string>
> = {
  step_up: 'É um clube maior que o atual e acompanha o seu bom trabalho.',
  lateral: 'Um clube do mesmo porte quer apostar no seu trabalho.',
  step_down: 'Depois da fase ruim, é um clube menor que ainda aposta em você.',
  reemployment: 'O clube procura um treinador e lembrou do seu nome.',
};

/**
 * Monthly coach job market (from February to November; the season verdict
 * covers the turn of the year). An employed coach hears from clubs only
 * after the first weeks of the job and more often after good work.
 */
function runJobMarket(snapshot: CareerSnapshot, input: ClubDayInput): void {
  const world = snapshot.world;
  world.jobMarket ??= { checkedThrough: '' };
  const market = world.jobMarket;
  if (input.league !== undefined)
    market.league = { ...input.league, season: snapshot.season };
  world.jobProposals = keptProposals(world.jobProposals, input.date);
  const month = input.date.slice(0, 7);
  if (market.checkedThrough >= month) return;
  market.checkedThrough = month;
  const monthNumber = Number(month.slice(5));
  if (monthNumber === 1 || monthNumber === 12) return;
  const manager = world.manager;
  const open = openProposalClubIds(world.jobProposals);
  const room = MAX_OPEN_PROPOSALS - open.length;
  if (room <= 0) return;
  const currentReputation = reputationOf(snapshot, manager.currentClubId);
  const employed = currentReputation !== undefined;
  const joinedOn = manager.appointments.at(-1)?.joinedOn;
  if (
    employed &&
    joinedOn !== undefined &&
    daysBetween(joinedOn, input.date) < HONEYMOON_DAYS
  )
    return;
  const league =
    market.league?.season === snapshot.season ? market.league : undefined;
  const performance = workPerformance(
    manager,
    world.objectives,
    input.form,
    league,
  );
  const random = createPrng(`${input.seed}|jobs|${month}`);
  const chance = !employed
    ? 1
    : performance >= 0.35
      ? 0.5
      : performance >= 0
        ? 0.2
        : 0.15;
  if (random.next() >= chance) return;
  const lastReputation = reputationOf(
    snapshot,
    manager.appointments.at(-1)?.clubId,
  );
  const offers = jobMarketOffers({
    career: manager,
    ...(currentReputation !== undefined
      ? { currentReputation }
      : lastReputation === undefined
        ? {}
        : { lastReputation }),
    performance,
    clubs: jobMarketClubs(
      { clubs: snapshot.clubs, players: snapshot.players, world },
      Object.values(snapshot.competition.divisions).flat(),
      `${input.seed}|vacancy|${month}`,
    ),
    excludedClubIds: open,
    onDate: input.date,
    maxOffers: Math.min(room, !employed ? 3 : performance >= 0.6 ? 2 : 1),
    nextId: () => nextWorldId(world, 'proposal'),
  });
  world.jobProposals = [...world.jobProposals, ...offers];
  for (const offer of offers) {
    const name = clubName(snapshot, offer.clubId);
    const division = divisionOf(snapshot, offer.clubId);
    postNotice(snapshot, {
      key: `job_offer|${offer.id}`,
      topic: 'notice_job_offer',
      subject: `Proposta de emprego: ${name}`,
      body: `O ${name}${division ? ` (${DIVISION_LABEL[division] ?? division})` : ''} quer você como treinador. ${REASON_TEXT[offer.reason ?? 'lateral']} A proposta vale até ${brDate(offer.expiresOn)}; responda no Escritório › Propostas.`,
      date: input.date,
    });
  }
}
