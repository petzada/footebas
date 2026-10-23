'use client';

import { useState } from 'react';
import { LockKey, Star } from '@phosphor-icons/react';
import {
  LicenseBenefits,
  LicenseCheckout,
} from '@/components/license-checkout';
import { BottomSheet } from '@/components/retro/bottom-sheet';
import { Button } from '@/components/ui/button';
import type { AccountPort, OrderView } from '@/lib/account-product';
import { FREE_CAREER_LIMIT, LICENSE_CAREER_LIMIT } from '@/lib/career-api';

export type CareerPaywallReason = 'limit' | 'locked';

const BENEFITS = [
  `Até ${String(LICENSE_CAREER_LIMIT)} saves (carreiras) ao mesmo tempo.`,
  'Comece em qualquer clube, de qualquer série.',
  'Pagamento único via PIX, com reembolso em até 7 dias.',
] as const;

/**
 * Native-style paywall rising from the bottom (white sheet) for the career
 * slots: the free plan's single save is taken (`limit`) or a saved career is
 * locked after a refund (`locked`). "Continuar com licença" runs the same
 * PIX checkout; on payment `onLicensed` unlocks the flow right away.
 */
export function CareerPaywall({
  reason,
  account,
  pollMs = 4000,
  now = () => new Date(),
  onClose,
  onLicensed,
}: {
  reason: CareerPaywallReason;
  account: AccountPort;
  pollMs?: number;
  now?: () => Date;
  onClose(): void;
  /** Paid (or already licensed): reload entitlements and continue. */
  onLicensed(order: OrderView | null): void;
}) {
  const [checkingOut, setCheckingOut] = useState(false);
  const title =
    reason === 'limit'
      ? `Limite de ${String(FREE_CAREER_LIMIT)} save atingido`
      : 'Carreira bloqueada';
  return (
    <BottomSheet
      testId="career-paywall"
      tone="light"
      title={title}
      onClose={onClose}
      footer={
        checkingOut ? undefined : (
          <div className="mx-auto grid w-full max-w-xs gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full"
              onClick={onClose}
            >
              Voltar
            </Button>
            <Button
              type="button"
              variant="play"
              size="lg"
              className="min-h-12 w-full whitespace-normal"
              onClick={() => setCheckingOut(true)}
            >
              <Star data-icon="inline-start" weight="fill" />
              Continuar com licença
            </Button>
          </div>
        )
      }
    >
      {checkingOut ? (
        <LicenseCheckout
          account={account}
          pollMs={pollMs}
          now={now}
          onPaid={onLicensed}
          onCancel={() => setCheckingOut(false)}
          embedded
        />
      ) : (
        <div className="grid gap-4 py-2 text-ink">
          <LockKey
            className="mx-auto size-14 text-primary"
            weight="duotone"
            aria-hidden="true"
          />
          {reason === 'limit' ? (
            <p className="text-sm">
              O plano grátis guarda <strong>{FREE_CAREER_LIMIT} save</strong> e
              ele já está em uso. Para começar outra carreira, exclua um save em{' '}
              <strong>Carregar carreira</strong> ou ative a licença.
            </p>
          ) : (
            <p className="text-sm">
              Depois do reembolso o plano grátis mantém jogável só a carreira
              mais antiga. Esta continua salva, com tudo, e volta na hora com a
              licença. Se preferir, você pode excluí-la.
            </p>
          )}
          <LicenseBenefits items={BENEFITS} tone="light" />
          <p className="text-xs text-muted-foreground">
            O valor vem do servidor e aparece junto com o QR Code.
          </p>
        </div>
      )}
    </BottomSheet>
  );
}
