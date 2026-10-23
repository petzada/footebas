import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGameHistory, type GameLocation } from '@/lib/game-history';

// What the Next.js App Router writes before any component effect runs; a
// popstate to an entry without `__NA` makes it reload the whole page.
const NEXT_STATE = {
  __NA: true,
  __PRIVATE_NEXTJS_INTERNALS_TREE: { tree: [] },
};

describe('histórico do jogo', () => {
  afterEach(() => {
    window.history.replaceState(null, '');
  });

  it('guarda a tela sem apagar o estado do roteador do Next', () => {
    window.history.replaceState(NEXT_STATE, '');
    const restore = vi.fn();
    const { rerender } = renderHook(
      (location: GameLocation) => useGameHistory({ location, restore }),
      { initialProps: { stage: 'game', screen: 'central' } },
    );
    expect(window.history.state).toMatchObject({
      ...NEXT_STATE,
      footebas: { stage: 'game', screen: 'central' },
    });
    rerender({ stage: 'game', screen: 'squad' });
    expect(window.history.state).toMatchObject({
      ...NEXT_STATE,
      footebas: { stage: 'game', screen: 'squad' },
    });
  });

  it('a Caixa de entrada entra no histórico e o Voltar devolve a tela anterior (D6)', () => {
    window.history.replaceState(NEXT_STATE, '');
    const restore = vi.fn();
    const { rerender } = renderHook(
      (location: GameLocation) => useGameHistory({ location, restore }),
      { initialProps: { stage: 'game', screen: 'central' } },
    );
    rerender({ stage: 'game', screen: 'inbox' });
    expect(window.history.state).toMatchObject({
      ...NEXT_STATE,
      footebas: { stage: 'game', screen: 'inbox' },
    });
    act(() => {
      window.dispatchEvent(
        new PopStateEvent('popstate', {
          state: {
            ...NEXT_STATE,
            footebas: { stage: 'game', screen: 'central' },
          },
        }),
      );
    });
    expect(restore).toHaveBeenCalledWith({ stage: 'game', screen: 'central' });
  });
});
