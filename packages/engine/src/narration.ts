import type {
  ChanceOutcome,
  MatchEvent,
  MatchPlay,
  MatchSide,
} from '@footebas/domain';
import { hashSeed } from './prng.js';

/**
 * Narration of a match timeline in Brazilian Portuguese (ADR 0015).
 *
 * Pure presentation: it never changes the result. Every phrase is chosen
 * deterministically from the match key (match id or seed) and the event
 * itself, avoiding phrases used recently in the same match. The choice only
 * depends on the event and on what was narrated before it, so the narration
 * of everything already shown stays identical when the manager changes
 * something at minute m (the engine is prefix-stable).
 */
export const NARRATION_VERSION = 'narracao-ptbr-v1' as const;

export type NarrationKind =
  | 'kickoff'
  | 'chance'
  | 'goal'
  | 'card'
  | 'injury'
  | 'substitution'
  | 'tactical_change'
  | 'half_time'
  | 'second_half'
  | 'full_time';

/**
 * A timeline event as the engine records it, or as the read model exposes it
 * (goal with `playerId`, tactical change with `formation`/`mentality`). The
 * richer fields (shooter, play, outcome) are optional.
 */
export interface NarrationEvent {
  readonly type: MatchEvent['type'];
  readonly minute: number;
  readonly side: MatchSide;
  readonly xg?: number;
  readonly playerId?: string;
  readonly scorerId?: string;
  readonly assistId?: string;
  readonly play?: MatchPlay;
  readonly outcome?: ChanceOutcome;
  readonly card?: 'yellow' | 'red';
  readonly playerInId?: string;
  readonly playerOutId?: string;
  readonly source?: 'manager' | 'automatic';
  readonly tactic?: Readonly<{ formation?: string; mentality?: string }>;
  readonly formation?: string;
  readonly mentality?: string;
}

export interface NarrationContext {
  /** Variation source: the match id (derived from the seed) by default. */
  readonly key?: string;
  readonly home: Readonly<{ name: string }>;
  readonly away: Readonly<{ name: string }>;
  readonly playerNames: ReadonlyMap<string, string>;
  /** Competition name, when known ("Brasileirão Série A"). */
  readonly competition?: string;
  /** Classic rivalry, when the caller knows it. */
  readonly derby?: boolean;
}

export interface NarrationLine {
  readonly kind: NarrationKind;
  readonly minute: number;
  readonly side?: MatchSide;
  readonly text: string;
  /** Index of the timeline event narrated, absent for structural lines. */
  readonly eventIndex?: number;
  /** Score after this line. */
  readonly score: Readonly<{ home: number; away: number }>;
}

type Template = string;

// --- templates ------------------------------------------------------------------
// Placeholders: {time} attacking club, {adv} opponent, {j} player, {a} assistant,
// {in}/{out} substitution, {casa}/{fora} clubs, {placar} home × away,
// {placarV} winner first, {vencedor}/{lider}, {min} minute, {comp} competition.

const KICKOFF: readonly Template[] = [
  'Bola rolando: {casa} × {fora}{comp}!',
  'Começa o jogo{comp}! {casa} recebe o {fora}.',
  'Apita o árbitro e a bola rola para {casa} × {fora}.',
  'Está valendo! {casa} e {fora} se enfrentam{comp}.',
  'Autorizado o início de {casa} × {fora}, arquibancada cheia.',
  'Começou! O {fora} visita o {casa}{comp}.',
  'A bola já rola para {casa} × {fora}.',
  'Primeiro tempo em andamento: {casa} × {fora}{comp}.',
];
const KICKOFF_DERBY: readonly Template[] = [
  'É dia de clássico! {casa} × {fora}, bola rolando.',
  'Clássico autorizado: {casa} e {fora} frente a frente{comp}.',
  'Rivalidade em campo! Começa {casa} × {fora}.',
];

