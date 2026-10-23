// In-memory billing repository for tests and the local dev server. Mirrors
// the Postgres adapter's semantics, including the one-pending-order rule.
import {
  entitlementsFor,
  type Entitlements,
  type EntitlementsPort,
} from '@footebas/database';
import {
  EFFECTIVE_OUTCOMES,
  type BillingEffect,
  type BillingRepository,
  type ChargeAttachment,
  type License,
  type NewOrder,
  type Order,
  type RefundAttachment,
  type WebhookEventRecord,
  type WebhookOutcome,
  type WebhookResult,
} from './billing-repository.js';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

export interface StoredWebhookEvent extends WebhookEventRecord {
  readonly outcome: WebhookOutcome;
  readonly processedAt: string;
}

export class InMemoryBillingRepository implements BillingRepository {
  readonly #orders = new Map<string, Mutable<Order>>();
  readonly #licenses = new Map<string, Mutable<License>>();
  readonly #events = new Map<string, StoredWebhookEvent>();
  readonly #charges = new Map<string, unknown>();

  /** Entitlements read from this repository's licenses. */
  public readonly entitlements: EntitlementsPort = {
    forUser: (userId: string): Promise<Entitlements> =>
      Promise.resolve(
        entitlementsFor(
          this.#licenses.get(userId)?.status === 'active' ? 'licensed' : 'free',
        ),
      ),
  };

  public events(): readonly StoredWebhookEvent[] {
    return [...this.#events.values()];
  }

  public chargePayload(orderId: string): unknown {
    return this.#charges.get(orderId);
  }

  /** Test helper: shifts a paid order's payment instant. */
  public setPaidAt(orderId: string, paidAt: string): void {
    const order = this.#orders.get(orderId);
    if (order) order.paidAt = paidAt;
  }

  public license(userId: string): Promise<License | undefined> {
    const license = this.#licenses.get(userId);
    return Promise.resolve(license ? { ...license } : undefined);
  }

  public order(id: string): Promise<Order | undefined> {
    const order = this.#orders.get(id);
    return Promise.resolve(order ? { ...order } : undefined);
  }

  public pendingOrder(userId: string): Promise<Order | undefined> {
    const order = [...this.#orders.values()].find(
      (item) => item.userId === userId && item.status === 'pending',
    );
    return Promise.resolve(order ? { ...order } : undefined);
  }

  public latestPaidOrder(userId: string): Promise<Order | undefined> {
    const order = [...this.#orders.values()]
      .filter((item) => item.userId === userId && item.status === 'paid')
      .sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''))[0];
    return Promise.resolve(order ? { ...order } : undefined);
  }

  public createPendingOrder(input: NewOrder, now: Date): Promise<Order> {
    // Synchronous check-and-insert, like the partial unique index: two
    // concurrent checkouts can never open two pending orders.
    const existing = [...this.#orders.values()].find(
      (item) => item.userId === input.userId && item.status === 'pending',
    );
    if (existing) return Promise.resolve({ ...existing });
    const instant = now.toISOString();
    const order: Mutable<Order> = {
      ...input,
      currency: 'BRL',
      status: 'pending',
      refundAttempts: 0,
      createdAt: instant,
      updatedAt: instant,
    };
    this.#orders.set(order.id, order);
    return Promise.resolve({ ...order });
  }

