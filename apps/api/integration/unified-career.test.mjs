import {
  FakeBearerAuth,
  FakeClock,
  FootebasApplication,
  InMemoryJobQueue,
  InMemoryStorage,
  NoopTelemetry,
  SequentialIdGenerator,
} from '@footebas/application';
import {
  careerWorldReadModelSchema,
  competitionCalendarReadModelSchema,
  competitionPyramidReadModelSchema,
  nextSeasonTransitionReadModelSchema,
  postMatchReadModelSchema,
} from '@footebas/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { InMemoryUnitOfWork } from '../../../packages/database/src/index.js';
import { buildApi } from '../src/index.js';

const openApis = [];
afterEach(async () => {
  await Promise.all(openApis.splice(0).map((api) => api.close()));
});

async function setup() {
  const clock = new FakeClock();
  const auth = new FakeBearerAuth();
  const jobs = new InMemoryJobQueue();
  const application = new FootebasApplication({
    auth,
    clock,
    ids: new SequentialIdGenerator(),
    jobs,
    storage: new InMemoryStorage(),
    telemetry: new NoopTelemetry(),
    unitOfWork: new InMemoryUnitOfWork(clock),
  });
  const token = auth.issue({
    userId: 'user_owner',
    email: 'owner@example.com',
    displayName: 'Owner',
  });
  const api = await buildApi({ application, jobs, now: () => clock.now() });
  openApis.push(api);
  const headers = { authorization: `Bearer ${token}` };
  const send = (method, url, payload) =>
    api.inject({ method, url, headers, ...(payload ? { payload } : {}) });
  return { application, send };
}

const command = (type, commandId, expectedVersion, payload) => ({
  version: 1,
  type,
  commandId,
  idempotencyKey: `unified:${commandId}`,
  expectedVersion,
  payload,
});

describe('carreira única pela API HTTP', () => {
  it('expõe mundo, pirâmide, calendário, transição e prévia sobre o mesmo save', async () => {
    const { application, send } = await setup();
    const created = (
      await send(
        'POST',
        '/v1/commands',
        command('CreateCareer', 'command_create', 0, {
          managerName: 'Ada',
          startDate: '2026-01-01',
        }),
      )
    ).json();
    const careerId = created.careerId;
    await send(
      'POST',
      '/v1/commands',
      command('SelectClub', 'command_club', 1, {
        careerId,
        clubId: 'club_flamengo',
      }),
    );
    const world = await send('GET', `/v1/careers/${careerId}/world`);
    expect(world.statusCode).toBe(200);
    expect(careerWorldReadModelSchema.parse(world.json()).manager.clubId).toBe(
      'club_flamengo',
    );
    const pyramid = competitionPyramidReadModelSchema.parse(
      (await send('GET', `/v1/careers/${careerId}/competitions`)).json(),
    );
    expect(pyramid.divisions.map(({ name }) => name)).toEqual([
      'Brasileirão Série A',
      'Brasileirão Série B',
      'Brasileirão Série C',
    ]);
    expect(pyramid.cups.length).toBeGreaterThanOrEqual(7);
    const calendar = competitionCalendarReadModelSchema.parse(
      (await send('GET', `/v1/careers/${careerId}/calendar`)).json(),
    );
    expect(calendar.entries.length).toBeGreaterThan(38);
    expect(
      calendar.entries.every(
        ({ homeClubId, awayClubId }) =>
          homeClubId === 'club_flamengo' || awayClubId === 'club_flamengo',
      ),
    ).toBe(true);
    expect(
      nextSeasonTransitionReadModelSchema.parse(
        (await send('GET', `/v1/careers/${careerId}/next-season`)).json(),
      ).status,
    ).toBe('pending');
    const preview = await send(
      'POST',
      `/v1/careers/${careerId}/match-preview`,
      { instructions: [] },
    );
    expect(preview.statusCode).toBe(200);
    expect(postMatchReadModelSchema.parse(preview.json()).tableUpdated).toBe(
      false,
    );
    const next = (
      await send('GET', `/v1/careers/${careerId}/next-match`)
    ).json();
    await send(
      'POST',
      '/v1/commands',
      command('SimulateMatch', 'command_match', 2, {
        careerId,
        fixtureId: next.fixtureId,
      }),
    );
    await application.runNextJob();
    const post = (
      await send('GET', `/v1/careers/${careerId}/post-match`)
    ).json();
    expect(post.score).toEqual(preview.json().score);
  });
});
