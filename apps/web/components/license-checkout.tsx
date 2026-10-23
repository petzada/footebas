'use client';

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';
import {
  ArrowSquareOut,
  CheckCircle,
  CircleNotch,
  Copy,
  LockKey,
  SealCheck,
  Timer,
  WarningCircle,
} from '@phosphor-icons/react';
import { PixelCoin, PixelStar } from '@/components/retro/sprites';
import { useTicker } from '@/components/retro/ticker';
import { Button } from '@/components/ui/button';
import {
  formatCents,
  LicenseAlreadyActiveError,
  type AccountPort,
  type CheckoutView,
  type OrderView,
} from '@/lib/account-product';
import { useSound } from '@/lib/retro/use-sound';
import { cn } from '@/lib/utils';

export const LICENSE_BENEFITS = [
  'Até 5 carreiras ao mesmo tempo, cada uma com nome.',
  'Comece em qualquer clube, de qualquer série.',
  'Pagamento único via PIX. Sem assinatura, sem renovação.',
  'Arrependeu? Reembolso integral em até 7 dias (CDC, art. 49).',
] as const;

/**
 * After the QR code's time is up the payment may still be on its way (the
 * bank and the provider confirm in seconds to minutes): keep asking.
 */
export const CONFIRM_GRACE_MS = 2 * 60 * 1000;

/** Benefit list shared by the Perfil pitch, the paywalls and the upsell. */
export function LicenseBenefits({
  className,
  items = LICENSE_BENEFITS,
  tone = 'board',
}: {
  className?: string;
  items?: readonly string[];
  /** `light`: dark text on the white paywall sheets. */
  tone?: 'board' | 'light';
}) {
  return (
    <ul className={cn('flex flex-col gap-2 text-sm', className)}>
      {items.map((benefit) => (
        <li key={benefit} className="flex items-start gap-2">
          <CheckCircle
            className={cn(
              'mt-0.5 size-4 shrink-0',
              tone === 'light' ? 'text-primary' : 'text-bulb',
            )}
            weight="fill"
            aria-hidden
          />
          {benefit}
        </li>
      ))}
    </ul>
  );
}

type CheckoutState =
  | { status: 'creating' }
  | { status: 'pending'; order: CheckoutView }
  /** QR code timed out; still polling until `until` for a late payment. */
  | { status: 'confirming'; order: CheckoutView; until: number }
  /** `order` is null when the license was already active (409). */
  | { status: 'paid'; order: OrderView | null }
  | { status: 'expired'; order: CheckoutView }
  | { status: 'error'; message: string };

/** Big centered padlock while the PIX is being generated. */
function SecureEnvironment() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="grid justify-items-center gap-2 py-8 text-center"
    >
      <LockKey
        className="size-16 text-primary"
        weight="duotone"
        aria-hidden="true"
      />
      <p className="font-pixel text-xs leading-relaxed text-ink">
        Ambiente seguro
      </p>
      <p className="text-sm text-muted-foreground">
        Pagamento processado pela AbacatePay
      </p>
      <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <CircleNotch className="size-4 animate-spin" aria-hidden="true" />
        Gerando seu PIX…
      </p>
    </div>
  );
}

/**
 * PIX checkout on a white (paper) surface: amount above the QR code, the
 * countdown right below it, "copia e cola" with a big copy button and
 * "Pagar depois" stuck to the bottom edge. Price and QR always come from the
 * server; a late payment keeps being polled for `CONFIRM_GRACE_MS`.
 */
