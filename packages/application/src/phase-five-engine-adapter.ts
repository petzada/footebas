import {
  generateCompetitionAwards,
  generateNextSeason,
} from '@footebas/engine';
import {
  PhaseFiveConflictError,
  type PhaseFiveCompetitionState,
  type PhaseFiveSeasonGenerationPort,
} from './phase-five.js';

const nameOf = (names: Readonly<Record<string, string>>, id: string): string =>
  names[id] ?? id.replaceAll('_', ' ');

export class EnginePhaseFiveSeasonGenerationAdapter implements PhaseFiveSeasonGenerationPort {
  public generate(
    input: Parameters<PhaseFiveSeasonGenerationPort['generate']>[0],
  ): PhaseFiveCompetitionState {
    const { current, command, projectedAt, aggregateVersion } = input;
    const plan = current.seasonPlan;
    if (plan === undefined)
      throw new PhaseFiveConflictError(
        'career has no canonical competition outcomes to generate a season',
      );
    if (
      plan.outcomes.length === 0 ||
      plan.outcomes.some(
        ({ edition }) => edition !== command.payload.completedSeason,
      )
    )
      throw new PhaseFiveConflictError(
        'canonical competition outcomes do not match the completed season',
      );
    let generated: ReturnType<typeof generateNextSeason>;
    try {
      generated = generateNextSeason(plan.outcomes, plan.allocations);
    } catch (error) {
      throw new PhaseFiveConflictError(
        `canonical season generation failed: ${error instanceof Error ? error.message : 'unknown engine error'}`,
      );
    }
    const events = generated.events;
    const movements = events.flatMap((event) =>
      event.type === 'ClubPromoted' || event.type === 'ClubRelegated'
        ? [
            {
              clubId: event.clubId,
              clubName: nameOf(plan.clubNames, event.clubId),
              fromDivisionId: event.fromCompetitionId,
              toDivisionId: event.toCompetitionId,
              kind:
                event.type === 'ClubPromoted'
                  ? ('promoted' as const)
                  : ('relegated' as const),
            },
          ]
        : [],
    );
    const definitionById = new Map(
      plan.definitions.map((definition) => [definition.id, definition]),
    );
    const qualifiers = events.flatMap((event) => {
      if (event.type !== 'ClubQualified') return [];
      const definition = definitionById.get(event.toCompetitionId);
      return [
        {
          clubId: event.clubId,
          clubName: nameOf(plan.clubNames, event.clubId),
          competitionId: event.toCompetitionId,
          competitionName: definition?.name ?? event.toCompetitionId,
          route: `Vaga via ${definitionById.get(event.fromCompetitionId)?.name ?? event.fromCompetitionId}`,
        },
      ];
    });
    const awards = plan.outcomes.flatMap((outcome) => {
      const definition = definitionById.get(outcome.competitionId);
      if (definition === undefined)
        throw new PhaseFiveConflictError(
          `missing definition for ${outcome.competitionId}`,
        );
      const projected = new Map<
        string,
        { clubId: string; prize: number; prestige: number }
      >();
      for (const event of generateCompetitionAwards(definition, outcome)) {
        if (event.type !== 'PrizeAwarded' && event.type !== 'PrestigeAwarded')
          continue;
        const key = `${event.competitionId}:${event.clubId}`;
        const existing = projected.get(key) ?? {
          clubId: event.clubId,
          prize: 0,
          prestige: 0,
        };
        projected.set(key, {
          ...existing,
          prize:
            existing.prize + (event.type === 'PrizeAwarded' ? event.amount : 0),
          prestige:
            existing.prestige +
            (event.type === 'PrestigeAwarded' ? event.points : 0),
        });
      }
      return [...projected.values()].map((award) => ({
        id: `award_${outcome.competitionId}_${String(outcome.edition)}_${award.clubId}`,
        competitionId: outcome.competitionId,
        clubId: award.clubId,
        label: `Campeao de ${definition.name}`,
        prize: award.prize,
        prestige: award.prestige,
      }));
    });
    return {
      ...current,
      version: aggregateVersion,
      pyramid: {
        ...current.pyramid,
        season: current.nextSeason.nextSeason,
        aggregateVersion,
        projectedAt,
      },
      calendar: {
        ...current.calendar,
        season: current.nextSeason.nextSeason,
        status: 'draft',
        entries: [],
        aggregateVersion,
        projectedAt,
        validation: {
          valid: false,
          checkedAt: projectedAt,
          conflictCount: 0,
        },
      },
      nextSeason: {
        ...current.nextSeason,
        status: 'generated',
        aggregateVersion,
        projectedAt,
        movements,
        qualifiers,
        awards,
      },
    };
  }
}
