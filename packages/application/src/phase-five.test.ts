import { describe, expect, it } from 'vitest';
import {
  createPhaseFiveFixtureState,
  EnginePhaseFiveSeasonGenerationAdapter,
  InMemoryPhaseFiveCompetitionAdapter,
  PhaseFiveAuthorizationError,
  PhaseFiveCompetitionService,
  PhaseFiveConflictError,
} from './index.js';

const calendarCommand = {
  version: 1 as const,
  careerId: 'career_phase5',
  commandId: 'command_publish_calendar',
  idempotencyKey: 'phase5:calendar:2026',
  expectedVersion: 0,
  type: 'PublishSeasonCalendar' as const,
  payload: { season: 2026 },
};

describe('phase five authoritative competition service', () => {
  it('publishes a valid calendar once and returns the exact receipt on retry', async () => {
    const port = new InMemoryPhaseFiveCompetitionAdapter([
      createPhaseFiveFixtureState(),
    ]);
    const service = new PhaseFiveCompetitionService(port, {
      now: () => new Date('2026-12-09T10:00:00.000Z'),
    });
    const first = await service.execute('user_phase5', calendarCommand);
    const retry = await service.execute('user_phase5', calendarCommand);
    expect(retry).toEqual(first);
    expect(first.aggregateVersion).toBe(1);
    expect(
      (await service.calendar('user_phase5', 'career_phase5')).status,
    ).toBe('published');
  });

  it('rejects foreign owners, stale versions and identity reuse', async () => {
    const port = new InMemoryPhaseFiveCompetitionAdapter([
      createPhaseFiveFixtureState(),
    ]);
    const service = new PhaseFiveCompetitionService(port);
    await expect(
      service.pyramid('intruder', 'career_phase5'),
    ).rejects.toBeInstanceOf(PhaseFiveAuthorizationError);
    await expect(
      service.execute('user_phase5', {
        ...calendarCommand,
        expectedVersion: 9,
      }),
    ).rejects.toBeInstanceOf(PhaseFiveConflictError);
    await service.execute('user_phase5', calendarCommand);
    await expect(
      service.execute('user_phase5', {
        ...calendarCommand,
        payload: { season: 2025 },
      }),
    ).rejects.toBeInstanceOf(PhaseFiveConflictError);
    await expect(
      service.execute('user_phase5', {
        ...calendarCommand,
        commandId: 'command_reused_with_new_key',
      }),
    ).rejects.toBeInstanceOf(PhaseFiveConflictError);
    await expect(
      service.execute('user_phase5', {
        ...calendarCommand,
        idempotencyKey: 'phase5:calendar:new-key',
      }),
    ).rejects.toBeInstanceOf(PhaseFiveConflictError);
    await expect(
      service.execute('user_phase5', {
        ...calendarCommand,
        version: 2 as 1,
      }),
    ).rejects.toThrow();
  });

  it('projects promotion, relegation, qualification and awards into the next season', async () => {
    const port = new InMemoryPhaseFiveCompetitionAdapter([
      createPhaseFiveFixtureState(),
    ]);
    const service = new PhaseFiveCompetitionService(
      port,
      {
        now: () => new Date('2026-12-10T10:00:00.000Z'),
      },
      new EnginePhaseFiveSeasonGenerationAdapter(),
    );
    const receipt = await service.execute('user_phase5', {
      version: 1,
      careerId: 'career_phase5',
      commandId: 'command_generate_2027',
      idempotencyKey: 'phase5:generate:2027',
      expectedVersion: 0,
      type: 'GenerateNextSeason',
      payload: { completedSeason: 2026 },
    });
    expect(receipt.aggregateVersion).toBe(1);
    const transition = await service.transition('user_phase5', 'career_phase5');
    expect(transition.status).toBe('generated');
    expect(
      transition.movements.filter(({ kind }) => kind === 'promoted'),
    ).toHaveLength(8);
    expect(
      transition.movements.filter(({ kind }) => kind === 'relegated'),
    ).toHaveLength(8);
    expect(transition.qualifiers).toHaveLength(7);
    expect(transition.qualifiers[0]?.route).toContain('Copa do Brasil');
    expect(
      transition.awards.reduce((sum, award) => sum + award.prestige, 0),
    ).toBe(450);
    expect((await service.pyramid('user_phase5', 'career_phase5')).season).toBe(
      2027,
    );
    expect(
      (await service.calendar('user_phase5', 'career_phase5')).status,
    ).toBe('draft');
  });
});
