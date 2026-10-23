import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SIMPLE_VISUAL_KEY,
  detectCanvasSupport,
  readSimplePreference,
  selectStageMode,
  writeSimplePreference,
} from './stage-mode';

const capable = {
  reducedMotion: false,
  canvasSupport: 'webgl' as const,
  loadFailed: false,
  simplePreference: false,
};

describe('selectStageMode', () => {
  it('uses Phaser when WebGL or Canvas is available', () => {
    expect(selectStageMode(capable)).toEqual({ mode: 'phaser' });
    expect(selectStageMode({ ...capable, canvasSupport: 'canvas' })).toEqual({
      mode: 'phaser',
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
