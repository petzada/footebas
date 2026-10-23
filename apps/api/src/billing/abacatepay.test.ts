/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-base-to-string -- fetch fakes take string URLs and bodies */
import { describe, expect, it } from 'vitest';
import { AbacatePayClient, chargeStatusOf } from './abacatepay-client.js';
import {
  abacateSignature,
  interpretAbacateWebhook,
  verifyAbacateWebhook,
} from './abacatepay-webhook.js';

const ok = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ data, success: true, error: null }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('AbacatePay · cliente PIX transparente', () => {
  it('cria a cobrança com externalId, expiração e Bearer, e mapeia o QR', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const client = new AbacatePayClient({
      apiKey: 'abc_test_key',
      fetch: async (input, init) => {
        calls.push({ url: String(input), init: init ?? {} });
        return ok({
          id: 'pix_char_1',
          amount: 4990,
          status: 'PENDING',
          brCode: '000201...',
          brCodeBase64: 'data:image/png;base64,AAA',
          expiresAt: '2026-10-23T12:00:00.000Z',
        });
      },
    });
    const charge = await client.createCharge({
      correlationID: 'footebas_license_x',
      value: 4990,
      expiresIn: 3600,
      comment: 'Footebas - licença completa',
    });
    expect(calls[0]?.url).toBe(
      'https://api.abacatepay.com/v2/transparents/create',
    );
    expect(new Headers(calls[0]?.init.headers).get('authorization')).toBe(
      'Bearer abc_test_key',
    );
    expect(JSON.parse(String(calls[0]?.init.body))).toMatchObject({
      method: 'PIX',
      data: { amount: 4990, expiresIn: 3600, externalId: 'footebas_license_x' },
    });
    expect(charge).toMatchObject({
      correlationID: 'footebas_license_x',
      status: 'ACTIVE',
      globalID: 'pix_char_1',
      brCode: '000201...',
      qrCodeImage: 'data:image/png;base64,AAA',
    });
  });

  it('consulta e reembolsa pelo id da AbacatePay; "já reembolsada" conta como confirmado', async () => {
    let refunded = false;
    const client = new AbacatePayClient({
      apiKey: 'k',
      fetch: async (input) => {
        const url = String(input);
        if (url.includes('/transparents/check'))
          return ok({ id: 'pix_char_1', status: 'PAID', amount: 4990 });
        if (!refunded) {
          refunded = true;
          return ok({ id: 'tran_1', status: 'COMPLETE', amount: 4990 });
        }
        return new Response(
          JSON.stringify({
            data: null,
            success: false,
            error: 'Esta cobrança já foi reembolsada.',
          }),
          { status: 400 },
        );
      },
    });
    expect(await client.getCharge('corr', undefined)).toBeUndefined();
    expect((await client.getCharge('corr', 'pix_char_1'))?.status).toBe(
      'COMPLETED',
    );
    const input = { correlationID: 'corr_refund_1', value: 4990 };
    expect(
      await client.refundCharge('corr', input, 'pix_char_1'),
    ).toMatchObject({ status: 'CONFIRMED', endToEndId: 'pix_char_1' });
    expect(
      (await client.refundCharge('corr', input, 'pix_char_1')).status,
    ).toBe('CONFIRMED');
  });

  it('mapeia os estados da cobrança; reembolso e disputa nunca contam como pago', () => {
    expect(chargeStatusOf('PENDING')).toBe('ACTIVE');
    expect(chargeStatusOf('PAID')).toBe('COMPLETED');
    expect(chargeStatusOf('APPROVED')).toBe('COMPLETED');
    expect(chargeStatusOf('REDEEMED')).toBe('COMPLETED');
    expect(chargeStatusOf('REFUNDED')).toBe('REFUNDED');
    expect(chargeStatusOf('UNDER_DISPUTE')).toBe('DISPUTED');
    expect(chargeStatusOf('EXPIRED')).toBe('EXPIRED');
    expect(chargeStatusOf('CANCELLED')).toBe('EXPIRED');
    expect(chargeStatusOf('FAILED')).toBe('EXPIRED');
  });

  it('consulta sem amount deixa o valor indefinido (nunca 0)', async () => {
    const client = new AbacatePayClient({
      apiKey: 'k',
      fetch: async () =>
        ok({ id: 'pix_char_1', status: 'PAID', expiresAt: '2026-10-23' }),
    });
    const charge = await client.getCharge('corr', 'pix_char_1');
    expect(charge?.status).toBe('COMPLETED');
    expect(charge?.value).toBeUndefined();
  });
});

