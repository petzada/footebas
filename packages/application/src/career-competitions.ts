import type {
  CompetitionCalendarReadModel,
  CompetitionPyramidReadModel,
  CompetitionTablesReadModel,
  NextSeasonTransitionReadModel,
} from '@footebas/contracts';
import type { CompetitionDefinition } from '@footebas/domain';
import {
  careerSeasonSystem,
  liveCompetition,
  type CareerSeasonState,
  type MvpCompetitionConfig,
} from '@footebas/engine';
import { PRIZE_BY_TIER } from './career-world-rules.js';

export interface SeasonMovement {
  clubId: string;
  fromCompetitionId: string;
  toCompetitionId: string;
  kind: 'promoted' | 'relegated';
}
export interface SeasonQualifier {
  clubId: string;
  fromCompetitionId: string;
  toCompetitionId: string;
}
export interface SeasonSummary {
  season: number;
  year: number;
  champions: {
    competitionId: string;
    championId: string;
    runnerUpId?: string;
  }[];
  movements: SeasonMovement[];
  qualifiers: SeasonQualifier[];
}

interface ProjectionInput {
  readonly careerId: string;
  readonly aggregateVersion: number;
  readonly projectedAt: string;
  readonly config: MvpCompetitionConfig;
  readonly competition: CareerSeasonState;
  readonly clubNames: ReadonlyMap<string, string>;
  readonly managedClubId?: string;
  readonly history: readonly SeasonSummary[];
}

const FORMAT: Readonly<Record<CompetitionDefinition['tier'], string>> = {
  national_league: 'Pontos corridos, turno e returno',
  national_cup: 'Mata-mata nacional',
  state: 'Estadual em pontos corridos',
  continental: 'Preliminar, grupos e mata-mata',
};

function base(input: ProjectionInput) {
  return {
    version: 1 as const,
    careerId: input.careerId,
    aggregateVersion: input.aggregateVersion,
    projectedAt: input.projectedAt,
  };
}

function competitionModel(
  input: ProjectionInput,
  definition: CompetitionDefinition,
  divisionTier?: number,
) {
  const progress = input.competition.competitions.find(
    ({ competitionId }) => competitionId === definition.id,
  );
  const fixtures = input.competition.fixtures.filter(
    ({ competitionId }) => competitionId === definition.id,
  );
  const played = fixtures.some(({ id }) => input.competition.results[id]);
  const status =
    progress?.outcome !== undefined
      ? ('complete' as const)
      : played
        ? ('active' as const)
        : ('scheduled' as const);
  const currentIndex = progress?.outcome
    ? definition.stages.length - 1
    : (progress?.stageIndex ?? 0);
  const phases = definition.stages.map((stage, index) => {
    const stageFixtures = fixtures.filter(
      ({ stageId }) => stageId === stage.id,
    );
    const dates = stageFixtures.map(({ date }) => date).sort();
    return {
      id: stage.id,
      name: stage.name,
      kind:
        stage.type === 'league'
          ? definition.tier === 'national_league'
            ? ('league' as const)
            : ('single_round_robin' as const)
          : stage.type === 'groups'
            ? ('groups' as const)
            : index === 0 && definition.tier === 'continental'
              ? ('qualifying' as const)
              : ('knockout' as const),
      status:
        index < currentIndex || progress?.outcome !== undefined
          ? ('complete' as const)
          : index === currentIndex && played
            ? ('active' as const)
            : ('scheduled' as const),
      startsOn: dates[0] ?? stage.schedule.firstDate,
      endsOn: dates.at(-1) ?? stage.schedule.firstDate,
      participantCount: Math.max(
        2,
        new Set(
          stageFixtures.flatMap(({ homeClubId, awayClubId }) => [
            homeClubId,
            awayClubId,
          ]),
        ).size,
      ),
    };
  });
  const divisionKey =
    divisionTier === undefined
      ? undefined
      : (['serie-a', 'serie-b', 'serie-c'] as const)[divisionTier - 1];
  const league = input.config.nationalLeagues.find(
    ({ division }) => division === divisionKey,
  );
  const divisionIds = careerSeasonSystem(input.config, input.competition).ids
    .divisions;
  const qualifications = [
    ...(league && league.promoted > 0 && divisionTier && divisionTier > 1
      ? [
          {
            label: `Acesso à divisão superior`,
            places: league.promoted,
            destinationDivisionId:
              divisionTier === 2
                ? divisionIds['serie-a']
                : divisionIds['serie-b'],
          },
        ]
      : []),
    ...(league && league.relegated > 0 && divisionTier && divisionTier < 3
      ? [
          {
            label: `Rebaixamento`,
            places: league.relegated,
            destinationDivisionId:
              divisionTier === 1
                ? divisionIds['serie-b']
                : divisionIds['serie-c'],
          },
        ]
      : []),
  ];
  const champion = definition.awards.find(({ positions }) =>
    positions.includes(1),
  );
  return {
    id: definition.id,
    name: definition.name,
    category: definition.tier,
    ...(divisionTier === undefined ? {} : { tier: divisionTier }),
    formatLabel: FORMAT[definition.tier],
    currentPhase: definition.stages[currentIndex]?.name ?? definition.name,
    status,
    participantCount: Math.max(
      phases[0]?.participantCount ?? 2,
      progress?.entrants ?? 0,
    ),
    phases,
    qualifications,
    prize: PRIZE_BY_TIER[definition.tier] * 100,
    prestige: champion?.prestige ?? 0,
  };
}

