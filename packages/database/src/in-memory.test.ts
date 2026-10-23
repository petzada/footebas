import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  InMemoryUnitOfWork,
  SaveConflictError,
  SaveNotFoundError,
  SaveOwnershipError,
  checksumSnapshot,
  verifyChecksum,
  type Clock,
  type NewGameSave,
} from './index.js';

class FakeClock implements Clock {
  constructor(private instant = new Date('2026-07-21T12:00:00.000Z')) {}
  now(): Date {
    return new Date(this.instant);
  }
  advance(): void {
    this.instant = new Date(this.instant.getTime() + 1_000);
  }
}
const input = (
  snapshot: NewGameSave['snapshot'] = { round: 0 },
): NewGameSave => ({
  id: 'career-1',
  userId: 'user-1',
  snapshot,
  seed: 'seed-1',
  versions: { engine: '1', rules: '1', content: '2026.1', schema: '1' },
});

/** Adapters may throw synchronously; normalize to a rejected promise. */
const attempt = <T>(work: () => Promise<T>): Promise<T> =>
  Promise.resolve().then(work);

describe('in-memory persistence contract', () => {
  it('creates, reloads and updates a canonical checksummed save using injected instants', async () => {
    const clock = new FakeClock();
    const uow = new InMemoryUnitOfWork(clock);
    const repos = uow.repositories();
    const created = await repos.saves.create(input({ z: 1, a: ['x'] }));
    expect(created.checksum).toBe(checksumSnapshot({ a: ['x'], z: 1 }));
    expect(created.createdAt).toBe('2026-07-21T12:00:00.000Z');
    clock.advance();
    const updated = await repos.saves.update(created.id, created.userId, 1, {
      snapshot: { round: 1 },
      seed: created.seed,
      versions: created.versions,
    });
    expect(updated.version).toBe(2);
    expect(updated.updatedAt).toBe('2026-07-21T12:00:01.000Z');
    const reloaded = await repos.saves.load(created.id, created.userId);
    expect(reloaded).toEqual(updated);
    expect(reloaded && verifyChecksum(reloaded)).toBe(true);
  });

  it('serializes concurrent advances so stale versions cannot both persist', async () => {
    const uow = new InMemoryUnitOfWork(new FakeClock());
    await uow.repositories().saves.create(input());
    const advance = (commandId: string) =>
      uow.executeIdempotent('career-1', commandId, async (tx) => {
        const save = await tx.saves.load('career-1', 'user-1');
        if (!save) throw new Error('missing fixture save');
        await Promise.resolve();
        const updated = await tx.saves.update(save.id, save.userId, 1, {
          snapshot: { round: 1 },
          seed: save.seed,
          versions: save.versions,
        });
        return { version: updated.version, checksum: updated.checksum };
      });
    const outcomes = await Promise.allSettled([
      advance('advance-a'),
      advance('advance-b'),
    ]);
    expect(outcomes.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
    expect(
      rejected?.status === 'rejected' &&
        rejected.reason instanceof SaveConflictError,
    ).toBe(true);
    expect(
      (await uow.repositories().saves.load('career-1', 'user-1'))?.version,
    ).toBe(2);
  });

  it('returns the exact stored response on retry without executing work twice', async () => {
    const uow = new InMemoryUnitOfWork(new FakeClock());
    let calls = 0;
    const run = () =>
      uow.executeIdempotent('career-1', 'cmd-1', () => {
        calls++;
        return Promise.resolve({ status: 'done', ordinal: calls });
      });
    const [first, retry] = await Promise.all([run(), run()]);
    expect(retry).toEqual(first);
    expect(calls).toBe(1);
  });

  it('rolls back save and receipt when a transaction fails', async () => {
    const uow = new InMemoryUnitOfWork(new FakeClock());
    await uow.repositories().saves.create(input());
    await expect(
      uow.executeIdempotent('career-1', 'broken', async (tx) => {
        const save = await tx.saves.load('career-1', 'user-1');
        if (!save) throw new Error('missing fixture save');
        await tx.saves.update(save.id, save.userId, save.version, {
          snapshot: { round: 99 },
          seed: save.seed,
          versions: save.versions,
        });
        throw new Error('worker failed');
      }),
    ).rejects.toThrow('worker failed');
    expect(
      (await uow.repositories().saves.load('career-1', 'user-1'))?.snapshot,
    ).toEqual({ round: 0 });
    expect(
      await uow.repositories().commands.load('career-1', 'broken'),
    ).toBeUndefined();
  });

  it('archives owned saves, hides them and frees the active counts', async () => {
    const clock = new FakeClock();
    const uow = new InMemoryUnitOfWork(clock);
    const repos = uow.repositories();
    await repos.saves.create(input());
    await repos.saves.create({ ...input(), id: 'career-2' });
    await repos.saves.create({ ...input(), id: 'career-3', userId: 'user-2' });
    expect(await repos.saves.countActiveByUser('user-1')).toBe(2);
    expect(await repos.saves.countActiveUsers()).toBe(2);
    await expect(
      attempt(() => repos.saves.archive('career-1', 'user-2', 1)),
    ).rejects.toBeInstanceOf(SaveOwnershipError);
    await expect(
      attempt(() => repos.saves.archive('career-1', 'user-1', 7)),
    ).rejects.toBeInstanceOf(SaveConflictError);
    clock.advance();
    const archived = await repos.saves.archive('career-1', 'user-1', 1);
    expect(archived.version).toBe(2);
    expect(archived.archivedAt).toBe('2026-07-21T12:00:01.000Z');
    expect(await repos.saves.load('career-1', 'user-1')).toBeUndefined();
    expect(await repos.saves.peek('career-1')).toBeUndefined();
    expect(
      (await repos.saves.listByUser('user-1')).map(({ id }) => id),
    ).toEqual(['career-2']);
    expect(await repos.saves.countActiveByUser('user-1')).toBe(1);
    await expect(
      attempt(() =>
        repos.saves.update('career-1', 'user-1', 2, {
          snapshot: { round: 1 },
          seed: 'seed-1',
          versions: input().versions,
        }),
      ),
    ).rejects.toBeInstanceOf(SaveNotFoundError);
    await expect(
      attempt(() => repos.saves.create(input())),
    ).rejects.toBeInstanceOf(SaveConflictError);
    await repos.saves.archive('career-2', 'user-1', 1);
    expect(await repos.saves.countActiveUsers()).toBe(1);
  });

  it('hard-deletes an owned save with its receipts', async () => {
    const uow = new InMemoryUnitOfWork(new FakeClock());
    await uow.repositories().saves.create(input());
    await uow.executeIdempotent('career-1', 'cmd-1', () =>
      Promise.resolve({ ok: true }),
    );
    const repos = uow.repositories();
    await expect(
      attempt(() => repos.saves.delete('career-1', 'user-2')),
    ).rejects.toBeInstanceOf(SaveOwnershipError);
    await repos.saves.delete('career-1', 'user-1');
    expect(await repos.saves.peek('career-1')).toBeUndefined();
    expect(await repos.commands.load('career-1', 'cmd-1')).toBeUndefined();
    await expect(
      attempt(() => repos.saves.delete('career-1', 'user-1')),
    ).rejects.toBeInstanceOf(SaveNotFoundError);
  });

  it('checksums canonical JSON independently of object key order (property)', () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.string({ minLength: 1 }), fc.integer()),
        (record) => {
          const reversed = Object.fromEntries(Object.entries(record).reverse());
          expect(checksumSnapshot(record)).toBe(checksumSnapshot(reversed));
        },
      ),
    );
  });

  it('career save store writes conditionally and accepts the same write again', async () => {
    const uow = new InMemoryUnitOfWork(new FakeClock());
    const created = await uow.repositories().saves.create(input());
    const store = uow.careerSaveStore();
    expect(await store.versionOf('career-1')).toBe(1);
    const next = {
      ...created,
      snapshot: { round: 1 },
      checksum: checksumSnapshot({ round: 1 }),
      version: 2,
    };
    await store.commit(next, 1, []);
    await store.commit(next, 1, []);
    expect((await store.peek('career-1'))?.snapshot).toEqual({ round: 1 });
    await expect(
      attempt(() =>
        store.commit(
          { ...next, snapshot: { round: 9 }, checksum: 'other' },
          1,
          [],
        ),
      ),
    ).rejects.toBeInstanceOf(SaveConflictError);
    await store.archive('career-1', 'user-1', 2);
    expect(await store.versionOf('career-1')).toBeUndefined();
  });
});
