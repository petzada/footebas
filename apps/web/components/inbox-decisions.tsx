'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import {
  Bank,
  CheckCircle,
  EnvelopeSimple,
  Handshake,
  LockSimple,
  Megaphone,
  Newspaper,
  Scroll,
  Trash,
  UsersThree,
  Warning,
} from '@phosphor-icons/react';
import { useTicker } from '@/components/retro/ticker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Screen } from '@/lib/career-api';
import {
  closedReason,
  formatGameDate,
  isDeletable,
  isPending,
  KIND_LABEL,
  OFFER_DECISION_LABEL,
  type InboxKind,
  type InboxMessage,
  type InboxPort,
  type InboxView,
} from '@/lib/inbox-product';
import { useSound } from '@/lib/retro/use-sound';
import { cn } from '@/lib/utils';

const ICON: Record<InboxKind, typeof EnvelopeSimple> = {
  match_report: Newspaper,
  transfer_offer: Handshake,
  sponsor_offer: Bank,
  board_message: Scroll,
  player_request: UsersThree,
  press_conference: Megaphone,
  notice: Warning,
};

/** Tone of the message strip (left border), by kind and situation. */
function tone(message: InboxMessage): string {
  if (message.kind === 'match_report')
    return message.situation === 'win'
      ? 'border-primary'
      : message.situation === 'loss'
        ? 'border-destructive'
        : 'border-muted-foreground';
  if (message.kind === 'board_message') return 'border-accent';
  if (message.kind === 'transfer_offer' || message.kind === 'sponsor_offer')
    return 'border-bulb';
  if (message.kind === 'notice') return 'border-destructive';
  return 'border-sky';
}

/**
 * Caixa de entrada with decisions (docs/09 Central): generated messages are
 * answered in place through `ResolveInboxDecision`; offers through the
 * existing offer commands (counter-offers open the Mercado/Escritório).
 */
