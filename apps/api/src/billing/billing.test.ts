import {
  FakeBearerAuth,
  type FootebasApplication,
  type JobQueuePort,
} from '@footebas/application';
import { describe, expect, it } from 'vitest';
import { createFetchHandler } from '../fetch-router.js';
import { buildApi } from '../index.js';
import type { ApiDependencies } from '../routes.js';
import { InMemoryBillingRepository } from './billing-repository-memory.js';
import { BillingService } from './service.js';
import { createTestSigner } from './testing.js';
import { StaticPublicKeys } from './webhook-signature.js';
import { FakeWooviClient } from './woovi-fake.js';

const DAY = 24 * 60 * 60 * 1000;

async function setup(options: { webhookSecret?: string } = {}) {
  const clock = { now: new Date('2026-10-22T12:00:00.000Z') };
  const now = () => clock.now;
  const repository = new InMemoryBillingRepository();
  const woovi = new FakeWooviClient(now);
  const signer = await createTestSigner();
  const auth = new FakeBearerAuth();
  let sequence = 0;
  const service = new BillingService({
    repository,
    woovi,
    entitlements: repository.entitlements,
    webhookKeys: new StaticPublicKeys([signer.publicKeyPem]),
    ...(options.webhookSecret === undefined
      ? {}
      : { webhookSecret: options.webhookSecret }),
    now,
    newId: () => `id${String(++sequence)}`,
  });
  const deps: ApiDependencies = {
    application: {} as FootebasApplication,
    jobs: {} as JobQueuePort,
    billing: { service, auth },
    nextRequestId: () => 'request_test',
    documentation: false,
  };
  const handler = createFetchHandler(deps);
  const tokens = {
    alice: auth.issue({
      userId: 'alice',
      email: 'alice@example.com',
      displayName: 'Alice',
    }),
    bob: auth.issue({
      userId: 'bob',
      email: 'bob@example.com',
      displayName: 'Bob',
    }),
  };

  async function call(
    method: 'GET' | 'POST',
    path: string,
    init: {
      token?: string;
      raw?: string;
      headers?: Record<string, string>;
    } = {},
  ) {
    const response = await handler(
      new Request(`https://api.footebas.com.br${path}`, {
        method,
        headers: {
          ...(init.token === undefined
            ? {}
            : { authorization: `Bearer ${init.token}` }),
          ...(init.raw === undefined
            ? {}
            : { 'content-type': 'application/json' }),
          ...init.headers,
        },
        ...(init.raw === undefined ? {} : { body: init.raw }),
      }),
    );
    return {
      status: response.status,
      body: (await response.json()) as Record<string, unknown>,
    };
  }

  async function webhook(
    payload: unknown,
    headers: Record<string, string> = {},
  ) {
    const raw = JSON.stringify(payload);
    return call('POST', '/v1/billing/webhook', {
      raw,
      headers: { 'x-webhook-signature': await signer.sign(raw), ...headers },
    });
  }

  function completed(correlationID: string, value = 4990) {
    return {
      event: 'OPENPIX:CHARGE_COMPLETED',
      charge: {
        correlationID,
        value,
        status: 'COMPLETED',
        paidAt: clock.now.toISOString(),
        customer: { name: 'Fulano', taxID: { taxID: '12345678909' } },
      },
      pix: {
        endToEndId: `E2E-${correlationID}`,
        value,
        time: clock.now.toISOString(),
        payer: { name: 'Fulano', taxID: { taxID: '12345678909' } },
      },
      company: { id: 'c1' },
    };
  }

  async function pay(token: string) {
    const checkout = await call('POST', '/v1/billing/checkout', { token });
    const order = await repository.order(checkout.body.orderId as string);
    if (!order) throw new Error('order missing');
    woovi.setStatus(order.correlationId, 'COMPLETED');
    await webhook(completed(order.correlationId));
    return order;
  }

  return {
    clock,
    repository,
    woovi,
    signer,
    tokens,
    call,
    webhook,
    completed,
    pay,
    deps,
  };
}

