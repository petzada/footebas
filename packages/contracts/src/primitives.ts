import { z } from 'zod';

export const TRANSPORT_VERSION = 1 as const;
export const transportVersionSchema = z.literal(TRANSPORT_VERSION);

const stableIdPattern = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
export const entityIdSchema = z
  .string()
  .min(1)
  .max(128)
  .refine(
    (value) => z.uuid().safeParse(value).success || stableIdPattern.test(value),
    'Expected a UUID or stable snake_case identifier',
  );
export const commandIdSchema = entityIdSchema;
export const idempotencyKeySchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/);
export const versionSchema = z.int().min(0).max(Number.MAX_SAFE_INTEGER);
export const gameDateSchema = z
  .string()
  .regex(/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/);
export const instantSchema = z.iso.datetime({ offset: true });
export const checksumSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
export const nonEmptyTextSchema = z.string().trim().min(1).max(160);
export const percentageSchema = z.number().min(0).max(100);
export const moneySchema = z.int().min(0).max(Number.MAX_SAFE_INTEGER);

export const positionSchema = z.enum([
  'GK',
  'RB',
  'CB',
  'LB',
  'DM',
  'CM',
  'AM',
  'RW',
  'LW',
  'ST',
]);
export const formationSchema = z.enum(['4-4-2', '4-3-3', '3-5-2']);
export const mentalitySchema = z.enum([
  'balanced',
  'all_out_attack',
  'counter_attack',
]);
export const attackDirectionSchema = z.enum(['center', 'wings']);
export const markingIntensitySchema = z.enum(['light', 'heavy', 'very_heavy']);
export const buildUpStyleSchema = z.enum(['short', 'mixed', 'direct']);
export const attackFocusSchema = z.enum(['center', 'wings', 'balanced']);
export const pressingStyleSchema = z.enum(['low', 'medium', 'high']);
export const defensiveLineSchema = z.enum(['deep', 'normal', 'high']);
export const markingStyleSchema = z.enum(['zonal', 'mixed', 'man']);
export const playerTraitSchema = z.enum([
  'pace',
  'crossing',
  'playmaking',
  'passing',
  'heading',
  'marking',
  'tackling',
  'finishing',
  'positioning',
  'aerial_command',
  'reflexes',
  'penalty_saving',
]);

export type EntityId = z.infer<typeof entityIdSchema>;
export type GameDate = z.infer<typeof gameDateSchema>;
export type Position = z.infer<typeof positionSchema>;
