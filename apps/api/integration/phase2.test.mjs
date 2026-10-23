import {
  FakeBearerAuth,
  FakeClock,
  FootebasApplication,
  InMemoryStorage,
  NoopTelemetry,
  SequentialIdGenerator,
} from '@footebas/application';
import { afterEach, describe, expect, it } from 'vitest';
import { InMemoryUnitOfWork } from '../../../packages/database/src/index.js';
import {
  FakeScheduler,
  InMemoryWorkerJobQueue,
  WorkerRuntime,
} from '../../worker/src/index.js';
import { buildApi } from '../src/index.js';

const openApis = [];

afterEach(async () => {
  await Promise.all(openApis.splice(0).map((api) => api.close()));
});

async function setup(options = {}) {
  const clock = new FakeClock();
  const auth = new FakeBearerAuth();
  const jobs = new InMemoryWorkerJobQueue();
  const dependencies = {
    auth,
    clock,
    ids: new SequentialIdGenerator(),
    jobs,
    storage: new InMemoryStorage(),
    telemetry: new NoopTelemetry(),
    unitOfWork: new InMemoryUnitOfWork(clock),
    ...(options.failPoint ? { failPoint: options.failPoint } : {}),
  };
  const application = new FootebasApplication(dependencies);
  const scheduler = new FakeScheduler(clock);
  const runtime = new WorkerRuntime(
    application,
    jobs,
    clock,
    scheduler,
    options.runtime,
  );
  const token = auth.issue({
    userId: 'user_owner',
    email: 'owner@example.com',
    displayName: 'Owner',
  });
  const api = await buildApi({
    application,
    jobs,
    now: () => clock.now(),
  });
  openApis.push(api);
  return {
    api,
    application,
    dependencies,
    jobs,
    runtime,
    scheduler,
    token,
  };
}

function command(type, commandId, expectedVersion, payload) {
  return {
    version: 1,
    type,
    commandId,
    idempotencyKey: `phase2:${commandId}`,
    expectedVersion,
    payload,
  };
}

async function post(fixture, body) {
  return fixture.api.inject({
    method: 'POST',
    url: '/v1/commands',
    headers: { authorization: `Bearer ${fixture.token}` },
    payload: body,
  });
}

async function get(fixture, url) {
  return fixture.api.inject({
    method: 'GET',
    url,
    headers: { authorization: `Bearer ${fixture.token}` },
  });
}

async function createCareer(fixture, suffix = 'main') {
  const response = await post(
    fixture,
    command('CreateCareer', `command_create_${suffix}`, 0, {
      managerName: 'Ada',
      startDate: '2026-01-01',
    }),
  );
  expect(response.statusCode).toBe(202);
  return response.json();
}

async function selectClub(fixture, careerId, suffix = 'main') {
  const response = await post(
    fixture,
    command('SelectClub', `command_select_${suffix}`, 1, {
      careerId,
      clubId: 'club_flamengo',
    }),
  );
  expect(response.statusCode).toBe(202);
  return response.json();
}

function sseData(response) {
  const line = response.body
    .split('\n')
    .find((candidate) => candidate.startsWith('data: '));
  expect(line).toBeDefined();
  return JSON.parse(line.slice(6));
}

