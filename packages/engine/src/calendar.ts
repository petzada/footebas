import {
  GameDate,
  type ClubId,
  type CompetitionCalendarFixture,
  type CompetitionDefinition,
  type CompetitionStage,
} from '@footebas/domain';

export type CalendarViolationCode =
  | 'DUPLICATE_FIXTURE_ID'
  | 'UNKNOWN_COMPETITION'
  | 'UNKNOWN_STAGE'
  | 'INVALID_PHASE_ORDER'
  | 'INVALID_DATE'
  | 'RESERVED_DATE'
  | 'SELF_MATCH'
  | 'PARTICIPANT_NOT_REGISTERED'
  | 'PARTICIPANT_MISSING'
  | 'CLUB_DATE_CONFLICT'
  | 'MINIMUM_INTERVAL'
  | 'PHASE_OVERLAP'
  | 'INVALID_PAIRING'
  | 'INVALID_HOME_AWAY'
  | 'INVALID_GROUP'
  | 'INVALID_KNOCKOUT_TIE';

export interface CalendarViolation {
  readonly code: CalendarViolationCode;
  readonly message: string;
  readonly fixtureIds: readonly string[];
}

export interface CalendarValidationInput {
  readonly fixtures: readonly CompetitionCalendarFixture[];
  readonly competitions: readonly CompetitionDefinition[];
  readonly stageParticipants: Readonly<
    Record<string, Readonly<Record<string, readonly ClubId[]>>>
  >;
  readonly reservedDates?: readonly string[];
  /** Difference in civil days between consecutive matches for one club. */
  readonly minimumIntervalDays?: number;
}

export interface CalendarValidationResult {
  readonly valid: boolean;
  readonly violations: readonly CalendarViolation[];
}

export class InvalidCalendarError extends Error {
  public override readonly name = 'InvalidCalendarError';

  public constructor(public readonly violations: readonly CalendarViolation[]) {
    super(
      `Calendar is invalid: ${violations.map(({ code }) => code).join(', ')}`,
    );
  }
}

function violation(
  code: CalendarViolationCode,
  message: string,
  fixtureIds: readonly string[] = [],
): CalendarViolation {
  return Object.freeze({
    code,
    message,
    fixtureIds: Object.freeze([...fixtureIds]),
  });
}

function dayNumber(date: string): number {
  GameDate.parse(date);
  return Date.parse(`${date}T00:00:00.000Z`) / 86_400_000;
}

function validateStageShape(
  stage: CompetitionStage,
  fixtures: readonly CompetitionCalendarFixture[],
  participants: readonly ClubId[],
  violations: CalendarViolation[],
): void {
  const seenParticipants = new Set(
    fixtures.flatMap(({ homeClubId, awayClubId }) => [homeClubId, awayClubId]),
  );
  for (const clubId of participants)
    if (!seenParticipants.has(clubId))
      violations.push(
        violation(
          'PARTICIPANT_MISSING',
          `${clubId} has no fixture in ${stage.id}`,
        ),
      );

  const appearancesByRound = new Map<string, CompetitionCalendarFixture[]>();
  for (const fixture of fixtures)
    for (const clubId of [fixture.homeClubId, fixture.awayClubId]) {
      const key = `${String(fixture.round)}|${stage.type === 'knockout' ? String(fixture.leg ?? 1) : 'round'}|${clubId}`;
      const appearances = appearancesByRound.get(key) ?? [];
      appearances.push(fixture);
      appearancesByRound.set(key, appearances);
    }
  for (const [key, appearances] of appearancesByRound)
    if (appearances.length > 1)
      violations.push(
        violation(
          'INVALID_PAIRING',
          `${key} has multiple fixtures in the same round`,
          appearances.map(({ id }) => id),
        ),
      );

  if (stage.type === 'knockout') {
    validateKnockout(stage, fixtures, participants, violations);
    return;
  }

  const groupEntries =
    stage.type === 'groups'
      ? [...new Set(fixtures.map(({ groupId }) => groupId))]
      : ['all'];
  if (groupEntries.some((groupId) => groupId === undefined)) {
    violations.push(
      violation(
        'INVALID_GROUP',
        `Group stage ${stage.id} has an ungrouped fixture`,
      ),
    );
    return;
  }
  const participantGroups = new Map<ClubId, string>();
  for (const groupId of groupEntries as string[]) {
    const groupFixtures =
      stage.type === 'groups'
        ? fixtures.filter((fixture) => fixture.groupId === groupId)
        : fixtures;
    const groupParticipants = [
      ...new Set(
        groupFixtures.flatMap(({ homeClubId, awayClubId }) => [
          homeClubId,
          awayClubId,
        ]),
      ),
    ];
    for (const clubId of groupParticipants) {
      const previous = participantGroups.get(clubId);
      if (previous !== undefined && previous !== groupId)
        violations.push(
          violation('INVALID_GROUP', `${clubId} appears in multiple groups`),
        );
      participantGroups.set(clubId, groupId);
    }
    validateRoundRobinPairs(
      stage.roundRobin,
      groupFixtures,
      groupParticipants,
      violations,
    );
  }
  if (stage.type === 'groups' && groupEntries.length !== stage.groupCount)
    violations.push(
      violation(
        'INVALID_GROUP',
        `${stage.id} expected ${String(stage.groupCount)} groups, got ${String(groupEntries.length)}`,
      ),
    );
}