export function projectPyramid(
  input: ProjectionInput,
): CompetitionPyramidReadModel {
  const system = careerSeasonSystem(input.config, input.competition);
  const divisionIds = [
    system.ids.divisions['serie-a'],
    system.ids.divisions['serie-b'],
    system.ids.divisions['serie-c'],
  ];
  const definitionOf = (id: string) => {
    const definition = system.definitions.find((item) => item.id === id);
    if (definition === undefined) throw new Error(`unknown competition ${id}`);
    return definition;
  };
  return {
    ...base(input),
    season: input.competition.year,
    divisions: divisionIds.map((id, index) =>
      competitionModel(input, definitionOf(id), index + 1),
    ),
    cups: system.definitions
      .filter(({ id }) => !divisionIds.includes(id))
      .map((definition) => competitionModel(input, definition)),
  };
}

type TableZone =
  CompetitionTablesReadModel['competitions'][number]['stages'][number]['groups'][number]['zones'][number];

/** Colour bands of a table, from the season rules (approximate for the cup winner). */
function zonesOf(
  config: MvpCompetitionConfig,
  definition: CompetitionDefinition,
  stageType: 'league' | 'groups',
  divisionKey: 'serie-a' | 'serie-b' | 'serie-c' | undefined,
  size: number,
): TableZone[] {
  if (stageType === 'groups')
    return [
      {
        kind: 'advance',
        label: 'Classificados ao mata-mata',
        from: 1,
        to: Math.min(size, config.continental.qualifiersPerGroup),
      },
    ];
  if (definition.tier === 'state')
    return [{ kind: 'title', label: 'Campeão estadual', from: 1, to: 1 }];
  const league = config.nationalLeagues.find(
    ({ division }) => division === divisionKey,
  );
  if (league === undefined) return [];
  const zones: TableZone[] = [];
  if (divisionKey === 'serie-a') {
    // The cup winner takes one direct place; the rest go by the table.
    const direct = Math.max(0, config.continental.directSlots - 1);
    const preliminary = config.continental.preliminarySlots;
    if (direct > 0)
      zones.push({
        kind: 'continental',
        label: 'Libertadores (fase de grupos)',
        from: 1,
        to: direct,
      });
    if (preliminary > 0)
      zones.push({
        kind: 'continental_qualifying',
        label: 'Pré-Libertadores',
        from: direct + 1,
        to: direct + preliminary,
      });
  } else if (league.promoted > 0)
    zones.push({
      kind: 'promotion',
      label: 'Acesso',
      from: 1,
      to: league.promoted,
    });
  if (league.relegated > 0)
    zones.push({
      kind: 'relegation',
      label: 'Rebaixamento',
      from: league.clubs - league.relegated + 1,
      to: league.clubs,
    });
  return zones.filter(({ from, to }) => from <= to && to <= size);
}