describe('POST /v1/billing/checkout', () => {
  it('exige autenticação', async () => {
    const t = await setup();
    expect((await t.call('POST', '/v1/billing/checkout')).status).toBe(401);
  });

  it('cria cobrança PIX com BR Code, link e expiração', async () => {
    const t = await setup();
    const result = await t.call('POST', '/v1/billing/checkout', {
      token: t.tokens.alice,
    });
    expect(result.status).toBe(201);
    expect(result.body).toMatchObject({
      orderId: 'order_id1',
      status: 'pending',
      amountCents: 4990,
      currency: 'BRL',
      expiresAt: '2026-10-22T13:00:00.000Z',
    });
    expect(result.body.brCode).toEqual(expect.stringContaining('000201'));
    expect(result.body.paymentLinkUrl).toEqual(
      expect.stringContaining('/pay/'),
    );
    expect(t.woovi.calls).toEqual([
      { method: 'createCharge', correlationID: 'footebas_license_id1' },
    ]);
  });

  it('reaproveita o pedido pendente sem chamar a Woovi de novo', async () => {
    const t = await setup();
    const first = await t.call('POST', '/v1/billing/checkout', {
      token: t.tokens.alice,
    });
    const second = await t.call('POST', '/v1/billing/checkout', {
      token: t.tokens.alice,
    });
    expect(second.body).toEqual(first.body);
    expect(t.woovi.calls).toHaveLength(1);
  });

  it('pedido vencido é expirado e substituído', async () => {
    const t = await setup();
    const first = await t.call('POST', '/v1/billing/checkout', {
      token: t.tokens.alice,
    });
    t.clock.now = new Date(t.clock.now.getTime() + 2 * 60 * 60 * 1000);
    const second = await t.call('POST', '/v1/billing/checkout', {
      token: t.tokens.alice,
    });
    expect(second.body.orderId).not.toBe(first.body.orderId);
    expect(
      (await t.repository.order(first.body.orderId as string))?.status,
    ).toBe('expired');
  });

  it('recusa quem já tem licença (409)', async () => {
    const t = await setup();
    await t.pay(t.tokens.alice);
    const result = await t.call('POST', '/v1/billing/checkout', {
      token: t.tokens.alice,
    });
    expect(result.status).toBe(409);
  });

  it('Woovi fora do ar vira 502 sem detalhes internos', async () => {
    const t = await setup();
    t.woovi.failing = true;
    const result = await t.call('POST', '/v1/billing/checkout', {
      token: t.tokens.alice,
    });
    expect(result.status).toBe(502);
    expect(result.body).toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'payment provider unavailable',
    });
  });
});

