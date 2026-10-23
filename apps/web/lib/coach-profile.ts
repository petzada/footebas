/**
 * Coach profile for the New Career flow (docs/09 decision 4, ADR 0007).
 *
 * Mirrors `@footebas/contracts` (avatars, personalities, ISO codes, career
 * name rules) and `COACH_PERSONALITY_GUIDE` from `@footebas/application`
 * without shipping zod or the rules engine to the browser; a parity test
 * keeps both in sync.
 */

export const COACH_PERSONALITIES = [
  'motivador',
  'disciplinador',
  'diplomata',
  'estrategista',
] as const;
export type CoachPersonality = (typeof COACH_PERSONALITIES)[number];

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
export type CoachAvatarId = (typeof COACH_AVATARS)[number];
/** A fixed pixel avatar or the https URL of the coach's own picture. */
export type CoachAvatarRef = CoachAvatarId | `https://${string}`;

export function isAvatarUrl(avatar: string): avatar is `https://${string}` {
  return avatar.startsWith('https://') || avatar.startsWith('blob:');
}

export interface CoachProfile {
  readonly nationality: string;
  readonly avatar: CoachAvatarRef;
  readonly personality: CoachPersonality;
}

export const DEFAULT_COACH_PROFILE: CoachProfile = Object.freeze({
  nationality: 'BR',
  avatar: 'avatar-01',
  personality: 'estrategista',
});

/** Officially assigned ISO 3166-1 alpha-2 codes (same list as the contract). */
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

export const CAREER_NAME_MAX = 40;
export const COACH_NAME_MAX = 160;

/** "Carreira de <managerName>", cut to the 40-character limit. */
export function defaultCareerName(managerName: string): string {
  return `Carreira de ${managerName.trim()}`.slice(0, CAREER_NAME_MAX).trim();
}

/** Inline validation message for the career name, or `''` when valid. */
export function careerNameError(value: string): string {
  const name = value.trim();
  if (!name) return 'Dê um nome à carreira.';
  if (name.length > CAREER_NAME_MAX)
    return `Use no máximo ${CAREER_NAME_MAX} caracteres (agora são ${name.length}).`;
  return '';
}

export function coachNameError(value: string): string {
  const name = value.trim();
  if (!name) return 'Informe o nome do treinador.';
  if (name.length > COACH_NAME_MAX)
    return `Use no máximo ${COACH_NAME_MAX} caracteres.`;
  return '';
}

export interface CoachEffectDescription {
  readonly key: string;
  readonly label: string;
  /** Signed change in percent, e.g. -8 for a factor of 0.92. */
  readonly percent: number;
  readonly favorable: boolean;
}

export interface CoachPersonalityGuide {
  readonly id: CoachPersonality;
  readonly label: string;
  readonly tagline: string;
  readonly effects: readonly CoachEffectDescription[];
}

/** Same content as `COACH_PERSONALITY_GUIDE` (ADR 0007 rule table). */
export const COACH_PERSONALITY_GUIDE: readonly CoachPersonalityGuide[] = [
  {
    id: 'motivador',
    label: 'Motivador',
    tagline: 'Levanta o grupo e a torcida; o elenco sente menos as derrotas.',
    effects: [
      {
        key: 'moraleAfterWin',
        label: 'Moral ganha pelo elenco após vitória',
        percent: 10,
        favorable: true,
      },
      {
        key: 'moraleAfterLoss',
        label: 'Moral perdida pelo elenco após derrota',
        percent: -10,
        favorable: true,
      },
      {
        key: 'fanConfidenceGain',
        label: 'Confiança da torcida ganha na avaliação da temporada',
        percent: 10,
        favorable: true,
      },
    ],
  },
  {
    id: 'disciplinador',
    label: 'Disciplinador',
    tagline:
      'Preparo físico e base em dia, mas sequências de derrota pesam no vestiário.',
    effects: [
      {
        key: 'moraleAfterLossStreak',
        label:
          'Moral perdida após derrota quando o jogo anterior também foi derrota',
        percent: 10,
        favorable: false,
      },
      {
        key: 'conditionLoss',
        label: 'Condição física perdida por partida',
        percent: -8,
        favorable: true,
      },
      {
        key: 'youthDevelopment',
        label: 'Qualidade de desenvolvimento dos atletas de até 21 anos',
        percent: 8,
        favorable: true,
      },
    ],
  },
  {
    id: 'diplomata',
    label: 'Diplomata',
    tagline: 'Bom de conversa com a diretoria e nas negociações.',
    effects: [
      {
        key: 'boardConfidenceLoss',
        label: 'Confiança da diretoria perdida na avaliação da temporada',
        percent: -10,
        favorable: true,
      },
      {
        key: 'negotiationPrice',
        label: 'Valor pedido em transferências e salário exigido em renovações',
        percent: -5,
        favorable: true,
      },
    ],
  },
  {
    id: 'estrategista',
    label: 'Estrategista',
    tagline: 'Leva vantagem quando o plano de jogo combina com o adversário.',
    effects: [
      {
        key: 'matchPlanStrength',
        label:
          'Força efetiva na partida quando a mentalidade segue o plano (contra-ataque contra mais fortes, equilibrada contra parelhos, ataque total contra mais fracos)',
        percent: 3,
        favorable: true,
      },
    ],
  },
];

export function personalityLabel(personality: CoachPersonality): string {
  return (
    COACH_PERSONALITY_GUIDE.find(({ id }) => id === personality)?.label ??
    personality
  );
}

/** Flag emoji from regional indicators; decorative next to the name. */
export function flagEmoji(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(
    ...[...code].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65),
  );
}

let regionNames: Intl.DisplayNames | null | undefined;

/** Country name in Brazilian Portuguese; falls back to the code. */
export function countryName(code: string): string {
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(['pt-BR'], { type: 'region' });
    } catch {
      regionNames = null;
    }
  }
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

export interface CountryOption {
  readonly code: string;
  readonly name: string;
  readonly flag: string;
}

const fold = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

let countries: readonly CountryOption[] | undefined;

/** Every ISO country, sorted by Portuguese name. */
export function countryOptions(): readonly CountryOption[] {
  countries ??= ISO_COUNTRY_CODES.map((code) => ({
    code,
    name: countryName(code),
    flag: flagEmoji(code),
  })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  return countries;
}

/** Search by Portuguese name (accent-insensitive) or ISO code. */
export function searchCountries(query: string): readonly CountryOption[] {
  const term = fold(query);
  if (!term) return countryOptions();
  return countryOptions().filter(
    ({ code, name }) =>
      fold(name).includes(term) || code.toLowerCase() === term,
  );
}
