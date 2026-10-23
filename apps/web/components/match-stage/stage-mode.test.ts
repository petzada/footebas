import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SIMPLE_VISUAL_KEY,
  createFpsProbe,
  detectCanvasSupport,
  isLowEndDevice,
  readSimplePreference,
  selectStageMode,
  writeSimplePreference,
} from './stage-mode';

const capable = {
  reducedMotion: false,
  canvasSupport: 'webgl' as const,
  loadFailed: false,
  simplePreference: false,
  lowEndDevice: false,
  threeFailed: false,
  lowFps: false,
};

describe('selectStageMode', () => {
  it('uses the 3D stadium when WebGL is available on a capable device', () => {
    expect(selectStageMode(capable)).toEqual({ mode: 'three' });
  });

  it.each([
    [{ canvasSupport: 'canvas' as const }, 'no-webgl'],
    [{ lowEndDevice: true }, 'low-end-device'],
    [{ threeFailed: true }, 'three-load-error'],
    [{ lowFps: true }, 'low-fps'],
  ])('drops to the Phaser 2D scene for %o', (override, reason) => {
    expect(selectStageMode({ ...capable, ...override })).toEqual({
      mode: 'phaser',
      reason,
    });
  });

  it.each([
    [{ reducedMotion: true }, 'reduced-motion'],
    [{ canvasSupport: 'none' as const }, 'no-canvas'],
    [{ canvasSupport: undefined }, 'pending'],
    [{ loadFailed: true }, 'load-error'],
    [{ simplePreference: true }, 'preference'],
  ])('falls back to the 2D pitch for %o', (override, reason) => {
    expect(selectStageMode({ ...capable, ...override })).toEqual({
      mode: 'fallback',
      reason,
    });
  });

  it('honours the user preference above everything else', () => {
    expect(
      selectStageMode({
        reducedMotion: true,
        canvasSupport: 'none',
        loadFailed: true,
        simplePreference: true,
      }),
    ).toEqual({ mode: 'fallback', reason: 'preference' });
  });

  it('keeps reduced motion above the 3D level', () => {
    expect(
      selectStageMode({ ...capable, reducedMotion: true, lowFps: true }),
    ).toEqual({ mode: 'fallback', reason: 'reduced-motion' });
  });
});

describe('device capability', () => {
  it('flags few cores or little memory as low-end', () => {
    expect(isLowEndDevice({ cores: 8, memoryGb: 8 })).toBe(false);
    expect(isLowEndDevice({ cores: 2, memoryGb: 8 })).toBe(true);
    expect(isLowEndDevice({ cores: 8, memoryGb: 2 })).toBe(true);
    expect(isLowEndDevice({ cores: undefined, memoryGb: undefined })).toBe(
      false,
    );
  });
});

describe('fps probe', () => {
  function run(fps: number, options = {}) {
    const probe = createFpsProbe({ warmUpMs: 500, windowMs: 2000, ...options });
    const step = 1000 / fps;
    let verdict = probe.verdict;
    for (let now = 0; now <= 3000; now += step) verdict = probe.sample(now);
    return verdict;
  }

  it('accepts 60 fps and 30 fps, rejects 15 fps', () => {
    expect(run(60)).toBe('ok');
    expect(run(30)).toBe('ok');
    expect(run(15)).toBe('low');
  });

  it('does not mistake on-demand idling for a slow device', () => {
    const probe = createFpsProbe({ warmUpMs: 500, windowMs: 2000 });
    let now = 0;
    // Short bursts of smooth 60 fps motion separated by long sleeps.
    for (let burst = 0; burst < 6; burst += 1) {
      for (let frame = 0; frame < 40; frame += 1) {
        probe.sample(now);
        now += 16;
      }
      now += 3000;
    }
    expect(probe.verdict).toBe('ok');
  });

  it('ignores the warm-up and stays pending until the window closes', () => {
    const probe = createFpsProbe({ warmUpMs: 500, windowMs: 2000 });
    // Slow frames during warm-up (shader compiles) do not count.
    expect(probe.sample(0)).toBe('pending');
    expect(probe.sample(200)).toBe('pending');
    expect(probe.sample(400)).toBe('pending');
    for (let now = 500; now < 2500; now += 16)
      expect(probe.sample(now)).toBe('pending');
    expect(probe.sample(2516)).toBe('ok');
    // The verdict is final.
    expect(probe.sample(9000)).toBe('ok');
  });
});

describe('canvas detection', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reports webgl, canvas or none', () => {
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    spy.mockImplementation(((kind: string) =>
      kind === 'webgl' ? {} : null) as never);
    expect(detectCanvasSupport()).toBe('webgl');
    spy.mockImplementation(((kind: string) =>
      kind === '2d' ? {} : null) as never);
    expect(detectCanvasSupport()).toBe('canvas');
    spy.mockImplementation((() => null) as never);
    expect(detectCanvasSupport()).toBe('none');
    spy.mockImplementation((() => {
      throw new Error('blocked');
    }) as never);
    expect(detectCanvasSupport()).toBe('none');
  });
});

describe('simple visual preference', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('is remembered in localStorage', () => {
    expect(readSimplePreference()).toBe(false);
    writeSimplePreference(true);
    expect(window.localStorage.getItem(SIMPLE_VISUAL_KEY)).toBe('1');
    expect(readSimplePreference()).toBe(true);
    writeSimplePreference(false);
    expect(readSimplePreference()).toBe(false);
  });

  it('survives blocked storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(readSimplePreference()).toBe(false);
    expect(() => writeSimplePreference(true)).not.toThrow();
  });
});
