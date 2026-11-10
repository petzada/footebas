'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createStadiumAudio,
  type StadiumAudio,
} from '@/lib/audio/stadium-audio';
import { clubKit, matchKits } from '@/lib/club-kits';
import type { MatchReplayInput } from '@/lib/match-replay-model';
import {
  buildChoreography,
  stepForMinute,
  type StageOverlay,
} from './choreography';
import { syncController, type StageController } from './controller';
import type { DirectionMode } from './direction';
import { momentsBetween } from './moments';
import { createFpsProbe } from './stage-mode';
import {
  detectQuality,
  lowerQuality,
  type QualityTier,
} from './stadium/quality';
import { createStadiumStage, type StadiumStageHandle } from './stadium/stage';

export interface ThreeMatchStageProps {
  readonly match: MatchReplayInput;
  readonly minute: number;
  readonly playing: boolean;
  readonly speed: number;
  readonly onReady?: () => void;
  /** Three failed to load or start: the simple pitch takes over. */
  readonly onError?: (error: unknown) => void;
}

function kitsOf(match: MatchReplayInput) {
  const derived = matchKits(match.home, match.away);
  return {
    ...derived,
    home: match.home.kit ?? derived.home,
    away: match.away.kit ?? derived.away,
    homeKeeper: match.home.keeperKit ?? derived.homeKeeper,
    awayKeeper: match.away.keeperKit ?? derived.awayKeeper,
  };
}

const OUTCOME_LABEL = {
  saved: 'DEFESA!',
  wide: 'PRA FORA',
  over: 'POR CIMA',
  blocked: 'TRAVADO',
  post: 'NA TRAVE!',
} as const;

/**
 * Loaded on demand by `MatchStage` (next/dynamic, ssr: false). Three.js and
 * the stadium are imported inside `createStadiumStage`, so none of it ships in
 * the initial bundle. Owns the broadcast graphics drawn over the canvas.
 */
