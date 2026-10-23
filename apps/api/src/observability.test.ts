import type { FootebasApplication, JobQueuePort } from '@footebas/application';
import { describe, expect, it } from 'vitest';
import { createFetchHandler } from './fetch-router.js';
import {
  jobLogEntry,
  requestLogEntry,
  type RequestCompletion,
} from './observability.js';
import { identifyRequest, unverifiedSubject } from './request-identity.js';
import type { ApiDependencies } from './routes.js';

const BASE = 'https://api.footebas.com.br';

function base64url(value: unknown): string {
  return btoa(JSON.stringify(value))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

const jwt = `${base64url({ alg: 'HS256' })}.${base64url({
  sub: '7f1c0c1e-5f3a-4a8e-9a55-0c8a1b2c3d4e',
  email: 'pessoa@example.com',
})}.assinatura`;

function handler(
  application: Partial<FootebasApplication>,
  completions: RequestCompletion[],
) {
  let clock = 1_000;
  const deps: ApiDependencies = {
    application: application as FootebasApplication,
    jobs: {} as JobQueuePort,
    nextRequestId: () => 'request_obs',
    health: { version: 'v-test' },
  };
  return createFetchHandler(deps, {
    now: () => (clock += 7),
    onComplete: (completion) => completions.push(completion),
  });
}

describe('identifyRequest', () => {
  it('lê o sub do JWT sem validar e expõe só hashes', async () => {
    expect(unverifiedSubject(jwt)).toBe('7f1c0c1e-5f3a-4a8e-9a55-0c8a1b2c3d4e');
    expect(unverifiedSubject('fake.user_x')).toBeUndefined();
    const identity = await identifyRequest(
      new Request(BASE, {
        headers: {
          authorization: `Bearer ${jwt}`,
          'cf-connecting-ip': '203.0.113.9',
        },
      }),
    );
    expect(identity.userHash).toMatch(/^[0-9a-f]{16}$/);
    expect(identity.bearerHash).toMatch(/^[0-9a-f]{64}$/);
    expect(identity.ipHash).toMatch(/^[0-9a-f]{64}$/);
    const serialized = JSON.stringify(identity);
    expect(serialized).not.toContain('7f1c0c1e');
    expect(serialized).not.toContain('203.0.113.9');
  });

  it('mesmo usuário com tokens diferentes tem o mesmo userHash', async () => {
    const other = jwt.replace('assinatura', 'outra');
    const [a, b] = await Promise.all(
      [jwt, other].map((token) =>
        identifyRequest(
          new Request(BASE, { headers: { authorization: `Bearer ${token}` } }),
        ),
      ),
    );
    expect(a?.userHash).toBe(b?.userHash);
    expect(a?.bearerHash).not.toBe(b?.bearerHash);
  });
});

describe('log por requisição', () => {
  it('registra rota normalizada, status, duração e x-request-id', async () => {
    const completions: RequestCompletion[] = [];
    const response = await handler(
      {},
      completions,
    )(new Request(`${BASE}/v1/careers/career_123/home`));
    expect(response.status).toBe(401);
    expect(response.headers.get('x-request-id')).toBe('request_obs');
    expect(completions).toEqual([
      {
        requestId: 'request_obs',
        method: 'GET',
        route: '/v1/careers/:id/home',
        status: 401,
        // The fake clock steps 7 ms per reading: start, handler in/out, end.
        durationMs: 21,
        timing: { app: 7 },
      },
    ]);
  });

  it('5xx leva a stack ao log e devolve resposta genérica', async () => {
    const completions: RequestCompletion[] = [];
    const response = await handler(
      {
        publicStats: () =>
          Promise.reject(new Error('connection to db.internal refused')),
      },
      completions,
    )(new Request(`${BASE}/v1/public/stats`));
    expect(response.status).toBe(500);
    const body = await response.text();
    expect(body).not.toContain('db.internal');
    const [completion] = completions;
    if (completion === undefined) throw new Error('no completion logged');
    expect(completion.route).toBe('/v1/public/stats');
    const entry = requestLogEntry(completion, { userHash: 'abcd' }, 'v-1');
    expect(entry).toMatchObject({
      type: 'request',
      level: 'error',
      requestId: 'request_obs',
      route: '/v1/public/stats',
      status: 500,
      userHash: 'abcd',
      version: 'v-1',
      errorName: 'Error',
    });
    expect(entry.stack).toContain('db.internal');
  });

  it('rota desconhecida aparece como unmatched e 4xx não carrega erro', async () => {
    const completions: RequestCompletion[] = [];
    await handler({}, completions)(new Request(`${BASE}/v1/careers/x/y/z`));
    const [completion] = completions;
    if (completion === undefined) throw new Error('no completion logged');
    expect(completion).toMatchObject({ route: 'unmatched', status: 404 });
    expect(completion).not.toHaveProperty('error');
    expect(requestLogEntry(completion, {}, 'v').level).toBe('info');
  });
});

describe('log por job', () => {
  it('registra carreira, tentativas, duração e resultado', () => {
    expect(
      jobLogEntry(
        {
          jobId: 'job_1',
          careerId: 'career_1',
          attempts: 2,
          durationMs: 840,
          result: 'succeeded',
        },
        'v-2',
      ),
    ).toEqual({
      type: 'job',
      level: 'info',
      jobId: 'job_1',
      careerId: 'career_1',
      attempts: 2,
      durationMs: 840,
      result: 'succeeded',
      version: 'v-2',
    });
  });

  it('falha final vira erro com stack', () => {
    const entry = jobLogEntry(
      {
        jobId: 'job_1',
        careerId: 'career_1',
        attempts: 6,
        durationMs: 10,
        result: 'dead_letter',
        error: new TypeError('boom'),
      },
      'v-2',
    );
    expect(entry).toMatchObject({ level: 'error', errorName: 'TypeError' });
    expect(entry.stack).toContain('boom');
    expect(
      jobLogEntry(
        {
          jobId: 'job_1',
          careerId: 'career_1',
          attempts: 1,
          durationMs: 10,
          result: 'retry',
        },
        'v',
      ).level,
    ).toBe('warn');
  });
});