describe('AbacatePay · webhook', () => {
  const body = JSON.stringify({
    id: 'log_1',
    event: 'transparent.completed',
    apiVersion: 2,
    devMode: true,
    data: {
      transparent: {
        id: 'pix_char_1',
        externalId: 'footebas_license_x',
        amount: 4990,
        status: 'PAID',
        updatedAt: '2026-10-23T12:00:05.000Z',
      },
      customer: { name: 'Maria', taxId: '529.***.247-**' },
    },
  });

  it('exige o segredo da URL e confere a assinatura quando vier', async () => {
    const signature = await abacateSignature(body);
    expect(
      await verifyAbacateWebhook(
        body,
        {},
        { webhookSecret: 's3cr3t' },
        's3cr3t',
      ),
    ).toBe(true);
    expect(
      await verifyAbacateWebhook(
        body,
        { 'x-webhook-signature': signature },
        { webhookSecret: 's3cr3t' },
        's3cr3t',
      ),
    ).toBe(true);
    expect(
      await verifyAbacateWebhook(
        body,
        {},
        { webhookSecret: 'errado' },
        's3cr3t',
      ),
    ).toBe(false);
    expect(
      await verifyAbacateWebhook(
        body,
        { 'x-webhook-signature': 'adulterada' },
        { webhookSecret: 's3cr3t' },
        's3cr3t',
      ),
    ).toBe(false);
    expect(await verifyAbacateWebhook(body, {}, {}, '')).toBe(false);
  });

  it('pagamento vira efeito "paid" idempotente pelo id do evento e sem dados pessoais', async () => {
    const event = await interpretAbacateWebhook(
      JSON.parse(body),
      new Date('2026-10-23T12:00:06Z'),
    );
    expect(event.id).toBe('log_1');
    expect(event.effect).toMatchObject({
      kind: 'paid',
      providerChargeId: 'pix_char_1',
      correlationId: 'footebas_license_x',
      amountCents: 4990,
    });
    expect(JSON.stringify(event.payload)).not.toContain('529.');
  });

  it('reembolso confirma pelo id da cobrança original; outros eventos são ignorados', async () => {
    const refunded = await interpretAbacateWebhook(
      {
        id: 'log_2',
        event: 'transparent.refunded',
        data: { transparent: { id: 'pix_char_1' } },
      },
      new Date(),
    );
    expect(refunded.effect).toEqual({
      kind: 'refund_confirmed',
      providerChargeIds: ['pix_char_1'],
      endToEndIds: ['pix_char_1'],
    });
    expect(
      (
        await interpretAbacateWebhook(
          { id: 'log_3', event: 'payout.completed' },
          new Date(),
        )
      ).effect.kind,
    ).toBe('ignored');
  });

  it('aceita o id da cobrança em outros lugares, sem externalId/metadata nem amount', async () => {
    // Shape observed in production: nothing of ours is echoed back.
    for (const data of [
      { transparent: { id: 'pix_char_2', status: 'PAID', metadata: {} } },
      { pixQrCode: { id: 'pix_char_2', status: 'PAID' } },
      { id: 'pix_char_2', status: 'PAID' },
    ]) {
      const event = await interpretAbacateWebhook(
        { id: 'log_x', event: 'transparent.completed', data },
        new Date('2026-10-23T12:00:06Z'),
      );
      expect(event.effect).toEqual({
        kind: 'paid',
        providerChargeId: 'pix_char_2',
        paidAt: '2026-10-23T12:00:06.000Z',
        charge: expect.any(Object) as unknown,
      });
    }
  });

  it('status que não é pago e disputa: completed ignorado, disputed revoga', async () => {
    const late = await interpretAbacateWebhook(
      {
        id: 'log_4',
        event: 'transparent.completed',
        data: { transparent: { id: 'pix_char_3', status: 'REFUNDED' } },
      },
      new Date(),
    );
    expect(late.effect.kind).toBe('ignored');
    const disputed = await interpretAbacateWebhook(
      {
        id: 'log_5',
        event: 'transparent.disputed',
        data: { transparent: { id: 'pix_char_3' } },
      },
      new Date(),
    );
    expect(disputed.effect).toMatchObject({
      kind: 'disputed',
      providerChargeIds: ['pix_char_3'],
    });
  });

  it('sem id no evento a chave é estável (nunca o relógio)', async () => {
    const event = {
      event: 'transparent.completed',
      data: { transparent: { id: 'pix_char_4', status: 'PAID' } },
    };
    const first = await interpretAbacateWebhook(event, new Date(1));
    const retry = await interpretAbacateWebhook(event, new Date(2));
    expect(first.id).toBe('transparent.completed:pix_char_4');
    expect(retry.id).toBe(first.id);
    const anonymous = { event: 'something.else', data: {} };
    expect((await interpretAbacateWebhook(anonymous, new Date(1))).id).toBe(
      (await interpretAbacateWebhook(anonymous, new Date(2))).id,
    );
  });
});

