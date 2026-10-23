import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SeasonScreen } from '@/components/season-screen';
import { createFakeSeasonPort, demoSeasonView } from '@/lib/season-product';

describe('Temporada', () => {
  it('renderiza placar, artilharia, gráfico de posição e campeões com dados completos', async () => {
    render(<SeasonScreen port={createFakeSeasonPort()} clubName="Flamengo" />);
    const board = await screen.findByRole('region', {
      name: /temporada 1 · 2026/i,
    });
    expect(within(board).getByText('Registro completo')).toBeTruthy();
    expect(
      within(board).getByRole('img', {
        name: /7 vitórias, 2 empates e 1 derrotas em 10 jogos/i,
      }),
    ).toBeTruthy();
    expect(screen.queryByText(/dados parciais/i)).toBeNull();

    const scorers = screen.getByRole('region', { name: 'Artilharia' });
    const rows = within(scorers).getAllByRole('row');
    expect(rows[1]?.textContent).toMatch(/pedro/i);
    expect(rows[1]?.textContent).toMatch(/9/);

    const ratings = screen.getByRole('region', { name: 'Melhores notas' });
    expect(ratings.textContent).toMatch(/7,9/);
    expect(ratings.textContent).toMatch(/mínimo de 5 jogos/i);

    const chart = screen.getByRole('img', {
      name: /posição do flamengo por rodada em série a/i,
    });
    expect(chart.getAttribute('aria-label')).toMatch(/rodada 10: 1º/);
    expect(chart.querySelectorAll('rect').length).toBe(10);

    const honours = screen.getByRole('region', {
      name: /campeões e premiações/i,
    });
    expect(honours.textContent).toMatch(/campeonato carioca/i);
    expect(honours.textContent).toMatch(/artilheiro/i);
    expect(honours.textContent).toMatch(/craque da temporada/i);
    expect(screen.getByText(/primeira temporada registrada/i)).toBeTruthy();
  });

  it('avisa dados parciais e aguenta listas vazias', async () => {
    const view = demoSeasonView({
      coverage: 'partial',
      topScorers: [],
      topAssists: [],
      topRatings: [],
      positions: [],
      champions: [],
      awards: [],
      history: [
        {
          season: 1,
          year: 2025,
          club: {
            club: { id: 'c', name: 'Flamengo' },
            played: 38,
            won: 20,
            drawn: 10,
            lost: 8,
            goalsFor: 60,
            goalsAgainst: 35,
            goalDifference: 25,
          },
          champions: [
            {
              competitionId: 'a',
              competition: 'Série A',
              club: { id: 'c', name: 'Flamengo' },
            },
          ],
          awards: [],
          topScorers: [
            {
              playerId: 'p',
              playerName: 'Pedro',
              appearances: 30,
              value: 22,
            },
          ],
          positions: [],
        },
      ],
    });
    render(
      <SeasonScreen port={createFakeSeasonPort(view)} clubName="Flamengo" />,
    );
    expect(await screen.findByText(/dados parciais/i)).toBeTruthy();
    expect(screen.getByText('Parcial')).toBeTruthy();
    expect(screen.getAllByText(/sem registros ainda/i)).toHaveLength(3);
    expect(
      screen.getByText(/gráfico aparece depois da primeira rodada/i),
    ).toBeTruthy();
    expect(screen.getByText(/nenhum título decidido/i)).toBeTruthy();
    const history = screen.getByRole('region', {
      name: /histórico de temporadas/i,
    });
    expect(history.textContent).toMatch(/20-10-8/);
    expect(history.textContent).toMatch(/série a \(flamengo\)/i);
    expect(history.textContent).toMatch(/pedro \(22\)/i);
  });

  it('mostra erro quando o servidor falha', async () => {
    render(
      <SeasonScreen
        port={{ load: () => Promise.reject(new Error('Servidor fora.')) }}
        clubName="Flamengo"
      />,
    );
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /servidor fora/i,
    );
  });
});
