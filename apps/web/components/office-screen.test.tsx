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
import { OfficeScreen, type OfficeTab } from '@/components/office-screen';
import { InMemoryCareerApi, type CareerView } from '@/lib/career-api';

async function setup(initialTab?: OfficeTab) {
  const api = new InMemoryCareerApi();
  await api.login('a@b.com');
  await api.createCareer({ coach: 'Ana' });
  await api.selectClub('Flamengo');
  const career = (await api.getCareer())!;
  const onCareerChange = vi.fn<(value: CareerView) => void>();
  const reportError = vi.fn<(message: string) => void>();
  render(
    <OfficeScreen
      career={career}
      api={api}
      onCareerChange={onCareerChange}
      reportError={reportError}
      {...(initialTab ? { initialTab } : {})}
    />,
  );
  await screen.findByRole('tab', { name: /patrocínio/i });
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

describe('Escritório · patrocínio, sócio-torcedor e finanças', () => {
  it('lista três propostas, aceita uma e encerra as outras', async () => {
    const { api } = await setup();
    expect(
      screen.getAllByRole('article', { name: /proposta de/i }),
    ).toHaveLength(3);
    const card = screen.getByRole('article', {
      name: /proposta de loja vestiário/i,
    });
    // Each card names its sponsor on the three decision buttons, so a
    // screen reader never hears three identical "Aceitar".
    expect(
      within(card).getByRole('button', {
        name: 'Aceitar proposta de Loja Vestiário',
      }),
    ).toBeTruthy();
    expect(
      within(card).getByRole('button', {
        name: 'Recusar proposta de Loja Vestiário',
      }),
    ).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: /aceitar/i }));
    await screen.findByText(/contrato assinado com loja vestiário/i);
    const office = await api.getOffice();
    expect(office.sponsorship.contract?.sponsorName).toBe('Loja Vestiário');
    expect(
      office.proposals.sponsorship.filter(
        (offer) => offer.status === 'superseded',
      ),
    ).toHaveLength(2);
    await selectTab(/^patrocínio$/i);
    expect(await screen.findByText(/contrato vigente/i)).toBeTruthy();
    expect(screen.getByText('Loja Vestiário')).toBeTruthy();
  });

  it('contrapropõe uma vez: até 10% acima o patrocinador assina pelo novo valor', async () => {
    const { api } = await setup();
    const card = screen.getByRole('article', {
      name: /proposta de banco torcida/i,
    });
    fireEvent.click(
      within(card).getByRole('button', { name: /contrapropor/i }),
    );
    const offer = (await api.getOffice()).proposals.sponsorship.find(
      (item) => item.sponsorName === 'Banco Torcida',
    )!;
    fireEvent.change(within(card).getByLabelText(/mensalidade pedida/i), {
      target: { value: String(Math.round(offer.monthlyValue * 1.08)) },
    });
    fireEvent.click(within(card).getByRole('button', { name: /^enviar$/i }));
    await screen.findByText(/contraproposta enviada/i);
    const office = await api.getOffice();
    expect(office.sponsorship.contract?.monthlyValue).toBe(
      Math.round(offer.monthlyValue * 1.08),
    );
    await expect(
      api.counterSponsorship(offer.id, offer.monthlyValue + 1),
    ).rejects.toThrow(/já foi encerrada/i);
  });

  it('configura o sócio-torcedor: preço maior nunca aumenta sócios', async () => {
    const { api } = await setup('membership');
    const before = (await api.getOffice()).membership!;
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '120' } });
    fireEvent.click(screen.getByRole('radio', { name: /premium/i }));
    fireEvent.click(
      screen.getByRole('button', { name: /salvar sócio-torcedor/i }),
    );
    await screen.findByText(/sócio-torcedor atualizado/i);
    const after = (await api.getOffice()).membership!;
    expect(after.monthlyPrice).toBe(120);
    expect(after.tier).toBe('premium');
    expect(after.members).toBeLessThan(before.members);
    expect(after.monthlyRevenue).toBe(after.members * 120);
  });

  it('mostra finanças por categoria no mês e na temporada e os contratos', async () => {
    await setup('finance');
    const month = screen.getByRole('region', { name: /último mês fechado/i });
    expect(within(month).getByText('Bilheteria')).toBeTruthy();
    expect(within(month).getByText('Salários')).toBeTruthy();
    expect(
      screen.getByRole('region', { name: /temporada 2026/i }),
    ).toBeTruthy();
    await selectTab(/contratos/i);
    expect(
      (await screen.findAllByText('Bruno Henrique')).length,
    ).toBeGreaterThan(0);
    await selectTab(/treinador/i);
    await waitFor(() =>
      expect(screen.getByText(/confiança da diretoria/i)).toBeTruthy(),
    );
  });
});
