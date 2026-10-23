import { z } from 'zod';
import {
  commandIdSchema,
  entityIdSchema,
  transportVersionSchema,
  versionSchema,
} from './primitives.js';

const base = {
  version: transportVersionSchema,
  requestId: entityIdSchema,
  commandId: commandIdSchema.optional(),
} as const;
const detailValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);
const detailsSchema = z.record(z.string().min(1).max(64), detailValueSchema);
export const validationErrorSchema = z.strictObject({
  ...base,
  code: z.literal('VALIDATION_ERROR'),
  message: z.string().min(1).max(500),
  details: detailsSchema.optional(),
});
export const unauthorizedErrorSchema = z.strictObject({
  ...base,
  code: z.literal('UNAUTHORIZED'),
  message: z.string().min(1).max(500),
});
export const forbiddenErrorSchema = z.strictObject({
  ...base,
  code: z.literal('FORBIDDEN'),
  message: z.string().min(1).max(500),
});
export const notFoundErrorSchema = z.strictObject({
  ...base,
  code: z.literal('NOT_FOUND'),
  message: z.string().min(1).max(500),
  resource: z.string().min(1).max(64),
});
export const versionConflictErrorSchema = z.strictObject({
  ...base,
  code: z.literal('VERSION_CONFLICT'),
  message: z.string().min(1).max(500),
  expectedVersion: versionSchema,
  actualVersion: versionSchema,
});
export const idempotencyConflictErrorSchema = z.strictObject({
  ...base,
  code: z.literal('IDEMPOTENCY_CONFLICT'),
  message: z.string().min(1).max(500),
});
export const jobFailedErrorSchema = z.strictObject({
  ...base,
  code: z.literal('JOB_FAILED'),
  message: z.string().min(1).max(500),
  jobId: entityIdSchema,
  retryable: z.boolean(),
});
/** CreateCareer refused: the user already has the plan's maximum of active careers. */
export const careerLimitReachedErrorSchema = z.strictObject({
  ...base,
  code: z.literal('CAREER_LIMIT_REACHED'),
  message: z.string().min(1).max(500),
  plan: z.enum(['free', 'licensed']).optional(),
  maxCareers: z.int().min(0).optional(),
});
export const internalErrorSchema = z.strictObject({
  ...base,
  code: z.literal('INTERNAL_ERROR'),
  message: z.string().min(1).max(500),
});
export const apiErrorSchema = z.discriminatedUnion('code', [
  validationErrorSchema,
  unauthorizedErrorSchema,
  forbiddenErrorSchema,
  notFoundErrorSchema,
  versionConflictErrorSchema,
  idempotencyConflictErrorSchema,
  jobFailedErrorSchema,
  careerLimitReachedErrorSchema,
  internalErrorSchema,
]);
export type ApiError = z.infer<typeof apiErrorSchema>;