function validateRoundRobinPairs(
  format: 'single' | 'double',
  fixtures: readonly CompetitionCalendarFixture[],
  participants: readonly ClubId[],
  violations: CalendarViolation[],
): void {
  const expected = format === 'double' ? 2 : 1;
  for (let left = 0; left < participants.length; left += 1)
    for (let right = left + 1; right < participants.length; right += 1) {
      const first = participants[left];
      const second = participants[right];
      const pair = fixtures.filter(
        ({ homeClubId, awayClubId }) =>
          (homeClubId === first && awayClubId === second) ||
          (homeClubId === second && awayClubId === first),
      );
      if (pair.length !== expected)
        violations.push(
          violation(
            'INVALID_PAIRING',
            `${String(first)}-${String(second)} expected ${String(expected)} match(es), got ${String(pair.length)}`,
            pair.map(({ id }) => id),
          ),
        );
      if (
        format === 'double' &&
        pair.length === 2 &&
        pair[0]?.homeClubId !== pair[1]?.awayClubId
      )
        violations.push(
          violation(
            'INVALID_HOME_AWAY',
            `${String(first)}-${String(second)} does not invert venues`,
            pair.map(({ id }) => id),
          ),
        );
    }
}

function validateKnockout(
  stage: Extract<CompetitionStage, { type: 'knockout' }>,
  fixtures: readonly CompetitionCalendarFixture[],
  participants: readonly ClubId[],
  violations: CalendarViolation[],
): void {
  const ties = new Map<string, CompetitionCalendarFixture[]>();
  for (const fixture of fixtures) {
    if (fixture.tieId === undefined) {
      violations.push(
        violation('INVALID_KNOCKOUT_TIE', `${fixture.id} has no tieId`, [
          fixture.id,
        ]),
      );
      continue;
    }
    const tie = ties.get(fixture.tieId) ?? [];
    tie.push(fixture);
    ties.set(fixture.tieId, tie);
  }
  const expectedLegs =
    participants.length === 2 ? (stage.finalLegs ?? stage.legs) : stage.legs;
  for (const [tieId, tie] of ties) {
    const clubs = new Set(
      tie.flatMap(({ homeClubId, awayClubId }) => [homeClubId, awayClubId]),
    );
    if (clubs.size !== 2 || tie.length !== expectedLegs)
      violations.push(
        violation(
          'INVALID_KNOCKOUT_TIE',
          `${tieId} expected two clubs and ${String(expectedLegs)} leg(s)`,
          tie.map(({ id }) => id),
        ),
      );
    if (
      expectedLegs === 2 &&
      tie.length === 2 &&
      (tie[0]?.leg !== 1 ||
        tie[1]?.leg !== 2 ||
        tie[0].homeClubId !== tie[1].awayClubId)
    )
      violations.push(
        violation(
          'INVALID_HOME_AWAY',
          `${tieId} does not contain ordered inverted legs`,
          tie.map(({ id }) => id),
        ),
      );
  }
  if (ties.size * 2 !== participants.length)
    violations.push(
      violation(
        'INVALID_KNOCKOUT_TIE',
        `${stage.id} does not pair every participant exactly once`,
      ),
    );
}

