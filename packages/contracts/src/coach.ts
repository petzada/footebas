import { z } from 'zod';
import { transportVersionSchema } from './primitives.js';

/** Coach personalities (docs/09 decision 4, ADR 0007). */
export const COACH_PERSONALITIES = [
  'motivador',
  'disciplinador',
  'diplomata',
  'estrategista',
] as const;
export const coachPersonalitySchema = z.enum(COACH_PERSONALITIES);

/** Fixed avatar set offered by the new-career flow. */
export const COACH_AVATARS = [
  'avatar-01',
  'avatar-02',
  'avatar-03',
  'avatar-04',
  'avatar-05',
  'avatar-06',
  'avatar-07',
  'avatar-08',
  'avatar-09',
  'avatar-10',
  'avatar-11',
  'avatar-12',
] as const;
/** Hosts allowed for a custom avatar: our R2 CDN and Google profile photos. */
export const AVATAR_IMAGE_HOSTS = [
  'cdn.footebas.com.br',
  'lh3.googleusercontent.com',
] as const;
/** Mirrors AVATAR_IMAGE_HOSTS: https only, any path on those hosts. */
const AVATAR_URL_PATTERN =
  /^https:\/\/(cdn\.footebas\.com\.br|lh3\.googleusercontent\.com)\/\S+$/;
const avatarImageUrlSchema = z
  .string()
  .max(500)
  .regex(
    AVATAR_URL_PATTERN,
    'Expected an avatar image from the Footebas CDN or Google',
  );
/** A pixel avatar id, or the URL of an uploaded or Google profile picture. */
export const coachAvatarSchema = z.union([
  z.enum(COACH_AVATARS),
  avatarImageUrlSchema,
]);

/** Officially assigned ISO 3166-1 alpha-2 codes. */
export const ISO_COUNTRY_CODES: readonly string[] = Object.freeze(
  (
    'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ ' +
    'BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
    'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ ' +
    'DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR ' +
    'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY ' +
    'HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP ' +
    'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY ' +
    'MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ ' +
    'NA NC NE NF NG NI NL NO NP NR NU NZ OM ' +
    'PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW ' +
    'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ ' +
    'TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ ' +
    'UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
  ).split(' '),
);
const countryCodes = new Set(ISO_COUNTRY_CODES);
export const countryCodeSchema = z
  .string()
  .length(2)
  .refine(
    (value) => countryCodes.has(value),
    'Expected an ISO 3166-1 alpha-2 code',
  );

export const careerNameSchema = z.string().trim().min(1).max(40);

export const coachProfileSchema = z.strictObject({
  nationality: countryCodeSchema,
  avatar: coachAvatarSchema,
  personality: coachPersonalitySchema,
});

export const DEFAULT_COACH_PROFILE: CoachProfile = Object.freeze({
  nationality: 'BR',
  avatar: 'avatar-01',
  personality: 'estrategista',
});

/** "Carreira de <managerName>", cut to the 40-character limit. */
export function defaultCareerName(managerName: string): string {
  return `Carreira de ${managerName.trim()}`.slice(0, 40).trim();
}

/** Public counters for the Início screen (docs/09 decision 9). */
export const publicStatsSchema = z.strictObject({
  version: transportVersionSchema,
  coaches: z.int().min(0),
  clubs: z.int().min(0),
  athletes: z.int().min(0),
});

export const planSchema = z.enum(['free', 'licensed']);
export const careerLimitsSchema = z.strictObject({
  plan: planSchema,
  maxCareers: z.int().min(0),
  anyClub: z.boolean(),
  activeCareers: z.int().min(0),
});

export type CoachPersonalityName = z.infer<typeof coachPersonalitySchema>;
export type CoachAvatar = z.infer<typeof coachAvatarSchema>;
export type CoachProfile = z.infer<typeof coachProfileSchema>;
export type PublicStats = z.infer<typeof publicStatsSchema>;
export type CareerLimits = z.infer<typeof careerLimitsSchema>;
