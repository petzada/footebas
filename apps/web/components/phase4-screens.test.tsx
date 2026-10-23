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
import { WorldScreen } from '@/components/phase4-screens';
import { InMemoryCareerApi, type CareerView } from '@/lib/career-api';
import { createFakeSeasonPort } from '@/lib/season-product';

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

describe('Mundo · todas as telas leem os dados gravados', () => {
  /** World as the HTTP adapter used to deliver it: no demo filler. */
  async function serverLikeCareer() {
    const api = new InMemoryCareerApi();
    await api.login('ana@footebas.com');
    await api.createCareer({ coach: 'Ana' });
    await api.selectClub('Flamengo');
    const view = (await api.getCareer())!;
    const career: CareerView = {
      ...view,
      world: {
        ...view.world,
        news: [
          {
            id: 'mail_board',
            tag: 'Diretoria',
            headline: 'A diretoria quer saber do reforço',
            detail: 'Buscar um meia agora ou poupar o caixa?',
            date: '2026-02-09',
            pending: true,
          },
          {
            id: 'mail_report',
            tag: 'Relatório',
            headline: 'Vitória sobre o Bahia',
            detail: '2 a 0 no Maracanã.',
            date: '2026-02-07',
          },
        ],
        history: { seasons: [], champions: [], records: [], idols: [] },
        leaderboards: { global: [], underdog: [], monthly: [] },
      },
    };
    return { api, career };
  }

  function renderWorld({
    api,
    career,
  }: Awaited<ReturnType<typeof serverLikeCareer>>) {
    render(
      <WorldScreen
        career={career}
        api={api}
        onCareerChange={() => undefined}
        reportError={() => undefined}
        ports={{ season: createFakeSeasonPort() }}
      />,
    );
  }

  it('Mundo só guarda prestígio e História: sem Notícias, Ranking nem Save (D6)', async () => {
    renderWorld(await serverLikeCareer());
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(screen.getByText('Prestígio')).toBeTruthy();
    expect(screen.getByText('Títulos')).toBeTruthy();
    expect(screen.queryByText(/ranking de treinadores/i)).toBeNull();
    expect(screen.queryByText(/carreiras salvas/i)).toBeNull();
    expect(screen.queryByText(/todas as mensagens/i)).toBeNull();
  });

  it('Histórico mostra a temporada, campeões e recordes do read model', async () => {
    renderWorld(await serverLikeCareer());
    expect(await screen.findByText('2026 · Flamengo')).toBeTruthy();
    expect(
      screen.getByText(
        /1º na série a · 7v 2e 1d · em andamento · pedro · 9 gols/i,
      ),
    ).toBeTruthy();
    expect(screen.getByText('2026 · Campeonato Carioca')).toBeTruthy();
    expect(screen.getByText(/artilheiro 2026 \(parcial\)/i)).toBeTruthy();
    expect(screen.getByText(/artilheiro do clube · 9 gols/i)).toBeTruthy();
  });
});

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

  it('oferece feedback inválido acessível; Finanças fica só no Escritório', async () => {
    const api = await onboard();
    navigate(/^estádio$/i);
    await screen.findByRole('tab', { name: /^estádio$/i });
    // D5: the legacy Finanças tab left this screen; the ledger is intact.
    expect(screen.queryByRole('tab', { name: /finanças/i })).toBeNull();
    expect(
      (await api.getCareer())?.world.finances.ledger.map(
        (entry) => entry.sourceLabel,
      ),
    ).toEqual(
      expect.arrayContaining([
        'Bilheteria · Flamengo × Bahia',
        'Folha salarial · Rodada 7',
      ]),
    );
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

  it('Histórico abre o Mundo sem abas: prestígio e memória da carreira (D6)', async () => {
    await onboard();
    navigate(/^histórico$/i);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Histórico' }),
    ).toBeTruthy();
    expect(screen.getByText('Prestígio')).toBeTruthy();
    expect(screen.queryAllByRole('tablist')).toHaveLength(0);
    expect(screen.queryByText(/ranking de treinadores/i)).toBeNull();
    expect(screen.queryByText(/integridade do save/i)).toBeNull();
    // Prestige metric and the "Temporadas" history card.
    expect((await screen.findAllByText('Temporadas')).length).toBe(2);
    expect(screen.getByText('Campeões')).toBeTruthy();
  });
});
