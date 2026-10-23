import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InboxDecisions } from '@/components/inbox-decisions';
import {
  createFakeInboxPort,
  demoInboxView,
  type InboxPort,
} from '@/lib/inbox-product';

describe('Caixa de entrada com decisões', () => {
  it('envia ResolveInboxDecision com a opção escolhida e mostra o efeito', async () => {
    const fake = createFakeInboxPort();
    const resolve = vi.fn(fake.resolve);
    const port: InboxPort = { ...fake, resolve };
    const onResolved = vi.fn();
    render(
      <InboxDecisions port={port} navigate={vi.fn()} onResolved={onResolved} />,
    );
    const inbox = await screen.findByRole('region', {
      name: /caixa de entrada/i,
    });
    expect(inbox.textContent).toMatch(/2 decisões/i);
    expect(within(inbox).getByText('Diretoria')).toBeTruthy();
    expect(within(inbox).getByText('Atletas')).toBeTruthy();

    const options = within(inbox).getByRole('group', {
      name: /opções: a diretoria quer saber do reforço/i,
    });
    fireEvent.click(
      within(options).getByRole('button', { name: /buscar reforço agora/i }),
    );
    expect(await within(inbox).findByText(/decidido: buscar reforço agora/i));
    expect(resolve).toHaveBeenCalledWith(
      'msg_board_reinforcement',
      'opt_buy_now',
    );
    expect(onResolved).toHaveBeenCalledTimes(1);
    expect(inbox.textContent).toMatch(/diretoria \+3/i);
    expect(inbox.textContent).toMatch(/1 decisão/i);
  });

  it('desabilita mensagens expiradas com o motivo', async () => {
    render(<InboxDecisions port={createFakeInboxPort()} navigate={vi.fn()} />);
    const inbox = await screen.findByRole('region', {
      name: /caixa de entrada/i,
    });
    const expired = within(inbox)
      .getByText(/coletiva: pressão por título/i)
      .closest('li')!;
    expect(within(expired).queryAllByRole('button')).toHaveLength(0);
    expect(expired.textContent).toMatch(/prazo encerrado em 05\/02/i);
  });

  it('usa os comandos de proposta existentes e leva a contraproposta ao mercado', async () => {
    const base = demoInboxView();
    const view = {
      ...base,
      messages: [
        {
          id: 'msg_offer',
          kind: 'transfer_offer' as const,
          subject: 'Palmeiras quer Gerson',
          body: 'Oferta de R$ 20 mi.',
          occurredOn: '2026-02-09',
          decision: {
            id: 'dec_1',
            offerId: 'offer_1',
            options: ['accept', 'reject', 'counter'] as const,
            expiresOn: '2026-02-20',
          },
        },
      ],
    };
    const fake = createFakeInboxPort(view);
    const decideOffer = vi.fn(fake.decideOffer);
    const navigate = vi.fn();
    render(
      <InboxDecisions port={{ ...fake, decideOffer }} navigate={navigate} />,
    );
    const group = await screen.findByRole('group', {
      name: /opções: palmeiras quer gerson/i,
    });
    fireEvent.click(
      within(group).getByRole('button', { name: 'Contraproposta' }),
    );
    expect(navigate).toHaveBeenCalledWith('market');
    fireEvent.click(within(group).getByRole('button', { name: 'Recusar' }));
    expect(await screen.findByText(/proposta recusada/i)).toBeTruthy();
    expect(decideOffer).toHaveBeenCalledWith(
      'transfer_offer',
      'offer_1',
      'reject',
    );
  });

  it('mostra o erro do servidor sem perder a mensagem', async () => {
    const fake = createFakeInboxPort();
    const port: InboxPort = {
      ...fake,
      resolve: () =>
        Promise.reject(new Error('O prazo dessa decisão já passou.')),
    };
    render(<InboxDecisions port={port} navigate={vi.fn()} />);
    const options = await screen.findByRole('group', {
      name: /opções: gerson pede mais minutos/i,
    });
    fireEvent.click(
      within(options).getByRole('button', { name: /manter a hierarquia/i }),
    );
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /prazo dessa decisão já passou/i,
    );
    expect(
      within(options).getByRole('button', { name: /manter a hierarquia/i }),
    ).toBeTruthy();
  });
});
