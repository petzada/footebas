import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CareerGame } from '@/components/career-game';
import { completeNewCareer } from '@/components/testing/complete-new-career';
import { CentralScreen } from '@/components/central-screen';
import { InMemoryCareerApi, type CareerView } from '@/lib/career-api';
import {
  createFakeCompetitionProductPort,
  type CompetitionProductPort,
} from '@/lib/competition-product';

async function career(): Promise<CareerView> {
  const api = new InMemoryCareerApi();
  await api.login('ana@footebas.com');
  await api.createCareer({ coach: 'Ana' });
  await api.selectClub('Flamengo');
  return (await api.getCareer())!;
}

function calendarPort(): CompetitionProductPort {
  const fake = createFakeCompetitionProductPort();
  return {
    async load() {
      const model = await fake.load();
      return {
        ...model,
        calendar: {
          ...model.calendar,
          entries: [
            {
              id: 'played',
              date: '2026-02-01',
              competitionName: 'Série A',
              phaseName: 'Turno',
              label: 'Rodada já jogada',
              status: 'played',
            },
            {
              id: 'cup',
              date: '2026-05-12',
              competitionName: 'Copa do Brasil',
              phaseName: 'Terceira fase',
              label: 'Ida da terceira fase',
              status: 'scheduled',
            },
          ],
        },
      };
    },
  };
}

describe('Central', () => {
  it('mostra card do clube, próximo jogo e o botão grande de jogar', async () => {
    const onNarrate = vi.fn();
    const onInstant = vi.fn();
    const navigate = vi.fn();
    render(
      <CentralScreen
        career={await career()}
        calendar={calendarPort()}
        onNarrate={onNarrate}
        onInstant={onInstant}
        navigate={navigate}
      />,
    );
    const club = screen.getByRole('region', { name: 'Flamengo' });
    expect(within(club).getByRole('img', { name: /escudo do flamengo/i }));
    expect(club.textContent).toMatch(/série a/i);
    expect(club.textContent).toMatch(/carreira de ana/i);
    const coach = within(club).getByRole('group', { name: 'Treinador' });
    expect(coach.textContent).toMatch(/ana/i);
    expect(coach.textContent).toMatch(/personalidade: estrategista/i);
    expect(coach.querySelector('[data-avatar="avatar-01"]')).not.toBeNull();
    expect(within(club).getByText('Posição')).toBeTruthy();
    expect(within(club).getByText('Caixa')).toBeTruthy();
    expect(
      within(club).getByLabelText(/confiança da diretoria: 72%/i),
    ).toBeTruthy();

    const match = screen.getByRole('region', {
      name: /próximo jogo: flamengo × palmeiras/i,
    });
    expect(within(match).getByText(/raio-x do rival/i)).toBeTruthy();
    expect(within(match).getByText('≈ 82')).toBeTruthy();
    fireEvent.click(
      within(match).getByRole('button', { name: /jogar partida/i }),
    );
    fireEvent.click(
      within(match).getByRole('button', { name: /resultado instantâneo/i }),
    );
    fireEvent.click(
      within(match).getByRole('button', { name: /revisar escalação/i }),
    );
    expect(onNarrate).toHaveBeenCalledTimes(1);
    expect(onInstant).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('tactics');
    expect(await screen.findByText('Ida da terceira fase')).toBeTruthy();
  });

  it('resume tabela, compromissos, caixa de entrada e notícias com dados reais', async () => {
    const navigate = vi.fn();
    const view = await career();
    render(
      <CentralScreen
        career={view}
        calendar={calendarPort()}
        onNarrate={() => undefined}
        onInstant={() => undefined}
        navigate={navigate}
      />,
    );
    const table = screen.getByRole('region', { name: 'Tabela' });
    const mine = within(table)
      .getAllByRole('row')
      .find((row) => row.getAttribute('aria-current') === 'true');
    expect(mine?.textContent).toMatch(/flamengo/i);

    const upcoming = screen.getByRole('region', {
      name: /próximos compromissos/i,
    });
    expect(
      await within(upcoming).findByText('Ida da terceira fase'),
    ).toBeTruthy();
    expect(within(upcoming).queryByText('Rodada já jogada')).toBeNull();

    const inbox = screen.getByRole('region', { name: /caixa de entrada/i });
    expect(inbox.textContent).toContain(view.world.contractAlerts[0]);
    const news = screen.getByRole('region', { name: /notícias/i });
    expect(news.textContent).toContain(view.world.news[0]!.headline);

    fireEvent.click(
      within(table).getByRole('button', { name: /ver classificação/i }),
    );
    fireEvent.click(
      within(upcoming).getByRole('button', { name: /ver calendário/i }),
    );
    fireEvent.click(
      within(news).getByRole('button', { name: /todas as notícias/i }),
    );
    expect(navigate.mock.calls.map(([to]) => to)).toEqual([
      'table',
      'calendar',
      'inbox',
    ]);
  });

  it('é a tela principal da carreira e avança a rodada pelo botão', async () => {
    render(<CareerGame api={new InMemoryCareerApi()} />);
    fireEvent.click(
      screen.getByRole('button', { name: /entrar no vestiário/i }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /nova carreira/i }),
    );
    await completeNewCareer();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Central' }),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: /resultado instantâneo/i }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /preparar próxima rodada/i }),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Central' }),
    ).toBeTruthy();
    expect(screen.getAllByText(/rodada 2/i).length).toBeGreaterThan(0);
  });
});
