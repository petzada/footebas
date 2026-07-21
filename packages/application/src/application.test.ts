/* eslint-disable @typescript-eslint/no-non-null-assertion -- playthrough fixture guarantees selected players */
import { describe, expect, it } from 'vitest';
import { InMemoryUnitOfWork } from '@footebas/database';
import {
  ApplicationError,
  FakeBearerAuth,
  FakeClock,
  FootebasApplication,
  InMemoryJobQueue,
  InMemoryStorage,
  NoopTelemetry,
  SequentialIdGenerator,
  type ApplicationDependencies,
} from './index.js';

function setup(failPoint?: ApplicationDependencies['failPoint']) {
  const clock = new FakeClock();
  const auth = new FakeBearerAuth();
  const jobs = new InMemoryJobQueue();
  const deps: ApplicationDependencies = {
    auth,
    clock,
    jobs,
    ids: new SequentialIdGenerator(),
    storage: new InMemoryStorage(),
    telemetry: new NoopTelemetry(),
    unitOfWork: new InMemoryUnitOfWork(clock),
    ...(failPoint ? { failPoint } : {}),
  };
  const app = new FootebasApplication(deps);
  const token = auth.issue({
    userId: 'user_owner',
    email: 'owner@example.com',
    displayName: 'Owner',
  });
  const stranger = auth.issue({
    userId: 'user_stranger',
    email: 'stranger@example.com',
    displayName: 'Stranger',
  });
  return { app, deps, token, stranger };
}
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

async function createAndSelect(app: FootebasApplication, token: string) {
  const created = await app.execute(
    token,
    command('CreateCareer', 'command_create', 0, {
      managerName: 'Marcio',
      startDate: '2026-01-01',
    }),
  );
  await app.execute(
    token,
    command('SelectClub', 'command_club', 1, {
      careerId: created.careerId,
      clubId: 'club_1',
    }),
  );
  return created.careerId;
}

describe('server-authoritative application slice', () => {
  it('plays through post-match and reloads checksum-equivalent', async () => {
    const { app, deps, token } = setup();
    const careerId = await createAndSelect(app, token);
    const squad = await app.squad(token, careerId);
    const starters = squad.lineupPlayerIds
      .slice(0, 11)
      .map((playerId) => ({
        playerId,
        position: squad.players.find(({ id }) => id === playerId)!.position,
      }));
    await app.execute(
      token,
      command('SetLineup', 'command_lineup', 2, {
        careerId,
        clubId: 'club_1',
        starters,
        substitutes: [],
        captainId: starters[0]!.playerId,
      }),
    );
    await app.execute(
      token,
      command('SetTactics', 'command_tactic', 3, {
        careerId,
        formation: '4-3-3',
        mentality: 'counter_attack',
        attackDirection: 'wings',
        marking: 'heavy',
      }),
    );
    const next = await app.nextMatch(token, careerId);
    expect(
      (
        await app.execute(
          token,
          command('AdvanceDate', 'command_advance', 4, {
            careerId,
            throughDate: next.date,
          }),
        )
      ).jobId,
    ).toBeDefined();
    expect((await app.runNextJob())?.state).toBe('succeeded');
    expect((await app.postMatch(token, careerId)).fixtureId).toBe(
      next.fixtureId,
    );
    expect(
      (await app.standings(token, careerId)).rows.reduce(
        (sum, row) => sum + row.played,
        0,
      ),
    ).toBe(2);
    expect(
      (await app.squad(token, careerId)).players.some(
        ({ condition }) => condition < 100,
      ),
    ).toBe(true);
    const checksum = await app.checksum(token, careerId);
    const reloaded = new FootebasApplication(deps);
    expect(await reloaded.checksum(token, careerId)).toBe(checksum);
    expect((await reloaded.home(token, careerId)).currentDate).toBe(next.date);
  });

  it('enforces auth and ownership', async () => {
    const { app, token, stranger } = setup();
    const id = await createAndSelect(app, token);
    await expect(app.home('Bearer invalid', id)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    await expect(app.home(stranger, id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('deduplicates commands and serializes concurrent advances', async () => {
    const { app, token } = setup();
    const create = command('CreateCareer', 'command_same_create', 0, {
      managerName: 'M',
      startDate: '2026-01-01',
    });
    const first = await app.execute(token, create);
    expect(await app.execute(token, create)).toEqual(first);
    await app.execute(
      token,
      command('SelectClub', 'command_select_once', 1, {
        careerId: first.careerId,
        clubId: 'club_1',
      }),
    );
    const settled = await Promise.allSettled([
      app.execute(
        token,
        command('AdvanceDate', 'command_advance_a', 2, {
          careerId: first.careerId,
        }),
      ),
      app.execute(
        token,
        command('AdvanceDate', 'command_advance_b', 2, {
          careerId: first.careerId,
        }),
      ),
    ]);
    expect(settled.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(settled.filter(({ status }) => status === 'rejected')).toHaveLength(
      1,
    );
    await app.runNextJob();
    const checksum = await app.checksum(token, first.careerId);
    expect(await app.runNextJob()).toBeUndefined();
    expect(await app.checksum(token, first.careerId)).toBe(checksum);
  });

  it('rolls back injected failure and retries once without partial result', async () => {
    let fail = true;
    const { app, token } = setup(() => {
      if (fail) {
        fail = false;
        throw new Error('injected');
      }
    });
    const id = await createAndSelect(app, token);
    const fixtureId = (await app.nextMatch(token, id)).fixtureId;
    await app.execute(
      token,
      command('SimulateMatch', 'command_sim', 2, { careerId: id, fixtureId }),
    );
    expect((await app.runNextJob())?.state).toBe('failed');
    await expect(app.postMatch(token, id)).rejects.toBeInstanceOf(
      ApplicationError,
    );
    expect((await app.runNextJob())?.state).toBe('succeeded');
    expect((await app.postMatch(token, id)).fixtureId).toBe(fixtureId);
    expect(
      (await app.standings(token, id)).rows.reduce(
        (sum, row) => sum + row.played,
        0,
      ),
    ).toBe(2);
  });
});
