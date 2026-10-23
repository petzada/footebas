import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CareerGame } from '@/components/career-game';
import { completeNewCareer } from '@/components/testing/complete-new-career';
import { InMemoryCareerApi } from '@/lib/career-api';

async function onboard(api = new InMemoryCareerApi()) {
  render(<CareerGame api={api} />);
  fireEvent.click(screen.getByRole('button', { name: /entrar no vestiário/i }));
  fireEvent.click(
    await screen.findByRole('button', { name: /nova carreira/i }),
  );
  await completeNewCareer();
  await screen.findByRole('button', { name: /jogar partida/i });
  return api;
}

afterEach(() => {
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
      const button = within(nav).getByRole('button', {
        name: new RegExp(`^${area}`),
      });
      fireEvent.click(button);
      expect(
        await screen.findByRole('heading', { level: 1, name: area }),
      ).toBeTruthy();
      expect(button.getAttribute('aria-current')).toBe('page');
    }
  });

  it('organiza a barra inferior com o loop da rodada (docs/07 §3) e o Menu', async () => {
    await onboard();
    const bottom = screen.getByRole('navigation', {
      name: /navegação principal mobile/i,
    });
    const buttons = within(bottom).getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Central',
      'Elenco',
      'Mercado',
      'Escritório',
      'Menu',
    ]);
    for (const button of buttons) {
      expect(button.className).toMatch(/min-h-14/);
      expect(button.className).toMatch(/min-w-0/);
    }
    expect(bottom.className).toMatch(/grid-cols-5/);
    fireEvent.click(within(bottom).getByRole('button', { name: 'Elenco' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Elenco' }),
    ).toBeTruthy();
    expect(
      within(bottom)
        .getByRole('button', { name: 'Elenco' })
        .getAttribute('aria-current'),
    ).toBe('page');
  });

  it('esconde a barra inferior na partida ao vivo e a devolve ao rolar', async () => {
    await onboard();
    fireEvent.click(screen.getByRole('button', { name: /jogar partida/i }));
    await screen.findByRole('button', { name: /pular resultado/i });
    expect(
      screen.queryByRole('navigation', { name: /navegação principal mobile/i }),
    ).toBeNull();
    act(() => {
      Object.defineProperty(window, 'scrollY', {
        value: 80,
        configurable: true,
      });
      window.dispatchEvent(new Event('scroll'));
    });
    expect(
      screen.getByRole('navigation', { name: /navegação principal mobile/i }),
    ).toBeTruthy();
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });

  it('volta ao Início sem perder a carreira', async () => {
    await onboard();
    fireEvent.click(screen.getByRole('button', { name: /voltar ao início/i }));
    fireEvent.click(
      await screen.findByRole('button', { name: /carregar carreira/i }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /abrir carreira de ana/i }),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Central' }),
    ).toBeTruthy();
  });

  it('abre o menu do jogo como diálogo modal agrupado por tema', async () => {
    await onboard();
    const bottom = screen.getByRole('navigation', {
      name: /navegação principal mobile/i,
    });
    const menu = within(bottom).getByRole('button', { name: /menu/i });
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    expect(menu.getAttribute('aria-haspopup')).toBe('dialog');
    fireEvent.click(menu);
    expect(menu.getAttribute('aria-expanded')).toBe('true');
    const dialog = screen.getByRole('dialog', { name: /menu do jogo/i });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    for (const group of ['Clube', 'Futebol', 'Carreira', 'Sistema']) {
      expect(within(dialog).getByRole('region', { name: group })).toBeTruthy();
    }
    expect(
      within(dialog)
        .getByRole('region', { name: 'Clube' })
        .querySelector('.grid')
        ?.className.includes('grid-cols-3'),
    ).toBe(true);
    // Focus lands on the current screen and the grid answers the arrows.
    const current = within(dialog).getByRole('button', { name: 'Central' });
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(document.activeElement).toBe(current);
    fireEvent.keyDown(dialog, { key: 'ArrowRight' });
    expect(document.activeElement?.textContent).toBe('Elenco');
    // Counters: unread mail badge, link to the legal pages, mute toggle.
    expect(
      within(dialog).getByRole('button', { name: /caixa de entrada \(\d+\)/i }),
    ).toBeTruthy();
    expect(
      within(dialog)
        .getByRole('link', { name: /termos/i })
        .getAttribute('href'),
    ).toBe('/termos');
    expect(within(dialog).getByRole('button', { name: /som/i })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Finanças' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Finanças' }),
    ).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(menu);
  });

  it('navega por todos os destinos do menu do jogo', async () => {
    await onboard();
    const openMenu = () => {
      const bottom = screen.getByRole('navigation', {
        name: /navegação principal mobile/i,
      });
      fireEvent.click(within(bottom).getByRole('button', { name: /menu/i }));
      return screen.getByRole('dialog', { name: /menu do jogo/i });
    };
    for (const area of [
      'Mapa',
      'Estádio',
      'Escritório',
      'Finanças',
      'Táticas',
      'Mercado',
      'Calendário',
      'Classificação',
      'Competições',
      'Temporada',
      'Caixa de entrada',
      'Histórico',
      'Ranking',
      'Perfil',
      'Elenco',
      'Central',
    ]) {
      const dialog = openMenu();
      const button = within(dialog).getByRole('button', {
        name: new RegExp(`^${area}`),
      });
      fireEvent.click(button);
      expect(
        await screen.findByRole('heading', { level: 1, name: area }),
      ).toBeTruthy();
      const again = openMenu();
      expect(
        within(again)
          .getByRole('button', { name: new RegExp(`^${area}`) })
          .getAttribute('aria-current'),
      ).toBe('page');
      fireEvent.keyDown(again, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).toBeNull();
    }
  });

  it('fecha o menu com Esc ou pelo botão e devolve o foco ao gatilho', async () => {
    await onboard();
    const bottom = screen.getByRole('navigation', {
      name: /navegação principal mobile/i,
    });
    const menu = within(bottom).getByRole('button', { name: /menu/i });
    fireEvent.click(menu);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(menu);
    fireEvent.click(menu);
    const dialog = screen.getByRole('dialog');
    // Tab from the last control wraps to the first (focus trap).
    const focusables = dialog.querySelectorAll<HTMLElement>('a[href], button');
    const last = focusables[focusables.length - 1]!;
    last.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(focusables[0]);
    fireEvent.click(
      within(dialog).getByRole('button', { name: /fechar menu/i }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(menu);
  });

  it('agrupa a barra lateral desktop pelos mesmos temas do menu', async () => {
    await onboard();
    const nav = screen.getByRole('navigation', {
      name: /navegação principal desktop/i,
    });
    expect(
      within(nav)
        .getAllByRole('region')
        .map((region) => region.getAttribute('aria-labelledby')),
    ).toEqual(['desktop-clube', 'desktop-futebol', 'desktop-carreira']);
  });

  it('é só modo claro: sem botão de tema nem classe dark (ADR 0009)', async () => {
    await onboard();
    expect(screen.queryByRole('button', { name: /tema/i })).toBeNull();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('mostra avatar e personalidade do treinador na barra lateral', async () => {
    await onboard();
    const sidebar = screen
      .getByRole('navigation', { name: /navegação principal desktop/i })
      .closest('aside')!;
    expect(sidebar.querySelector('[data-avatar="avatar-01"]')).not.toBeNull();
    expect(sidebar.textContent).toMatch(/estrategista/i);
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
    await screen.findByRole('button', { name: /pular para o resultado/i });
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
