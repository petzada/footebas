/* eslint-disable @typescript-eslint/no-non-null-assertion -- careers created in each test */
import {
  FakeBearerAuth,
  FakeClock,
  FootebasApplication,
  InMemoryJobQueue,
  InMemoryArchiveStorage,
  InMemoryStorage,
  Mulberry32RandomFactory,
  PhaseFourApplicationService,
  UnifiedPhaseFourRepository,
  NoopTelemetry,
  SequentialIdGenerator,
  storedSize,
} from '@footebas/application';
import {
  InMemoryUnitOfWork,
  type CareerSaveStore,
  type GameSave,
} from '@footebas/database';
import { describe, expect, it } from 'vitest';
import {
  CAREER_OBJECT_LOCATION,
  CareerObject,
  careerForwarder,
  careerOfRoute,
  runJobInCareerObject,
  warmCareerObject,
  type CareerObjectNamespace,
} from './career-durable-object.js';
import type { CareerObjectStorage } from './career-unit-of-work.js';
import { createFetchHandler } from './fetch-router.js';

const BASE = 'https://api.footebas.com.br';

/** `DurableObjectStorage` stand-in: values are cloned like the real one. */
class FakeStorage implements CareerObjectStorage {
  public readonly values = new Map<string, unknown>();
  public get<T>(key: string): Promise<T | undefined> {
    const value = this.values.get(key);
    return Promise.resolve(
      value === undefined ? undefined : (structuredClone(value) as T),
    );
  }
  public put(entries: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(entries))
      this.values.set(key, structuredClone(value));
    return Promise.resolve();
  }
  public delete(keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) if (this.values.delete(key)) count += 1;
    return Promise.resolve(count);
  }
}

function setup() {
  const clock = new FakeClock();
  const auth = new FakeBearerAuth();
  const ids = new SequentialIdGenerator();
  // Postgres stand-in shared by the Worker path and the career objects.
  const postgres = new InMemoryUnitOfWork(clock);
  const jobs = new InMemoryJobQueue();
  const storages = new Map<string, FakeStorage>();
  const objects = new Map<string, CareerObject>();
  const calls: string[] = [];
  /** Postgres reads and writes of the career objects (round trips). */
  const storeCalls: string[] = [];
  const store = (): CareerSaveStore => {
    const inner = postgres.careerSaveStore();
    const note = <T>(name: string, value: T): T => {
      storeCalls.push(name);
      return value;
    };
    return {
      peek: (id) => note('peek', inner.peek(id)),
      versionOf: (id) => note('versionOf', inner.versionOf(id)),
      commit: (save, expected, achievements) =>
        note('commit', inner.commit(save, expected, achievements)),
      archive: (id, userId, expected) =>
        note('archive', inner.archive(id, userId, expected)),
      delete: (id, userId) => note('delete', inner.delete(id, userId)),
      listAchievements: (id) =>
        note('listAchievements', inner.listAchievements(id)),
    };
  };
  const created: string[] = [];
  const objectFor = (careerId: string) => {
    let object = objects.get(careerId);
    if (object === undefined) {
      let storage = storages.get(careerId);
      if (storage === undefined)
        storages.set(careerId, (storage = new FakeStorage()));
      object = new CareerObject({
        storage,
        store,
        jobs: () => jobs,
        auth,
        clock,
        ids,
        // Production reads the creation order from Postgres (locked careers).
        careerSlots: () => ({
          activeCareerIds: async (userId) =>
            (await postgres.repositories().saves.listByUser(userId)).map(
              ({ id }) => id,
            ),
        }),
      });
      objects.set(careerId, object);
    }
    return object;
  };
  const namespace: CareerObjectNamespace = {
    idFromName: (name) => name,
    get: (id) => ({
      fetch: (request) => {
        calls.push(`${request.method} ${new URL(request.url).pathname}`);
        return objectFor(id).fetch(request);
      },
    }),
  };
  const worker = new FootebasApplication({
    auth,
    clock,
    ids,
    jobs,
    storage: new InMemoryStorage(),
    telemetry: new NoopTelemetry(),
    unitOfWork: postgres,
  });
  const handler = (forward: boolean) =>
    createFetchHandler(
      {
        application: worker,
        jobs,
        phaseFour: {
          application: new PhaseFourApplicationService({
            repository: new UnifiedPhaseFourRepository(postgres),
            archives: new InMemoryArchiveStorage(),
            clock,
            ids,
            random: new Mulberry32RandomFactory(),
          }),
          auth,
        },
        onCareerCreated: (careerId) => created.push(careerId),
      },
      forward ? { forward: careerForwarder(namespace) } : {},
    );
  const owner = `Bearer ${auth.issue({ userId: 'user_owner', email: 'owner@example.com', displayName: 'Owner' })}`;
  const stranger = `Bearer ${auth.issue({ userId: 'user_stranger', email: 'x@example.com', displayName: 'X' })}`;
  /** Simulates eviction: memory is lost, the object's storage stays. */
  const restart = (careerId: string) => objects.delete(careerId);
  return {
    postgres,
    jobs,
    storages,
    calls,
    storeCalls,
    created,
    namespace,
    owner,
    stranger,
    restart,
    api: handler(true),
    fallback: handler(false),
  };
}

