/* eslint-disable @typescript-eslint/no-base-to-string -- fetch fakes take string URLs and bodies */
// AbacatePay hardening: the provider charge id is the key, reconciliation
// never trusts a missing amount, refunds/disputes made outside the app revoke
// the license, and checkout is single-flight per order.
import { describe, expect, it } from 'vitest';
import type { LogEntry } from '../observability.js';
import { AbacatePayClient } from './abacatepay-client.js';
import { InMemoryBillingRepository } from './billing-repository-memory.js';
import { BillingService } from './service.js';

interface FakeCharge {
  id: string;
  status: string;
  externalId: string;
}

const envelope = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ data, success: status < 400, error: null }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/**
 * AbacatePay as observed in production: `create` returns a fresh
 * `pix_char_…` per call with amount, `check` answers id/status/expiresAt
 * only, and nothing of ours (externalId, metadata) is echoed back.
 */
function fakeAbacate(clock: { now: Date }) {
  const charges = new Map<string, FakeCharge>();
  let sequence = 0;
  const calls: string[] = [];
  const held: (() => void)[] = [];
  const set = (id: string, status: string) => {
    const charge = charges.get(id);
    if (!charge) throw new Error(`unknown charge ${id}`);
    charge.status = status;
  };
  const state = {
    charges,
    calls,
    /** When set, `create` waits until `releaseCreates()` (FIFO). */
    holdCreates: false,
    releaseCreates: () => held.shift()?.(),
    pay: (id: string) => set(id, 'PAID'),
    set,
  };
  const client = new AbacatePayClient({
    apiKey: 'abc_test',
    fetch: async (input, init) => {
      const url = String(input);
      if (url.endsWith('/transparents/create')) {
        calls.push('create');
        const sent = JSON.parse(String(init?.body)) as {
          data: { amount: number; expiresIn: number; externalId: string };
        };
        const id = `pix_char_${String(++sequence)}`;
        charges.set(id, {
          id,
          status: 'PENDING',
          externalId: sent.data.externalId,
        });
        if (state.holdCreates)
          await new Promise<void>((resolve) => held.push(resolve));
        return envelope({
          id,
          amount: sent.data.amount,
          status: 'PENDING',
          devMode: false,
          brCode: `000201-${id}`,
          brCodeBase64: `data:image/png;base64,${id}`,
          expiresAt: new Date(
            clock.now.getTime() + sent.data.expiresIn * 1000,
          ).toISOString(),
          metadata: {},
        });
      }
      if (url.includes('/transparents/check')) {
        calls.push('check');
        const id = new URL(url).searchParams.get('id') ?? '';
        const charge = charges.get(id);
        if (!charge) return envelope(null, 404);
        // The documented check answer has no amount.
        return envelope({ id, status: charge.status, expiresAt: 'x' });
      }
      if (url.endsWith('/transparents/refund')) {
        calls.push('refund');
        const { id } = JSON.parse(String(init?.body)) as { id: string };
        set(id, 'REFUNDED');
        return envelope({ id: 'tran_1', status: 'COMPLETE', originalId: id });
      }
      return envelope(null, 404);
    },
  });
  return { client, state };
}

function setup() {
  const clock = { now: new Date('2026-10-23T12:00:00.000Z') };
  const repository = new InMemoryBillingRepository();
  const { client, state } = fakeAbacate(clock);
  const logs: LogEntry[] = [];
  let sequence = 0;
  const service = new BillingService({
    repository,
    woovi: client,
    entitlements: repository.entitlements,
    webhookKeys: { keys: () => Promise.resolve([]) },
    webhookProvider: 'abacatepay',
    webhookSecret: 'segredo',
    now: () => clock.now,
    newId: () => `id${String(++sequence)}`,
    log: (entry) => logs.push(entry),
  });
  const webhook = (event: unknown) =>
    service.webhook(JSON.stringify(event), {}, { webhookSecret: 'segredo' });
  const completed = (chargeId: string, extra: object = {}) =>
    webhook({
      id: `log_paid_${chargeId}`,
      event: 'transparent.completed',
      apiVersion: 2,
      devMode: false,
      data: {
        transparent: { id: chargeId, status: 'PAID', metadata: {}, ...extra },
      },
    });
  const later = (ms: number) => {
    clock.now = new Date(clock.now.getTime() + ms);
  };
  const plan = async (userId = 'u1') =>
    (await repository.entitlements.forUser(userId)).plan;
  return {
    clock,
    repository,
    state,
    logs,
    service,
    webhook,
    completed,
    later,
    plan,
  };
}