const LEADS: Readonly<Record<MatchPlay, readonly Template[]>> = {
  build_up: [
    'O {time} troca passes com paciência e {j} aparece na entrada da área.',
    'Boa trama do {time} pelo meio; {j} recebe para finalizar.',
    'Toque, toque e toque: o {time} envolve a marcação e {j} arma o chute.',
    '{a} enfia a bola e {j} chega batendo.',
    'O {time} roda a bola de um lado ao outro até achar {j} em boas condições.',
    'Triangulação bonita do {time}, e a bola sobra para {j}.',
    '{j} tabela com {a} e invade a área.',
    'Ataque posicional do {time}: {j} encontra espaço entre as linhas.',
    'O {time} tem a bola, cadencia, e {j} finaliza.',
  ],
  counter: [
    'Contra-ataque rápido do {time}! {j} dispara em velocidade.',
    'Roubada no meio e o {time} sai em velocidade com {j}.',
    '{a} lança em profundidade e {j} parte sozinho no contragolpe.',
    'Três contra dois para o {time} na transição; {j} conduz.',
    'O {adv} se desarruma atrás e {j} puxa o contra-ataque.',
    'Saída rápida do {time}: a bola chega a {j} em poucos toques.',
    'Contragolpe desenhado pelo {time}, {j} na cara do gol.',
    'O {time} aproveita o campo aberto e {j} acelera rumo à área.',
  ],
  individual: [
    '{j} pega a bola, passa por um, passa por dois…',
    'Jogada individual de {j}, que corta para dentro e procura o ângulo.',
    '{j} chama a marcação para dançar e abre espaço para o chute.',
    'Drible desconcertante de {j} pela ponta.',
    '{j} carrega a bola desde o meio-campo, ninguém consegue parar.',
    'Lance de habilidade: {j} dá um corte seco no zagueiro do {adv}.',
    '{j} resolve sozinho e arrisca depois de limpar a jogada.',
    'Arrancada de {j}, que deixa o marcador no chão.',
  ],
  cross: [
    'Cruzamento na área do {adv}, {j} sobe mais que todo mundo.',
    '{a} levanta na segunda trave e {j} cabeceia.',
    'Bola alçada na área, {j} aparece entre os zagueiros.',
    '{a} vai ao fundo e cruza rasteiro para {j}.',
    'O {time} insiste pelos lados; cruzamento e {j} tenta de cabeça.',
    'Cruzamento venenoso, a bola atravessa a área e encontra {j}.',
    '{j} se antecipa à marcação no cruzamento.',
    'Chuveirinho do {time} e {j} disputa pelo alto.',
  ],
  long_shot: [
    '{j} arrisca de longe!',
    'Chute de fora da área de {j}.',
    '{j} ajeita e solta a bomba de média distância.',
    'Sem opção de passe, {j} tenta de muito longe.',
    '{j} pega de primeira, de fora da área.',
    'A bola sobra na intermediária e {j} enche o pé.',
    'Tentativa de longa distância de {j}, com efeito.',
    '{j} vê o goleiro adiantado e tenta surpreender de longe.',
  ],
  defensive_error: [
    'Erro na saída de bola do {adv}! {j} rouba e parte para o gol.',
    'Recuo errado da defesa do {adv}, e {j} fica com a bola.',
    'O {adv} vacila na saída e {j} aproveita o presente.',
    'Passe errado do {adv} no próprio campo; {j} intercepta.',
    'Falha de comunicação na defesa do {adv}, a bola fica com {j}.',
    'Pressão do {time} na saída, o {adv} entrega e {j} agradece.',
    'O goleiro do {adv} sai mal jogando e {j} está ali.',
  ],
};

const OUTCOMES: Readonly<
  Record<Exclude<ChanceOutcome, 'goal'>, readonly Template[]>
> = {
  saved: [
    'O goleiro defende!',
    'Defesaça do goleiro do {adv}!',
    'Mas o goleiro do {adv} encaixa firme.',
    'O goleiro espalma para escanteio.',
    'Bola no meio do gol, defesa tranquila.',
    'O goleiro do {adv} voa e salva!',
    'Saiu fraco, nas mãos do goleiro.',
    'O goleiro fecha o ângulo e evita o gol.',
  ],
  off_target: [
    'Pra fora, rente à trave.',
    'Passou longe do gol.',
    'Por cima do travessão.',
    'A bola sai pela linha de fundo.',
    'Isolou! Foi parar na arquibancada.',
    'Tirou demais, saiu ao lado.',
    'Raspando a trave, mas pra fora.',
    'Desperdiçou uma boa oportunidade.',
  ],
  blocked: [
    'A zaga do {adv} trava o chute.',
    'Bloqueio providencial da defesa.',
    'Um zagueiro se joga e desvia.',
    'A defesa do {adv} corta na hora H.',
    'Chute travado na entrada da área.',
    'Carrinho salvador da defesa do {adv}.',
  ],
  woodwork: [
    'Na trave!',
    'Explodiu no travessão!',
    'A bola beija a trave e sai!',
    'No poste! Por muito pouco.',
    'Bateu na trave e voltou para o jogo.',
  ],
};

