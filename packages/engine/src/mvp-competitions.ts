import {
  createCompetitionDefinition,
  entityId,
  type CompetitionDefinition,
  type CompetitionId,
  type RankingRule,
  type SeasonAllocationRule,
  type TieBreakerRule,
} from '@footebas/domain';

export interface MvpCompetitionSystem {
  readonly definitions: readonly CompetitionDefinition[];
  readonly nextSeasonAllocations: readonly SeasonAllocationRule[];
}

export const BRAZILIAN_RANKING_RULE: RankingRule = Object.freeze({
  pointsForWin: 3,
  pointsForDraw: 1,
  pointsForLoss: 0,
  tieBreakers: Object.freeze<TieBreakerRule[]>([
    'points',
    'wins',
    'goal_difference',
    'goals_for',
    'head_to_head',
    'deterministic_draw',
  ]),
});

const id = (value: string): CompetitionId => entityId(value, 'competition');
const positions = (from: number, to: number): readonly number[] =>
  Object.freeze(
    Array.from({ length: to - from + 1 }, (_, index) => from + index),
  );

function nationalLeague(
  competitionId: CompetitionId,
  name: string,
  year: number,
  prize: number,
  prestige: number,
): CompetitionDefinition {
  return createCompetitionDefinition({
    id: competitionId,
    name,
    tier: 'national_league',
    stages: [
      {
        id: 'league',
        name: 'Pontos corridos',
        type: 'league',
        participantSource: { type: 'seeded' },
        schedule: { firstDate: `${String(year)}-04-05`, intervalDays: 7 },
        roundRobin: 'double',
        ranking: BRAZILIAN_RANKING_RULE,
      },
    ],
    awards: [
      {
        stageId: 'league',
        positions: [1],
        prize,
        prestige,
        achievement: 'league_title',
      },
    ],
  });
}

function stateLeague(stateId: string, year: number): CompetitionDefinition {
  if (!/^[a-z][a-z0-9]*$/.test(stateId))
    throw new Error(`State ID must be canonical: ${stateId}`);
  return createCompetitionDefinition({
    id: id(`state_${stateId}`),
    name: `Estadual ${stateId.toUpperCase()}`,
    tier: 'state',
    stages: [
      {
        id: 'league',
        name: 'Turno único',
        type: 'league',
        participantSource: { type: 'seeded' },
        schedule: { firstDate: `${String(year)}-01-10`, intervalDays: 7 },
        roundRobin: 'single',
        ranking: BRAZILIAN_RANKING_RULE,
      },
    ],
    awards: [
      {
        stageId: 'league',
        positions: [1],
        prize: 2_000_000_00,
        prestige: 20,
        achievement: 'state_title',
      },
    ],
  });
}

export function createMvpCompetitionSystem(
  year: number,
  stateIds: readonly string[],
): MvpCompetitionSystem {
  if (!Number.isSafeInteger(year) || year < 2000 || year > 9999)
    throw new Error('Competition year must be from 2000 to 9999');
  if (new Set(stateIds).size !== stateIds.length)
    throw new Error('State IDs must be unique');

  const serieA = id('serie_a');
  const serieB = id('serie_b');
  const serieC = id('serie_c');
  const cup = id('copa_brasil');
  const continental = id('continental');
  const definitions: CompetitionDefinition[] = [
    nationalLeague(serieA, 'Série A', year, 50_000_000_00, 100),
    nationalLeague(serieB, 'Série B', year, 20_000_000_00, 60),
    nationalLeague(serieC, 'Série C', year, 8_000_000_00, 40),
    createCompetitionDefinition({
      id: cup,
      name: 'Copa do Brasil',
      tier: 'national_cup',
      stages: [
        {
          id: 'knockout',
          name: 'Mata-mata',
          type: 'knockout',
          participantSource: { type: 'seeded' },
          schedule: { firstDate: `${String(year)}-03-11`, intervalDays: 14 },
          legs: 2,
          finalLegs: 2,
        },
      ],
      awards: [
        {
          stageId: 'knockout',
          positions: [1],
          prize: 70_000_000_00,
          prestige: 70,
          achievement: 'cup_title',
        },
      ],
    }),
    ...stateIds.map((stateId) => stateLeague(stateId, year)),
    createCompetitionDefinition({
      id: continental,
      name: 'Continental',
      tier: 'continental',
      stages: [
        {
          id: 'preliminary',
          name: 'Pré-continental',
          type: 'knockout',
          participantSource: { type: 'seeded' },
          schedule: { firstDate: `${String(year)}-01-28`, intervalDays: 7 },
          legs: 2,
        },
        {
          id: 'groups',
          name: 'Fase de grupos',
          type: 'groups',
          participantSource: {
            type: 'seeded_and_qualified',
            fromStageId: 'preliminary',
            positions: [1, 2, 3, 4],
          },
          schedule: { firstDate: `${String(year)}-03-04`, intervalDays: 14 },
          groupCount: 8,
          roundRobin: 'double',
          ranking: BRAZILIAN_RANKING_RULE,
          advancePerGroup: 2,
        },
        {
          id: 'knockout',
          name: 'Mata-mata continental',
          type: 'knockout',
          participantSource: {
            type: 'qualified',
            fromStageId: 'groups',
            positions: positions(1, 16),
          },
          schedule: { firstDate: `${String(year)}-08-05`, intervalDays: 7 },
          legs: 2,
          finalLegs: 1,
        },
      ],
      awards: [
        {
          stageId: 'knockout',
          positions: [1],
          prize: 120_000_000_00,
          prestige: 180,
          achievement: 'continental_title',
        },
      ],
    }),
  ];

  const nextSeasonAllocations: SeasonAllocationRule[] = [
    {
      targetCompetitionId: serieA,
      targetSize: 20,
      selections: [
        {
          sourceCompetitionId: serieA,
          sourceStageId: 'league',
          positions: positions(1, 16),
        },
        {
          sourceCompetitionId: serieB,
          sourceStageId: 'league',
          positions: positions(1, 4),
          event: 'promoted',
        },
      ],
    },
    {
      targetCompetitionId: serieB,
      targetSize: 20,
      selections: [
        {
          sourceCompetitionId: serieB,
          sourceStageId: 'league',
          positions: positions(5, 16),
        },
        {
          sourceCompetitionId: serieA,
          sourceStageId: 'league',
          positions: positions(17, 20),
          event: 'relegated',
        },
        {
          sourceCompetitionId: serieC,
          sourceStageId: 'league',
          positions: positions(1, 4),
          event: 'promoted',
        },
      ],
    },
    {
      targetCompetitionId: serieC,
      targetSize: 20,
      selections: [
        {
          sourceCompetitionId: serieC,
          sourceStageId: 'league',
          positions: positions(5, 20),
        },
        {
          sourceCompetitionId: serieB,
          sourceStageId: 'league',
          positions: positions(17, 20),
          event: 'relegated',
        },
      ],
    },
    {
      targetCompetitionId: continental,
      targetSize: 32,
      selections: [
        {
          sourceCompetitionId: cup,
          sourceStageId: 'knockout',
          positions: [1],
          count: 1,
          event: 'qualified',
        },
        {
          sourceCompetitionId: serieA,
          sourceStageId: 'league',
          positions: positions(1, 20),
          count: 6,
          event: 'qualified',
        },
        {
          sourceCompetitionId: continental,
          sourceStageId: 'groups',
          positions: positions(1, 32),
          count: 25,
        },
      ],
    },
  ];

  return Object.freeze({
    definitions: Object.freeze(definitions),
    nextSeasonAllocations: Object.freeze(nextSeasonAllocations),
  });
}
