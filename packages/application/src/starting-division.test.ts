import { InMemoryUnitOfWork } from '@footebas/database';
import { describe, expect, it } from 'vitest';
import {
  ApplicationError,
  FakeBearerAuth,
  FakeClock,
  FootebasApplication,
  InMemoryEntitlements,
  InMemoryJobQueue,
  InMemoryStorage,
  NoopTelemetry,
  SequentialIdGenerator,
} from './index.js';

function setup(licensed: readonly string[] = []) {
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
    entitlements: new InMemoryEntitlements(licensed),
    enforceStartingDivision: true,
  });
  const token = auth.issue({
    userId: 'user_owner',
    email: 'owner@example.com',
    displayName: 'Owner',
  });
  return { app, token };
}

const envelope = (
  type: string,
  id: string,
  version: number,
  payload: object,
) => ({
  version: 1,
  type,
  commandId: id,
  idempotencyKey: `idem-${id}`,
  expectedVersion: version,
  payload,
});

async function pick(clubId: string, licensed: readonly string[] = []) {
  const { app, token } = setup(licensed);
  const created = await app.execute(
    token,
    envelope('CreateCareer', 'command_create', 0, {
      managerName: 'Marcio',
      startDate: '2026-01-01',
    }),
  );
  return app.execute(
    token,
    envelope('SelectClub', 'command_club', 1, {
      careerId: created.careerId,
      clubId,
    }),
  );
}

describe('clube inicial por plano (docs/05 §5)', () => {
  it('grátis começa na Série C', async () => {
    await expect(pick('club_brusque')).resolves.toMatchObject({
      aggregateVersion: 2,
    });
    await expect(pick('club_flamengo')).rejects.toBeInstanceOf(
      ApplicationError,
    );
  });

  it('a licença libera qualquer clube', async () => {
    await expect(pick('club_flamengo', ['user_owner'])).resolves.toMatchObject({
      aggregateVersion: 2,
    });
  });
});
