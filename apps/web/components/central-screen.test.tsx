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
    const view = await career();
    render(
      <CentralScreen
        career={view}
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
    const flag = coach.querySelector('[data-testid="country-flag"]')!;
    expect(flag.getAttribute('src')).toBe('/flags/br.png');
    expect(coach.textContent).toMatch(/brasil/i);
    const objective = within(club).getByTestId('club-objective');
    expect(objective.textContent).toContain(view.world.board.objective);
    expect(objective.className).not.toMatch(/truncate/);
    expect(objective.className).toMatch(/break-words/);
    expect(within(club).getByText('Posição')).toBeTruthy();
    expect(within(club).getByText('Caixa')).toBeTruthy();
    expect(
      within(club).getByLabelText(/confiança da diretoria: 72%/i),
    ).toBeTruthy();

    const match = screen.getByRole('region', {
      name: /próximo jogo: flamengo × palmeiras/i,
    });
    expect(within(match).getByText(/raio-x do rival/i)).toBeTruthy();
    // Strength is a plain number (no "≈"), and the rival read is three
    // labelled rows: form, strength, absences (+ how they play).
    expect(within(match).getAllByText('82').length).toBeGreaterThan(0);
    expect(within(match).queryByText(/≈/)).toBeNull();
    const xray = within(match).getByTestId('rival-xray');
    expect(
      within(xray)
        .getAllByRole('term')
        .map((t) => t.textContent),
    ).toEqual(['Forma', 'Força', 'Desfalques', 'Como joga']);
    expect(xray.querySelectorAll('[data-form]')).toHaveLength(5);
    expect(xray.querySelector('[data-form="V"]')?.className).toMatch(
      /bg-primary/,
    );
    expect(xray.querySelector('[data-form="D"]')?.className).toMatch(
      /bg-destructive/,
    );
    expect(xray.textContent).toMatch(/vitor roque \(suspenso\)/i);
    // The instant-result label is small enough for 320px and may wrap.
    const instant = within(match).getByRole('button', {
      name: /resultado instantâneo/i,
    });
    expect(instant.className).toMatch(/text-\[\.5rem\]/);
    expect(instant.className).toMatch(/whitespace-normal/);
    expect(instant.className).not.toMatch(/truncate/);
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

  it('no celular o Próximo jogo vem antes do card do clube (D3)', async () => {
    const view = await career();
    render(
      <CentralScreen
        career={view}
        onNarrate={() => undefined}
        onInstant={() => undefined}
        navigate={() => undefined}
      />,
    );
    const next = screen.getByTestId('central-next-match');
    const club = screen.getByRole('region', { name: view.club });
    expect(
      next.compareDocumentPosition(club) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(next.className).toMatch(/order-1 lg:order-3/);
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
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['#', 'Clube', 'J', 'V', 'E', 'D', 'SG', 'Pts']);
    expect(within(table).getAllByRole('row')).toHaveLength(1 + 4);
    expect(within(table).getByText('Atlético Mineiro').className).toMatch(
      /sr-only/,
    );

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

describe('shortClubName', () => {
  it('abrevia só o que não cabe na tabela estreita', async () => {
    const { shortClubName } = await import('@/components/central-screen');
    expect(shortClubName('Flamengo')).toBe('Flamengo');
    expect(shortClubName('Atlético Mineiro')).toBe('Atlético M.');
    expect(shortClubName('Red Bull Bragantino')).toBe('RB Bragantino');
    expect(shortClubName('Athletico Paranaense')).toBe('Athletico P.');
    expect(shortClubName('Independiente del Valle')).toBe('ID Valle');
  });
});
