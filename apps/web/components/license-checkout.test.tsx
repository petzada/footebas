import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  CONFIRM_GRACE_MS,
  LicenseCheckout,
} from '@/components/license-checkout';
import {
  LicenseAlreadyActiveError,
  type AccountPort,
  type OrderView,
} from '@/lib/account-product';

const START = new Date('2026-10-23T12:00:00.000Z').getTime();

/** Programmable account: the order stays pending until `status` changes. */
function stubAccount(clock: { now: number }) {
  const state = { status: 'pending' as OrderView['status'], polls: 0 };
  const order = (): OrderView => ({
    orderId: 'order_1',
    status: state.status,
    amountCents: 2990,
    currency: 'BRL',
    brCode: '00020126BRCODE',
    qrCodeImage: 'data:image/png;base64,QR',
    paymentLinkUrl: null,
    expiresAt: new Date(START + 15 * 60 * 1000).toISOString(),
    createdAt: new Date(START).toISOString(),
    paidAt: state.status === 'paid' ? new Date(clock.now).toISOString() : null,
    refund: null,
  });
  const account: AccountPort = {
    me: () => Promise.reject(new Error('unused')),
    checkout: () => Promise.resolve(order()),
    order: () => {
      state.polls += 1;
      return Promise.resolve(order());
    },
    refund: () => Promise.reject(new Error('unused')),
    uploadAvatar: () => Promise.reject(new Error('unused')),
  };
  return { account, state };
}

describe('Checkout PIX', () => {
  it('mostra o cadeado de ambiente seguro e depois valor → QR → tempo → copia e cola', async () => {
    const clock = { now: START };
    const { account } = stubAccount(clock);
    render(
      <LicenseCheckout
        account={account}
        pollMs={10_000}
        now={() => new Date(clock.now)}
        onPaid={() => undefined}
        onCancel={() => undefined}
      />,
    );
    const status = screen.getByRole('status');
    expect(status.textContent).toMatch(/ambiente seguro/i);
    expect(status.textContent).toMatch(/abacatepay/i);
    const region = screen.getByRole('region', { name: /pagamento pix/i });
    expect(region.getAttribute('data-tone')).toBe('light');
    await within(region).findByText('R$ 29,90');
    const order = [
      ...region.querySelectorAll('p, img, label, textarea, button'),
    ].map((node) =>
      node.tagName === 'IMG'
        ? 'QR'
        : node.tagName === 'TEXTAREA'
          ? 'CODE'
          : (node.textContent ?? ''),
    );
    const index = (pattern: RegExp) =>
      order.findIndex((text) => pattern.test(text));
    expect(index(/R\$ 29,90/)).toBeLessThan(index(/^QR$/));
    expect(index(/^QR$/)).toBeLessThan(index(/expira em 15:00/i));
    expect(index(/expira em/i)).toBeLessThan(index(/pix copia e cola/i));
    expect(index(/pix copia e cola/i)).toBeLessThan(index(/^CODE$/));
    expect(index(/^CODE$/)).toBeLessThan(index(/copiar código pix/i));
    expect(index(/copiar código pix/i)).toBeLessThan(index(/pagar depois/i));
  });

  it('quando o tempo acaba, diz que está confirmando e segue consultando; pagamento tardio conta', async () => {
    const clock = { now: START };
    const { account, state } = stubAccount(clock);
    const onPaid = vi.fn();
    render(
      <LicenseCheckout
        account={account}
        pollMs={50}
        now={() => new Date(clock.now)}
        onPaid={onPaid}
        onCancel={() => undefined}
      />,
    );
    await screen.findByText('R$ 29,90');
    clock.now = START + 15 * 60 * 1000 + 1;
    expect(
      await screen.findByText(/confirmando seu pagamento/i, undefined, {
        timeout: 2500,
      }),
    ).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/nada foi cobrado/i);
    const polled = state.polls;
    state.status = 'paid';
    await waitFor(() => expect(onPaid).toHaveBeenCalledTimes(1));
    expect(state.polls).toBeGreaterThan(polled);
    expect(await screen.findByText(/pagamento confirmado/i)).toBeTruthy();
  });

  it('depois da espera extra, explica sem dizer "nada foi cobrado" e permite novo PIX', async () => {
    const clock = { now: START };
    const { account } = stubAccount(clock);
    render(
      <LicenseCheckout
        account={account}
        pollMs={50}
        now={() => new Date(clock.now)}
        onPaid={() => undefined}
        onCancel={() => undefined}
      />,
    );
    await screen.findByText('R$ 29,90');
    clock.now = START + 15 * 60 * 1000 + CONFIRM_GRACE_MS + 1;
    await screen.findByText(/confirmando seu pagamento/i, undefined, {
      timeout: 2500,
    });
    expect(
      await screen.findByText(
        /ativada sozinha assim que o banco confirmar/i,
        undefined,
        {
          timeout: 2500,
        },
      ),
    ).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/nada foi cobrado/i);
    expect(
      screen.getByRole('button', { name: /gerar novo pix/i }),
    ).toBeTruthy();
  });

  it('licença já ativa (409) vira sucesso com mensagem amigável', async () => {
    const onPaid = vi.fn();
    const account: AccountPort = {
      ...stubAccount({ now: START }).account,
      checkout: () => Promise.reject(new LicenseAlreadyActiveError()),
    };
    render(
      <LicenseCheckout
        account={account}
        pollMs={50}
        now={() => new Date(START)}
        onPaid={onPaid}
        onCancel={() => undefined}
      />,
    );
    expect(await screen.findByText(/sua licença já está ativa/i)).toBeTruthy();
    expect(onPaid).toHaveBeenCalledWith(null);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
