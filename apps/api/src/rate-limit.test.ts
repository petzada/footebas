import type { FootebasApplication, JobQueuePort } from '@footebas/application';
import { describe, expect, it } from 'vitest';
import { createFetchHandler } from './fetch-router.js';
import {
  FakeRateLimiter,
  rateLimitBucket,
  rateLimitGuard,
  rateLimitKey,
  WorkersRateLimiter,
  type RateLimitBinding,
} from './rate-limit.js';
import { identifyRequest } from './request-identity.js';
import type { ApiDependencies } from './routes.js';

const BASE = 'https://api.footebas.com.br';

function deps(): ApiDependencies {
  return {
    application: {
      publicStats: () => Promise.resolve({ coaches: 1, clubs: 2, athletes: 3 }),
    } as unknown as FootebasApplication,
    jobs: {} as JobQueuePort,
    nextRequestId: () => 'request_test',
    corsOrigins: ['https://footebas.com.br'],
    health: { version: 'v-test' },
  };
}

async function call(
  limiter: FakeRateLimiter,
  path: string,
  init: RequestInit = {},
) {
  const request = new Request(`${BASE}${path}`, init);
  const identity = await identifyRequest(request);
  const response = await createFetchHandler(deps(), {
    rateLimit: rateLimitGuard(limiter, identity),
  })(request);
  return response;
}

describe('rateLimitBucket', () => {
  it('isenta health, webhook e preflight', () => {
    expect(rateLimitBucket('GET', '/health', false)).toBeUndefined();
    expect(
      rateLimitBucket('POST', '/v1/billing/webhook', false),
    ).toBeUndefined();
    expect(rateLimitBucket('OPTIONS', '/v1/commands', true)).toBeUndefined();
  });

  it('separa comandos, leituras e anônimos', () => {
    expect(rateLimitBucket('POST', '/v1/commands', true)).toBe('command');
    expect(rateLimitBucket('POST', '/v1/phase-four/commands', true)).toBe(
      'command',
    );
    expect(rateLimitBucket('GET', '/v1/careers', true)).toBe('read');
    expect(rateLimitBucket('GET', '/v1/public/stats', false)).toBe('public');
    expect(rateLimitBucket('POST', '/v1/commands', false)).toBe('public');
    expect(rateLimitBucket('GET', undefined, false)).toBe('public');
  });
});

describe('rateLimitKey', () => {
  it('usa o hash do bearer e nunca o token cru', async () => {
    const identity = await identifyRequest(
      new Request(BASE, { headers: { authorization: 'Bearer secret-token' } }),
    );
    const key = rateLimitKey(identity);
    expect(key).toMatch(/^user:[0-9a-f]{64}$/);
    expect(key).not.toContain('secret-token');
  });

  it('usa o hash do IP para anônimos', async () => {
    const identity = await identifyRequest(
      new Request(BASE, { headers: { 'cf-connecting-ip': '203.0.113.7' } }),
    );
    const key = rateLimitKey(identity);
    expect(key).toMatch(/^ip:[0-9a-f]{64}$/);
    expect(key).not.toContain('203.0.113.7');
  });
});

describe('FakeRateLimiter', () => {
  it('janela fixa por balde e chave, com retry-after até o fim da janela', async () => {
    let now = 0;
    const limiter = new FakeRateLimiter(
      { command: 2, read: 5, public: 1 },
      { periodSeconds: 60, now: () => now },
    );
    expect((await limiter.limit('command', 'user:a')).allowed).toBe(true);
    expect((await limiter.limit('command', 'user:a')).allowed).toBe(true);
    now = 15_000;
    expect(await limiter.limit('command', 'user:a')).toEqual({
      allowed: false,
      retryAfterSeconds: 45,
    });
    expect((await limiter.limit('command', 'user:b')).allowed).toBe(true);
    expect((await limiter.limit('read', 'user:a')).allowed).toBe(true);
    now = 60_000;
    expect((await limiter.limit('command', 'user:a')).allowed).toBe(true);
  });
});

describe('WorkersRateLimiter', () => {
  const binding = (success: boolean | Error): RateLimitBinding => ({
    limit: () =>
      success instanceof Error
        ? Promise.reject(success)
        : Promise.resolve({ success }),
  });

  it('traduz o binding em decisão com retry-after do período', async () => {
    const limiter = new WorkersRateLimiter({
      command: binding(false),
      read: binding(true),
    });
    expect(await limiter.limit('command', 'k')).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
    expect(await limiter.limit('read', 'k')).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it('falha aberto sem binding ou com erro do binding', async () => {
    const limiter = new WorkersRateLimiter({
      command: binding(new Error('x')),
    });
    expect((await limiter.limit('command', 'k')).allowed).toBe(true);
    expect((await limiter.limit('public', 'k')).allowed).toBe(true);
  });
});

describe('fetch router com rate limit', () => {
  it('responde 429 no formato de erro do contrato, com retry-after e CORS', async () => {
    const limiter = new FakeRateLimiter({ command: 0, read: 0, public: 1 });
    const init = {
      headers: {
        'cf-connecting-ip': '198.51.100.1',
        origin: 'https://footebas.com.br',
      },
    };
    expect((await call(limiter, '/v1/public/stats', init)).status).toBe(200);
    const limited = await call(limiter, '/v1/public/stats', init);
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toMatch(/^\d+$/);
    expect(limited.headers.get('x-request-id')).toBe('request_test');
    expect(limited.headers.get('access-control-allow-origin')).toBe(
      'https://footebas.com.br',
    );
    expect(limited.headers.get('access-control-expose-headers')).toContain(
      'retry-after',
    );
    expect(await limited.json()).toEqual({
      version: 1,
      requestId: 'request_test',
      code: 'RATE_LIMITED',
      message: 'rate limit exceeded; retry later',
      retryAfterSeconds: Number(limited.headers.get('retry-after')),
    });
  });

  it('comando autenticado conta no balde de comandos antes de ler o corpo', async () => {
    const limiter = new FakeRateLimiter({ command: 0, read: 10, public: 10 });
    const response = await call(limiter, '/v1/commands', {
      method: 'POST',
      headers: { authorization: 'Bearer token-a' },
      body: '{not json',
    });
    expect(response.status).toBe(429);
    expect(limiter.calls).toEqual([
      { bucket: 'command', key: expect.stringMatching(/^user:/) as string },
    ]);
  });

  it('health nunca consulta o limitador', async () => {
    const limiter = new FakeRateLimiter({ command: 0, read: 0, public: 0 });
    const response = await call(limiter, '/health?deep=0');
    expect(response.status).toBe(200);
    expect(limiter.calls).toEqual([]);
  });

  it('rota desconhecida conta como anônima e segue para 404', async () => {
    const limiter = new FakeRateLimiter();
    const response = await call(limiter, '/v1/nao-existe');
    expect(response.status).toBe(404);
    expect(limiter.calls).toEqual([{ bucket: 'public', key: 'ip:unknown' }]);
  });
});
