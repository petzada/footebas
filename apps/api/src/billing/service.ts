// Licença única (Fase 8): checkout PIX, order status, Woovi webhook and the
// 7-day refund (CDC art. 49 — direito de arrependimento em compra online).
import { ApplicationError, AuthenticationError } from '@footebas/application';
import type { FakeAuthIdentity } from '@footebas/contracts';
import type { Entitlements, EntitlementsPort } from '@footebas/database';
import type {
  BillingEffect,
  BillingRepository,
  License,
  Order,
  RefundStatus,
  WebhookResult,
} from './billing-repository.js';
import { interpretWooviWebhook } from './webhook-events.js';
import {
  verifyWithSource,
  WOOVI_SIGNATURE_HEADER,
  type PublicKeySource,
} from './webhook-signature.js';
import type { WooviCharge, WooviClient } from './woovi-client.js';

export interface BillingConfig {
  /** License price in cents (LICENSE_PRICE_CENTS). */
  readonly priceCents: number;
  /** PIX QR code lifetime in seconds (LICENSE_CHARGE_EXPIRES_IN, min 300). */
  readonly chargeExpiresInSeconds: number;
  /** Refund window in days (CDC: 7). */
  readonly refundWindowDays: number;
}

/** R$ 49,90: midpoint of the R$ 39,90/49,90/59,90 range in docs/05 §2. */
export const DEFAULT_LICENSE_PRICE_CENTS = 4990;

export const DEFAULT_BILLING_CONFIG: BillingConfig = Object.freeze({
  priceCents: DEFAULT_LICENSE_PRICE_CENTS,
  chargeExpiresInSeconds: 3600,
  refundWindowDays: 7,
});

export interface BillingServiceDependencies {
  readonly repository: BillingRepository;
  readonly woovi: WooviClient;
  readonly entitlements: EntitlementsPort;
  readonly webhookKeys: PublicKeySource;
  /**
   * Optional WOOVI_WEBHOOK_SECRET: value of the `authorization` HTTP header
   * configured on the webhook in the Woovi panel ("Cabeçalhos HTTP"). Checked
   * in addition to the RSA signature.
   */
  readonly webhookSecret?: string;
  readonly config?: Partial<BillingConfig>;
  readonly now?: () => Date;
  readonly newId?: () => string;
}

export interface CheckoutView {
  readonly orderId: string;
  readonly status: Order['status'];
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
    readonly status: RefundStatus;
    readonly requestedAt: string | null;
    readonly refundedAt: string | null;
  } | null;
}

export interface LicenseView {
  readonly status: License['status'];
  readonly orderId: string;
  readonly grantedAt: string;
  readonly revokedAt: string | null;
  readonly refundableUntil: string | null;
}

export interface MeView {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly plan: Entitlements['plan'];
  readonly entitlements: Entitlements;
  readonly license: LicenseView | null;
}

export interface RefundView {
  readonly orderId: string;
  readonly amountCents: number;
  readonly status: RefundStatus;
  readonly requestedAt: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** A pending QR code this close to expiry is replaced instead of reused. */
const REUSE_MARGIN_MS = 60 * 1000;

const encoder = new TextEncoder();
async function timingSafeEqual(left: string, right: string): Promise<boolean> {
  const [a, b] = await Promise.all(
    [left, right].map(
      async (value) =>
        new Uint8Array(
          await crypto.subtle.digest('SHA-256', encoder.encode(value)),
        ),
    ),
  );
  let difference = 0;
  for (let index = 0; index < 32; index++)
    difference |= (a?.[index] ?? 0) ^ (b?.[index] ?? 0);
  return difference === 0;
}

function checkoutView(order: Order): CheckoutView {
  return {
    orderId: order.id,
    status: order.status,
    amountCents: order.amountCents,
    currency: order.currency,
    brCode: order.brCode ?? null,
    qrCodeImage: order.qrCodeImage ?? null,
    paymentLinkUrl: order.paymentLinkUrl ?? null,
    expiresAt: order.expiresAt ?? null,
  };
}

function orderView(order: Order): OrderView {
  return {
    ...checkoutView(order),
    createdAt: order.createdAt,
    paidAt: order.paidAt ?? null,
    refund:
      order.refundStatus === undefined
        ? null
        : {
            status: order.refundStatus,
            requestedAt: order.refundRequestedAt ?? null,
            refundedAt: order.refundedAt ?? null,
          },
  };
}

export class BillingService {
  readonly #deps: BillingServiceDependencies;
  readonly #config: BillingConfig;
  readonly #now: () => Date;
  readonly #newId: () => string;

