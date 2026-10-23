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
import { createFakeRankingPort } from '@/lib/ranking-product';
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

  function renderWorld(
    initialTab: string,
    { api, career }: Awaited<ReturnType<typeof serverLikeCareer>>,
  ) {
    render(
      <WorldScreen
        career={career}
        api={api}
        onCareerChange={() => undefined}
        reportError={() => undefined}
        initialTab={initialTab}
        ports={{
          season: createFakeSeasonPort(),
          ranking: createFakeRankingPort(),
        }}
      />,
    );
  }

  it('Notícias lista as mensagens da caixa de entrada com data e pendência', async () => {
    renderWorld('news', await serverLikeCareer());
    const list = screen.getByRole('list', { name: /todas as mensagens/i });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getByText(/diretoria quer saber/i)).toBeTruthy();
    expect(within(list).getByText(/vitória sobre o bahia/i)).toBeTruthy();
    expect(within(list).getByText(/decisão pendente/i)).toBeTruthy();
    expect(within(list).getByText('09/02')).toBeTruthy();
  });

  it('Histórico mostra a temporada, campeões e recordes do read model', async () => {
    renderWorld('history', await serverLikeCareer());
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

  it('Ranking usa os snapshots do servidor, não uma tabela vazia', async () => {
    renderWorld('ranking', await serverLikeCareer());
    expect(await screen.findByText('Tite da Várzea')).toBeTruthy();
    expect(screen.getByText(/ranking de treinadores/i)).toBeTruthy();
  });

  it('Save lista as carreiras salvas e o que o save guarda', async () => {
    const data = await serverLikeCareer();
    renderWorld('save', data);
    const saves = await screen.findByRole('list', {
      name: /carreiras salvas/i,
    });
    expect(within(saves).getByText(/flamengo/i)).toBeTruthy();
    expect(within(saves).getByText(/em uso/i)).toBeTruthy();
    expect(screen.getByText(/o que este save guarda/i)).toBeTruthy();
    expect(
      screen.getByText(/decisões pendentes/i).parentElement?.textContent,
    ).toMatch(/1$/);
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

  it('base mostra destaques, força, características e sobe só quem tem idade', async () => {
    const api = await onboard();
    navigate(/^estádio$/i);
    await screen.findByRole('tab', { name: /^base$/i });
    await selectTab(/^base$/i);
    expect(await screen.findByText(/gerados pelo universo/i)).toBeTruthy();
    expect(screen.getByText(/próxima peneira em 01\/08\/2026/i)).toBeTruthy();
    const star = screen.getByText('Caio Nascimento').closest('.panel');
    expect(within(star as HTMLElement).getByText('Destaque')).toBeTruthy();
    expect(within(star as HTMLElement).getByText('Finalização')).toBeTruthy();
    expect(
      within(star as HTMLElement).getByText(/\+4 desde a chegada/i),
    ).toBeTruthy();
    const young = screen.getByText('Ruan Teles').closest('.panel');
    expect(
      (
        within(young as HTMLElement).getByRole('button', {
          name: /promover/i,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    const keeper = screen.getByText('Davi Lessa').closest('.panel');
    expect(within(keeper as HTMLElement).getByText('Carência')).toBeTruthy();
    fireEvent.click(
      within(keeper as HTMLElement).getByRole('button', { name: /promover/i }),
    );
    await waitFor(async () =>
      expect(
        (await api.getCareer())?.world.youth.find((item) => item.id === 'y-3')
          ?.status,
      ).toBe('promoted'),
    );
  });

  it('estádio contrata obra com retorno e paga manutenção avulsa', async () => {
    const api = await onboard();
    navigate(/^estádio$/i);
    await selectTab(/^estádio$/i);
    fireEvent.click(
      await screen.findByRole('button', { name: /^reparos por/i }),
    );
    await waitFor(async () =>
      expect((await api.getCareer())?.world.stadium.quality).toBe(68),
    );
    expect(
      (await api.getCareer())?.world.finances.ledger[0]?.sourceLabel,
    ).toMatch(/estádio · manutenção/i);
    fireEvent.click(
      screen.getByRole('button', { name: /^arquibancada extra por/i }),
    );
    expect(
      await screen.findByText(/obra em andamento/i, { exact: false }),
    ).toBeTruthy();
    expect((await api.getCareer())?.world.stadium.works).toMatchObject({
      addedCapacity: 2000,
      completesOn: '2026-10-06',
    });
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
    // Ranking virou tela própria; os rankings do mundo seguem em Histórico.
    navigate(/^histórico$/i);
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
