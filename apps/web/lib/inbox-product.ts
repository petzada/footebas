/**
 * Caixa de entrada com decisões (docs/09 Central). Mirrors `coachMessage` of
 * the home read model: generated messages carry `choice` (answered through
 * `ResolveInboxDecision`), offers carry `decision` (answered through the
 * existing offer commands).
 */
export type InboxKind =
  | 'match_report'
  | 'transfer_offer'
  | 'sponsor_offer'
  | 'board_message'
  | 'player_request'
  | 'press_conference'
  | 'notice';

export type OfferDecision = 'accept' | 'reject' | 'counter';

export interface InboxOfferDecision {
  readonly id: string;
  readonly offerId: string;
  readonly options: readonly OfferDecision[];
  readonly expiresOn: string;
}

export interface InboxChoiceOption {
  readonly id: string;
  readonly label: string;
  readonly effects: readonly string[];
}

export interface InboxChoice {
  readonly messageId: string;
  readonly options: readonly InboxChoiceOption[];
  readonly expiresOn: string;
  readonly status: 'pending' | 'resolved' | 'expired';
  readonly chosenOptionId?: string;
}

export interface InboxMessage {
  readonly id: string;
  readonly kind: InboxKind;
  readonly topic?: string;
  readonly situation?: 'win' | 'draw' | 'loss';
  readonly subject: string;
  readonly body: string;
  readonly occurredOn: string;
  readonly decision?: InboxOfferDecision;
  readonly choice?: InboxChoice;
  /** Seen by the coach (persisted by the server with `MarkInboxRead`). */
  readonly read?: boolean;
}

export interface InboxView {
  readonly currentDate: string;
  readonly messages: readonly InboxMessage[];
}

export interface InboxPort {
  load(): Promise<InboxView>;
  /** `ResolveInboxDecision { messageId, optionId }`. */
  resolve(messageId: string, optionId: string): Promise<InboxView>;
  /** Accept/reject a transfer or sponsorship offer with the existing commands. */
  decideOffer(
    kind: 'transfer_offer' | 'sponsor_offer',
    offerId: string,
    decision: 'accept' | 'reject',
  ): Promise<InboxView>;
  /** `MarkInboxRead { messageIds }` (opening the inbox page). */
  markRead(messageIds: readonly string[]): Promise<InboxView>;
  /** `DeleteInboxMessage { messageId }`; refused while a decision waits. */
  remove(messageId: string): Promise<InboxView>;
}

/** Messages the coach has not seen yet (what the inbox badge counts). */
export function unreadIds(messages: readonly InboxMessage[]): string[] {
  return messages
    .filter((message) => message.read !== true)
    .map(({ id }) => id);
}

/** Whether the trash icon applies: nothing is waiting for the coach. */
export function isDeletable(
  message: InboxMessage,
  currentDate: string,
): boolean {
  return !isPending(message, currentDate);
}

/** Unread inbox messages among the Notícias items (badge counter). */
export function unreadCount(
  news: readonly { readonly unread?: boolean }[],
): number {
  return news.filter(({ unread }) => unread === true).length;
}

export const KIND_LABEL: Record<InboxKind, string> = {
  match_report: 'Relatório',
  transfer_offer: 'Proposta',
  sponsor_offer: 'Patrocínio',
  board_message: 'Diretoria',
  player_request: 'Atletas',
  press_conference: 'Coletiva',
  notice: 'Aviso',
};

export const OFFER_DECISION_LABEL: Record<OfferDecision, string> = {
  accept: 'Aceitar',
  reject: 'Recusar',
  counter: 'Contraproposta',
};

/** Whether a message still waits for the coach. */
export function isPending(message: InboxMessage, currentDate: string): boolean {
  if (message.choice)
    return (
      message.choice.status === 'pending' &&
      message.choice.expiresOn >= currentDate
    );
  if (message.decision) return message.decision.expiresOn >= currentDate;
  return false;
}

/** Why a message can no longer be answered, or `null` while it can. */
export function closedReason(
  message: InboxMessage,
  currentDate: string,
): string | null {
  const choice = message.choice;
  if (choice) {
    if (choice.status === 'resolved') return 'Decisão já tomada.';
    if (choice.status === 'expired' || choice.expiresOn < currentDate)
      return `Prazo encerrado em ${formatGameDate(choice.expiresOn)}.`;
    return null;
  }
  if (message.decision && message.decision.expiresOn < currentDate)
    return `Proposta expirada em ${formatGameDate(message.decision.expiresOn)}.`;
  return null;
}