/** Chances without a known shooter (older read models): by danger. */
const ANONYMOUS_CHANCES: Readonly<Record<'low' | 'mid' | 'high', Template[]>> =
  {
    low: [
      'O {time} arrisca de longe, sem perigo.',
      'Tentativa tímida do {time}.',
      'O {time} chega, mas a finalização sai fraca.',
      'Chute de fora do {time}, a bola passa longe.',
      'O {time} tenta, mas a defesa do {adv} está bem postada.',
      'Finalização apressada do {time}.',
      'O {time} rodeia a área e finaliza sem direção.',
    ],
    mid: [
      'O {time} finaliza e assusta.',
      'Boa chegada do {time}, o goleiro do {adv} trabalha.',
      'O {time} cria e finaliza com perigo.',
      'Jogada perigosa do {time} pelo lado do campo.',
      'O {time} invade a área e chuta.',
      'Ataque do {time} que leva perigo ao gol do {adv}.',
      'Cruzamento do {time}, a bola passa perto.',
    ],
    high: [
      'Chance claríssima para o {time}!',
      'Que oportunidade do {time}! Cara a cara com o goleiro.',
      'O {time} perdeu uma chance incrível!',
      'Quase! O {time} esteve a centímetros do gol.',
      'Lance capital: o {time} na pequena área!',
      'Inacreditável o que o {time} desperdiçou!',
    ],
  };

const GOALS: readonly Template[] = [
  'GOOOL do {time}! {j} balança a rede!',
  'É GOL! {j} marca para o {time}!',
  'GOL! {j} não perdoa e põe a bola no fundo da rede.',
  'Lá dentro! {j} faz o gol do {time}.',
  'GOL do {time}! Que finalização de {j}!',
  'Bola na rede! {j} corre para a torcida do {time}.',
  'GOL! {j} deixa a sua marca.',
  'GOL do {time}! {j} estufa as redes.',
  'GOL! {j} manda para o fundo do barbante e a festa explode.',
  'É dele! GOL de {j} para o {time}.',
  'GOL! Frieza total de {j}.',
  'Rede balançando: GOL de {j} para o {time}!',
];
const GOAL_PLAY: Readonly<Record<MatchPlay, readonly Template[]>> = {
  build_up: [
    'GOL do {time}, gol de time! {j} completa a troca de passes.',
    'GOL! Jogada coletiva primorosa terminada por {j}.',
  ],
  counter: [
    'GOL de contra-ataque! {j} finaliza com categoria.',
    'GOL! O {time} mata no contragolpe com {j}.',
  ],
  individual: [
    'GOLAÇO! {j} faz tudo sozinho!',
    'GOL! Que jogada individual de {j}, um lance de craque.',
  ],
  cross: [
    'GOL de cabeça! {j} testa firme para o {time}.',
    'GOL! {j} completa o cruzamento e balança a rede.',
  ],
  long_shot: [
    'GOLAÇO de fora da área! {j} acerta um chutaço!',
    'GOL! Bomba de longe de {j}, sem chance para o goleiro.',
  ],
  defensive_error: [
    'GOL! {j} aproveita o erro do {adv} e não perdoa.',
    'GOL do {time}! {j} castiga a falha da defesa do {adv}.',
  ],
};
const ASSISTS: readonly Template[] = [
  'Passe de {a}.',
  'Assistência de {a}.',
  '{a} deu o passe na medida.',
  'Grande passe de {a}.',
  'A jogada nasceu nos pés de {a}.',
  'A assistência foi de {a}.',
];
const GOAL_CONTEXT = {
  opener: [
    'Abre o placar: {placar}.',
    'Saiu o primeiro gol: {placar}.',
    'O {time} abre o marcador, {placar}.',
    'Primeiro gol do jogo: {placar}.',
    'O placar é inaugurado: {placar}.',
  ],
  equalizer: [
    'Tudo igual: {placar}.',
    'Está empatado! {placar}.',
    'O {time} busca o empate: {placar}.',
    'Jogo empatado de novo, {placar}.',
    'E o placar volta a ficar igual, {placar}.',
  ],
  ahead: [
    'O {time} passa à frente: {placar}.',
    'O {time} desempata: {placar}.',
    'Vantagem do {time}: {placar}.',
    'O {time} volta a liderar o placar, {placar}.',
  ],
  extend: [
    'Amplia: {placar}.',
    'O {time} aumenta a vantagem, {placar}.',
    'Mais um! {placar}.',
    'O {time} dispara no placar: {placar}.',
    'Vantagem confortável: {placar}.',
  ],
  reduce: [
    'O {time} desconta: {placar}.',
    'O {time} diminui: {placar}.',
    'O {time} encosta no placar, {placar}.',
    'Reação do {time}: {placar}.',
    'Ainda há jogo! {placar}.',
  ],
  late: [
    'Gol nos minutos finais!',
    'Já no fim do jogo!',
    'Na reta final, que momento!',
    'Gol tardio que pode valer muito!',
    'Aos {min} minutos, que drama!',
  ],
  brace: [
    'É o segundo dele no jogo!',
    '{j} marca de novo, dois na partida!',
    'Doblete de {j}!',
  ],
  hatTrick: [
    'Três gols de {j}! Noite inesquecível.',
    'Hat-trick de {j}! A bola é dele.',
    '{j} chega ao terceiro gol, partida histórica!',
  ],
  derby: [
    'O clássico pega fogo!',
    'Que clássico!',
    'A rivalidade ferve na arquibancada!',
  ],
} as const;

