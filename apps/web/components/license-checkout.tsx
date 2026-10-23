'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowSquareOut,
  CheckCircle,
  Copy,
  QrCode,
  SealCheck,
  Timer,
  WarningCircle,
} from '@phosphor-icons/react';
import { PixelCoin, PixelStar } from '@/components/retro/sprites';
import { useTicker } from '@/components/retro/ticker';
import { Button } from '@/components/ui/button';
import {
  formatCents,
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

/** Benefit list shared by the Perfil pitch and the club upsell sheet. */
export function LicenseBenefits({ className }: { className?: string }) {
  return (
    <ul className={cn('flex flex-col gap-2 text-sm', className)}>
      {LICENSE_BENEFITS.map((benefit) => (
        <li key={benefit} className="flex items-start gap-2">
          <CheckCircle
            className="mt-0.5 size-4 shrink-0 text-bulb"
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
  | { status: 'paid'; order: OrderView }
  | { status: 'expired'; order: CheckoutView }
  | { status: 'error'; message: string };

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
  onPaid(order: OrderView): void;
  onCancel(): void;
  /** Inside a sheet that already draws the board panel. */
  embedded?: boolean;
}) {
  const [state, setState] = useState<CheckoutState>({ status: 'creating' });
  const [copied, setCopied] = useState(false);
  const [, setTick] = useState(0);
  const { play } = useSound();
  const ticker = useTicker();
  const paid = useRef(false);

  const request = useCallback(
    (): Promise<CheckoutState> =>
      account
        .checkout()
        .then((order): CheckoutState => ({ status: 'pending', order }))
        .catch((caught: unknown): CheckoutState => ({
          status: 'error',
          message:
            caught instanceof Error
              ? caught.message
              : 'Não foi possível gerar o PIX.',
        })),
    [account],
  );

  useEffect(() => {
    let active = true;
    void request().then((next) => active && setState(next));
    return () => {
      active = false;
    };
  }, [request]);

  const start = () => {
    setState({ status: 'creating' });
    void request().then(setState);
  };

  // Poll the order until it is paid or the QR code expires.
  useEffect(() => {
    if (state.status !== 'pending') return;
    const { order } = state;
    let active = true;
    const check = async () => {
      try {
        const latest = await account.order(order.orderId);
        if (!active) return;
        if (latest.status === 'paid') {
          paid.current = true;
          setState({ status: 'paid', order: latest });
          play('coin');
          ticker.announce('Pagamento confirmado. Licença ativada!', 'success');
          onPaid(latest);
        } else if (latest.status === 'expired') {
          setState({ status: 'expired', order: latest });
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
  }, [state, account, pollMs, onPaid, play, ticker]);

  // Countdown refresh; flips to `expired` when the QR code's time is up.
  useEffect(() => {
    if (state.status !== 'pending') return;
    const { order } = state;
    const timer = globalThis.setInterval(() => {
      setTick((t) => t + 1);
      if (
        order.expiresAt &&
        new Date(order.expiresAt).getTime() <= now().getTime()
      )
        setState({ status: 'expired', order });
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

  return (
    <section
      aria-labelledby="perfil-checkout"
      aria-busy={state.status === 'creating'}
      className={cn(
        'flex min-w-0 flex-col gap-4',
        embedded ? 'p-0' : 'panel-board p-5',
      )}
    >
      <div className="flex items-center gap-3">
        <QrCode className="size-7 text-bulb" weight="duotone" aria-hidden />
        <h2 id="perfil-checkout" className="led text-sm sm:text-base">
          Pagamento PIX
        </h2>
      </div>

      {state.status === 'creating' && (
        <p className="text-sm text-chalk/80" role="status">
          Gerando o QR Code…
        </p>
      )}

      {state.status === 'error' && (
        <div role="alert" className="grid gap-3">
          <p className="flex items-start gap-2 border-2 border-destructive bg-ink/40 p-3 text-sm">
            <WarningCircle
              className="mt-0.5 size-5 shrink-0 text-destructive"
              weight="fill"
              aria-hidden
            />
            {state.message}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={start}>
              Tentar de novo
            </Button>
            <Button variant="ghost" onClick={onCancel}>
              Voltar
            </Button>
          </div>
        </div>
      )}

      {(state.status === 'pending' || state.status === 'expired') && (
        <>
          <p className="led text-2xl">{formatCents(state.order.amountCents)}</p>
          {state.status === 'expired' ? (
            <div role="status" className="grid gap-3">
              <p className="text-sm">
                Este QR Code expirou. Nada foi cobrado; gere outro para
                continuar.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={start}>
                  Gerar novo PIX
                </Button>
                <Button variant="ghost" onClick={onCancel}>
                  Voltar
                </Button>
              </div>
            </div>
          ) : (
            <>
              {state.order.qrCodeImage && (
                // Data URI or provider URL; next/image cannot optimise it.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={state.order.qrCodeImage}
                  alt="QR Code PIX para pagar a licença"
                  className="pixelated mx-auto size-48 border-4 border-chalk bg-chalk"
                />
              )}
              {state.order.brCode ? (
                <div className="grid gap-2">
                  <label
                    htmlFor="pix-brcode"
                    className="font-pixel text-[.5rem] text-chalk/80"
                  >
                    PIX copia e cola
                  </label>
                  <textarea
                    id="pix-brcode"
                    readOnly
                    rows={3}
                    value={state.order.brCode}
                    onFocus={(event) => event.currentTarget.select()}
                    className="w-full resize-none border-2 border-chalk/40 bg-ink/50 p-2 font-mono text-[.65rem] text-chalk"
                  />
                  <Button
                    variant="play"
                    className="min-h-12"
                    onClick={() => void copy(state.order.brCode!)}
                  >
                    <Copy data-icon="inline-start" />
                    {copied ? 'Código copiado!' : 'Copiar código PIX'}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-chalk/80">
                  O código PIX não veio na resposta; use o link de pagamento.
                </p>
              )}
              {state.order.paymentLinkUrl && (
                <a
                  className="inline-flex items-center gap-2 text-xs underline underline-offset-4"
                  href={state.order.paymentLinkUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir link de pagamento
                  <ArrowSquareOut aria-hidden />
                </a>
              )}
              <p
                role="status"
                aria-live="polite"
                className="flex items-center gap-2 text-xs text-chalk/80"
              >
                <Timer aria-hidden />
                {state.order.expiresAt
                  ? `Expira em ${countdown(state.order.expiresAt, now())} · aguardando pagamento…`
                  : 'Aguardando pagamento…'}
              </p>
              <Button variant="ghost" className="self-start" onClick={onCancel}>
                Pagar depois
              </Button>
            </>
          )}
        </>
      )}

      {state.status === 'paid' && (
        <div role="status" className="grid gap-2">
          <p className="flex items-center gap-2 text-sm">
            <SealCheck className="size-6 text-bulb" weight="fill" aria-hidden />
            <strong>Pagamento confirmado.</strong> Licença ativada: agora são 5
            carreiras e qualquer clube.
          </p>
          <p className="text-xs text-chalk/70">
            Pedido {state.order.orderId} ·{' '}
            {formatCents(state.order.amountCents)}
          </p>
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
 * itself. Price always comes from the server with the QR code.
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
  /** The order was paid: the plan is licensed now. */
  onPaid(order: OrderView): void;
  /** "Continuar com o clube" after the payment. */
  onDone(): void;
  /** Leaves the upsell without paying. */
  onBack(): void;
}) {
  const [checkingOut, setCheckingOut] = useState(false);
  const [paid, setPaid] = useState<OrderView | null>(null);

  if (paid)
    return (
      <div role="status" className="grid gap-3">
        <p className="flex items-start gap-2 text-sm">
          <SealCheck
            className="mt-0.5 size-6 shrink-0 text-bulb"
            weight="fill"
            aria-hidden
          />
          <span>
            <strong>Pagamento confirmado.</strong> Agora são 5 carreiras e
            qualquer clube. O {clubName} já está selecionado.
          </span>
        </p>
        <p className="text-xs text-chalk/70">
          Pedido {paid.orderId} · {formatCents(paid.amountCents)}
        </p>
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
        onPaid={(order) => {
          setPaid(order);
          onPaid(order);
        }}
        onCancel={() => setCheckingOut(false)}
        embedded
      />
    );

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <PixelStar size={24} className="shrink-0" />
        <h3 className="led text-sm leading-relaxed">Seja licenciado</h3>
      </div>
      <p className="text-sm text-chalk/90">
        O <strong>{clubName}</strong> só entra com a licença. No plano grátis a
        carreira começa na Série C. Nada muda dentro de campo: a vantagem é só
        de liberdade, nunca esportiva.
      </p>
      <LicenseBenefits />
      <p className="text-xs text-chalk/70">
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
