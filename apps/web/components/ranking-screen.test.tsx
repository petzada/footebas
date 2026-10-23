import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RankingAvatar, RankingScreen } from '@/components/ranking-screen';
import {
  cachedRankingPort,
  createFakeRankingPort,
  demoRankingView,
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

describe('Ranking', () => {
  it('troca escopo e mês, destaca minha posição e explica as regras', async () => {
    const fake = createFakeRankingPort({
      mine: [
        {
          scope: 'global',
          period: 'all',
          position: 3,
          points: 350,
          displayName: 'Professor Jardel',
        },
        { scope: 'rise', period: 'all' },
        { scope: 'monthly', period: '2026-05', position: 40, points: 12 },
      ],
    });
    const leaderboard = vi.fn(fake.leaderboard);
    const port: RankingPort = { ...fake, leaderboard };
    render(<RankingScreen port={port} now={now} />);

    const global = await screen.findByRole('region', {
      name: /^ranking global$/i,
    });
    const mine = within(global)
      .getAllByRole('row')
      .find((row) => row.getAttribute('aria-current') === 'true');
    expect(mine?.textContent).toMatch(/professor jardel/i);
    expect(mine?.textContent).toMatch(/350/);
    const position = screen.getByRole('group', { name: /minha posição/i });
    expect(position.textContent).toMatch(/3º/);
    expect(screen.getByText(/continental 180/i)).toBeTruthy();
    expect(leaderboard).toHaveBeenLastCalledWith('global', undefined);

    await selectTab('Ascensão');
    await screen.findByRole('region', { name: /^ranking ascensão$/i });
    expect(leaderboard).toHaveBeenLastCalledWith('rise', undefined);
    expect(
      screen.getByRole('group', { name: /minha posição/i }).textContent,
    ).toMatch(/ainda sem pontos/i);

    await selectTab('Mensal');
    await screen.findByRole('region', { name: /^ranking mensal$/i });
    expect(leaderboard).toHaveBeenLastCalledWith('monthly', '2026-05');
    // Out of the shown rows: my position is appended as an extra row.
    const monthly = screen.getByRole('region', { name: /^ranking mensal$/i });
    expect(within(monthly).getByText(/40/).closest('tr')?.textContent).toMatch(
      /você/i,
    );

    fireEvent.change(
      screen.getByRole('combobox', { name: /mês do ranking/i }),
      {
        target: { value: '2026-04' },
      },
    );
    await screen.findByText(/abril de 2026/i);
    expect(leaderboard).toHaveBeenLastCalledWith('monthly', '2026-04');
  });

  it('mostra estado vazio convidativo e esconde minha posição sem sessão', async () => {
    render(
      <RankingScreen port={createFakeRankingPort({ empty: true })} now={now} />,
    );
    const empty = await screen.findByRole('region', {
      name: /ranking global vazio/i,
    });
    expect(empty.textContent).toMatch(/pódio está vazio/i);
    expect(screen.queryByRole('group', { name: /minha posição/i })).toBeNull();
  });

  it('mostra o avatar do treinador e cai no pixel quando falta', async () => {
    render(<RankingScreen port={createFakeRankingPort()} now={now} />);
    const global = await screen.findByRole('region', {
      name: /^ranking global$/i,
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
    await cached.leaderboard('global');
    await cached.leaderboard('global');
    await cached.leaderboard('monthly', '2026-05');
    expect(inner.leaderboard).toHaveBeenCalledTimes(2);
    clock.value = 2000;
    await cached.leaderboard('global');
    expect(inner.leaderboard).toHaveBeenCalledTimes(3);
  });
});