describe('AbacatePay · licença de ponta a ponta no serviço', () => {
  it('checkout → webhook pago libera a licença → reembolso revoga', async () => {
    const { BillingService } = await import('./service.js');
    const { InMemoryBillingRepository } =
      await import('./billing-repository-memory.js');
    const repository = new InMemoryBillingRepository();
    let paid = false;
    const client = new AbacatePayClient({
      apiKey: 'k',
      fetch: async (input, init) => {
        const url = String(input);
        if (url.endsWith('/transparents/create')) {
          const sent = JSON.parse(String(init?.body)) as {
            data: { amount: number };
          };
          return ok({
            id: 'pix_char_9',
            amount: sent.data.amount,
            status: 'PENDING',
            brCode: '000201br',
            brCodeBase64: 'data:image/png;base64,QR',
            expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          });
        }
        if (url.includes('/transparents/check'))
          return ok({ id: 'pix_char_9', status: paid ? 'PAID' : 'PENDING' });
        return ok({ id: 'tran_9', status: 'COMPLETE', amount: 4990 });
      },
    });
    const service = new BillingService({
      repository,
      woovi: client,
      entitlements: repository.entitlements,
      // Woovi RSA keys are unused on the AbacatePay path.
      webhookKeys: { keys: () => Promise.resolve([]) },
      webhookProvider: 'abacatepay',
      webhookSecret: 'segredo-webhook',
    });
    const checkout = await service.checkout('user_1');
    expect(checkout).toMatchObject({
      status: 'pending',
      brCode: '000201br',
      amountCents: 4990,
    });
    const order = await repository.order(checkout.orderId);
    expect(order?.providerChargeId).toBe('pix_char_9');

    const event = JSON.stringify({
      id: 'log_pay',
      event: 'transparent.completed',
      data: {
        transparent: {
          id: 'pix_char_9',
          externalId: order?.correlationId,
          amount: 4990,
          status: 'PAID',
          updatedAt: new Date().toISOString(),
        },
      },
    });
    await expect(
      service.webhook(event, {}, { webhookSecret: 'outro' }),
    ).rejects.toThrow();
    paid = true;
    await service.webhook(event, {}, { webhookSecret: 'segredo-webhook' });
    // Redelivery with the same id is a no-op.
    await service.webhook(event, {}, { webhookSecret: 'segredo-webhook' });
    expect((await repository.entitlements.forUser('user_1')).plan).toBe(
      'licensed',
    );

    const refund = await service.refund('user_1');
    expect(refund.status).toBe('confirmed');
    expect((await repository.entitlements.forUser('user_1')).plan).toBe('free');
  });
});
