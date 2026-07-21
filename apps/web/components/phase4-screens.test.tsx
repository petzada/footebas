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
import { InMemoryCareerApi } from '@/lib/career-api';

async function onboard(api = new InMemoryCareerApi()) {
  render(<CareerGame api={api} />);
  fireEvent.click(screen.getByRole('button', { name: /entrar no vestiário/i }));
  await screen.findByLabelText(/nome do treinador/i);
  fireEvent.click(screen.getByRole('button', { name: /conhecer os clubes/i }));
  await screen.findByText(/escolha seu desafio/i);
  fireEvent.click(screen.getByRole('button', { name: /flamengo/i }));
  await screen.findByRole('button', { name: /narrar partida/i });
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
  it('busca, observa e compara atletas reais sem revelar dimensões ocultas', async () => {
    await onboard();
    navigate(/^mercado$/i);
    expect(
      await screen.findByRole('heading', { name: /^mercado$/i }),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/^nome$/i), {
      target: { value: 'Scarpa' },
    });
    expect(screen.getByText('Gustavo Scarpa')).toBeTruthy();
    expect(screen.queryByText('Lucas Esquivel')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /comparar/i }));
    expect(screen.getByText(/comparação \(1\/2\)/i)).toBeTruthy();
    expect(
      screen.getAllByText(/dimensões ocultas permanecem estimativas/i),
    ).toHaveLength(1);
  });

  it('negocia contraproposta, conclui a compra e cria lançamento com fonte', async () => {
    const api = await onboard();
    navigate(/^mercado$/i);
    await screen.findByRole('tab', { name: /^oferta$/i });
    await selectTab(/^oferta$/i);
    expect(
      ((await screen.findByLabelText(/^atleta$/i)) as HTMLSelectElement).value,
    ).toBe('m-scarpa');
    fireEvent.change(await screen.findByLabelText(/valor total/i), {
      target: { value: '8000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enviar oferta/i }));
    fireEvent.click(
      await screen.findByRole('button', { name: /aceitar contraproposta/i }),
    );
    expect(
      await screen.findByText(/negócio concluído e auditado/i),
    ).toBeTruthy();
    const career = await api.getCareer();
    expect(
      career?.world.market.find((player) => player.id === 'm-scarpa')
        ?.offerStatus,
    ).toBe('accepted');
    expect(career?.world.finances.ledger[0]?.sourceLabel).toMatch(
      /transferência · gustavo scarpa · atlético mineiro/i,
    );
  });

  it('mostra alertas e renova um contrato pelo port autoritativo', async () => {
    const api = await onboard();
    navigate(/^mercado$/i);
    await selectTab(/^contratos$/i);
    expect(screen.getByText(/pode assinar pré-contrato/i)).toBeTruthy();
    const contract = screen.getByText('Bruno Henrique').closest('.rounded-xl');
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
    navigate(/^clube$/i);
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
    navigate(/^clube$/i);
    await screen.findByRole('tab', { name: /^base$/i });
    await selectTab(/^base$/i);
    expect(
      (await screen.findByText(/todos os atletas abaixo são/i)).textContent,
    ).toMatch(/gerados pelo universo/i);
    expect(screen.getAllByText(/base · gerado/i)).toHaveLength(3);
    const card = screen.getByText('Davi Lessa').closest('.rounded-xl');
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
    navigate(/^clube$/i);
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
    navigate(/^mundo$/i);
    expect(await screen.findByRole('tablist')).toBeTruthy();
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
