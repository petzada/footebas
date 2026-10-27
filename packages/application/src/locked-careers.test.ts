/* eslint-disable @typescript-eslint/no-non-null-assertion -- careers created in each test */
// Product decision (refund/revocation): the oldest career stays playable;
// careers 2–5 stay saved but locked until the license is bought again.
// Locked is derived from entitlements + creation order (no stored flag).
import { InMemoryUnitOfWork } from '@footebas/database';
import { describe, expect, it } from 'vitest';
import {
  CareerLockedError,
  FakeBearerAuth,
  FakeClock,
  FootebasApplication,
  InMemoryEntitlements,
  InMemoryJobQueue,
  InMemoryStorage,
  NoopTelemetry,
  SequentialIdGenerator,
  isCareerLocked,
  type CareerSlotsPort,
} from './index.js';

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

function setup(careerSlots?: CareerSlotsPort) {
  const clock = new FakeClock();
  const auth = new FakeBearerAuth();
  const entitlements = new InMemoryEntitlements(['user_owner']);
  const app = new FootebasApplication({
    auth,
    clock,
    ids: new SequentialIdGenerator(),
    jobs: new InMemoryJobQueue(),
    storage: new InMemoryStorage(),
    telemetry: new NoopTelemetry(),
    unitOfWork: new InMemoryUnitOfWork(clock),
    entitlements,
    // Série A/B starts are what the license sells; locking must hold anyway.
    enforceStartingDivision: true,
    ...(careerSlots === undefined ? {} : { careerSlots }),
  });
  const token = auth.issue({
    userId: 'user_owner',
    email: 'owner@example.com',
    displayName: 'Owner',
  });
  return { app, clock, entitlements, token };
}

/** Three licensed careers, the second one in Série A (Flamengo). */
async function licensedWithThree(careerSlots?: CareerSlotsPort) {
  const context = setup(careerSlots);
  const { app, clock, token } = context;
  const ids: string[] = [];
  for (const name of ['first', 'second', 'third']) {
    ids.push((await app.execute(token, create(`command_${name}`))).careerId);
    clock.advance(60_000);
  }
  await app.execute(
    token,
    command('SelectClub', 'command_club_a', 1, {
      careerId: ids[1],
      clubId: 'club_flamengo',
    }),
  );
  return { ...context, ids };
}

describe('careers locked after the license is revoked', () => {
  it('keeps the oldest playable and locks the others (reads and commands)', async () => {
    const { app, entitlements, token, ids } = await licensedWithThree();
    const [oldest, second, third] = ids as [string, string, string];
    entitlements.revoke('user_owner');

    const list = await app.careers(token);
    // Most recently played first (the second picked its club last); the
    // lock still follows the creation order.
    expect(
      list.careers.map(({ careerId, locked }) => [careerId, locked]),
    ).toEqual([
      [second, true],
      [third, true],
      [oldest, false],
    ]);
    // Locked careers still count against the free limit of one.
    expect(list.limits).toMatchObject({ plan: 'free', activeCareers: 3 });
    await expect(
      app.execute(token, create('command_fourth')),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(app.home(token, oldest)).resolves.toMatchObject({
      careerId: oldest,
    });
    // The Série A career created with the license is locked too.
    const read = await app.home(token, second).catch((error: unknown) => error);
    expect(read).toBeInstanceOf(CareerLockedError);
    expect(read).toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      app.execute(
        token,
        command('AdvanceDate', 'command_locked_advance', 2, {
          careerId: second,
        }),
      ),
    ).rejects.toBeInstanceOf(CareerLockedError);
    await expect(
      app.execute(
        token,
        command('SelectClub', 'command_locked_club', 1, {
          careerId: third,
          clubId: 'club_flamengo',
        }),
      ),
    ).rejects.toBeInstanceOf(CareerLockedError);
    await expect(
      app.assertCareerUnlocked('user_owner', third),
    ).rejects.toBeInstanceOf(CareerLockedError);
  });

  it('still lets the owner delete a locked career', async () => {
    const { app, entitlements, token, ids } = await licensedWithThree();
    entitlements.revoke('user_owner');
    const deleted = await app.execute(
      token,
      command('DeleteCareer', 'command_delete_locked', 1, {
        careerId: ids[2],
      }),
    );
    expect(deleted.careerId).toBe(ids[2]);
    expect((await app.careers(token)).careers).toHaveLength(2);
  });

  it('unlocks every career as soon as the license is bought again', async () => {
    const { app, entitlements, token, ids } = await licensedWithThree();
    entitlements.revoke('user_owner');
    await expect(app.home(token, ids[1]!)).rejects.toBeInstanceOf(
      CareerLockedError,
    );
    entitlements.license('user_owner');
    expect(
      (await app.careers(token)).careers.every(({ locked }) => !locked),
    ).toBe(true);
    await expect(app.home(token, ids[1]!)).resolves.toMatchObject({
      careerId: ids[1],
    });
    await expect(
      app.execute(
        token,
        command('AdvanceDate', 'command_unlocked_advance', 2, {
          careerId: ids[1],
        }),
      ),
    ).resolves.toMatchObject({ careerId: ids[1] });
  });

  it('uses the career slots port when given (Durable Object path)', async () => {
    const calls: string[] = [];
    let order: string[] = [];
    const slots: CareerSlotsPort = {
      activeCareerIds: (userId) => {
        calls.push(userId);
        return Promise.resolve(order);
      },
    };
    const { app, entitlements, token, ids } = await licensedWithThree(slots);
    order = [...ids];
    entitlements.revoke('user_owner');
    await expect(app.home(token, ids[2]!)).rejects.toBeInstanceOf(
      CareerLockedError,
    );
    expect(calls.length).toBeGreaterThan(0);
    // The port decides the order, not the unit of work.
    order = [ids[2]!, ids[0]!, ids[1]!];
    await expect(app.home(token, ids[2]!)).resolves.toBeDefined();
  });

  it('derives the lock from the creation order and the plan limit', () => {
    const free = { plan: 'free', maxCareers: 1, anyClub: false } as const;
    const licensed = {
      plan: 'licensed',
      maxCareers: 5,
      anyClub: true,
    } as const;
    expect(isCareerLocked(['a', 'b'], 'a', free)).toBe(false);
    expect(isCareerLocked(['a', 'b'], 'b', free)).toBe(true);
    expect(isCareerLocked(['a', 'b'], 'b', licensed)).toBe(false);
    expect(isCareerLocked(['a'], 'missing', free)).toBe(false);
  });
});

describe('career list order (saves of a licensed player)', () => {
  it('lists the career played last first, with its save time', async () => {
    const { app, clock, token, ids } = await licensedWithThree();
    const [oldest, second, third] = ids as [string, string, string];
    expect((await app.careers(token)).careers[0]?.careerId).toBe(second);

    // Playing the oldest career again brings it back to the top.
    clock.advance(60_000);
    await app.execute(
      token,
      command('SelectClub', 'command_club_oldest', 1, {
        careerId: oldest,
        clubId: 'club_flamengo',
      }),
    );
    const list = await app.careers(token);
    expect(list.careers.map(({ careerId }) => careerId)).toEqual([
      oldest,
      second,
      third,
    ]);
    const [first, next] = list.careers;
    expect(first?.updatedAt).toBeDefined();
    expect(first!.updatedAt! > next!.updatedAt!).toBe(true);
    expect(list.careers.every(({ locked }) => !locked)).toBe(true);
  });
});
