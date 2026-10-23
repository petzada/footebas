import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CareerGame } from '@/components/career-game';
import { completeNewCareer } from '@/components/testing/complete-new-career';
import { InMemoryCareerApi } from '@/lib/career-api';

async function onboard(api = new InMemoryCareerApi()) {
  render(<CareerGame api={api} />);
  fireEvent.click(screen.getByRole('button', { name: /entrar no vestiário/i }));
  fireEvent.click(
    await screen.findByRole('button', { name: /nova carreira/i }),
  );
  // Same coach name the old two-step onboarding prefilled.
  await completeNewCareer({ coach: 'Márcio' });
  await screen.findByRole('button', { name: /jogar partida/i });
  return api;
}

function navigate(label: RegExp) {
  fireEvent.click(screen.getAllByRole('button', { name: label })[0]!);
}

async function selectTab(name: RegExp) {
  const tab = screen.getByRole('tab', { name });
  await act(async () => {
    tab.focus();
    fireEvent.keyDown(tab, { key: 'Enter' });
    await Promise.resolve();
  });
}

describe('Fase 4 · verticais de carreira longa', () => {
  it('mostra alertas e renova um contrato pelo port autoritativo', async () => {
    const api = await onboard();
    navigate(/^escritório$/i);
    await screen.findByRole('tab', { name: /^contratos$/i });
    await selectTab(/^contratos$/i);
    expect(await screen.findByText(/pode assinar pré-contrato/i)).toBeTruthy();
    const contract = screen
      .getAllByText('Bruno Henrique')
      .map((element) => element.closest('.panel'))
      .find(
        (panel) =>
          panel &&
          within(panel as HTMLElement).queryByRole('button', {
            name: /^renovar$/i,
          }),
      );
    expect(contract).not.toBeNull();
    fireEvent.click(
      within(contract as HTMLElement).getByRole('button', {
        name: /^renovar$/i,
      }),
    );
    expect(
      await within(contract as HTMLElement).findByText(/^renovado$/i),
    ).toBeTruthy();
    expect(
      (await api.getCareer())?.world.finances.ledger[0]?.sourceLabel,
    ).toMatch(/renovação · bruno henrique · 12 meses/i);
  });

  it('oferece feedback inválido acessível e preserva o ledger', async () => {
    await onboard();
    navigate(/^estádio$/i);
    await screen.findByRole('tab', { name: /finanças/i });
    await selectTab(/finanças/i);
    expect(await screen.findByText(/ledger imutável/i)).toBeTruthy();
    expect(screen.getByText('Bilheteria · Flamengo × Bahia')).toBeTruthy();
    expect(screen.getByText('Folha salarial · Rodada 7')).toBeTruthy();
    expect(screen.getByText('Patrocínio · Cota mensal')).toBeTruthy();
    expect(screen.getByText('Premiação · Copa do Brasil')).toBeTruthy();
    await selectTab(/estádio/i);
    fireEvent.change(await screen.findByLabelText(/preço do ingresso/i), {
      target: { value: '500' },
    });
    fireEvent.click(screen.getByRole('button', { name: /salvar preço/i }));
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /entre r\$ 10 e r\$ 250/i,
    );
  });

  it('marca jovens como gerados e permite desenvolver e promover', async () => {
    const api = await onboard();
    navigate(/^estádio$/i);
    await screen.findByRole('tab', { name: /^base$/i });
    await selectTab(/^base$/i);
    expect(
      (await screen.findByText(/todos os atletas abaixo são/i)).textContent,
    ).toMatch(/gerados pelo universo/i);
    expect(screen.getAllByText(/base · gerado/i)).toHaveLength(3);
    const card = screen.getByText('Davi Lessa').closest('.panel');
    expect(card).not.toBeNull();
    fireEvent.click(
      within(card as HTMLElement).getByRole('button', { name: /desenvolver/i }),
    );
    await waitFor(async () =>
      expect(
        (await api.getCareer())?.world.youth.find((item) => item.id === 'y-3')
          ?.readiness,
      ).toMatch(/plano individual/i),
    );
    fireEvent.click(
      within(card as HTMLElement).getByRole('button', { name: /promover/i }),
    );
    await waitFor(async () =>
      expect(
        (await api.getCareer())?.world.youth.find((item) => item.id === 'y-3')
          ?.status,
      ).toBe('promoted'),
    );
  });

  it('troca de clube preserva treinador, prestígio e histórico', async () => {
    const api = await onboard();
    const before = await api.getCareer();
    navigate(/^estádio$/i);
    await screen.findByRole('tab', { name: /diretoria/i });
    await selectTab(/diretoria/i);
    fireEvent.click(
      (
        await screen.findAllByRole('button', {
          name: /aceitar e trocar de clube/i,
        })
      )[0]!,
    );
    await waitFor(async () =>
      expect((await api.getCareer())?.club).toBe('Bahia'),
    );
    const after = await api.getCareer();
    expect(after?.coach).toBe(before?.coach);
    expect(after?.world.prestige).toEqual(before?.world.prestige);
    expect(after?.world.history.seasons[0]).toEqual(
      expect.objectContaining({ club: 'Flamengo' }),
    );
    expect(
      screen.getByText(/novo trabalho no bahia; carreira preservada/i),
    ).toBeTruthy();
  });

  it('expõe notícias, rankings segmentados e estado de migração por teclado', async () => {
    await onboard();
    navigate(/^ranking$/i);
    expect((await screen.findAllByRole('tablist')).length).toBeGreaterThan(0);
    await selectTab(/^ranking$/i);
    expect(screen.getByText(/referência nacional/i)).toBeTruthy();
    expect(screen.getByRole('tab', { name: /ascensão/i })).toBeTruthy();
    await selectTab(/^save$/i);
    expect(await screen.findByText(/atualizado · schema 4/i)).toBeTruthy();
    expect(screen.getByText(/temporadas 2023–2024 compactadas/i)).toBeTruthy();
    expect(
      screen.getByText(/cliente exibe este estado, mas não escreve/i),
    ).toBeTruthy();
  });
});
