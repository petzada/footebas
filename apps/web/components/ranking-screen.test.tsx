import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RankingAvatar, RankingScreen } from '@/components/ranking-screen';
import {
  cachedRankingPort,
  createFakeRankingPort,
  demoRankingView,
  RANKING_CACHE_TTL_MS,
  type MyRankingEntry,
  type RankingPort,
} from '@/lib/ranking-product';

const now = () => new Date('2026-05-10T12:00:00.000Z');

async function selectTab(name: string) {
  const tab = screen.getByRole('tab', { name });
  await act(async () => {
    tab.focus();
    fireEvent.keyDown(tab, { key: 'Enter' });
    await Promise.resolve();
  });
}

const MINE: readonly MyRankingEntry[] = [
  {
    scope: 'general',
    period: 'all',
    total: 1234,
    position: 3,
    points: 350,
    displayName: 'Professor Jardel',
  },
  {
    scope: 'titles',
    period: 'all',
    total: 1234,
    position: 3,
    points: 350,
    titles: 4,
    displayName: 'Professor Jardel',
  },
  {
    scope: 'best_season',
    period: 'all',
    total: 1234,
    position: 900,
    points: 15,
    season: 2,
    displayName: 'Professor Jardel',
  },
  { scope: 'rise', period: 'all', total: 1234, position: 1100, points: 0 },
  {
    scope: 'monthly',
    period: '2026-05',
    total: 1234,
    position: 40,
    points: 12,
  },
];

