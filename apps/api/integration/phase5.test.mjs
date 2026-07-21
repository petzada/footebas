import {
  createPhaseFiveFixtureState,
  FakeBearerAuth,
  InMemoryPhaseFiveCompetitionAdapter,
  PhaseFiveCompetitionService,
} from '@footebas/application';
import {
  competitionCalendarReadModelSchema,
  competitionPyramidReadModelSchema,
  nextSeasonTransitionReadModelSchema,
  phaseFiveReceiptSchema,
} from '@footebas/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApi } from '../src/index.js';

const openApis = [];
afterEach(async () =>
  Promise.all(openApis.splice(0).map((api) => api.close())),
);

async function setup() {
  const auth = new FakeBearerAuth();
  const token = auth.issue({
    userId: 'user_phase5',
    email: 'phase5@example.com',
    displayName: 'Phase 5',
  });
  const intruder = auth.issue({
    userId: 'intruder',
    email: 'intruder@example.com',
    displayName: 'Intruder',
  });
  const application = new PhaseFiveCompetitionService(
    new InMemoryPhaseFiveCompetitionAdapter([createPhaseFiveFixtureState()]),
    { now: () => new Date('2026-12-09T12:00:00.000Z') },
  );
  const api = await buildApi({
    application: {
      execute() {},
      home() {},
      squad() {},
      nextMatch() {},
      standings() {},
      postMatch() {},
    },
    jobs: { status: async () => undefined },
    phaseFive: { application, auth },
  });
  openApis.push(api);
  return { api, token, intruder };
}

const authorize = (token) => ({ authorization: `Bearer ${token}` });

describe('Phase 5 competition HTTP vertical', () => {
  it('serves versioned pyramid/calendar/transition projections and authoritative commands', async () => {
    const { api, token, intruder } = await setup();
    const competitions = await api.inject({
      method: 'GET',
      url: '/v1/phase-five/careers/career_phase5/competitions',
      headers: authorize(token),
    });
    expect(competitions.statusCode).toBe(200);
    expect(
      competitionPyramidReadModelSchema.parse(competitions.json()).divisions,
    ).toHaveLength(3);
    const calendar = competitionCalendarReadModelSchema.parse(
      (
        await api.inject({
          method: 'GET',
          url: '/v1/phase-five/careers/career_phase5/calendar',
          headers: authorize(token),
        })
      ).json(),
    );
    expect(calendar.validation).toEqual(
      expect.objectContaining({ valid: true, conflictCount: 0 }),
    );
    const transition = nextSeasonTransitionReadModelSchema.parse(
      (
        await api.inject({
          method: 'GET',
          url: '/v1/phase-five/careers/career_phase5/next-season',
          headers: authorize(token),
        })
      ).json(),
    );
    expect(transition.movements).toHaveLength(2);

    const command = {
      version: 1,
      careerId: 'career_phase5',
      commandId: 'command_publish_calendar',
      idempotencyKey: 'phase5:calendar:2026',
      expectedVersion: 0,
      type: 'PublishSeasonCalendar',
      payload: { season: 2026 },
    };
    const post = (payload, bearer = token) =>
      api.inject({
        method: 'POST',
        url: '/v1/phase-five/commands',
        headers: authorize(bearer),
        payload,
      });
    const first = phaseFiveReceiptSchema.parse((await post(command)).json());
    expect(first.aggregateVersion).toBe(1);
    expect((await post(command)).json()).toEqual(first);
    expect((await post({ ...command, expectedVersion: 99 })).statusCode).toBe(
      409,
    );
    expect((await post(command, intruder)).statusCode).toBe(403);
  });
});
