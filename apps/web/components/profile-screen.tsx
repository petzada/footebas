'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, SealCheck, SignOut } from '@phosphor-icons/react';
import {
  LICENSE_BENEFITS,
  LicenseCheckout,
  countdown,
} from '@/components/license-checkout';
import { PlayerAvatar, type PlayerIdentity } from '@/components/start-screens';
import { PixelCoin, PixelStar } from '@/components/retro/sprites';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  formatCents,
  refundable,
  type AccountPort,
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

export { LICENSE_BENEFITS, LicenseCheckout, countdown };

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
                order === null
                  ? 'Sua licença já está ativa: 5 carreiras e qualquer clube.'
                  : `Pagamento confirmado. Licença ativada: agora são 5 carreiras e qualquer clube. Pedido ${order.orderId} · ${formatCents(order.amountCents)}.`,
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