export function LicenseCheckout({
  account,
  pollMs,
  now,
  onPaid,
  onCancel,
  embedded = false,
}: {
  account: AccountPort;
  pollMs: number;
  now(): Date;
  /** Paid; `null` when the license turned out to be active already. */
  onPaid(order: OrderView | null): void;
  onCancel(): void;
  /** Inside a sheet that already draws the surface. */
  embedded?: boolean;
}) {
  const [state, setState] = useState<CheckoutState>({ status: 'creating' });
  const [copied, setCopied] = useState(false);
  const [, setTick] = useState(0);
  const { play } = useSound();
  const ticker = useTicker();
  const announced = useRef(false);

  const request = useCallback(
    (): Promise<CheckoutState> =>
      account
        .checkout()
        .then(async (order): Promise<CheckoutState> => {
          // The server may find an older order already paid.
          if (order.status === 'paid')
            return {
              status: 'paid',
              order: await account.order(order.orderId),
            };
          return { status: 'pending', order };
        })
        .catch((caught: unknown): CheckoutState => {
          if (caught instanceof LicenseAlreadyActiveError)
            return { status: 'paid', order: null };
          return {
            status: 'error',
            message:
              caught instanceof Error
                ? caught.message
                : 'Não foi possível gerar o PIX.',
          };
        }),
    [account],
  );

  // Moves to the next state; a payment is celebrated and reported once.
  const settle = useEffectEvent((next: CheckoutState) => {
    setState(next);
    if (next.status !== 'paid' || announced.current) return;
    announced.current = true;
    play('coin');
    ticker.announce(
      next.order === null
        ? 'Sua licença já está ativa.'
        : 'Pagamento confirmado. Licença ativada!',
      'success',
    );
    onPaid(next.order);
  });

  // One checkout request per round; "Tentar de novo" starts another round.
  const [round, setRound] = useState(0);
  useEffect(() => {
    let active = true;
    void request().then((next) => {
      if (active) settle(next);
    });
    return () => {
      active = false;
    };
  }, [request, round]);

  const start = () => {
    setState({ status: 'creating' });
    setRound((value) => value + 1);
  };

  // Poll the order while waiting, including the grace after the timer.
  useEffect(() => {
    if (state.status !== 'pending' && state.status !== 'confirming') return;
    const { order } = state;
    let active = true;
    const check = async () => {
      try {
        const latest = await account.order(order.orderId);
        if (!active) return;
        if (latest.status === 'paid') {
          settle({ status: 'paid', order: latest });
        } else if (latest.status === 'expired' && state.status === 'pending') {
          // The server gave up on the QR code; a late payment still counts.
          setState({
            status: 'confirming',
            order,
            until: now().getTime() + CONFIRM_GRACE_MS,
          });
        }
      } catch {
        // Transient failures keep polling; the countdown still runs.
      }
    };
    const timer = globalThis.setInterval(() => void check(), pollMs);
    return () => {
      active = false;
      globalThis.clearInterval(timer);
    };
  }, [state, account, pollMs, now]);

  // Countdown; when the QR code's time is up, confirm, then give up.
  useEffect(() => {
    if (state.status !== 'pending' && state.status !== 'confirming') return;
    const timer = globalThis.setInterval(() => {
      setTick((t) => t + 1);
      const instant = now().getTime();
      if (state.status === 'confirming') {
        if (instant >= state.until)
          setState({ status: 'expired', order: state.order });
        return;
      }
      const { order } = state;
      if (order.expiresAt && new Date(order.expiresAt).getTime() <= instant)
        setState({
          status: 'confirming',
          order,
          until: new Date(order.expiresAt).getTime() + CONFIRM_GRACE_MS,
        });
    }, 1000);
    return () => globalThis.clearInterval(timer);
  }, [state, now]);

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      play('confirm');
      globalThis.setTimeout(() => setCopied(false), 2500);
    } catch {
      ticker.announce('Não foi possível copiar. Selecione o código.', 'error');
    }
  };

  const later = (
    <div className="sticky bottom-0 z-10 mt-auto flex justify-center bg-white pt-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
      <Button
        variant="outline"
        className="min-h-11 w-full max-w-xs"
        onClick={onCancel}
      >
        Pagar depois
      </Button>
    </div>
  );

  return (
    <section
      aria-labelledby="perfil-checkout"
      aria-busy={state.status === 'creating'}
      data-tone="light"
      className={cn(
        'flex min-w-0 flex-1 flex-col gap-4 bg-white text-ink',
        embedded ? 'p-0' : 'px-border p-4 sm:p-5',
      )}
    >
      <h2
        id="perfil-checkout"
        className="text-center font-pixel text-[.6rem] leading-relaxed text-muted-foreground"
      >
        Pagamento PIX
      </h2>

      {state.status === 'creating' && <SecureEnvironment />}

      {state.status === 'error' && (
        <div role="alert" className="grid gap-3">
          <p className="flex items-start gap-2 border-2 border-destructive bg-white p-3 text-sm">
            <WarningCircle
              className="mt-0.5 size-5 shrink-0 text-destructive"
              weight="fill"
              aria-hidden
            />
            {state.message}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" className="min-h-11" onClick={start}>
              Tentar de novo
            </Button>
            <Button variant="ghost" className="min-h-11" onClick={onCancel}>
              Voltar
            </Button>
          </div>
        </div>
      )}

      {state.status === 'pending' && (
        <>
          <div className="grid justify-items-center gap-1 text-center">
            <p className="text-xs text-muted-foreground">
              Licença completa · pagamento único
            </p>
            <p className="font-pixel text-2xl text-ink sm:text-3xl">
              {formatCents(state.order.amountCents)}
            </p>
          </div>
          {state.order.qrCodeImage && (
            // Data URI or provider URL; next/image cannot optimise it.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={state.order.qrCodeImage}
              alt="QR Code PIX para pagar a licença"
              className="pixelated mx-auto aspect-square w-56 max-w-full border-4 border-ink bg-white p-1"
            />
          )}
          <p
            role="status"
            aria-live="polite"
            className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm"
          >
            <Timer className="size-4 text-primary" aria-hidden />
            {state.order.expiresAt ? (
              <>
                <span className="font-pixel text-xs">
                  Expira em {countdown(state.order.expiresAt, now())}
                </span>
                <span className="text-muted-foreground">
                  · aguardando pagamento…
                </span>
              </>
            ) : (
              'Aguardando pagamento…'
            )}
          </p>
          {state.order.brCode ? (
            <div className="grid gap-2">
              <label
                htmlFor="pix-brcode"
                className="text-center font-pixel text-[.6rem] text-ink"
              >
                PIX copia e cola
              </label>
              <textarea
                id="pix-brcode"
                readOnly
                rows={3}
                value={state.order.brCode}
                onFocus={(event) => event.currentTarget.select()}
                className="w-full resize-none border-2 border-ink/30 bg-chalk/40 p-2 font-mono text-[.65rem] break-all text-ink"
              />
              <Button
                variant="play"
                size="lg"
                className="min-h-14 w-full"
                onClick={() => void copy(state.order.brCode!)}
              >
                <Copy data-icon="inline-start" />
                {copied ? 'Código copiado!' : 'Copiar código PIX'}
              </Button>
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              O código PIX não veio na resposta; use o link de pagamento.
            </p>
          )}
          {state.order.paymentLinkUrl && (
            <a
              className="inline-flex items-center justify-center gap-2 text-xs underline underline-offset-4"
              href={state.order.paymentLinkUrl}
              target="_blank"
              rel="noreferrer"
            >
              Abrir link de pagamento
              <ArrowSquareOut aria-hidden />
            </a>
          )}
          {later}
        </>
      )}

      {state.status === 'confirming' && (
        <>
          <div
            role="status"
            aria-live="polite"
            className="grid justify-items-center gap-3 py-6 text-center"
          >
            <CircleNotch
              className="size-12 animate-spin text-primary"
              aria-hidden="true"
            />
            <p className="font-pixel text-xs leading-relaxed">
              Confirmando seu pagamento…
            </p>
            <p className="max-w-xs text-sm text-muted-foreground">
              O tempo do QR Code acabou. Se você já pagou, a confirmação do
              banco pode levar alguns minutos: continuamos verificando por aqui.
            </p>
          </div>
          {later}
        </>
      )}

      {state.status === 'expired' && (
        <div role="status" className="grid gap-3 text-center">
          <p className="text-sm">
            Ainda não recebemos a confirmação deste PIX. Se você pagou, a
            licença é ativada sozinha assim que o banco confirmar, sem cobrar de
            novo. Se não pagou, gere um novo QR Code.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" className="min-h-11" onClick={start}>
              Gerar novo PIX
            </Button>
            <Button variant="ghost" className="min-h-11" onClick={onCancel}>
              Voltar
            </Button>
          </div>
        </div>
      )}

      {state.status === 'paid' && (
        <div
          role="status"
          className="grid justify-items-center gap-2 text-center"
        >
          <SealCheck
            className="size-12 text-primary"
            weight="fill"
            aria-hidden
          />
          <p className="text-sm">
            <strong>
              {state.order === null
                ? 'Sua licença já está ativa.'
                : 'Pagamento confirmado.'}
            </strong>{' '}
            Licença ativada: agora são 5 carreiras e qualquer clube.
          </p>
          {state.order && (
            <p className="text-xs text-muted-foreground">
              Pedido {state.order.orderId} ·{' '}
              {formatCents(state.order.amountCents)}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export function countdown(expiresAt: string, now: Date): string {
  const seconds = Math.max(
    0,
    Math.floor((new Date(expiresAt).getTime() - now.getTime()) / 1000),
  );
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

/**
 * Upsell shown inside the club sheet of Nova Carreira when the club is
 * locked by the plan (docs/05 §5): benefits, "Gerar PIX" and the checkout
 * itself, on the white paywall surface. Price always comes from the server.
 */
export function LicenseUpsell({
  account,
  clubName,
  pollMs = 4000,
  now = () => new Date(),
  onPaid,
  onDone,
  onBack,
}: {
  account: AccountPort;
  /** Locked club the coach tapped. */
  clubName: string;
  pollMs?: number;
  now?: () => Date;
  /** The order was paid (or the license was already active). */
  onPaid(order: OrderView | null): void;
  /** "Continuar com o clube" after the payment. */
  onDone(): void;
  /** Leaves the upsell without paying. */
  onBack(): void;
}) {
  const [checkingOut, setCheckingOut] = useState(false);
  const [paid, setPaid] = useState<{ order: OrderView | null } | null>(null);
  const handlePaid = useCallback(
    (order: OrderView | null) => {
      setPaid({ order });
      onPaid(order);
    },
    [onPaid],
  );

  if (paid)
    return (
      <div role="status" className="grid gap-3 text-ink">
        <p className="flex items-start gap-2 text-sm">
          <SealCheck
            className="mt-0.5 size-6 shrink-0 text-primary"
            weight="fill"
            aria-hidden
          />
          <span>
            <strong>
              {paid.order === null
                ? 'Sua licença já está ativa.'
                : 'Pagamento confirmado.'}
            </strong>{' '}
            Agora são 5 carreiras e qualquer clube. O {clubName} já está
            selecionado.
          </span>
        </p>
        {paid.order && (
          <p className="text-xs text-muted-foreground">
            Pedido {paid.order.orderId} · {formatCents(paid.order.amountCents)}
          </p>
        )}
        <Button variant="play" className="min-h-12" onClick={onDone}>
          Continuar com o {clubName}
        </Button>
      </div>
    );

  if (checkingOut)
    return (
      <LicenseCheckout
        account={account}
        pollMs={pollMs}
        now={now}
        onPaid={handlePaid}
        onCancel={() => setCheckingOut(false)}
        embedded
      />
    );

  return (
    <div className="grid gap-4 text-ink">
      <div className="flex items-center gap-3">
        <PixelStar size={24} className="shrink-0" />
        <h3 className="font-pixel text-sm leading-relaxed">Seja licenciado</h3>
      </div>
      <p className="text-sm">
        O <strong>{clubName}</strong> só entra com a licença. No plano grátis a
        carreira começa na Série C. Nada muda dentro de campo: a vantagem é só
        de liberdade, nunca esportiva.
      </p>
      <LicenseBenefits tone="light" />
      <p className="text-xs text-muted-foreground">
        Pagamento único. O valor vem do servidor e aparece junto com o QR Code.
      </p>
      <div className="grid gap-2">
        <Button
          variant="play"
          size="lg"
          className="min-h-14 w-full"
          onClick={() => setCheckingOut(true)}
        >
          <PixelCoin size={18} />
          Gerar PIX
        </Button>
        <Button
          variant="outline"
          className="min-h-11 w-full whitespace-normal"
          onClick={onBack}
        >
          Voltar ao elenco
        </Button>
      </div>
    </div>
  );
}
