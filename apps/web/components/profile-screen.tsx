'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowSquareOut,
  CheckCircle,
  Copy,
  QrCode,
  SealCheck,
  SignOut,
  Timer,
  WarningCircle,
} from '@phosphor-icons/react';
import { PlayerAvatar, type PlayerIdentity } from '@/components/start-screens';
import { PixelCoin, PixelStar } from '@/components/retro/sprites';
import { useTicker } from '@/components/retro/ticker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  formatCents,
  refundable,
  type AccountPort,
  type CheckoutView,
  type OrderView,
  type ProfileView,
} from '@/lib/account-product';
import type { CareerList } from '@/lib/career-api';
import { useSound } from '@/lib/retro/use-sound';
import { cn } from '@/lib/utils';

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const LICENSE_BENEFITS = [
  'Até 5 carreiras ao mesmo tempo, cada uma com nome.',
  'Comece em qualquer clube, de qualquer série.',
  'Pagamento único via PIX. Sem assinatura, sem renovação.',
  'Arrependeu? Reembolso integral em até 7 dias (CDC, art. 49).',
] as const;

/**
 * Perfil: account, plan and the single license (docs/05; billing README).
 * Price, QR code and order status always come from the server.
 */
export function ProfileScreen({
  account,
  player,
  loadCareers,
  onSignOut,
  pollMs = 4000,
  now = () => new Date(),
}: {
  account: AccountPort;
  player: PlayerIdentity;
  loadCareers?: () => Promise<CareerList>;
  onSignOut?: (() => void) | undefined;
  /** Order polling interval while a PIX is pending. */
  pollMs?: number;
  now?: () => Date;
}) {
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [careers, setCareers] = useState<CareerList | null>(null);
  const [error, setError] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);
  // Confirmations outlive the card that produced them (checkout, refund).
  const [notice, setNotice] = useState('');

  const reload = useCallback(async () => {
    const me = await account.me();
    setProfile(me);
    return me;
  }, [account]);

  useEffect(() => {
    let active = true;
    account
      .me()
      .then((me) => active && setProfile(me))
      .catch(
        (caught: unknown) =>
          active &&
          setError(
            caught instanceof Error
              ? caught.message
              : 'Não foi possível carregar seu perfil.',
          ),
      );
    loadCareers?.()
      .then((list) => active && setCareers(list))
      .catch(() => active && setCareers(null));
    return () => {
      active = false;
    };
  }, [account, loadCareers]);

  if (error && !profile)
    return (
      <p className="panel p-3 text-sm" role="alert">
        {error}
      </p>
    );
  if (!profile)
    return (
      <p className="panel p-3 text-sm" role="status">
        Abrindo sua ficha…
      </p>
    );

  const licensed = profile.plan === 'licensed';
  const used = careers?.careers.length;
  const limit = careers?.limit ?? profile.entitlements.maxCareers;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section
        aria-labelledby="perfil-conta"
        className="panel flex flex-col gap-4 p-5"
      >
        <div className="flex items-center gap-4">
          <PlayerAvatar player={player} size="md" />
          <div className="min-w-0">
            <p className="font-pixel text-[.5rem] text-muted-foreground">
              Perfil
            </p>
            <h2
              id="perfil-conta"
              className="truncate font-pixel text-sm leading-relaxed"
            >
              {profile.displayName || player.name}
            </h2>
            <p className="truncate text-sm text-muted-foreground">
              {profile.email}
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="font-pixel text-[.5rem] text-muted-foreground">
              Plano
            </dt>
            <dd>
              <Badge variant={licensed ? 'bulb' : 'secondary'}>
                {licensed ? 'Licenciado' : 'Grátis'}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="font-pixel text-[.5rem] text-muted-foreground">
              Carreiras
            </dt>
            <dd className="font-pixel text-base">
              {used === undefined ? '—' : used}/{limit}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="font-pixel text-[.5rem] text-muted-foreground">
              Licença
            </dt>
            <dd className="text-sm">
              {profile.license?.status === 'active' ? (
                <span className="flex flex-wrap items-center gap-2">
                  <SealCheck
                    className="size-5 text-primary"
                    weight="fill"
                    aria-hidden
                  />
                  Ativa desde{' '}
                  {dateTime.format(new Date(profile.license.grantedAt))}
                  {profile.license.refundableUntil &&
                    refundable(profile.license, now()) && (
                      <span className="text-muted-foreground">
                        · reembolso até{' '}
                        {dateTime.format(
                          new Date(profile.license.refundableUntil),
                        )}
                      </span>
                    )}
                </span>
              ) : profile.license?.status === 'revoked' ? (
                'Reembolsada: a conta voltou ao plano grátis.'
              ) : (
                'Nenhuma. O plano grátis joga uma carreira em um clube de baixo.'
              )}
            </dd>
          </div>
        </dl>
        <div className="mt-auto flex flex-wrap items-center gap-2">
          {onSignOut && (
            <Button variant="outline" className="min-h-11" onClick={onSignOut}>
              <SignOut data-icon="inline-start" />
              Sair da conta
            </Button>
          )}
          <nav
            aria-label="Documentos legais"
            className="ml-auto flex gap-3 text-xs"
          >
            <a className="underline underline-offset-4" href="/termos">
              Termos de uso
            </a>
            <a className="underline underline-offset-4" href="/privacidade">
              Privacidade
            </a>
          </nav>
        </div>
      </section>

      <div className="grid content-start gap-4">
        {notice && (
          <p
            role="status"
            className="panel flex items-start gap-2 border-l-8 border-primary p-3 text-sm"
          >
            <SealCheck
              className="mt-0.5 size-5 shrink-0 text-primary"
              weight="fill"
              aria-hidden
            />
            <span>{notice}</span>
          </p>
        )}
        {licensed ? (
          <LicensedCard
            profile={profile}
            account={account}
            onChanged={(message) => {
              setNotice(message);
              void reload();
            }}
            now={now}
          />
        ) : checkingOut ? (
          <LicenseCheckout
            account={account}
            pollMs={pollMs}
            now={now}
            onPaid={(order) => {
              setNotice(
                `Pagamento confirmado. Licença ativada: agora são 5 carreiras e qualquer clube. Pedido ${order.orderId} · ${formatCents(order.amountCents)}.`,
              );
              void reload();
              setCheckingOut(false);
            }}
            onCancel={() => setCheckingOut(false)}
          />
        ) : (
          <LicensePitch onStart={() => setCheckingOut(true)} />
        )}
      </div>
    </div>
  );
}

