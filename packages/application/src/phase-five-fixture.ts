/* eslint-disable @typescript-eslint/no-non-null-assertion -- fixed synthetic engine-plan cardinalities */
import type { PhaseFiveCompetitionState } from './phase-five.js';
import {
  entityId,
  type ClubId,
  type CompetitionOutcome,
} from '@footebas/domain';
import { createMvpCompetitionSystem } from '@footebas/engine';

const projectedAt = '2026-12-08T12:00:00.000Z';

const clubs = (prefix: string, count: number): ClubId[] =>
  Array.from({ length: count }, (_, index) =>
    entityId(`${prefix}_${String(index + 1)}`, 'club'),
  );

function engineSeasonPlan() {
  const system = createMvpCompetitionSystem(2026, []);
  const a = clubs('serie_a_club', 20);
  const b = clubs('serie_b_club', 20);
  const c = clubs('serie_c_club', 20);
  const continental = clubs('continental_club', 32);
  const ordered = (
    competitionId: string,
    stageId: string,
    clubIds: readonly ClubId[],
  ): CompetitionOutcome => ({
    competitionId: entityId(competitionId, 'competition'),
    edition: 2026,
    stages: [{ stageId, orderedClubIds: clubIds }],
    championId: clubIds[0]!,
    runnerUpId: clubIds[1]!,
  });
  const outcomes = [
    ordered('serie_a', 'league', a),
    ordered('serie_b', 'league', b),
    ordered('serie_c', 'league', c),
    ordered('copa_brasil', 'knockout', [a[2]!, b[0]!]),
    {
      competitionId: entityId('continental', 'competition'),
      edition: 2026,
      stages: [
        { stageId: 'groups', orderedClubIds: continental },
        { stageId: 'knockout', orderedClubIds: continental.slice(0, 16) },
      ],
      championId: continental[0]!,
      runnerUpId: continental[1]!,
    },
  ];
  return Object.freeze({
    definitions: system.definitions,
    outcomes: Object.freeze(outcomes),
    allocations: system.nextSeasonAllocations,
    clubNames: Object.freeze(
      Object.fromEntries(
        [...a, ...b, ...c, ...continental].map((clubId) => [
          clubId,
          clubId.replaceAll('_', ' '),
        ]),
      ),
    ),
  });
}

