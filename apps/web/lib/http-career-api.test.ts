// @vitest-environment node
import { buildApi } from '@footebas/api';
import {
  FakeBearerAuth,
  FakeClock,
  FootebasApplication,
  InMemoryArchiveStorage,
  InMemoryJobQueue,
  InMemoryStorage,
  Mulberry32RandomFactory,
  NoopTelemetry,
  PhaseFourApplicationService,
  SequentialIdGenerator,
  UnifiedPhaseFourRepository,
} from '@footebas/application';
import { InMemoryUnitOfWork } from '@footebas/database';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeAuth } from '@/lib/fake-auth';
import {
  HttpCareerApi,
  httpCompetitionPort,
  NotSupportedYetError,
  SessionExpiredError,
  type AccessTokenProvider,
} from '@/lib/http-career-api';

const open: { close(): Promise<unknown> }[] = [];
afterEach(async () => {
  await Promise.all(open.splice(0).map((api) => api.close()));
});

/** The real API in-process; fetch goes through Fastify inject. */
async function server(
  session: 'dev' | ((auth: FakeBearerAuth) => AccessTokenProvider) = 'dev',
) {
  const clock = new FakeClock();
  const auth = new FakeBearerAuth();
  const ids = new SequentialIdGenerator();
  const jobs = new InMemoryJobQueue();
  const unitOfWork = new InMemoryUnitOfWork(clock);
  const application = new FootebasApplication({
    auth,
    clock,
    ids,
    jobs,
    storage: new InMemoryStorage(),
    telemetry: new NoopTelemetry(),
    unitOfWork,
  });
  const phaseFour = new PhaseFourApplicationService({
    repository: new UnifiedPhaseFourRepository(unitOfWork),
    archives: new InMemoryArchiveStorage(),
    clock,
    ids,
    random: new Mulberry32RandomFactory(),
  });
  const api = await buildApi({
    application,
    jobs,
    phaseFour: { application: phaseFour, auth },
    devAuth: auth,
  });
  open.push(api);
  const fetchVia: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname.startsWith('/v1/jobs/'))
      while ((await application.runNextJob()) !== undefined);
    const response = await api.inject({
      method: (init?.method ?? 'GET') as 'GET' | 'POST',
      url: `${url.pathname}${url.search}`,
      headers: init?.headers as Record<string, string>,
      ...(typeof init?.body === 'string' ? { payload: init.body } : {}),
    });
    return new Response(response.body, {
      status: response.statusCode,
      headers: { 'content-type': 'application/json' },
    });
  };
  return new HttpCareerApi({
    baseUrl: 'http://api.test',
    fetch: fetchVia,
    jobPollMs: 0,
    ...(session === 'dev'
      ? { devSession: true }
      : { getAccessToken: session(auth) }),
  });
}

async function start() {
  const client = await server();
  await client.login('marcio@footebas.com');
  await client.createCareer({ coach: 'Marcio' });
  await client.selectClub('Flamengo');
  const career = await client.getCareer();
  if (!career) throw new Error('career missing');
  return { client, career };
}

