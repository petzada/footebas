import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StageOverlay } from './choreography';
import { MatchStage, type MatchStageProps } from './match-stage';
import { SIMPLE_VISUAL_KEY } from './stage-mode';
import { stageMatch } from './test-fixture';
import type { ThreeStageOptions } from './three-scene';

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
    /** Three.js stages created through the mocked `createThreeStage`. */
    stages: [] as Array<{
      options: ThreeStageOptions;
      wake: ReturnType<typeof vi.fn>;
      sleep: ReturnType<typeof vi.fn>;
      dispose: ReturnType<typeof vi.fn>;
    }>,
    threeFailNext: false,
    sounds: [] as string[],
  };
  return state;
});

vi.mock('./three-scene', () => ({
  STADIUM_ASSETS: {},
  createThreeStage: vi.fn(async (options: ThreeStageOptions) => {
    if (fake.threeFailNext) throw new Error('404 football_field.glb');
    const stage = {
      options,
      wake: vi.fn(),
      sleep: vi.fn(),
      dispose: vi.fn(),
    };
    fake.stages.push(stage);
    options.onReady();
    return stage;
  }),
}));

vi.mock('@/lib/retro/use-sound', () => ({
  useSound: () => ({
    muted: false,
    toggle: () => false,
    play: (name: string) => {
      fake.sounds.push(name);
    },
  }),
}));

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
    lowEndDevice: false,
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

function stageMode() {
  return screen.getByTestId('match-stage').getAttribute('data-stage-mode');
}

async function waitForMode(mode: 'three' | 'phaser') {
  await waitFor(() => expect(stageMode()).toBe(mode));
  await waitFor(() =>
    expect(screen.queryByTestId('schematic-pitch')).toBeNull(),
  );
}

beforeEach(() => {
  fake.games.length = 0;
  fake.stages.length = 0;
  fake.sounds.length = 0;
  fake.failNext = false;
  fake.threeFailNext = false;
  window.localStorage.clear();
});

afterEach(() => vi.restoreAllMocks());

