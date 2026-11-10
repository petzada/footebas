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
import { CornersIn, CornersOut } from '@phosphor-icons/react';
import { stopSounds } from '@/lib/retro/sound';
import { useSound } from '@/lib/retro/use-sound';
import { cuesFor, momentsBetween } from './moments';
import {
  canvasSupportSnapshot,
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

/** Three.js and the stadium ship in their own chunks, only for this screen. */
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
    readonly children: ReactNode;
  },
  { readonly failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
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
  /** The simple React pitch, used whenever the 3D stadium is not. */
  readonly fallback: ReactNode;
  /** Testable override; when omitted, the browser is probed on mount. */
  readonly canvasSupport?: CanvasSupport;
  /**
   * Live screen (decision 19): only the pitch, without the scoreboard,
   * whistle board or caption drawn over it — the screen shows them above.
   */
  readonly bare?: boolean;
  /** Tells the screen whether the 3D stadium is what is being shown. */
  readonly onAnimatedChange?: (animated: boolean) => void;
  /**
   * Score and narration already revealed by the live screen. In full screen
   * they are drawn over the stadium, since the page around it is hidden.
   */
  readonly liveScore?: string;
  readonly liveCaption?: string;
  /** Extra controls shown inside the stadium while in full screen. */
  readonly fullscreenControls?: ReactNode;
}