export default function ThreeMatchStage({
  match,
  minute,
  playing,
  speed,
  onReady,
  onError,
}: ThreeMatchStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<StageController | null>(null);
  const handleRef = useRef<StadiumStageHandle | null>(null);
  const audioRef = useRef<StadiumAudio | null>(null);
  const callbacks = useRef({ onReady, onError });
  const choreography = useMemo(() => buildChoreography(match), [match]);
  const live = useRef({ minute, playing, speed, match, choreography });
  const [overlay, setOverlay] = useState<StageOverlay | null>(null);
  const [mode, setMode] = useState<DirectionMode>('rest');
  const [quality, setQuality] = useState<QualityTier>('medium');
  // The stadium is built once per fixture; a re-planned timeline (substitution
  // or tactical change at a break) only swaps the choreography in place.
  const fixture = `${match.home.id}|${match.away.id}`;

  useEffect(() => {
    callbacks.current = { onReady, onError };
    live.current = { minute, playing, speed, match, choreography };
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    const current = live.current;
    const controller: StageController = {
      choreography: current.choreography,
      kits: kitsOf(current.match),
      step: stepForMinute(current.choreography, current.minute),
      progress: 1,
      paused: !current.playing,
      speed: current.speed,
    };
    controllerRef.current = controller;
    const audio = createStadiumAudio();
    audioRef.current = audio;
    let tier = detectQuality();
    setQuality(tier);
    let probe = createFpsProbe();

    const onVisibility = () => {
      audio.setActive(!document.hidden && !controller.paused);
      if (document.hidden) handleRef.current?.sleep();
      else handleRef.current?.wake();
    };

    createStadiumStage({
      host,
      controller,
      match: current.match,
      quality: tier,
      onReady: () => {
        if (!disposed) callbacks.current.onReady?.();
      },
      onError: (error) => {
        if (!disposed) callbacks.current.onError?.(error);
      },
      onOverlay: (next) => {
        if (!disposed) setOverlay(next);
      },
      onMode: (next) => {
        if (!disposed) setMode(next);
      },
      onCue: (cue) => audio.cue(cue.kind, cue.power),
      onExcitement: (level) => audio.setExcitement(level),
      onFrame: (now) => {
        if (document.hidden || probe.sample(now) !== 'low') return;
        // Too slow for this level: step the graphics down and measure again.
        const lower = lowerQuality(tier);
        probe = createFpsProbe({ warmUpMs: 1200 });
        if (!lower) return;
        tier = lower;
        handleRef.current?.setQuality(lower);
        if (!disposed) setQuality(lower);
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
      audio.dispose();
      audioRef.current = null;
    };
  }, [fixture]);

  const previousMinute = useRef(minute);
  useEffect(() => {
    const controller = controllerRef.current;
    const from = previousMinute.current;
    previousMinute.current = minute;
    if (!controller) return;
    controller.choreography = choreography;
    syncController(controller, { minute, playing, speed });
    audioRef.current?.setActive(playing || minute >= choreography.duration);
    const moments = momentsBetween(match, from, minute);
    if (moments.includes('half-time') || moments.includes('full-time'))
      audioRef.current?.cue('whistle');
    handleRef.current?.wake();
  }, [choreography, match, minute, playing, speed]);

  const team = overlay ? match[overlay.side] : undefined;
  const accent = team ? (team.kit ?? clubKit(team)).shirt : undefined;

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden [&_canvas]:block"
      data-quality={quality}
      data-testid="three-stage-host"
      ref={hostRef}
    >
      {mode === 'replay' ? (
        <div
          className="hud-rise pointer-events-none absolute left-3 top-3 z-10 sm:left-5 sm:top-5"
          data-testid="replay-badge"
        >
          <span className="hud-chip hud-chip-live">
            <span className="hud-dot" />
            Replay
          </span>
        </div>
      ) : null}
      {overlay?.kind === 'goal' ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-[14%] z-10 flex justify-center"
          data-testid="goal-banner"
        >
          <div
            className="hud-goal"
            style={{ ['--hud-accent' as string]: accent }}
          >
            <span className="hud-goal-word">GOOOL!</span>
            <span className="hud-goal-team">{team?.name}</span>
          </div>
        </div>
      ) : null}
      {overlay?.kind === 'chance' ? (
        <div
          className="hud-rise pointer-events-none absolute inset-x-0 top-[14%] z-10 flex justify-center"
          data-testid="chance-banner"
        >
          <span
            className="hud-chip hud-chip-lg"
            style={{ ['--hud-accent' as string]: accent }}
          >
            {OUTCOME_LABEL[overlay.outcome]}
          </span>
        </div>
      ) : null}
      {overlay?.kind === 'card' ? (
        <div
          className="hud-rise pointer-events-none absolute inset-x-0 bottom-[12%] z-10 flex justify-center"
          data-testid="card-board"
        >
          <span
            className="hud-lower"
            style={{ ['--hud-accent' as string]: accent }}
          >
            <span
              className={
                overlay.card === 'red' ? 'hud-card hud-card-red' : 'hud-card'
              }
            />
            {overlay.card === 'red' ? 'Cartão vermelho' : 'Cartão amarelo'}
            <span className="hud-lower-team">{team?.abbreviation}</span>
          </span>
        </div>
      ) : null}
      {overlay?.kind === 'injury' ? (
        <div className="hud-rise pointer-events-none absolute inset-x-0 bottom-[12%] z-10 flex justify-center">
          <span
            className="hud-lower"
            style={{ ['--hud-accent' as string]: accent }}
          >
            Atendimento médico
            <span className="hud-lower-team">{team?.abbreviation}</span>
          </span>
        </div>
      ) : null}
      {overlay?.kind === 'substitution' ? (
        <div
          className="hud-rise pointer-events-none absolute inset-x-0 bottom-[12%] z-10 flex justify-center"
          data-testid="substitution-board"
        >
          <span
            className="hud-lower"
            style={{ ['--hud-accent' as string]: accent }}
          >
            Substituição
            <span className="hud-sub-in">▲ {overlay.inNumber}</span>
            <span className="hud-sub-out">▼ {overlay.outNumber}</span>
            <span className="hud-lower-team">{team?.abbreviation}</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}
