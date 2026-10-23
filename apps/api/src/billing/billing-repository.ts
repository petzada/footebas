// Billing persistence port. Every state change triggered by Woovi goes through
// `applyWebhook`, which records the event and applies its effect atomically
// (one transaction in Postgres), so redeliveries are no-ops.

export type OrderStatus = 'pending' | 'paid' | 'expired' | 'refunded';
export type RefundStatus = 'requested' | 'confirmed' | 'rejected';
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

/** What a Woovi notification (or a reconciliation read) means for billing. */
export type BillingEffect =
  | {
      readonly kind: 'paid';
      readonly correlationId: string;
      readonly amountCents: number;
      readonly paidAt: string;
      readonly pixEndToEndId?: string;
      readonly charge?: Json;
    }
  | { readonly kind: 'expired'; readonly correlationId: string }
  | {
      readonly kind: 'refund_confirmed' | 'refund_rejected';
      /** Direct match (refund API answered synchronously). */
      readonly orderId?: string;
      /** PIX endToEndIds from the notification (original and/or refund). */
      readonly endToEndIds: readonly string[];
    }
  | { readonly kind: 'ignored' };

export type WebhookOutcome =
  | 'paid'
  | 'expired'
  | 'refunded'
  | 'refund_rejected'
  | 'ignored'
  | 'unknown_order'
  | 'amount_mismatch';

export interface WebhookEventRecord {
  readonly id: string;
  readonly type: string;
  readonly payload: Json;
}

export interface WebhookResult {
  readonly duplicate: boolean;
  readonly outcome: WebhookOutcome;
}

export interface BillingRepository {
  license(userId: string): Promise<License | undefined>;
  order(id: string): Promise<Order | undefined>;
  pendingOrder(userId: string): Promise<Order | undefined>;
  latestPaidOrder(userId: string): Promise<Order | undefined>;
  /** Creates the user's pending order, or returns the one that already exists. */
  createPendingOrder(input: NewOrder, now: Date): Promise<Order>;
  attachCharge(
    orderId: string,
    charge: ChargeAttachment,
    now: Date,
  ): Promise<Order>;
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
