// Real-user metrics (wave 0 of docs/10-latencia-e-escala.md): Core Web
// Vitals plus two game timings, sent to the API with `navigator.sendBeacon`.
//   - `screen-switch`: from the tap to the next screen painted (ADR 0014 goal:
//     < 100 ms with cached data), labelled with the screen id;
//   - `central-visible`: the first time the Central is painted in this page
//     load, measured from the tap that led there (or from navigation start
//     when nothing was tapped).
// No user identity is sent; the API logs one line per beacon.

export type RumMetricName =
  'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB' | 'screen-switch' | 'central-visible';

export interface RumMetric {
  readonly name: RumMetricName;
  readonly value: number;
  readonly rating?: 'good' | 'needs-improvement' | 'poor';
  readonly label?: string;
  readonly navigationType?: string;
}

/** A tap older than this did not cause the screen that just appeared. */
const INTERACTION_WINDOW_MS = 10_000;
/** The API accepts at most this many metrics per beacon. */
const BATCH = 20;

interface RumState {
  readonly endpoint: string;
  readonly page: 'game' | 'landing';
  readonly queue: RumMetric[];
  lastTap: number | undefined;
  centralSeen: boolean;
}

let state: RumState | undefined;

function push(metric: RumMetric): void {
  state?.queue.push(metric);
}

function connection(): string | undefined {
  const type = (
    navigator as Navigator & { connection?: { effectiveType?: unknown } }
  ).connection?.effectiveType;
  return typeof type === 'string' ? type.slice(0, 12) : undefined;
}

function flush(): void {
  if (state === undefined) return;
  while (state.queue.length > 0) {
    const metrics = state.queue.splice(0, BATCH);
    const type = connection();
    const body = JSON.stringify({
      page: state.page,
      ...(type === undefined ? {} : { connection: type }),
      metrics,
    });
    // text/plain keeps the beacon a "simple" request: no CORS preflight.
    navigator.sendBeacon(
      state.endpoint,
      new Blob([body], { type: 'text/plain' }),
    );
  }
}

const short = (value: string | undefined) =>
  value === undefined || value === '' ? undefined : value.slice(0, 80);

/**
 * Starts collecting once per page load. Without an API (`NEXT_PUBLIC_API_URL`)
 * or `sendBeacon` it does nothing, so demos and tests never send anything.
 */
export function startRum(apiUrl: string | undefined): void {
  if (state !== undefined || typeof window === 'undefined') return;
  if (!apiUrl || typeof navigator.sendBeacon !== 'function') return;
  const host = window.location.hostname;
  state = {
    endpoint: `${apiUrl.replace(/\/$/, '')}/v1/telemetry/vitals`,
    page:
      host.startsWith('lp.') || window.location.pathname.startsWith('/landing')
        ? 'landing'
        : 'game',
    queue: [],
    lastTap: undefined,
    centralSeen: false,
  };
  const tap = () => {
    if (state) state.lastTap = performance.now();
  };
  window.addEventListener('pointerdown', tap, { capture: true, passive: true });
  window.addEventListener('keydown', tap, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
  // Loaded on demand: the library stays out of the first bundle.
  void import('web-vitals/attribution').then(
    ({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
      const base = (metric: {
        name: RumMetricName;
        value: number;
        rating: RumMetric['rating'];
        navigationType: string;
      }) => ({
        name: metric.name,
        value: Math.round(metric.value * 1000) / 1000,
        ...(metric.rating === undefined ? {} : { rating: metric.rating }),
        navigationType: metric.navigationType,
      });
      onLCP((metric) => {
        const label = short(metric.attribution.target);
        push({ ...base(metric), ...(label ? { label } : {}) });
      });
      onINP((metric) => {
        const label = short(metric.attribution.interactionTarget);
        push({ ...base(metric), ...(label ? { label } : {}) });
      });
      onCLS((metric) => {
        const label = short(metric.attribution.largestShiftTarget);
        push({ ...base(metric), ...(label ? { label } : {}) });
      });
      onFCP((metric) => push(base(metric)));
      onTTFB((metric) => push(base(metric)));
    },
  );
}

/**
 * Called when a screen mounts (ScreenTransition): measures, after the next
 * paint, the time since the tap that opened it.
 */
export function markScreen(id: string): void {
  if (state === undefined) return;
  const current = state;
  requestAnimationFrame(() => {
    // The frame after this one has painted the new screen.
    setTimeout(() => {
      const now = performance.now();
      const tap = current.lastTap;
      const recent = tap !== undefined && now - tap <= INTERACTION_WINDOW_MS;
      const label = id.slice(0, 80);
      if (id === 'central' && !current.centralSeen) {
        current.centralSeen = true;
        push({
          name: 'central-visible',
          value: Math.round(recent ? now - tap : now),
          label: recent ? 'tap' : 'navigation',
        });
      }
      if (recent) {
        push({ name: 'screen-switch', value: Math.round(now - tap), label });
        current.lastTap = undefined;
      }
    }, 0);
  });
}

/** Test hook: forget the current page's collector. */
export function resetRumForTests(): void {
  state = undefined;
}
