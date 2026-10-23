import {
  FakeBearerAuth,
  FakeClock,
  RankingService,
  type FootebasApplication,
  type JobQueuePort,
} from '@footebas/application';
import { InMemoryRankingStore, InMemoryUnitOfWork } from '@footebas/database';
import { afterEach, describe, expect, it } from 'vitest';
import { createFetchHandler } from './fetch-router.js';
import { buildApi } from './index.js';
import {
  publicCacheKey,
  withPublicCache,
  type EdgeCache,
} from './public-cache.js';

const BASE = 'https://api.footebas.com.br';

async function rankings() {
  const clock = new FakeClock(new Date('2026-10-23T12:00:00.000Z'));
  const unitOfWork = new InMemoryUnitOfWork(clock);
  const auth = new FakeBearerAuth();
  // Bruno signed up and has no career: counted, never listed.
  unitOfWork.signUp('user_bruno', '2026-10-01T00:00:00.000Z');
  const service = new RankingService({
    store: new InMemoryRankingStore(unitOfWork),
    clock,
    auth,
  });
  // Live: the board changes as soon as the achievement commits.
  await unitOfWork.withCareerLock('career_ana', async (tx) => {
    await tx.achievements.record([
      {
        careerId: 'career_ana',
        userId: 'user_ana',
        displayName: 'Ana',
        type: 'league_title',
        season: 1,
        competitionId: 'competition_serie_a',
        clubId: 'club_one',
        clubReputation: 80,
        gameDate: '2026-12-31',
        points: 100,
        risePoints: 0,
        rulesVersion: 'ranking-v2',
        recordedAt: '2026-10-20T10:00:00.000Z',
      },
    ]);
  });
  const token = (userId: string) =>
    auth.issue({ userId, email: `${userId}@example.com`, displayName: userId });
  return { service, token };
}