  #require(orderId: string): Mutable<Order> {
    const order = this.#orders.get(orderId);
    if (!order) throw new Error(`order ${orderId} not found`);
    return order;
  }

  public attachCharge(
    orderId: string,
    charge: ChargeAttachment,
    now: Date,
  ): Promise<Order> {
    const order = this.#require(orderId);
    // Single-flight: a second provider charge never replaces the first.
    if (
      order.providerChargeId !== undefined &&
      charge.providerChargeId !== undefined &&
      order.providerChargeId !== charge.providerChargeId
    )
      return Promise.resolve({ ...order });
    const { payload, ...fields } = charge;
    Object.assign(order, fields, { updatedAt: now.toISOString() });
    this.#charges.set(orderId, payload);
    return Promise.resolve({ ...order });
  }

  public ordersToReconcile(
    since: Date,
    limit: number,
  ): Promise<readonly Order[]> {
    const from = since.toISOString();
    return Promise.resolve(
      [...this.#orders.values()]
        .filter(
          (order) =>
            order.providerChargeId !== undefined &&
            order.createdAt >= from &&
            (order.status === 'pending' ||
              order.status === 'expired' ||
              (order.status === 'paid' && order.refundStatus === 'requested')),
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(0, limit)
        .map((order) => ({ ...order })),
    );
  }

  public expireOrder(orderId: string, now: Date): Promise<void> {
    const order = this.#require(orderId);
    if (order.status === 'pending') {
      order.status = 'expired';
      order.updatedAt = now.toISOString();
    }
    return Promise.resolve();
  }

  public beginRefund(
    orderId: string,
    refundCorrelationId: (attempt: number) => string,
    now: Date,
  ): Promise<Order | undefined> {
    const order = this.#orders.get(orderId);
    if (order?.status !== 'paid') return Promise.resolve(undefined);
    if (order.refundStatus === 'requested')
      return Promise.resolve({ ...order });
    if (order.refundStatus === 'confirmed') return Promise.resolve(undefined);
    order.refundAttempts += 1;
    order.refundStatus = 'requested';
    order.refundCorrelationId = refundCorrelationId(order.refundAttempts);
    order.refundRequestedAt = now.toISOString();
    delete order.refundEndToEndId;
    order.updatedAt = now.toISOString();
    return Promise.resolve({ ...order });
  }

  public attachRefund(
    orderId: string,
    refund: RefundAttachment,
    now: Date,
  ): Promise<void> {
    const order = this.#require(orderId);
    if (refund.endToEndId !== undefined)
      order.refundEndToEndId = refund.endToEndId;
    order.updatedAt = now.toISOString();
    return Promise.resolve();
  }

  #refundTarget(
    effect: Extract<BillingEffect, { endToEndIds: readonly string[] }>,
  ): Mutable<Order> | undefined {
    if (effect.orderId !== undefined) return this.#orders.get(effect.orderId);
    const charges = new Set(effect.providerChargeIds ?? []);
    const byCharge = [...this.#orders.values()].find(
      (order) =>
        order.providerChargeId !== undefined &&
        charges.has(order.providerChargeId),
    );
    if (byCharge) return byCharge;
    const ids = new Set(effect.endToEndIds);
    return [...this.#orders.values()].find(
      (order) =>
        (order.pixEndToEndId !== undefined && ids.has(order.pixEndToEndId)) ||
        (order.refundEndToEndId !== undefined &&
          ids.has(order.refundEndToEndId)),
    );
  }

  #paidTarget(
    effect: Extract<BillingEffect, { kind: 'paid' }>,
  ): Mutable<Order> | undefined {
    const orders = [...this.#orders.values()];
    return (
      (effect.providerChargeId === undefined
        ? undefined
        : orders.find(
            (item) => item.providerChargeId === effect.providerChargeId,
          )) ??
      (effect.correlationId === undefined
        ? undefined
        : orders.find((item) => item.correlationId === effect.correlationId))
    );
  }

  /**
   * The order behind the license stopped counting (refund, dispute): the
   * license moves to another paid order of the user (paid twice) or is
   * revoked.
   */
  #release(order: Mutable<Order>, instant: string): void {
    const license = this.#licenses.get(order.userId);
    if (license?.orderId !== order.id || license.status !== 'active') return;
    const other = [...this.#orders.values()]
      .filter(
        (item) =>
          item.userId === order.userId &&
          item.id !== order.id &&
          item.status === 'paid' &&
          item.refundStatus !== 'confirmed' &&
          item.refundStatus !== 'disputed',
      )
      .sort((a, b) => (a.paidAt ?? '').localeCompare(b.paidAt ?? ''))[0];
    if (other) {
      license.orderId = other.id;
      return;
    }
    license.status = 'revoked';
    license.revokedAt = instant;
  }

  #apply(effect: BillingEffect, now: Date): Omit<WebhookResult, 'duplicate'> {
    const instant = now.toISOString();
    switch (effect.kind) {
      case 'ignored':
        return { outcome: 'ignored' };
      case 'expired': {
        const order =
          effect.orderId === undefined
            ? [...this.#orders.values()].find(
                (item) => item.correlationId === effect.correlationId,
              )
            : this.#orders.get(effect.orderId);
        if (!order) return { outcome: 'unknown_order' };
        if (order.status !== 'pending')
          return { outcome: 'ignored', orderId: order.id };
        order.status = 'expired';
        order.updatedAt = instant;
        return { outcome: 'expired', orderId: order.id };
      }
      case 'paid': {
        const order = this.#paidTarget(effect);
        if (!order) return { outcome: 'unknown_order' };
        if (
          effect.amountCents !== undefined &&
          effect.amountCents !== order.amountCents
        )
          return { outcome: 'amount_mismatch', orderId: order.id };
        if (order.status === 'refunded' || order.refundStatus === 'disputed')
          return { outcome: 'ignored', orderId: order.id };
        order.status = 'paid';
        order.paidAt ??= effect.paidAt;
        if (effect.providerChargeId !== undefined)
          order.providerChargeId = effect.providerChargeId;
        if (effect.pixEndToEndId !== undefined)
          order.pixEndToEndId ??= effect.pixEndToEndId;
        if (effect.charge !== undefined)
          this.#charges.set(order.id, effect.charge);
        order.updatedAt = instant;
        const license = this.#licenses.get(order.userId);
        if (license?.status !== 'active') {
          this.#licenses.set(order.userId, {
            userId: order.userId,
            orderId: order.id,
            status: 'active',
            grantedAt: instant,
          });
          return { outcome: 'paid', orderId: order.id };
        }
        return {
          outcome: 'paid',
          orderId: order.id,
          ...(license.orderId === order.id ? {} : { doublePayment: true }),
        };
      }
      case 'refund_confirmed': {
        const order = this.#refundTarget(effect);
        if (!order) return { outcome: 'unknown_order' };
        order.status = 'refunded';
        order.refundStatus = 'confirmed';
        order.refundedAt ??= instant;
        order.updatedAt = instant;
        this.#release(order, instant);
        return { outcome: 'refunded', orderId: order.id };
      }
      case 'disputed': {
        const order = this.#refundTarget(effect);
        if (!order) return { outcome: 'unknown_order' };
        if (order.status === 'refunded')
          return { outcome: 'ignored', orderId: order.id };
        order.refundStatus = 'disputed';
        order.updatedAt = instant;
        this.#release(order, instant);
        return { outcome: 'disputed', orderId: order.id };
      }
      case 'refund_rejected': {
        const order = this.#refundTarget(effect);
        if (!order) return { outcome: 'unknown_order' };
        if (order.status === 'paid' && order.refundStatus === 'requested') {
          order.refundStatus = 'rejected';
          order.updatedAt = instant;
        }
        return { outcome: 'refund_rejected', orderId: order.id };
      }
    }
  }

  public applyWebhook(
    event: WebhookEventRecord,
    effect: BillingEffect,
    now: Date,
  ): Promise<WebhookResult> {
    const seen = this.#events.get(event.id);
    if (seen)
      return Promise.resolve({ duplicate: true, outcome: seen.outcome });
    const result = this.#apply(effect, now);
    if (event.persist !== 'on_effect' || EFFECTIVE_OUTCOMES.has(result.outcome))
      this.#events.set(event.id, {
        ...event,
        outcome: result.outcome,
        processedAt: now.toISOString(),
      });
    return Promise.resolve({ duplicate: false, ...result });
  }
}
