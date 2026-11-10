/**
 * Graphics quality of the 3D stage. The device picks a starting level and the
 * stage steps down by itself when the measured frame rate is low, so the
 * match always plays; nothing here changes what happens in it.
 */

export type QualityTier = 'high' | 'medium' | 'low';

export interface QualitySettings {
  readonly tier: QualityTier;
  /** Upper bound for the device pixel ratio. */
  readonly pixelRatio: number;
  /** Real shadow map from the main floodlight (blob shadows stay on always). */
  readonly shadows: boolean;
  readonly shadowMap: number;
  /** Bloom, vignette and film grain. */
  readonly post: boolean;
  /** MSAA samples of the post-processing target. */
  readonly samples: number;
  /** Share of the seats that get a fan (0..1). */
  readonly crowd: number;
  /** Width of the painted pitch texture, in pixels. */
  readonly pitchTexture: number;
}

export const QUALITY: Readonly<Record<QualityTier, QualitySettings>> = {
  high: {
    tier: 'high',
    pixelRatio: 2,
    shadows: true,
    shadowMap: 4096,
    post: true,
    samples: 4,
    crowd: 1,
    pitchTexture: 4096,
  },
  medium: {
    tier: 'medium',
    pixelRatio: 1.5,
    shadows: true,
    shadowMap: 2048,
    post: true,
    samples: 0,
    crowd: 0.7,
    pitchTexture: 2048,
  },
  low: {
    tier: 'low',
    pixelRatio: 1,
    shadows: false,
    shadowMap: 1024,
    post: false,
    samples: 0,
    crowd: 0.35,
    pitchTexture: 2048,
  },
};

export interface QualityHints {
  readonly cores: number | undefined;
  readonly memoryGb: number | undefined;
  /** Touch-first device (phone or tablet). */
  readonly coarsePointer: boolean;
  /** CSS width of the viewport. */
  readonly width: number;
  /** Graphics adapter name (WEBGL_debug_renderer_info), when available. */
  readonly renderer?: string | undefined;
}

/** Starting level for a device. Pure. */
export function pickQuality(hints: QualityHints): QualityTier {
  const cores = hints.cores ?? 8;
  const memory = hints.memoryGb ?? 8;
  const gpu = hints.renderer ?? '';
  if (cores <= 4 || memory <= 3) return 'low';
  if (
    /swiftshader|llvmpipe|software|mali-[4t]|adreno \(tm\) [1-5]\d\d/i.test(gpu)
  )
    return 'low';
  // Integrated graphics run the stadium well, but not with every effect on.
  const integrated =
    /intel/i.test(gpu) &&
    !/arc/i.test(gpu) &&
    /uhd|hd graphics|iris/i.test(gpu);
  if (
    integrated ||
    hints.coarsePointer ||
    hints.width < 900 ||
    cores < 8 ||
    memory < 8
  )
    return 'medium';
  return 'high';
}

/** Name of the graphics adapter, when the browser tells. */
function rendererName(): string | undefined {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return undefined;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name: unknown = gl.getParameter(
      info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER,
    );
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return typeof name === 'string' ? name : undefined;
  } catch {
    return undefined;
  }
}

export function lowerQuality(tier: QualityTier): QualityTier | null {
  return tier === 'high' ? 'medium' : tier === 'medium' ? 'low' : null;
}

export function detectQuality(): QualityTier {
  if (typeof navigator === 'undefined' || typeof window === 'undefined')
    return 'medium';
  const hints = navigator as Navigator & { deviceMemory?: number };
  return pickQuality({
    cores: hints.hardwareConcurrency || undefined,
    memoryGb: hints.deviceMemory,
    coarsePointer:
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches,
    width: window.innerWidth,
    renderer: rendererName(),
  });
}
