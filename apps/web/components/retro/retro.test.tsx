import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoachAvatar } from '@/components/coach-avatar';
import { MuteButton } from '@/components/retro/mute-button';
import { PixelAvatar } from '@/components/retro/pixel-avatar';
import { ScreenTransition } from '@/components/retro/screen-transition';
import {
  PixelBall,
  PixelCard,
  PixelTrophy,
  PixelWhistle,
} from '@/components/retro/sprites';
import { TickerProvider, useTicker } from '@/components/retro/ticker';
import { pixelAvatarSvg, pixelAvatarUri } from '@/lib/retro/avatar';
import {
  MUTE_STORAGE_KEY,
  armSoundUnlock,
  isMuted,
  play,
  resetSoundForTests,
  setMuted,
  stopSounds,
} from '@/lib/retro/sound';

let matchMedia: ((query: string) => MediaQueryList) | undefined;

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

beforeEach(() => {
  matchMedia = window.matchMedia;
  localStorage.clear();
  resetSoundForTests();
});
afterEach(() => {
  if (matchMedia) window.matchMedia = matchMedia;
});

describe('avatares pixel art determinísticos', () => {
  it('a mesma semente gera sempre a mesma imagem; sementes diferem', () => {
    const first = pixelAvatarSvg('atleta-1');
    expect(first).toBe(pixelAvatarSvg('atleta-1'));
    expect(first).toContain('<svg');
    expect(first).not.toBe(pixelAvatarSvg('atleta-2'));
    expect(pixelAvatarUri('atleta-1')).toMatch(/^data:image\/svg\+xml/);
  });

  it('renderiza como imagem local, decorativa por padrão e nomeada quando pedida', () => {
    const { rerender } = render(<PixelAvatar seed="x" />);
    const decorative = document.querySelector('img[data-avatar-seed="x"]')!;
    expect(decorative.getAttribute('aria-hidden')).toBe('true');
    expect(decorative.getAttribute('src')).toMatch(/^data:/);
    rerender(<PixelAvatar seed="x" label="Avatar de X" />);
    expect(screen.getByRole('img', { name: 'Avatar de X' })).toBeTruthy();
  });

  it('o treinador mantém o id do avatar e é determinístico', () => {
    render(
      <>
        <CoachAvatar avatar="avatar-09" label="Avatar do treinador Ana" />
        <CoachAvatar avatar="avatar-09" />
      </>,
    );
    const [a, b] = Array.from(
      document.querySelectorAll('[data-avatar="avatar-09"] img'),
    );
    expect(a!.getAttribute('src')).toBe(b!.getAttribute('src'));
    expect(
      screen.getByRole('img', { name: 'Avatar do treinador Ana' }),
    ).toBeTruthy();
  });
});

describe('sprites desenhados por código', () => {
  it('bola, apito, troféu e cartões são SVG pixelados e decorativos', () => {
    render(
      <>
        <PixelBall />
        <PixelWhistle />
        <PixelTrophy label="Troféu" />
        <PixelCard tone="red" />
      </>,
    );
    const sprites = document.querySelectorAll('svg[data-sprite]');
    expect(Array.from(sprites, (s) => s.getAttribute('data-sprite'))).toEqual([
      'ball',
      'whistle',
      'trophy',
      'card-red',
    ]);
    for (const sprite of sprites) {
      expect(sprite.getAttribute('shape-rendering')).toBe('crispEdges');
      expect(sprite.querySelectorAll('rect').length).toBeGreaterThan(10);
    }
    expect(screen.getByRole('img', { name: 'Troféu' })).toBeTruthy();
    expect(sprites[0]!.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('som retrô', () => {
  it('não toca antes da primeira interação e lembra o mudo no aparelho', async () => {
    const synth = vi.fn();
    resetSoundForTests(synth);
    expect(await play('click')).toBe(false);
    expect(synth).not.toHaveBeenCalled();
    armSoundUnlock();
    fireEvent.pointerDown(document.body);
    expect(await play('click')).toBe(true);
    expect(synth).toHaveBeenCalledTimes(1);
    setMuted(true);
    expect(localStorage.getItem(MUTE_STORAGE_KEY)).toBe('1');
    expect(await play('confirm')).toBe(false);
    resetSoundForTests(synth);
    expect(isMuted()).toBe(true);
  });

  it('mudo e pausa cortam o som que já está tocando', async () => {
    const context = {
      state: 'running',
      suspend: vi.fn(function (this: { state: string }) {
        this.state = 'suspended';
        return Promise.resolve();
      }),
      resume: vi.fn(function (this: { state: string }) {
        this.state = 'running';
        return Promise.resolve();
      }),
    };
    resetSoundForTests(vi.fn(), context);
    localStorage.removeItem(MUTE_STORAGE_KEY);
    armSoundUnlock();
    fireEvent.pointerDown(document.body);
    expect(await play('crowd')).toBe(true);
    stopSounds();
    expect(context.suspend).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(context.resume).toHaveBeenCalled();
    setMuted(true);
    expect(context.suspend).toHaveBeenCalledTimes(2);
    expect(await play('goal')).toBe(false);
  });

  it('o botão de mudo expõe o estado e alterna', () => {
    render(<MuteButton />);
    const button = screen.getByRole('button', { name: 'Som ligado' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'Som desligado' })).toBeTruthy();
    expect(localStorage.getItem(MUTE_STORAGE_KEY)).toBe('1');
  });
});

describe('movimento', () => {
  it('a transição de tela vira um bloco estático com prefers-reduced-motion', () => {
    mockReducedMotion(true);
    const { unmount } = render(
      <ScreenTransition id="inicio">
        <p>Conteúdo</p>
      </ScreenTransition>,
    );
    expect(
      document
        .querySelector('[data-screen="inicio"]')!
        .getAttribute('data-motion'),
    ).toBe('reduced');
    unmount();
    mockReducedMotion(false);
    render(
      <ScreenTransition id="inicio">
        <p>Conteúdo</p>
      </ScreenTransition>,
    );
    expect(
      document
        .querySelector('[data-screen="inicio"]')!
        .getAttribute('data-motion'),
    ).toBe('stepped');
    expect(screen.getByText('Conteúdo')).toBeTruthy();
  });
});

function Announcer() {
  const { announce } = useTicker();
  return (
    <button type="button" onClick={() => announce('Gol confirmado', 'success')}>
      Avisar
    </button>
  );
}

describe('letreiro', () => {
  it('mostra o aviso numa região de status e fecha ao toque ou no tempo', () => {
    vi.useFakeTimers();
    try {
      render(
        <TickerProvider duration={1000}>
          <Announcer />
        </TickerProvider>,
      );
      const status = document.querySelector('[data-ticker]')!;
      fireEvent.click(screen.getByRole('button', { name: 'Avisar' }));
      expect(status.textContent).toMatch(/gol confirmado/i);
      fireEvent.click(
        screen.getByRole('button', { name: /fechar aviso: gol confirmado/i }),
      );
      expect(status.textContent).toBe('');
      fireEvent.click(screen.getByRole('button', { name: 'Avisar' }));
      act(() => {
        vi.advanceTimersByTime(1100);
      });
      expect(status.textContent).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });
});
