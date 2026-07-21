/* eslint-disable @typescript-eslint/no-non-null-assertion -- every indexed access follows explicit cardinality validation in the reference verifier */
import type {
  CompetitionConfig,
  ContinentalConfig,
  DivisionId,
  PhaseFiveContent,
} from './phase5-content.js';

export const PHASE_FIVE_REFERENCE_VERSION =
  'phase-five-reference-verifier-v1' as const;

export interface ReferenceFixture {
  readonly id: string;
  readonly competitionId: string;
  readonly stage: string;
  readonly matchDay: number;
  readonly homeClubId: string;
  readonly awayClubId: string;
  readonly leg: number;
}

export interface CompetitionClosure {
  readonly competitionId: string;
  readonly championClubId: string;
  readonly participants: number;
  readonly matches: number;
  readonly closed: true;
}

export interface ReferenceSeasonState {
  readonly season: number;
  readonly divisions: Readonly<Record<DivisionId, readonly string[]>>;
  readonly continentalDirect: readonly string[];
  readonly continentalPreliminary: readonly string[];
}

export interface ReferenceSeasonResult {
  readonly season: number;
  readonly fixtures: readonly ReferenceFixture[];
  readonly closures: readonly CompetitionClosure[];
  readonly nationalRankings: Readonly<Record<DivisionId, readonly string[]>>;
  readonly cupChampion: string;
  readonly next: ReferenceSeasonState;
}

function hash(text: string): number {
  let result = 2_166_136_261;
  for (const character of text) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16_777_619);
  }
  return result >>> 0;
}

function ranked(
  clubIds: readonly string[],
  seed: string,
  competitionId: string,
): readonly string[] {
  return [...clubIds].sort(
    (left, right) =>
      hash(`${seed}|${competitionId}|${right}`) -
        hash(`${seed}|${competitionId}|${left}`) || left.localeCompare(right),
  );
}

function roundRobinRounds(
  clubIds: readonly string[],
  legs: number,
): readonly (readonly (readonly [string, string])[])[] {
  if (clubIds.length < 2 || legs < 1)
    throw new Error('Round robin requires at least two clubs and one leg');
  const bye = '__bye__';
  const rotating = clubIds.length % 2 === 0 ? [...clubIds] : [...clubIds, bye];
  const firstLeg: (readonly (readonly [string, string])[])[] = [];
  for (let round = 0; round < rotating.length - 1; round += 1) {
    const matches: (readonly [string, string])[] = [];
    for (let index = 0; index < rotating.length / 2; index += 1) {
      const left = rotating[index]!;
      const right = rotating[rotating.length - 1 - index]!;
      if (left !== bye && right !== bye)
        matches.push(round % 2 === 0 ? [left, right] : [right, left]);
    }
    firstLeg.push(matches);
    rotating.splice(1, 0, rotating.pop()!);
  }
  const rounds: (readonly (readonly [string, string])[])[] = [];
  for (let leg = 0; leg < legs; leg += 1)
    for (const matches of firstLeg)
      rounds.push(
        leg % 2 === 0
          ? matches
          : matches.map(([home, away]) => [away, home] as const),
      );
  return rounds;
}

function addRoundRobin(
  fixtures: ReferenceFixture[],
  input: Readonly<{
    season: number;
    competitionId: string;
    stage: string;
    clubIds: readonly string[];
    legs: number;
    firstMatchDay: number;
    matchDayInterval: number;
  }>,
): number {
  const rounds = roundRobinRounds(input.clubIds, input.legs);
  let count = 0;
  rounds.forEach((matches, round) => {
    matches.forEach(([homeClubId, awayClubId], match) => {
      fixtures.push({
        id: `s${String(input.season)}:${input.competitionId}:${input.stage}:r${String(round + 1)}:m${String(match + 1)}`,
        competitionId: input.competitionId,
        stage: input.stage,
        matchDay: input.firstMatchDay + round * input.matchDayInterval,
        homeClubId,
        awayClubId,
        leg: Math.floor(round / (rounds.length / input.legs)) + 1,
      });
      count += 1;
    });
  });
  return count;
}

function pairWinner(
  homeClubId: string,
  awayClubId: string,
  seed: string,
  stage: string,
): string {
  return ranked([homeClubId, awayClubId], seed, stage)[0]!;
}

