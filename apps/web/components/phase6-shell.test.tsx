import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CareerGame } from '@/components/career-game';
import { InMemoryCareerApi } from '@/lib/career-api';

async function onboard(api = new InMemoryCareerApi()) {
  render(<CareerGame api={api} />);
  fireEvent.click(screen.getByRole('button', { name: /entrar no vestiário/i }));
  fireEvent.click(
    await screen.findByRole('button', { name: /nova carreira/i }),
  );
  await screen.findByLabelText(/nome do treinador/i);
  fireEvent.click(screen.getByRole('button', { name: /conhecer os clubes/i }));
  await screen.findByText(/escolha seu desafio/i);
  fireEvent.click(screen.getByRole('button', { name: /flamengo/i }));
  await screen.findByRole('button', { name: /jogar partida/i });
  return api;
}

afterEach(() => {
  localStorage.clear();
  document.documentElement.classList.add('dark');
  vi.restoreAllMocks();
});

describe('Fase 6 · shell mobile-first', () => {
  it('alcança todas as áreas do MVP pela navegação principal', async () => {
    await onboard();
    const nav = screen.getByRole('navigation', {
      name: /navegação principal desktop/i,
    });
    for (const area of [
      'Mapa',
      'Elenco',
      'Mercado',
      'Escritório',
      'Temporada',
      'Ranking',
      'Caixa de entrada',
      'Calendário',
      'Táticas',
      'Classificação',
      'Competições',
      'Estádio',
      'Finanças',
      'Histórico',
      'Central',
    ]) {
      const button = within(nav).getByRole('button', { name: area });
      fireEvent.click(button);
      expect(
        await screen.findByRole('heading', { level: 1, name: area }),
      ).toBeTruthy();
      expect(button.getAttribute('aria-current')).toBe('page');
    }
  });

  it('organiza a barra inferior com as áreas principais de docs/09', async () => {
    await onboard();
    const bottom = screen.getByRole('navigation', {
      name: /navegação principal mobile/i,
    });
    expect(
      within(bottom)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Central', 'Mapa', 'Elenco', 'Mercado', 'Menu']);
    fireEvent.click(within(bottom).getByRole('button', { name: 'Mapa' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Mapa' }),
    ).toBeTruthy();
  });

  it('volta ao Início sem perder a carreira', async () => {
    await onboard();
    fireEvent.click(screen.getByRole('button', { name: /voltar ao início/i }));
    fireEvent.click(
      await screen.findByRole('button', { name: /carregar carreira/i }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /abrir carreira de márcio/i }),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Central' }),
    ).toBeTruthy();
  });

  it('abre o menu completo pela barra inferior sem depender de gesto', async () => {
    await onboard();
    const bottom = screen.getByRole('navigation', {
      name: /navegação principal mobile/i,
    });
    const menu = within(bottom).getByRole('button', { name: /menu/i });
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(menu);
    expect(menu.getAttribute('aria-expanded')).toBe('true');
    const more = screen.getByRole('navigation', { name: /mais áreas/i });
    fireEvent.click(within(more).getByRole('button', { name: 'Finanças' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Finanças' }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('navigation', { name: /mais áreas/i }),
    ).toBeNull();
  });

  it('alterna e lembra o tema claro', async () => {
    await onboard();
    fireEvent.click(screen.getByRole('button', { name: /ativar tema claro/i }));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('footebas-theme')).toBe('light');
    fireEvent.click(
      screen.getByRole('button', { name: /ativar tema escuro/i }),
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('mostra estado offline e de reconexão sem bloquear a tela', async () => {
    await onboard();
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByRole('status').textContent).toMatch(/sem conexão/i);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.getByRole('status').textContent).toMatch(/conexão voltou/i);
    expect(screen.getByRole('button', { name: /jogar partida/i })).toBeTruthy();
  });

  it('não duplica o comando quando o mesmo botão é tocado duas vezes', async () => {
    const api = new InMemoryCareerApi();
    const begin = vi.spyOn(api, 'beginMatch');
    await onboard(api);
    const narrate = screen.getByRole('button', { name: /jogar partida/i });
    fireEvent.click(narrate);
    fireEvent.click(narrate);
    await screen.findByRole('button', { name: /pular resultado/i });
    expect(begin).toHaveBeenCalledTimes(1);
  });

  it('entrega resultado instantâneo com campo 2D e veredito coerente com o placar', async () => {
    await onboard();
    fireEvent.click(
      screen.getByRole('button', { name: /resultado instantâneo/i }),
    );
    expect(await screen.findByTestId('match-replay-viewer')).toBeTruthy();
    expect(screen.getByText(/flamengo venceu/i)).toBeTruthy();
    expect(screen.getByText(/\+3 pontos/i)).toBeTruthy();
  });
});
