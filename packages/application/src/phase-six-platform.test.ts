import type { Command, CommandAccepted } from '@footebas/contracts';
import { describe, expect, it, vi } from 'vitest';
import { FakeClock } from './ports.js';
import {
  AnimationIndependentCompletion,
  ConnectivityTransportError,
  FakeConnectivity,
  InMemoryCommandOutbox,
  ReconnectCommandDispatcher,
  type CommandTransportPort,
} from './phase-six-platform.js';

const command: Command = {
  version: 1,
  commandId: 'command_advance_offline',
  idempotencyKey: 'phase6:advance:offline',
  expectedVersion: 2,
  type: 'AdvanceDate',
  payload: { careerId: 'career_one' },
};
const receipt: CommandAccepted = {
  version: 1,
  commandId: command.commandId,
  careerId: 'career_one',
  aggregateVersion: 3,
  jobId: 'job_one',
};

describe('phase six reconnect platform', () => {
  it('replays one stable command after offline and lost acknowledgement exactly once', async () => {
    const clock = new FakeClock();
    const connectivity = new FakeConnectivity('offline', clock);
    const outbox = new InMemoryCommandOutbox();
    const accepted = new Map<string, CommandAccepted>();
    let sideEffects = 0;
    let loseFirstAcknowledgement = true;
    const transport: CommandTransportPort = {
      send: (_bearer, input) => {
        const previous = accepted.get(input.idempotencyKey);
        if (previous !== undefined) return Promise.resolve(previous);
        sideEffects += 1;
        accepted.set(input.idempotencyKey, receipt);
        if (loseFirstAcknowledgement) {
          loseFirstAcknowledgement = false;
          throw new ConnectivityTransportError('response connection lost');
        }
        return Promise.resolve(receipt);
      },
    };
    const dispatcher = new ReconnectCommandDispatcher(
      connectivity,
      outbox,
      transport,
      clock,
    );

    await expect(dispatcher.submit('Bearer owner', command)).resolves.toEqual({
      version: 1,
      state: 'queued',
      idempotencyKey: command.idempotencyKey,
    });
    expect(sideEffects).toBe(0);

    connectivity.set('online');
    await expect(dispatcher.reconnect('Bearer owner')).resolves.toEqual([]);
    expect(await outbox.list()).toMatchObject([
      { idempotencyKey: command.idempotencyKey, attempts: 1 },
    ]);

    const [delivered, duplicateReconnect] = await Promise.all([
      dispatcher.reconnect('Bearer owner'),
      dispatcher.reconnect('Bearer owner'),
    ]);
    expect(delivered).toEqual([
      {
        version: 1,
        state: 'delivered',
        idempotencyKey: command.idempotencyKey,
        receipt,
      },
    ]);
    expect(duplicateReconnect).toEqual([]);
    expect(sideEffects).toBe(1);
    expect(await outbox.list()).toEqual([]);
  });

  it('refuses to reuse an idempotency key for a different command', async () => {
    const outbox = new InMemoryCommandOutbox();
    const queuedAt = '2026-07-21T12:00:00.000Z';
    await outbox.put({
      version: 1,
      idempotencyKey: command.idempotencyKey,
      command,
      state: 'pending',
      queuedAt,
      attempts: 0,
    });
    await expect(
      outbox.put({
        version: 1,
        idempotencyKey: command.idempotencyKey,
        command: { ...command, commandId: 'command_different' },
        state: 'pending',
        queuedAt,
        attempts: 0,
      }),
    ).rejects.toThrow('different commands');
  });

  it('completes authoritatively without waiting for animation', async () => {
    const complete = vi.fn(() => Promise.resolve({ score: '2-1' }));
    const play = vi.fn(() => new Promise<void>(() => undefined));
    const coordinator = new AnimationIndependentCompletion(complete, {
      play,
    });

    await expect(coordinator.completeNow()).resolves.toEqual({ score: '2-1' });
    await expect(coordinator.completeNow()).resolves.toEqual({ score: '2-1' });
    expect(complete).toHaveBeenCalledTimes(1);
    expect(play).not.toHaveBeenCalled();
  });
});
