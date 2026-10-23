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

const BASE = 'https://api.footebas.com.br';

async function rankings() {
  const clock = new FakeClock(new Date('2026-10-23T12:00:00.000Z'));
  const unitOfWork = new InMemoryUnitOfWork(clock);
  const auth = new FakeBearerAuth();
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
        rulesVersion: 'ranking-v1',
        recordedAt: '2026-10-20T10:00:00.000Z',
      },
    ]);
  });
  const service = new RankingService({
    store: new InMemoryRankingStore(() => unitOfWork.achievements()),
    clock,
    auth,
  });
  await service.generateSnapshots();
  const token = auth.issue({
    userId: 'user_ana',
    email: 'ana@example.com',
    displayName: 'Ana',
  });
  return { service, token };
}

describe('rotas de ranking', () => {
  it('serve o snapshot público com cache de 5 minutos', async () => {
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
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=300, s-maxage=300',
    );
    expect(await response.json()).toMatchObject({
      scope: 'global',
      period: 'all',
      total: 1,
      rows: [{ position: 1, displayName: 'Ana', points: 100 }],
    });
    const monthly = await handle(
      new Request(`${BASE}/v1/rankings?scope=monthly&period=2026-10`),
    );
    expect(await monthly.json()).toMatchObject({
      period: '2026-10',
      total: 1,
    });
    const invalid = await handle(
      new Request(`${BASE}/v1/rankings?scope=weekly`),
    );
    expect(invalid.status).toBe(400);
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
        headers: { authorization: `Bearer ${token}` },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = (await response.json()) as {
      entries: { scope: string; position?: number }[];
    };
    expect(
      body.entries.map(({ scope, position }) => [scope, position]),
    ).toEqual([
      ['global', 1],
      ['rise', undefined],
      ['monthly', 1],
    ]);
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
