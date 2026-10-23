import type { FootebasApplication, JobQueuePort } from '@footebas/application';
import { describe, expect, it } from 'vitest';
import { createFetchHandler } from './fetch-router.js';
import { buildApi } from './index.js';
import type { ApiDependencies } from './routes.js';

const now = new Date('2026-10-22T12:00:00.000Z');

function deps(health?: ApiDependencies['health']): ApiDependencies {
  return {
    application: {} as FootebasApplication,
    jobs: {} as JobQueuePort,
    now: () => now,
    nextRequestId: () => 'request_test',
    documentation: false,
    ...(health ? { health } : {}),
  };
}

async function get(health: ApiDependencies['health'], path: string) {
  const response = await createFetchHandler(deps(health))(
    new Request(`https://api.footebas.com.br${path}`),
  );
  return { status: response.status, body: await response.json() };
}

describe('GET /health', () => {
  it('responde sem auth e checa o banco com select 1', async () => {
    let calls = 0;
    const result = await get(
      {
        version: 'v-abc',
        database: () => {
          calls += 1;
          return Promise.resolve();
        },
      },
      '/health',
    );
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      ok: true,
      version: 'v-abc',
      time: now.toISOString(),
      database: 'ok',
    });
    expect(calls).toBe(1);
  });

  it('deep=0 não toca no banco', async () => {
    let calls = 0;
    const result = await get(
      {
        version: 'v-abc',
        database: () => {
          calls += 1;
          return Promise.resolve();
        },
      },
      '/health?deep=0',
    );
    expect(result).toEqual({
      status: 200,
      body: {
        ok: true,
        version: 'v-abc',
        time: now.toISOString(),
        database: 'skipped',
      },
    });
    expect(calls).toBe(0);
  });

  it('503 quando o banco falha, sem vazar o erro', async () => {
    const result = await get(
      {
        version: 'v-abc',
        database: () => Promise.reject(new Error('password=secret')),
      },
      '/health',
    );
    expect(result.status).toBe(503);
    expect(result.body).toMatchObject({ ok: false, database: 'error' });
    expect(JSON.stringify(result.body)).not.toContain('secret');
  });

  it('503 com timeout curto quando o banco não responde', async () => {
    const result = await get(
      {
        version: 'v-abc',
        timeoutMs: 20,
        database: () => new Promise<void>(() => undefined),
      },
      '/health',
    );
    expect(result.status).toBe(503);
    expect(result.body).toMatchObject({ ok: false, database: 'timeout' });
  });

  it('servidor em memória (Fastify) responde in_memory', async () => {
    const app = await buildApi(deps({ version: 'dev' }));
    try {
      const response = await app.inject({ method: 'GET', url: '/health' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        ok: true,
        version: 'dev',
        time: now.toISOString(),
        database: 'in_memory',
      });
    } finally {
      await app.close();
    }
  });
});
