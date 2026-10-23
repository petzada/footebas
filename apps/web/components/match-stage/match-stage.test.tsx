import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchStage, type MatchStageProps } from './match-stage';
import { SIMPLE_VISUAL_KEY } from './stage-mode';
import { stageMatch } from './test-fixture';

/** Phaser is never rendered in jsdom: this fake records what the stage asks. */
const fake = vi.hoisted(() => {
  const state = {
    games: [] as Array<{
      config: Record<string, unknown>;
      destroy: ReturnType<typeof vi.fn>;
      loop: { sleep: ReturnType<typeof vi.fn>; wake: ReturnType<typeof vi.fn> };
      scene?: { update: (time: number, delta: number) => void };
      canvas: HTMLCanvasElement;
    }>,
    failNext: false,
  };
  return state;
});

vi.mock('phaser', () => {
  const chain = (): unknown => {
    const proxy: unknown = new Proxy(() => undefined, {
      get: (_target, property) =>
        property === 'then' ? undefined : (proxy as object),
      apply: () => proxy,
      set: () => true,
    });
    return proxy;
  };
  class Scene {
    add = chain();
    textures = chain();
  }
  class Game {
    config: Record<string, unknown>;
    timer?: ReturnType<typeof setTimeout>;
    destroy = vi.fn(() => clearTimeout(this.timer));
    loop = { sleep: vi.fn(), wake: vi.fn() };
    scale = { on: vi.fn() };
    canvas = document.createElement('canvas');
    scene?: { create: () => void; update: (t: number, d: number) => void };
    constructor(config: Record<string, unknown>) {
      if (fake.failNext) throw new Error('WebGL context lost');
      this.config = config;
      (config.parent as HTMLElement).appendChild(this.canvas);
      const SceneClass = config.scene as new () => {
        create: () => void;
        update: (t: number, d: number) => void;
      };
      this.scene = new SceneClass();
      fake.games.push(this as never);
      this.timer = setTimeout(() => this.scene?.create(), 0);
    }
  }
  const Phaser = {
    Game,
    Scene,
    AUTO: 0,
    Scale: { FIT: 3, CENTER_HORIZONTALLY: 2 },
  };
  return { ...Phaser, default: Phaser };
});

function renderStage(overrides: Partial<MatchStageProps> = {}) {
  const props: MatchStageProps = {
    match: stageMatch(),
    minute: 0,
    playing: false,
    speed: 1,
    reducedMotion: false,
    canvasSupport: 'webgl',
    fallback: <div data-testid="schematic-pitch">2D</div>,
    ...overrides,
  };
  const view = render(<MatchStage {...props} />);
  return {
    ...view,
    rerenderWith: (next: Partial<MatchStageProps>) =>
      view.rerender(<MatchStage {...props} {...next} />),
  };
}

async function waitForPhaser() {
  await waitFor(() =>
    expect(
      screen.getByTestId('match-stage').getAttribute('data-stage-mode'),
    ).toBe('phaser'),
  );
  await waitFor(() =>
    expect(screen.queryByTestId('schematic-pitch')).toBeNull(),
  );
}

beforeEach(() => {
  fake.games.length = 0;
  fake.failNext = false;
  window.localStorage.clear();
});

afterEach(() => vi.restoreAllMocks());

describe('MatchStage', () => {
  it('lazy-loads the Phaser stage and labels the container, hiding the canvas', async () => {
    renderStage();
    // The 2D pitch holds the place until Phaser reports ready.
    expect(screen.getByTestId('schematic-pitch')).toBeTruthy();
    await waitForPhaser();
    expect(fake.games).toHaveLength(1);
    const stage = screen.getByRole('group', {
      name: /Animação da partida Clube Ferroviário contra Futebol do Bairro/,
    });
    expect(stage).toBeTruthy();
    expect(
      screen.getByTestId('phaser-stage-host').getAttribute('aria-hidden'),
    ).toBe('true');
    expect(fake.games[0]!.canvas.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByTestId('stage-scoreboard').textContent).toContain(
      'CFC0-0FBA00',
    );
  });

  it('shows the official score before the animation reaches the goal', async () => {
    const view = renderStage({ playing: true });
    await waitForPhaser();
    view.rerenderWith({ minute: 9, playing: true });
    view.rerenderWith({ minute: 24, playing: true });
    // No animation frame has run yet; the score comes from the timeline.
    expect(screen.getByTestId('stage-scoreboard').textContent).toContain('1-0');
    view.rerenderWith({ minute: 90, playing: false });
    expect(screen.getByTestId('stage-scoreboard').textContent).toContain(
      '1-1FBAFIM',
    );
    expect(() => fake.games[0]!.scene?.update(0, 16)).not.toThrow();
  });

  it('sleeps while the tab is hidden and destroys the game on unmount', async () => {
    const view = renderStage();
    await waitForPhaser();
    const game = fake.games[0]!;
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(game.loop.sleep).toHaveBeenCalled();
    hidden.mockReturnValue(false);
    game.loop.wake.mockClear();
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(game.loop.wake).toHaveBeenCalled();
    view.unmount();
    expect(game.destroy).toHaveBeenCalledWith(true);
  });

  it('keeps the 2D pitch with reduced motion and never loads Phaser', async () => {
    renderStage({ reducedMotion: true });
    expect(
      screen.getByTestId('match-stage').getAttribute('data-stage-reason'),
    ).toBe('reduced-motion');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByTestId('schematic-pitch')).toBeTruthy();
    expect(fake.games).toHaveLength(0);
  });

  it('falls back without WebGL or Canvas', () => {
    renderStage({ canvasSupport: 'none' });
    expect(screen.getByTestId('schematic-pitch')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(
      /Animação indisponível/,
    );
  });

  it('falls back when Phaser fails to start, without breaking the screen', async () => {
    fake.failNext = true;
    renderStage();
    await waitFor(() =>
      expect(
        screen.getByTestId('match-stage').getAttribute('data-stage-reason'),
      ).toBe('load-error'),
    );
    expect(screen.getByTestId('schematic-pitch')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(
      /Não foi possível carregar/,
    );
  });

  it('remembers the "visual simples" toggle', async () => {
    const view = renderStage();
    await waitForPhaser();
    const toggle = screen.getByRole('button', { name: 'Visual simples' });
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('schematic-pitch')).toBeTruthy();
    expect(window.localStorage.getItem(SIMPLE_VISUAL_KEY)).toBe('1');
    view.unmount();

    renderStage();
    await waitFor(() =>
      expect(
        screen.getByTestId('match-stage').getAttribute('data-stage-reason'),
      ).toBe('preference'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Visual simples' }));
    expect(window.localStorage.getItem(SIMPLE_VISUAL_KEY)).toBeNull();
    await waitForPhaser();
  });
});