const YELLOW: readonly Template[] = [
  'Cartão amarelo para {j}, do {time}.',
  '{j} chega atrasado e leva o amarelo.',
  'Amarelo para {j}, que reclama muito.',
  'O árbitro mostra o amarelo a {j}.',
  'Falta dura de {j}: cartão amarelo.',
  '{j} para o contra-ataque com falta e é advertido.',
  'Advertência para {j}, do {time}.',
  '{j} recebe o amarelo e vai ter de tomar cuidado.',
];
const RED: readonly Template[] = [
  'Cartão vermelho! {j} está expulso.',
  'Expulsão! {j} deixa o {time} com um a menos.',
  'Vermelho para {j}!',
  '{j} vai mais cedo para o chuveiro: expulso.',
  'O árbitro não hesita: vermelho para {j}.',
  '{j} é expulso e complica a vida do {time}.',
];
const INJURY: readonly Template[] = [
  '{j} sente a coxa e pede atendimento.',
  'Preocupação no {time}: {j} cai sentindo dores.',
  '{j} se machuca no lance e o departamento médico entra em campo.',
  'Lesão para {j}; o {time} vai ter de mexer.',
  '{j} sai mancando, parece problema muscular.',
  'Atendimento a {j}, que não consegue continuar.',
];
const SUBSTITUTION: readonly Template[] = [
  'Substituição no {time}: entra {in}, sai {out}.',
  '{in} entra no lugar de {out} no {time}.',
  'Mudança no {time}: sai {out}, entra {in}.',
  'O técnico do {time} mexe: {in} na vaga de {out}.',
  '{out} deixa o campo; {in} é a novidade do {time}.',
  'Troca no {time}: {in} substitui {out}.',
];
const MANAGER_SUBSTITUTION: readonly Template[] = [
  'Decisão do treinador: no {time}, entra {in} e sai {out}.',
  'O treinador do {time} chama {in} para o lugar de {out}.',
  'Mexida planejada no {time}: {in} entra, {out} sai.',
  'O {time} muda por ordem do banco: sai {out}, entra {in}.',
  '{in} recebe as instruções e entra no lugar de {out}.',
  'Aposta do treinador: {in} vai a campo na vaga de {out}.',
];
const TACTICS: Readonly<Record<string, readonly Template[]>> = {
  all_out_attack: [
    'O {time} adianta as linhas e parte para o ataque.',
    'Ordem do banco: {time} todo no ataque!',
    'O {time} se lança à frente em busca do gol.',
    'Mudança de postura: o {time} pressiona no campo de ataque.',
  ],
  counter_attack: [
    'O {time} recua e passa a apostar no contra-ataque.',
    'O {time} se fecha e espera o adversário.',
    'Postura mais cautelosa do {time}, linhas baixas.',
    'O {time} abaixa o bloco e explora a velocidade.',
  ],
  balanced: [
    'O {time} volta ao equilíbrio entre defesa e ataque.',
    'Ajuste tático no {time}: postura equilibrada.',
    'O {time} reorganiza as linhas.',
    'O {time} muda o desenho tático.',
  ],
};
const TACTICS_BALANCED = TACTICS.balanced ?? [];
const HALF_TIME = {
  goalless: [
    'Fim do primeiro tempo: 0 × 0. Tudo em aberto.',
    'Intervalo sem gols entre {casa} e {fora}.',
    'Primeiro tempo termina zerado.',
    'Vestiário com o placar em branco: {casa} 0 × 0 {fora}.',
  ],
  draw: [
    'Intervalo: {casa} {placar} {fora}, tudo igual.',
    'Fim do primeiro tempo, empate em {placar}.',
    'Os times vão para o vestiário empatados: {placar}.',
    'Primeira etapa encerrada com igualdade: {placar}.',
  ],
  leading: [
    'Fim do primeiro tempo: {lider} vence por {placarV}.',
    'Intervalo com o {lider} na frente: {placarV}.',
    'O {lider} vai para o vestiário em vantagem, {placarV}.',
    'Primeiro tempo encerrado, {lider} ganha por {placarV}.',
    'O {lider} sai na frente no primeiro tempo: {placarV}.',
  ],
} as const;
const SECOND_HALF: readonly Template[] = [
  'Bola rolando para o segundo tempo.',
  'Começa a etapa final!',
  'Recomeça o jogo: segundo tempo em andamento.',
  'Os times voltam do intervalo; segundo tempo valendo.',
  'Segundo tempo começa: {casa} {placar} {fora}.',
  'Etapa final autorizada pelo árbitro.',
];
const FULL_TIME = {
  draw: [
    'Fim de jogo: {casa} {placar} {fora}. Empate.',
    'Apita o árbitro! Tudo igual: {placar}.',
    'Termina empatado, {placar}.',
    'Acabou: {casa} e {fora} dividem os pontos, {placar}.',
    'Fim de papo, empate em {placar}.',
  ],
  win: [
    'Fim de jogo: vitória do {vencedor}, {placarV}.',
    'Acabou! O {vencedor} vence por {placarV}.',
    'Apita o árbitro: {casa} {placar} {fora}, vitória do {vencedor}.',
    'Fim de partida, o {vencedor} leva a melhor: {placarV}.',
    'Termina o jogo com triunfo do {vencedor}, {placarV}.',
    'Vitória do {vencedor}! Placar final: {casa} {placar} {fora}.',
  ],
  rout: [
    'Goleada! O {vencedor} atropela: {placarV}.',
    'Fim de jogo com passeio do {vencedor}, {placarV}.',
    'Noite de gala do {vencedor}: {placarV}.',
    'Atropelo em campo: {vencedor} {placarV}.',
  ],
} as const;

