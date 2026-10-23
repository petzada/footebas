import { z } from 'zod';
import { commandAcceptedSchema, commandSchema } from './commands.js';
import {
  idempotencyKeySchema,
  instantSchema,
  nonEmptyTextSchema,
  transportVersionSchema,
} from './primitives.js';

export const connectivityStateSchema = z.strictObject({
  version: transportVersionSchema,
  status: z.enum(['online', 'offline', 'reconnecting']),
  changedAt: instantSchema,
  reconnectAttempt: z.number().int().nonnegative(),
});

export const outboxEntrySchema = z.strictObject({
  version: transportVersionSchema,
  idempotencyKey: idempotencyKeySchema,
  command: commandSchema,
  state: z.enum(['pending', 'sending']),
  queuedAt: instantSchema,
  attempts: z.number().int().nonnegative(),
  lastAttemptAt: instantSchema.optional(),
});

export const commandDeliverySchema = z.discriminatedUnion('state', [
  z.strictObject({
    version: transportVersionSchema,
    state: z.literal('queued'),
    idempotencyKey: idempotencyKeySchema,
  }),
  z.strictObject({
    version: transportVersionSchema,
    state: z.literal('delivered'),
    idempotencyKey: idempotencyKeySchema,
    receipt: commandAcceptedSchema,
  }),
]);

export const matchCompletionIntentSchema = z.strictObject({
  version: transportVersionSchema,
  mode: z.enum(['present', 'instant']),
  requestedAt: instantSchema,
  reason: nonEmptyTextSchema.optional(),
});

export type ConnectivityState = z.infer<typeof connectivityStateSchema>;
export type OutboxEntry = z.infer<typeof outboxEntrySchema>;
export type CommandDelivery = z.infer<typeof commandDeliverySchema>;
export type MatchCompletionIntent = z.infer<typeof matchCompletionIntentSchema>;
