import { describe, expect, it } from 'vitest';
import * as contracts from '@footebas/contracts';
import { COACH_PERSONALITY_GUIDE as serverGuide } from '@footebas/application';
import {
  COACH_AVATARS,
  COACH_PERSONALITIES,
  COACH_PERSONALITY_GUIDE,
  DEFAULT_COACH_PROFILE,
  ISO_COUNTRY_CODES,
  careerNameError,
  countryName,
  defaultCareerName,
  flagEmoji,
  searchCountries,
} from '@/lib/coach-profile';

describe('perfil do treinador no web', () => {
  it('espelha o contrato e o guia de personalidades do servidor', () => {
    expect(ISO_COUNTRY_CODES).toEqual(contracts.ISO_COUNTRY_CODES);
    expect(COACH_AVATARS).toEqual(contracts.COACH_AVATARS);
    expect(COACH_PERSONALITIES).toEqual(contracts.COACH_PERSONALITIES);
    expect(DEFAULT_COACH_PROFILE).toEqual(contracts.DEFAULT_COACH_PROFILE);
    expect(COACH_PERSONALITY_GUIDE).toEqual(serverGuide);
    for (const name of ['Marcio', 'x'.repeat(100), '  Ana  '])
      expect(defaultCareerName(name)).toBe(contracts.defaultCareerName(name));
  });

  it('valida o nome da carreira como o contrato (1–40 após trim)', () => {
    for (const value of ['', '   ', 'x'.repeat(41), 'ok', 'x'.repeat(40)])
      expect(careerNameError(value) === '').toBe(
        contracts.careerNameSchema.safeParse(value).success,
      );
  });

  it('busca países por nome em português, sem acento, e mostra a bandeira', () => {
    expect(countryName('BR')).toBe('Brasil');
    expect(flagEmoji('BR')).toBe('🇧🇷');
    expect(searchCountries('alemanha').map(({ code }) => code)).toEqual(['DE']);
    expect(searchCountries('japao').map(({ code }) => code)).toEqual(['JP']);
    expect(searchCountries('pt').map(({ code }) => code)).toContain('PT');
    expect(searchCountries('')).toHaveLength(ISO_COUNTRY_CODES.length);
  });
});
