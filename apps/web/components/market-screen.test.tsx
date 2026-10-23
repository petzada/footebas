import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MarketScreen } from '@/components/market-screen';
import { InMemoryCareerApi, type CareerView } from '@/lib/career-api';

async function setup(startDate?: string) {
  const api = new InMemoryCareerApi(startDate ? { startDate } : {});
  await api.login('a@b.com');
  await api.createCareer({ coach: 'Ana' });
  await api.selectClub('Flamengo');
  const career = (await api.getCareer())!;
  const onCareerChange = vi.fn<(value: CareerView) => void>();
  const reportError = vi.fn<(message: string) => void>();
  render(
    <MarketScreen
      career={career}
      api={api}
      onCareerChange={onCareerChange}
      reportError={reportError}
    />,
  );
  await screen.findByText(/atleta\(s\) encontrados/i);
  return { api, onCareerChange, reportError };
}

async function selectTab(name: RegExp) {
  const tab = screen.getByRole('tab', { name });
  await act(async () => {
    tab.focus();
    fireEvent.keyDown(tab, { key: 'Enter' });
    await Promise.resolve();
  });
}

describe('Mercado · janela, propostas e anúncios', () => {
  it('mostra caixa, janela aberta com contagem e filtra por origem', async () => {
    await setup('2026-01-20');
    expect(screen.getByText(/janela aberta/i)).toBeTruthy();
    expect(screen.getByText('28d')).toBeTruthy();
    expect(screen.getByText(/R\$ 38,6 mi/)).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /estrangeiros/i }));
    fireEvent.click(screen.getByRole('button', { name: /^buscar$/i }));
    await waitFor(() =>
      expect(screen.queryByText('Gustavo Scarpa')).toBeNull(),
    );
    expect(screen.getByText('Miguel Borja')).toBeTruthy();
  });

  it('negocia: proposta baixa vira contraproposta do vendedor, aceitar fecha a compra', async () => {
    const { api, onCareerChange } = await setup('2026-01-20');
    fireEvent.click(screen.getByRole('button', { name: /gustavo scarpa/i }));
    const form = screen.getByRole('form', {
      name: /proposta por gustavo scarpa/i,
    });
    fireEvent.change(within(form).getByLabelText(/valor da proposta/i), {
      target: { value: '11000000' },
    });
    fireEvent.click(
      within(form).getByRole('button', { name: /enviar proposta/i }),
    );
    await screen.findByText(/proposta enviada/i);
    await selectTab(/propostas/i);
    const sent = screen.getByRole('region', { name: /enviadas/i });
    expect(within(sent).getByText(/contraproposta feita/i)).toBeTruthy();
    fireEvent.click(
      within(sent).getByRole('button', {
        name: /aceitar proposta por gustavo scarpa/i,
      }),
    );
    await waitFor(() => expect(onCareerChange).toHaveBeenCalled());
    const career = await api.getCareer();
    expect(career?.players.some((p) => p.name === 'Gustavo Scarpa')).toBe(true);
    const market = await api.getMarket();
    expect(market.club?.cash).toBe(38_600_000 - 13_500_000);
  });

  it('contrapropõe uma proposta recebida e o comprador aceita até 20% acima', async () => {
    const { api } = await setup('2026-01-20');
    await selectTab(/propostas/i);
    const received = screen.getByRole('region', { name: /recebidas/i });
    fireEvent.click(
      within(received).getByRole('button', {
        name: /contrapropor por gonzalo plata/i,
      }),
    );
    fireEvent.change(within(received).getByLabelText(/novo valor/i), {
      target: { value: '16000000' },
    });
    fireEvent.click(
      within(received).getByRole('button', { name: /enviar contraproposta/i }),
    );
    await screen.findByText(/contraproposta enviada/i);
    const career = await api.getCareer();
    expect(career?.players.some((p) => p.id === 'fla-19')).toBe(false);
    expect((await api.getMarket()).club?.cash).toBe(38_600_000 + 16_000_000);
  });

  it('com a janela fechada bloqueia negócio entre clubes, explica em português e deixa agente livre', async () => {
    const { api, reportError } = await setup('2026-03-10');
    expect(screen.getByText(/janela fechada/i)).toBeTruthy();
    expect(
      screen.getAllByText(/abre em 17\/04\/2026 \(38 dias\)/i).length,
    ).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /gustavo scarpa/i }));
    const form = screen.getByRole('form', {
      name: /proposta por gustavo scarpa/i,
    });
    expect(
      (
        within(form).getByRole('button', {
          name: /enviar proposta/i,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      within(form).getByText(/janela de transferências está fechada/i),
    ).toBeTruthy();
    await expect(
      api.submitMarketOffer({
        playerId: 'cat_gustavo_scarpa',
        kind: 'buy',
        fee: 20_000_000,
        wage: 1,
      }),
    ).rejects.toMatchObject({ code: 'TRANSFER_WINDOW_CLOSED' });
    await expect(api.decideMarketOffer('offer_in_1', 'accept')).rejects.toThrow(
      /janela de transferências está fechada/i,
    );
    fireEvent.click(screen.getByRole('button', { name: /^gilberto/i }));
    const free = screen.getByRole('form', { name: /proposta por gilberto/i });
    expect(
      (
        within(free).getByRole('button', {
          name: /enviar proposta/i,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    fireEvent.click(
      within(free).getByRole('button', { name: /enviar proposta/i }),
    );
    await screen.findByText(/proposta enviada/i);
    expect(reportError).not.toHaveBeenCalledWith(
      expect.stringMatching(/fechada/),
    );
    expect(
      (await api.getCareer())?.players.some((p) => p.name === 'Gilberto'),
    ).toBe(true);
  });

  it('anuncia um atleta do elenco para venda e retira o anúncio', async () => {
    await setup('2026-01-20');
    await selectTab(/meu elenco/i);
    fireEvent.change(screen.getByLabelText(/^atleta$/i), {
      target: { value: 'fla-21' },
    });
    fireEvent.change(screen.getByLabelText(/preço pedido/i), {
      target: { value: '2500000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /colocar à venda/i }));
    expect(await screen.findByText(/à venda por R\$ 2,5 mi/i)).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: /retirar anúncio de jorginho/i }),
    );
    await waitFor(() => expect(screen.queryByText(/à venda por/i)).toBeNull());
  });
});