describe('Ranking', () => {
  it('mostra os cinco escopos em abas roláveis com encaixe e alvo de toque', async () => {
    render(<RankingScreen port={createFakeRankingPort()} now={now} />);
    await screen.findByRole('region', { name: /^ranking geral$/i });
    const strip = screen.getByRole('tablist', { name: /escopo do ranking/i });
    expect(
      within(strip)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['Geral', 'Títulos', 'Melhor temporada', 'Ascensão', 'Mensal']);
    // Horizontal scroll with snap; on a phone each tab takes 40% of the
    // strip (the next one stays half visible) and is at least 44 px tall.
    expect(strip.className).toMatch(/overflow-x-auto/);
    expect(strip.className).toMatch(/snap-x/);
    expect(strip.className).toMatch(/snap-mandatory/);
    for (const tab of within(strip).getAllByRole('tab')) {
      expect(tab.className).toMatch(/snap-start/);
      expect(tab.className).toMatch(/basis-\[40%\]/);
      expect(tab.className).toMatch(/min-h-11/);
    }
  });

  it('troca escopo e mês, destaca sua posição de N participantes e explica as regras', async () => {
    const fake = createFakeRankingPort({ mine: MINE });
    const leaderboard = vi.fn(fake.leaderboard);
    const port: RankingPort = { ...fake, leaderboard };
    render(<RankingScreen port={port} now={now} />);

    const general = await screen.findByRole('region', {
      name: /^ranking geral$/i,
    });
    const mine = within(general)
      .getAllByRole('row')
      .find((row) => row.getAttribute('aria-current') === 'true');
    expect(mine?.textContent).toMatch(/professor jardel/i);
    expect(mine?.textContent).toMatch(/350/);
    const position = screen.getByRole('group', { name: /sua posição/i });
    expect(position.textContent).toMatch(/3º/);
    expect(position.textContent).toMatch(/de 1\.234/);
    expect(general.textContent).toMatch(/1\.234 participantes/);
    expect(screen.getByText(/continental 180/i)).toBeTruthy();
    expect(leaderboard).toHaveBeenLastCalledWith('general', undefined);

    await selectTab('Títulos');
    const titles = await screen.findByRole('region', {
      name: /^ranking títulos$/i,
    });
    expect(leaderboard).toHaveBeenLastCalledWith('titles', undefined);
    expect(within(titles).getByRole('columnheader', { name: /títulos/i }));
    expect(
      screen.getByRole('group', { name: /sua posição/i }).textContent,
    ).toMatch(/4 títulos/);

    await selectTab('Melhor temporada');
    const best = await screen.findByRole('region', {
      name: /^ranking melhor temporada$/i,
    });
    expect(within(best).getAllByText(/temporada \d/i).length).toBeGreaterThan(
      0,
    );
    // Out of the shown rows: my position is appended as an extra row.
    expect(within(best).getByText('900').closest('tr')?.textContent).toMatch(
      /você/i,
    );

    await selectTab('Ascensão');
    await screen.findByRole('region', { name: /^ranking ascensão$/i });
    expect(leaderboard).toHaveBeenLastCalledWith('rise', undefined);
    // Zero points still has a position ("toda conta entra com 0").
    const rise = screen.getByRole('group', { name: /sua posição/i });
    expect(rise.textContent).toMatch(/1\.100º/);
    expect(rise.textContent).toMatch(/0 pts/);

    await selectTab('Mensal');
    await screen.findByRole('region', { name: /^ranking mensal$/i });
    expect(leaderboard).toHaveBeenLastCalledWith('monthly', '2026-05');
    fireEvent.change(
      screen.getByRole('combobox', { name: /mês do ranking/i }),
      {
        target: { value: '2026-04' },
      },
    );
    await screen.findByText(/abril de 2026/i);
    expect(leaderboard).toHaveBeenLastCalledWith('monthly', '2026-04');
  });

  it('mostra estado vazio convidativo e esconde sua posição sem sessão', async () => {
    render(
      <RankingScreen port={createFakeRankingPort({ empty: true })} now={now} />,
    );
    const empty = await screen.findByRole('region', {
      name: /ranking geral vazio/i,
    });
    expect(empty.textContent).toMatch(/pódio está vazio/i);
    expect(empty.textContent).toMatch(/você entra com 0/i);
    expect(screen.queryByRole('group', { name: /sua posição/i })).toBeNull();
  });

  it('guarda o ranking no cliente por no máximo 30 segundos', () => {
    expect(RANKING_CACHE_TTL_MS).toBe(30_000);
  });

  it('mostra o avatar do treinador e cai no pixel quando falta', async () => {
    render(<RankingScreen port={createFakeRankingPort()} now={now} />);
    const global = await screen.findByRole('region', {
      name: /^ranking geral$/i,
    });
    const rows = within(global).getAllByRole('row').slice(1);
    // Demo rows: pixel ids for all but the last coach, who has none.
    expect(rows[0]?.querySelector('[data-avatar="avatar-01"]')).not.toBeNull();
    expect(
      rows.at(-1)?.querySelector('[data-avatar-fallback="true"]'),
    ).not.toBeNull();
  });

  it('usa a foto do treinador e troca pelo pixel se ela não carregar', () => {
    const url = 'https://cdn.footebas.com.br/avatars/user_a.png';
    const { container, rerender } = render(
      <RankingAvatar avatar={url} name="Ana" />,
    );
    // The pixel fallback is an <img> too: look for the coach's picture.
    const picture = 'img[data-avatar="custom"]';
    const img = container.querySelector(picture);
    expect(img?.getAttribute('src')).toBe(url);
    expect(img?.getAttribute('alt')).toBe('');
    if (img) fireEvent.error(img);
    expect(container.querySelector(picture)).toBeNull();
    expect(
      container.querySelector('[data-avatar-fallback="true"]'),
    ).not.toBeNull();
    // Same name, same pixel coach; an unknown value falls back too.
    rerender(<RankingAvatar avatar="avatar-99" name="Ana" />);
    expect(
      container.querySelector('[data-avatar-fallback="true"]'),
    ).not.toBeNull();
    // A new picture is tried again.
    rerender(<RankingAvatar avatar={`${url}?v=2`} name="Ana" />);
    expect(container.querySelector(picture)).not.toBeNull();
  });

  it('usa cache no cliente por escopo e período', async () => {
    const clock = { value: 0 };
    const inner: RankingPort = {
      leaderboard: vi.fn(async (scope, period) =>
        demoRankingView(scope, period),
      ),
      mine: async () => null,
    };
    const cached = cachedRankingPort(inner, {
      ttlMs: 1000,
      now: () => clock.value,
    });
    await cached.leaderboard('general');
    await cached.leaderboard('general');
    await cached.leaderboard('monthly', '2026-05');
    expect(inner.leaderboard).toHaveBeenCalledTimes(2);
    clock.value = 2000;
    await cached.leaderboard('general');
    expect(inner.leaderboard).toHaveBeenCalledTimes(3);
  });
});
