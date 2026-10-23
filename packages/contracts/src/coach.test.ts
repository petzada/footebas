import { describe, expect, it } from 'vitest';
import {
  COACH_AVATARS,
  COACH_PERSONALITIES,
  ISO_COUNTRY_CODES,
  apiErrorSchema,
  careerListReadModelSchema,
  commandSchema,
  createCareerCommandSchema,
  defaultCareerName,
  deleteCareerCommandSchema,
  publicStatsSchema,
} from './index.js';

const envelope = {
  version: 1,
  commandId: 'cmd_create_1',
  idempotencyKey: 'career:create:1',
  expectedVersion: 0,
} as const;
const coach = {
  nationality: 'PT',
  avatar: 'avatar-07',
  personality: 'diplomata',
} as const;

describe('coach profile and career limit contracts', () => {
  it('accepts CreateCareer with and without the optional profile', () => {
    const minimal = {
      ...envelope,
      type: 'CreateCareer',
      payload: { managerName: 'Ada', startDate: '2026-01-01' },
    };
    expect(createCareerCommandSchema.safeParse(minimal).success).toBe(true);
    const full = {
      ...minimal,
      payload: { ...minimal.payload, careerName: 'Rumo ao topo', coach },
    };
    expect(commandSchema.parse(full)).toEqual(full);
  });

  it('rejects invalid career names, nationalities, avatars and personalities', () => {
    const payload = { managerName: 'Ada', startDate: '2026-01-01' };
    const invalid = [
      { ...payload, careerName: '' },
      { ...payload, careerName: 'x'.repeat(41) },
      { ...payload, coach: { ...coach, nationality: 'XX' } },
      { ...payload, coach: { ...coach, nationality: 'br' } },
      { ...payload, coach: { ...coach, avatar: 'avatar-13' } },
      { ...payload, coach: { ...coach, personality: 'carrasco' } },
      { ...payload, coach: { nationality: 'BR' } },
    ];
    for (const candidate of invalid)
      expect(
        createCareerCommandSchema.safeParse({
          ...envelope,
          type: 'CreateCareer',
          payload: candidate,
        }).success,
      ).toBe(false);
  });

  it('exports the fixed avatar set, personalities and ISO codes', () => {
    expect(COACH_AVATARS).toHaveLength(12);
    expect(COACH_AVATARS[0]).toBe('avatar-01');
    expect(COACH_AVATARS[11]).toBe('avatar-12');
    expect(COACH_PERSONALITIES).toEqual([
      'motivador',
      'disciplinador',
      'diplomata',
      'estrategista',
    ]);
    expect(ISO_COUNTRY_CODES).toHaveLength(249);
    expect(new Set(ISO_COUNTRY_CODES).size).toBe(249);
    expect(ISO_COUNTRY_CODES).toContain('BR');
  });

  it('defaults the career name within 40 characters', () => {
    expect(defaultCareerName('Marcio')).toBe('Carreira de Marcio');
    expect(defaultCareerName('x'.repeat(100))).toHaveLength(40);
  });

  it('accepts DeleteCareer, CAREER_LIMIT_REACHED and public stats', () => {
    expect(
      deleteCareerCommandSchema.safeParse({
        ...envelope,
        expectedVersion: 3,
        type: 'DeleteCareer',
        payload: { careerId: 'career_1' },
      }).success,
    ).toBe(true);
    const base = {
      version: 1,
      requestId: 'request_1',
      code: 'CAREER_LIMIT_REACHED',
      message: 'limit',
    };
    expect(apiErrorSchema.safeParse(base).success).toBe(true);
    expect(
      apiErrorSchema.safeParse({ ...base, plan: 'free', maxCareers: 1 })
        .success,
    ).toBe(true);
    expect(
      publicStatsSchema.safeParse({
        version: 1,
        coaches: 3,
        clubs: 60,
        athletes: 1800,
      }).success,
    ).toBe(true);
    expect(
      publicStatsSchema.safeParse({
        version: 1,
        coaches: -1,
        clubs: 0,
        athletes: 0,
      }).success,
    ).toBe(false);
  });

  it('lists careers with name, coach profile and plan limits', () => {
    expect(
      careerListReadModelSchema.safeParse({
        version: 1,
        limits: {
          plan: 'free',
          maxCareers: 1,
          anyClub: false,
          activeCareers: 1,
        },
        careers: [
          {
            careerId: 'career_1',
            aggregateVersion: 2,
            managerName: 'Ada',
            careerName: 'Carreira de Ada',
            coach,
            season: 1,
            currentDate: '2026-01-01',
          },
        ],
      }).success,
    ).toBe(true);
  });
});
