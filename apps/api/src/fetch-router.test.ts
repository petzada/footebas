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
