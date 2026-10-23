import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CareerGame } from '@/components/career-game';
import { completeNewCareer } from '@/components/testing/complete-new-career';
import { InMemoryCareerApi } from '@/lib/career-api';

async function startLiveMatch(api = new InMemoryCareerApi()) {
  render(<CareerGame api={api} />);
  fireEvent.click(screen.getByRole('button', { name: /entrar no vestiário/i }));
  fireEvent.click(
    await screen.findByRole('button', { name: /nova carreira/i }),
  );
  await completeNewCareer();
  fireEvent.click(
    await screen.findByRole('button', { name: /jogar partida/i }),
  );
  await screen.findByTestId('live-match');
  vi.useFakeTimers();
  return api;
}

/** Small steps: React commits (and schedules the next tick) after each act. */
const advance = async (ms: number) => {
  for (let elapsed = 0; elapsed < ms; elapsed += 50)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
};
const narration = () => screen.getByTestId('live-narration').textContent ?? '';
const status = () =>
  within(screen.getByRole('region', { name: /placar ao vivo/i })).getAllByText(
    /ao vivo|pausado|intervalo|fim de jogo/i,
  )[0]!.textContent;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('partida ao vivo (decisões 18 e 19)', () => {
  it('mostra placar, emblemas, narração e só o campo, nesta ordem, desde o apito', async () => {
    await startLiveMatch();
    const blocks = [
      'live-scoreboard',
      'live-teams',
      'live-narration',
      'live-pitch',
      'live-stats',
      'live-feed',
    ].map((id) => screen.getByTestId(id));
    for (let index = 1; index < blocks.length; index++)
      expect(
        blocks[index - 1]!.compareDocumentPosition(blocks[index]!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    expect(screen.getByTestId('live-scoreboard').textContent).toBe('0 × 0');
    const pitch = screen.getByTestId('live-pitch');
    expect(within(pitch).getByTestId('match-stage')).toBeTruthy();
    // Nothing written over the pitch: the score and narration are above it.
    expect(within(pitch).queryByTestId('stage-scoreboard')).toBeNull();
    expect(within(pitch).queryByTestId('whistle-board')).toBeNull();
    expect(pitch.querySelector('figcaption')).toBeNull();
    expect(
      within(screen.getByTestId('live-stats')).getByText('Posse'),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('live-controls'))
        .getAllByRole('radio')
        .map((item) => item.textContent),
    ).toEqual(['0,5×', '1×', '2×', '4×']);
  });

  it('abre a partida e o resultado no topo da página', async () => {
    // The flow scrolls through `globalThis` (as the shell does).
    const scrollTo = vi
      .spyOn(globalThis, 'scrollTo')
      .mockImplementation(() => {});
    await startLiveMatch();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
    scrollTo.mockClear();
    // Skipping resolves through the in-memory port: real timers again.
    vi.useRealTimers();
    fireEvent.click(
      screen.getByRole('button', { name: /pular para o resultado/i }),
    );
    expect(await screen.findByTestId('match-result')).toBeTruthy();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
  });

  it('avança com o relógio, para sozinho só no intervalo e no fim', async () => {
    const api = await startLiveMatch();
    const next = vi.spyOn(api, 'nextMatchEvent');
    fireEvent.click(screen.getByRole('radio', { name: /velocidade 4 vezes/i }));
    expect(status()).toMatch(/ao vivo · 0'/i);
    await advance(1_000);
    expect(status()).toMatch(/ao vivo · [1-9]'/i);
    await advance(3_000);
    expect(narration()).toMatch(/Samuel Lino/);
    // Through 29' and the goal at 43' straight to the half-time stop.
    await advance(10_000);
    expect(status()).toMatch(/intervalo/i);
    expect(screen.getByTestId('live-scoreboard').textContent).toBe('1 × 0');
    const calls = next.mock.calls.length;
    await advance(10_000);
    expect(next.mock.calls.length).toBe(calls);
    fireEvent.click(
      screen.getByRole('button', { name: /começar o segundo tempo/i }),
    );
    await advance(20_000);
    // The final whistle stops the match and opens the summary: big score,
    // next round and no 2D pitch or replay controls.
    const final = screen.getByRole('region', { name: /placar final/i });
    expect(within(final).getByText(/fim de jogo/i)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /preparar próxima rodada/i }),
    ).toBeTruthy();
    expect(screen.getByTestId('match-summary')).toBeTruthy();
    expect(screen.queryByTestId('match-stage')).toBeNull();
    expect(screen.queryByTestId('match-replay-viewer')).toBeNull();
    expect(
      screen.queryByRole('button', { name: /visual simples/i }),
    ).toBeNull();
    const total = next.mock.calls.length;
    await advance(10_000);
    expect(next.mock.calls.length).toBe(total);
  });

  it('pausa manual em qualquer minuto permite substituir e continua a partida', async () => {
    const api = await startLiveMatch();
    const substitute = vi.spyOn(api, 'makeSubstitution');
    fireEvent.click(screen.getByRole('radio', { name: /velocidade 4 vezes/i }));
    await advance(1_500);
    fireEvent.click(screen.getByRole('button', { name: /pausar partida/i }));
    const paused = status();
    expect(paused).toMatch(/pausado · \d+'/i);
    const minute = Number(/(\d+)'/.exec(paused ?? '')?.[1]);
    expect(minute).toBeGreaterThan(0);
    expect(minute).toBeLessThan(12);
    await advance(5_000);
    expect(status()).toBe(paused);
    const panel = screen.getByTestId('live-interventions');
    fireEvent.change(within(panel).getByLabelText('Sai'), {
      target: { value: 'fla-22' },
    });
    fireEvent.change(within(panel).getByLabelText('Entra'), {
      target: { value: 'fla-13' },
    });
    await act(async () => {
      fireEvent.click(
        within(panel).getByRole('button', { name: /confirmar substituição/i }),
      );
    });
    expect(substitute).toHaveBeenCalledWith({
      outgoingId: 'fla-22',
      incomingId: 'fla-13',
      minute,
    });
    fireEvent.click(screen.getByRole('button', { name: /retomar partida/i }));
    await advance(1_500);
    expect(narration()).toMatch(/Samuel Lino/);
    expect(screen.queryByTestId('live-interventions')).toBeNull();
  });

  it('esconde a barra inferior durante a partida e a devolve ao rolar ou trocar de tela', async () => {
    await startLiveMatch();
    const mobileNav = () =>
      screen.queryByRole('navigation', { name: /navegação principal mobile/i });
    expect(mobileNav()).toBeNull();
    act(() => {
      Object.defineProperty(window, 'scrollY', {
        configurable: true,
        value: 200,
      });
      window.dispatchEvent(new Event('scroll'));
    });
    expect(mobileNav()).toBeTruthy();
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  });

  it('volta a mostrar a barra inferior ao trocar de tela', async () => {
    await startLiveMatch();
    expect(
      screen.queryByRole('navigation', { name: /navegação principal mobile/i }),
    ).toBeNull();
    fireEvent.click(
      within(
        screen.getByRole('navigation', {
          name: /navegação principal desktop/i,
        }),
      ).getByRole('button', { name: 'Elenco' }),
    );
    expect(
      screen.getByRole('navigation', { name: /navegação principal mobile/i }),
    ).toBeTruthy();
  });

  it('não tem nada mais largo que a tela de 320 px na partida ao vivo', async () => {
    await startLiveMatch();
    const root = screen.getByTestId('live-match');
    expect(root.className).toMatch(/\bmin-w-0\b/);
    expect(root.className).toMatch(/\boverflow-x-clip\b/);
    const scoreboard = screen.getByTestId('live-scoreboard');
    expect(scoreboard.className).toMatch(/\bwhitespace-nowrap\b/);
    expect(scoreboard.className).toMatch(/text-\[clamp\(/);
    for (const element of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
      const classes = element.getAttribute('class') ?? '';
      for (const match of classes.matchAll(
        /(?:^|\s)(?:min-)?w-\[(\d+(?:\.\d+)?)(px|rem)\]/g,
      )) {
        const pixels = Number(match[1]) * (match[2] === 'rem' ? 16 : 1);
        expect(pixels).toBeLessThanOrEqual(288);
      }
      const width = element.style.width || element.style.minWidth;
      if (width.endsWith('px'))
        expect(parseFloat(width)).toBeLessThanOrEqual(288);
      if (element.tagName === 'SELECT')
        expect(classes).toMatch(
          /\bw-full\b.*\bmin-w-0\b|\bmin-w-0\b.*\bw-full\b/,
        );
    }
  });
});
