// Licença única (Fase 8): checkout PIX, order status, provider webhook and the
// 7-day refund (CDC art. 49 — direito de arrependimento em compra online).
// PIX provider: AbacatePay (ADR 0016); the Woovi adapter stays as fallback.
import { ApplicationError, AuthenticationError } from '@footebas/application';
import type { FakeAuthIdentity } from '@footebas/contracts';
import type { Entitlements, EntitlementsPort } from '@footebas/database';
import { consoleLogSink, type LogSink } from '../observability.js';
import type {
  BillingEffect,
  BillingRepository,
  License,
  Order,
  RefundStatus,
  WebhookEventRecord,
  WebhookResult,
} from './billing-repository.js';
import {
  interpretAbacateWebhook,
  verifyAbacateWebhook,
} from './abacatepay-webhook.js';
import {
  CHARGE_PAID_EVENTS,
  interpretWooviWebhook,
  type InterpretedWebhook,
} from './webhook-events.js';
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
  /**
   * Which provider signs the webhooks. `abacatepay` authenticates with the
   * `webhookSecret` query parameter (ABACATEPAY_WEBHOOK_SECRET) plus the
   * optional HMAC header; `woovi` (default) uses the RSA signature.
   */
  readonly webhookProvider?: 'woovi' | 'abacatepay';
  readonly config?: Partial<BillingConfig>;
  readonly now?: () => Date;
  readonly newId?: () => string;
  /** Structured log sink (Workers Logs); defaults to JSON on the console. */
  readonly log?: LogSink;
}

/** Result of one scheduled reconciliation run. */
export interface ReconcileRun {
  readonly checked: number;
  readonly paid: number;
  readonly refunded: number;
  readonly disputed: number;
  readonly expired: number;
  readonly failed: number;
}

