import { describe, expect, it } from 'vitest';
import {
  commandDeliverySchema,
  connectivityStateSchema,
  matchCompletionIntentSchema,
  outboxEntrySchema,
} from './phase-six.js';

const command = {
  version: 1 as const,
  commandId: 'command_advance_offline',
  idempotencyKey: 'phase6:advance:offline',
  expectedVersion: 2,
  type: 'AdvanceDate' as const,
  payload: { careerId: 'career_one' },
};

describe('phase six transport contracts', () => {
  it('keeps connectivity and outbox records versioned and strict', () => {
    expect(
      connectivityStateSchema.parse({
        version: 1,
        status: 'offline',
        changedAt: '2026-07-21T12:00:00.000Z',
        reconnectAttempt: 0,
      }),
    ).toMatchObject({ status: 'offline' });
    expect(
      outboxEntrySchema.parse({
        version: 1,
        idempotencyKey: command.idempotencyKey,
        command,
        state: 'pending',
        queuedAt: '2026-07-21T12:00:00.000Z',
        attempts: 0,
      }),
    ).toMatchObject({ command, attempts: 0 });
    expect(() =>
      outboxEntrySchema.parse({
        version: 1,
        idempotencyKey: command.idempotencyKey,
        command,
        state: 'pending',
        queuedAt: '2026-07-21T12:00:00.000Z',
        attempts: 0,
        surprise: true,
      }),
    ).toThrow();
  });

  it('distinguishes queued and delivered receipts and completion intent', () => {
    expect(
      commandDeliverySchema.parse({
        version: 1,
        state: 'queued',
        idempotencyKey: command.idempotencyKey,
      }).state,
    ).toBe('queued');
    expect(
      matchCompletionIntentSchema.parse({
        version: 1,
        mode: 'instant',
        requestedAt: '2026-07-21T12:00:00.000Z',
      }).mode,
    ).toBe('instant');
  });
});
