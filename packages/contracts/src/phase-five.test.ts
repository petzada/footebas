import { describe, expect, it } from 'vitest';
import {
  competitionCalendarReadModelSchema,
  competitionPyramidReadModelSchema,
  generateNextSeasonCommandSchema,
  nextSeasonTransitionReadModelSchema,
  phaseFiveCommandSchema,
} from './phase-five.js';

describe('phase five transport contracts', () => {
  it('keeps commands strict and versioned', () => {
    const command = {
      version: 1,
      careerId: 'career_phase5',
      commandId: 'command_next_season',
      idempotencyKey: 'phase5:next:2027',
      expectedVersion: 3,
      type: 'GenerateNextSeason',
      payload: { completedSeason: 2026 },
    };
    expect(generateNextSeasonCommandSchema.parse(command)).toEqual(command);
    expect(
      phaseFiveCommandSchema.safeParse({ ...command, ownerId: 'forged_owner' })
        .success,
    ).toBe(false);
    expect(
      phaseFiveCommandSchema.safeParse({ ...command, version: 2 }).success,
    ).toBe(false);
  });

  it('requires exactly three divisions and a prevalidated calendar projection', () => {
    const base = {
      version: 1,
      careerId: 'career_phase5',
      aggregateVersion: 0,
      projectedAt: '2026-12-08T12:00:00.000Z',
      season: 2026,
    };
    expect(
      competitionPyramidReadModelSchema.safeParse({
        ...base,
        divisions: [],
        cups: [],
      }).success,
    ).toBe(false);
    expect(
      competitionCalendarReadModelSchema.safeParse({
        ...base,
        status: 'validated',
        validation: {
          valid: true,
          checkedAt: base.projectedAt,
          conflictCount: 0,
        },
        entries: [],
      }).success,
    ).toBe(true);
    expect(
      competitionCalendarReadModelSchema.safeParse({
        ...base,
        status: 'published',
        validation: {
          valid: false,
          checkedAt: base.projectedAt,
          conflictCount: 1,
        },
        entries: [],
      }).success,
    ).toBe(false);
  });

  it('owns cross-field transition and qualification invariants in the contract', () => {
    const transition = {
      version: 1,
      careerId: 'career_phase5',
      aggregateVersion: 1,
      projectedAt: '2026-12-08T12:00:00.000Z',
      completedSeason: 2026,
      nextSeason: 2028,
      status: 'ready',
      movements: [],
      qualifiers: [],
      awards: [],
    };
    expect(
      nextSeasonTransitionReadModelSchema.safeParse(transition).success,
    ).toBe(false);
    const pyramid = {
      version: 1,
      careerId: 'career_phase5',
      aggregateVersion: 0,
      projectedAt: '2026-12-08T12:00:00.000Z',
      season: 2026,
      divisions: Array.from({ length: 3 }, (_, index) => ({
        id: `division_${String(index + 1)}`,
        name: `Division ${String(index + 1)}`,
        category: 'national_league',
        tier: index + 1,
        formatLabel: 'League',
        currentPhase: 'Complete',
        status: 'complete',
        participantCount: 20,
        phases: [
          {
            id: `phase_${String(index + 1)}`,
            name: 'League',
            kind: 'league',
            status: 'complete',
            startsOn: '2026-12-01',
            endsOn: '2026-01-01',
            participantCount: 20,
          },
        ],
        qualifications: [
          {
            label: 'Invalid dual destination',
            places: 1,
            destinationCompetitionId: 'cup',
            destinationDivisionId: 'division_1',
          },
        ],
        prize: 0,
        prestige: 0,
      })),
      cups: [],
    };
    expect(competitionPyramidReadModelSchema.safeParse(pyramid).success).toBe(
      false,
    );
  });
});