describe('rotas de ranking', () => {
  it('serve o ranking ao vivo com cache público de no máximo 30 s', async () => {
    const { service } = await rankings();
    const handle = createFetchHandler({
      application: {} as FootebasApplication,
      jobs: {} as JobQueuePort,
      rankings: service,
    });
    const response = await handle(
      new Request(`${BASE}/v1/rankings?scope=general`),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=30, s-maxage=30',
    );
    expect(await response.json()).toMatchObject({
      scope: 'general',
      period: 'all',
      rulesVersion: 'ranking-v2',
      total: 2,
      rows: [{ position: 1, displayName: 'Ana', points: 100 }],
    });
    const titles = await handle(
      new Request(`${BASE}/v1/rankings?scope=titles`),
    );
    expect(await titles.json()).toMatchObject({
      rows: [{ position: 1, displayName: 'Ana', points: 100, titles: 1 }],
    });
    const best = await handle(
      new Request(`${BASE}/v1/rankings?scope=best_season`),
    );
    expect(await best.json()).toMatchObject({
      rows: [{ position: 1, points: 100, season: 1 }],
    });
    const monthly = await handle(
      new Request(`${BASE}/v1/rankings?scope=monthly&period=2026-10`),
    );
    expect(await monthly.json()).toMatchObject({
      period: '2026-10',
      total: 2,
    });
    const invalid = await handle(
      new Request(`${BASE}/v1/rankings?scope=weekly`),
    );
    expect(invalid.status).toBe(400);
  });

  it('aceita scope=global como apelido de Geral', async () => {
    const { service } = await rankings();
    const handle = createFetchHandler({
      application: {} as FootebasApplication,
      jobs: {} as JobQueuePort,
      rankings: service,
    });
    const response = await handle(
      new Request(`${BASE}/v1/rankings?scope=global`),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      scope: 'global',
      rows: [{ position: 1, displayName: 'Ana', points: 100 }],
    });
  });

  it('exige login para a minha posição e não a guarda em cache', async () => {
    const { service, token } = await rankings();
    const handle = createFetchHandler({
      application: {} as FootebasApplication,
      jobs: {} as JobQueuePort,
      rankings: service,
    });
    const anonymous = await handle(new Request(`${BASE}/v1/rankings/me`));
    expect(anonymous.status).toBe(401);
    const response = await handle(
      new Request(`${BASE}/v1/rankings/me`, {
        headers: { authorization: `Bearer ${token('user_ana')}` },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = (await response.json()) as {
      entries: { scope: string; position?: number; total: number }[];
    };
    expect(
      body.entries.map(({ scope, position, total }) => [
        scope,
        position,
        total,
      ]),
    ).toEqual([
      ['general', 1, 2],
      ['titles', 1, 2],
      ['best_season', 1, 2],
      // No rise points: zero, after Bruno, who signed up earlier.
      ['rise', 2, 2],
      ['monthly', 1, 2],
    ]);
    const bruno = await handle(
      new Request(`${BASE}/v1/rankings/me`, {
        headers: { authorization: `Bearer ${token('user_bruno')}` },
      }),
    );
    const brunoBody = (await bruno.json()) as {
      entries: { position?: number; total: number; points: number }[];
    };
    // "Você é o 2º de 2", with zero points.
    expect(brunoBody.entries[0]).toMatchObject({
      position: 2,
      total: 2,
      points: 0,
    });
  });
});

/** Cache API stand-in keyed by URL (like `caches.default`). */
function memoryCache() {
  const entries = new Map<string, Response>();
  const cache: EdgeCache = {
    match: (key) => Promise.resolve(entries.get(key.url)?.clone()),
    put: (key, response) => {
      entries.set(key.url, response);
      return Promise.resolve();
    },
  };
  return { cache, entries };
}

describe('cache de borda do ranking público (ADR 0017)', () => {
  it('guarda a resposta pública e a serve sem chamar a rota', async () => {
    const { cache, entries } = memoryCache();
    const deferred: Promise<unknown>[] = [];
    let produced = 0;
    const produce = () => {
      produced++;
      return Promise.resolve(
        new Response('{"rows":[]}', {
          headers: { 'cache-control': 'public, max-age=30, s-maxage=30' },
        }),
      );
    };
    const request = () =>
      new Request(`${BASE}/v1/rankings?scope=titles&limit=10`, {
        headers: { origin: 'https://game.footebas.com.br' },
      });
    await withPublicCache(request(), cache, produce, (work) =>
      deferred.push(work),
    );
    await Promise.all(deferred);
    expect(entries.size).toBe(1);
    const hit = await withPublicCache(request(), cache, produce, (work) =>
      deferred.push(work),
    );
    expect(await hit.text()).toBe('{"rows":[]}');
    expect(produced).toBe(1);
  });

  it('separa a chave por origem e ordena a query', () => {
    const key = (url: string, origin?: string) =>
      publicCacheKey(
        new Request(url, origin === undefined ? {} : { headers: { origin } }),
      )?.url;
    expect(key(`${BASE}/v1/rankings?scope=titles&limit=10`)).toBe(
      key(`${BASE}/v1/rankings?limit=10&scope=titles`),
    );
    expect(
      key(`${BASE}/v1/rankings?scope=titles`, 'https://game.footebas.com.br'),
    ).not.toBe(
      key(`${BASE}/v1/rankings?scope=titles`, 'https://footebas.com.br'),
    );
    expect(key(`${BASE}/v1/rankings/me`)).toBeUndefined();
    expect(
      publicCacheKey(new Request(`${BASE}/v1/rankings`, { method: 'POST' })),
    ).toBeUndefined();
  });

  it('não guarda erros nem respostas privadas', async () => {
    const { cache, entries } = memoryCache();
    const deferred: Promise<unknown>[] = [];
    for (const response of [
      new Response('{}', {
        status: 400,
        headers: { 'cache-control': 'public, max-age=30' },
      }),
      new Response('{}', { headers: { 'cache-control': 'no-store' } }),
    ])
      await withPublicCache(
        new Request(`${BASE}/v1/rankings`),
        cache,
        () => Promise.resolve(response),
        (work) => deferred.push(work),
      );
    await Promise.all(deferred);
    expect(entries.size).toBe(0);
  });
});

describe('POST /v1/commands aceita ResolveInboxDecision', () => {
  const apps: Awaited<ReturnType<typeof buildApi>>[] = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it('valida o envelope e repassa para a aplicação', async () => {
    const seen: unknown[] = [];
    const app = await buildApi({
      application: {
        execute: (_token: string, command: { commandId: string }) => {
          seen.push(command);
          return Promise.resolve({
            version: 1,
            commandId: command.commandId,
            careerId: 'career_one',
            aggregateVersion: 5,
          });
        },
      } as unknown as FootebasApplication,
      jobs: {} as JobQueuePort,
      documentation: false,
    });
    apps.push(app);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/commands',
      headers: { authorization: 'Bearer owner' },
      payload: {
        version: 1,
        type: 'ResolveInboxDecision',
        commandId: 'command_resolve',
        idempotencyKey: 'idem-resolve-1',
        expectedVersion: 4,
        payload: {
          careerId: 'career_one',
          messageId: 'mail_press_2026_01',
          optionId: 'praise_group',
        },
      },
    });
    expect(response.statusCode).toBe(202);
    expect(seen).toHaveLength(1);
  });
});
