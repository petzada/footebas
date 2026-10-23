import type { ManagerCareer } from './career-world.js';
import type { Mentality } from './entities.js';

/** Coach personality (docs/09 decision 4, ADR 0007). */
export const COACH_PERSONALITIES = [
  'motivador',
  'disciplinador',
  'diplomata',
  'estrategista',
] as const;
export type CoachPersonality = (typeof COACH_PERSONALITIES)[number];
export const DEFAULT_COACH_PERSONALITY: CoachPersonality = 'estrategista';
export const COACH_PERSONALITY_RULES_VERSION = 'coach-personality-v1';

/**
 * Multipliers applied by pure world/application rules. 1 is neutral; every
 * value stays within ±10% so a style tilts the career without deciding it.
 * The match engine never reads this table.
 */
export interface CoachPersonalityEffects {
  /** Morale gained by the managed squad after a win. */
  readonly moraleAfterWin: number;
  /** Morale lost by the managed squad after a defeat. */
  readonly moraleAfterLoss: number;
  /** Extra factor on morale lost when the previous managed match was also lost. */
  readonly moraleAfterLossStreak: number;
  /** Condition lost by managed players per match. */
  readonly conditionLoss: number;
  /** Development quality for managed players aged 21 or less at season end. */
  readonly youthDevelopment: number;
  /** Board confidence lost at the season verdict. */
  readonly boardConfidenceLoss: number;
  /** Fan confidence gained at the season verdict. */
  readonly fanConfidenceGain: number;
  /** Asking fee on transfers and wage demanded on renewals. */
  readonly negotiationPrice: number;
  /** Effective strength of managed players when the mentality follows the plan. */
  readonly matchPlanStrength: number;
}

const NEUTRAL: CoachPersonalityEffects = Object.freeze({
  moraleAfterWin: 1,
  moraleAfterLoss: 1,
  moraleAfterLossStreak: 1,
  conditionLoss: 1,
  youthDevelopment: 1,
  boardConfidenceLoss: 1,
  fanConfidenceGain: 1,
  negotiationPrice: 1,
  matchPlanStrength: 1,
});

export const COACH_PERSONALITY_EFFECTS: Readonly<
  Record<CoachPersonality, CoachPersonalityEffects>
> = Object.freeze({
  motivador: Object.freeze({
    ...NEUTRAL,
    moraleAfterWin: 1.1,
    moraleAfterLoss: 0.9,
    fanConfidenceGain: 1.1,
  }),
  disciplinador: Object.freeze({
    ...NEUTRAL,
    conditionLoss: 0.92,
    youthDevelopment: 1.08,
    moraleAfterLossStreak: 1.1,
  }),
  diplomata: Object.freeze({
    ...NEUTRAL,
    boardConfidenceLoss: 0.9,
    negotiationPrice: 0.95,
  }),
  estrategista: Object.freeze({
    ...NEUTRAL,
    matchPlanStrength: 1.03,
  }),
});

export function coachEffects(
  personality: CoachPersonality | undefined,
): CoachPersonalityEffects {
  return COACH_PERSONALITY_EFFECTS[personality ?? DEFAULT_COACH_PERSONALITY];
}

/** FNV-1a over a key, mapped to [0, 1). Stable across runtimes. */
function unitHash(key: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash / 0x1_0000_0000;
}

/**
 * Scales an integer delta and keeps it integer without losing small effects:
 * the fractional part rounds away from zero with that probability, drawn from
 * a hash of `key`. The expected value equals `delta * factor` exactly.
 */
export function scaleIntegerDelta(
  delta: number,
  factor: number,
  key: string,
): number {
  if (delta === 0 || factor === 1) return delta;
  const exact = delta * factor;
  const whole = Math.trunc(exact);
  const fraction = Math.abs(exact - whole);
  return whole + (unitHash(key) < fraction ? Math.sign(exact) : 0);
}

/** Rescales the season verdict's confidence deltas by the coach personality. */
export function applyPersonalityToConfidence(
  before: ManagerCareer,
  after: ManagerCareer,
  personality: CoachPersonality | undefined,
): ManagerCareer {
  const effects = coachEffects(personality);
  const rescale = (from: number, to: number, gain: number, loss: number) => {
    const delta = to - from;
    const factor = delta > 0 ? gain : loss;
    return Math.max(0, Math.min(100, Math.round(from + delta * factor)));
  };
  return Object.freeze({
    ...after,
    boardConfidence: rescale(
      before.boardConfidence,
      after.boardConfidence,
      1,
      effects.boardConfidenceLoss,
    ),
    fanConfidence: rescale(
      before.fanConfidence,
      after.fanConfidence,
      effects.fanConfidenceGain,
      1,
    ),
  });
}

