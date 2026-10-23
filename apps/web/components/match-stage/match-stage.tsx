'use client';

import dynamic from 'next/dynamic';
import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  createMatchReplayFrame,
  textualReplayAlternative,
  type MatchReplayInput,
} from '@/lib/match-replay-model';
import { useSound } from '@/lib/retro/use-sound';
import { SEGMENT_MS } from './match-scene';
import { cuesFor, momentsBetween } from './moments';
import type { PhaserMatchStageProps } from './phaser-match-stage';
import {
  canvasSupportSnapshot,
  lowEndDeviceSnapshot,
  readSimplePreference,
  selectStageMode,
  subscribeSimplePreference,
  writeSimplePreference,
  type CanvasSupport,
} from './stage-mode';
import type { ThreeMatchStageProps } from './three-match-stage';

const noSubscription = () => () => undefined;
const serverSupport = () => undefined;
const serverPreference = () => false;
const serverLowEnd = () => false;

/** Phaser and the scene ship in their own chunks, only for this screen. */
const PhaserMatchStage = dynamic<PhaserMatchStageProps>(
  () =>
    import('./phaser-match-stage').catch((error: unknown) => {
      function StageLoadFailed({ onError }: PhaserMatchStageProps) {
        useEffect(() => onError?.(error), [onError]);
        return null;
      }
      return StageLoadFailed;
    }),
  { ssr: false, loading: () => null },
);

/** Three.js and the stadium model likewise: downloaded only here. */
const ThreeMatchStage = dynamic<ThreeMatchStageProps>(
  () =>
    import('./three-match-stage').catch((error: unknown) => {
      function StageLoadFailed({ onError }: ThreeMatchStageProps) {
        useEffect(() => onError?.(error), [onError]);
        return null;
      }
      return StageLoadFailed;
    }),
  { ssr: false, loading: () => null },
);

class StageErrorBoundary extends Component<
  {
    readonly onError: (error: unknown) => void;
    readonly resetKey: string;
    readonly children: ReactNode;
  },
  { readonly failed: boolean; readonly key: string }