// --- selection -----------------------------------------------------------------

class Chooser {
  readonly #key: string;
  readonly #recent = new Map<string, string[]>();
  constructor(key: string) {
    this.#key = key;
  }
  /**
   * Deterministic pick by (key, signature) that skips the phrases used most
   * recently in this match for the same group.
   */
  pick(
    group: string,
    signature: string,
    templates: readonly Template[],
  ): Template {
    const recent = this.#recent.get(group) ?? [];
    const start = hashSeed(`${this.#key}|${group}|${signature}`);
    const rotated = templates.map(
      (_, offset) => templates[(start + offset) % templates.length] ?? '',
    );
    const chosen =
      rotated.find((candidate) => !recent.includes(candidate)) ??
      rotated[0] ??
      '';
    const memory = Math.max(1, Math.min(templates.length - 1, 6));
    this.#recent.set(group, [...recent, chosen].slice(-memory));
    return chosen;
  }
}

function fill(template: Template, values: Readonly<Record<string, string>>) {
  return template.replace(
    /\{(\w+)\}/g,
    (match, key: string) => values[key] ?? match,
  );
}

const usable = (templates: readonly Template[], hasAssist: boolean) =>
  hasAssist ? templates : templates.filter((t) => !t.includes('{a}'));

function isManagerEvent(event: NarrationEvent): boolean {
  return (
    event.type === 'tactical_change' ||
    (event.type === 'substitution' && event.source === 'manager')
  );
}

