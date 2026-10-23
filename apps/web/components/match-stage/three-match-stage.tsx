'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { MatchReplayInput } from '@/lib/match-replay-model';
import {
  buildChoreography,
  stepForMinute,
  type StageOverlay,
} from './choreography';
import { syncController, type StageController } from './match-scene';
import { createFpsProbe } from './stage-mode';
import { stageTheme } from './theme';
import { createThreeStage, type ThreeStageHandle } from './three-scene';

export interface ThreeMatchStageProps {
  readonly match: MatchReplayInput;
  readonly minute: number;
  readonly playing: boolean;
  readonly speed: number;
  readonly onReady?: () => void;
  /** Three failed to load, start or fetch the stadium: drop a level. */
  readonly onError?: (error: unknown) => void;
  /** Frame rate measured below the floor in the first seconds. */
  readonly onLowFps?: () => void;
}

const pixelFont = { fontFamily: 'var(--font-pixel)' };

/**
 * Loaded on demand by `MatchStage` (next/dynamic, ssr: false). Three.js and
 * the GLTF loader are imported inside `createThreeStage`, so neither ships
 * in the initial bundle. Owns the HTML letterboards drawn over the canvas.
 */
export default function ThreeMatchStage({
  match,
  minute,
  playing,
  speed,
  onReady,
  onError,
  onLowFps,
}: ThreeMatchStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<StageController | null>(null);
  const handleRef = useRef<ThreeStageHandle | null>(null);
  const callbacks = useRef({ onReady, onError, onLowFps });
  const choreography = useMemo(() => buildChoreography(match), [match]);
  const live = useRef({ minute, playing, speed });
  const [overlay, setOverlay] = useState<StageOverlay | null>(null);

  useEffect(() => {
    callbacks.current = { onReady, onError, onLowFps };
    live.current = { minute, playing, speed };
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    const controller: StageController = {
      choreography,
      colors: { home: match.home.color, away: match.away.color },
      step: stepForMinute(choreography, live.current.minute),
      progress: 1,
      paused: false,
      speed: live.current.speed,
    };
    controllerRef.current = controller;
    const probe = createFpsProbe();
    let reportedLowFps = false;

    const onVisibility = () => {
      if (document.hidden) handleRef.current?.sleep();
      else handleRef.current?.wake();
    };

    createThreeStage({
      host,
      controller,
      theme: stageTheme,
      onReady: () => {
        if (!disposed) callbacks.current.onReady?.();
      },
      onError: (error) => {
        if (!disposed) callbacks.current.onError?.(error);
      },
      onOverlay: (next) => {
        if (!disposed) setOverlay(next);
      },
      onFrame: (now) => {
        if (reportedLowFps || document.hidden) return;
        if (probe.sample(now) === 'low') {
          reportedLowFps = true;
          callbacks.current.onLowFps?.();
        }
      },
    })
      .then((handle) => {
        if (disposed) {
          handle.dispose();
          return;
        }
        handleRef.current = handle;
        syncController(controller, live.current);
        handle.wake();
        document.addEventListener('visibilitychange', onVisibility);
      })
      .catch((error: unknown) => {
        if (!disposed) callbacks.current.onError?.(error);
      });

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      controllerRef.current = null;
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, [choreography, match.home.color, match.away.color]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    syncController(controller, { minute, playing, speed });
    handleRef.current?.wake();
  }, [choreography, minute, playing, speed]);

  const teamColor = overlay ? match[overlay.side].color : undefined;

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden [&_canvas]:block"
      data-testid="three-stage-host"
      ref={hostRef}
    >
      {overlay?.kind === 'goal' ? (
        <div
          className="px-rise pointer-events-none absolute inset-x-0 top-[18%] flex justify-center"
          data-testid="goal-banner"
        >
          <span
            className="px-border inline-block bg-[var(--ink)] px-4 py-2 text-xl text-[var(--chalk)] sm:text-3xl"
            style={{ ...pixelFont, color: teamColor }}
          >
            GOOOL!
          </span>
        </div>
      ) : null}
      {overlay?.kind === 'substitution' ? (
        <div
          className="px-rise pointer-events-none absolute inset-x-0 bottom-[10%] flex justify-center"
          data-testid="substitution-board"
        >
          <span
            className="px-border inline-flex items-center gap-3 bg-[var(--board)] px-3 py-1.5 text-[.65rem] text-[var(--board-foreground)] sm:text-xs"
            style={pixelFont}
          >
            <span style={{ color: teamColor }}>■</span>
            <span className="text-[#39d36b]">▲ {overlay.inNumber}</span>
            <span className="text-[#ff5a4f]">▼ {overlay.outNumber}</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}