const HOUR = 60 * 60 * 1000;

describe('AbacatePay · webhook casa pelo id da cobrança', () => {
  it('pagamento sem externalId/metadata/amount libera a licença e grava o provider real', async () => {
    const t = setup();
    const checkout = await t.service.checkout('u1');
    const order = await t.repository.order(checkout.orderId);
    expect(order?.providerChargeId).toBe('pix_char_1');
    const result = await t.completed('pix_char_1');
    expect(result).toMatchObject({ duplicate: false, outcome: 'paid' });
    expect(await t.plan()).toBe('licensed');
    expect(t.repository.events()[0]).toMatchObject({ provider: 'abacatepay' });
    expect(t.logs).toEqual([]);
  });

  it('pagamento que não vira licença gera console.warn estruturado', async () => {
    const t = setup();
    const unknown = await t.completed('pix_char_999');
    expect(unknown.outcome).toBe('unknown_order');
    await t.service.checkout('u1');
    const mismatch = await t.completed('pix_char_1', { amount: 1 });
    expect(mismatch.outcome).toBe('amount_mismatch');
    expect(
      t.logs.map((entry) => [entry.level, entry.event, entry.outcome]),
    ).toEqual([
      ['warn', 'billing.completed_not_paid', 'unknown_order'],
      ['warn', 'billing.completed_not_paid', 'amount_mismatch'],
    ]);
    expect(t.logs[0]).toMatchObject({
      type: 'billing',
      chargeId: 'pix_char_999',
      eventId: 'log_paid_pix_char_999',
    });
  });

  it('reembolso feito fora do app (painel AbacatePay) revoga pelo id da cobrança', async () => {
    const t = setup();
    await t.service.checkout('u1');
    await t.completed('pix_char_1');
    const refunded = await t.webhook({
      id: 'log_refund',
      event: 'transparent.refunded',
      data: { transparent: { id: 'pix_char_1', status: 'REFUNDED' } },
    });
    expect(refunded.outcome).toBe('refunded');
    expect(await t.plan()).toBe('free');
    expect((await t.repository.order('order_id1'))?.status).toBe('refunded');
  });

  it('disputa (MED) revoga como reembolso em andamento; pagamento reentregue não reativa', async () => {
    const t = setup();
    await t.service.checkout('u1');
    await t.completed('pix_char_1');
    const disputed = await t.webhook({
      id: 'log_dispute',
      event: 'transparent.disputed',
      data: { transparent: { id: 'pix_char_1', status: 'UNDER_DISPUTE' } },
    });
    expect(disputed.outcome).toBe('disputed');
    expect(await t.plan()).toBe('free');
    // A manual resend from the dashboard gets a new id: still no license.
    const resend = await t.webhook({
      id: 'log_paid_resend',
      event: 'transparent.completed',
      data: { transparent: { id: 'pix_char_1', status: 'PAID' } },
    });
    expect(resend.outcome).toBe('ignored');
    expect(await t.plan()).toBe('free');
  });

  it('reembolso que chega antes do pagamento: o completed depois não concede licença', async () => {
    const t = setup();
    await t.service.checkout('u1');
    const refunded = await t.webhook({
      id: 'log_refund_first',
      event: 'transparent.refunded',
      data: { transparent: { id: 'pix_char_1' } },
    });
    expect(refunded.outcome).toBe('refunded');
    const late = await t.completed('pix_char_1');
    expect(late.outcome).toBe('ignored');
    expect(await t.plan()).toBe('free');
    expect(t.logs).toMatchObject([
      {
        level: 'warn',
        event: 'billing.completed_not_paid',
        outcome: 'ignored',
      },
    ]);
  });
});

