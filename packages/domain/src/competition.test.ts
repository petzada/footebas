import { describe, expect, it } from 'vitest';
import { createCompetitionDefinition } from './competition.js';
import { entityId } from './id.js';

const ranking = {
  pointsForWin: 3,
  pointsForDraw: 1,
  pointsForLoss: 0,
  tieBreakers: ['points', 'deterministic_draw'] as const,
};

describe('competition definition', () => {
  it('freezes a valid declarative stage chain', () => {
    const definition = createCompetitionDefinition({
      id: entityId('test_competition', 'competition'),
      name: 'Test competition',
      tier: 'continental',
      stages: [
        {
          id: 'groups',
          name: 'Groups',
          type: 'groups',
          participantSource: { type: 'seeded' },
          schedule: { firstDate: '2026-02-01', intervalDays: 7 },
          groupCount: 2,
          advancePerGroup: 2,
          roundRobin: 'double',
          ranking,
        },
        {
          id: 'finals',
          name: 'Finals',
          type: 'knockout',
          participantSource: {
            type: 'qualified',
            fromStageId: 'groups',
            positions: [1, 2, 3, 4],
          },
          schedule: { firstDate: '2026-05-01', intervalDays: 7 },
          legs: 2,
          finalLegs: 1,
        },
      ],
      awards: [
        {
          stageId: 'finals',
          positions: [1],
          prize: 1_000,
          prestige: 50,
          achievement: 'continental_title',
        },
      ],
    });
    expect(Object.isFrozen(definition)).toBe(true);
    expect(Object.isFrozen(definition.stages)).toBe(true);
    expect(definition.stages.map(({ type }) => type)).toEqual([
      'groups',
      'knockout',
    ]);
  });

  it('rejects forward stage references, duplicate tiebreakers, and invalid awards', () => {
    expect(() =>
      createCompetitionDefinition({
        id: entityId('invalid_competition', 'competition'),
        name: 'Invalid',
        tier: 'national_league',
        stages: [
          {
            id: 'league',
            name: 'League',
            type: 'league',
            participantSource: {
              type: 'qualified',
              fromStageId: 'future',
              positions: [1],
            },
            schedule: { firstDate: '2026-01-01', intervalDays: 7 },
            roundRobin: 'single',
            ranking,
          },
        ],
        awards: [],
      }),
    ).toThrow(/earlier stage/);

    expect(() =>
      createCompetitionDefinition({
        id: entityId('invalid_award', 'competition'),
        name: 'Invalid award',
        tier: 'national_cup',
        stages: [
          {
            id: 'cup',
            name: 'Cup',
            type: 'knockout',
            participantSource: { type: 'seeded' },
            schedule: { firstDate: '2026-01-01', intervalDays: 7 },
            legs: 1,
          },
        ],
        awards: [
          {
            stageId: 'missing',
            positions: [1],
            prize: 0,
            prestige: 0,
            achievement: 'cup_title',
          },
        ],
      }),
    ).toThrow(/unknown stage/);
  });
});
