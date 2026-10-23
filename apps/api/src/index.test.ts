import {
  ApplicationError,
  type FootebasApplication,
  type JobQueuePort,
} from '@footebas/application';
import {
  apiErrorSchema,
  jobSseEventSchema,
  type JobStatus,
} from '@footebas/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApi } from './index.js';

const home = {
  version: 1 as const,
  careerId: 'career_one',
  aggregateVersion: 4,
  projectedAt: '2026-07-21T12:00:00.000Z',
  managerName: 'Ada',
  currentDate: '2026-01-01',
  season: 1,
  pendingActions: [],
};
const status: JobStatus = {
  version: 1,
  jobId: 'job_one',
  commandId: 'command_one',
  careerId: 'career_one',
  state: 'succeeded',
  progress: { current: 1, total: 1, percent: 100, stage: 'succeeded' },
  attempt: 1,
  createdAt: '2026-07-21T12:00:00.000Z',
  updatedAt: '2026-07-21T12:00:01.000Z',
};

function fixture(options: { owner?: boolean; job?: JobStatus } = {}) {
  const application = {
    execute: (_token: string, command: { commandId: string }) =>
      Promise.resolve({
        version: 1,
        commandId: command.commandId,
        careerId: 'career_one',
        aggregateVersion: 1,
      }),
    home: (token: string) => {
      if (token !== 'Bearer owner')
        throw new ApplicationError(
          options.owner === false ? 'FORBIDDEN' : 'UNAUTHORIZED',
          'denied',
        );
      return Promise.resolve(home);
    },
    squad: () => Promise.resolve({ ok: true }),
    nextMatch: () => Promise.resolve({ ok: true }),
    standings: () => Promise.resolve({ ok: true }),
    postMatch: () => Promise.resolve({ ok: true }),
  } as unknown as FootebasApplication;
  const jobs = {
    status: (id: string) =>
      Promise.resolve(
        id === (options.job ?? status).jobId
          ? (options.job ?? status)
          : undefined,
      ),
  } as JobQueuePort;
  return buildApi({
    application,
    jobs,
    nextRequestId: () => 'request_test',
    now: () => new Date('2026-07-21T12:00:02.000Z'),
  });
}

const apps: Awaited<ReturnType<typeof buildApi>>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});
async function api(options?: Parameters<typeof fixture>[0]) {
  const app = await fixture(options);
  apps.push(app);
  return app;
}

describe('Footebas HTTP boundary', () => {
  it('accepts a strict versioned command and exposes deterministic request ids', async () => {
    const app = await api();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/commands',
      headers: {
        authorization: 'Bearer owner',
        'idempotency-key': 'create:0001',
      },
      payload: {
        version: 1,
        commandId: 'command_create',
        idempotencyKey: 'create:0001',
        expectedVersion: 0,
        type: 'CreateCareer',
        payload: { managerName: 'Ada', startDate: '2026-01-01' },
      },
    });
    expect(response.statusCode).toBe(202);
    expect(response.headers['idempotency-key']).toBe('create:0001');
    expect(response.json()).toMatchObject({
      commandId: 'command_create',
      careerId: 'career_one',
    });
  });

  it('rejects an idempotency header that can replay a different body', async () => {
    const app = await api();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/commands',
      headers: {
        authorization: 'Bearer owner',
        'idempotency-key': 'create:different',
      },
      payload: {
        version: 1,
        commandId: 'command_create',
        idempotencyKey: 'create:0001',
        expectedVersion: 0,
        type: 'CreateCareer',
        payload: { managerName: 'Ada', startDate: '2026-01-01' },
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('requires bearer auth, rejects unknown input and never leaks stacks', async () => {
    const app = await api();
    const missing = await app.inject({
      method: 'GET',
      url: '/v1/careers/career_one/home',
    });
    expect(missing.statusCode).toBe(401);
    expect(apiErrorSchema.parse(missing.json()).requestId).toBe('request_test');
    expect(missing.body).not.toContain('stack');
    const invalid = await app.inject({
      method: 'POST',
      url: '/v1/commands',
      headers: { authorization: 'Bearer owner' },
      payload: { surprise: true },
    });
    expect(invalid.statusCode).toBe(400);
    expect(
      (await app.inject({ method: 'GET', url: '/v1/snapshots/career_one' }))
        .statusCode,
    ).toBe(404);
  });

  it('enforces job ownership and serializes status and terminal SSE events', async () => {
    const app = await api();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/jobs/job_one',
      headers: { authorization: 'Bearer owner' },
    });
    expect(response.json()).toEqual(status);
    const stream = await app.inject({
      method: 'GET',
      url: '/v1/jobs/job_one/events',
      headers: { authorization: 'Bearer owner' },
    });
    expect(stream.headers['content-type']).toContain('text/event-stream');
    const line = stream.body
      .split('\n')
      .find((candidate) => candidate.startsWith('data: '));
    expect(line).toBeDefined();
    const data = line?.slice(6) ?? '';
    expect(jobSseEventSchema.parse(JSON.parse(data))).toMatchObject({
      type: 'job.completed',
      data: { aggregateVersion: 4 },
    });
    const denied = await app.inject({
      method: 'GET',
      url: '/v1/jobs/job_one',
      headers: { authorization: 'Bearer intruder' },
    });
    expect(denied.statusCode).toBe(401);
  });

  it('publishes an OpenAPI document for every versioned route', async () => {
    const app = await api();
    const document = (await app.inject('/documentation/json')).json<{
      paths: Record<string, unknown>;
    }>();
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining([
        '/v1/commands',
        '/v1/jobs/{id}',
        '/v1/jobs/{id}/events',
        '/v1/careers/{id}/home',
      ]),
    );
  });
});