  public constructor(deps: BillingServiceDependencies) {
    this.#deps = deps;
    this.#config = { ...DEFAULT_BILLING_CONFIG, ...deps.config };
    if (
      !Number.isInteger(this.#config.priceCents) ||
      this.#config.priceCents <= 0
    )
      throw new RangeError('license price must be a positive integer (cents)');
    this.#now = deps.now ?? (() => new Date());
    this.#newId = deps.newId ?? (() => crypto.randomUUID().replaceAll('-', ''));
  }

  async #paidEffect(
    order: Order,
    charge: WooviCharge,
    source: string,
  ): Promise<WebhookResult> {
    const effect: BillingEffect = {
      kind: 'paid',
      correlationId: order.correlationId,
      amountCents: charge.value,
      paidAt: charge.paidAt ?? this.#now().toISOString(),
    };
    return this.#deps.repository.applyWebhook(
      {
        id: `${source}:${order.correlationId}:COMPLETED`,
        type: `${source}:COMPLETED`,
        payload: { correlationID: order.correlationId, status: charge.status },
      },
      effect,
      this.#now(),
    );
  }

  /** Creates (or reuses) the user's pending PIX charge for the license. */
  public async checkout(userId: string): Promise<CheckoutView> {
    const { repository, woovi, entitlements } = this.#deps;
    if ((await entitlements.forUser(userId)).plan === 'licensed')
      throw new ApplicationError('VERSION_CONFLICT', 'license already active');
    for (let attempt = 0; attempt < 2; attempt++) {
      const now = this.#now();
      let order = await repository.pendingOrder(userId);
      if (
        order?.expiresAt !== undefined &&
        Date.parse(order.expiresAt) - REUSE_MARGIN_MS <= now.getTime()
      ) {
        await repository.expireOrder(order.id, now);
        order = undefined;
      }
      if (order?.brCode !== undefined) return checkoutView(order);
      if (order === undefined) {
        const id = this.#newId();
        order = await repository.createPendingOrder(
          {
            id: `order_${id}`,
            userId,
            correlationId: `footebas_license_${id}`,
            amountCents: this.#config.priceCents,
          },
          now,
        );
        if (order.brCode !== undefined) return checkoutView(order);
      }
      // Idempotent on Woovi's side (`return_existing=true` + correlationID).
      const charge = await woovi.createCharge({
        correlationID: order.correlationId,
        value: order.amountCents,
        expiresIn: Math.max(300, this.#config.chargeExpiresInSeconds),
        comment: 'Footebas - licença completa',
      });
      if (charge.status === 'EXPIRED') {
        await repository.expireOrder(order.id, now);
        continue;
      }
      const attached = await repository.attachCharge(
        order.id,
        {
          ...(charge.brCode === undefined ? {} : { brCode: charge.brCode }),
          ...(charge.qrCodeImage === undefined
            ? {}
            : { qrCodeImage: charge.qrCodeImage }),
          ...(charge.paymentLinkUrl === undefined
            ? {}
            : { paymentLinkUrl: charge.paymentLinkUrl }),
          ...(charge.expiresDate === undefined
            ? {}
            : { expiresAt: new Date(charge.expiresDate).toISOString() }),
          payload: { charge: charge.raw },
        },
        now,
      );
      if (charge.status === 'COMPLETED') {
        await this.#paidEffect(attached, charge, 'checkout');
        return checkoutView((await repository.order(order.id)) ?? attached);
      }
      return checkoutView(attached);
    }
    throw new ApplicationError(
      'VERSION_CONFLICT',
      'could not open a payable charge, try again',
    );
  }

  /** Owner-only order read; reconciles a pending charge with Woovi. */
  public async order(userId: string, orderId: string): Promise<OrderView> {
    const { repository, woovi } = this.#deps;
    const order = await repository.order(orderId);
    if (order?.userId !== userId)
      throw new ApplicationError('NOT_FOUND', 'order not found');
    if (order.status !== 'pending' || order.brCode === undefined)
      return orderView(order);
    try {
      const charge = await woovi.getCharge(order.correlationId);
      if (charge?.status === 'COMPLETED')
        await this.#paidEffect(order, charge, 'reconcile');
      else if (charge?.status === 'EXPIRED')
        await repository.applyWebhook(
          {
            id: `reconcile:${order.correlationId}:EXPIRED`,
            type: 'reconcile:EXPIRED',
            payload: { correlationID: order.correlationId },
          },
          { kind: 'expired', correlationId: order.correlationId },
          this.#now(),
        );
    } catch {
      // Woovi unavailable: the webhook remains the source of truth.
    }
    return orderView((await repository.order(orderId)) ?? order);
  }

  /** Woovi webhook: authenticity, idempotency and effect in one place. */
  public async webhook(
    rawBody: string,
    headers: Readonly<Record<string, string | undefined>>,
  ): Promise<WebhookResult> {
    const secret = this.#deps.webhookSecret;
    if (
      secret !== undefined &&
      secret !== '' &&
      !(await timingSafeEqual(headers.authorization ?? '', secret))
    )
      throw new AuthenticationError('invalid webhook authorization');
    if (
      !(await verifyWithSource(
        this.#deps.webhookKeys,
        rawBody,
        headers[WOOVI_SIGNATURE_HEADER],
      ))
    )
      throw new AuthenticationError('invalid webhook signature');
    let body: unknown;
    try {
      body = JSON.parse(rawBody) as unknown;
    } catch {
      throw new ApplicationError('VALIDATION_ERROR', 'invalid webhook body');
    }
    const now = this.#now();
    const event = await interpretWooviWebhook(body, rawBody, now);
    return this.#deps.repository.applyWebhook(
      { id: event.id, type: event.type, payload: event.payload },
      event.effect,
      now,
    );
  }