const groupName = (groupId: string, index: number) =>
  /^group_\d+$/.test(groupId)
    ? `Grupo ${String.fromCharCode(65 + index)}`
    : 'Classificação';

/**
 * Tables and brackets of every competition (`GET /v1/careers/:id/tables`):
 * league and group tables with zones, knockout ties with aggregate, the
 * current phase, and the champion only once the competition is decided.
 */
export function projectTables(
  input: ProjectionInput,
): CompetitionTablesReadModel {
  const system = careerSeasonSystem(input.config, input.competition);
  const divisionOf = new Map<string, 'serie-a' | 'serie-b' | 'serie-c'>(
    (['serie-a', 'serie-b', 'serie-c'] as const).map((division) => [
      system.ids.divisions[division],
      division,
    ]),
  );
  const club = (id: string) => ({ id, name: input.clubNames.get(id) ?? id });
  const managed = input.managedClubId;
  const competitions = system.definitions.map((definition) => {
    // Every definition of the season has its progress entry.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const progress = input.competition.competitions.find(
      ({ competitionId }) => competitionId === definition.id,
    )!;
    const live = liveCompetition(
      input.config,
      input.competition,
      definition.id,
    );
    const fixtures = input.competition.fixtures.filter(
      ({ competitionId }) => competitionId === definition.id,
    );
    const takesPart =
      managed !== undefined &&
      (fixtures.some(
        ({ homeClubId, awayClubId }) =>
          homeClubId === managed || awayClubId === managed,
      ) ||
        Object.values(progress.seededByStage).some((ids) =>
          ids.some((id) => id === managed),
        ));
    const stages = live.stages.map((stage) => ({
      id: stage.stageId,
      name: stage.name,
      kind: stage.type,
      status: stage.status,
      groups: stage.groups.map(({ groupId, standings }, index) => {
        const zones = zonesOf(
          input.config,
          definition,
          stage.type === 'groups' ? 'groups' : 'league',
          divisionOf.get(definition.id),
          standings.length,
        );
        return {
          id: groupId,
          name: groupName(groupId, index),
          rows: standings.map((row, position) => {
            const zone = zones.find(
              ({ from, to }) => position + 1 >= from && position + 1 <= to,
            );
            return {
              position: position + 1,
              club: club(row.clubId),
              played: row.played,
              won: row.wins,
              drawn: row.draws,
              lost: row.losses,
              goalsFor: row.goalsFor,
              goalsAgainst: row.goalsAgainst,
              goalDifference: row.goalDifference,
              points: row.points,
              ...(zone === undefined ? {} : { zone: zone.kind }),
            };
          }),
          zones,
        };
      }),
      ties: stage.ties.map((tie) => ({
        id: tie.tieId,
        home: club(tie.homeClubId),
        away: club(tie.awayClubId),
        legs: tie.legs.map(({ fixture, result }) => ({
          fixtureId: fixture.id,
          leg: fixture.leg ?? 1,
          date: fixture.date,
          homeClubId: fixture.homeClubId,
          awayClubId: fixture.awayClubId,
          ...(result === undefined
            ? {}
            : { homeGoals: result.homeGoals, awayGoals: result.awayGoals }),
        })),
        ...(tie.aggregate === undefined ? {} : { aggregate: tie.aggregate }),
        ...(tie.winnerClubId === undefined
          ? {}
          : { winnerClubId: tie.winnerClubId, decidedBy: tie.decidedBy }),
        status:
          tie.winnerClubId !== undefined
            ? ('complete' as const)
            : tie.aggregate !== undefined
              ? ('active' as const)
              : ('scheduled' as const),
      })),
      byes: stage.byeClubIds.map(club),
    }));
    return {
      competitionId: definition.id,
      name: definition.name,
      category: definition.tier,
      status:
        progress.outcome !== undefined
          ? ('complete' as const)
          : fixtures.some(({ id }) => input.competition.results[id])
            ? ('active' as const)
            : ('scheduled' as const),
      managed: takesPart,
      currentStageId: live.currentStageId,
      ...(live.championId === undefined || live.decidedOn === undefined
        ? {}
        : {
            champion: {
              club: club(live.championId),
              decidedOn: live.decidedOn,
            },
          }),
      stages,
    };
  });
  const focus =
    competitions.find(
      ({ category, managed: mine, status }) =>
        category === 'state' && mine && status !== 'complete',
    ) ??
    competitions.find(
      ({ category, managed: mine }) => category === 'national_league' && mine,
    );
  return {
    ...base(input),
    season: input.competition.year,
    ...(focus === undefined ? {} : { focusCompetitionId: focus.competitionId }),
    competitions,
  };
}

