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
import { buildBoard, lineupInput, placePlayer } from '@/lib/management-model';
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
  startDate?: string,
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
    ...(startDate ? { startDate } : {}),
    ...(session === 'dev'
      ? { devSession: true }
      : { getAccessToken: session(auth) }),
  });
}

async function start(startDate?: string) {
  const client = await server('dev', startDate);
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

  it('cria a carreira com nome e perfil e lê de volta na home e na listagem', async () => {
    const client = await server();
    await client.login('bia@footebas.com');
    const coachProfile = {
      nationality: 'PT',
      avatar: 'avatar-05',
      personality: 'disciplinador',
    } as const;
    await client.createCareer({
      coach: 'Bia',
      careerName: 'Projeto Bia',
      coachProfile,
    });
    await client.selectClub('Flamengo');
    const career = await client.getCareer();
    expect(career?.careerName).toBe('Projeto Bia');
    expect(career?.coachProfile).toEqual(coachProfile);
    const { careers } = await client.listCareers();
    expect(careers[0]).toEqual(
      expect.objectContaining({ name: 'Projeto Bia', coachProfile }),
    );
  });

  it('lista e reabre a carreira pela listagem do servidor', async () => {
    const { client } = await start();
    const { careers } = await client.listCareers();
    expect(careers).toEqual([
      expect.objectContaining({ coach: 'Marcio', clubName: 'Flamengo' }),
    ]);
    const reopened = await client.openCareer(careers[0]!.id);
    expect(reopened?.club).toBe('Flamengo');
    expect(reopened?.division).toBeTruthy();
    expect(reopened?.fixture?.competition).toBeTruthy();
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

  it('envia SetLineup com as posições dos slots e lê a escalação de volta', async () => {
    const { client, career } = await start();
    const board = buildBoard(career.players, career.formation);
    const benched = board.slots[1]!;
    const promoted = board.bench[0]!;
    const next = placePlayer(
      placePlayer(board, benched, { kind: 'bench' }),
      promoted,
      { kind: 'slot', index: 1 },
    );
    const input = lineupInput(next, career.players);
    expect(input.starters).toHaveLength(11);
    const saved = await client.setLineup(input);
    const byId = new Map(saved.players.map((player) => [player.id, player]));
    expect(byId.get(promoted)?.role).toBe('starter');
    expect(byId.get(promoted)?.lineupPosition).toBe(
      input.starters[1]!.position,
    );
    expect(byId.get(benched)?.role).toBe('bench');
    expect(saved.formation).toBe(input.formation);
    expect(saved.chemistry?.value).toBeGreaterThanOrEqual(0);
    expect(buildBoard(saved.players, saved.formation).slots).toEqual(
      next.slots,
    );
  });

  it('lê o mercado do servidor em reais, anuncia e retira um atleta', async () => {
    const { client, career } = await start();
    const market = await client.getMarket({
      origin: 'foreign',
      minStrength: 1,
    });
    expect(market.window.status).toBe('open');
    expect(market.window.nextOpensOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(market.club?.maxSquadSize).toBe(35);
    expect(market.club?.cash).toBeLessThan(1_000_000_000);
    expect(market.search.results.length).toBeGreaterThan(0);
    expect(market.search.results.every((r) => r.origin === 'foreign')).toBe(
      true,
    );
    const player = career.players.at(-1)!;
    const listed = await client.listForTransfer({
      playerId: player.id,
      mode: 'sale',
      askingPrice: 2_500_000,
    });
    expect(listed.listings).toEqual([
      expect.objectContaining({ playerId: player.id, askingPrice: 2_500_000 }),
    ]);
    const withdrawn = await client.withdrawListing(player.id);
    expect(withdrawn.listings).toEqual([]);
  });

  it('traduz janela fechada do servidor em mensagem em português', async () => {
    const { client } = await start('2026-03-10');
    const market = await client.getMarket({ minStrength: 1 });
    expect(market.window.status).toBe('closed');
    const target = market.search.results.find((r) => r.clubId)!;
    await expect(
      client.submitMarketOffer({
        playerId: target.id,
        kind: 'buy',
        fee: target.value,
        wage: target.wage,
      }),
    ).rejects.toMatchObject({
      code: 'TRANSFER_WINDOW_CLOSED',
      message: expect.stringMatching(/janela de transferências está fechada/i),
    });
  });

  it('lê o escritório, aceita um patrocínio e configura o sócio-torcedor', async () => {
    const { client } = await start();
    const office = await client.getOffice();
    expect(office.proposals.sponsorship.length).toBeGreaterThan(0);
    expect(office.membership?.priceRange).toEqual({ min: 5, max: 200 });
    expect(office.finances.month.period).toMatch(/^\d{4}-\d{2}$/);
    expect(office.coach.managerName).toBe('Marcio');
    const offer = office.proposals.sponsorship[0]!;
    const signed = await client.decideSponsorship(offer.id, 'accept');
    expect(signed.sponsorship.contract?.sponsorName).toBe(offer.sponsorName);
    expect(signed.sponsorship.contract?.monthlyValue).toBe(offer.monthlyValue);
    const configured = await client.configureMembership({
      monthlyPrice: 30,
      tier: 'premium',
    });
    expect(configured.membership?.monthlyPrice).toBe(30);
    expect(configured.membership?.tier).toBe('premium');
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
