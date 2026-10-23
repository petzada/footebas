'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { Game } from 'phaser';
import type { MatchReplayInput } from '@/lib/match-replay-model';
import { buildChoreography, stepForMinute } from './choreography';
import {
  createMatchScene,
  pixelScaleFor,
  syncController,
  type PhaserModule,
  type StageController,
} from './match-scene';
import { stageTheme } from './theme';

export interface PhaserMatchStageProps {
  readonly match: MatchReplayInput;
  readonly minute: number;
  readonly playing: boolean;
  readonly speed: number;
  readonly onReady?: () => void;
  readonly onError?: (error: unknown) => void;
}

async function loadPhaser(): Promise<PhaserModule> {
  const loaded = (await import('phaser')) as PhaserModule & {
    default?: PhaserModule;
  };
  return loaded.default ?? loaded;
}

/**
 * Loaded on demand by `MatchStage` (next/dynamic, ssr: false). Phaser itself
 * is imported inside the effect, so neither ships in the initial bundle.
 */
export default function PhaserMatchStage({
  match,
  minute,
  playing,
  speed,
  onReady,
  onError,
}: PhaserMatchStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<StageController | null>(null);
  const wakeRef = useRef<() => void>(() => undefined);
  const callbacks = useRef({ onReady, onError });
  const choreography = useMemo(() => buildChoreography(match), [match]);
  const live = useRef({ minute, playing, speed });

  // Declared first so the mount effect below reads the latest props.
  useEffect(() => {
    callbacks.current = { onReady, onError };
    live.current = { minute, playing, speed };
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let game: Game | undefined;
    const controller: StageController = {
      choreography,
      colors: { home: match.home.color, away: match.away.color },
      step: stepForMinute(choreography, live.current.minute),
      progress: 1,
      paused: false,
      speed: live.current.speed,
    };
    controllerRef.current = controller;

    const sleep = () => game?.loop.sleep();
    const wake = () => {
      if (!game || document.hidden) return;
      game.loop.wake();
    };
    wakeRef.current = wake;
    const onVisibility = () => (document.hidden ? sleep() : wake());

    loadPhaser()
      .then((Phaser) => {
        if (disposed) return;
        const scale = pixelScaleFor(
          host.clientWidth || 360,
          window.devicePixelRatio || 1,
          stageTheme,
        );
        const Scene = createMatchScene(Phaser, controller, stageTheme, scale);
        controller.onReady = () => {
          game?.canvas?.setAttribute('aria-hidden', 'true');
          callbacks.current.onReady?.();
        };
        controller.onSettled = sleep;
        game = new Phaser.Game({
          type: Phaser.AUTO,
          parent: host,
          width: stageTheme.canvas.width * stageTheme.artUnit * scale,
          height: stageTheme.canvas.height * stageTheme.artUnit * scale,
          backgroundColor: stageTheme.colors.stand,
          pixelArt: true,
          banner: false,
          audio: { noAudio: true },
          input: {
            keyboard: false,
            mouse: false,
            touch: false,
            gamepad: false,
          },
          fps: { target: 60 },
          scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
          },
          scene: Scene,
        });
        game.scale?.on?.('resize', wake);
        document.addEventListener('visibilitychange', onVisibility);
      })
      .catch((error: unknown) => {
        if (!disposed) callbacks.current.onError?.(error);
      });

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      controllerRef.current = null;
      wakeRef.current = () => undefined;
      game?.destroy(true);
      game = undefined;
    };
  }, [choreography, match.home.color, match.away.color]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    syncController(controller, { minute, playing, speed });
    wakeRef.current();
  }, [choreography, minute, playing, speed]);

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 [&_canvas]:block"
      data-testid="phaser-stage-host"
      ref={hostRef}
    />
  );
}