export function formatGameDate(date: string): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  if (Number.isNaN(value.getTime())) return date;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).format(value);
}

export function demoInboxView(): InboxView {
  return {
    currentDate: '2026-02-10',
    messages: [
      {
        id: 'msg_board_reinforcement',
        kind: 'board_message',
        topic: 'board_reinforcement',
        subject: 'A diretoria quer saber do reforço',
        body: 'O presidente pergunta se o clube deve ir ao mercado por um meia de criação agora ou poupar o caixa para a próxima janela.',
        occurredOn: '2026-02-09',
        choice: {
          messageId: 'msg_board_reinforcement',
          status: 'pending',
          expiresOn: '2026-02-20',
          options: [
            {
              id: 'opt_buy_now',
              label: 'Buscar reforço agora',
              effects: ['Diretoria +3', 'Caixa −R$ 2 mi'],
            },
            {
              id: 'opt_wait',
              label: 'Esperar a próxima janela',
              effects: ['Diretoria −1', 'Caixa preservado'],
            },
          ],
        },
      },
      {
        id: 'msg_player_minutes',
        kind: 'player_request',
        topic: 'player_minutes',
        subject: 'Gerson pede mais minutos',
        body: 'O volante procurou a comissão: quer ser titular ou avisa que vai ouvir propostas.',
        occurredOn: '2026-02-08',
        choice: {
          messageId: 'msg_player_minutes',
          status: 'pending',
          expiresOn: '2026-02-15',
          options: [
            {
              id: 'opt_promise',
              label: 'Prometer titularidade',
              effects: ['Moral do atleta +8', 'Vestiário atento'],
            },
            {
              id: 'opt_firm',
              label: 'Manter a hierarquia',
              effects: ['Moral do atleta −6', 'Disciplina +2'],
            },
          ],
        },
      },
      {
        id: 'msg_press',
        kind: 'press_conference',
        topic: 'press_conference',
        subject: 'Coletiva: pressão por título',
        body: 'A imprensa quer saber se o time é candidato ao título já nesta temporada.',
        occurredOn: '2026-02-01',
        choice: {
          messageId: 'msg_press',
          status: 'expired',
          expiresOn: '2026-02-05',
          options: [
            {
              id: 'opt_bold',
              label: 'Somos candidatos',
              effects: ['Torcida +4'],
            },
            {
              id: 'opt_humble',
              label: 'Jogo a jogo',
              effects: ['Diretoria +1'],
            },
          ],
        },
      },
      {
        id: 'msg_report',
        kind: 'match_report',
        situation: 'win',
        subject: 'Vitória sólida sobre o Palmeiras',
        body: 'Pressão alta funcionou: 2 a 0 com gols de Pedro e Arrascaeta.',
        occurredOn: '2026-02-07',
      },
    ],
  };
}

/** In-memory inbox for the offline demo and tests. */
export function createFakeInboxPort(
  initial: InboxView = demoInboxView(),
): InboxPort {
  let view = structuredClone(initial);
  const snapshot = async () => structuredClone(view);
  return {
    load: snapshot,
    async resolve(messageId, optionId) {
      const message = view.messages.find((item) => item.id === messageId);
      if (!message?.choice) throw new Error('Mensagem sem decisão.');
      if (
        message.choice.status !== 'pending' ||
        message.choice.expiresOn < view.currentDate
      )
        throw new Error('O prazo dessa decisão já passou.');
      if (!message.choice.options.some((option) => option.id === optionId))
        throw new Error('Opção desconhecida.');
      view = {
        ...view,
        messages: view.messages.map((item) =>
          item.id === messageId && item.choice
            ? {
                ...item,
                choice: {
                  ...item.choice,
                  status: 'resolved',
                  chosenOptionId: optionId,
                },
              }
            : item,
        ),
      };
      return snapshot();
    },
    async decideOffer(_kind, offerId) {
      view = {
        ...view,
        messages: view.messages.filter(
          (item) => item.decision?.offerId !== offerId,
        ),
      };
      return snapshot();
    },
    async markRead(messageIds) {
      const ids = new Set(messageIds);
      view = {
        ...view,
        messages: view.messages.map((item) =>
          ids.has(item.id) ? { ...item, read: true } : item,
        ),
      };
      return snapshot();
    },
    async remove(messageId) {
      const message = view.messages.find((item) => item.id === messageId);
      if (message && isPending(message, view.currentDate))
        throw new Error('Decida a mensagem antes de excluir.');
      view = {
        ...view,
        messages: view.messages.filter((item) => item.id !== messageId),
      };
      return snapshot();
    },
  };
}
