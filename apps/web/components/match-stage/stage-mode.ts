export type CanvasSupport = 'webgl' | 'canvas' | 'none';

export type StageFallbackReason =
  'pending' | 'preference' | 'reduced-motion' | 'no-canvas' | 'load-error';

export type StageMode =
  | Readonly<{ mode: 'phaser' }>
  | Readonly<{ mode: 'fallback'; reason: StageFallbackReason }>;

export interface StageModeInput {
  readonly reducedMotion: boolean;
  /** `undefined` until the client has checked (server render, first paint). */
  readonly canvasSupport: CanvasSupport | undefined;
  readonly loadFailed: boolean;
  readonly simplePreference: boolean;
}

/** Picks the Phaser stage or the React 2D pitch. Pure. */
export function selectStageMode(input: StageModeInput): StageMode {
  if (input.simplePreference) return { mode: 'fallback', reason: 'preference' };
  if (input.reducedMotion)
    return { mode: 'fallback', reason: 'reduced-motion' };
  if (input.canvasSupport === undefined)
    return { mode: 'fallback', reason: 'pending' };
  if (input.canvasSupport === 'none')
    return { mode: 'fallback', reason: 'no-canvas' };
  if (input.loadFailed) return { mode: 'fallback', reason: 'load-error' };
  return { mode: 'phaser' };
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
