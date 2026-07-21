import { describe, expect, it } from 'vitest';
import { FakeClock, type SimulationJob } from '@footebas/application';
import type { JobStatus } from '@footebas/contracts';
import { InMemoryWorkerJobQueue } from './queue.js';
import { WorkerRuntime, type JobRunner } from './runtime.js';
import { FakeScheduler } from './scheduler.js';

const job: SimulationJob = {
  id: 'job_1',
  commandId: 'command_1',
  careerId: 'career_1',
  userId: 'user_1',
  expectedVersion: 1,
};

function status(state: JobStatus['state'], attempt: number): JobStatus {
  return {
    version: 1,
    jobId: job.id,
    commandId: job.commandId,
    careerId: job.careerId,
    state,
    progress: {
      current: state === 'succeeded' ? 1 : 0,
      total: 1,
      percent: state === 'succeeded' ? 100 : 0,
      stage: state,
    },
    attempt,
    createdAt: '2026-07-21T12:00:00.000Z',
    updatedAt: '2026-07-21T12:00:00.000Z',
    ...(state === 'failed' ? { errorCode: 'SIMULATION_FAILED' } : {}),
  };
}

async function setup(
  outcomes: readonly (JobStatus | undefined)[],
  options = {},
) {
  const clock = new FakeClock();
  const scheduler = new FakeScheduler(clock);
  const queue = new InMemoryWorkerJobQueue();
  await queue.enqueue(job);
  let calls = 0;
  const runner: JobRunner = {
    runNextJob: () => Promise.resolve(outcomes[calls++]),
  };
  return {
    clock,
    scheduler,
    queue,
    runtime: new WorkerRuntime(runner, queue, clock, scheduler, options),
    calls: () => calls,
  };
}

describe('WorkerRuntime contract', () => {
  it('reports success and an empty queue without blocking', async () => {
    const successful = await setup([status('succeeded', 1), undefined]);
    expect((await successful.runtime.runOnce()).kind).toBe('succeeded');
    expect((await successful.runtime.runOnce()).kind).toBe('idle');
    expect(successful.runtime.health()).toMatchObject({
      healthy: true,
      acceptingWork: true,
    });
  });

  it('retries once with logical backoff and succeeds without duplicate work', async () => {
    const fixtureWrites = new Set<string>();
    const clock = new FakeClock();
    const scheduler = new FakeScheduler(clock);
    const queue = new InMemoryWorkerJobQueue();
    await queue.enqueue(job);
    let attempt = 0;
    const runner: JobRunner = {
      runNextJob() {
        attempt += 1;
        if (attempt === 1) return Promise.resolve(status('failed', attempt));
        if (attempt > 2) return Promise.resolve(undefined);
        fixtureWrites.add('fixture_1');
        return Promise.resolve(status('succeeded', attempt));
      },
    };
    const runtime = new WorkerRuntime(runner, queue, clock, scheduler, {
      backoffMilliseconds: () => 250,
    });
    expect((await runtime.drain()).map(({ kind }) => kind)).toEqual([
      'retry_scheduled',
      'succeeded',
    ]);
    expect(scheduler.delays).toEqual([250]);
    expect(fixtureWrites.size).toBe(1);
  });

  it('dead-letters permanent failures and cannot loop on the pending retry', async () => {
    const test = await setup(
      [status('failed', 1), status('failed', 2), undefined],
      { maxAttempts: 2 },
    );
    const results = await test.runtime.drain();
    expect(results.map(({ kind }) => kind)).toEqual([
      'retry_scheduled',
      'terminal',
    ]);
    expect(test.queue.deadLetters()).toHaveLength(1);
    expect(await test.queue.take()).toBeUndefined();
    expect((await test.queue.status(job.id))?.errorCode).toBe(
      'MAX_ATTEMPTS_EXCEEDED',
    );
    expect((await test.runtime.runOnce()).kind).toBe('idle');
  });

  it('stops accepting work on shutdown', async () => {
    const test = await setup([status('succeeded', 1)]);
    test.runtime.shutdown();
    expect(await test.runtime.drain()).toEqual([]);
    expect(test.calls()).toBe(0);
    expect(test.runtime.health()).toMatchObject({
      acceptingWork: false,
      running: false,
    });
  });

  it('exposes a logical timeout without unsafe timers', async () => {
    const clock = new FakeClock();
    const scheduler = new FakeScheduler(clock);
    const queue = new InMemoryWorkerJobQueue();
    await queue.enqueue(job);
    const runner: JobRunner = {
      runNextJob() {
        clock.advance(101);
        return Promise.resolve(status('failed', 1));
      },
    };
    const runtime = new WorkerRuntime(runner, queue, clock, scheduler, {
      maxAttempts: 1,
      timeoutMilliseconds: 100,
    });
    expect((await runtime.runOnce()).status?.errorCode).toBe('WORKER_TIMEOUT');
    expect(queue.deadLetters()).toHaveLength(1);
  });
});