describe('AbacatePay · reconciliação', () => {
  it('consulta sem amount confia no valor do pedido e não grava evento inócuo', async () => {
    const t = setup();
    const checkout = await t.service.checkout('u1');
    // Still pending: polling leaves no event behind.
    expect((await t.service.order('u1', checkout.orderId)).status).toBe(
      'pending',
    );
    expect(t.repository.events()).toEqual([]);
    t.state.pay('pix_char_1');
    const paid = await t.service.order('u1', checkout.orderId);
    expect(paid.status).toBe('paid');
    expect(await t.plan()).toBe('licensed');
    expect(t.repository.events()).toMatchObject([
      { id: 'reconcile:pix_char_1:COMPLETED', outcome: 'paid' },
    ]);
    // The webhook arriving afterwards is harmless.
    expect((await t.completed('pix_char_1')).outcome).toBe('paid');
  });

  it('evento de reconciliação sem efeito nunca é persistido', async () => {
    const repository = new InMemoryBillingRepository();
    const result = await repository.applyWebhook(
      {
        id: 'reconcile:x:COMPLETED',
        type: 'reconcile',
        payload: {},
        persist: 'on_effect',
      },
      { kind: 'paid', providerChargeId: 'nope', paidAt: 'x' },
      new Date(),
    );
    expect(result.outcome).toBe('unknown_order');
    expect(repository.events()).toEqual([]);
  });

  it('pedido expirado localmente ainda é reconciliado ao consultar', async () => {
    const t = setup();
    const checkout = await t.service.checkout('u1');
    await t.repository.expireOrder(checkout.orderId, t.clock.now);
    t.state.pay('pix_char_1');
    expect((await t.service.order('u1', checkout.orderId)).status).toBe('paid');
    expect(await t.plan()).toBe('licensed');
  });

  it('REFUNDED e UNDER_DISPUTE na consulta nunca concedem licença', async () => {
    const t = setup();
    const first = await t.service.checkout('u1');
    t.state.set('pix_char_1', 'REFUNDED');
    expect((await t.service.order('u1', first.orderId)).status).toBe(
      'refunded',
    );
    expect(await t.plan()).toBe('free');

    const second = await t.service.checkout('u2');
    t.state.set('pix_char_2', 'UNDER_DISPUTE');
    await t.service.order('u2', second.orderId);
    expect(await t.plan('u2')).toBe('free');
    expect((await t.repository.order(second.orderId))?.refundStatus).toBe(
      'disputed',
    );
    // Even if the provider later says PAID, a disputed order stays locked.
    t.state.pay('pix_char_2');
    await t.service.order('u2', second.orderId);
    expect(await t.plan('u2')).toBe('free');
  });

  it('cron: aplica pagos/reembolsados das últimas 48 h de forma idempotente', async () => {
    const t = setup();
    await t.service.checkout('old'); // pix_char_1
    t.later(50 * HOUR);
    await t.service.checkout('a'); // pix_char_2
    await t.service.checkout('b'); // pix_char_3
    await t.service.checkout('c'); // pix_char_4
    t.state.pay('pix_char_1');
    t.state.pay('pix_char_2');
    t.state.set('pix_char_3', 'REFUNDED');
    t.later(2 * HOUR);
    const run = await t.service.reconcile();
    expect(run).toEqual({
      checked: 3,
      paid: 1,
      refunded: 1,
      disputed: 0,
      expired: 0,
      failed: 0,
    });
    expect(await t.plan('a')).toBe('licensed');
    expect(await t.plan('b')).toBe('free');
    // Outside the 48 h window: left to the webhook / the order read.
    expect(await t.plan('old')).toBe('free');
    // Second run: nothing new happens.
    const again = await t.service.reconcile();
    expect(again).toMatchObject({ checked: 1, paid: 0, refunded: 0 });
  });
});

