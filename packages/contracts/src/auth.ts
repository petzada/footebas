import { z } from 'zod';
import {
  entityIdSchema,
  instantSchema,
  nonEmptyTextSchema,
  transportVersionSchema,
} from './primitives.js';

export const fakeAuthIdentitySchema = z.strictObject({
  version: transportVersionSchema,
  userId: entityIdSchema,
  email: z.email().max(254),
  displayName: nonEmptyTextSchema,
});

export const sessionSchema = z.strictObject({
  version: transportVersionSchema,
  sessionId: entityIdSchema,
  identity: fakeAuthIdentitySchema,
  issuedAt: instantSchema,
  expiresAt: instantSchema,
});

export type FakeAuthIdentity = z.infer<typeof fakeAuthIdentitySchema>;
export type Session = z.infer<typeof sessionSchema>;