function addKnockoutPair(
  fixtures: ReferenceFixture[],
  input: Readonly<{
    season: number;
    competitionId: string;
    stage: string;
    homeClubId: string;
    awayClubId: string;
    matchDays: readonly number[];
  }>,
): string {
  input.matchDays.forEach((matchDay, index) => {
    fixtures.push({
      id: `s${String(input.season)}:${input.competitionId}:${input.stage}:${input.homeClubId}:${input.awayClubId}:l${String(index + 1)}`,
      competitionId: input.competitionId,
      stage: input.stage,
      matchDay,
      homeClubId: index % 2 === 0 ? input.homeClubId : input.awayClubId,
      awayClubId: index % 2 === 0 ? input.awayClubId : input.homeClubId,
      leg: index + 1,
    });
  });
  return pairWinner(
    input.homeClubId,
    input.awayClubId,
    `season-${String(input.season)}`,
    `${input.competitionId}:${input.stage}`,
  );
}

function addCup(
  fixtures: ReferenceFixture[],
  config: CompetitionConfig,
  season: number,
  clubIds: readonly string[],
): Readonly<{ champion: string; matches: number }> {
  const cup = config.nationalCup;
  let participants = ranked(
    clubIds,
    `season-${String(season)}`,
    `${cup.id}:seed`,
  );
  const bracketSize = 2 ** Math.ceil(Math.log2(participants.length));
  const byes = bracketSize - participants.length;
  let dayCursor = 0;
  let matches = 0;
  for (let round = 0; round < cup.legsByRound.length; round += 1) {
    const next: string[] = [];
    const roundByes = round === 0 ? byes : 0;
    next.push(...participants.slice(0, roundByes));
    const legs = cup.legsByRound[round]!;
    const matchDays = cup.matchDays.slice(dayCursor, dayCursor + legs);
    dayCursor += legs;
    for (let index = roundByes; index < participants.length; index += 2) {
      const homeClubId = participants[index]!;
      const awayClubId = participants[index + 1];
      if (awayClubId === undefined) {
        next.push(homeClubId);
        continue;
      }
      next.push(
        addKnockoutPair(fixtures, {
          season,
          competitionId: cup.id,
          stage: `round-${String(round + 1)}`,
          homeClubId,
          awayClubId,
          matchDays,
        }),
      );
      matches += legs;
    }
    participants = next;
  }
  if (participants.length !== 1)
    throw new Error(
      `${cup.id} bracket did not close; ${String(participants.length)} remain`,
    );
  return { champion: participants[0]!, matches };
}

function addContinental(
  fixtures: ReferenceFixture[],
  config: ContinentalConfig,
  season: number,
  direct: readonly string[],
  preliminary: readonly string[],
): Readonly<{ champion: string; matches: number; participants: number }> {
  const preliminaryWinners: string[] = [];
  let matches = 0;
  for (let index = 0; index < preliminary.length; index += 2) {
    preliminaryWinners.push(
      addKnockoutPair(fixtures, {
        season,
        competitionId: config.id,
        stage: 'preliminary',
        homeClubId: preliminary[index]!,
        awayClubId: preliminary[index + 1]!,
        matchDays: config.preliminaryMatchDays,
      }),
    );
    matches += config.preliminaryLegs;
  }
  const groupParticipants = [...direct, ...preliminaryWinners];
  const knockout: string[] = [];
  for (let group = 0; group < config.groupCount; group += 1) {
    const groupClubs = groupParticipants.filter(
      (_clubId, index) => index % config.groupCount === group,
    );
    const rounds = roundRobinRounds(groupClubs, 2);
    rounds.forEach((roundMatches, round) => {
      roundMatches.forEach(([homeClubId, awayClubId], match) => {
        fixtures.push({
          id: `s${String(season)}:${config.id}:group-${String(group + 1)}:r${String(round + 1)}:m${String(match + 1)}`,
          competitionId: config.id,
          stage: `group-${String(group + 1)}`,
          matchDay: config.groupMatchDays[round]!,
          homeClubId,
          awayClubId,
          leg: round < config.groupSize - 1 ? 1 : 2,
        });
        matches += 1;
      });
    });
    knockout.push(
      ...ranked(
        groupClubs,
        `season-${String(season)}`,
        `${config.id}:group-${String(group + 1)}`,
      ).slice(0, config.qualifiersPerGroup),
    );
  }
  let roundParticipants = knockout;
  let matchDayCursor = 0;
  let knockoutRound = 1;
  while (roundParticipants.length > 1) {
    const next: string[] = [];
    const matchDays = config.knockoutMatchDays.slice(
      matchDayCursor,
      matchDayCursor + config.knockoutLegs,
    );
    for (let index = 0; index < roundParticipants.length; index += 2) {
      next.push(
        addKnockoutPair(fixtures, {
          season,
          competitionId: config.id,
          stage: `knockout-${String(knockoutRound)}`,
          homeClubId: roundParticipants[index]!,
          awayClubId: roundParticipants[index + 1]!,
          matchDays,
        }),
      );
      matches += config.knockoutLegs;
    }
    roundParticipants = next;
    knockoutRound += 1;
    matchDayCursor += config.knockoutLegs;
  }
  return {
    champion: roundParticipants[0]!,
    matches,
    participants: direct.length + preliminary.length,
  };
}

