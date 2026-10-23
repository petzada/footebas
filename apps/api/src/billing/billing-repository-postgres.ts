// Postgres (Supabase via Hyperdrive) billing repository over the tables in
// supabase/migrations/20261024000200_billing.sql.
import type postgres from 'postgres';
import {
  EFFECTIVE_OUTCOMES,
  type BillingEffect,
  type BillingRepository,
  type ChargeAttachment,
  type License,
  type NewOrder,
  type Order,
  type OrderStatus,
  type RefundAttachment,
  type RefundStatus,
  type WebhookEventRecord,
  type WebhookOutcome,
  type WebhookResult,
} from './billing-repository.js';

type Sql = postgres.Sql | postgres.TransactionSql;
type Instant = Date | string | null;

interface OrderRow {
  id: string;
  user_id: string;
  correlation_id: string;
  amount_cents: number;
  status: OrderStatus;
  br_code: string | null;
  qr_code_image: string | null;
  payment_link_url: string | null;
  provider_charge_id: string | null;
  expires_at: Instant;
  paid_at: Instant;
  pix_end_to_end_id: string | null;
  refund_status: RefundStatus | null;
  refund_attempts: number;
  refund_correlation_id: string | null;
  refund_end_to_end_id: string | null;
  refund_requested_at: Instant;
  refunded_at: Instant;
  created_at: Instant;
  updated_at: Instant;
}

interface LicenseRow {
  user_id: string;
  order_id: string;
  status: 'active' | 'revoked';
  granted_at: Instant;
  revoked_at: Instant;
}

const ORDER_COLUMNS = [
  'id',
  'user_id',
  'correlation_id',
  'amount_cents',
  'status',
  'br_code',
  'qr_code_image',
  'payment_link_url',
  'provider_charge_id',
  'expires_at',
  'paid_at',
  'pix_end_to_end_id',
  'refund_status',
  'refund_attempts',
  'refund_correlation_id',
  'refund_end_to_end_id',
  'refund_requested_at',
  'refunded_at',
  'created_at',
  'updated_at',
];

function iso(value: Instant): string | undefined {
  if (value === null) return undefined;
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function defined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as Partial<T>;
}

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    userId: row.user_id,
    correlationId: row.correlation_id,
    amountCents: row.amount_cents,
    currency: 'BRL',
    status: row.status,
    refundAttempts: row.refund_attempts,
    createdAt: iso(row.created_at) ?? '',
    updatedAt: iso(row.updated_at) ?? '',
    ...(defined({
      brCode: row.br_code ?? undefined,
      qrCodeImage: row.qr_code_image ?? undefined,
      paymentLinkUrl: row.payment_link_url ?? undefined,
      providerChargeId: row.provider_charge_id ?? undefined,
      expiresAt: iso(row.expires_at),
      paidAt: iso(row.paid_at),
      pixEndToEndId: row.pix_end_to_end_id ?? undefined,
      refundStatus: row.refund_status ?? undefined,
      refundCorrelationId: row.refund_correlation_id ?? undefined,
      refundEndToEndId: row.refund_end_to_end_id ?? undefined,
      refundRequestedAt: iso(row.refund_requested_at),
      refundedAt: iso(row.refunded_at),
    }) as Partial<Order>),
  };
}

function toLicense(row: LicenseRow): License {
  const revokedAt = iso(row.revoked_at);
  return {
    userId: row.user_id,
    orderId: row.order_id,
    status: row.status,
    grantedAt: iso(row.granted_at) ?? '',
    ...(revokedAt === undefined ? {} : { revokedAt }),
  };
}

export class PostgresBillingRepository implements BillingRepository {
  public constructor(private readonly sql: postgres.Sql) {}