> {
  override state = { failed: false, key: this.props.resetKey };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  static getDerivedStateFromProps(
    props: { resetKey: string },
    state: { failed: boolean; key: string },
  ) {
    return props.resetKey === state.key
      ? null
      : { failed: false, key: props.resetKey };
  }

  override componentDidCatch(error: unknown) {
    this.props.onError(error);
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

export interface MatchStageProps {
  readonly match: MatchReplayInput;
  readonly minute: number;
  readonly playing: boolean;
  readonly speed: number;
  readonly reducedMotion: boolean;
  /** The React 2D pitch, used whenever no animated stage is. */
  readonly fallback: ReactNode;
  /** Testable override; when omitted, the browser is probed on mount. */
  readonly canvasSupport?: CanvasSupport;
  /** Testable override; when omitted, cores and memory are probed. */
  readonly lowEndDevice?: boolean;
  /**
   * Live screen (decision 19): only the pitch, without the scoreboard,
   * whistle board or caption drawn over it — the screen shows them above.
   */
  readonly bare?: boolean;
}

const scoreFont = { fontFamily: '"Courier New", Courier, monospace' };
const pixelFont = { fontFamily: 'var(--font-pixel)' };

export function MatchStage({
  match,
  minute,
  playing,
  speed,
  reducedMotion,
  fallback,
  canvasSupport: supportOverride,
  lowEndDevice: lowEndOverride,
  bare = false,
}: MatchStageProps) {
  // Server render and hydration see "unknown", then the client snapshot.
  const detected = useSyncExternalStore<CanvasSupport | undefined>(
    noSubscription,
    canvasSupportSnapshot,
    serverSupport,
  );
  const detectedLowEnd = useSyncExternalStore(
    noSubscription,
    lowEndDeviceSnapshot,
    serverLowEnd,
  );
  const simple = useSyncExternalStore(
    subscribeSimplePreference,
    readSimplePreference,
    serverPreference,
  );
  const [loadFailed, setLoadFailed] = useState(false);
  const [threeFailed, setThreeFailed] = useState(false);
  const [lowFps, setLowFps] = useState(false);
  const [ready, setReady] = useState(false);
  const { play } = useSound();

  const support = supportOverride ?? detected;
  const stage = selectStageMode({
    reducedMotion,
    canvasSupport: support,
    loadFailed,
    simplePreference: simple,
    lowEndDevice: lowEndOverride ?? detectedLowEnd,
    threeFailed,
    lowFps,
  });
  // Score and minute always come from the official timeline, never from the
  // animation, so skipping or a failed load cannot change what is shown.
  const frame = useMemo(
    () => createMatchReplayFrame(match, minute),
    [match, minute],
  );
  const handleReady = useCallback(() => setReady(true), []);
  const handlePhaserError = useCallback(() => {
    setLoadFailed(true);
    setReady(false);
  }, []);
  const handleThreeError = useCallback(() => {
    setThreeFailed(true);
    setReady(false);
  }, []);
  const handleLowFps = useCallback(() => {
    setLowFps(true);
    setReady(false);
  }, []);

  // Sounds follow the official minute (whistles, goal, cards...). Cues land
  // at the moment the animation reaches the action; skipping to the result
  // only plays the final whistle. Mute and autoplay rules live in lib/retro.
  const previousMinute = useRef(minute);
  const animated = stage.mode !== 'fallback';
  useEffect(() => {
    const from = previousMinute.current;
    previousMinute.current = minute;
    const cues = cuesFor(momentsBetween(match, from, minute));
    if (cues.length === 0) return;
    const timers = cues.map((cue) =>
      window.setTimeout(
        () => void play(cue.sound),
        animated ? (cue.at * SEGMENT_MS) / Math.max(speed, 1) : 0,
      ),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [animated, match, minute, play, speed]);

  function toggleSimple() {
    const next = !simple;
    writeSimplePreference(next);
    if (next) setReady(false);
  }

  const animatedMode = stage.mode === 'three' || stage.mode === 'phaser';
  const showStage = animatedMode && ready;
  const minuteLabel = frame.complete
    ? 'FIM'
    : `${String(frame.minute).padStart(2, '0')}'`;
  const halfTime =
    !frame.complete &&
    frame.minute >= Math.floor((match.durationMinutes ?? 90) / 2) &&
    frame.minute < Math.floor((match.durationMinutes ?? 90) / 2) + 1;

  return (
    <div
      className="relative min-w-0 space-y-2"
      data-stage-mode={stage.mode}
      data-stage-reason={stage.mode === 'fallback' ? stage.reason : undefined}
      data-stage-downgrade={
        stage.mode === 'phaser' ? (stage.reason ?? undefined) : undefined
      }
      data-testid="match-stage"
    >
      {!showStage && fallback}
      {animatedMode ? (
        <figure
          aria-hidden={showStage ? undefined : true}
          aria-label={`Animação da partida ${match.home.name} contra ${match.away.name}`}
          className={
            showStage
              ? 'px-border min-w-0 overflow-hidden bg-[#1b1f24]'
              : 'pointer-events-none absolute inset-x-0 top-0 overflow-hidden opacity-0'
          }
          data-testid={stage.mode === 'three' ? 'three-stage' : 'phaser-stage'}
          role="group"
        >
          <div
            className={
              stage.mode === 'three'
                ? 'relative aspect-[16/10] w-full'
                : 'relative aspect-[104/76] w-full'
            }
          >
            {stage.mode === 'three' ? (
              <StageErrorBoundary onError={handleThreeError} resetKey="three">
                <ThreeMatchStage
                  match={match}
                  minute={minute}
                  onError={handleThreeError}
                  onLowFps={handleLowFps}
                  onReady={handleReady}
                  playing={playing}
                  speed={speed}
                />
              </StageErrorBoundary>
            ) : (
              <StageErrorBoundary onError={handlePhaserError} resetKey="phaser">
                <PhaserMatchStage
                  match={match}
                  minute={minute}
                  onError={handlePhaserError}
                  onReady={handleReady}
                  playing={playing}
                  speed={speed}
                />
              </StageErrorBoundary>
            )}
            {bare ? null : (
              <p
                aria-hidden="true"
                className="absolute left-1/2 top-[6%] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap border border-white/30 bg-black/75 px-2 py-0.5 text-xs font-bold text-white tabular-nums sm:text-sm"
                data-testid="stage-scoreboard"
                style={scoreFont}
              >
                <span>{match.home.abbreviation.slice(0, 3)}</span>
                <span className="text-[#ffe14d]">
                  {frame.score.home}-{frame.score.away}
                </span>
                <span>{match.away.abbreviation.slice(0, 3)}</span>
                <span className="border-l border-white/30 pl-2">
                  {minuteLabel}
                </span>
              </p>
            )}
            {!bare && showStage && (frame.complete || halfTime) ? (
              <p
                aria-hidden="true"
                className="px-rise pointer-events-none absolute inset-x-0 bottom-[8%] flex justify-center"
                data-testid="whistle-board"
              >
                <span
                  className="px-border bg-[var(--board)] px-3 py-1.5 text-[.65rem] text-[var(--bulb)] sm:text-xs"
                  style={pixelFont}
                >
                  {frame.complete ? 'FIM DE JOGO' : 'INTERVALO'}
                </span>
              </p>
            ) : null}
          </div>
          {bare ? null : (
            <figcaption className="flex min-h-11 items-center px-3 py-2 text-sm text-[#d7e7df]">
              {frame.description}
            </figcaption>
          )}
          <p className="sr-only">{textualReplayAlternative(match, frame)}</p>
        </figure>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          aria-pressed={simple}
          className="min-h-11 rounded-lg border border-white/10 px-3 text-xs font-bold uppercase tracking-wide hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e7ff54] aria-pressed:border-[#e7ff54] aria-pressed:text-[#e7ff54]"
          onClick={toggleSimple}
          type="button"
        >
          Visual simples
        </button>
        {stage.mode === 'fallback' &&
        (stage.reason === 'no-canvas' || stage.reason === 'load-error') ? (
          <p className="text-xs text-[#a9c3b6]" role="status">
            {stage.reason === 'no-canvas'
              ? 'Animação indisponível neste aparelho: exibindo o campo simples.'
              : 'Não foi possível carregar a animação: exibindo o campo simples.'}
          </p>
        ) : null}
        {stage.mode === 'phaser' &&
        (stage.reason === 'low-fps' ||
          stage.reason === 'three-load-error' ||
          stage.reason === 'low-end-device') ? (
          <p className="text-xs text-[#a9c3b6]" role="status">
            {stage.reason === 'three-load-error'
              ? 'Estádio 3D indisponível: exibindo a animação leve.'
              : 'Estádio 3D desligado neste aparelho: exibindo a animação leve.'}
          </p>
        ) : null}
      </div>
    </div>
  );
}