type Api = (request: Request) => Promise<Response>;
let sequence = 0;
async function send(
  api: Api,
  bearer: string,
  type: string,
  expectedVersion: number,
  payload: object,
  key = `idem-key-${String((sequence += 1))}`,
) {
  return api(
    new Request(`${BASE}/v1/commands`, {
      method: 'POST',
      headers: { authorization: bearer, 'content-type': 'application/json' },
      body: JSON.stringify({
        version: 1,
        type,
        commandId: `command_${key.replace(/[^a-z0-9]/gi, '_')}`,
        idempotencyKey: key,
        expectedVersion,
        payload,
      }),
    }),
  );
}
const read = (api: Api, bearer: string, path: string, headers = {}) =>
  api(
    new Request(`${BASE}${path}`, {
      headers: { authorization: bearer, ...headers },
    }),
  );
const json = async <T>(response: Response) => (await response.json()) as T;
interface Accepted {
  careerId: string;
  aggregateVersion: number;
  jobId?: string;
}

async function career(context: ReturnType<typeof setup>) {
  const { api, owner } = context;
  const created = await json<Accepted>(
    await send(api, owner, 'CreateCareer', 0, {
      managerName: 'Marcio',
      startDate: '2026-01-01',
    }),
  );
  const careerId = created.careerId;
  const selected = await send(api, owner, 'SelectClub', 1, {
    careerId,
    clubId: 'club_flamengo',
  });
  expect(selected.status).toBe(202);
  return careerId;
}

const stored = async (context: ReturnType<typeof setup>, careerId: string) =>
  (await context.postgres.careerSaveStore().peek(careerId))!;