describe('AbacatePay · checkout', () => {
  it('pedido vencido mas pago (webhook perdido) vira licença em vez de novo PIX', async () => {
    const t = setup();
    const first = await t.service.checkout('u1');
    t.state.pay('pix_char_1');
    t.later(2 * HOUR);
    const again = await t.service.checkout('u1');
    expect(again).toMatchObject({ orderId: first.orderId, status: 'paid' });
    expect(await t.plan()).toBe('licensed');
    expect(t.state.calls.filter((call) => call === 'create')).toHaveLength(1);
  });

  it('pedido vencido e não pago é expirado e substituído', async () => {
    const t = setup();
    const first = await t.service.checkout('u1');
    t.later(2 * HOUR);
    const second = await t.service.checkout('u1');
    expect(second.orderId).not.toBe(first.orderId);
    expect((await t.repository.order(first.orderId))?.status).toBe('expired');
  });

  it('duplo clique / duas abas: um único PIX por pedido, o perdedor vê o do vencedor', async () => {
    const t = setup();
    t.state.holdCreates = true;
    const left = t.service.checkout('u1');
    const right = t.service.checkout('u1');
    // Let both requests reach the provider, then release them in order.
    await new Promise((resolve) => setTimeout(resolve, 0));
    t.state.releaseCreates();
    await new Promise((resolve) => setTimeout(resolve, 0));
    t.state.releaseCreates();
    const [a, b] = await Promise.all([left, right]);
    expect(a.orderId).toBe(b.orderId);
    expect(a.brCode).toBe(b.brCode);
    const order = await t.repository.order(a.orderId);
    expect(a.brCode).toBe(`000201-${String(order?.providerChargeId)}`);
    expect(t.logs).toMatchObject([{ event: 'billing.charge_race_lost' }]);
  });

  it('pagar o PIX perdedor também casa e grava o id pago no pedido', async () => {
    const t = setup();
    await t.service.checkout('u1');
    // A charge we created for this order but never attached (lost race):
    // matched through our correlationID when the provider echoes it.
    const result = await t.webhook({
      id: 'log_loser',
      event: 'transparent.completed',
      data: {
        transparent: {
          id: 'pix_char_77',
          status: 'PAID',
          externalId: 'footebas_license_id1',
        },
      },
    });
    expect(result.outcome).toBe('paid');
    expect((await t.repository.order('order_id1'))?.providerChargeId).toBe(
      'pix_char_77',
    );
  });
});

describe('AbacatePay · pagou duas vezes', () => {
  it('avisa no log e o reembolso mira o pedido da licença, sem revogar enquanto houver outro pago', async () => {
    const t = setup();
    const first = await t.service.checkout('u1');
    t.later(2 * HOUR);
    // Old QR still unpaid at the provider: a new order is opened.
    const second = await t.service.checkout('u1');
    expect(second.orderId).not.toBe(first.orderId);
    await t.completed('pix_char_2');
    // The coach also pays the old QR code before it dies.
    const late = await t.completed('pix_char_1');
    expect(late).toMatchObject({ outcome: 'paid', doublePayment: true });
    expect(t.logs).toMatchObject([
      {
        level: 'warn',
        event: 'billing.double_payment',
        orderId: first.orderId,
      },
    ]);
    expect((await t.repository.license('u1'))?.orderId).toBe(second.orderId);

    const refund = await t.service.refund('u1');
    expect(refund).toMatchObject({
      orderId: second.orderId,
      status: 'confirmed',
    });
    // Still licensed through the other paid order.
    expect(await t.repository.license('u1')).toMatchObject({
      status: 'active',
      orderId: first.orderId,
    });
    const last = await t.service.refund('u1');
    expect(last.orderId).toBe(first.orderId);
    expect(await t.plan()).toBe('free');
  });
});
