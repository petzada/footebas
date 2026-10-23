'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  FastForward,
  Pause,
  Play,
  SoccerBall,
  SpeakerHigh,
} from '@phosphor-icons/react';
import {
  createMatchReplayFrame,
  describeReplayEvent,
  nextReplayMinute,
  textualReplayAlternative,
  type MatchReplayInput,
  type ReplaySide,
} from '@/lib/match-replay-model';
import { MatchStage } from '@/components/match-stage/match-stage';

export interface MatchReplayViewerProps {
  readonly match: MatchReplayInput;
  readonly autoPlay?: boolean;
  /** Testable override; when omitted, the operating-system preference wins. */
  readonly reducedMotion?: boolean;
  readonly onResult?: () => void;
}

const speedOptions = [1, 2, 4] as const;

function useReducedMotion(override: boolean | undefined): boolean {
  const [preferred, setPreferred] = useState(false);
  useEffect(() => {
    if (override !== undefined || typeof window.matchMedia !== 'function')
      return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPreferred(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, [override]);
  return override ?? preferred;
}

function metricPair(home: number | string, away: number | string) {
  return (
    <span className="grid grid-cols-[1fr_auto_1fr] items-baseline gap-2 tabular-nums">
      <strong>{home}</strong>
      <span aria-hidden="true" className="text-[#789487]">
        —
      </span>
      <strong className="text-right">{away}</strong>
    </span>
  );
}

function Pitch({
  match,
  minute,
  reducedMotion,
}: {
  match: MatchReplayInput;
  minute: number;
  reducedMotion: boolean;
}) {
  const frame = createMatchReplayFrame(match, minute);
  return (
    <figure className="min-w-0 overflow-hidden rounded-[1.4rem] border border-white/10 bg-[#07140f] p-2 shadow-[0_24px_70px_rgba(0,0,0,.32)] sm:p-3">
      <svg
        aria-hidden="true"
        data-testid="schematic-pitch"
        data-motion={reducedMotion ? 'reduced' : 'full'}
        focusable="false"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        viewBox="0 0 100 64"
        width="100%"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter
            id={`player-shadow-${match.matchId}`}
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feDropShadow
              dx="0"
              dy="1"
              floodColor="#00150d"
              floodOpacity=".7"
              stdDeviation="1.1"
            />
          </filter>
          <pattern
            id={`mown-${match.matchId}`}
            width="20"
            height="64"
            patternUnits="userSpaceOnUse"
          >
            <rect width="10" height="64" fill="#135f3b" />
            <rect x="10" width="10" height="64" fill="#105636" />
          </pattern>
        </defs>
        <rect
          width="100"
          height="64"
          rx="3"
          fill={`url(#mown-${match.matchId})`}
        />
        <g fill="none" stroke="#d8f2df" strokeOpacity=".72" strokeWidth=".55">
          <rect x="2" y="2" width="96" height="60" rx="1.3" />
          <path d="M50 2v60" />
          <circle cx="50" cy="32" r="9" />
          <circle cx="50" cy="32" r=".7" fill="#d8f2df" />
          <path d="M2 15h14v34H2M98 15H84v34h14M2 23h6v18H2M98 23h-6v18h6" />
          <circle cx="12" cy="32" r=".65" fill="#d8f2df" />
          <circle cx="88" cy="32" r=".65" fill="#d8f2df" />
        </g>
        {frame.players.map((player) => (
          <g
            key={`${player.side}-${player.id}`}
            data-player-id={player.id}
            style={{
              transform: `translate(${player.x}px, ${player.y}px)`,
              transition: reducedMotion
                ? 'none'
                : 'transform 420ms cubic-bezier(.2,.8,.2,1)',
            }}
          >
            <circle
              cx="0"
              cy="0"
              fill={
                player.side === 'home' ? match.home.color : match.away.color
              }
              filter={`url(#player-shadow-${match.matchId})`}
              r="2.65"
              stroke={player.side === 'home' ? '#fff4bd' : '#d9fff0'}
              strokeDasharray={player.side === 'away' ? '.8 .55' : undefined}
              strokeWidth=".7"
            />
            <text
              dominantBaseline="central"
              fill="#07140f"
              fontFamily="system-ui, sans-serif"
              fontSize="2.75"
              fontWeight="800"
              textAnchor="middle"
            >
              {player.number}
            </text>
          </g>
        ))}
        <g
          data-testid="match-ball"
          style={{
            transform: `translate(${frame.ball.x}px, ${frame.ball.y}px)`,
            transition: reducedMotion
              ? 'none'
              : 'transform 350ms cubic-bezier(.2,.8,.2,1)',
          }}
        >
          <circle r="1.55" fill="#f8f5df" stroke="#07140f" strokeWidth=".55" />
          <path d="m0-1 .8.6-.3 1h-1l-.3-1Z" fill="#07140f" />
        </g>
      </svg>
      <figcaption className="flex min-h-11 items-center gap-2 px-2 pt-2 text-sm text-[#d7e7df]">
        <span
          aria-hidden="true"
          className="grid size-7 shrink-0 place-items-center rounded-full bg-[#e7ff54] text-[#07140f]"
        >
          <SpeakerHigh weight="fill" />
        </span>
        {frame.description}
      </figcaption>
      <p className="sr-only" data-testid="pitch-text-alternative">
        {textualReplayAlternative(match, frame)}
      </p>
    </figure>
  );
}

function TeamMark({
  side,
  abbreviation,
  color,
}: {
  side: ReplaySide;
  abbreviation: string;
  color: string;
}) {
  return (
    <span
      aria-label={`${side === 'home' ? 'Mandante' : 'Visitante'} ${abbreviation}`}
      className="grid size-9 place-items-center rounded-full border-2 border-white/50 font-[family-name:var(--font-display)] text-xs font-black text-[#07140f] shadow-[0_0_0_3px_rgba(255,255,255,.08)]"
      style={{ backgroundColor: color }}
    >
      {abbreviation.slice(0, 3)}
    </span>
  );
}

export function MatchReplayViewer({
  match,
  autoPlay = false,
  reducedMotion: reducedMotionOverride,
  onResult,
}: MatchReplayViewerProps) {
  const duration = match.durationMinutes ?? 90;
  const [minute, setMinute] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const [speed, setSpeed] = useState<(typeof speedOptions)[number]>(1);
  const reducedMotion = useReducedMotion(reducedMotionOverride);
  const frame = useMemo(
    () => createMatchReplayFrame(match, minute),
    [match, minute],
  );

  useEffect(() => {
    if (!playing || frame.complete) return;
    const timeout = window.setTimeout(() => {
      const next = nextReplayMinute(match, minute);
      setMinute(next);
      if (next >= duration) setPlaying(false);
    }, 1_100 / speed);
    return () => window.clearTimeout(timeout);
  }, [duration, frame.complete, match, minute, playing, speed]);

  const visibleEvents = match.timeline.filter(
    (event) => event.minute <= minute,
  );
  const ratings = [...match.home.players, ...match.away.players]
    .filter((player) => player.rating !== undefined)
    .sort((left, right) => (right.rating ?? 0) - (left.rating ?? 0))
    .slice(0, 3);
  const homeStats = match.finalStatistics.home;
  const awayStats = match.finalStatistics.away;

  function revealResult() {
    setPlaying(false);
    setMinute(duration);
    onResult?.();
  }

  return (
    <section
      aria-labelledby={`replay-title-${match.matchId}`}
      className="min-w-0 overflow-hidden rounded-[1.75rem] border border-[#234338] bg-[#091913] text-[#f5f7e9] shadow-[0_28px_90px_rgba(0,31,20,.25)]"
      data-motion={reducedMotion ? 'reduced' : 'full'}
      data-testid="match-replay-viewer"
    >
      <div className="border-b border-white/10 bg-[linear-gradient(110deg,#0d291e_0%,#0a1b15_55%,#182217_100%)] px-4 py-4 sm:px-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[.68rem] font-bold uppercase tracking-[.22em] text-[#a9c3b6]">
              Central da partida · reprodução oficial
            </p>
            <h2
              id={`replay-title-${match.matchId}`}
              className="font-[family-name:var(--font-display)] text-xl font-black uppercase tracking-wide sm:text-2xl"
            >
              Campo tático 2D
            </h2>
          </div>
          <span className="rounded-sm border border-[#e7ff54]/50 bg-[#e7ff54]/10 px-2 py-1 font-mono text-xs font-bold text-[#e7ff54]">
            {frame.complete
              ? 'ENCERRADO'
              : `${String(frame.minute).padStart(2, '0')}:00`}
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <TeamMark
              side="home"
              abbreviation={match.home.abbreviation}
              color={match.home.color}
            />
            <strong className="truncate text-sm sm:text-base">
              {match.home.name}
            </strong>
          </div>
          <p
            aria-label={`${match.home.name} ${frame.score.home}, ${match.away.name} ${frame.score.away}`}
            className="scoreboard-digits text-4xl font-black leading-none tracking-[.08em] tabular-nums sm:text-5xl"
          >
            {frame.score.home}
            <span className="px-1 text-[#789487]">:</span>
            {frame.score.away}
          </p>
          <div className="flex min-w-0 flex-row-reverse items-center gap-2 text-right">
            <TeamMark
              side="away"
              abbreviation={match.away.abbreviation}
              color={match.away.color}
            />
            <strong className="truncate text-sm sm:text-base">
              {match.away.name}
            </strong>
          </div>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 p-3 sm:p-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(18rem,.75fr)]">
        <div className="min-w-0 space-y-3">
          <MatchStage
            fallback={
              <Pitch
                match={match}
                minute={minute}
                reducedMotion={reducedMotion}
              />
            }
            match={match}
            minute={minute}
            playing={playing}
            reducedMotion={reducedMotion}
            speed={speed}
          />

          <div className="rounded-xl border border-white/10 bg-[#0c2119] p-3">
            <div className="mb-2 flex items-center justify-between text-[.68rem] font-bold uppercase tracking-[.15em] text-[#a9c3b6]">
              <span>Momento · últimos 15 min</span>
              <span>
                {frame.telemetry.momentum.home}% /{' '}
                {frame.telemetry.momentum.away}%
              </span>
            </div>
            <div
              aria-label={`Momento: ${match.home.name} ${frame.telemetry.momentum.home}%, ${match.away.name} ${frame.telemetry.momentum.away}%`}
              className="flex h-2 overflow-hidden rounded-full bg-white/10"
              role="img"
            >
              <span
                className="block h-full"
                style={{
                  backgroundColor: match.home.color,
                  width: `${frame.telemetry.momentum.home}%`,
                }}
              />
              <span
                className="block h-full"
                style={{
                  backgroundColor: match.away.color,
                  width: `${frame.telemetry.momentum.away}%`,
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-white/10 bg-[#0c2119] p-2 text-xs text-[#a9c3b6]">
              xG-lite
              <div className="mt-1 text-base text-white">
                {metricPair(
                  frame.telemetry.xgLite.home.toFixed(2),
                  frame.telemetry.xgLite.away.toFixed(2),
                )}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0c2119] p-2 text-xs text-[#a9c3b6]">
              Chances
              <div className="mt-1 text-base text-white">
                {metricPair(
                  frame.telemetry.chances.home,
                  frame.telemetry.chances.away,
                )}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0c2119] p-2 text-xs text-[#a9c3b6]">
              Cartões
              <div className="mt-1 text-base text-white">
                {metricPair(
                  frame.telemetry.cards.home,
                  frame.telemetry.cards.away,
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-[#07140f] p-2">
            <button
              aria-label={playing ? 'Pausar reprodução' : 'Reproduzir partida'}
              className="grid size-11 place-items-center rounded-lg bg-[#e7ff54] text-[#07140f] transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e7ff54] disabled:opacity-40"
              disabled={frame.complete}
              onClick={() => setPlaying((current) => !current)}
              type="button"
            >
              {playing ? <Pause weight="fill" /> : <Play weight="fill" />}
            </button>
            <div
              aria-label="Velocidade da reprodução"
              className="flex gap-1"
              role="group"
            >
              {speedOptions.map((option) => (
                <button
                  aria-pressed={speed === option}
                  className="min-h-11 rounded-lg border border-white/10 px-3 text-sm font-bold tabular-nums hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e7ff54] aria-pressed:border-[#e7ff54] aria-pressed:text-[#e7ff54]"
                  key={option}
                  onClick={() => setSpeed(option)}
                  type="button"
                >
                  {option}x
                </button>
              ))}
            </div>
            <button
              className="ml-auto flex min-h-11 items-center gap-2 rounded-lg border border-[#e7ff54]/50 bg-[#e7ff54]/10 px-3 text-sm font-extrabold text-[#e7ff54] hover:bg-[#e7ff54]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e7ff54] disabled:border-white/10 disabled:text-[#789487]"
              disabled={frame.complete}
              onClick={revealResult}
              type="button"
            >
              <FastForward weight="fill" />
              {frame.complete ? 'Resultado exibido' : 'Ver resultado agora'}
            </button>
          </div>
          {reducedMotion ? (
            <p className="text-xs text-[#a9c3b6]" role="status">
              Movimento reduzido ativo: os lances mudam sem transições.
            </p>
          ) : null}
        </div>

        <aside className="grid min-w-0 content-start gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <div className="min-w-0 rounded-xl border border-white/10 bg-[#0c2119] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-[family-name:var(--font-display)] text-lg font-black uppercase">
                Lance a lance
              </h3>
              <SoccerBall className="text-[#e7ff54]" weight="fill" />
            </div>
            <div
              className="sr-only"
              aria-atomic="true"
              aria-live="polite"
              role="status"
            >
              {frame.description}
            </div>
            <ol
              aria-label="Eventos da partida"
              className="max-h-72 space-y-2 overflow-y-auto pr-1"
            >
              {visibleEvents.length === 0 ? (
                <li className="border-l-2 border-[#345748] pl-3 text-sm text-[#a9c3b6]">
                  Aguardando o apito inicial.
                </li>
              ) : (
                [...visibleEvents].reverse().map((event, reverseIndex) => (
                  <li
                    className={`border-l-2 pl-3 text-sm ${reverseIndex === 0 ? 'border-[#e7ff54] text-white' : 'border-[#345748] text-[#a9c3b6]'}`}
                    key={`${event.minute}-${event.type}-${visibleEvents.length - reverseIndex}`}
                  >
                    {describeReplayEvent(match, event)}
                  </li>
                ))
              )}
            </ol>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0c2119] p-4">
            <h3 className="mb-3 font-[family-name:var(--font-display)] text-lg font-black uppercase">
              {frame.complete ? 'Números oficiais' : 'Destaques'}
            </h3>
            {frame.complete ? (
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-[#a9c3b6]">Finalizações</dt>
                  <dd>{metricPair(homeStats.shots, awayStats.shots)}</dd>
                </div>
                {homeStats.shotsOnTarget !== undefined &&
                  awayStats.shotsOnTarget !== undefined && (
                    <div>
                      <dt className="text-[#a9c3b6]">No alvo</dt>
                      <dd>
                        {metricPair(
                          homeStats.shotsOnTarget,
                          awayStats.shotsOnTarget,
                        )}
                      </dd>
                    </div>
                  )}
                {homeStats.possession !== undefined &&
                  awayStats.possession !== undefined && (
                    <div>
                      <dt className="text-[#a9c3b6]">Posse</dt>
                      <dd>
                        {metricPair(
                          `${homeStats.possession}%`,
                          `${awayStats.possession}%`,
                        )}
                      </dd>
                    </div>
                  )}
                <div>
                  <dt className="text-[#a9c3b6]">xG oficial</dt>
                  <dd>
                    {metricPair(
                      homeStats.xg.toFixed(2),
                      awayStats.xg.toFixed(2),
                    )}
                  </dd>
                </div>
              </dl>
            ) : (
              <ol className="space-y-2">
                {ratings.map((player, index) => (
                  <li
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-sm"
                    key={player.id}
                  >
                    <span className="font-mono text-xs text-[#789487]">
                      0{index + 1}
                    </span>
                    <span className="truncate">{player.name}</span>
                    <strong className="rounded bg-white/10 px-1.5 py-0.5 tabular-nums text-[#e7ff54]">
                      {player.rating?.toFixed(1)}
                    </strong>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