describe('HttpCareerApi contra a API autoritativa', { timeout: 60_000 }, () => {
  it('monta a carreira com elenco real, adversário e mundo do servidor', async () => {
    const { career } = await start();
    expect(career.club).toBe('Flamengo');
    expect(career.players.length).toBeGreaterThanOrEqual(18);
    expect(
      career.players.filter(({ role }) => role === 'starter'),
    ).toHaveLength(11);
    expect(career.players.some(({ shirt }) => shirt > 0)).toBe(true);
    expect(career.opponent.report).toMatch(/Carioca/);
    expect(career.world.finances.wageBill).toBeGreaterThan(0);
    expect(career.world.board.objective).not.toBe('Sem objetivo definido');
    expect(career.world.market.length).toBeGreaterThan(0);
  });

  it('joga a partida com pausa técnica sem reescrever o que já passou', async () => {
    const { client, career } = await start();
    const shown = [await client.beginMatch()];
    while (!shown.at(-1)!.decisionPoint)
      shown.push(await client.nextMatchEvent());
    const starter = career.players.find(
      ({ role, primaryPosition }) =>
        role === 'starter' && primaryPosition === 'ATA',
    )!;
    const bench = career.players.find(({ role }) => role === 'bench')!;
    const pause = await client.makeSubstitution({
      outgoingId: starter.id,
      incomingId: bench.id,
    });
    expect(pause.id).toBe(shown.at(-1)!.id);
    let update = pause;
    while (!update.done) update = await client.nextMatchEvent();
    const final = update.score;
    const after = await client.finishMatch();
    expect(after.lastResult?.score).toBe(final);
    expect(after.lastResult?.actions[0]?.type).toBe('substitution');
    expect(after.lastResult?.replay?.timeline.length).toBeGreaterThan(0);
    for (const event of shown)
      expect(after.lastResult?.events.map(({ message }) => message)).toContain(
        event.message,
      );
  });

  it('dá resultado instantâneo e aplica comandos do mundo na mesma versão', async () => {
    const { client } = await start();
    const played = await client.instantResult();
    expect(played.lastResult?.score).toMatch(/\d+ × \d+/);
    const priced = await client.setTicketPrice(90);
    expect(priced.world.stadium.ticketPrice).toBe(90);
    await expect(client.maintainStadium()).rejects.toBeInstanceOf(
      NotSupportedYetError,
    );
  });

  it('carrega pirâmide, calendário e transição para as telas de competição', async () => {
    const { client } = await start();
    const view = await httpCompetitionPort(client).load();
    expect(view.divisions.map(({ name }) => name)).toEqual([
      'Brasileirão Série A',
      'Brasileirão Série B',
      'Brasileirão Série C',
    ]);
    expect(view.cups.some(({ name }) => name === 'Copa Libertadores')).toBe(
      true,
    );
    expect(view.calendar.entries.length).toBeGreaterThan(38);
    expect(view.nextSeason.status).toBe('pending');
  });
});

describe('HttpCareerApi com provedor de token', () => {
  it('usa o bearer do provedor contra a API real', async () => {
    const client = await server((auth) => {
      const token = auth.issue({
        userId: 'user_supabase',
        email: 'ana@footebas.com',
        displayName: 'Ana',
      });
      return async () => token;
    });
    await client.login('ignorado');
    await client.createCareer({ coach: 'Ana' });
    await client.selectClub('Flamengo');
    expect((await client.getCareer())?.club).toBe('Flamengo');
  }, 60_000);

  it('envia o bearer em toda chamada e renova uma vez após 401', async () => {
    const auth = new FakeAuth({
      user: { id: 'u1', email: 'a@b.com' },
      token: 'token-velho',
    });
    const seen: (string | null)[] = [];
    const fetchMock: typeof fetch = async (_input, init) => {
      const header = new Headers(init?.headers).get('authorization');
      seen.push(header);
      if (header === 'Bearer token-velho') {
        auth.signIn({ id: 'u1', email: 'a@b.com' }, 'token-novo');
        return new Response(JSON.stringify({ code: 'UNAUTHORIZED' }), {
          status: 401,
        });
      }
      return new Response(JSON.stringify({ careers: [] }), { status: 200 });
    };
    const client = new HttpCareerApi({
      baseUrl: 'http://api.test',
      fetch: fetchMock,
      getAccessToken: (options) => auth.getAccessToken(options),
    });
    expect(await client.getCareer()).toBeNull();
    expect(seen).toEqual(['Bearer token-velho', 'Bearer token-novo']);
    expect(auth.calls.refreshes).toBe(1);
  });

  it('sinaliza sessão expirada quando a renovação também falha', async () => {
    const onSessionExpired = vi.fn();
    const provider = vi.fn<AccessTokenProvider>(async () => 'token-recusado');
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response('', { status: 401 }),
    );
    const client = new HttpCareerApi({
      baseUrl: 'http://api.test',
      fetch: fetchMock,
      getAccessToken: provider,
      onSessionExpired,
    });
    await expect(client.getCareer()).rejects.toBeInstanceOf(
      SessionExpiredError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(provider).toHaveBeenLastCalledWith({ forceRefresh: true });
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('só oferece a sessão dev quando habilitada', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const client = new HttpCareerApi({
      baseUrl: 'http://api.test',
      fetch: fetchMock,
    });
    await expect(client.login('a@b.com')).rejects.toThrow(
      /entre com sua conta/i,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
