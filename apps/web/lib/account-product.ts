/**
 * Perfil e licença única (docs/05, apps/api/src/billing/README.md). Mirrors
 * `GET /v1/me`, `POST /v1/billing/checkout`, `GET /v1/billing/orders/:id` and
 * `POST /v1/billing/refund`. Prices always come from the server.
 */
export type Plan = 'free' | 'licensed';

export interface Entitlements {
  readonly plan: Plan;
  readonly maxCareers: number;
  readonly anyClub: boolean;
}

export interface LicenseInfo {
  readonly status: 'active' | 'revoked';
  readonly orderId: string;
  readonly grantedAt: string;
  readonly revokedAt: string | null;
  /** Last instant a CDC art. 49 refund can be requested. */
  readonly refundableUntil: string | null;
}

export interface ProfileView {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly plan: Plan;
  readonly entitlements: Entitlements;
  readonly license: LicenseInfo | null;
}

export type OrderStatus = 'pending' | 'paid' | 'expired' | 'refunded';

export interface CheckoutView {
  readonly orderId: string;
  readonly status: OrderStatus;
  readonly amountCents: number;
  readonly currency: 'BRL';
  readonly brCode: string | null;
  readonly qrCodeImage: string | null;
  readonly paymentLinkUrl: string | null;
  readonly expiresAt: string | null;
}

export interface OrderView extends CheckoutView {
  readonly createdAt: string;
  readonly paidAt: string | null;
  readonly refund: {
    readonly status: string;
    readonly requestedAt: string | null;
    readonly refundedAt: string | null;
  } | null;
}

export interface RefundView {
  readonly orderId: string;
  readonly amountCents: number;
  readonly status: string;
  readonly requestedAt: string | null;
}

/** The server could not reach Woovi (502 payment provider unavailable). */
export class PaymentProviderUnavailableError extends Error {
  public constructor() {
    super(
      'O serviço de pagamento está indisponível agora. Nada foi cobrado; tente de novo em alguns minutos.',
    );
    this.name = 'PaymentProviderUnavailableError';
  }
}

export interface AccountPort {
  me(): Promise<ProfileView>;
  checkout(): Promise<CheckoutView>;
  order(orderId: string): Promise<OrderView>;
  refund(): Promise<RefundView>;
}

export const FREE_ENTITLEMENTS: Entitlements = {
  plan: 'free',
  maxCareers: 1,
  anyClub: false,
};
export const LICENSED_ENTITLEMENTS: Entitlements = {
  plan: 'licensed',
  maxCareers: 5,
  anyClub: true,
};

export const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function formatCents(cents: number): string {
  return brl.format(cents / 100);
}

/** Whether `license` can still be refunded at `now`. */
export function refundable(
  license: LicenseInfo | null,
  now: Date = new Date(),
): boolean {
  return (
    license?.status === 'active' &&
    license.refundableUntil !== null &&
    new Date(license.refundableUntil).getTime() > now.getTime()
  );
}

/**
 * Offline demo account: free plan; the fake order gets paid after a few
 * status polls so the whole flow can be exercised without a provider.
 */
export function createFakeAccountPort(
  options: {
    profile?: Partial<ProfileView>;
    priceCents?: number;
    /** Polls before the pending order turns `paid` (0 = already paid). */
    paidAfterPolls?: number;
    /** Simulates Woovi being down on checkout. */
    providerDown?: boolean;
    now?: () => Date;
  } = {},
): AccountPort {
  const now = options.now ?? (() => new Date());
  let profile: ProfileView = {
    id: 'demo-user',
    email: 'torcedor@footebas.com',
    displayName: 'Treinador',
    plan: 'free',
    entitlements: FREE_ENTITLEMENTS,
    license: null,
    ...options.profile,
  };
  let order: OrderView | null = null;
  let polls = 0;
  const price = options.priceCents ?? 4990;
  return {
    async me() {
      return profile;
    },
    async checkout() {
      if (options.providerDown) throw new PaymentProviderUnavailableError();
      if (profile.plan === 'licensed')
        throw new Error('Sua conta já tem a licença ativa.');
      if (!order || order.status !== 'pending') {
        const created = now();
        order = {
          orderId: `order_demo_${String(created.getTime())}`,
          status: 'pending',
          amountCents: price,
          currency: 'BRL',
          brCode:
            '00020126580014br.gov.bcb.pix0136demo-footebas-licenca-unica5204000053039865406' +
            String(price / 100) +
            '5802BR5908FOOTEBAS6009SAO PAULO62070503***6304ABCD',
          qrCodeImage: null,
          paymentLinkUrl: null,
          expiresAt: new Date(created.getTime() + 3600 * 1000).toISOString(),
          createdAt: created.toISOString(),
          paidAt: null,
          refund: null,
        };
        polls = 0;
      }
      return order;
    },
    async order(orderId) {
      if (!order || order.orderId !== orderId)
        throw new Error('Pedido não encontrado.');
      if (order.status === 'pending') {
        polls += 1;
        if (polls > (options.paidAfterPolls ?? 2)) {
          const paidAt = now();
          order = { ...order, status: 'paid', paidAt: paidAt.toISOString() };
          profile = {
            ...profile,
            plan: 'licensed',
            entitlements: LICENSED_ENTITLEMENTS,
            license: {
              status: 'active',
              orderId: order.orderId,
              grantedAt: paidAt.toISOString(),
              revokedAt: null,
              refundableUntil: new Date(
                paidAt.getTime() + 7 * 24 * 3600 * 1000,
              ).toISOString(),
            },
          };
        }
      }
      return order;
    },
    async refund() {
      if (!refundable(profile.license, now()))
        throw new Error('O prazo de 7 dias para reembolso já passou.');
      const requestedAt = now().toISOString();
      const orderId = profile.license?.orderId ?? order?.orderId ?? 'order';
      profile = {
        ...profile,
        plan: 'free',
        entitlements: FREE_ENTITLEMENTS,
        license: profile.license
          ? { ...profile.license, status: 'revoked', revokedAt: requestedAt }
          : null,
      };
      if (order) order = { ...order, status: 'refunded' };
      return { orderId, amountCents: price, status: 'requested', requestedAt };
    },
  };
}
