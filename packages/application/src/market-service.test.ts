/* eslint-disable @typescript-eslint/no-non-null-assertion -- the launch catalog guarantees the clubs and players picked here */
import { InMemoryUnitOfWork } from '@footebas/database';
import {
  clubCashBalance,
  isKeyPlayer,
  sellerAskingPrice,
  type Player,
} from '@footebas/domain';
import { describe, expect, it } from 'vitest';
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
  TransferMarketError,
  UnifiedPhaseFourRepository,
  catalogCareerContent,
  type PhaseFourState,
} from './index.js';

const MANAGED = 'club_flamengo';

function setup() {
  const clock = new FakeClock();
  const auth = new FakeBearerAuth();
  const unitOfWork = new InMemoryUnitOfWork(clock);
  const ids = new SequentialIdGenerator();
  const app = new FootebasApplication({
    auth,
    clock,
    ids,
    jobs: new InMemoryJobQueue(),
    storage: new InMemoryStorage(),
    telemetry: new NoopTelemetry(),
    unitOfWork,
  });
  const repository = new UnifiedPhaseFourRepository(unitOfWork);
  const world = new PhaseFourApplicationService({
    repository,
    archives: new InMemoryArchiveStorage(),
    clock,
    ids,
    random: new Mulberry32RandomFactory(),
  });
  const token = auth.issue({
    userId: 'user_owner',
    email: 'owner@example.com',
    displayName: 'Owner',
  });
  return { app, world, repository, token };
}
type Setup = ReturnType<typeof setup>;

let sequence = 0;
const envelope = (type: string, expectedVersion: number, payload: object) => {
  sequence += 1;
  return {
    version: 1 as const,
    type,
    commandId: `command_market_${String(sequence)}`,
    idempotencyKey: `idem-market-${String(sequence)}`,
    expectedVersion,
    payload,
  };
};

async function start(
  { app, token }: Setup,
  startDate = '2026-01-01',
  personality?: string,
) {
  const created = await app.execute(
    token,
    envelope('CreateCareer', 0, {
      managerName: 'Marcio',
      startDate,
      ...(personality === undefined
        ? {}
        : {
            coach: { nationality: 'BR', avatar: 'avatar-01', personality },
          }),
    }),
  );
  await app.execute(
    token,
    envelope('SelectClub', 1, {
      careerId: created.careerId,
      clubId: MANAGED,
    }),
  );
  return created.careerId;
}

async function command(
  { app, world, token }: Setup,
  careerId: string,
  type: string,
  payload: object,
) {
  const { aggregateVersion } = await app.home(token, careerId);
  return world.execute('user_owner', {
    ...envelope(type, aggregateVersion, payload),
    careerId,
  });
}

async function advance({ app, token }: Setup, careerId: string) {
  const home = await app.home(token, careerId);
  await app.execute(
    token,
    envelope('AutoPickLineup', home.aggregateVersion, {
      careerId,
      clubId: MANAGED,
      formation: '4-4-2',
      mode: 'best',
    }),
  );
  await app.execute(
    token,
    envelope('AdvanceDate', home.aggregateVersion + 1, { careerId }),
  );
  return app.runNextJob();
}

const totalCash = (state: PhaseFourState) =>
  state.clubs.reduce(
    (sum, club) =>
      sum + Number(clubCashBalance(state.ledger, club.id, club.balance)),
    0,
  );
const cashOf = (state: PhaseFourState, clubId: string) => {
  const club = state.clubs.find(({ id }) => id === clubId)!;
  return Number(clubCashBalance(state.ledger, club.id, club.balance));
};

/** Cheapest reserve of an AI club that can still sell (squad above 22). */
function sellable(
  state: PhaseFourState,
  skip: ReadonlySet<string> = new Set(),
) {
  const squads = new Map<string, Player[]>();
  for (const player of state.players)
    if (player.clubId !== undefined && player.clubId !== MANAGED)
      squads.set(player.clubId, [...(squads.get(player.clubId) ?? []), player]);
  return [...squads.entries()]
    .filter(([, squad]) => squad.length > 23)
    .flatMap(([clubId, squad]) =>
      squad
        .filter((player) => !isKeyPlayer(player, squad) && !skip.has(player.id))
        .map((player) => ({ player, clubId, squad })),
    )
    .sort(
      (left, right) =>
        Number(left.player.value) - Number(right.player.value) ||
        left.player.id.localeCompare(right.player.id),
    );
}