export type ApproximateStrength =
  | 'much_weaker'
  | 'weaker'
  | 'similar'
  | 'stronger'
  | 'much_stronger';

/** Game plan suggested by the opponent analysis (opponent relative to us). */
export function recommendedMentality(opponent: ApproximateStrength): Mentality {
  return opponent === 'stronger' || opponent === 'much_stronger'
    ? 'counter_attack'
    : opponent === 'similar'
      ? 'balanced'
      : 'all_out_attack';
}

export function followsMatchPlan(
  mentality: Mentality,
  opponent: ApproximateStrength,
): boolean {
  return mentality === recommendedMentality(opponent);
}

/** Effective strength for one match; never persisted. */
export function planStrength(
  strength: number,
  personality: CoachPersonality | undefined,
): number {
  return Math.max(
    1,
    Math.min(
      100,
      Math.round(strength * coachEffects(personality).matchPlanStrength),
    ),
  );
}

export type CoachVoiceSituation =
  | 'win'
  | 'draw'
  | 'loss'
  | 'title'
  | 'promotion'
  | 'relegation'
  | 'fired'
  | 'hired';

export interface CoachVoiceTemplate {
  readonly subject: string;
  readonly body: string;
}

/**
 * Tone of generated e-mails and news per personality. Placeholders:
 * {club}, {opponent}, {score}, {competition}, {coach}.
 */
export const COACH_VOICE: Readonly<
  Record<CoachPersonality, Readonly<Record<CoachVoiceSituation, CoachVoiceTemplate>>>
