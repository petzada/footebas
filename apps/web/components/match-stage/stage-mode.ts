export type CanvasSupport = 'webgl' | 'canvas' | 'none';

export type StageFallbackReason =
  'pending' | 'preference' | 'reduced-motion' | 'no-canvas' | 'load-error';

/** Why the 3D stadium gave way to the Phaser 2D scene. */
export type StageDowngradeReason =
  'no-webgl' | 'low-end-device' | 'low-fps' | 'three-load-error';

/**
 * Three levels, best first: Three.js stadium → Phaser 2D scene → React 2D
 * pitch. Each level only needs what the one below can also live without.
 */
export type StageMode =
  | Readonly<{ mode: 'three' }>
  | Readonly<{ mode: 'phaser'; reason: StageDowngradeReason | null }>
  | Readonly<{ mode: 'fallback'; reason: StageFallbackReason }>;

export interface StageModeInput {
  readonly reducedMotion: boolean;
  /** `undefined` until the client has checked (server render, first paint). */
  readonly canvasSupport: CanvasSupport | undefined;
  /** The Phaser scene failed to load or start. */
  readonly loadFailed: boolean;
  readonly simplePreference: boolean;
  /** Few cores or little memory: skip the 3D stadium up front. */
  readonly lowEndDevice?: boolean;
  /** The Three.js stage failed to load, start or fetch the model. */
  readonly threeFailed?: boolean;
  /** Measured frame rate too low in the first seconds of 3D. */
  readonly lowFps?: boolean;
}

/** Picks the stage level. Pure. */
export function selectStageMode(input: StageModeInput): StageMode {
  if (input.simplePreference) return { mode: 'fallback', reason: 'preference' };
  if (input.reducedMotion)
    return { mode: 'fallback', reason: 'reduced-motion' };
  if (input.canvasSupport === undefined)
    return { mode: 'fallback', reason: 'pending' };
  if (input.canvasSupport === 'none')
    return { mode: 'fallback', reason: 'no-canvas' };
  if (input.loadFailed) return { mode: 'fallback', reason: 'load-error' };
  if (input.canvasSupport === 'canvas')
    return { mode: 'phaser', reason: 'no-webgl' };
  if (input.lowEndDevice) return { mode: 'phaser', reason: 'low-end-device' };
  if (input.threeFailed) return { mode: 'phaser', reason: 'three-load-error' };
  if (input.lowFps) return { mode: 'phaser', reason: 'low-fps' };
  return { mode: 'three' };
}

export function detectCanvasSupport(): CanvasSupport {
  try {
    const canvas = document.createElement('canvas');
    if (canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
      return 'webgl';
    if (canvas.getContext('2d')) return 'canvas';
  } catch {
    // Treated as unsupported below.
  }
  return 'none';
}

let cachedSupport: CanvasSupport | undefined;

/** Client snapshot for `useSyncExternalStore`; probed once per page. */
export function canvasSupportSnapshot(): CanvasSupport {
  cachedSupport ??= detectCanvasSupport();
  return cachedSupport;
}

export interface DeviceHints {
  readonly cores: number | undefined;
  readonly memoryGb: number | undefined;
}

/** Pure rule: two cores or less, or 2 GB or less, is a weak device. */
export function isLowEndDevice(hints: DeviceHints): boolean {
  if (hints.cores !== undefined && hints.cores <= 2) return true;
  if (hints.memoryGb !== undefined && hints.memoryGb <= 2) return true;
  return false;
}

export function detectLowEndDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const hints = navigator as Navigator & { deviceMemory?: number };
  return isLowEndDevice({
    cores: hints.hardwareConcurrency || undefined,
    memoryGb: hints.deviceMemory,
  });
}

let cachedLowEnd: boolean | undefined;

export function lowEndDeviceSnapshot(): boolean {
  cachedLowEnd ??= detectLowEndDevice();
  return cachedLowEnd;
}

export type FpsVerdict = 'pending' | 'ok' | 'low';

export interface FpsProbeOptions {
  /** Frames in the first `warmUpMs` are ignored (shader compiles, loads). */
  readonly warmUpMs?: number;
  /** Measurement window after the warm-up. */
  readonly windowMs?: number;
  readonly minimumFps?: number;
  /** A gap longer than this between frames counts as idle, not as lag. */
  readonly idleGapMs?: number;
}

/**
 * Measures the frame rate over the first seconds of rendering. Pure given
 * the timestamps fed to `sample`; the verdict is final once reached.
 */
export function createFpsProbe(options: FpsProbeOptions = {}) {
  const warmUpMs = options.warmUpMs ?? 600;
  const windowMs = options.windowMs ?? 2500;
  const minimumFps = options.minimumFps ?? 24;
  const idleGapMs = options.idleGapMs ?? 250;
  let start: number | undefined;
  let last: number | undefined;
  let frames = 0;
  let verdict: FpsVerdict = 'pending';
  return {
    /** Call once per rendered frame with a monotonic timestamp in ms. */
    sample(now: number): FpsVerdict {
      if (verdict !== 'pending') return verdict;
      start ??= now;
      // The stage renders on demand and sleeps when nothing moves: a long
      // gap is idle time, not slowness, so it is excluded from the window.
      if (last !== undefined && now - last > idleGapMs)
        start += now - last - idleGapMs;
      last = now;
      const elapsed = now - start;
      if (elapsed < warmUpMs) return verdict;
      frames += 1;
      const measured = elapsed - warmUpMs;
      if (measured < windowMs) return verdict;
      const fps = (frames * 1000) / measured;
      verdict = fps < minimumFps ? 'low' : 'ok';
      return verdict;
    },
    get verdict(): FpsVerdict {
      return verdict;
    },
  };
}

export const SIMPLE_VISUAL_KEY = 'footebas.match-stage.simple';

let memoryPreference = false;
const preferenceListeners = new Set<() => void>();

export function readSimplePreference(): boolean {
  try {
    return window.localStorage.getItem(SIMPLE_VISUAL_KEY) === '1';
  } catch {
    return memoryPreference;
  }
}

export function writeSimplePreference(value: boolean): void {
  memoryPreference = value;
  try {
    if (value) window.localStorage.setItem(SIMPLE_VISUAL_KEY, '1');
    else window.localStorage.removeItem(SIMPLE_VISUAL_KEY);
  } catch {
    // Storage blocked: remembered for this page only.
  }
  preferenceListeners.forEach((listener) => listener());
}

export function subscribeSimplePreference(listener: () => void): () => void {
  preferenceListeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    preferenceListeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}
