import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CLUB_AREAS, ClubMapScreen } from '@/components/club-map';
import { ScreenTransition } from '@/components/retro/screen-transition';
import { InMemoryCareerApi, type CareerView } from '@/lib/career-api';
import {
  resetScreenOrigin,
  setScreenOrigin,
} from '@/lib/retro/transition-origin';

async function career(): Promise<CareerView> {
  const api = new InMemoryCareerApi();
  await api.login('ana@footebas.com');
  await api.createCareer({ coach: 'Ana' });
  await api.selectClub('Flamengo');
  return (await api.getCareer())!;
}

function mockReducedMotion(reduce: boolean) {
  window.matchMedia = (query: string) =>
    ({
      matches: reduce && /prefers-reduced-motion/.test(query),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

async function renderMap(
  overrides: Partial<React.ComponentProps<typeof ClubMapScreen>> = {},
) {
  const navigate = vi.fn();
  const view = render(
    <ClubMapScreen
      career={await career()}
      navigate={navigate}
      onNarrate={() => undefined}
      onInstant={() => undefined}
      {...overrides}
    />,
  );
  const map = screen.getByRole('navigation', { name: 'Áreas do mapa' });
  return { ...view, navigate, map };
}

beforeEach(() => {
  resetScreenOrigin();
  mockReducedMotion(false);
});

describe('Mapa do clube', () => {
  it('só a ilustração navega: não há mais lista abaixo do mapa', async () => {
    const { map } = await renderMap();
    expect(
      screen.queryByRole('navigation', { name: 'Áreas do clube em lista' }),
    ).toBeNull();
    expect(screen.queryByText(/ou escolha na lista/i)).toBeNull();
    // Every building is a real, focusable button with a short description.
    const buildings = within(map).getAllByRole('button');
    expect(buildings.map((node) => node.getAttribute('data-area'))).toEqual(
      CLUB_AREAS.map(({ id }) => id),
    );
    for (const building of buildings) {
      expect(building.getAttribute('tabindex')).toBe('0');
      building.focus();
      expect(document.activeElement).toBe(building);
      const area = CLUB_AREAS.find(
        ({ id }) => id === building.getAttribute('data-area'),
      )!;
      expect(building.getAttribute('aria-label')).toContain(area.name);
      const desc = document.getElementById(
        building.getAttribute('aria-describedby')!,
      )!;
      expect(desc.textContent).toBe(area.description);
      expect(building.textContent).toContain(area.short ?? area.name);
    }
  });

  it('prédio com uma tela só navega direto, por clique ou teclado', async () => {
    const { map, navigate } = await renderMap();
    const press = within(map).getByRole('button', { name: /^imprensa/i });
    expect(press.getAttribute('aria-haspopup')).toBeNull();
    fireEvent.click(press);
    expect(navigate).toHaveBeenLastCalledWith('inbox');
    expect(screen.queryByRole('dialog')).toBeNull();
    const parking = within(map).getByRole('button', {
      name: /^estacionamento/i,
    });
    fireEvent.keyDown(parking, { key: ' ' });
    expect(navigate).toHaveBeenLastCalledWith('market');
    fireEvent.keyDown(parking, { key: 'Tab' });
    expect(navigate).toHaveBeenCalledTimes(2);
  });

  it('prédio com várias telas abre uma folha ancorada e navega pela opção', async () => {
    const { map, navigate } = await renderMap();
    const hq = within(map).getByRole('button', { name: /^sede/i });
    expect(hq.getAttribute('aria-haspopup')).toBe('dialog');
    fireEvent.click(hq);
    expect(navigate).not.toHaveBeenCalled();
    const sheet = screen.getByRole('dialog', { name: 'Sede' });
    expect(sheet.getAttribute('aria-modal')).toBe('true');
    const options = within(sheet)
      .getAllByRole('button')
      .filter((node) => node.getAttribute('aria-label') !== 'Fechar');
    expect(options.map((node) => node.textContent)).toEqual([
      'Escritório',
      'Finanças',
    ]);
    // Focus moves into the sheet and is trapped there.
    expect(document.activeElement).toBe(options[0]);
    const close = within(sheet).getByRole('button', { name: 'Fechar' });
    close.focus();
    fireEvent.keyDown(sheet, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(options[1]);
    options[1]!.focus();
    fireEvent.keyDown(sheet, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.click(options[1]!);
    expect(navigate).toHaveBeenLastCalledWith('finance');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('a folha fecha com Esc, toque fora ou botão e devolve o foco ao prédio', async () => {
    const { map, navigate } = await renderMap();
    const ct = within(map).getByRole('button', { name: /^ct/i });
    fireEvent.keyDown(ct, { key: 'Enter' });
    let sheet = screen.getByRole('dialog', { name: 'CT' });
    fireEvent.keyDown(sheet, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(ct);
    fireEvent.click(ct);
    fireEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(ct);
    fireEvent.click(ct);
    sheet = screen.getByRole('dialog', { name: 'CT' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(ct);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('nunca bloqueia avançar: jogar e resultado instantâneo cabem no topo', async () => {
    const onNarrate = vi.fn();
    const onInstant = vi.fn();
    await renderMap({ onNarrate, onInstant });
    const bar = screen.getByRole('region', { name: /avançar no calendário/i });
    expect(bar.textContent).toMatch(/flamengo × palmeiras/i);
    const play = within(bar).getByRole('button', { name: /jogar partida/i });
    const instant = within(bar).getByRole('button', {
      name: /resultado instantâneo/i,
    });
    for (const button of [play, instant]) {
      // Small label that wraps instead of overflowing at 320–375 px.
      expect(button.className).toContain('text-[.5rem]');
      expect(button.className).toContain('whitespace-normal');
      expect(button.className).toContain('min-w-0');
      expect(button.className).not.toContain('whitespace-nowrap');
    }
    fireEvent.click(play);
    fireEvent.click(instant);
    expect(onNarrate).toHaveBeenCalledTimes(1);
    expect(onInstant).toHaveBeenCalledTimes(1);
  });

  it('entrega a origem do toque para a próxima transição, que volta ao normal sem movimento', async () => {
    const { map, navigate } = await renderMap();
    const press = within(map).getByRole('button', { name: /^imprensa/i });
    fireEvent.click(press, { clientX: 40, clientY: 300 });
    expect(navigate).toHaveBeenLastCalledWith('inbox');
    const { unmount } = render(
      <ScreenTransition id="inbox">
        <p>Notícias</p>
      </ScreenTransition>,
    );
    const entered = document.querySelector('[data-screen="inbox"]')!;
    expect(entered.getAttribute('data-motion')).toBe('origin');
    unmount();
    // Back to the map: the inverse entrance.
    const back = render(
      <ScreenTransition id="map">
        <p>Mapa</p>
      </ScreenTransition>,
    );
    expect(
      document
        .querySelector('[data-screen="map"]')!
        .getAttribute('data-motion'),
    ).toBe('return');
    back.unmount();
    // Reduced motion: no animation even with an origin pending.
    mockReducedMotion(true);
    setScreenOrigin({ x: 10, y: 10 });
    render(
      <ScreenTransition id="squad">
        <p>Elenco</p>
      </ScreenTransition>,
    );
    expect(
      document
        .querySelector('[data-screen="squad"]')!
        .getAttribute('data-motion'),
    ).toBe('reduced');
  });
});