> = Object.freeze({
  motivador: Object.freeze({
    win: {
      subject: 'Que noite, {club}!',
      body: '{coach}: "Vitória por {score} sobre o {opponent}! Esse grupo tem coração, e a torcida sentiu isso."',
    },
    draw: {
      subject: 'Um ponto com garra',
      body: '{coach}: "Empate em {score} com o {opponent}. Ninguém baixou a cabeça; a próxima é nossa."',
    },
    loss: {
      subject: 'Cabeça erguida, {club}',
      body: '{coach}: "Perdemos por {score} para o {opponent}, mas acredito em cada um aqui. Vamos dar a volta por cima juntos."',
    },
    title: {
      subject: 'Campeões!',
      body: '{coach}: "O {club} conquistou {competition}! Isso é de vocês, jogadores e torcedores."',
    },
    promotion: {
      subject: 'Acesso garantido!',
      body: '{coach}: "Subimos! O {club} mostrou que união vence qualquer adversário."',
    },
    relegation: {
      subject: 'Vamos voltar mais fortes',
      body: '{coach}: "O rebaixamento dói, mas o {club} vai renascer. Conto com todos."',
    },
    fired: {
      subject: 'Obrigado, {club}',
      body: '{coach}: "Saio grato pelo carinho da torcida. Foi uma honra vestir essas cores."',
    },
    hired: {
      subject: 'Bem-vindo ao {club}',
      body: '{coach}: "Chego com muita energia. Quero ver o estádio cheio e o time jogando com alma."',
    },
  }),
  disciplinador: Object.freeze({
    win: {
      subject: 'Trabalho cumprido',
      body: '{coach}: "Vencemos o {opponent} por {score} porque seguimos o treino à risca. Amanhã, às 8h, todos no CT."',
    },
    draw: {
      subject: 'Empate exige ajustes',
      body: '{coach}: "{score} contra o {opponent}. Faltou concentração; vamos corrigir na semana."',
    },
    loss: {
      subject: 'Inaceitável',
      body: '{coach}: "Derrota por {score} para o {opponent}. Quem não estiver no limite vai perder espaço."',
    },
    title: {
      subject: 'Título fruto do método',
      body: '{coach}: "O {club} venceu {competition} com disciplina, todos os dias. Agora é manter o padrão."',
    },
    promotion: {
      subject: 'Acesso conquistado com método',
      body: '{coach}: "O {club} subiu porque ninguém relaxou. A exigência só aumenta daqui em diante."',
    },
    relegation: {
      subject: 'Rebaixamento exige mudança',
      body: '{coach}: "O {club} caiu. Vai haver cobrança e mudança de postura em todos os setores."',
    },
    fired: {
      subject: 'Fim de ciclo no {club}',
      body: '{coach}: "Respeito a decisão. Deixo um grupo mais organizado do que encontrei."',
    },
    hired: {
      subject: 'Novo comando no {club}',
      body: '{coach}: "Horário, intensidade e compromisso. Quem seguir as regras terá oportunidade."',
    },
  }),
  diplomata: Object.freeze({
    win: {
      subject: 'Resultado construído por todos',
      body: '{coach}: "Vencemos o {opponent} por {score}. Agradeço à diretoria, aos atletas e à torcida pelo apoio."',
    },
    draw: {
      subject: 'Empate respeitoso',
      body: '{coach}: "{score} com o {opponent}, um adversário qualificado. Seguimos alinhados com a diretoria."',
    },
    loss: {
      subject: 'Conversa franca após a derrota',
      body: '{coach}: "Perdemos por {score} para o {opponent}. Já conversei com a diretoria e com o grupo; o caminho é o diálogo."',
    },
    title: {
      subject: 'Título de toda a instituição',
      body: '{coach}: "{competition} é do {club} inteiro: diretoria, funcionários, atletas e torcida."',
    },
    promotion: {
      subject: 'Acesso de um projeto coletivo',
      body: '{coach}: "O acesso do {club} é fruto de um projeto bem conduzido por todos."',
    },
    relegation: {
      subject: 'Momento de serenidade',
      body: '{coach}: "O {club} foi rebaixado. Vamos avaliar tudo com calma, junto da diretoria."',
    },
    fired: {
      subject: 'Saída em bons termos',
      body: '{coach}: "Agradeço ao {club} pela confiança. Saio com as portas abertas."',
    },
    hired: {
      subject: 'Acordo fechado com o {club}',
      body: '{coach}: "Fico feliz com o acordo. Vamos construir pontes entre diretoria, elenco e torcida."',
    },
  }),
  estrategista: Object.freeze({
    win: {
      subject: 'Plano executado',
      body: '{coach}: "{score} sobre o {opponent}. O plano de jogo funcionou e os números confirmam."',
    },
    draw: {
      subject: 'Empate para estudar',
      body: '{coach}: "{score} com o {opponent}. Vou rever o vídeo e ajustar a estratégia para o próximo jogo."',
    },
    loss: {
      subject: 'Análise da derrota',
      body: '{coach}: "Perdemos por {score} para o {opponent}. Erramos na leitura do jogo; já tenho as correções."',
    },
    title: {
      subject: 'Título planejado',
      body: '{coach}: "O {club} venceu {competition}. Cada partida teve um plano, e o grupo o executou."',
    },
    promotion: {
      subject: 'Acesso dentro do planejamento',
      body: '{coach}: "O acesso do {club} confirma o planejamento da temporada."',
    },
    relegation: {
      subject: 'Revisão completa',
      body: '{coach}: "O rebaixamento do {club} exige rever o modelo de jogo do zero."',
    },
    fired: {
      subject: 'Encerramento no {club}',
      body: '{coach}: "Deixo o {club} com relatórios completos para quem chegar."',
    },
    hired: {
      subject: 'Projeto tático no {club}',
      body: '{coach}: "Já estudei o elenco do {club}. Cada adversário terá um plano específico."',
    },
  }),
});

export interface CoachVoiceNames {
  readonly coach: string;
  readonly club?: string;
  readonly opponent?: string;
  readonly score?: string;
  readonly competition?: string;
}

export function renderCoachVoice(
  personality: CoachPersonality | undefined,
  situation: CoachVoiceSituation,
  names: CoachVoiceNames,
): CoachVoiceTemplate {
  const template =
    COACH_VOICE[personality ?? DEFAULT_COACH_PERSONALITY][situation];
  const fill = (text: string) =>
    text
      .replaceAll('{coach}', names.coach)
      .replaceAll('{club}', names.club ?? 'clube')
      .replaceAll('{opponent}', names.opponent ?? 'adversário')
      .replaceAll('{score}', names.score ?? '')
      .replaceAll('{competition}', names.competition ?? 'a competição');
  return Object.freeze({
    subject: fill(template.subject),
    body: fill(template.body),
  });
}