  /** Requests the full refund of the paid license within the CDC window. */
  public async refund(userId: string): Promise<RefundView> {
    const { repository, woovi } = this.#deps;
    const paid = await repository.latestPaidOrder(userId);
    if (paid === undefined)
      throw new ApplicationError('NOT_FOUND', 'no paid order to refund');
    const view = (order: Order): RefundView => ({
      orderId: order.id,
      amountCents: order.amountCents,
      status: order.refundStatus ?? 'requested',
      requestedAt: order.refundRequestedAt ?? null,
    });
    // Already accepted by Woovi: wait for the confirmation webhook.
    if (
      paid.refundStatus === 'requested' &&
      paid.refundEndToEndId !== undefined
    )
      return view(paid);
    const now = this.#now();
    if (paid.refundStatus !== 'requested') {
      const paidAt = Date.parse(paid.paidAt ?? paid.createdAt);
      if (now.getTime() - paidAt > this.#config.refundWindowDays * DAY_MS)
        throw new ApplicationError(
          'FORBIDDEN',
          `refund window of ${String(this.#config.refundWindowDays)} days has passed`,
        );
    }
    const order = await repository.beginRefund(
      paid.id,
      (attempt) => `${paid.correlationId}_refund_${String(attempt)}`,
      now,
    );
    if (order?.refundCorrelationId === undefined)
      throw new ApplicationError('VERSION_CONFLICT', 'order is not refundable');
    const refund = await woovi.refundCharge(order.correlationId, {
      correlationID: order.refundCorrelationId,
      value: order.amountCents,
      comment: 'Footebas - reembolso da licença (7 dias)',
    });
    await repository.attachRefund(
      order.id,
      {
        ...(refund.endToEndId === undefined
          ? {}
          : { endToEndId: refund.endToEndId }),
        payload: { refund: refund.raw },
      },
      now,
    );
    const status = refund.status.toUpperCase();
    if (status === 'CONFIRMED' || status === 'REJECTED')
      await repository.applyWebhook(
        {
          id: `refund-response:${order.refundCorrelationId}:${status}`,
          type: `refund-response:${status}`,
          payload: { refund: refund.raw },
        },
        {
          kind: status === 'CONFIRMED' ? 'refund_confirmed' : 'refund_rejected',
          orderId: order.id,
          endToEndIds: [],
        },
        now,
      );
    return view((await repository.order(order.id)) ?? order);
  }

  /** Profile with plan, entitlements and license. */
  public async me(identity: FakeAuthIdentity): Promise<MeView> {
    const { repository, entitlements } = this.#deps;
    const [granted, license] = await Promise.all([
      entitlements.forUser(identity.userId),
      repository.license(identity.userId),
    ]);
    let refundableUntil: string | null = null;
    if (license?.status === 'active') {
      const order = await repository.order(license.orderId);
      if (order?.paidAt !== undefined && order.refundStatus !== 'requested')
        refundableUntil = new Date(
          Date.parse(order.paidAt) + this.#config.refundWindowDays * DAY_MS,
        ).toISOString();
    }
    return {
      id: identity.userId,
      email: identity.email,
      displayName: identity.displayName,
      plan: granted.plan,
      entitlements: { ...granted },
      license:
        license === undefined
          ? null
          : {
              status: license.status,
              orderId: license.orderId,
              grantedAt: license.grantedAt,
              revokedAt: license.revokedAt ?? null,
              refundableUntil,
            },
    };
  }
}