export function createPhaseFiveFixtureState(
  ownerId = 'user_phase5',
  careerId = 'career_phase5',
): PhaseFiveCompetitionState {
  const divisions = [
    ['serie_a', 'Série A', 1, 20, 48_000_000, 1200],
    ['serie_b', 'Série B', 2, 20, 18_000_000, 700],
    ['serie_c', 'Série C', 3, 20, 8_000_000, 420],
  ].map(([id, name, tier, participantCount, prize, prestige]) => ({
    id: String(id),
    name: String(name),
    category: 'national_league' as const,
    tier: Number(tier),
    formatLabel: 'Pontos corridos · turno e returno',
    currentPhase: 'Temporada encerrada',
    status: 'complete' as const,
    participantCount: Number(participantCount),
    phases: [
      {
        id: `${String(id)}_league`,
        name: 'Liga nacional',
        kind: 'league' as const,
        status: 'complete' as const,
        startsOn: '2026-04-11',
        endsOn: '2026-12-06',
        participantCount: Number(participantCount),
      },
    ],
    qualifications:
      id === 'serie_a'
        ? [
            {
              label: 'Libertadores',
              places: 6,
              destinationCompetitionId: 'libertadores',
            },
            {
              label: 'Rebaixamento',
              places: 4,
              destinationDivisionId: 'serie_b',
            },
          ]
        : [
            {
              label: 'Acesso',
              places: 4,
              destinationDivisionId: id === 'serie_b' ? 'serie_a' : 'serie_b',
            },
            ...(id === 'serie_b'
              ? [
                  {
                    label: 'Rebaixamento',
                    places: 4,
                    destinationDivisionId: 'serie_c',
                  },
                ]
              : []),
          ],
    prize: Number(prize),
    prestige: Number(prestige),
  }));

  const cups = [
    {
      id: 'copa_brasil',
      name: 'Copa do Brasil',
      category: 'national_cup' as const,
      formatLabel: 'Mata-mata · ida e volta',
      currentPhase: 'Final',
      status: 'complete' as const,
      participantCount: 64,
      phases: [
        {
          id: 'copa_brasil_knockout',
          name: 'Mata-mata',
          kind: 'knockout' as const,
          status: 'complete' as const,
          startsOn: '2026-02-18',
          endsOn: '2026-11-15',
          participantCount: 64,
        },
      ],
      qualifications: [
        {
          label: 'Libertadores',
          places: 1,
          destinationCompetitionId: 'libertadores',
        },
      ],
      prize: 32_000_000,
      prestige: 900,
    },
    {
      id: 'paulistao',
      name: 'Paulistão',
      category: 'state' as const,
      formatLabel: 'Turno único · São Paulo',
      currentPhase: 'Classificação final',
      status: 'complete' as const,
      participantCount: 16,
      phases: [
        {
          id: 'paulistao_single_round',
          name: 'Turno único',
          kind: 'single_round_robin' as const,
          status: 'complete' as const,
          startsOn: '2026-01-11',
          endsOn: '2026-03-22',
          participantCount: 16,
        },
      ],
      qualifications: [],
      prize: 5_000_000,
      prestige: 240,
    },
    {
      id: 'libertadores',
      name: 'Libertadores',
      category: 'continental' as const,
      formatLabel: 'Pré · grupos · mata-mata',
      currentPhase: 'Final',
      status: 'complete' as const,
      participantCount: 47,
      phases: [
        {
          id: 'libertadores_qualifying',
          name: 'Pré-Libertadores',
          kind: 'qualifying' as const,
          status: 'complete' as const,
          startsOn: '2026-02-03',
          endsOn: '2026-03-12',
          participantCount: 19,
        },
        {
          id: 'libertadores_groups',
          name: 'Fase de grupos',
          kind: 'groups' as const,
          status: 'complete' as const,
          startsOn: '2026-04-07',
          endsOn: '2026-05-28',
          participantCount: 32,
        },
        {
          id: 'libertadores_knockout',
          name: 'Mata-mata',
          kind: 'knockout' as const,
          status: 'complete' as const,
          startsOn: '2026-08-11',
          endsOn: '2026-11-28',
          participantCount: 16,
        },
      ],
      qualifications: [],
      prize: 128_000_000,
      prestige: 1800,
    },
  ];

  return {
    careerId,
    ownerId,
    version: 0,
    pyramid: {
      version: 1,
      careerId,
      aggregateVersion: 0,
      projectedAt,
      season: 2026,
      divisions,
      cups,
    },
    calendar: {
      version: 1,
      careerId,
      aggregateVersion: 0,
      projectedAt,
      season: 2026,
      status: 'validated',
      validation: { valid: true, checkedAt: projectedAt, conflictCount: 0 },
      entries: [
        {
          id: 'calendar_state_final',
          competitionId: 'paulistao',
          competitionName: 'Paulistão',
          phaseName: 'Turno único',
          date: '2026-03-22',
          label: 'Rodada final estadual',
          status: 'played',
        },
        {
          id: 'calendar_cup_final',
          competitionId: 'copa_brasil',
          competitionName: 'Copa do Brasil',
          phaseName: 'Final',
          date: '2026-11-15',
          label: 'Final · jogo de volta',
          status: 'played',
          homeClubId: 'flamengo',
          awayClubId: 'palmeiras',
        },
        {
          id: 'calendar_continental_final',
          competitionId: 'libertadores',
          competitionName: 'Libertadores',
          phaseName: 'Final',
          date: '2026-11-28',
          label: 'Final continental',
          status: 'played',
        },
        {
          id: 'calendar_league_final',
          competitionId: 'serie_a',
          competitionName: 'Série A',
          phaseName: 'Liga nacional',
          date: '2026-12-06',
          label: '38ª rodada',
          status: 'played',
        },
      ],
    },
    nextSeason: {
      version: 1,
      careerId,
      aggregateVersion: 0,
      projectedAt,
      completedSeason: 2026,
      nextSeason: 2027,
      status: 'ready',
      movements: [
        {
          clubId: 'sport',
          clubName: 'Sport',
          fromDivisionId: 'serie_b',
          toDivisionId: 'serie_a',
          kind: 'promoted',
        },
        {
          clubId: 'vitoria',
          clubName: 'Vitória',
          fromDivisionId: 'serie_a',
          toDivisionId: 'serie_b',
          kind: 'relegated',
        },
      ],
      qualifiers: [
        {
          clubId: 'flamengo',
          clubName: 'Flamengo',
          competitionId: 'libertadores',
          competitionName: 'Libertadores',
          route: 'Campeão da Copa do Brasil',
        },
      ],
      awards: [
        {
          id: 'award_serie_a_2026',
          competitionId: 'serie_a',
          clubId: 'palmeiras',
          label: 'Campeão da Série A',
          prize: 48_000_000,
          prestige: 1200,
        },
        {
          id: 'award_copa_2026',
          competitionId: 'copa_brasil',
          clubId: 'flamengo',
          label: 'Campeão da Copa do Brasil',
          prize: 32_000_000,
          prestige: 900,
        },
      ],
    },
    seasonPlan: engineSeasonPlan(),
  };
}
