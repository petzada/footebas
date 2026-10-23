// Round trips of CreateCareer and of the locked-career guard (latency): the
// plan is read alongside the transaction / the creation order, never after.
import {
  InMemoryUnitOfWork,
  type IdempotentOptions,
  type TransactionContext,
  type UnitOfWork,
} from '@footebas/database';
import type { CanonicalValue } from '@footebas/domain';
import { describe, expect, it } from 'vitest';
import {
  FakeBearerAuth,
  FakeClock,
  FootebasApplication,
  InMemoryJobQueue,
  InMemoryStorage,
  NoopTelemetry,
  SequentialIdGenerator,
  type CareerSlotsPort,
  type Entitlements,
  type EntitlementsPort,
} from './index.js';

const FREE: Entitlements = { plan: 'free', maxCareers: 1, anyClub: false };
const LICENSED: Entitlements = {
  plan: 'licensed',
  maxCareers: 5,
  anyClub: true,
};

const command = (
  type: string,
  commandId: string,
  expectedVersion: number,
  payload: object,
) => ({
  version: 1,
  type,
  commandId,
  idempotencyKey: `idem-${commandId}`,
  expectedVersion,
  payload,
});
const create = (id: string) =>
  command('CreateCareer', id, 0, {
    managerName: 'Marcio',
    startDate: '2026-01-01',
  });

/** Records what the unit of work is asked (options) and when work starts. */
class RecordingUnitOfWork implements UnitOfWork {
  public readonly options: (IdempotentOptions | undefined)[] = [];
  public readonly events: string[];
  public constructor(
    private readonly inner: UnitOfWork,
    events: string[],
  ) {
    this.events = events;
  }
  public withCareerLock<T>(
    careerId: string,
    work: (tx: TransactionContext) => Promise<T>,
  ): Promise<T> {
    return this.inner.withCareerLock(careerId, work);
  }
  public executeIdempotent<T extends CanonicalValue>(
    careerId: string,
    commandId: string,
    work: (tx: TransactionContext) => Promise<T>,
    options?: IdempotentOptions,
  ): Promise<T> {
    this.options.push(options);
    this.events.push('transaction');
    return this.inner.executeIdempotent(careerId, commandId, (tx) => {
      this.events.push('work');
      return work(tx);
    });
  }
}

function setup(
  entitlements: EntitlementsPort,
  careerSlots?: CareerSlotsPort,
  events: string[] = [],
) {
  const clock = new FakeClock();
  const auth = new FakeBearerAuth();
  const unitOfWork = new RecordingUnitOfWork(
    new InMemoryUnitOfWork(clock),
    events,
  );
  const app = new FootebasApplication({
    auth,
    clock,
    ids: new SequentialIdGenerator(),
    jobs: new InMemoryJobQueue(),
    storage: new InMemoryStorage(),
    telemetry: new NoopTelemetry(),
    unitOfWork,
    entitlements,
    ...(careerSlots === undefined ? {} : { careerSlots }),
  });
  const token = auth.issue({
    userId: 'user_owner',
    email: 'owner@example.com',
    displayName: 'Owner',
  });
  return { app, token, unitOfWork, events };
}

describe('CreateCareer: plano lido junto com a transação', () => {
  it('pede o plano antes de abrir a transação e passa a dica de contagem', async () => {
    const events: string[] = [];
    const { app, token, unitOfWork } = setup(
      {
        forUser: () => {
          events.push('entitlements');
          return Promise.resolve(FREE);
        },
      },
      undefined,
      events,
    );
    const accepted = await app.execute(token, create('command_first'));
    expect(accepted.aggregateVersion).toBe(1);
    expect(events).toEqual(['entitlements', 'transaction', 'work']);
    expect(unitOfWork.options).toEqual([{ countsCareersOf: 'user_owner' }]);
  });

  it('mantém o limite do plano e a resposta da repetição', async () => {
    let failing = false;
    const { app, token } = setup({
      forUser: () =>
        failing
          ? Promise.reject(new Error('licenses unavailable'))
          : Promise.resolve(FREE),
    });
    const first = await app.execute(token, create('command_first'));
    await expect(
      app.execute(token, create('command_second')),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    // A replay is answered by its receipt; the plan is not needed for it.
    failing = true;
    expect(await app.execute(token, create('command_first'))).toEqual(first);
    // A new career still needs the plan: its failure fails the command.
    await expect(app.execute(token, create('command_third'))).rejects.toThrow(
      'licenses unavailable',
    );
  });
});

describe('guarda de carreira bloqueada: plano e ordem em paralelo', () => {
  it('pede plano e ordem de criação ao mesmo tempo (plano grátis)', async () => {
    const pending: string[] = [];
    let gate: Promise<void> = Promise.resolve();
    let careerIds: readonly string[] = [];
    const { app, token } = setup(
      {
        forUser: async () => {
          pending.push('entitlements');
          await gate;
          return FREE;
        },
      },
      {
        activeCareerIds: async () => {
          pending.push('slots');
          await gate;
          return careerIds;
        },
      },
    );
    const { careerId } = await app.execute(token, create('command_first'));
    careerIds = [careerId];
    // Close the gate: both lookups must start before either one answers.
    let release: () => void = () => undefined;
    gate = new Promise<void>((resolve) => (release = resolve));
    pending.length = 0;
    const selecting = app.execute(
      token,
      command('SelectClub', 'command_club', 1, {
        careerId,
        clubId: 'club_flamengo',
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect([...pending].sort()).toEqual(['entitlements', 'slots']);
    release();
    expect((await selecting).aggregateVersion).toBe(2);
  });

  it('com licença ignora a ordem de criação, até se ela falhar', async () => {
    const { app, token } = setup(
      { forUser: () => Promise.resolve(LICENSED) },
      { activeCareerIds: () => Promise.reject(new Error('slots unavailable')) },
    );
    const { careerId } = await app.execute(token, create('command_first'));
    const accepted = await app.execute(
      token,
      command('SelectClub', 'command_club', 1, {
        careerId,
        clubId: 'club_flamengo',
      }),
    );
    expect(accepted.aggregateVersion).toBe(2);
  });
});
