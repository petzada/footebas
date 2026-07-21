import { describe, expect, it } from 'vitest';
import {
  competitionCalendarReadModelSchema,
  competitionPyramidReadModelSchema,
  generateNextSeasonCommandSchema,
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
  });
});