export function initialReferenceState(
  content: PhaseFiveContent,
): ReferenceSeasonState {
  const divisions = Object.fromEntries(
    (['serie-a', 'serie-b', 'serie-c'] as const).map((division) => [
      division,
      content.clubs
        .filter(({ initialDivision }) => initialDivision === division)
        .map(({ id }) => id),
    ]),
  ) as unknown as Record<DivisionId, readonly string[]>;
  return Object.freeze({
    season: 1,
    divisions,
    continentalDirect: content.config.continental.initialDirectClubIds,
    continentalPreliminary:
      content.config.continental.initialPreliminaryClubIds,
  });
}

export function expectedNextState(
  state: ReferenceSeasonState,
  rankings: Readonly<Record<DivisionId, readonly string[]>>,
  cupChampion: string,
  config: CompetitionConfig,
): ReferenceSeasonState {
  const leagueA = config.nationalLeagues.find(
    ({ division }) => division === 'serie-a',
  )!;
  const leagueB = config.nationalLeagues.find(
    ({ division }) => division === 'serie-b',
  )!;
  const leagueC = config.nationalLeagues.find(
    ({ division }) => division === 'serie-c',
  )!;
  const promotedB = rankings['serie-b'].slice(0, leagueB.promoted);
  const promotedC = rankings['serie-c'].slice(0, leagueC.promoted);
  const relegatedA = rankings['serie-a'].slice(-leagueA.relegated);
  const relegatedB = rankings['serie-b'].slice(-leagueB.relegated);
  const nextA = [
    ...rankings['serie-a'].slice(
      0,
      rankings['serie-a'].length - leagueA.relegated,
    ),
    ...promotedB,
  ];
  const nextB = [
    ...rankings['serie-b'].slice(
      leagueB.promoted,
      rankings['serie-b'].length - leagueB.relegated,
    ),
    ...relegatedA,
    ...promotedC,
  ];
  const nextC = [...rankings['serie-c'].slice(leagueC.promoted), ...relegatedB];
  const orderedQualification = [
    cupChampion,
    ...rankings['serie-a'],
    ...rankings['serie-b'],
    ...rankings['serie-c'],
  ].filter((clubId, index, values) => values.indexOf(clubId) === index);
  const direct = orderedQualification.slice(0, config.continental.directSlots);
  const directSet = new Set(direct);
  const preliminary = orderedQualification
    .filter((clubId) => !directSet.has(clubId))
    .slice(0, config.continental.preliminarySlots);
  return Object.freeze({
    season: state.season + 1,
    divisions: Object.freeze({
      'serie-a': Object.freeze(nextA),
      'serie-b': Object.freeze(nextB),
      'serie-c': Object.freeze(nextC),
    }),
    continentalDirect: Object.freeze(direct),
    continentalPreliminary: Object.freeze(preliminary),
  });
}