describe('MatchStage 3D level', () => {
  it('lazy-loads the Three.js stadium on a capable device and labels it', async () => {
    renderStage();
    expect(screen.getByTestId('schematic-pitch')).toBeTruthy();
    await waitForMode('three');
    expect(fake.stages).toHaveLength(1);
    expect(fake.games).toHaveLength(0);
    expect(
      screen.getByRole('group', {
        name: /Animação da partida Clube Ferroviário contra Futebol do Bairro/,
      }),
    ).toBeTruthy();
    expect(
      screen.getByTestId('three-stage-host').getAttribute('aria-hidden'),
    ).toBe('true');
    expect(screen.getByTestId('stage-scoreboard').textContent).toContain(
      'CFC0-0FBA00',
    );
  });

  it('keeps the official score independent of the animation', async () => {
    const view = renderStage({ playing: true });
    await waitForMode('three');
    view.rerenderWith({ minute: 24, playing: true });
    // No animation frame has run: the score still comes from the timeline.
    expect(screen.getByTestId('stage-scoreboard').textContent).toContain('1-0');
    view.rerenderWith({ minute: 90, playing: false });
    expect(screen.getByTestId('stage-scoreboard').textContent).toContain(
      '1-1FBAFIM',
    );
    expect(screen.getByTestId('whistle-board').textContent).toBe('FIM DE JOGO');
  });

  it('wakes the renderer on every replay change, sleeps when hidden and disposes on unmount', async () => {
    const view = renderStage();
    await waitForMode('three');
    const stage = fake.stages[0]!;
    stage.wake.mockClear();
    view.rerenderWith({ minute: 9, playing: true });
    expect(stage.wake).toHaveBeenCalled();
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(stage.sleep).toHaveBeenCalled();
    hidden.mockReturnValue(false);
    stage.wake.mockClear();
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(stage.wake).toHaveBeenCalled();
    view.unmount();
    expect(stage.dispose).toHaveBeenCalled();
  });

  it('shows the GOOOL board when the scene reaches the goal and hides it after', async () => {
    renderStage({ minute: 24 });
    await waitForMode('three');
    const goal: StageOverlay = {
      kind: 'goal',
      side: 'home',
      playerKey: 'home-9',
    };
    act(() => fake.stages[0]!.options.onOverlay(goal));
    expect(screen.getByTestId('goal-banner').textContent).toBe('GOOOL!');
    act(() => fake.stages[0]!.options.onOverlay(null));
    expect(screen.queryByTestId('goal-banner')).toBeNull();
    act(() =>
      fake.stages[0]!.options.onOverlay({
        kind: 'substitution',
        side: 'home',
        playerKey: 'home-10',
        inNumber: 12,
        outNumber: 11,
      }),
    );
    expect(screen.getByTestId('substitution-board').textContent).toContain(
      '▲ 12',
    );
  });

  it('cues the goal sounds at the goal minute, after the action lands', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const view = renderStage({ minute: 9, playing: true });
      await waitForMode('three');
      fake.sounds.length = 0;
      view.rerenderWith({ minute: 24, playing: true });
      expect(fake.sounds).toEqual([]);
      act(() => {
        vi.advanceTimersByTime(900);
      });
      expect(fake.sounds).toEqual(['goal', 'crowd']);
      // Skipping to the result only whistles.
      fake.sounds.length = 0;
      view.rerenderWith({ minute: 90, playing: false });
      act(() => {
        vi.advanceTimersByTime(10);
      });
      expect(fake.sounds).toEqual(['whistle']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('drops to the Phaser scene when the stadium fails to load', async () => {
    fake.threeFailNext = true;
    renderStage();
    await waitForMode('phaser');
    expect(
      screen.getByTestId('match-stage').getAttribute('data-stage-downgrade'),
    ).toBe('three-load-error');
    expect(fake.games).toHaveLength(1);
    expect(screen.getByRole('status').textContent).toMatch(
      /Estádio 3D indisponível/,
    );
  });

  it('drops to the Phaser scene when the measured frame rate is low', async () => {
    renderStage();
    await waitForMode('three');
    const { onFrame } = fake.stages[0]!.options;
    // 10 fps for four seconds.
    act(() => {
      for (let now = 0; now <= 4000; now += 100) onFrame?.(now);
    });
    await waitForMode('phaser');
    expect(
      screen.getByTestId('match-stage').getAttribute('data-stage-downgrade'),
    ).toBe('low-fps');
    expect(fake.stages[0]!.dispose).toHaveBeenCalled();
  });

  it('skips 3D on a low-end device and without WebGL', async () => {
    const weak = renderStage({ lowEndDevice: true });
    await waitForMode('phaser');
    expect(
      screen.getByTestId('match-stage').getAttribute('data-stage-downgrade'),
    ).toBe('low-end-device');
    weak.unmount();
    renderStage({ canvasSupport: 'canvas' });
    await waitForMode('phaser');
    expect(
      screen.getByTestId('match-stage').getAttribute('data-stage-downgrade'),
    ).toBe('no-webgl');
    expect(fake.stages).toHaveLength(0);
  });
});

describe('MatchStage Phaser level', () => {
  const phaserProps = { canvasSupport: 'canvas' as const };

  it('lazy-loads the Phaser stage and hides the canvas from readers', async () => {
    renderStage(phaserProps);
    await waitForMode('phaser');
    expect(fake.games).toHaveLength(1);
    expect(
      screen.getByTestId('phaser-stage-host').getAttribute('aria-hidden'),
    ).toBe('true');
    expect(fake.games[0]!.canvas.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows the official score before the animation reaches the goal', async () => {
    const view = renderStage({ ...phaserProps, playing: true });
    await waitForMode('phaser');
    view.rerenderWith({ minute: 9, playing: true });
    view.rerenderWith({ minute: 24, playing: true });
    expect(screen.getByTestId('stage-scoreboard').textContent).toContain('1-0');
    view.rerenderWith({ minute: 90, playing: false });
    expect(screen.getByTestId('stage-scoreboard').textContent).toContain(
      '1-1FBAFIM',
    );
    expect(() => fake.games[0]!.scene?.update(0, 16)).not.toThrow();
  });

  it('sleeps while the tab is hidden and destroys the game on unmount', async () => {
    const view = renderStage(phaserProps);
    await waitForMode('phaser');
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

  it('falls back when Phaser fails to start, without breaking the screen', async () => {
    fake.failNext = true;
    renderStage(phaserProps);
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
});

describe('MatchStage 2D fallback', () => {
  it('keeps the 2D pitch with reduced motion and never loads a stage', async () => {
    renderStage({ reducedMotion: true });
    expect(
      screen.getByTestId('match-stage').getAttribute('data-stage-reason'),
    ).toBe('reduced-motion');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByTestId('schematic-pitch')).toBeTruthy();
    expect(fake.games).toHaveLength(0);
    expect(fake.stages).toHaveLength(0);
  });

  it('falls back without WebGL or Canvas', () => {
    renderStage({ canvasSupport: 'none' });
    expect(screen.getByTestId('schematic-pitch')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(
      /Animação indisponível/,
    );
  });

  it('remembers the "visual simples" toggle', async () => {
    const view = renderStage();
    await waitForMode('three');
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
    await waitForMode('three');
  });
});
