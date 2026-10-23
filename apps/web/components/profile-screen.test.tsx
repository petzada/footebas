import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProfileScreen, countdown } from '@/components/profile-screen';
import {
  createFakeAccountPort,
  LICENSED_ENTITLEMENTS,
  PaymentProviderUnavailableError,
  type AccountPort,
} from '@/lib/account-product';

const player = { name: 'Ana' };
const careers = async () => ({
  careers: [{ id: 'c1', coach: 'Ana' }],
  limit: 1,
});

afterEach(() => vi.useRealTimers());

describe('Perfil e licença', () => {
  it('mostra conta, plano, carreiras usadas e sair', async () => {
    const onSignOut = vi.fn();
    render(
      <ProfileScreen
        account={createFakeAccountPort({
          profile: { email: 'ana@footebas.com', displayName: 'Ana' },
        })}
        player={player}
        loadCareers={careers}
        onSignOut={onSignOut}
      />,
    );
    const card = await screen.findByRole('region', { name: 'Ana' });
    expect(card.textContent).toMatch(/ana@footebas\.com/);
    expect(within(card).getByText('Grátis')).toBeTruthy();
    expect(await within(card).findByText('1/1')).toBeTruthy();
    expect(
      within(card).getByRole('link', { name: /termos de uso/i }),
    ).toBeTruthy();
    fireEvent.click(
      within(card).getByRole('button', { name: /sair da conta/i }),
    );
    expect(onSignOut).toHaveBeenCalled();
    const pitch = screen.getByRole('region', { name: /seja licenciado/i });
    expect(pitch.textContent).toMatch(/5 carreiras/i);
    expect(pitch.textContent).toMatch(/qualquer clube/i);
    expect(pitch.textContent).toMatch(/nunca esportiva/i);
  });

  it('guarda os detalhes técnicos do save num bloco recolhido (D6)', async () => {
    render(
      <ProfileScreen
        account={createFakeAccountPort({
          profile: { email: 'ana@footebas.com', displayName: 'Ana' },
        })}
        player={player}
        saveArchive={{
          saveVersion: '4.0.0',
          migrationStatus: 'Atualizado · schema 4',
          archiveStatus: 'Temporadas 2023–2024 compactadas',
          lastCompaction: '08/07/2026 · 02:15',
          checksum: 'save:9f2a…c814',
        }}
      />,
    );
    await screen.findByRole('region', { name: 'Ana' });
    const details = screen.getByTestId('perfil-save-detalhes');
    expect(details.tagName).toBe('DETAILS');
    expect(details.hasAttribute('open')).toBe(false);
    expect(details.textContent).toMatch(/detalhes técnicos do save/i);
    expect(details.textContent).toMatch(/4\.0\.0/);
    expect(details.textContent).toMatch(/schema 4/);
    expect(details.textContent).toMatch(/save:9f2a/);
    const summary = details.querySelector('summary')!;
    expect(summary.className).toMatch(/min-h-11/);
    fireEvent.click(summary);
    expect(details.hasAttribute('open')).toBe(true);
  });

  it('gera o PIX com preço do servidor, faz polling até pago e atualiza o plano', async () => {
    const account = createFakeAccountPort({
      priceCents: 5990,
      paidAfterPolls: 1,
    });
    render(<ProfileScreen account={account} player={player} pollMs={20} />);
    fireEvent.click(
      await screen.findByRole('button', { name: /pagar com pix/i }),
    );
    const checkout = await screen.findByRole('region', {
      name: /pagamento pix/i,
    });
    expect(await within(checkout).findByText('R$ 59,90')).toBeTruthy();
    const code = within(checkout).getByLabelText(/pix copia e cola/i);
    expect((code as HTMLTextAreaElement).value).toMatch(/br\.gov\.bcb\.pix/);
    expect(checkout.textContent).toMatch(/expira em 59:5\d/i);

    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    fireEvent.click(
      within(checkout).getByRole('button', { name: /copiar código pix/i }),
    );
    expect(writeText).toHaveBeenCalledWith((code as HTMLTextAreaElement).value);
    expect(await within(checkout).findByText(/código copiado/i)).toBeTruthy();

    expect(
      await screen.findByText(/pagamento confirmado/i, undefined, {
        timeout: 2000,
      }),
    ).toBeTruthy();
    const card = await screen.findByRole('region', { name: /treinador/i });
    expect(await within(card).findByText('Licenciado')).toBeTruthy();
    expect(card.textContent).toMatch(/ativa desde/i);
    expect(
      screen.getByRole('region', { name: /edição completa/i }),
    ).toBeTruthy();
  });

  it('explica quando o provedor PIX está indisponível e deixa tentar de novo', async () => {
    const account = createFakeAccountPort({ providerDown: true });
    render(<ProfileScreen account={account} player={player} pollMs={20} />);
    fireEvent.click(
      await screen.findByRole('button', { name: /pagar com pix/i }),
    );
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(
      /serviço de pagamento está indisponível/i,
    );
    expect(alert.textContent).toMatch(/nada foi cobrado/i);
    expect(within(alert).getByRole('button', { name: /tentar de novo/i }));
    expect(new PaymentProviderUnavailableError().message).toMatch(
      /indisponível/,
    );
  });

  it('pede reembolso dentro de 7 dias com confirmação e volta ao grátis', async () => {
    const now = () => new Date('2026-05-10T12:00:00.000Z');
    const account = createFakeAccountPort({
      now,
      profile: {
        plan: 'licensed',
        entitlements: LICENSED_ENTITLEMENTS,
        license: {
          status: 'active',
          orderId: 'order_1',
          grantedAt: '2026-05-08T10:00:00.000Z',
          revokedAt: null,
          refundableUntil: '2026-05-15T10:00:00.000Z',
        },
      },
    });
    const refund = vi.fn(account.refund);
    const port: AccountPort = { ...account, refund };
    render(<ProfileScreen account={port} player={player} now={now} />);
    const licensed = await screen.findByRole('region', {
      name: /edição completa/i,
    });
    fireEvent.click(
      within(licensed).getByRole('button', { name: /pedir reembolso/i }),
    );
    expect(refund).not.toHaveBeenCalled();
    fireEvent.click(
      within(licensed).getByRole('button', { name: /confirmar reembolso/i }),
    );
    expect(await screen.findByText(/reembolso solicitado/i));
    expect(refund).toHaveBeenCalledTimes(1);
    const card = await screen.findByRole('region', { name: /treinador/i });
    expect(await within(card).findByText('Grátis')).toBeTruthy();
    expect(card.textContent).toMatch(/reembolsada/i);
  });

  it('não oferece reembolso depois do prazo', async () => {
    const now = () => new Date('2026-06-01T12:00:00.000Z');
    const account = createFakeAccountPort({
      now,
      profile: {
        plan: 'licensed',
        entitlements: LICENSED_ENTITLEMENTS,
        license: {
          status: 'active',
          orderId: 'order_1',
          grantedAt: '2026-05-08T10:00:00.000Z',
          revokedAt: null,
          refundableUntil: '2026-05-15T10:00:00.000Z',
        },
      },
    });
    render(<ProfileScreen account={account} player={player} now={now} />);
    await screen.findByRole('region', { name: /edição completa/i });
    expect(
      screen.queryByRole('button', { name: /pedir reembolso/i }),
    ).toBeNull();
  });

  it('formata a contagem regressiva', () => {
    expect(
      countdown(
        '2026-05-10T12:05:30.000Z',
        new Date('2026-05-10T12:00:00.000Z'),
      ),
    ).toBe('05:30');
    expect(
      countdown(
        '2026-05-10T11:00:00.000Z',
        new Date('2026-05-10T12:00:00.000Z'),
      ),
    ).toBe('00:00');
  });
});
