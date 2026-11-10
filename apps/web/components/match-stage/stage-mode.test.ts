import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SIMPLE_VISUAL_KEY,
  createFpsProbe,
  detectCanvasSupport,
  readSimplePreference,
  selectStageMode,
  writeSimplePreference,
} from './stage-mode';
import { QUALITY, lowerQuality, pickQuality } from './stadium/quality';

const capable = {
  reducedMotion: false,
  canvasSupport: 'webgl' as const,
  loadFailed: false,
  simplePreference: false,
};

describe('selectStageMode', () => {
  it('uses the 3D stadium whenever WebGL is available', () => {
    expect(selectStageMode(capable)).toEqual({ mode: 'three' });
  });

  it.each([
    [{ canvasSupport: undefined }, 'pending'],
    [{ canvasSupport: 'none' as const }, 'no-webgl'],
    [{ canvasSupport: 'canvas' as const }, 'no-webgl'],
    [{ loadFailed: true }, 'load-error'],
    [{ reducedMotion: true }, 'reduced-motion'],
    [{ simplePreference: true }, 'preference'],
  ])('falls back to the simple pitch for %o', (override, reason) => {
    expect(selectStageMode({ ...capable, ...override })).toEqual({
      mode: 'fallback',
      reason,
    });
  });

  it('honours the user preference above everything else', () => {
    expect(
      selectStageMode({
        ...capable,
        simplePreference: true,
        reducedMotion: true,
        canvasSupport: 'none',
      }),
    ).toEqual({ mode: 'fallback', reason: 'preference' });
  });
});

describe('graphics quality', () => {
  const desktop = {
    cores: 16,
    memoryGb: 8,
    coarsePointer: false,
    width: 1600,
  };

  it('gives a strong desktop every effect and a phone a lighter stadium', () => {
    expect(
      pickQuality({ ...desktop, renderer: 'NVIDIA GeForce RTX 4060' }),
    ).toBe('high');
    expect(pickQuality({ ...desktop, coarsePointer: true })).toBe('medium');
    expect(pickQuality({ ...desktop, width: 600 })).toBe('medium');
    expect(pickQuality({ ...desktop, cores: 6 })).toBe('medium');
  });

  it('starts integrated graphics one level down and weak devices at the bottom', () => {
    expect(
      pickQuality({
        ...desktop,
        renderer: 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11)',
      }),
    ).toBe('medium');
    expect(
      pickQuality({
        ...desktop,
        renderer: 'ANGLE (Intel, Intel(R) Arc(TM) A770)',
      }),
    ).toBe('high');
    expect(pickQuality({ ...desktop, cores: 4 })).toBe('low');
    expect(pickQuality({ ...desktop, memoryGb: 2 })).toBe('low');
    expect(pickQuality({ ...desktop, renderer: 'Google SwiftShader' })).toBe(
      'low',
    );
    // Unknown hardware is treated as an ordinary desktop.
    expect(
      pickQuality({
        cores: undefined,
        memoryGb: undefined,
        coarsePointer: false,
        width: 1600,
      }),
    ).toBe('high');
  });

  it('steps down one level at a time and stops at the bottom', () => {
    expect(lowerQuality('high')).toBe('medium');
    expect(lowerQuality('medium')).toBe('low');
    expect(lowerQuality('low')).toBeNull();
  });

  it('spends less on every level down', () => {
    expect(QUALITY.high.pixelRatio).toBeGreaterThan(QUALITY.low.pixelRatio);
    expect(QUALITY.high.crowd).toBeGreaterThan(QUALITY.medium.crowd);
    expect(QUALITY.medium.crowd).toBeGreaterThan(QUALITY.low.crowd);
    expect(QUALITY.low.shadows).toBe(false);
    expect(QUALITY.low.post).toBe(false);
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