describe('Durable Object por carreira (ADR 0014)', () => {
  it('roteia leituras e comandos da carreira para o objeto, com checagem de dono', async () => {
    const context = setup();
    const careerId = await career(context);
    // CreateCareer stays on Postgres; SelectClub ran in the object.
    expect(context.calls).toEqual(['POST /v1/commands']);
    const home = await read(
      context.api,
      context.owner,
      `/v1/careers/${careerId}/home`,
    );
    expect(home.status).toBe(200);
    expect(await json<{ aggregateVersion: number }>(home)).toMatchObject({
      aggregateVersion: 2,
    });
    expect(context.calls.at(-1)).toBe(`GET /v1/careers/${careerId}/home`);
    expect(
      (
        await read(
          context.api,
          context.stranger,
          `/v1/careers/${careerId}/home`,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await send(context.api, context.stranger, 'AutoPickLineup', 2, {
          careerId,
          clubId: 'club_flamengo',
          formation: '4-3-3',
          mode: 'best',
        })
      ).status,
    ).toBe(403);
    // Lists stay on Postgres and see the object's writes.
    const list = await read(context.api, context.owner, '/v1/careers');
    expect(context.calls.at(-1)).not.toBe('GET /v1/careers');
    expect(
      (await json<{ careers: { aggregateVersion: number }[] }>(list)).careers,
    ).toEqual([expect.objectContaining({ aggregateVersion: 2 })]);
    expect(careerOfRoute('/v1/commands', {}, { type: 'CreateCareer' })).toBe(
      undefined,
    );
  });

  it('serializa avanços simultâneos: uma rodada só', async () => {
    const context = setup();
    const careerId = await career(context);
    const [first, second] = await Promise.all([
      send(context.api, context.owner, 'AdvanceDate', 2, { careerId }),
      send(context.api, context.owner, 'AdvanceDate', 2, { careerId }),
    ]);
    expect([first.status, second.status].sort()).toEqual([202, 409]);
    const job = (await context.jobs.take())!;
    expect(await context.jobs.take()).toBeUndefined();
    // The queue may deliver the job twice at once; only one round is played.
    const statuses = await Promise.all([
      runJobInCareerObject(context.namespace, job),
      runJobInCareerObject(context.namespace, job),
    ]);
    expect(statuses.map(({ state }) => state)).toEqual([
      'succeeded',
      'succeeded',
    ]);
    const save = await stored(context, careerId);
    expect(save.version).toBe(4);
    const home = await json<{
      aggregateVersion: number;
      pendingActions: string[];
    }>(await read(context.api, context.owner, `/v1/careers/${careerId}/home`));
    expect(home.aggregateVersion).toBe(4);
    expect(home.pendingActions).not.toContain('simulation_pending');
  });

  it('aplica a idempotência por chave com recibos no storage do objeto', async () => {
    const context = setup();
    const careerId = await career(context);
    const payload = {
      careerId,
      clubId: 'club_flamengo',
      formation: '4-3-3',
      mode: 'best',
    };
    const first = await json<Accepted>(
      await send(
        context.api,
        context.owner,
        'AutoPickLineup',
        2,
        payload,
        'idem-key-repeat',
      ),
    );
    const again = await json<Accepted>(
      await send(
        context.api,
        context.owner,
        'AutoPickLineup',
        2,
        payload,
        'idem-key-repeat',
      ),
    );
    expect(again).toEqual(first);
    expect(first.aggregateVersion).toBe(3);
    expect((await stored(context, careerId)).version).toBe(3);
    expect(
      context.storages.get(careerId)!.values.has('receipt:idem-key-repeat'),
    ).toBe(true);
    // A restarted object still answers the retry from its storage.
    context.restart(careerId);
    expect(
      await json<Accepted>(
        await send(
          context.api,
          context.owner,
          'AutoPickLineup',
          2,
          payload,
          'idem-key-repeat',
        ),
      ),
    ).toEqual(first);
  });

  it('persiste o save enxuto no objeto e no Postgres e se recupera após reinício', async () => {
    const context = setup();
    const careerId = await career(context);
    await send(context.api, context.owner, 'AutoPickLineup', 2, {
      careerId,
      clubId: 'club_flamengo',
      formation: '4-3-3',
      mode: 'best',
    });
    const local = context.storages
      .get(careerId)!
      .values.get('save') as GameSave;
    const durable = await stored(context, careerId);
    expect(local.version).toBe(3);
    expect(local.checksum).toBe(durable.checksum);
    expect(durable.versions.schema).toBe('game-save-v3');
    expect(storedSize(local.snapshot)).toBeLessThan(200_000);
    context.restart(careerId);
    const squad = await json<{
      aggregateVersion: number;
      tactic: { formation: string };
    }>(await read(context.api, context.owner, `/v1/careers/${careerId}/squad`));
    expect(squad).toMatchObject({
      aggregateVersion: 3,
      tactic: { formation: '4-3-3' },
    });
    // Postgres ahead of the object's storage (written without the object):
    // the cold start notices the version and reloads from Postgres.
    await send(context.fallback, context.owner, 'AutoPickLineup', 3, {
      careerId,
      clubId: 'club_flamengo',
      formation: '3-5-2',
      mode: 'best',
    });
    context.restart(careerId);
    const reloaded = await json<{
      aggregateVersion: number;
      tactic: { formation: string };
    }>(await read(context.api, context.owner, `/v1/careers/${careerId}/squad`));
    expect(reloaded).toMatchObject({
      aggregateVersion: 4,
      tactic: { formation: '3-5-2' },
    });
  });

  it('serve todas as leituras da carreira sem mutar o agregado em memória', async () => {
    const context = setup();
    const careerId = await career(context);
    await send(context.api, context.owner, 'AdvanceDate', 2, { careerId });
    await runJobInCareerObject(context.namespace, (await context.jobs.take())!);
    for (const name of [
      'home',
      'squad',
      'office',
      'next-match',
      'standings',
      'tables',
      'post-match',
      'world',
      'competitions',
      'calendar',
      'next-season',
      'season',
      'market',
      'bundle',
    ]) {
      const response = await read(
        context.api,
        context.owner,
        `/v1/careers/${careerId}/${name}`,
      );
      expect([name, response.status]).toEqual([name, 200]);
    }
    const preview = await context.api(
      new Request(`${BASE}/v1/careers/${careerId}/match-preview`, {
        method: 'POST',
        headers: {
          authorization: context.owner,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ instructions: [] }),
      }),
    );
    expect(preview.status).toBe(200);
    expect((await stored(context, careerId)).version).toBe(4);
  });

  it('executa comandos da Fase 4 no objeto, na mesma versão do agregado', async () => {
    const context = setup();
    const careerId = await career(context);
    const ticket = await context.api(
      new Request(`${BASE}/v1/phase-four/commands`, {
        method: 'POST',
        headers: {
          authorization: context.owner,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          version: 1,
          careerId,
          commandId: 'command_ticket',
          idempotencyKey: 'idem-ticket',
          expectedVersion: 2,
          type: 'SetTicketPrice',
          payload: { clubId: 'club_flamengo', ticketPrice: 9_000 },
        }),
      }),
    );
    expect(ticket.status).toBe(200);
    expect(context.calls.at(-1)).toBe('POST /v1/phase-four/commands');
    expect((await stored(context, careerId)).version).toBe(3);
    const world = await json<{ club: { stadium: { ticketPrice: number } } }>(
      await read(context.api, context.owner, `/v1/careers/${careerId}/world`),
    );
    expect(world.club.stadium.ticketPrice).toBe(9_000);
  });

  it('arquiva pela carreira e responde a repetição pelo recibo', async () => {
    const context = setup();
    const careerId = await career(context);
    const remove = () =>
      send(
        context.api,
        context.owner,
        'DeleteCareer',
        2,
        { careerId },
        'idem-key-delete',
      );
    const first = await remove();
    expect(first.status).toBe(202);
    expect(
      await context.postgres.careerSaveStore().peek(careerId),
    ).toBeUndefined();
    expect(
      (await read(context.api, context.owner, `/v1/careers/${careerId}/home`))
        .status,
    ).toBe(404);
    expect((await remove()).status).toBe(202);
  });
});