export function narrateTimeline(
  timeline: readonly NarrationEvent[],
  context: NarrationContext & { readonly key: string },
): NarrationLine[] {
  const chooser = new Chooser(context.key);
  const score = { home: 0, away: 0 };
  const goalsBy = new Map<string, number>();
  const lines: NarrationLine[] = [];
  const club = (side: MatchSide) =>
    side === 'home' ? context.home.name : context.away.name;
  const name = (id: string | undefined) =>
    id === undefined ? undefined : context.playerNames.get(id);
  const placar = () => `${String(score.home)} × ${String(score.away)}`;
  const base = () => {
    const leader =
      score.home === score.away
        ? undefined
        : score.home > score.away
          ? context.home.name
          : context.away.name;
    return {
      casa: context.home.name,
      fora: context.away.name,
      placar: placar(),
      placarV: `${String(Math.max(score.home, score.away))} × ${String(Math.min(score.home, score.away))}`,
      lider: leader ?? '',
      vencedor: leader ?? '',
      comp:
        context.competition === undefined ? '' : ` (${context.competition})`,
    };
  };
  const push = (line: Omit<NarrationLine, 'score'>) =>
    lines.push(Object.freeze({ ...line, score: Object.freeze({ ...score }) }));

  push({
    kind: 'kickoff',
    minute: 0,
    text: fill(
      chooser.pick(
        'kickoff',
        'kickoff',
        context.derby === true ? [...KICKOFF_DERBY, ...KICKOFF] : KICKOFF,
      ),
      base(),
    ),
  });
  let halfTime = false;
  let secondHalf = false;
  const closeFirstHalf = () => {
    if (halfTime) return;
    halfTime = true;
    const group =
      score.home + score.away === 0
        ? HALF_TIME.goalless
        : score.home === score.away
          ? HALF_TIME.draw
          : HALF_TIME.leading;
    push({
      kind: 'half_time',
      minute: 45,
      text: fill(chooser.pick('half_time', placar(), group), base()),
    });
  };
  const openSecondHalf = () => {
    closeFirstHalf();
    if (secondHalf) return;
    secondHalf = true;
    push({
      kind: 'second_half',
      minute: 46,
      text: fill(chooser.pick('second_half', placar(), SECOND_HALF), base()),
    });
  };

  timeline.forEach((event, eventIndex) => {
    if (event.minute > 45) openSecondHalf();
    else if (event.minute === 45 && isManagerEvent(event)) closeFirstHalf();
    const time = club(event.side);
    const adv = club(event.side === 'home' ? 'away' : 'home');
    const signature = `${event.type}|${String(event.minute)}|${event.side}|${event.playerId ?? event.scorerId ?? event.playerInId ?? ''}|${String(event.xg ?? '')}`;
    const values = {
      ...base(),
      time,
      adv,
      min: String(event.minute),
    };
    const line = (kind: NarrationKind, text: string) =>
      push({ kind, minute: event.minute, side: event.side, text, eventIndex });
    switch (event.type) {
      case 'chance': {
        const shooter = name(event.playerId);
        const assistant = name(event.assistId);
        if (shooter === undefined) {
          const xg = event.xg ?? 0.1;
          const band = xg >= 0.25 ? 'high' : xg >= 0.08 ? 'mid' : 'low';
          line(
            'chance',
            fill(
              chooser.pick(
                `chance-${band}`,
                signature,
                ANONYMOUS_CHANCES[band],
              ),
              values,
            ),
          );
          break;
        }
        const play = event.play ?? 'build_up';
        const filled = { ...values, j: shooter, a: assistant ?? '' };
        const lead = fill(
          chooser.pick(
            `lead-${play}`,
            signature,
            usable(LEADS[play], assistant !== undefined),
          ),
          filled,
        );
        const outcome =
          event.outcome === undefined || event.outcome === 'goal'
            ? ''
            : ` ${fill(chooser.pick(`outcome-${event.outcome}`, signature, OUTCOMES[event.outcome]), filled)}`;
        line('chance', `${lead}${outcome}`);
        break;
      }
      case 'goal': {
        const scorerId = event.scorerId ?? event.playerId;
        const scorer = name(scorerId) ?? 'um atleta';
        const assistant = name(event.assistId);
        const before = { ...score };
        score[event.side] += 1;
        const own = score[event.side];
        const other = score[event.side === 'home' ? 'away' : 'home'];
        const ownBefore = before[event.side];
        const otherBefore = before[event.side === 'home' ? 'away' : 'home'];
        const tally = (goalsBy.get(scorerId ?? '') ?? 0) + 1;
        if (scorerId !== undefined) goalsBy.set(scorerId, tally);
        const filled = {
          ...values,
          ...base(),
          j: scorer,
          a: assistant ?? '',
        };
        const pool =
          event.play !== undefined && hashSeed(`${signature}|play`) % 3 === 0
            ? GOAL_PLAY[event.play]
            : GOALS;
        const parts = [fill(chooser.pick('goal', signature, pool), filled)];
        if (assistant !== undefined)
          parts.push(fill(chooser.pick('assist', signature, ASSISTS), filled));
        if (tally === 3)
          parts.push(
            fill(chooser.pick('hat', signature, GOAL_CONTEXT.hatTrick), filled),
          );
        else if (tally === 2)
          parts.push(
            fill(chooser.pick('brace', signature, GOAL_CONTEXT.brace), filled),
          );
        const situation =
          before.home + before.away === 0
            ? GOAL_CONTEXT.opener
            : own === other
              ? GOAL_CONTEXT.equalizer
              : ownBefore === otherBefore
                ? GOAL_CONTEXT.ahead
                : own > other
                  ? GOAL_CONTEXT.extend
                  : GOAL_CONTEXT.reduce;
        parts.push(
          fill(chooser.pick('situation', signature, situation), filled),
        );
        if (event.minute >= 85)
          parts.push(
            fill(chooser.pick('late', signature, GOAL_CONTEXT.late), filled),
          );
        else if (context.derby === true && hashSeed(signature) % 2 === 0)
          parts.push(
            fill(chooser.pick('derby', signature, GOAL_CONTEXT.derby), filled),
          );
        line('goal', parts.join(' '));
        break;
      }
      case 'card': {
        const player = name(event.playerId) ?? 'um atleta';
        line(
          'card',
          fill(
            chooser.pick(
              event.card === 'red' ? 'red' : 'yellow',
              signature,
              event.card === 'red' ? RED : YELLOW,
            ),
            { ...values, j: player },
          ),
        );
        break;
      }
      case 'injury':
        line(
          'injury',
          fill(chooser.pick('injury', signature, INJURY), {
            ...values,
            j: name(event.playerId) ?? 'um atleta',
          }),
        );
        break;
      case 'substitution':
        line(
          'substitution',
          fill(
            chooser.pick(
              event.source === 'manager' ? 'sub-manager' : 'sub',
              signature,
              event.source === 'manager' ? MANAGER_SUBSTITUTION : SUBSTITUTION,
            ),
            {
              ...values,
              in: name(event.playerInId) ?? 'um reserva',
              out: name(event.playerOutId) ?? 'um titular',
            },
          ),
        );
        break;
      case 'tactical_change': {
        const mentality =
          event.tactic?.mentality ?? event.mentality ?? 'balanced';
        line(
          'tactical_change',
          fill(
            chooser.pick(
              'tactics',
              signature,
              TACTICS[mentality] ?? TACTICS_BALANCED,
            ),
            values,
          ),
        );
        break;
      }
    }
  });
  openSecondHalf();
  const lastMinute = Math.max(90, ...timeline.map(({ minute }) => minute));
  const difference = Math.abs(score.home - score.away);
  push({
    kind: 'full_time',
    minute: lastMinute,
    text: fill(
      chooser.pick(
        'full_time',
        placar(),
        difference === 0
          ? FULL_TIME.draw
          : difference >= 3
            ? FULL_TIME.rout
            : FULL_TIME.win,
      ),
      base(),
    ),
  });
  return lines;
}

export function narrateMatch(
  result: Readonly<{ matchId: string; timeline: readonly NarrationEvent[] }>,
  context: NarrationContext,
): NarrationLine[] {
  return narrateTimeline(result.timeline, {
    ...context,
    key: context.key ?? result.matchId,
  });
}