export function validateReferenceCalendar(
  fixtures: readonly ReferenceFixture[],
  config: CompetitionConfig,
): readonly string[] {
  const failures: string[] = [];
  const fixtureIds = new Set<string>();
  const clubDays = new Map<string, number[]>();
  for (const fixture of fixtures) {
    if (fixtureIds.has(fixture.id))
      failures.push(`duplicate fixture ID ${fixture.id}`);
    fixtureIds.add(fixture.id);
    if (fixture.homeClubId === fixture.awayClubId)
      failures.push(`${fixture.id}: club plays itself`);
    if (fixture.matchDay < 0 || fixture.matchDay >= config.seasonDays)
      failures.push(`${fixture.id}: match day outside season`);
    for (const clubId of [fixture.homeClubId, fixture.awayClubId]) {
      const days = clubDays.get(clubId) ?? [];
      if (days.includes(fixture.matchDay))
        failures.push(
          `${clubId}: simultaneous matches on day ${String(fixture.matchDay)}`,
        );
      days.push(fixture.matchDay);
      clubDays.set(clubId, days);
    }
  }
  for (const [clubId, unsorted] of clubDays) {
    const days = [...unsorted].sort((left, right) => left - right);
    for (let index = 1; index < days.length; index += 1)
      if (days[index]! - days[index - 1]! <= config.minimumRestDays)
        failures.push(
          `${clubId}: only ${String(days[index]! - days[index - 1]! - 1)} rest days before day ${String(days[index])}`,
        );
  }
  return failures;
}

export function simulateReferenceSeason(
  content: PhaseFiveContent,
  state: ReferenceSeasonState,
  seed: string,
): ReferenceSeasonResult {
  const fixtures: ReferenceFixture[] = [];
  const closures: CompetitionClosure[] = [];
  const rankings = {} as Record<DivisionId, readonly string[]>;
  for (const league of content.config.nationalLeagues) {
    const clubIds = state.divisions[league.division];
    if (clubIds.length !== league.clubs)
      throw new Error(`${league.id} expected ${String(league.clubs)} clubs`);
    const matches = addRoundRobin(fixtures, {
      season: state.season,
      competitionId: league.id,
      stage: 'league',
      clubIds,
      legs: league.roundRobinLegs,
      firstMatchDay: league.firstMatchDay,
      matchDayInterval: league.matchDayInterval,
    });
    const table = ranked(clubIds, `${seed}|${String(state.season)}`, league.id);
    rankings[league.division] = table;
    closures.push({
      competitionId: league.id,
      championClubId: table[0]!,
      participants: clubIds.length,
      matches,
      closed: true,
    });
  }
  for (const stateLeague of content.config.stateLeagues) {
    const clubIds = stateLeague.participants.map(([clubId]) => clubId);
    const matches = addRoundRobin(fixtures, {
      season: state.season,
      competitionId: stateLeague.id,
      stage: 'league',
      clubIds,
      legs: 1,
      firstMatchDay: stateLeague.firstMatchDay,
      matchDayInterval: stateLeague.matchDayInterval,
    });
    closures.push({
      competitionId: stateLeague.id,
      championClubId: ranked(
        clubIds,
        `${seed}|${String(state.season)}`,
        stateLeague.id,
      )[0]!,
      participants: clubIds.length,
      matches,
      closed: true,
    });
  }
  const allClubs = (['serie-a', 'serie-b', 'serie-c'] as const).flatMap(
    (division) => state.divisions[division],
  );
  const cup = addCup(fixtures, content.config, state.season, allClubs);
  closures.push({
    competitionId: content.config.nationalCup.id,
    championClubId: cup.champion,
    participants: allClubs.length,
    matches: cup.matches,
    closed: true,
  });
  const continental = addContinental(
    fixtures,
    content.config.continental,
    state.season,
    state.continentalDirect,
    state.continentalPreliminary,
  );
  closures.push({
    competitionId: content.config.continental.id,
    championClubId: continental.champion,
    participants: continental.participants,
    matches: continental.matches,
    closed: true,
  });
  const calendarFailures = validateReferenceCalendar(fixtures, content.config);
  if (calendarFailures.length > 0)
    throw new Error(
      `Calendar rejected before season: ${calendarFailures.join('; ')}`,
    );
  return Object.freeze({
    season: state.season,
    fixtures: Object.freeze(fixtures),
    closures: Object.freeze(closures),
    nationalRankings: Object.freeze(rankings),
    cupChampion: cup.champion,
    next: expectedNextState(state, rankings, cup.champion, content.config),
  });
}
