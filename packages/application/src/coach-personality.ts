import {
  DEFAULT_COACH_PROFILE,
  defaultCareerName,
  type CoachProfile,
} from '@footebas/contracts';
import {
  COACH_PERSONALITIES,
  COACH_PERSONALITY_EFFECTS,
  type CoachPersonality,
  type CoachPersonalityEffects,
} from '@footebas/domain';

export type CoachEffectKey = keyof CoachPersonalityEffects;

const EFFECT_LABELS: Readonly<Record<CoachEffectKey, string>> = {
  moraleAfterWin: 'Moral ganha pelo elenco após vitória',
  moraleAfterLoss: 'Moral perdida pelo elenco após derrota',
  moraleAfterLossStreak:
    'Moral perdida após derrota quando o jogo anterior também foi derrota',
  conditionLoss: 'Condição física perdida por partida',
  youthDevelopment: 'Qualidade de desenvolvimento dos atletas de até 21 anos',
  boardConfidenceLoss:
    'Confiança da diretoria perdida na avaliação da temporada',
  fanConfidenceGain: 'Confiança da torcida ganha na avaliação da temporada',
  negotiationPrice:
    'Valor pedido em transferências e salário exigido em renovações',
  matchPlanStrength:
    'Força efetiva na partida quando a mentalidade segue o plano (contra-ataque contra mais fortes, equilibrada contra parelhos, ataque total contra mais fracos)',
};

/** Effects where a value below 1 helps the player. */
const LOWER_IS_BETTER: ReadonlySet<CoachEffectKey> = new Set<CoachEffectKey>([
  'moraleAfterLoss',
  'moraleAfterLossStreak',
  'conditionLoss',
  'boardConfidenceLoss',
  'negotiationPrice',
]);

const PERSONALITY_LABELS: Readonly<
  Record<CoachPersonality, { label: string; tagline: string }>
> = {
  motivador: {
    label: 'Motivador',
    tagline: 'Levanta o grupo e a torcida; o elenco sente menos as derrotas.',
  },
  disciplinador: {
    label: 'Disciplinador',
    tagline:
      'Preparo físico e base em dia, mas sequências de derrota pesam no vestiário.',
  },
  diplomata: {
    label: 'Diplomata',
    tagline: 'Bom de conversa com a diretoria e nas negociações.',
  },
  estrategista: {
    label: 'Estrategista',
    tagline: 'Leva vantagem quando o plano de jogo combina com o adversário.',
  },
};

export interface CoachEffectDescription {
  readonly key: CoachEffectKey;
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

/** UI explanation of each style, derived from the rule table (ADR 0007). */
export const COACH_PERSONALITY_GUIDE: readonly CoachPersonalityGuide[] =
  Object.freeze(
    COACH_PERSONALITIES.map((id) =>
      Object.freeze({
        id,
        ...PERSONALITY_LABELS[id],
        effects: Object.freeze(
          (
            Object.entries(COACH_PERSONALITY_EFFECTS[id]) as [
              CoachEffectKey,
              number,
            ][]
          )
            .filter(([, factor]) => factor !== 1)
            .map(([key, factor]) =>
              Object.freeze({
                key,
                label: EFFECT_LABELS[key],
                percent: Math.round((factor - 1) * 100),
                favorable: LOWER_IS_BETTER.has(key) ? factor < 1 : factor > 1,
              }),
            ),
        ),
      }),
    ),
  );

export interface CareerProfile {
  readonly careerName: string;
  readonly coach: CoachProfile;
}

/** Saves created before profiles existed load with the documented defaults. */
export function careerProfileOf(snapshot: {
  readonly managerName: string;
  readonly careerName?: string;
  readonly coach?: CoachProfile;
}): CareerProfile {
  return {
    careerName: snapshot.careerName ?? defaultCareerName(snapshot.managerName),
    coach: { ...(snapshot.coach ?? DEFAULT_COACH_PROFILE) },
  };
}