describe('Phase 2 HTTP/application/worker integration', () => {
  it('plays the authoritative command flow, projects every read model, and reloads the checksum', async () => {
    const fixture = await setup();
    const created = await createCareer(fixture);
    const careerId = created.careerId;
    await selectClub(fixture, careerId);

    const squad = (await get(fixture, `/v1/careers/${careerId}/squad`)).json();
    expect(squad.club.name).toBe('Flamengo');
    expect(squad.players.map(({ name }) => name)).toEqual(
      expect.arrayContaining(['Agustín Rossi', 'Gonzalo Plata']),
    );
    expect(
      squad.players.every(({ name }) => !name.startsWith('Jogador ')),
    ).toBe(true);
    const goalkeeper = squad.players.find(({ position }) => position === 'GK');
    const formationPositions = [
      'GK',
      'RB',
      'CB',
      'CB',
      'LB',
      'CM',
      'CM',
      'RW',
      'LW',
      'ST',
      'ST',
    ];
    const starters = [
      goalkeeper,
      ...squad.players.filter(({ position }) => position !== 'GK').slice(0, 10),
    ].map(({ id: playerId }, index) => ({
      playerId,
      position: formationPositions[index],
    }));
    expect(
      (
        await post(
          fixture,
          command('SetLineup', 'command_lineup_main', 2, {
            careerId,
            clubId: 'club_flamengo',
            starters,
            substitutes: [],
            captainId: starters[1].playerId,
          }),
        )
      ).statusCode,
    ).toBe(202);
    expect(
      (
        await post(
          fixture,
          command('SetTactics', 'command_tactics_main', 3, {
            careerId,
            formation: '4-3-3',
            mentality: 'counter_attack',
            attackDirection: 'wings',
            marking: 'heavy',
          }),
        )
      ).statusCode,
    ).toBe(202);

    const next = (
      await get(fixture, `/v1/careers/${careerId}/next-match`)
    ).json();
    const accepted = (
      await post(
        fixture,
        command('AdvanceDate', 'command_advance_main', 4, {
          careerId,
          throughDate: next.date,
        }),
      )
    ).json();
    expect(accepted).toMatchObject({ aggregateVersion: 5 });
    expect(accepted.jobId).toBeDefined();

    expect(
      (await get(fixture, `/v1/jobs/${accepted.jobId}`)).json(),
    ).toMatchObject({ state: 'queued', attempt: 1 });
    expect(
      sseData(await get(fixture, `/v1/jobs/${accepted.jobId}/events`)),
    ).toMatchObject({ type: 'job.status', data: { state: 'queued' } });

    expect((await fixture.runtime.runOnce()).kind).toBe('succeeded');
    expect(
      (await get(fixture, `/v1/jobs/${accepted.jobId}`)).json(),
    ).toMatchObject({ state: 'succeeded', attempt: 1 });
    expect(
      sseData(await get(fixture, `/v1/jobs/${accepted.jobId}/events`)),
    ).toMatchObject({
      type: 'job.completed',
      data: { careerId, aggregateVersion: 6 },
    });

    const [home, reloadedSquad, reloadedNext, standings, postMatch] =
      await Promise.all(
        ['home', 'squad', 'next-match', 'standings', 'post-match'].map((read) =>
          get(fixture, `/v1/careers/${careerId}/${read}`),
        ),
      );
    for (const response of [
      home,
      reloadedSquad,
      reloadedNext,
      standings,
      postMatch,
    ])
      expect(response.statusCode).toBe(200);
    expect(home.json()).toMatchObject({
      aggregateVersion: 6,
      currentDate: next.date,
    });
    expect(postMatch.json()).toMatchObject({
      fixtureId: next.fixtureId,
      tableUpdated: true,
    });
    expect(standings.json().rows).toHaveLength(20);
    expect(
      reloadedSquad.json().players.some((player) => player.condition < 100),
    ).toBe(true);

    const checksum = await fixture.application.checksum(
      fixture.token,
      careerId,
    );
    const reloadedApplication = new FootebasApplication(fixture.dependencies);
    const reloadedApi = await buildApi({
      application: reloadedApplication,
      jobs: fixture.jobs,
      now: () => fixture.dependencies.clock.now(),
    });
    openApis.push(reloadedApi);
    const reloadResponse = await reloadedApi.inject({
      method: 'GET',
      url: `/v1/careers/${careerId}/home`,
      headers: { authorization: `Bearer ${fixture.token}` },
    });
    expect(reloadResponse.json()).toEqual(home.json());
    expect(await reloadedApplication.checksum(fixture.token, careerId)).toBe(
      checksum,
    );
  });

  it('deduplicates an HTTP retry and rejects distinct concurrent advances', async () => {
    const idempotent = await setup();
    const createCommand = command(
      'CreateCareer',
      'command_create_idempotent',
      0,
      { managerName: 'Ada', startDate: '2026-01-01' },
    );
    const [first, replay] = await Promise.all([
      post(idempotent, createCommand),
      post(idempotent, createCommand),
    ]);
    expect(first.statusCode).toBe(202);
    expect(replay.statusCode).toBe(202);
    expect(replay.json()).toEqual(first.json());
    const careerId = first.json().careerId;
    await selectClub(idempotent, careerId, 'idempotent');
    const advance = command('AdvanceDate', 'command_advance_idempotent', 2, {
      careerId,
    });
    const accepted = await post(idempotent, advance);
    const acceptedReplay = await post(idempotent, advance);
    expect(acceptedReplay.json()).toEqual(accepted.json());
    expect(
      (await idempotent.runtime.drain()).map((result) => result.kind),
    ).toEqual(['succeeded']);
    expect((await idempotent.runtime.runOnce()).kind).toBe('idle');

    const concurrent = await setup();
    const concurrentCareer = (await createCareer(concurrent, 'concurrent'))
      .careerId;
    await selectClub(concurrent, concurrentCareer, 'concurrent');
    const responses = await Promise.all([
      post(
        concurrent,
        command('AdvanceDate', 'command_advance_concurrent_a', 2, {
          careerId: concurrentCareer,
        }),
      ),
      post(
        concurrent,
        command('AdvanceDate', 'command_advance_concurrent_b', 2, {
          careerId: concurrentCareer,
        }),
      ),
    ]);
    expect(responses.map(({ statusCode }) => statusCode).sort()).toEqual([
      202, 409,
    ]);
    expect(
      (await concurrent.runtime.drain()).map((result) => result.kind),
    ).toEqual(['succeeded']);
    const table = (
      await get(concurrent, `/v1/careers/${concurrentCareer}/standings`)
    ).json();
    expect(table.rows).toHaveLength(20);
  });

  it('rolls back a failed attempt, retries the same queued job, and persists one result', async () => {
    let shouldFail = true;
    const fixture = await setup({
      failPoint() {
        if (shouldFail) {
          shouldFail = false;
          throw new Error('injected integration failure');
        }
      },
      runtime: { backoffMilliseconds: () => 250 },
    });
    const careerId = (await createCareer(fixture, 'retry')).careerId;
    await selectClub(fixture, careerId, 'retry');
    const next = (
      await get(fixture, `/v1/careers/${careerId}/next-match`)
    ).json();
    const accepted = (
      await post(
        fixture,
        command('SimulateMatch', 'command_simulate_retry', 2, {
          careerId,
          fixtureId: next.fixtureId,
        }),
      )
    ).json();

    expect((await fixture.runtime.runOnce()).kind).toBe('retry_scheduled');
    expect(fixture.scheduler.delays).toEqual([250]);
    expect(
      (await get(fixture, `/v1/careers/${careerId}/post-match`)).statusCode,
    ).toBe(404);
    expect(
      (await get(fixture, `/v1/jobs/${accepted.jobId}`)).json(),
    ).toMatchObject({
      state: 'failed',
      attempt: 1,
      errorCode: 'SIMULATION_FAILED',
    });
    expect(
      sseData(await get(fixture, `/v1/jobs/${accepted.jobId}/events`)),
    ).toMatchObject({ type: 'job.failed', data: { retryable: true } });

    expect((await fixture.runtime.runOnce()).kind).toBe('succeeded');
    const result = (
      await get(fixture, `/v1/careers/${careerId}/post-match`)
    ).json();
    expect(result.fixtureId).toBe(next.fixtureId);
    const table = (
      await get(fixture, `/v1/careers/${careerId}/standings`)
    ).json();
    expect(table.rows).toHaveLength(20);
    expect((await fixture.runtime.runOnce()).kind).toBe('idle');
  });

  it('dead-letters terminal failures and exposes them as non-retryable over SSE', async () => {
    const fixture = await setup({
      failPoint() {
        throw new Error('permanent integration failure');
      },
      runtime: { maxAttempts: 2, backoffMilliseconds: () => 10 },
    });
    const careerId = (await createCareer(fixture, 'terminal')).careerId;
    await selectClub(fixture, careerId, 'terminal');
    const accepted = (
      await post(
        fixture,
        command('AdvanceDate', 'command_advance_terminal', 2, { careerId }),
      )
    ).json();

    expect((await fixture.runtime.runOnce()).kind).toBe('retry_scheduled');
    expect((await fixture.runtime.runOnce()).kind).toBe('terminal');
    expect(fixture.jobs.deadLetters()).toHaveLength(1);
    expect(fixture.runtime.health()).toMatchObject({
      healthy: false,
      lastError: 'MAX_ATTEMPTS_EXCEEDED',
    });
    expect(
      (await get(fixture, `/v1/jobs/${accepted.jobId}`)).json(),
    ).toMatchObject({
      state: 'failed',
      attempt: 2,
      errorCode: 'MAX_ATTEMPTS_EXCEEDED',
    });
    expect(
      sseData(await get(fixture, `/v1/jobs/${accepted.jobId}/events`)),
    ).toMatchObject({
      type: 'job.failed',
      data: { code: 'MAX_ATTEMPTS_EXCEEDED', retryable: false },
    });
    expect(
      (await get(fixture, `/v1/careers/${careerId}/post-match`)).statusCode,
    ).toBe(404);
    expect((await fixture.runtime.runOnce()).kind).toBe('idle');
  });
});
