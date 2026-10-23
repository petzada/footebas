// Billing persistence port. Every state change triggered by Woovi goes through
// `applyWebhook`, which records the event and applies its effect atomically
// (one transaction in Postgres), so redeliveries are no-ops.

export type OrderStatus = 'pending' | 'paid' | 'expired' | 'refunded';
/** `disputed`: the payer opened a PIX dispute (MED); the license is revoked. */
export type RefundStatus = 'requested' | 'confirmed' | 'rejected' | 'disputed';
export type LicenseStatus = 'active' | 'revoked';
export type Json = Readonly<Record<string, unknown>>;

export interface Order {
  readonly id: string;
  readonly userId: string;
  readonly correlationId: string;
  readonly amountCents: number;
  readonly currency: 'BRL';
  readonly status: OrderStatus;
  readonly brCode?: string;
  readonly qrCodeImage?: string;
  readonly paymentLinkUrl?: string;
  /** Provider's own charge id (AbacatePay `pix_char_…`). */
  readonly providerChargeId?: string;
  readonly expiresAt?: string;
  readonly paidAt?: string;
  readonly pixEndToEndId?: string;
  readonly refundStatus?: RefundStatus;
  readonly refundAttempts: number;
  readonly refundCorrelationId?: string;
  readonly refundEndToEndId?: string;
  readonly refundRequestedAt?: string;
  readonly refundedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface License {
  readonly userId: string;
  readonly orderId: string;
  readonly status: LicenseStatus;
  readonly grantedAt: string;
  readonly revokedAt?: string;
}

export interface NewOrder {
  readonly id: string;
  readonly userId: string;
  readonly correlationId: string;
  readonly amountCents: number;
}

export interface ChargeAttachment {
  readonly providerChargeId?: string;
  readonly brCode?: string;
  readonly qrCodeImage?: string;
  readonly paymentLinkUrl?: string;
  readonly expiresAt?: string;
  readonly payload: Json;
}

export interface RefundAttachment {
  readonly endToEndId?: string;
  readonly payload: Json;
}

/**
 * What a provider notification (or a reconciliation read) means for billing.
 * Orders are matched by the provider's charge id first (AbacatePay does not
 * echo `externalId`/`metadata` back), then by our correlationID.
 */
export type BillingEffect =
  | {
      readonly kind: 'paid';
      /** Provider charge id that was paid (AbacatePay `pix_char_…`). */
      readonly providerChargeId?: string;
      readonly correlationId?: string;
      /**
       * Paid amount in cents, when the provider reports it. Absent means
       * "the charge we created", so the order's own amount is trusted.
       */
      readonly amountCents?: number;
      readonly paidAt: string;
      readonly pixEndToEndId?: string;
      readonly charge?: Json;
    }
  | {
      readonly kind: 'expired';
      readonly correlationId: string;
      readonly orderId?: string;
    }
  | {
      readonly kind: 'refund_confirmed' | 'refund_rejected' | 'disputed';
      /** Direct match (refund API answered synchronously, reconciliation). */
      readonly orderId?: string;
      /** Provider charge ids (AbacatePay `pix_char_…`). */
      readonly providerChargeIds?: readonly string[];
      /** PIX endToEndIds from the notification (original and/or refund). */
      readonly endToEndIds: readonly string[];
    }
  | { readonly kind: 'ignored' };

export type WebhookOutcome =
  | 'paid'
  | 'expired'
  | 'refunded'
  | 'refund_rejected'
  | 'disputed'
  | 'ignored'
  | 'unknown_order'
  | 'amount_mismatch';

export interface WebhookEventRecord {
  readonly id: string;
  readonly type: string;
  readonly payload: Json;
  /** Provider that produced the event (`abacatepay`, `woovi`). */
  readonly provider?: string;
  /**
   * `on_effect`: keep the event record only when it changed billing state
   * (reconciliation reads), so a no-op poll never shadows a later effect.
   */
  readonly persist?: 'always' | 'on_effect';
}

export interface WebhookResult {
  readonly duplicate: boolean;
  readonly outcome: WebhookOutcome;
  /** Order the effect landed on, when one matched. */
  readonly orderId?: string;
  /**
   * Set when a payment landed on a user whose license already belongs to
   * another paid order (paid twice).
   */
  readonly doublePayment?: boolean;
}

/** Outcomes that changed billing state (persisted for `on_effect`). */
export const EFFECTIVE_OUTCOMES: ReadonlySet<WebhookOutcome> = new Set([
  'paid',
  'expired',
  'refunded',
  'refund_rejected',
  'disputed',
]);

export interface BillingRepository {
  license(userId: string): Promise<License | undefined>;
  order(id: string): Promise<Order | undefined>;
  pendingOrder(userId: string): Promise<Order | undefined>;
  latestPaidOrder(userId: string): Promise<Order | undefined>;
  /** Creates the user's pending order, or returns the one that already exists. */
  createPendingOrder(input: NewOrder, now: Date): Promise<Order>;
  /**
   * Single-flight per order: the first provider charge attached wins. When
   * another charge is already attached the order comes back unchanged (with
   * the winner's QR code), so callers compare `providerChargeId`.
   */
  attachCharge(
    orderId: string,
    charge: ChargeAttachment,
    now: Date,
  ): Promise<Order>;
  /**
   * Orders whose provider state may have moved without a webhook reaching
   * us: pending/expired with a provider charge, plus paid orders with a
   * refund in flight, created since `since` (oldest first).
   */
  ordersToReconcile(since: Date, limit: number): Promise<readonly Order[]>;
  /** Pending → expired; no-op otherwise. */
  expireOrder(orderId: string, now: Date): Promise<void>;
  /**
   * Paid order without a refund in flight → refund `requested` with a fresh
   * refund correlationID. Returns the order unchanged when a refund is already
   * requested, or undefined when the order is not refundable.
   */
  beginRefund(
    orderId: string,
    refundCorrelationId: (attempt: number) => string,
    now: Date,
  ): Promise<Order | undefined>;
  attachRefund(
    orderId: string,
    refund: RefundAttachment,
    now: Date,
  ): Promise<void>;
  applyWebhook(
    event: WebhookEventRecord,
    effect: BillingEffect,
    now: Date,
  ): Promise<WebhookResult>;
}