export function InboxDecisions({
  port,
  navigate,
  onResolved,
  onView,
  limit = 6,
  variant = 'summary',
}: {
  port: InboxPort;
  navigate(value: Screen): void;
  /** Called after any decision, so the caller can refresh the career. */
  onResolved?: () => void;
  /** Every inbox view loaded or changed (the inbox screen filters its news). */
  onView?: (view: InboxView) => void;
  limit?: number;
  /** `full` (the Caixa de entrada screen): every message, no "Ver todas". */
  variant?: 'summary' | 'full';
}) {
  const [view, setView] = useState<InboxView | null>(null);
  // Every view the component holds is also handed to the caller.
  const viewChanged = useEffectEvent((next: InboxView) => onView?.(next));
  useEffect(() => {
    if (view) viewChanged(view);
  }, [view]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Record<string, string>>({});
  const ticker = useTicker();
  const { play } = useSound();

  useEffect(() => {
    let active = true;
    port
      .load()
      .then((loaded) => active && setView(loaded))
      .catch(
        (caught: unknown) =>
          active &&
          setError(
            caught instanceof Error
              ? caught.message
              : 'Não foi possível abrir a caixa de entrada.',
          ),
      );
    return () => {
      active = false;
    };
  }, [port]);

  const run = async (
    messageId: string,
    label: string,
    action: () => Promise<InboxView>,
  ) => {
    if (busyId) return;
    setBusyId(messageId);
    setError('');
    try {
      setView(await action());
      setConfirmed((current) => ({ ...current, [messageId]: label }));
      play('confirm');
      ticker.announce(label, 'success');
      onResolved?.();
    } catch (caught) {
      play('error');
      const message =
        caught instanceof Error ? caught.message : 'Tente novamente.';
      setError(message);
      ticker.announce(message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const messages = view?.messages ?? [];
  const currentDate = view?.currentDate ?? '';
  const pending = messages.filter((item) => isPending(item, currentDate));
  const shown = [
    ...pending,
    ...messages.filter((item) => !isPending(item, currentDate)),
  ].slice(0, variant === 'full' ? undefined : limit);
  // Offers leave the inbox once decided: keep their confirmation visible.
  const gone = Object.entries(confirmed).filter(
    ([id]) => !messages.some((item) => item.id === id),
  );

  return (
    <section aria-labelledby="central-caixa" className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <h2
          id="central-caixa"
          className="flex items-center gap-2 font-pixel text-[.65rem]"
        >
          <EnvelopeSimple aria-hidden="true" />
          {variant === 'full' ? 'Mensagens' : 'Caixa de entrada'}
        </h2>
        <Badge variant={pending.length ? 'default' : 'secondary'}>
          {pending.length} {pending.length === 1 ? 'decisão' : 'decisões'}
        </Badge>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-3 border-2 border-destructive p-2 text-sm"
        >
          {error}
        </p>
      )}
      {gone.map(([id, label]) => (
        <p
          key={id}
          role="status"
          className="mt-3 flex items-center gap-2 border-2 border-primary bg-primary/10 p-2 text-sm"
        >
          <CheckCircle
            className="size-4 text-primary"
            weight="fill"
            aria-hidden
          />
          {label}
        </p>
      ))}
      {!view && !error ? (
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          Abrindo os envelopes…
        </p>
      ) : shown.length === 0 && gone.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Nenhuma decisão pendente. Bom trabalho.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {shown.map((message) => (
            <Envelope
              key={message.id}
              message={message}
              currentDate={currentDate}
              busy={busyId === message.id}
              disabled={busyId !== null}
              confirmation={confirmed[message.id]}
              navigate={navigate}
              onChoose={(option) =>
                run(message.id, `Decidido: ${option.label}.`, () =>
                  port.resolve(message.id, option.id),
                )
              }
              onRemove={() =>
                run(message.id, 'Mensagem excluída.', () =>
                  port.remove(message.id),
                )
              }
              onDecideOffer={(decision) =>
                run(
                  message.id,
                  decision === 'accept'
                    ? 'Proposta aceita.'
                    : 'Proposta recusada.',
                  () =>
                    port.decideOffer(
                      message.kind as 'transfer_offer' | 'sponsor_offer',
                      message.decision!.offerId,
                      decision,
                    ),
                )
              }
            />
          ))}
        </ul>
      )}
      {variant === 'summary' && messages.length > 0 && (
        <Button
          variant="ghost"
          className="mt-3 min-h-11 w-full justify-between"
          onClick={() => navigate('inbox')}
        >
          Ver todas as mensagens
        </Button>
      )}
    </section>
  );
}

function Envelope({
  message,
  currentDate,
  busy,
  disabled,
  confirmation,
  navigate,
  onChoose,
  onDecideOffer,
  onRemove,
}: {
  message: InboxMessage;
  currentDate: string;
  busy: boolean;
  disabled: boolean;
  confirmation: string | undefined;
  navigate(value: Screen): void;
  onChoose(option: { id: string; label: string }): void;
  onDecideOffer(decision: 'accept' | 'reject'): void;
  /** `DeleteInboxMessage`: only once nothing waits for the coach. */
  onRemove(): void;
}) {
  const Icon = ICON[message.kind];
  const closed = closedReason(message, currentDate);
  const chosen = message.choice?.options.find(
    (option) => option.id === message.choice?.chosenOptionId,
  );
  const expiresOn = message.choice?.expiresOn ?? message.decision?.expiresOn;
  return (
    <li
      aria-busy={busy}
      className={cn(
        'grid gap-2 border-2 border-ink border-l-8 bg-popover p-3',
        tone(message),
        closed && !chosen && 'opacity-80',
      )}
    >
      <div className="flex items-start gap-3">
        <Icon
          className="mt-0.5 size-5 shrink-0 text-muted-foreground"
          weight="duotone"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{KIND_LABEL[message.kind]}</Badge>
            <span className="font-pixel text-[.45rem] text-muted-foreground">
              {formatGameDate(message.occurredOn)}
            </span>
            {expiresOn && !closed && (
              <span className="font-pixel text-[.45rem] text-accent">
                até {formatGameDate(expiresOn)}
              </span>
            )}
          </div>
          <h3 className="mt-1 text-sm font-extrabold leading-snug">
            {message.subject}
          </h3>
          <p className="text-sm text-muted-foreground">{message.body}</p>
        </div>
        {isDeletable(message, currentDate) && (
          <Button
            variant="ghost"
            size="icon"
            className="size-11 shrink-0"
            aria-label={`Excluir: ${message.subject}`}
            disabled={disabled}
            onClick={onRemove}
          >
            <Trash aria-hidden="true" />
          </Button>
        )}
      </div>

      {confirmation ? (
        <p
          role="status"
          className="flex items-center gap-2 border-2 border-primary bg-primary/10 p-2 text-sm"
        >
          <CheckCircle
            className="size-4 text-primary"
            weight="fill"
            aria-hidden
          />
          {confirmation}
          {chosen && chosen.effects.length > 0 && (
            <span className="text-muted-foreground">
              {' '}
              · {chosen.effects.join(' · ')}
            </span>
          )}
        </p>
      ) : chosen ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle
            className="size-4 text-primary"
            weight="fill"
            aria-hidden
          />
          Você escolheu: <strong>{chosen.label}</strong>
        </p>
      ) : closed ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <LockSimple className="size-4" aria-hidden="true" />
          {closed}
        </p>
      ) : message.choice ? (
        <div
          role="group"
          aria-label={`Opções: ${message.subject}`}
          className="grid gap-2 sm:grid-cols-2"
        >
          {message.choice.options.map((option) => (
            <Button
              key={option.id}
              variant="outline"
              className="h-auto min-h-11 flex-col items-start gap-0.5 whitespace-normal px-3 py-2 text-left"
              disabled={disabled}
              onClick={() => onChoose(option)}
            >
              <span>{option.label}</span>
              {option.effects.length > 0 && (
                <span className="font-sans text-[.65rem] font-normal normal-case text-muted-foreground">
                  {option.effects.join(' · ')}
                </span>
              )}
            </Button>
          ))}
        </div>
      ) : message.decision ? (
        <div
          role="group"
          aria-label={`Opções: ${message.subject}`}
          className="flex flex-wrap gap-2"
        >
          {message.decision.options.map((option) =>
            option === 'counter' ? (
              <Button
                key={option}
                variant="secondary"
                size="sm"
                className="min-h-10"
                disabled={disabled}
                onClick={() =>
                  navigate(
                    message.kind === 'sponsor_offer' ? 'office' : 'market',
                  )
                }
              >
                {OFFER_DECISION_LABEL.counter}
              </Button>
            ) : (
              <Button
                key={option}
                variant={option === 'accept' ? 'default' : 'destructive'}
                size="sm"
                className="min-h-10"
                disabled={disabled}
                onClick={() => onDecideOffer(option)}
              >
                {OFFER_DECISION_LABEL[option]}
              </Button>
            ),
          )}
        </div>
      ) : null}
    </li>
  );
}