describe('carreira nova: aquecimento do objeto e idas ao Postgres', () => {
  const createCareer = async (
    context: ReturnType<typeof setup>,
    key?: string,
  ) =>
    json<Accepted>(
      await send(
        context.api,
        context.owner,
        'CreateCareer',
        0,
        { managerName: 'Marcio', startDate: '2026-01-01' },
        key,
      ),
    );
  const selectClub = (context: ReturnType<typeof setup>, careerId: string) =>
    send(context.api, context.owner, 'SelectClub', 1, {
      careerId,
      clubId: 'club_flamengo',
    });

  it('avisa o Worker de cada CreateCareer aceito, inclusive repetição', async () => {
    const context = setup();
    const { careerId } = await createCareer(context, 'idem-key-create');
    expect(context.created).toEqual([careerId]);
    expect((await selectClub(context, careerId)).status).toBe(202);
    expect(context.created).toEqual([careerId]);
    expect((await createCareer(context, 'idem-key-create')).careerId).toBe(
      careerId,
    );
    expect(context.created).toEqual([careerId, careerId]);
  });

  it('sem aquecimento, o primeiro comando lê o save uma vez (sem checar versão antes)', async () => {
    const context = setup();
    const { careerId } = await createCareer(context);
    expect((await selectClub(context, careerId)).status).toBe(202);
    expect(context.storeCalls).toEqual(['peek', 'commit']);
  });

  it('aquecido, o SelectClub não recarrega a carreira do Postgres', async () => {
    const context = setup();
    const { careerId } = await createCareer(context);
    await warmCareerObject(context.namespace, careerId);
    expect(context.calls).toEqual(['POST /internal/careers/warm']);
    expect(context.storeCalls).toEqual(['peek']);
    expect(context.storages.get(careerId)!.values.get('save')).toMatchObject({
      id: careerId,
      version: 1,
    });
    expect((await selectClub(context, careerId)).status).toBe(202);
    expect(context.storeCalls).toEqual(['peek', 'commit']);
    // Warming an object that is already loaded touches nothing.
    await warmCareerObject(context.namespace, careerId);
    expect(context.storeCalls).toEqual(['peek', 'commit']);
    const home = await json<{ aggregateVersion: number }>(
      await read(context.api, context.owner, `/v1/careers/${careerId}/home`),
    );
    expect(home.aggregateVersion).toBe(2);
  });

  it('aquecimento e comando simultâneos: uma carga, comando aplicado', async () => {
    const context = setup();
    const { careerId } = await createCareer(context);
    const [, selected] = await Promise.all([
      warmCareerObject(context.namespace, careerId),
      selectClub(context, careerId),
    ]);
    expect(selected.status).toBe(202);
    expect(context.storeCalls).toEqual(['peek', 'commit']);
    expect((await stored(context, careerId)).version).toBe(2);
  });

  it('reiniciado depois do aquecimento, confere a versão e usa a cópia local', async () => {
    const context = setup();
    const { careerId } = await createCareer(context);
    await warmCareerObject(context.namespace, careerId);
    context.restart(careerId);
    expect((await selectClub(context, careerId)).status).toBe(202);
    expect(context.storeCalls).toEqual(['peek', 'versionOf', 'commit']);
  });

  it('aquecer carreira apagada não falha e ela segue invisível', async () => {
    const context = setup();
    const { careerId } = await createCareer(context);
    expect(
      (
        await send(context.api, context.owner, 'DeleteCareer', 1, {
          careerId,
        })
      ).status,
    ).toBe(202);
    context.restart(careerId);
    await warmCareerObject(context.namespace, careerId);
    expect(
      (await read(context.api, context.owner, `/v1/careers/${careerId}/home`))
        .status,
    ).toBe(404);
  });
});