  async #orderWhere(
    sql: Sql,
    condition: postgres.PendingQuery<postgres.Row[]>,
  ): Promise<Order | undefined> {
    const rows = await sql<OrderRow[]>`
      select ${sql(ORDER_COLUMNS)} from footebas.orders where ${condition}
      order by created_at desc limit 1`;
    const row = rows[0];
    return row === undefined ? undefined : toOrder(row);
  }

  public async license(userId: string): Promise<License | undefined> {
    const rows = await this.sql<LicenseRow[]>`
      select user_id, order_id, status, granted_at, revoked_at
      from footebas.licenses where user_id = ${userId}`;
    const row = rows[0];
    return row === undefined ? undefined : toLicense(row);
  }

  public order(id: string): Promise<Order | undefined> {
    return this.#orderWhere(this.sql, this.sql`id = ${id}`);
  }

  public pendingOrder(userId: string): Promise<Order | undefined> {
    return this.#orderWhere(
      this.sql,
      this.sql`user_id = ${userId} and status = 'pending'`,
    );
  }

  public async latestPaidOrder(userId: string): Promise<Order | undefined> {
    const rows = await this.sql<OrderRow[]>`
      select ${this.sql(ORDER_COLUMNS)} from footebas.orders
      where user_id = ${userId} and status = 'paid'
      order by paid_at desc nulls last limit 1`;
    const row = rows[0];
    return row === undefined ? undefined : toOrder(row);
  }

  public async createPendingOrder(input: NewOrder, now: Date): Promise<Order> {
    const instant = now.toISOString();
    // The partial unique index (one pending order per user) settles races.
    const rows = await this.sql<OrderRow[]>`
      insert into footebas.orders
        (id, user_id, correlation_id, amount_cents, status, created_at, updated_at)
      values (${input.id}, ${input.userId}, ${input.correlationId},
        ${input.amountCents}, 'pending', ${instant}, ${instant})
      on conflict do nothing
      returning ${this.sql(ORDER_COLUMNS)}`;
    const created = rows[0];
    if (created !== undefined) return toOrder(created);
    const existing = await this.pendingOrder(input.userId);
    if (existing === undefined)
      throw new Error('pending order conflict without a pending order');
    return existing;
  }

  public async attachCharge(
    orderId: string,
    charge: ChargeAttachment,
    now: Date,
  ): Promise<Order> {
    const providerChargeId = charge.providerChargeId ?? null;
    // Single-flight per order: only the first provider charge is attached
    // (two tabs or a double click both create one; the loser reads the
    // winner's QR code). Woovi charges carry no provider id and stay
    // idempotent by correlationID.
    const rows = await this.sql<OrderRow[]>`
      update footebas.orders set
        woovi_charge = ${this.sql.json(charge.payload as never)},
        br_code = ${charge.brCode ?? null},
        qr_code_image = ${charge.qrCodeImage ?? null},
        payment_link_url = ${charge.paymentLinkUrl ?? null},
        provider_charge_id = coalesce(${providerChargeId}, provider_charge_id),
        expires_at = ${charge.expiresAt ?? null},
        updated_at = ${now.toISOString()}
      where id = ${orderId}
        and (provider_charge_id is null
          or ${providerChargeId}::text is null
          or provider_charge_id = ${providerChargeId})
      returning ${this.sql(ORDER_COLUMNS)}`;
    const row = rows[0];
    if (row !== undefined) return toOrder(row);
    const winner = await this.order(orderId);
    if (winner === undefined) throw new Error(`order ${orderId} not found`);
    return winner;
  }

  public async ordersToReconcile(
    since: Date,
    limit: number,
  ): Promise<readonly Order[]> {
    const rows = await this.sql<OrderRow[]>`
      select ${this.sql(ORDER_COLUMNS)} from footebas.orders
      where provider_charge_id is not null
        and created_at >= ${since.toISOString()}
        and (status in ('pending', 'expired')
          or (status = 'paid' and refund_status = 'requested'))
      order by created_at
      limit ${limit}`;
    return rows.map(toOrder);
  }

  public async expireOrder(orderId: string, now: Date): Promise<void> {
    await this.sql`
      update footebas.orders set status = 'expired', updated_at = ${now.toISOString()}
      where id = ${orderId} and status = 'pending'`;
  }

  public async beginRefund(
    orderId: string,
    refundCorrelationId: (attempt: number) => string,
    now: Date,
  ): Promise<Order | undefined> {
    return this.sql.begin(async (tx) => {
      const rows = await tx<OrderRow[]>`
        select ${tx(ORDER_COLUMNS)} from footebas.orders
        where id = ${orderId} for update`;
      const row = rows[0];
      if (row?.status !== 'paid') return undefined;
      if (row.refund_status === 'requested') return toOrder(row);
      if (row.refund_status === 'confirmed') return undefined;
      const attempt = row.refund_attempts + 1;
      const updated = await tx<OrderRow[]>`
        update footebas.orders set
          refund_status = 'requested',
          refund_attempts = ${attempt},
          refund_correlation_id = ${refundCorrelationId(attempt)},
          refund_requested_at = ${now.toISOString()},
          refund_end_to_end_id = null,
          updated_at = ${now.toISOString()}
        where id = ${orderId}
        returning ${tx(ORDER_COLUMNS)}`;
      const next = updated[0];
      return next === undefined ? undefined : toOrder(next);
    });
  }

  public async attachRefund(
    orderId: string,
    refund: RefundAttachment,
    now: Date,
  ): Promise<void> {
    await this.sql`
      update footebas.orders set
        refund_payload = ${this.sql.json(refund.payload as never)},
        refund_end_to_end_id = coalesce(${refund.endToEndId ?? null}, refund_end_to_end_id),
        updated_at = ${now.toISOString()}
      where id = ${orderId}`;
  }

  async #refundTarget(
    tx: Sql,
    effect: Extract<BillingEffect, { endToEndIds: readonly string[] }>,
  ): Promise<OrderRow | undefined> {
    if (effect.orderId !== undefined) {
      const rows = await tx<OrderRow[]>`
        select ${tx(ORDER_COLUMNS)} from footebas.orders
        where id = ${effect.orderId} for update`;
      return rows[0];
    }
    const charges = [...(effect.providerChargeIds ?? [])];
    if (charges.length > 0) {
      const rows = await tx<OrderRow[]>`
        select ${tx(ORDER_COLUMNS)} from footebas.orders
        where provider_charge_id in ${tx(charges)}
        order by created_at desc limit 1 for update`;
      if (rows[0] !== undefined) return rows[0];
    }
    if (effect.endToEndIds.length === 0) return undefined;
    const ids = [...effect.endToEndIds];
    const rows = await tx<OrderRow[]>`
      select ${tx(ORDER_COLUMNS)} from footebas.orders
      where pix_end_to_end_id in ${tx(ids)} or refund_end_to_end_id in ${tx(ids)}
      order by created_at desc limit 1 for update`;
    return rows[0];
  }

  /** Provider charge id first (AbacatePay echoes nothing else), then ours. */
  async #paidTarget(
    tx: Sql,
    effect: Extract<BillingEffect, { kind: 'paid' }>,
  ): Promise<OrderRow | undefined> {
    if (effect.providerChargeId !== undefined) {
      const rows = await tx<OrderRow[]>`
        select ${tx(ORDER_COLUMNS)} from footebas.orders
        where provider_charge_id = ${effect.providerChargeId}
        order by created_at desc limit 1 for update`;
      if (rows[0] !== undefined) return rows[0];
    }
    if (effect.correlationId === undefined) return undefined;
    const rows = await tx<OrderRow[]>`
      select ${tx(ORDER_COLUMNS)} from footebas.orders
      where correlation_id = ${effect.correlationId} for update`;
    return rows[0];
  }

  /**
   * The order behind the license stopped counting (refund, dispute): the
   * license moves to the user's other paid order (paid twice) or is revoked.
   * Only the license that points at `row` is touched.
   */
  async #release(tx: Sql, row: OrderRow, instant: string): Promise<void> {
    const others = await tx<{ id: string }[]>`
      select id from footebas.orders
      where user_id = ${row.user_id} and id <> ${row.id} and status = 'paid'
        and (refund_status is null or refund_status not in ('confirmed', 'disputed'))
      order by paid_at nulls last, created_at limit 1`;
    const other = others[0];
    if (other !== undefined) {
      await tx`
        update footebas.licenses set order_id = ${other.id}, updated_at = ${instant}
        where user_id = ${row.user_id} and order_id = ${row.id} and status = 'active'`;
      return;
    }
    await tx`
      update footebas.licenses set
        status = 'revoked', revoked_at = ${instant}, updated_at = ${instant}
      where user_id = ${row.user_id} and order_id = ${row.id} and status = 'active'`;
  }

  async #apply(
    tx: Sql,
    effect: BillingEffect,
    now: Date,
  ): Promise<Omit<WebhookResult, 'duplicate'>> {
    const instant = now.toISOString();
    switch (effect.kind) {
      case 'ignored':
        return { outcome: 'ignored' };
      case 'expired': {
        const rows = await tx<{ id: string; status: OrderStatus }[]>`
          select id, status from footebas.orders
          where ${
            effect.orderId === undefined
              ? tx`correlation_id = ${effect.correlationId}`
              : tx`id = ${effect.orderId}`
          } for update`;
        const row = rows[0];
        if (row === undefined) return { outcome: 'unknown_order' };
        if (row.status !== 'pending')
          return { outcome: 'ignored', orderId: row.id };
        await tx`
          update footebas.orders set status = 'expired', updated_at = ${instant}
          where id = ${row.id}`;
        return { outcome: 'expired', orderId: row.id };
      }
      case 'paid': {
        const row = await this.#paidTarget(tx, effect);
        if (row === undefined) return { outcome: 'unknown_order' };
        if (
          effect.amountCents !== undefined &&
          row.amount_cents !== effect.amountCents
        )
          return { outcome: 'amount_mismatch', orderId: row.id };
        if (row.status === 'refunded' || row.refund_status === 'disputed')
          return { outcome: 'ignored', orderId: row.id };
        await tx`
          update footebas.orders set
            status = 'paid',
            paid_at = coalesce(paid_at, ${effect.paidAt}),
            provider_charge_id = coalesce(${effect.providerChargeId ?? null}, provider_charge_id),
            pix_end_to_end_id = coalesce(pix_end_to_end_id, ${effect.pixEndToEndId ?? null}),
            woovi_charge = coalesce(${effect.charge === undefined ? null : tx.json(effect.charge as never)}, woovi_charge),
            updated_at = ${instant}
          where id = ${row.id}`;
        const licensed = await tx<{ order_id: string }[]>`
          insert into footebas.licenses (user_id, order_id, status, granted_at, updated_at)
          values (${row.user_id}, ${row.id}, 'active', ${instant}, ${instant})
          on conflict (user_id) do update set
            order_id = excluded.order_id,
            status = 'active',
            granted_at = excluded.granted_at,
            revoked_at = null,
            updated_at = excluded.updated_at
          where footebas.licenses.status <> 'active'
          returning order_id`;
        if (licensed.length > 0) return { outcome: 'paid', orderId: row.id };
        // The license was already active: same order (redelivery) or paid twice.
        const current = await tx<{ order_id: string }[]>`
          select order_id from footebas.licenses where user_id = ${row.user_id}`;
        return {
          outcome: 'paid',
          orderId: row.id,
          ...(current[0]?.order_id === row.id ? {} : { doublePayment: true }),
        };
      }
      case 'refund_confirmed': {
        const row = await this.#refundTarget(tx, effect);
        if (row === undefined) return { outcome: 'unknown_order' };
        await tx`
          update footebas.orders set
            status = 'refunded',
            refund_status = 'confirmed',
            refunded_at = coalesce(refunded_at, ${instant}),
            updated_at = ${instant}
          where id = ${row.id}`;
        await this.#release(tx, row, instant);
        return { outcome: 'refunded', orderId: row.id };
      }
      case 'disputed': {
        const row = await this.#refundTarget(tx, effect);
        if (row === undefined) return { outcome: 'unknown_order' };
        if (row.status === 'refunded')
          return { outcome: 'ignored', orderId: row.id };
        await tx`
          update footebas.orders set refund_status = 'disputed', updated_at = ${instant}
          where id = ${row.id}`;
        await this.#release(tx, row, instant);
        return { outcome: 'disputed', orderId: row.id };
      }
      case 'refund_rejected': {
        const row = await this.#refundTarget(tx, effect);
        if (row === undefined) return { outcome: 'unknown_order' };
        await tx`
          update footebas.orders set refund_status = 'rejected', updated_at = ${instant}
          where id = ${row.id} and status = 'paid' and refund_status = 'requested'`;
        return { outcome: 'refund_rejected', orderId: row.id };
      }
    }
  }

  public async applyWebhook(
    event: WebhookEventRecord,
    effect: BillingEffect,
    now: Date,
  ): Promise<WebhookResult> {
    return this.sql.begin(async (tx) => {
      const inserted = await tx<{ id: string }[]>`
        insert into footebas.webhook_events (id, provider, type, payload, received_at)
        values (${event.id}, ${event.provider ?? 'woovi'}, ${event.type},
          ${tx.json(event.payload as never)}, ${now.toISOString()})
        on conflict (id) do nothing
        returning id`;
      if (inserted.length === 0) {
        const rows = await tx<{ outcome: WebhookOutcome | null }[]>`
          select outcome from footebas.webhook_events where id = ${event.id}`;
        return { duplicate: true, outcome: rows[0]?.outcome ?? 'ignored' };
      }
      const result = await this.#apply(tx, effect, now);
      if (
        event.persist === 'on_effect' &&
        !EFFECTIVE_OUTCOMES.has(result.outcome)
      ) {
        // A reconciliation read that changed nothing leaves no trace, so it
        // can never shadow the effect of a later poll with the same key.
        await tx`delete from footebas.webhook_events where id = ${event.id}`;
        return { duplicate: false, ...result };
      }
      await tx`
        update footebas.webhook_events
        set outcome = ${result.outcome}, processed_at = ${now.toISOString()}
        where id = ${event.id}`;
      return { duplicate: false, ...result };
    });
  }
}
