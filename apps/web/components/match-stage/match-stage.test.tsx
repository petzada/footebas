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
import type { StadiumStageOptions } from './stadium/stage';
import { stageMatch } from './test-fixture';

/** WebGL never runs in jsdom: this fake records what the stage is asked. */
const fake = vi.hoisted(() => ({
  stages: [] as Array<{
    options: StadiumStageOptions;
    wake: ReturnType<typeof vi.fn>;
    sleep: ReturnType<typeof vi.fn>;
    setQuality: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }>,
  failNext: false,
  sounds: [] as string[],
  cues: [] as string[],
}));

vi.mock('./stadium/stage', () => ({
  STAND_MODEL_URL: '',
  createStadiumStage: vi.fn(async (options: StadiumStageOptions) => {
    if (fake.failNext) throw new Error('WebGL context lost');
    const stage = {
      options,
      wake: vi.fn(),
      sleep: vi.fn(),
      setQuality: vi.fn(),
      dispose: vi.fn(),
    };
    fake.stages.push(stage);
    options.onReady();
    return stage;
  }),
}));

vi.mock('@/lib/audio/stadium-audio', () => ({
  createStadiumAudio: () => ({
    setExcitement: vi.fn(),
    cue: (kind: string) => fake.cues.push(kind),
    setActive: vi.fn(),
    dispose: vi.fn(),
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

function stageMode() {
  return screen.getByTestId('match-stage').getAttribute('data-stage-mode');
}

async function waitForStadium() {
  await waitFor(() => expect(fake.stages).toHaveLength(1));
  await waitFor(() =>
    expect(screen.queryByTestId('schematic-pitch')).toBeNull(),
  );
}

beforeEach(() => {
  fake.stages.length = 0;
  fake.sounds.length = 0;
  fake.cues.length = 0;
  fake.failNext = false;
  window.localStorage.clear();
});

afterEach(() => vi.restoreAllMocks());

describe('MatchStage 3D stadium', () => {
  it('lazy-loads the stadium on a WebGL device and labels it', async () => {
    renderStage();
    // The simple pitch holds the screen until the stadium is ready.
    expect(screen.getByTestId('schematic-pitch')).toBeTruthy();
    await waitForStadium();
    expect(stageMode()).toBe('three');
    const figure = screen.getByTestId('three-stage');
    expect(figure.getAttribute('aria-label')).toMatch(
      /Clube Ferroviário contra Futebol do Bairro/,
    );
    // The canvas host is decorative: readers get the textual alternative.
    expect(
      screen.getByTestId('three-stage-host').getAttribute('aria-hidden'),
    ).toBe('true');
    expect(figure.querySelector('.sr-only')?.textContent).toMatch(/0 minutos/);
  });

  it('hands the stage the official kits and a starting quality level', async () => {
    renderStage();
    await waitForStadium();
    const { options } = fake.stages[0]!;
    expect(options.controller.kits.home.shirt).toMatch(/^#[0-9a-f]{6}$/);
    expect(options.controller.kits.away.shirt).not.toBe(
      options.controller.kits.home.shirt,
    );
    expect(['high', 'medium', 'low']).toContain(options.quality);
  });

  it('keeps the official score independent of the animation', async () => {
    const view = renderStage({ minute: 24 });
    await waitForStadium();
    // Minute 24 has the first goal: the score comes from the timeline.
    expect(screen.getByTestId('stage-scoreboard').textContent).toContain('1-0');
    view.rerenderWith({ minute: 90 });
    expect(screen.getByTestId('stage-scoreboard').textContent).toContain('1-1');
    expect(screen.getByTestId('whistle-board').textContent).toBe('FIM DE JOGO');
  });

  it('wakes the renderer on every replay change, sleeps when hidden and disposes on unmount', async () => {
    const view = renderStage();
    await waitForStadium();
    const stage = fake.stages[0]!;
    const wakes = stage.wake.mock.calls.length;
    view.rerenderWith({ minute: 9, playing: true });
    expect(stage.wake.mock.calls.length).toBeGreaterThan(wakes);
    expect(stage.options.controller.step).toBe(1);
    expect(stage.options.controller.progress).toBe(0);

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    });
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    expect(stage.sleep).toHaveBeenCalled();
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });

    view.unmount();
    expect(stage.dispose).toHaveBeenCalledTimes(1);
  });

  it('swaps a re-planned timeline in place, without rebuilding the stadium', async () => {
    const view = renderStage({ minute: 9 });
    await waitForStadium();
    const stage = fake.stages[0]!;
    const before = stage.options.controller.choreography;
    view.rerenderWith({
      minute: 9,
      match: stageMatch({
        timeline: [
          { type: 'goal', minute: 30, side: 'away', playerId: 'fba-9' },
        ],
      }),
    });
    expect(fake.stages).toHaveLength(1);
    expect(stage.dispose).not.toHaveBeenCalled();
    expect(stage.options.controller.choreography).not.toBe(before);
  });

  it('shows the GOOOL board when the scene reaches the goal and hides it after', async () => {
    renderStage({ minute: 24, playing: true });
    await waitForStadium();
    const { options } = fake.stages[0]!;
    expect(screen.queryByTestId('goal-banner')).toBeNull();
    const goal: StageOverlay = {
      kind: 'goal',
      side: 'home',
      playerKey: 'home-8',
    };
    act(() => options.onOverlay(goal));
    expect(screen.getByTestId('goal-banner').textContent).toContain('GOOOL!');
    expect(screen.getByTestId('goal-banner').textContent).toContain(
      'Clube Ferroviário',
    );
    act(() => options.onMode?.('replay'));
    expect(screen.getByTestId('replay-badge').textContent).toContain('Replay');
    act(() => {
      options.onOverlay(null);
      options.onMode?.('rest');
    });
    expect(screen.queryByTestId('goal-banner')).toBeNull();
    expect(screen.queryByTestId('replay-badge')).toBeNull();
  });

  it('lets the stadium make its own sound and stays quiet on the interface', async () => {
    const view = renderStage({ minute: 23, playing: true });
    await waitForStadium();
    view.rerenderWith({ minute: 24, playing: true });
    // Interface blips belong to the simple pitch only.
    expect(fake.sounds).toEqual([]);
    act(() => fake.stages[0]!.options.onCue?.({ kind: 'net', power: 1 }));
    expect(fake.cues).toContain('net');
    // The breaks are whistled from the official minute.
    view.rerenderWith({ minute: 90, playing: true });
    expect(fake.cues).toContain('whistle');
  });

  it('steps the graphics down when the measured frame rate is low', async () => {
    renderStage({ playing: true });
    await waitForStadium();
    const stage = fake.stages[0]!;
    const start = stage.options.quality;
    // Ten frames per second for long enough to close the probe window.
    for (let frame = 0; frame < 60; frame += 1)
      act(() => stage.options.onFrame?.(frame * 100));
    if (start === 'low') expect(stage.setQuality).not.toHaveBeenCalled();
    else
      expect(stage.setQuality).toHaveBeenCalledWith(
        start === 'high' ? 'medium' : 'low',
      );
    // Still the stadium: a slow device gets lighter graphics, not a fallback.
    expect(stageMode()).toBe('three');
  });

  it('offers full screen and tells the screen when the stadium is on', async () => {
    const onAnimatedChange = vi.fn();
    renderStage({ bare: true, onAnimatedChange });
    await waitForStadium();
    expect(onAnimatedChange).toHaveBeenLastCalledWith(true);
    // Bare: nothing is written over the pitch outside full screen.
    expect(screen.queryByTestId('stage-scoreboard')).toBeNull();
    expect(screen.getByRole('button', { name: 'Tela cheia' })).toBeTruthy();
  });
});

describe('MatchStage simple pitch', () => {
  it('falls back when the stadium fails to start, without breaking the screen', async () => {
    fake.failNext = true;
    renderStage();
    await waitFor(() => expect(stageMode()).toBe('fallback'));
    expect(
      screen.getByTestId('match-stage').getAttribute('data-stage-reason'),
    ).toBe('load-error');
    expect(screen.getByTestId('schematic-pitch')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(
      /Não foi possível carregar o estádio 3D/,
    );
  });

  it('keeps the simple pitch with reduced motion and never loads the stadium', async () => {
    renderStage({ reducedMotion: true });
    expect(stageMode()).toBe('fallback');
    expect(screen.getByTestId('schematic-pitch')).toBeTruthy();
    await act(async () => {
      await Promise.resolve();
    });
    expect(fake.stages).toHaveLength(0);
  });

  it('falls back without WebGL', () => {
    renderStage({ canvasSupport: 'canvas' });
    expect(stageMode()).toBe('fallback');
    expect(screen.getByRole('status').textContent).toMatch(
      /Estádio 3D indisponível/,
    );
    expect(screen.queryByTestId('three-stage')).toBeNull();
  });

  it('plays the interface sounds of the minute, and only the final whistle on a skip', () => {
    const view = renderStage({ reducedMotion: true, minute: 23 });
    view.rerenderWith({ reducedMotion: true, minute: 24 });
    expect(fake.sounds).toEqual(['goal', 'crowd']);
    fake.sounds.length = 0;
    view.rerenderWith({ reducedMotion: true, minute: 90 });
    expect(fake.sounds).toEqual(['whistle']);
  });

  it('remembers the "visual simples" toggle', async () => {
    renderStage();
    await waitForStadium();
    const toggle = screen.getByRole('button', { name: 'Visual simples' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle);
    expect(stageMode()).toBe('fallback');
    expect(window.localStorage.getItem(SIMPLE_VISUAL_KEY)).toBe('1');
    expect(screen.getByTestId('schematic-pitch')).toBeTruthy();
    fireEvent.click(toggle);
    expect(window.localStorage.getItem(SIMPLE_VISUAL_KEY)).toBeNull();
  });
});