export function MatchStage({
  match,
  minute,
  playing,
  speed,
  reducedMotion,
  fallback,
  canvasSupport: supportOverride,
  bare = false,
  onAnimatedChange,
  liveScore,
  liveCaption,
  fullscreenControls,
}: MatchStageProps) {
  const frameRef = useRef<HTMLElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const sync = () =>
      setFullscreen(
        frameRef.current !== null &&
          document.fullscreenElement === frameRef.current,
      );
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  function toggleFullscreen() {
    const frame = frameRef.current;
    if (!frame) return;
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void frame.requestFullscreen?.().catch(() => undefined);
  }
  // Server render and hydration see "unknown", then the client snapshot.
  const detected = useSyncExternalStore<CanvasSupport | undefined>(
    noSubscription,
    canvasSupportSnapshot,
    serverSupport,
  );
  const simple = useSyncExternalStore(
    subscribeSimplePreference,
    readSimplePreference,
    serverPreference,
  );
  const [loadFailed, setLoadFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const { play } = useSound();

  const stage = selectStageMode({
    reducedMotion,
    canvasSupport: supportOverride ?? detected,
    loadFailed,
    simplePreference: simple,
  });
  // Score and minute always come from the official timeline, never from the
  // animation, so skipping or a failed load cannot change what is shown.
  const frame = useMemo(
    () => createMatchReplayFrame(match, minute),
    [match, minute],
  );
  const handleReady = useCallback(() => setReady(true), []);
  const handleError = useCallback(() => {
    setLoadFailed(true);
    setReady(false);
  }, []);

  const animated = stage.mode === 'three';
  const showStage = animated && ready;
  // The simple pitch keeps the interface sounds (whistles, goal, cards...);
  // the stadium has its own sound, in step with the picture. Skipping to the
  // result only plays the final whistle.
  const previousMinute = useRef(minute);
  useEffect(() => {
    const from = previousMinute.current;
    previousMinute.current = minute;
    if (showStage) return;
    for (const cue of cuesFor(momentsBetween(match, from, minute)))
      void play(cue.sound);
  }, [match, minute, play, showStage]);
  useEffect(() => {
    onAnimatedChange?.(showStage);
  }, [onAnimatedChange, showStage]);
  // Leaving the match (or the stage) silences whatever is still sounding.
  useEffect(() => () => stopSounds(), []);

  function toggleSimple() {
    const next = !simple;
    writeSimplePreference(next);
    if (next) setReady(false);
  }

  const minuteLabel = frame.complete
    ? 'FIM'
    : `${String(frame.minute).padStart(2, '0')}'`;
  const half = Math.floor((match.durationMinutes ?? 90) / 2);
  const halfTime =
    !frame.complete && frame.minute >= half && frame.minute < half + 1;

  return (
    <div
      className="relative min-w-0 space-y-2"
      data-stage-mode={stage.mode}
      data-stage-reason={stage.mode === 'fallback' ? stage.reason : undefined}
      data-testid="match-stage"
    >
      {!showStage && fallback}
      {animated ? (
        <figure
          aria-hidden={showStage ? undefined : true}
          aria-label={`Transmissão da partida ${match.home.name} contra ${match.away.name}`}
          className={
            showStage
              ? 'stage-frame min-w-0 overflow-hidden'
              : 'pointer-events-none absolute inset-x-0 top-0 overflow-hidden opacity-0'
          }
          data-testid="three-stage"
          ref={frameRef}
          role="group"
        >
          <div className="stage-canvas relative aspect-[16/10] w-full sm:aspect-video">
            <StageErrorBoundary onError={handleError}>
              <ThreeMatchStage
                match={match}
                minute={minute}
                onError={handleError}
                onReady={handleReady}
                playing={playing}
                speed={speed}
              />
            </StageErrorBoundary>
            {bare && !fullscreen ? null : (
              <p
                aria-hidden="true"
                className="hud-scorebug absolute left-3 top-3 z-10 sm:left-5 sm:top-5"
                data-testid="stage-scoreboard"
              >
                <span className="hud-scorebug-team">
                  {match.home.abbreviation.slice(0, 3)}
                </span>
                <span className="hud-scorebug-score">
                  {liveScore?.replace(' × ', '-') ??
                    `${String(frame.score.home)}-${String(frame.score.away)}`}
                </span>
                <span className="hud-scorebug-team">
                  {match.away.abbreviation.slice(0, 3)}
                </span>
                <span className="hud-scorebug-clock">{minuteLabel}</span>
              </p>
            )}
            {fullscreen && liveCaption ? (
              <p
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-4"
              >
                <span className="hud-caption">{liveCaption}</span>
              </p>
            ) : null}
            {showStage ? (
              <div className="absolute right-3 top-3 z-20 flex items-center gap-2 sm:right-5 sm:top-5">
                {fullscreen ? fullscreenControls : null}
                <button
                  aria-label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                  aria-pressed={fullscreen}
                  className="hud-button"
                  onClick={toggleFullscreen}
                  type="button"
                >
                  {fullscreen ? <CornersIn /> : <CornersOut />}
                </button>
              </div>
            ) : null}
            {!bare && showStage && (frame.complete || halfTime) ? (
              <p
                aria-hidden="true"
                className="hud-rise pointer-events-none absolute inset-x-0 bottom-[8%] z-10 flex justify-center"
                data-testid="whistle-board"
              >
                <span className="hud-chip hud-chip-lg">
                  {frame.complete ? 'FIM DE JOGO' : 'INTERVALO'}
                </span>
              </p>
            ) : null}
          </div>
          {bare ? null : (
            <figcaption className="flex min-h-11 items-center px-3 py-2 text-sm text-[var(--muted-foreground)]">
              {frame.description}
            </figcaption>
          )}
          <p className="sr-only">{textualReplayAlternative(match, frame)}</p>
        </figure>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          aria-pressed={simple}
          className="stage-toggle"
          onClick={toggleSimple}
          type="button"
        >
          Visual simples
        </button>
        {stage.mode === 'fallback' &&
        (stage.reason === 'no-webgl' || stage.reason === 'load-error') ? (
          <p className="text-xs text-[var(--muted-foreground)]" role="status">
            {stage.reason === 'no-webgl'
              ? 'Estádio 3D indisponível neste aparelho: exibindo o campo simples.'
              : 'Não foi possível carregar o estádio 3D: exibindo o campo simples.'}
          </p>
        ) : null}
      </div>
    </div>
  );
}