function askingPrice(
  state: PhaseFourState,
  target: ReturnType<typeof sellable>[number],
  priceFactor = 1,
) {
  return Number(
    sellerAskingPrice({
      player: target.player,
      sellerSquad: target.squad,
      sellerReputation: Number(
        state.clubs.find(({ id }) => id === target.clubId)!.reputation,
      ),
      contractEndsOn: state.contracts.find(
        ({ playerId, status }) =>
          playerId === target.player.id && status === 'active',
      )?.endsOn,
      onDate: state.currentDate,
      priceFactor,
    }),
  );
}

const buy = (target: ReturnType<typeof sellable>[number], fee: number) => ({
  playerId: target.player.id,
  fromClubId: target.clubId,
  toClubId: MANAGED,
  kind: 'buy',
  fee,
  wage: Number(target.player.salary),
  expiresOn: '2026-02-10',
});

describe('mercado da carreira (docs/adr/0008)', () => {
  it('fecha a pré-temporada antes do Brasileirão começar', () => {
    const leagues = catalogCareerContent.load().competitions.nationalLeagues;
    const firstLeagueDay = Math.min(...leagues.map((l) => l.firstMatchDay));
    const opening = new Date(Date.UTC(2026, 0, 1 + firstLeagueDay))
      .toISOString()
      .slice(0, 10);
    expect(opening).toBe('2026-02-18');
  });

  it('fora da janela recusa negócios entre clubes; renovação e agente livre seguem', async () => {
    const context = setup();
    const careerId = await start(context, '2026-03-01');
    const market = await context.app.careerMarket(context.token, careerId);
    expect(market.window).toMatchObject({
      status: 'closed',
      next: { id: 'mid_season', opensOn: '2026-04-17' },
    });
    const state = (await context.repository.load(careerId))!;
    const [target] = sellable(state);
    for (const kind of ['buy', 'loan'] as const) {
      const refusal = await command(context, careerId, 'SubmitTransferOffer', {
        ...buy(target!, Number(target!.player.value) * 3),
        kind,
        expiresOn: '2026-03-10',
        ...(kind === 'loan'
          ? { loan: { endsOn: '2026-06-30', wageSharePercentage: 50 } }
          : {}),
      }).catch((error: unknown) => error);
      expect(refusal).toBeInstanceOf(TransferMarketError);
      expect(
        (refusal as TransferMarketError).toApiError('request_1'),
      ).toMatchObject({
        code: 'TRANSFER_WINDOW_CLOSED',
        nextWindowOpensOn: '2026-04-17',
      });
    }
    const contract = state.contracts.find(
      ({ clubId, status }) => clubId === MANAGED && status === 'active',
    )!;
    const renewal = await command(context, careerId, 'RenewPlayerContract', {
      contractId: contract.id,
      wage: Number(contract.wage) * 3,
      endsOn: '2030-12-31',
    });
    expect(renewal.outcome).toBe('applied');
    const reserve = [...state.players]
      .filter(({ clubId }) => clubId === MANAGED)
      .sort(
        (left, right) => Number(left.strength) - Number(right.strength),
      )[0]!;
    await command(context, careerId, 'TerminatePlayerContract', {
      contractId: state.contracts.find(
        ({ playerId, status }) =>
          playerId === reserve.id && status === 'active',
      )!.id,
    });
    const freeAgent = await command(context, careerId, 'SubmitTransferOffer', {
      playerId: reserve.id,
      toClubId: MANAGED,
      kind: 'buy',
      fee: 0,
      wage: Number(reserve.salary),
      expiresOn: '2026-03-10',
    });
    expect(['applied', 'refused']).toContain(freeAgent.outcome);
  });

  it('compra na janela: IA aceita pelo preço, contrapropõe perto dele e o dinheiro só muda de clube', async () => {
    const context = setup();
    const careerId = await start(context);
    const before = (await context.repository.load(careerId))!;
    const [first] = sellable(before);
    const accepted = await command(context, careerId, 'SubmitTransferOffer', {
      ...buy(first!, askingPrice(before, first!)),
    });
    expect(accepted.outcome).toBe('applied');
    const afterBuy = (await context.repository.load(careerId))!;
    expect(
      afterBuy.players.find(({ id }) => id === first!.player.id)?.clubId,
    ).toBe(MANAGED);
    expect(totalCash(afterBuy)).toBe(totalCash(before));
    expect(
      cashOf(afterBuy, first!.clubId) - cashOf(before, first!.clubId),
    ).toBe(askingPrice(before, first!));
    for (const entry of afterBuy.ledger.entries)
      expect(entry.postings.reduce((sum, { amount }) => sum + amount, 0)).toBe(
        0,
      );

    const [second] = sellable(afterBuy);
    const low = Math.floor(askingPrice(afterBuy, second!) * 0.8);
    const countered = await command(context, careerId, 'SubmitTransferOffer', {
      ...buy(second!, low),
    });
    expect(countered.outcome).toBe('applied');
    const market = await context.app.careerMarket(context.token, careerId);
    const counter = market.offersSent.find(
      (offer) =>
        offer.playerId === second!.player.id && offer.status === 'pending',
    )!;
    expect(counter).toMatchObject({
      awaiting: 'manager',
      fee: askingPrice(afterBuy, second!),
    });
    const inbox = (await context.app.home(context.token, careerId)).inbox;
    expect(
      inbox.find(({ decision }) => decision?.offerId === counter.id),
    ).toMatchObject({
      kind: 'transfer_offer',
      decision: { options: ['accept', 'reject'] },
    });
    await command(context, careerId, 'DecideTransferOffer', {
      offerId: counter.id,
      decision: 'accept',
    });
    const done = (await context.repository.load(careerId))!;
    expect(
      done.players.find(({ id }) => id === second!.player.id)?.clubId,
    ).toBe(MANAGED);
    expect(totalCash(done)).toBe(totalCash(before));
  });

  it('o Diplomata paga 5% menos: a mesma oferta é aceita por ele e contraproposta ao Estrategista', async () => {
    const outcomes: string[] = [];
    for (const personality of ['diplomata', 'estrategista']) {
      const context = setup();
      const careerId = await start(context, '2026-01-01', personality);
      const state = (await context.repository.load(careerId))!;
      const [target] = sellable(state);
      await command(context, careerId, 'SubmitTransferOffer', {
        ...buy(target!, Math.floor(askingPrice(state, target!) * 0.96)),
      });
      const events = (await context.repository.load(careerId))!.events.map(
        ({ type }) => type,
      );
      outcomes.push(
        events.includes('TRANSFER_COMPLETED') ? 'accepted' : events.at(-1)!,
      );
    }
    expect(outcomes).toEqual(['accepted', 'TRANSFER_COUNTERED']);
  });

  it('recusa passar de 35 atletas no elenco gerido', async () => {
    const context = setup();
    const careerId = await start(context);
    const bought = new Set<string>();
    for (let attempt = 0; attempt < 40; attempt++) {
      const state = (await context.repository.load(careerId))!;
      const size = state.players.filter(
        ({ clubId }) => clubId === MANAGED,
      ).length;
      const [target] = sellable(state, bought);
      if (size >= 35) {
        const refusal = await command(
          context,
          careerId,
          'SubmitTransferOffer',
          {
            ...buy(target!, askingPrice(state, target!)),
          },
        ).catch((error: unknown) => error);
        expect((refusal as TransferMarketError).contractCode).toBe(
          'SQUAD_LIMIT_REACHED',
        );
        break;
      }
      bought.add(target!.player.id);
      await command(context, careerId, 'SubmitTransferOffer', {
        ...buy(target!, askingPrice(state, target!)),
      });
    }
    expect(bought.size).toBeGreaterThan(0);
  });

  it(
    'vende e empresta o próprio elenco: lista, recebe propostas na caixa de entrada, aceita e contrapropõe',
    { timeout: 120_000 },
    async () => {
      const context = setup();
      const careerId = await start(context);
      const initial = (await context.repository.load(careerId))!;
      const reserves = initial.players
        .filter(({ clubId }) => clubId === MANAGED)
        .sort(
          (left, right) =>
            Number(left.strength) - Number(right.strength) ||
            left.id.localeCompare(right.id),
        )
        .slice(0, 6);
      for (const player of reserves.slice(0, 4))
        await command(context, careerId, 'ListPlayerForTransfer', {
          playerId: player.id,
          mode: 'sale',
          askingPrice: Number(player.value),
        });
      for (const player of reserves.slice(4))
        await command(context, careerId, 'ListPlayerForTransfer', {
          playerId: player.id,
          mode: 'loan',
          durationMonths: 3,
          wageSharePercentage: 60,
        });
      let market = await context.app.careerMarket(context.token, careerId);
      expect(market.listings).toHaveLength(6);
      await command(context, careerId, 'WithdrawTransferListing', {
        playerId: reserves[3]!.id,
      });
      market = await context.app.careerMarket(context.token, careerId);
      expect(market.listings.map(({ playerId }) => playerId)).not.toContain(
        reserves[3]!.id,
      );

      const pendingSales = () =>
        market.offersReceived.filter(
          ({ awaiting, kind }) => awaiting === 'manager' && kind === 'buy',
        );
      const pendingLoans = () =>
        market.offersReceived.filter(
          ({ awaiting, kind }) => awaiting === 'manager' && kind === 'loan',
        );
      for (let step = 0; step < 12; step++) {
        if (pendingSales().length >= 3 && pendingLoans().length >= 1) break;
        expect((await advance(context, careerId))?.state).toBe('succeeded');
        market = await context.app.careerMarket(context.token, careerId);
        expect(market.window.status).toBe('open');
      }
      expect(pendingSales().length).toBeGreaterThanOrEqual(3);
      expect(pendingLoans().length).toBeGreaterThanOrEqual(1);

      const home = await context.app.home(context.token, careerId);
      const mail = home.inbox.find(
        ({ decision }) => decision?.offerId === pendingSales()[0]!.id,
      );
      expect(mail).toMatchObject({
        kind: 'transfer_offer',
        decision: { options: ['accept', 'reject', 'counter'] },
      });

      // Accept: the player leaves and the fee lands in the managed cash.
      const [sale, counterAccepted, counterRejected] = pendingSales();
      const beforeSale = (await context.repository.load(careerId))!;
      await command(context, careerId, 'DecideTransferOffer', {
        offerId: sale!.id,
        decision: 'accept',
      });
      const afterSale = (await context.repository.load(careerId))!;
      expect(
        afterSale.players.find(({ id }) => id === sale!.playerId)?.clubId,
      ).toBe(sale!.counterpartClubId);
      expect(cashOf(afterSale, MANAGED) - cashOf(beforeSale, MANAGED)).toBe(
        sale!.fee,
      );
      expect(totalCash(afterSale)).toBe(totalCash(beforeSale));
      expect(
        afterSale.market?.listings.map(({ playerId }) => playerId),
      ).not.toContain(sale!.playerId);

      // Counter at the bid: the AI bidder accepts at once.
      await command(context, careerId, 'CounterTransferOffer', {
        offerId: counterAccepted!.id,
        fee: counterAccepted!.fee,
        wage: counterAccepted!.wage,
        expiresOn: counterAccepted!.expiresOn,
      });
      const afterCounter = (await context.repository.load(careerId))!;
      expect(
        afterCounter.players.find(({ id }) => id === counterAccepted!.playerId)
          ?.clubId,
      ).toBe(counterAccepted!.counterpartClubId);

      // Counter far above value: the AI bidder walks away.
      await command(context, careerId, 'CounterTransferOffer', {
        offerId: counterRejected!.id,
        fee: counterRejected!.fee * 10 + 1,
        wage: counterRejected!.wage,
        expiresOn: counterRejected!.expiresOn,
      });
      const afterRefusal = (await context.repository.load(careerId))!;
      expect(
        afterRefusal.players.find(({ id }) => id === counterRejected!.playerId)
          ?.clubId,
      ).toBe(MANAGED);
      expect(afterRefusal.events.at(-1)).toMatchObject({
        type: 'TRANSFER_REJECTED',
        payload: { decisionSource: 'club_ai' },
      });

      // Loan: the borrower takes the player and 60% of his wage.
      const loan = pendingLoans()[0]!;
      const wageBefore = (
        await context.app.careerMarket(context.token, careerId)
      ).club!.monthlyWageBill;
      await command(context, careerId, 'DecideTransferOffer', {
        offerId: loan.id,
        decision: 'accept',
      });
      market = await context.app.careerMarket(context.token, careerId);
      expect(market.loans).toEqual([
        expect.objectContaining({
          playerId: loan.playerId,
          direction: 'out',
          counterpartClubId: loan.counterpartClubId,
        }),
      ]);
      expect(wageBefore - market.club!.monthlyWageBill).toBe(
        Math.round((loan.wage * 60) / 100),
      );
      const afterLoan = (await context.repository.load(careerId))!;
      expect(totalCash(afterLoan)).toBe(totalCash(afterRefusal));
    },
  );
});