describe('POST /v1/billing/webhook', () => {
  it('recusa assinatura ausente ou inválida (401) sem alterar nada', async () => {
    const t = await setup();
    const checkout = await t.call('POST', '/v1/billing/checkout', {
      token: t.tokens.alice,
    });
    const payload = t.completed(`footebas_license_id1`);
    const missing = await t.call('POST', '/v1/billing/webhook', {
      raw: JSON.stringify(payload),
    });
    expect(missing.status).toBe(401);
    const raw = JSON.stringify(payload);
    const tampered = await t.call('POST', '/v1/billing/webhook', {
      raw: raw.replace('4990', '1'),
      headers: { 'x-webhook-signature': await t.signer.sign(raw) },
    });
    expect(tampered.status).toBe(401);
    const order = await t.call(
      'GET',
      `/v1/billing/orders/${String(checkout.body.orderId)}`,
      { token: t.tokens.alice },
    );
    expect(order.body.status).toBe('pending');
    expect(t.repository.events()).toEqual([]);
  });

  it('charge completed marca pago e ativa a licença, de forma idempotente', async () => {
    const t = await setup();
    await t.call('POST', '/v1/billing/checkout', { token: t.tokens.alice });
    const payload = t.completed('footebas_license_id1');
    const first = await t.webhook(payload);
    expect(first).toEqual({
      status: 200,
      body: { ok: true, duplicate: false, outcome: 'paid' },
    });
    const again = await t.webhook(payload);
    expect(again.body).toEqual({ ok: true, duplicate: true, outcome: 'paid' });
    expect(await t.repository.license('alice')).toMatchObject({
      status: 'active',
      orderId: 'order_id1',
    });
    expect(await t.repository.order('order_id1')).toMatchObject({
      status: 'paid',
      paidAt: '2026-10-22T12:00:00.000Z',
      pixEndToEndId: 'E2E-footebas_license_id1',
    });
    // Personal data (CPF, names) never reaches the event log.
    expect(JSON.stringify(t.repository.events())).not.toContain('12345678909');
    expect(JSON.stringify(t.repository.events())).not.toContain('Fulano');
  });

  it('valor divergente não concede licença', async () => {
    const t = await setup();
    await t.call('POST', '/v1/billing/checkout', { token: t.tokens.alice });
    const result = await t.webhook(t.completed('footebas_license_id1', 1));
    expect(result.body.outcome).toBe('amount_mismatch');
    expect(await t.repository.license('alice')).toBeUndefined();
  });

  it('charge expired expira o pedido pendente', async () => {
    const t = await setup();
    await t.call('POST', '/v1/billing/checkout', { token: t.tokens.alice });
    const result = await t.webhook({
      event: 'OPENPIX:CHARGE_EXPIRED',
      charge: { correlationID: 'footebas_license_id1', value: 4990 },
    });
    expect(result.body.outcome).toBe('expired');
    expect((await t.repository.order('order_id1'))?.status).toBe('expired');
  });

  it('eventos desconhecidos são aceitos e ignorados', async () => {
    const t = await setup();
    const result = await t.webhook({ evento: 'teste_webhook' });
    expect(result.body).toMatchObject({ ok: true, outcome: 'ignored' });
  });

  it('com WOOVI_WEBHOOK_SECRET exige também o header authorization', async () => {
    const t = await setup({ webhookSecret: 's3cret-header-value' });
    const payload = { evento: 'teste_webhook' };
    expect((await t.webhook(payload)).status).toBe(401);
    expect(
      (await t.webhook(payload, { authorization: 's3cret-header-value' }))
        .status,
    ).toBe(200);
  });

  it('servidor Fastify também entrega o corpo cru para a assinatura', async () => {
    const t = await setup();
    const app = await buildApi(t.deps);
    try {
      const raw = JSON.stringify({ evento: 'teste_webhook' }, null, 2);
      const response = await app.inject({
        method: 'POST',
        url: '/v1/billing/webhook',
        headers: {
          'content-type': 'application/json',
          'x-webhook-signature': await t.signer.sign(raw),
        },
        payload: raw,
      });
      expect(response.statusCode).toBe(200);
      const bad = await app.inject({
        method: 'POST',
        url: '/v1/billing/webhook',
        headers: { 'content-type': 'application/json' },
        payload: '{not json',
      });
      expect(bad.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });
});

describe('GET /v1/billing/orders/:id', () => {
  it('só o dono vê o pedido', async () => {
    const t = await setup();
    const checkout = await t.call('POST', '/v1/billing/checkout', {
      token: t.tokens.alice,
    });
    const path = `/v1/billing/orders/${String(checkout.body.orderId)}`;
    expect((await t.call('GET', path, { token: t.tokens.bob })).status).toBe(
      404,
    );
    const own = await t.call('GET', path, { token: t.tokens.alice });
    expect(own.status).toBe(200);
    expect(own.body).toMatchObject({ orderId: 'order_id1', refund: null });
  });

  it('reconcilia com a Woovi quando o webhook ainda não chegou', async () => {
    const t = await setup();
    await t.call('POST', '/v1/billing/checkout', { token: t.tokens.alice });
    t.woovi.setStatus('footebas_license_id1', 'COMPLETED');
    const order = await t.call('GET', '/v1/billing/orders/order_id1', {
      token: t.tokens.alice,
    });
    expect(order.body.status).toBe('paid');
    expect((await t.repository.license('alice'))?.status).toBe('active');
    // The real webhook afterwards is harmless.
    const late = await t.webhook(t.completed('footebas_license_id1'));
    expect(late.body.outcome).toBe('paid');
    expect((await t.repository.order('order_id1'))?.pixEndToEndId).toBe(
      'E2E-footebas_license_id1',
    );
  });
});

describe('POST /v1/billing/refund', () => {
  it('dentro de 7 dias: pede à Woovi e revoga a licença na confirmação', async () => {
    const t = await setup();
    await t.pay(t.tokens.alice);
    t.clock.now = new Date(t.clock.now.getTime() + 6 * DAY);
    const refund = await t.call('POST', '/v1/billing/refund', {
      token: t.tokens.alice,
    });
    expect(refund.status).toBe(202);
    expect(refund.body).toMatchObject({
      orderId: 'order_id1',
      status: 'requested',
      amountCents: 4990,
    });
    expect((await t.repository.license('alice'))?.status).toBe('active');
    // Repeated request while pending does not call Woovi again.
    await t.call('POST', '/v1/billing/refund', { token: t.tokens.alice });
    expect(
      t.woovi.calls.filter((call) => call.method === 'refundCharge'),
    ).toHaveLength(1);

    const confirmed = await t.webhook({
      event: 'PIX_TRANSACTION_REFUND_SENT_CONFIRMED',
      refundTransaction: {
        endToEndId: 'Dfootebas_license_id1_refund_1',
        status: 'CONFIRMED',
        value: 4990,
      },
      originalTransaction: { endToEndId: 'E2E-footebas_license_id1' },
    });
    expect(confirmed.body.outcome).toBe('refunded');
    expect(await t.repository.license('alice')).toMatchObject({
      status: 'revoked',
    });
    expect((await t.repository.order('order_id1'))?.status).toBe('refunded');
    const me = await t.call('GET', '/v1/me', { token: t.tokens.alice });
    expect(me.body.plan).toBe('free');
    // After a refund the user may buy again.
    const again = await t.call('POST', '/v1/billing/checkout', {
      token: t.tokens.alice,
    });
    expect(again.status).toBe(201);
  });

  it('reembolso confirmado na hora já revoga', async () => {
    const t = await setup();
    await t.pay(t.tokens.alice);
    t.woovi.refundStatus = 'CONFIRMED';
    const refund = await t.call('POST', '/v1/billing/refund', {
      token: t.tokens.alice,
    });
    expect(refund.body.status).toBe('confirmed');
    expect((await t.repository.license('alice'))?.status).toBe('revoked');
  });

  it('reembolso rejeitado mantém a licença e permite nova tentativa', async () => {
    const t = await setup();
    await t.pay(t.tokens.alice);
    await t.call('POST', '/v1/billing/refund', { token: t.tokens.alice });
    const rejected = await t.webhook({
      event: 'PIX_TRANSACTION_REFUND_SENT_REJECTED',
      refundTransaction: { endToEndId: 'Dfootebas_license_id1_refund_1' },
      originalTransaction: { endToEndId: 'E2E-footebas_license_id1' },
    });
    expect(rejected.body.outcome).toBe('refund_rejected');
    expect((await t.repository.license('alice'))?.status).toBe('active');
    const retry = await t.call('POST', '/v1/billing/refund', {
      token: t.tokens.alice,
    });
    expect(retry.status).toBe(202);
    expect((await t.repository.order('order_id1'))?.refundCorrelationId).toBe(
      'footebas_license_id1_refund_2',
    );
  });

  it('depois de 7 dias é recusado (403)', async () => {
    const t = await setup();
    await t.pay(t.tokens.alice);
    t.clock.now = new Date(t.clock.now.getTime() + 7 * DAY + 1000);
    const refund = await t.call('POST', '/v1/billing/refund', {
      token: t.tokens.alice,
    });
    expect(refund.status).toBe(403);
    expect(
      t.woovi.calls.filter((call) => call.method === 'refundCharge'),
    ).toHaveLength(0);
  });

  it('sem compra paga é 404', async () => {
    const t = await setup();
    const refund = await t.call('POST', '/v1/billing/refund', {
      token: t.tokens.bob,
    });
    expect(refund.status).toBe(404);
  });
});

describe('GET /v1/me', () => {
  it('perfil free sem licença', async () => {
    const t = await setup();
    const me = await t.call('GET', '/v1/me', { token: t.tokens.bob });
    expect(me).toEqual({
      status: 200,
      body: {
        id: 'bob',
        email: 'bob@example.com',
        displayName: 'Bob',
        plan: 'free',
        entitlements: { plan: 'free', maxCareers: 1, anyClub: false },
        license: null,
      },
    });
  });

  it('perfil licenciado com prazo de reembolso', async () => {
    const t = await setup();
    await t.pay(t.tokens.alice);
    const me = await t.call('GET', '/v1/me', { token: t.tokens.alice });
    expect(me.body).toMatchObject({
      plan: 'licensed',
      entitlements: { plan: 'licensed', maxCareers: 5, anyClub: true },
      license: {
        status: 'active',
        orderId: 'order_id1',
        grantedAt: '2026-10-22T12:00:00.000Z',
        revokedAt: null,
        refundableUntil: '2026-10-29T12:00:00.000Z',
      },
    });
  });

  it('exige autenticação', async () => {
    const t = await setup();
    expect((await t.call('GET', '/v1/me')).status).toBe(401);
  });
});