function LicensePitch({ onStart }: { onStart(): void }) {
  return (
    <section
      aria-labelledby="perfil-licenca"
      className="panel-board flex flex-col gap-4 p-5"
    >
      <div className="flex items-center gap-3">
        <PixelStar size={28} />
        <h2 id="perfil-licenca" className="led text-sm sm:text-base">
          Seja licenciado
        </h2>
      </div>
      <p className="text-sm text-chalk/90">
        Uma licença única libera a edição completa do Footebas. Nada muda dentro
        de campo: a vantagem é só de liberdade, nunca esportiva.
      </p>
      <ul className="flex flex-col gap-2 text-sm">
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
      <Button
        variant="play"
        size="lg"
        className="min-h-14 w-full"
        onClick={onStart}
      >
        <PixelCoin size={18} />
        Pagar com PIX
      </Button>
      <p className="text-xs text-chalk/70">
        O valor aparece na próxima etapa, junto com o QR Code.
      </p>
    </section>
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
}: {
  account: AccountPort;
  pollMs: number;
  now(): Date;
  onPaid(order: OrderView): void;
  onCancel(): void;
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
      className="panel-board flex flex-col gap-4 p-5"
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

function LicensedCard({
  profile,
  account,
  onChanged,
  now,
}: {
  profile: ProfileView;
  account: AccountPort;
  onChanged(message: string): void;
  now(): Date;
}) {
  const [step, setStep] = useState<'idle' | 'confirm' | 'sending' | 'done'>(
    'idle',
  );
  const [message, setMessage] = useState('');
  const { play } = useSound();
  const canRefund = refundable(profile.license, now());

  const refund = async () => {
    setStep('sending');
    setMessage('');
    try {
      const result = await account.refund();
      setStep('done');
      play('confirm');
      onChanged(
        `Reembolso solicitado (${formatCents(result.amountCents)}). A devolução cai na mesma chave PIX em até alguns dias; a licença é encerrada quando o banco confirmar.`,
      );
    } catch (caught) {
      play('error');
      setStep('idle');
      setMessage(
        caught instanceof Error ? caught.message : 'Não foi possível pedir.',
      );
    }
  };

  return (
    <section
      aria-labelledby="perfil-licenciado"
      className="panel-board flex flex-col gap-4 p-5"
    >
      <div className="flex items-center gap-3">
        <SealCheck className="size-7 text-bulb" weight="fill" aria-hidden />
        <h2 id="perfil-licenciado" className="led text-sm sm:text-base">
          Edição completa
        </h2>
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        {LICENSE_BENEFITS.slice(0, 2).map((benefit) => (
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
      {message && (
        <p
          role="status"
          className={cn(
            'border-2 p-3 text-sm',
            step === 'done' ? 'border-bulb' : 'border-destructive',
          )}
        >
          {message}
        </p>
      )}
      {canRefund && step !== 'done' && (
        <div className="grid gap-2 border-t-2 border-chalk/20 pt-3">
          <p className="text-xs text-chalk/70">
            Arrependimento (CDC art. 49): reembolso integral até{' '}
            {profile.license?.refundableUntil &&
              dateTime.format(new Date(profile.license.refundableUntil))}
            . Depois do estorno, a conta volta ao plano grátis e carreiras
            extras ficam bloqueadas (não apagadas).
          </p>
          {step === 'confirm' ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="destructive"
                onClick={() => void refund()}
                disabled={step !== 'confirm'}
              >
                Confirmar reembolso
              </Button>
              <Button variant="ghost" onClick={() => setStep('idle')}>
                Manter licença
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="self-start"
              disabled={step === 'sending'}
              onClick={() => setStep('confirm')}
            >
              Pedir reembolso
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