/** Window and batch size of the scheduled reconciliation. */
export const RECONCILE_WINDOW_HOURS = 48;
export const RECONCILE_BATCH = 50;

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
const HOUR_MS = 60 * 60 * 1000;
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
  readonly #log: LogSink;
  readonly #provider: 'woovi' | 'abacatepay';

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
    this.#log = deps.log ?? consoleLogSink;
    this.#provider = deps.webhookProvider ?? 'woovi';
  }

  /** Applies a reconciliation effect; the event is kept only if it acted. */
  async #applyRead(
    source: string,
    key: string,
    status: string,
    effect: BillingEffect,
  ): Promise<WebhookResult> {
    const result = await this.#deps.repository.applyWebhook(
      {
        id: `${source}:${key}:${status}`,
        type: `${source}:${status}`,
        payload: { chargeId: key, status },
        provider: this.#provider,
        persist: 'on_effect',
      },
      effect,
      this.#now(),
    );
    this.#report(`${source}:${status}`, effect, result, { chargeId: key });
    return result;
  }

  async #paidEffect(
    order: Order,
    charge: WooviCharge,
    source: string,
  ): Promise<WebhookResult> {
    const providerChargeId = charge.globalID ?? order.providerChargeId;
    // We created this charge with the order's amount; when the provider
    // does not report one (AbacatePay `/transparents/check`), trust ours.
    const effect: BillingEffect = {
      kind: 'paid',
      ...(providerChargeId === undefined ? {} : { providerChargeId }),
      correlationId: order.correlationId,
      ...(charge.value === undefined ? {} : { amountCents: charge.value }),
      paidAt: charge.paidAt ?? this.#now().toISOString(),
    };
    return this.#applyRead(
      source,
      providerChargeId ?? order.correlationId,
      'COMPLETED',
      effect,
    );
  }

  /**
   * Reads the order's charge at the provider and applies what happened
   * there (paid, refunded, disputed, expired) idempotently. Throws when the
   * provider is unreachable.
   */
  async #settle(order: Order, source: string): Promise<WebhookResult | null> {
    const charge = await this.#deps.woovi.getCharge(
      order.correlationId,
      order.providerChargeId,
    );
    if (charge === undefined) return null;
    const key =
      charge.globalID ?? order.providerChargeId ?? order.correlationId;
    switch (charge.status) {
      case 'COMPLETED':
        // A paid order only needs the post-payment states.
        return order.status === 'paid'
          ? null
          : this.#paidEffect(order, charge, source);
      case 'REFUNDED':
        return this.#applyRead(source, key, 'REFUNDED', {
          kind: 'refund_confirmed',
          orderId: order.id,
          endToEndIds: [],
        });
      case 'DISPUTED':
        return this.#applyRead(source, key, 'DISPUTED', {
          kind: 'disputed',
          orderId: order.id,
          endToEndIds: [],
        });
      case 'EXPIRED':
        return order.status === 'pending'
          ? this.#applyRead(source, key, 'EXPIRED', {
              kind: 'expired',
              correlationId: order.correlationId,
              orderId: order.id,
            })
          : null;
      case 'ACTIVE':
        return null;
    }
  }

  /**
   * Warns (Workers Logs) whenever money may have arrived without becoming a
   * license, and when a user paid twice.
   */
  #report(
    type: string,
    effect: BillingEffect,
    result: WebhookResult,
    extra: Readonly<Record<string, string | undefined>> = {},
  ): void {
    const completed =
      effect.kind === 'paid' ||
      type === 'transparent.completed' ||
      CHARGE_PAID_EVENTS.has(type);
    const fields = {
      type: 'billing',
      provider: this.#provider,
      eventType: type,
      outcome: result.outcome,
      duplicate: result.duplicate,
      ...(result.orderId === undefined ? {} : { orderId: result.orderId }),
      ...(effect.kind === 'paid'
        ? {
            ...(effect.providerChargeId === undefined
              ? {}
              : { chargeId: effect.providerChargeId }),
            ...(effect.correlationId === undefined
              ? {}
              : { correlationId: effect.correlationId }),
          }
        : {}),
      ...Object.fromEntries(
        Object.entries(extra).filter(([, value]) => value !== undefined),
      ),
    };
    if (completed && result.outcome !== 'paid')
      this.#log({
        ...fields,
        level: 'warn',
        event: 'billing.completed_not_paid',
      });
    if (result.doublePayment === true)
      this.#log({ ...fields, level: 'warn', event: 'billing.double_payment' });
  }

  async #applyWebhookEvent(
    event: InterpretedWebhook,
    now: Date,
    extra: Readonly<Record<string, string | undefined>> = {},
  ): Promise<WebhookResult> {
    const record: WebhookEventRecord = {
      id: event.id,
      type: event.type,
      payload: event.payload,
      provider: this.#provider,
    };
    const result = await this.#deps.repository.applyWebhook(
      record,
      event.effect,
      now,
    );
    this.#report(event.type, event.effect, result, {
      eventId: event.id,
      ...extra,
    });
    return result;
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
        // Ask the provider before giving the old QR code up: a payment whose
        // webhook was lost must become the license, not a second PIX.
        if (order.providerChargeId !== undefined || order.brCode !== undefined)
          await this.#settle(order, 'checkout');
        const settled = (await repository.order(order.id)) ?? order;
        if (settled.status === 'paid') return checkoutView(settled);
        if (settled.status === 'pending')
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
          ...(charge.globalID === undefined
            ? {}
            : { providerChargeId: charge.globalID }),
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
      if (
        charge.globalID !== undefined &&
        attached.providerChargeId !== undefined &&
        attached.providerChargeId !== charge.globalID
      ) {
        // Lost the race (double click, two tabs): the order keeps the first
        // charge; this one is never shown and simply expires unpaid.
        this.#log({
          type: 'billing',
          level: 'info',
          event: 'billing.charge_race_lost',
          provider: this.#provider,
          orderId: order.id,
          chargeId: charge.globalID,
          winnerChargeId: attached.providerChargeId,
        });
        return checkoutView(attached);
      }
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

  /**
   * Owner-only order read; reconciles a pending (or locally expired) charge
   * with the provider, so a payment whose webhook was lost still lands.
   */
  public async order(userId: string, orderId: string): Promise<OrderView> {
    const { repository } = this.#deps;
    const order = await repository.order(orderId);
    if (order?.userId !== userId)
      throw new ApplicationError('NOT_FOUND', 'order not found');
    if (
      (order.status !== 'pending' && order.status !== 'expired') ||
      (order.brCode === undefined && order.providerChargeId === undefined)
    )
      return orderView(order);
    try {
      await this.#settle(order, 'reconcile');
    } catch {
      // Provider unavailable: the webhook and the cron remain the fallback.
    }
    return orderView((await repository.order(orderId)) ?? order);
  }

  /**
   * Scheduled reconciliation (Worker cron): recent orders whose provider
   * state may have changed without a webhook reaching us are read from the
   * provider and their effects applied idempotently.
   */
  public async reconcile(
    options: { readonly windowHours?: number; readonly limit?: number } = {},
  ): Promise<ReconcileRun> {
    const now = this.#now();
    const since = new Date(
      now.getTime() - (options.windowHours ?? RECONCILE_WINDOW_HOURS) * HOUR_MS,
    );
    const orders = await this.#deps.repository.ordersToReconcile(
      since,
      options.limit ?? RECONCILE_BATCH,
    );
    const run = {
      checked: 0,
      paid: 0,
      refunded: 0,
      disputed: 0,
      expired: 0,
      failed: 0,
    };
    for (const order of orders) {
      run.checked += 1;
      try {
        const result = await this.#settle(order, 'cron');
        if (result === null || result.duplicate) continue;
        if (result.outcome === 'paid') run.paid += 1;
        else if (result.outcome === 'refunded') run.refunded += 1;
        else if (result.outcome === 'disputed') run.disputed += 1;
        else if (result.outcome === 'expired') run.expired += 1;
      } catch {
        run.failed += 1;
      }
    }
    return run;
  }

  /** Provider webhook: authenticity, idempotency and effect in one place. */
  public async webhook(
    rawBody: string,
    headers: Readonly<Record<string, string | undefined>>,
    query: Readonly<Record<string, string | undefined>> = {},
  ): Promise<WebhookResult> {
    if (this.#deps.webhookProvider === 'abacatepay') {
      if (
        !(await verifyAbacateWebhook(
          rawBody,
          headers,
          query,
          this.#deps.webhookSecret ?? '',
        ))
      )
        throw new AuthenticationError('invalid webhook secret or signature');
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawBody) as unknown;
      } catch {
        throw new ApplicationError('VALIDATION_ERROR', 'invalid webhook body');
      }
      const now = this.#now();
      const event = await interpretAbacateWebhook(parsed, now, rawBody);
      return this.#applyWebhookEvent(event, now);
    }
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
    return this.#applyWebhookEvent(event, now);
  }

  /** Requests the full refund of the paid license within the CDC window. */
  public async refund(userId: string): Promise<RefundView> {
    const { repository, woovi } = this.#deps;
    // The order behind the active license is the one to refund (a user who
    // paid twice keeps the license through the other order).
    const license = await repository.license(userId);
    const licensed =
      license?.status === 'active'
        ? await repository.order(license.orderId)
        : undefined;
    const paid =
      licensed?.status === 'paid'
        ? licensed
        : await repository.latestPaidOrder(userId);
    if (paid === undefined)
      throw new ApplicationError('NOT_FOUND', 'no paid order to refund');
    if (paid.refundStatus === 'disputed')
      throw new ApplicationError(
        'FORBIDDEN',
        'payment is under dispute at the bank; the license is already suspended',
      );
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
    const refund = await woovi.refundCharge(
      order.correlationId,
      {
        correlationID: order.refundCorrelationId,
        value: order.amountCents,
        comment: 'Footebas - reembolso da licença (7 dias)',
      },
      order.providerChargeId,
    );
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
          provider: this.#provider,
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
