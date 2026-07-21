import { z } from 'zod';
import {
  entityIdSchema,
  instantSchema,
  transportVersionSchema,
} from './primitives.js';

export const jobStateSchema = z.enum([
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
]);
export const jobProgressSchema = z
  .strictObject({
    current: z.int().min(0),
    total: z.int().positive(),
    percent: z.number().min(0).max(100),
    stage: z.string().min(1).max(80),
  })
  .refine(
    ({ current, total }) => current <= total,
    'current must not exceed total',
  );
export const jobStatusSchema = z.strictObject({
  version: transportVersionSchema,
  jobId: entityIdSchema,
  commandId: entityIdSchema,
  careerId: entityIdSchema,
  state: jobStateSchema,
  progress: jobProgressSchema,
  attempt: z.int().positive().max(20),
  createdAt: instantSchema,
  updatedAt: instantSchema,
  errorCode: z.string().min(1).max(64).optional(),
});
const eventBase = {
  version: transportVersionSchema,
  eventId: entityIdSchema,
  jobId: entityIdSchema,
  occurredAt: instantSchema,
} as const;
export const jobSseEventSchema = z.discriminatedUnion('type', [
  z.strictObject({
    ...eventBase,
    type: z.literal('job.status'),
    data: jobStatusSchema,
  }),
  z.strictObject({
    ...eventBase,
    type: z.literal('job.progress'),
    data: jobProgressSchema,
  }),
  z.strictObject({
    ...eventBase,
    type: z.literal('job.completed'),
    data: z.strictObject({
      careerId: entityIdSchema,
      aggregateVersion: z.int().min(0),
    }),
  }),
  z.strictObject({
    ...eventBase,
    type: z.literal('job.failed'),
    data: z.strictObject({
      code: z.string().min(1).max(64),
      message: z.string().min(1).max(500),
      retryable: z.boolean(),
    }),
  }),
]);
export type JobStatus = z.infer<typeof jobStatusSchema>;
export type JobSseEvent = z.infer<typeof jobSseEventSchema>;