describe('GET /v1/careers/:id/bundle', () => {
  for (const path of ['objeto', 'Postgres'] as const)
    it(`devolve a Central inteira com ETag e 304 (${path})`, async () => {
      const context = setup();
      const careerId = await career(context);
      const api = path === 'objeto' ? context.api : context.fallback;
      const url = `/v1/careers/${careerId}/bundle`;
      const first = await read(api, context.owner, url);
      expect(first.status).toBe(200);
      const etag = first.headers.get('etag')!;
      expect(etag).toBe('W/"bundle-1-2"');
      expect(first.headers.get('cache-control')).toBe('private, no-cache');
      const bundle = await json<Record<string, unknown>>(first);
      expect(Object.keys(bundle)).toEqual(
        expect.arrayContaining([
          'home',
          'squad',
          'nextMatch',
          'standings',
          'inbox',
          'contentVersion',
        ]),
      );
      expect(bundle).toMatchObject({ aggregateVersion: 2, careerId });
      const cached = await read(api, context.owner, url, {
        'if-none-match': etag,
      });
      expect(cached.status).toBe(304);
      expect(await cached.text()).toBe('');
      expect(cached.headers.get('etag')).toBe(etag);
      await send(api, context.owner, 'AutoPickLineup', 2, {
        careerId,
        clubId: 'club_flamengo',
        formation: '4-3-3',
        mode: 'best',
      });
      const changed = await read(api, context.owner, url, {
        'if-none-match': etag,
      });
      expect(changed.status).toBe(200);
      expect(changed.headers.get('etag')).toBe('W/"bundle-1-3"');
      expect(
        (await read(api, context.stranger, url, { 'if-none-match': etag }))
          .status,
      ).toBe(403);
    });
});

describe('local dos objetos de carreira', () => {
  it('pede o leste da América do Norte, perto do banco, em toda obtenção', async () => {
    const hints: (string | undefined)[] = [];
    const namespace: CareerObjectNamespace = {
      idFromName: (name) => name,
      get: (_id, options) => {
        hints.push(options?.locationHint);
        return {
          fetch: () => Promise.resolve(new Response(null, { status: 204 })),
        };
      },
    };
    await warmCareerObject(namespace, 'career_1');
    await careerForwarder(namespace)({
      request: new Request(
        'https://api.footebas.com.br/v1/careers/career_1/home',
      ),
      route: '/v1/careers/:id/home',
      params: { id: 'career_1' },
      body: undefined,
      rawBody: '',
      requestId: 'request_test',
    });
    expect(hints).toEqual([CAREER_OBJECT_LOCATION, CAREER_OBJECT_LOCATION]);
    expect(CAREER_OBJECT_LOCATION).toBe('enam');
  });
});
