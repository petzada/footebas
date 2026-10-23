import { describe, expect, it } from 'vitest';
import {
  WOOVI_SANDBOX_URL,
  WooviApiError,
  WooviHttpClient,
} from './woovi-client.js';

interface Call {
  url: string;
  init: RequestInit;
}

function client(responses: { status: number; body: unknown }[]) {
  const calls: Call[] = [];
  const woovi = new WooviHttpClient({
    apiUrl: `${WOOVI_SANDBOX_URL}/`,
    appId: 'app-id-secret',
    fetch: (url, init) => {
      calls.push({ url, init });
      const next = responses.shift() ?? { status: 500, body: {} };
      return Promise.resolve(
        new Response(JSON.stringify(next.body), { status: next.status }),
      );
    },
  });
  return { woovi, calls };
}

const charge = {
  correlationID: 'footebas_license_abc',
  status: 'ACTIVE',
  value: 4990,
  brCode: '000201...',
  qrCodeImage:
    'https://api.woovi-sandbox.com/openpix/charge/brcode/image/x.png',
  paymentLinkUrl: 'https://woovi-sandbox.com/pay/x',
  expiresDate: '2026-10-22T13:00:00.000Z',
  globalID: 'Q2hhcmdl',
};

describe('WooviHttpClient', () => {
  it('cria cobrança idempotente com AppID cru no Authorization', async () => {
    const { woovi, calls } = client([
      { status: 200, body: { charge, brCode: 'top-level-brcode' } },
    ]);
    const result = await woovi.createCharge({
      correlationID: 'footebas_license_abc',
      value: 4990,
      expiresIn: 3600,
      comment: 'Footebas',
    });
    expect(calls[0]?.url).toBe(
      'https://api.woovi-sandbox.com/api/v1/charge?return_existing=true',
    );
    expect(calls[0]?.init.method).toBe('POST');
    expect(
      (calls[0]?.init.headers as Record<string, string>).authorization,
    ).toBe('app-id-secret');
    expect(JSON.parse(calls[0]?.init.body as string)).toEqual({
      correlationID: 'footebas_license_abc',
      value: 4990,
      type: 'DYNAMIC',
      expiresIn: 3600,
      comment: 'Footebas',
    });
    expect(result).toMatchObject({
      correlationID: 'footebas_license_abc',
      status: 'ACTIVE',
      value: 4990,
      brCode: 'top-level-brcode',
      paymentLinkUrl: charge.paymentLinkUrl,
      expiresDate: charge.expiresDate,
    });
  });

  it('consulta cobrança por correlationID e devolve undefined em 404', async () => {
    const { woovi, calls } = client([
      { status: 200, body: { charge: { ...charge, status: 'COMPLETED' } } },
      { status: 404, body: { error: 'not found' } },
    ]);
    await expect(woovi.getCharge('a/b')).resolves.toMatchObject({
      status: 'COMPLETED',
    });
    expect(calls[0]?.url).toBe(
      'https://api.woovi-sandbox.com/api/v1/charge/a%2Fb',
    );
    await expect(woovi.getCharge('missing')).resolves.toBeUndefined();
  });

  it('solicita reembolso na rota da cobrança com correlationID próprio', async () => {
    const { woovi, calls } = client([
      {
        status: 200,
        body: {
          refund: {
            status: 'IN_PROCESSING',
            value: 4990,
            correlationID: 'r1',
            endToEndId: 'E123',
          },
        },
      },
    ]);
    const refund = await woovi.refundCharge('footebas_license_abc', {
      correlationID: 'r1',
      value: 4990,
    });
    expect(calls[0]?.url).toBe(
      'https://api.woovi-sandbox.com/api/v1/charge/footebas_license_abc/refund',
    );
    expect(refund).toMatchObject({
      status: 'IN_PROCESSING',
      endToEndId: 'E123',
    });
  });

  it('erros viram WooviApiError sem vazar o AppID', async () => {
    const { woovi } = client([
      { status: 401, body: { error: 'appID inválido' } },
    ]);
    const error = await woovi
      .createCharge({ correlationID: 'x', value: 1, expiresIn: 300 })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(WooviApiError);
    expect((error as WooviApiError).status).toBe(401);
    expect((error as Error).message).not.toContain('app-id-secret');
  });

  it('falha de rede vira WooviApiError', async () => {
    const woovi = new WooviHttpClient({
      apiUrl: WOOVI_SANDBOX_URL,
      appId: 'x',
      fetch: () => Promise.reject(new TypeError('network down')),
    });
    await expect(woovi.getCharge('a')).rejects.toBeInstanceOf(WooviApiError);
  });

  it('exige AppID', () => {
    expect(
      () => new WooviHttpClient({ apiUrl: WOOVI_SANDBOX_URL, appId: ' ' }),
    ).toThrow(RangeError);
  });
});
