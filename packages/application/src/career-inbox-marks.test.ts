/* eslint-disable @typescript-eslint/no-non-null-assertion -- the first match always produces a report and a press conference */
import { InMemoryUnitOfWork } from '@footebas/database';
import { describe, expect, it } from 'vitest';
import {
  ApplicationError,
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
    commandId: `command_marks_${String(sequence)}`,
    idempotencyKey: `idem-marks-${String(sequence)}`,
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

const version = async (app: FootebasApplication, token: string, id: string) =>
  (await app.home(token, id)).aggregateVersion;

async function play(app: FootebasApplication, token: string, careerId: string) {
  await app.execute(
    token,
    command('AutoPickLineup', await version(app, token, careerId), {
      careerId,
      clubId: 'club_flamengo',
      formation: '4-4-2',
      mode: 'best',
    }),
  );
  await app.execute(
    token,
    command('AdvanceDate', await version(app, token, careerId), { careerId }),
  );
  expect((await app.runNextJob())?.state).toBe('succeeded');
}

const send = async (
  app: FootebasApplication,
  token: string,
  careerId: string,
  type: string,
  payload: object,
) =>
  app.execute(
    token,
    command(type, await version(app, token, careerId), {
      careerId,
      ...payload,
    }),
  );

describe('caixa de entrada: lida e excluída no servidor', () => {
  it('marca como lida ao abrir a caixa, sem repetir, e o estado fica no save', async () => {
    const { app, token } = setup();
    const careerId = await start(app, token);
    await play(app, token, careerId);
    const inbox = (await app.home(token, careerId)).inbox;
    expect(inbox.length).toBeGreaterThan(0);
    expect(inbox.every(({ read }) => read === false)).toBe(true);

    await send(app, token, careerId, 'MarkInboxRead', {
      messageIds: [...inbox.map(({ id }) => id), 'mail_unknown'],
    });
    const after = await app.home(token, careerId);
    expect(after.inbox.every(({ read }) => read === true)).toBe(true);
    // The same ids again are accepted and change nothing.
    await send(app, token, careerId, 'MarkInboxRead', {
      messageIds: inbox.map(({ id }) => id),
    });
    expect((await app.home(token, careerId)).inbox).toEqual(after.inbox);

    // Next round brings unread messages next to the read ones.
    await play(app, token, careerId);
    const next = (await app.home(token, careerId)).inbox;
    const known = new Set(inbox.map(({ id }) => id));
    expect(
      next.filter(({ id }) => known.has(id)).every(({ read }) => read),
    ).toBe(true);
    expect(next.some(({ id, read }) => !known.has(id) && !read)).toBe(true);
  });

  it('exclui relatório, aviso e coletiva respondida; recusa decisão pendente', async () => {
    const { app, token } = setup();
    const careerId = await start(app, token);
    await play(app, token, careerId);
    const inbox = (await app.home(token, careerId)).inbox;
    const report = inbox.find(({ kind }) => kind === 'match_report')!;
    const press = inbox.find(({ topic }) => topic === 'press_conference')!;

    await expect(
      send(app, token, careerId, 'DeleteInboxMessage', { messageId: press.id }),
    ).rejects.toBeInstanceOf(ApplicationError);

    await send(app, token, careerId, 'DeleteInboxMessage', {
      messageId: report.id,
    });
    await send(app, token, careerId, 'ResolveInboxDecision', {
      messageId: press.id,
      optionId: press.choice!.options[0]!.id,
    });
    await send(app, token, careerId, 'DeleteInboxMessage', {
      messageId: press.id,
    });
    const after = (await app.home(token, careerId)).inbox.map(({ id }) => id);
    expect(after).not.toContain(report.id);
    expect(after).not.toContain(press.id);
    // Deleting again is accepted as a no-op (a retried tap), and nothing
    // comes back after more rounds.
    for (const messageId of [report.id, press.id])
      await send(app, token, careerId, 'DeleteInboxMessage', { messageId });
    await play(app, token, careerId);
    const later = (await app.home(token, careerId)).inbox.map(({ id }) => id);
    expect(later).not.toContain(report.id);
    expect(later).not.toContain(press.id);
  });

  it('recusa mexer na caixa enquanto uma simulação está na fila', async () => {
    const { app, token } = setup();
    const careerId = await start(app, token);
    await play(app, token, careerId);
    const inbox = (await app.home(token, careerId)).inbox;
    await send(app, token, careerId, 'AdvanceDate', {});
    await expect(
      send(app, token, careerId, 'MarkInboxRead', {
        messageIds: [inbox[0]!.id],
      }),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect((await app.runNextJob())?.state).toBe('succeeded');
  });
});
