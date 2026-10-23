// In-memory billing repository for tests and the local dev server. Mirrors
// the Postgres adapter's semantics, including the one-pending-order rule.
import {
  entitlementsFor,
  type Entitlements,
  type EntitlementsPort,
} from '@footebas/database';
import type {
  BillingEffect,
  BillingRepository,
  ChargeAttachment,
  License,
  NewOrder,
  Order,
  RefundAttachment,
  WebhookEventRecord,
  WebhookOutcome,
  WebhookResult,
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

  public async createPendingOrder(input: NewOrder, now: Date): Promise<Order> {
    const existing = await this.pendingOrder(input.userId);
    if (existing) return existing;
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
    return { ...order };
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
    const { payload, ...fields } = charge;
    Object.assign(order, fields, { updatedAt: now.toISOString() });
    this.#charges.set(orderId, payload);
    return Promise.resolve({ ...order });
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
    const ids = new Set(effect.endToEndIds);
    return [...this.#orders.values()].find(
      (order) =>
        (order.pixEndToEndId !== undefined && ids.has(order.pixEndToEndId)) ||
        (order.refundEndToEndId !== undefined &&
          ids.has(order.refundEndToEndId)),
    );
  }

  #apply(effect: BillingEffect, now: Date): WebhookOutcome {
    const instant = now.toISOString();
    switch (effect.kind) {
      case 'ignored':
        return 'ignored';
      case 'expired': {
        const order = [...this.#orders.values()].find(
          (item) => item.correlationId === effect.correlationId,
        );
        if (!order) return 'unknown_order';
        if (order.status !== 'pending') return 'ignored';
        order.status = 'expired';
        order.updatedAt = instant;
        return 'expired';
      }
      case 'paid': {
        const order = [...this.#orders.values()].find(
          (item) => item.correlationId === effect.correlationId,
        );
        if (!order) return 'unknown_order';
        if (effect.amountCents !== order.amountCents) return 'amount_mismatch';
        if (order.status === 'refunded') return 'ignored';
        order.status = 'paid';
        order.paidAt ??= effect.paidAt;
        if (effect.pixEndToEndId !== undefined)
          order.pixEndToEndId ??= effect.pixEndToEndId;
        if (effect.charge !== undefined)
          this.#charges.set(order.id, effect.charge);
        order.updatedAt = instant;
        const license = this.#licenses.get(order.userId);
        if (license?.status !== 'active')
          this.#licenses.set(order.userId, {
            userId: order.userId,
            orderId: order.id,
            status: 'active',
            grantedAt: instant,
          });
        return 'paid';
      }
      case 'refund_confirmed': {
        const order = this.#refundTarget(effect);
        if (!order) return 'unknown_order';
        order.status = 'refunded';
        order.refundStatus = 'confirmed';
        order.refundedAt ??= instant;
        order.updatedAt = instant;
        const license = this.#licenses.get(order.userId);
        if (license?.orderId === order.id && license.status === 'active') {
          license.status = 'revoked';
          license.revokedAt = instant;
        }
        return 'refunded';
      }
      case 'refund_rejected': {
        const order = this.#refundTarget(effect);
        if (!order) return 'unknown_order';
        if (order.status === 'paid') {
          order.refundStatus = 'rejected';
          order.updatedAt = instant;
        }
        return 'refund_rejected';
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
    const outcome = this.#apply(effect, now);
    this.#events.set(event.id, {
      ...event,
      outcome,
      processedAt: now.toISOString(),
    });
    return Promise.resolve({ duplicate: false, outcome });
  }
}
