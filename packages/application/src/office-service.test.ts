/* eslint-disable @typescript-eslint/no-non-null-assertion -- the launch catalog guarantees the selected club */
import { InMemoryUnitOfWork } from '@footebas/database';
import { describe, expect, it } from 'vitest';
import {
  FakeBearerAuth,
  FakeClock,
  FootebasApplication,
  InMemoryJobQueue,
  InMemoryStorage,
  NoopTelemetry,
  SequentialIdGenerator,
} from './index.js';

function setup() {
  const clock = new FakeClock();
  const auth = new FakeBearerAuth();
  const app = new FootebasApplication({
    auth,
    clock,
    ids: new SequentialIdGenerator(),
    jobs: new InMemoryJobQueue(),
    storage: new InMemoryStorage(),
    telemetry: new NoopTelemetry(),
    unitOfWork: new InMemoryUnitOfWork(clock),
  });
  const token = auth.issue({
    userId: 'user_owner',
    email: 'owner@example.com',
    displayName: 'Owner',
  });
  return { app, token };
}

let sequence = 0;
const command = (type: string, expectedVersion: number, payload: object) => {
  sequence += 1;
  return {
    version: 1,
    type,
    commandId: `command_office_${String(sequence)}`,
    idempotencyKey: `idem-office-${String(sequence)}`,
    expectedVersion,
    payload,
  };
};

async function start(app: FootebasApplication, token: string) {
  const created = await app.execute(
    token,
    command('CreateCareer', 0, {
      managerName: 'Marcio',
      startDate: '2026-01-01',
    }),
  );
  await app.execute(
    token,
    command('SelectClub', 1, {
      careerId: created.careerId,
      clubId: 'club_flamengo',
    }),
  );
  return created.careerId;
}

async function version(app: FootebasApplication, token: string, id: string) {
  return (await app.home(token, id)).aggregateVersion;
}

describe('Escritório: patrocínio, sócio-torcedor e entrosamento na carreira', () => {
  it('propostas chegam na caixa de entrada e o escritório mostra tudo', async () => {
    const { app, token } = setup();
    const careerId = await start(app, token);
    const office = await app.careerOffice(token, careerId);
    expect(office.proposals.sponsorship).toHaveLength(3);
    expect(
      office.proposals.sponsorship.every(
        ({ status, decisionId }) => status === 'pending' && decisionId,
      ),
    ).toBe(true);
    expect(office.sponsorship.contract).toBeUndefined();
    expect(office.sponsorship.fallbackMonthly).toBeGreaterThan(0);
    expect(office.membership).toMatchObject({ tier: 'intermediate' });
    expect(office.membership!.members).toBeGreaterThan(0);
    expect(office.coach.appointments[0]).toMatchObject({
      clubId: 'club_flamengo',
    });
    expect(office.contracts.length).toBeGreaterThanOrEqual(18);
    const home = await app.home(token, careerId);
    const mails = home.inbox.filter(({ kind }) => kind === 'sponsor_offer');
    expect(mails).toHaveLength(3);
    expect(mails[0]!.decision?.options).toEqual([
      'accept',
      'reject',
      'counter',
    ]);
    expect(home.chemistry).toMatchObject({ value: 50, matches: 0 });
  });

  it('decide, contrapropõe e configura pelo envelope de comandos', async () => {
    const { app, token } = setup();
    const careerId = await start(app, token);
    const [first, second] = (await app.careerOffice(token, careerId)).proposals
      .sponsorship;
    await expect(
      app.execute(
        token,
        command(
          'CounterSponsorshipOffer',
          await version(app, token, careerId),
          {
            careerId,
            offerId: first!.id,
            monthlyValue: first!.counterRange!.max + 1,
          },
        ),
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await app.execute(
      token,
      command('DecideSponsorshipOffer', await version(app, token, careerId), {
        careerId,
        offerId: second!.id,
        decision: 'accept',
      }),
    );
    await app.execute(
      token,
      command('ConfigureFanMembership', await version(app, token, careerId), {
        careerId,
        monthlyPrice: 3_500,
        tier: 'premium',
      }),
    );
    const office = await app.careerOffice(token, careerId);
    expect(office.sponsorship.contract).toMatchObject({
      offerId: second!.id,
      monthlyValue: second!.monthlyValue,
      status: 'active',
    });
    expect(office.sponsorship.fallbackMonthly).toBe(0);
    expect(
      office.proposals.sponsorship.find(({ id }) => id === first!.id)?.status,
    ).toBe('superseded');
    expect(office.membership).toMatchObject({
      monthlyPrice: 3_500,
      tier: 'premium',
    });
    await expect(
      app.execute(
        token,
        command('DecideSponsorshipOffer', await version(app, token, careerId), {
          careerId,
          offerId: first!.id,
          decision: 'accept',
        }),
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(
      (await app.home(token, careerId)).inbox.filter(
        ({ kind }) => kind === 'sponsor_offer',
      ),
    ).toHaveLength(0);
  });

  it(
    'liquida o contrato e o sócio-torcedor no mês e soma entrosamento',
    { timeout: 120_000 },
    async () => {
      const { app, token } = setup();
      const careerId = await start(app, token);
      const offer = (await app.careerOffice(token, careerId)).proposals
        .sponsorship[0]!;
      await app.execute(
        token,
        command('DecideSponsorshipOffer', await version(app, token, careerId), {
          careerId,
          offerId: offer.id,
          decision: 'accept',
        }),
      );
      for (let step = 0; step < 12; step++) {
        const current = await version(app, token, careerId);
        await app.execute(
          token,
          command('AutoPickLineup', current, {
            careerId,
            clubId: 'club_flamengo',
            formation: '4-4-2',
            mode: 'best',
          }),
        );
        await app.execute(
          token,
          command('AdvanceDate', current + 1, { careerId }),
        );
        expect((await app.runNextJob())?.state).toBe('succeeded');
        if ((await app.home(token, careerId)).currentDate >= '2026-02-15')
          break;
      }
      const office = await app.careerOffice(token, careerId);
      expect(office.finances.month.period).toBe('2026-01');
      expect(office.finances.month.income.sponsor).toBe(offer.monthlyValue);
      expect(office.finances.month.income.membership).toBeGreaterThan(0);
      expect(office.finances.month.expenses.membership).toBeGreaterThan(0);
      expect(office.finances.month.expenses.wages).toBe(
        office.club!.monthlyWageBill,
      );
      expect(office.finances.season.totalIncome).toBeGreaterThanOrEqual(
        office.finances.month.totalIncome,
      );
      const world = await app.careerWorld(token, careerId);
      expect(world.ledger.map(({ kind }) => kind)).toContain('membership');
      const squad = await app.squad(token, careerId);
      expect(squad.chemistry!.matches).toBeGreaterThan(0);
      expect(squad.chemistry!.bonusPercent).toBeLessThanOrEqual(3);
      expect(office.chemistry).toEqual(squad.chemistry);
    },
  );
});
