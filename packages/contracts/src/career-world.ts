import { z } from 'zod';
import {
  entityIdSchema,
  gameDateSchema,
  instantSchema,
  moneySchema,
  nonEmptyTextSchema,
  percentageSchema,
  positionSchema,
  transportVersionSchema,
  versionSchema,
} from './primitives.js';
import {
  careerLimitsSchema,
  careerNameSchema,
  coachProfileSchema,
} from './coach.js';

const signedMoneySchema = z
  .int()
  .min(Number.MIN_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER);

/** Everything the club, finance, board, jobs and history screens show. */
export const careerWorldReadModelSchema = z.strictObject({
  version: transportVersionSchema,
  careerId: entityIdSchema,
  aggregateVersion: versionSchema,
  projectedAt: instantSchema,
  season: z.int().positive(),
  currentDate: gameDateSchema,
  manager: z.strictObject({
    managerId: entityIdSchema,
    employmentStatus: z.enum(['employed', 'available', 'retired']),
    clubId: entityIdSchema.optional(),
    boardConfidence: percentageSchema,
    fanConfidence: percentageSchema,
    prestige: z.number().min(0),
    seasons: z.int().min(0),
  }),
  club: z
    .strictObject({
      id: entityIdSchema,
      name: nonEmptyTextSchema,
      cash: signedMoneySchema,
      openingBalance: signedMoneySchema,
      monthlyWageBill: moneySchema,
      stadium: z.strictObject({
        capacity: z.int().positive(),
        ticketPrice: moneySchema,
        maintenance: moneySchema,
        quality: z.int().min(0).max(100),
        expansion: z
          .strictObject({
            addedCapacity: z.int().positive(),
            cost: moneySchema,
            completesOn: gameDateSchema,
          })
          .optional(),
      }),
    })
    .optional(),
  ledger: z
    .array(
      z.strictObject({
        id: entityIdSchema,
        occurredAt: z.string().min(1),
        kind: z.enum([
          'wages',
          'transfer',
          'gate',
          'sponsor',
          'prize',
          'stadium',
          'membership',
          'sponsor_termination',
        ]),
        amount: signedMoneySchema,
        label: nonEmptyTextSchema,
      }),
    )
    .max(200),
  objectives: z.array(
    z.strictObject({
      id: entityIdSchema,
      metric: z.enum([
        'league_position',
        'promotion',
        'avoid_relegation',
        'financial_balance',
        'youth_promotions',
      ]),
      target: z.number(),
      progress: z.number(),
      status: z.enum(['active', 'met', 'failed']),
    }),
  ),
  jobProposals: z.array(
    z.strictObject({
      id: entityIdSchema,
      clubId: entityIdSchema,
      clubName: nonEmptyTextSchema,
      expiresOn: gameDateSchema,
      minimumPrestige: z.number().min(0),
      status: z.enum(['open', 'accepted', 'rejected', 'expired']),
    }),
  ),
  contracts: z.array(
    z.strictObject({
      contractId: entityIdSchema,
      playerId: entityIdSchema,
      playerName: nonEmptyTextSchema,
      endsOn: gameDateSchema,
      wage: moneySchema,
      status: z.enum(['active', 'expiring', 'expired', 'terminated']),
    }),
  ),
  offers: z.array(
    z.strictObject({
      id: entityIdSchema,
      playerId: entityIdSchema,
      playerName: nonEmptyTextSchema,
      kind: z.enum(['buy', 'loan']),
      fee: moneySchema,
      wage: moneySchema,
      status: z.string().min(1),
      expiresOn: gameDateSchema,
      counterOf: entityIdSchema.optional(),
    }),
  ),
  youth: z.array(
    z.strictObject({
      playerId: entityIdSchema,
      name: nonEmptyTextSchema,
      position: positionSchema,
      age: z.int().min(14).max(60),
      estimate: z.enum(['limited', 'promising', 'exceptional']),
      status: z.enum(['academy', 'promoted', 'released']),
    }),
  ),
  history: z
    .array(
      z.strictObject({
        id: entityIdSchema,
        type: z.enum([
          'title',
          'promotion',
          'relegation',
          'top_scorer',
          'record',
          'idol',
          'manager_fired',
          'transfer',
          'retirement',
        ]),
        season: z.int().positive(),
        occurredOn: gameDateSchema,
        clubName: nonEmptyTextSchema.optional(),
        competitionId: entityIdSchema.optional(),
        playerName: nonEmptyTextSchema.optional(),
      }),
    )
    .max(200),
});

export const careerListReadModelSchema = z.strictObject({
  version: transportVersionSchema,
  careers: z.array(
    z.strictObject({
      careerId: entityIdSchema,
      aggregateVersion: versionSchema,
      managerName: nonEmptyTextSchema,
      careerName: careerNameSchema,
      coach: coachProfileSchema,
      clubId: entityIdSchema.optional(),
      clubName: nonEmptyTextSchema.optional(),
      season: z.int().positive(),
      currentDate: gameDateSchema,
    }),
  ),
  /** Plan limit (docs/09 decision 5): active careers against maxCareers. */
  limits: careerLimitsSchema,
});

export const devSessionRequestSchema = z.strictObject({
  email: z.email(),
  displayName: nonEmptyTextSchema.optional(),
});

export type CareerListReadModel = z.infer<typeof careerListReadModelSchema>;
export type CareerWorldReadModel = z.infer<typeof careerWorldReadModelSchema>;
