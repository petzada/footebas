import type { FootebasApplication, JobQueuePort } from '@footebas/application';
import { describe, expect, it } from 'vitest';
import { createFetchHandler } from './fetch-router.js';
import type { ApiDependencies } from './routes.js';

const BASE = 'https://api.footebas.com.br';
const ORIGIN = 'https://game.footebas.com.br';

function deps(): ApiDependencies {
  return {
    application: {
      publicStats: () => Promise.resolve({ coaches: 1, clubs: 2, athletes: 3 }),
    } as unknown as FootebasApplication,
    jobs: {} as JobQueuePort,
    nextRequestId: () => 'request_test',
    corsOrigins: [ORIGIN],
    health: { version: 'v-test' },
  };
}

describe('fetch router: CORS e rotas', () => {
  it('preflight de origem permitida pode ser reaproveitado por 2 horas', async () => {
    const response = await createFetchHandler(deps())(
      new Request(`${BASE}/v1/commands`, {
        method: 'OPTIONS',
        headers: {
          origin: ORIGIN,
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'authorization,content-type',
        },
      }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(response.headers.get('access-control-max-age')).toBe('7200');
  });

  it('origem fora da lista não recebe CORS nem max-age', async () => {
    const response = await createFetchHandler(deps())(
      new Request(`${BASE}/v1/commands`, {
        method: 'OPTIONS',
        headers: { origin: 'https://evil.example' },
      }),
    );
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(response.headers.get('access-control-max-age')).toBeNull();
  });

  it('casa as mesmas rotas em handlers criados um depois do outro', async () => {
    for (let i = 0; i < 2; i++) {
      const handler = createFetchHandler(deps());
      const stats = await handler(new Request(`${BASE}/v1/public/stats`));
      expect(stats.status).toBe(200);
      const missing = await handler(new Request(`${BASE}/v1/nope`));
      expect(missing.status).toBe(404);
    }
  });
});

describe('fetch router: Server-Timing', () => {
  it('mede rate limit, handler e total, com métricas extras e prefixo', async () => {
    let clock = 0;
    const response = await createFetchHandler(deps(), {
      now: () => (clock += 5),
      timingPrefix: 'do-',
      rateLimit: () => Promise.resolve({ allowed: true, retryAfterSeconds: 0 }),
      timings: () => [
        { name: 'pg', desc: 'n=2' },
        { name: 'colo', desc: 'IAD' },
      ],
    })(new Request(`${BASE}/v1/public/stats`, { headers: { origin: ORIGIN } }));
    const header = response.headers.get('server-timing') ?? '';
    expect(header).toMatch(/^do-rl;dur=\d+, do-app;dur=\d+, /);
    expect(header).toContain('do-pg;desc="n=2"');
    expect(header).toContain('do-colo;desc="IAD"');
    expect(header).toMatch(/do-total;dur=\d+$/);
    expect(response.headers.get('timing-allow-origin')).toBe(ORIGIN);
    expect(response.headers.get('access-control-expose-headers')).toContain(
      'server-timing',
    );
  });

  it('mantém as métricas do objeto encaminhado e soma as do Worker', async () => {
    const completions: (Record<string, number | string> | undefined)[] = [];
    const response = await createFetchHandler(deps(), {
      forward: () =>
        Promise.resolve(
          new Response('{}', {
            headers: { 'server-timing': 'do-load;dur=40, do-total;dur=55' },
          }),
        ),
      timings: () => [{ name: 'edge', desc: 'GRU' }],
      onComplete: (completion) => completions.push(completion.timing),
    })(new Request(`${BASE}/v1/public/stats`));
    const header = response.headers.get('server-timing') ?? '';
    expect(header).toMatch(/^do-load;dur=40, do-total;dur=55, fwd;dur=\d+/);
    expect(header).toContain('edge;desc="GRU"');
    expect(completions).toHaveLength(1);
    expect(typeof completions[0]?.fwd).toBe('number');
    expect(completions[0]?.edge).toBe('GRU');
  });
});
