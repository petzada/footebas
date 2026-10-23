'use client';

import dynamic from 'next/dynamic';
import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  createMatchReplayFrame,
  textualReplayAlternative,
  type MatchReplayInput,
} from '@/lib/match-replay-model';
import type { PhaserMatchStageProps } from './phaser-match-stage';
import {
  canvasSupportSnapshot,
  readSimplePreference,
  selectStageMode,
  subscribeSimplePreference,
  writeSimplePreference,
  type CanvasSupport,
} from './stage-mode';

const noSubscription = () => () => undefined;
const serverSupport = () => undefined;
const serverPreference = () => false;

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

class StageErrorBoundary extends Component<
  { readonly onError: (error: unknown) => void; readonly children: ReactNode },
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
  /** The React 2D pitch, used whenever the Phaser stage is not. */
  readonly fallback: ReactNode;
  /** Testable override; when omitted, the browser is probed on mount. */
  readonly canvasSupport?: CanvasSupport;
}

const scoreFont = { fontFamily: '"Courier New", Courier, monospace' };

export function MatchStage({
  match,
  minute,
  playing,
  speed,
  reducedMotion,
  fallback,
  canvasSupport: supportOverride,
}: MatchStageProps) {
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

  const support = supportOverride ?? detected;
  const stage = selectStageMode({
    reducedMotion,
    canvasSupport: support,
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

  function toggleSimple() {
    const next = !simple;
    writeSimplePreference(next);
    if (next) setReady(false);
  }

  const usePhaser = stage.mode === 'phaser';
  const showPhaser = usePhaser && ready;
  const minuteLabel = frame.complete
    ? 'FIM'
    : `${String(frame.minute).padStart(2, '0')}'`;

  return (
    <div
      className="relative min-w-0 space-y-2"
      data-stage-mode={stage.mode}
      data-stage-reason={stage.mode === 'fallback' ? stage.reason : undefined}
      data-testid="match-stage"
    >
      {!showPhaser && fallback}
      {usePhaser ? (
        <figure
          aria-hidden={showPhaser ? undefined : true}
          aria-label={`Animação da partida ${match.home.name} contra ${match.away.name}`}
          className={
            showPhaser
              ? 'min-w-0 overflow-hidden rounded-[1.4rem] border border-white/10 bg-[#1b1f24]'
              : 'pointer-events-none absolute inset-x-0 top-0 overflow-hidden opacity-0'
          }
          data-testid="phaser-stage"
          role="group"
        >
          <div className="relative aspect-[104/76] w-full">
            <StageErrorBoundary onError={handleError}>
              <PhaserMatchStage
                match={match}
                minute={minute}
                onError={handleError}
                onReady={handleReady}
                playing={playing}
                speed={speed}
              />
            </StageErrorBoundary>
            <p
              aria-hidden="true"
              className="absolute left-1/2 top-[8%] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-sm border border-white/30 bg-black/75 px-2 py-0.5 text-xs font-bold text-white tabular-nums sm:text-sm"
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
          </div>
          <figcaption className="flex min-h-11 items-center px-3 py-2 text-sm text-[#d7e7df]">
            {frame.description}
          </figcaption>
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
      </div>
    </div>
  );
}