export function validateCompetitionCalendar(
  input: CalendarValidationInput,
): CalendarValidationResult {
  const violations: CalendarViolation[] = [];
  const minimumIntervalDays = input.minimumIntervalDays ?? 3;
  if (!Number.isSafeInteger(minimumIntervalDays) || minimumIntervalDays < 1)
    throw new Error('minimumIntervalDays must be a positive safe integer');
  const definitions = new Map(
    input.competitions.map((definition) => [definition.id, definition]),
  );
  const fixtureIds = new Set<string>();
  const reservedDates = new Set(input.reservedDates ?? []);
  for (const date of reservedDates) dayNumber(date);

  for (const fixture of input.fixtures) {
    if (fixtureIds.has(fixture.id))
      violations.push(
        violation('DUPLICATE_FIXTURE_ID', `Duplicate fixture ${fixture.id}`, [
          fixture.id,
        ]),
      );
    fixtureIds.add(fixture.id);
    const definition = definitions.get(fixture.competitionId);
    if (definition === undefined) {
      violations.push(
        violation(
          'UNKNOWN_COMPETITION',
          `Unknown competition ${fixture.competitionId}`,
          [fixture.id],
        ),
      );
      continue;
    }
    const stageIndex = definition.stages.findIndex(
      ({ id }) => id === fixture.stageId,
    );
    const stage = definition.stages[stageIndex];
    if (stage === undefined) {
      violations.push(
        violation('UNKNOWN_STAGE', `Unknown stage ${fixture.stageId}`, [
          fixture.id,
        ]),
      );
      continue;
    }
    if (fixture.phaseOrder !== stageIndex + 1)
      violations.push(
        violation(
          'INVALID_PHASE_ORDER',
          `${fixture.id} has an invalid phase order`,
          [fixture.id],
        ),
      );
    try {
      dayNumber(fixture.date);
    } catch {
      violations.push(
        violation('INVALID_DATE', `${fixture.id} has an invalid date`, [
          fixture.id,
        ]),
      );
      continue;
    }
    if (reservedDates.has(fixture.date))
      violations.push(
        violation(
          'RESERVED_DATE',
          `${fixture.id} uses reserved date ${fixture.date}`,
          [fixture.id],
        ),
      );
    if (fixture.homeClubId === fixture.awayClubId)
      violations.push(
        violation(
          'SELF_MATCH',
          `${fixture.id} has the same home and away club`,
          [fixture.id],
        ),
      );
    const participants =
      input.stageParticipants[fixture.competitionId]?.[fixture.stageId] ?? [];
    if (
      !participants.includes(fixture.homeClubId) ||
      !participants.includes(fixture.awayClubId)
    )
      violations.push(
        violation(
          'PARTICIPANT_NOT_REGISTERED',
          `${fixture.id} contains an unregistered participant`,
          [fixture.id],
        ),
      );
  }

  const byClubDate = new Map<string, CompetitionCalendarFixture[]>();
  const byClub = new Map<ClubId, CompetitionCalendarFixture[]>();
  for (const fixture of input.fixtures) {
    for (const clubId of [fixture.homeClubId, fixture.awayClubId]) {
      const dateKey = `${clubId}|${fixture.date}`;
      const sameDate = byClubDate.get(dateKey) ?? [];
      sameDate.push(fixture);
      byClubDate.set(dateKey, sameDate);
      const clubFixtures = byClub.get(clubId) ?? [];
      clubFixtures.push(fixture);
      byClub.set(clubId, clubFixtures);
    }
  }
  for (const [key, fixtures] of byClubDate)
    if (fixtures.length > 1)
      violations.push(
        violation(
          'CLUB_DATE_CONFLICT',
          `${key} contains simultaneous matches`,
          fixtures.map(({ id }) => id),
        ),
      );
  for (const [clubId, fixtures] of byClub) {
    const validDates = fixtures
      .filter(({ date }) => {
        try {
          dayNumber(date);
          return true;
        } catch {
          return false;
        }
      })
      .sort((left, right) => left.date.localeCompare(right.date));
    for (let index = 1; index < validDates.length; index += 1) {
      const previous = validDates[index - 1];
      const current = validDates[index];
      if (previous === undefined || current === undefined) continue;
      const interval = dayNumber(current.date) - dayNumber(previous.date);
      if (interval < minimumIntervalDays)
        violations.push(
          violation(
            'MINIMUM_INTERVAL',
            `${clubId} has only ${String(interval)} day(s) between matches`,
            [previous.id, current.id],
          ),
        );
    }
  }

  for (const definition of input.competitions) {
    for (const [stageIndex, stage] of definition.stages.entries()) {
      const fixtures = input.fixtures.filter(
        ({ competitionId, stageId }) =>
          competitionId === definition.id && stageId === stage.id,
      );
      const participants =
        input.stageParticipants[definition.id]?.[stage.id] ?? [];
      if (fixtures.length > 0)
        validateStageShape(stage, fixtures, participants, violations);
      if (stageIndex === 0 || fixtures.length === 0) continue;
      const previousStage = definition.stages[stageIndex - 1];
      if (previousStage === undefined) continue;
      const previousFixtures = input.fixtures.filter(
        ({ competitionId, stageId }) =>
          competitionId === definition.id && stageId === previousStage.id,
      );
      const first = fixtures.map(({ date }) => date).sort()[0];
      const lastPrevious = previousFixtures
        .map(({ date }) => date)
        .sort()
        .at(-1);
      if (
        first !== undefined &&
        lastPrevious !== undefined &&
        first <= lastPrevious
      )
        violations.push(
          violation(
            'PHASE_OVERLAP',
            `${stage.id} starts before ${previousStage.id} finishes`,
          ),
        );
    }
  }

  return Object.freeze({
    valid: violations.length === 0,
    violations: Object.freeze(violations),
  });
}

export function assertValidCompetitionCalendar(
  input: CalendarValidationInput,
): void {
  const result = validateCompetitionCalendar(input);
  if (!result.valid) throw new InvalidCalendarError(result.violations);
}