/** The managed club's fixtures across every competition of the season. */
export function projectCalendar(
  input: ProjectionInput,
): CompetitionCalendarReadModel {
  const system = careerSeasonSystem(input.config, input.competition);
  const definitions = new Map(
    system.definitions.map((definition) => [definition.id, definition]),
  );
  const name = (clubId: string) => input.clubNames.get(clubId) ?? clubId;
  return {
    ...base(input),
    season: input.competition.year,
    status: 'published',
    validation: { valid: true, checkedAt: input.projectedAt, conflictCount: 0 },
    entries: input.competition.fixtures
      .filter(
        ({ homeClubId, awayClubId }) =>
          input.managedClubId === undefined ||
          homeClubId === input.managedClubId ||
          awayClubId === input.managedClubId,
      )
      .map((fixture) => {
        const definition = definitions.get(fixture.competitionId);
        const result = input.competition.results[fixture.id];
        return {
          id: fixture.id,
          competitionId: fixture.competitionId,
          competitionName: definition?.name ?? fixture.competitionId,
          phaseName:
            definition?.stages.find(({ id }) => id === fixture.stageId)?.name ??
            fixture.stageId,
          date: fixture.date,
          label: result
            ? `${name(fixture.homeClubId)} ${String(result.homeGoals)} × ${String(result.awayGoals)} ${name(fixture.awayClubId)}`
            : `${name(fixture.homeClubId)} × ${name(fixture.awayClubId)}`,
          status: result ? ('played' as const) : ('scheduled' as const),
          homeClubId: fixture.homeClubId,
          awayClubId: fixture.awayClubId,
        };
      }),
  };
}

export function projectTransition(
  input: ProjectionInput,
): NextSeasonTransitionReadModel {
  const last = input.history.at(-1);
  const system = careerSeasonSystem(input.config, input.competition);
  const definitions = new Map(
    system.definitions.map((definition) => [definition.id, definition]),
  );
  const name = (clubId: string) => input.clubNames.get(clubId) ?? clubId;
  if (last === undefined)
    return {
      ...base(input),
      completedSeason: input.competition.year,
      nextSeason: input.competition.year + 1,
      status: 'pending',
      movements: [],
      qualifiers: [],
      awards: [],
    };
  return {
    ...base(input),
    completedSeason: last.year,
    nextSeason: last.year + 1,
    status: 'generated',
    movements: last.movements.map((movement) => ({
      clubId: movement.clubId,
      clubName: name(movement.clubId),
      fromDivisionId: movement.fromCompetitionId,
      toDivisionId: movement.toCompetitionId,
      kind: movement.kind,
    })),
    qualifiers: last.qualifiers.map((qualifier) => ({
      clubId: qualifier.clubId,
      clubName: name(qualifier.clubId),
      competitionId: qualifier.toCompetitionId,
      competitionName:
        definitions.get(qualifier.toCompetitionId as never)?.name ??
        qualifier.toCompetitionId,
      route: `Vaga via ${definitions.get(qualifier.fromCompetitionId as never)?.name ?? qualifier.fromCompetitionId}`,
    })),
    awards: last.champions.map((champion) => {
      const definition = definitions.get(champion.competitionId as never);
      return {
        id: `award_${champion.competitionId}_${String(last.year)}`,
        competitionId: champion.competitionId,
        clubId: champion.championId,
        label: `Campeão de ${definition?.name ?? champion.competitionId}`,
        prize: definition ? PRIZE_BY_TIER[definition.tier] * 100 : 0,
        prestige:
          definition?.awards.find(({ positions }) => positions.includes(1))
            ?.prestige ?? 0,
      };
    }),
  };
}
